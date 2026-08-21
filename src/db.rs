// db.rs: SQLite 持久层——任务配置与状态存储，服务重启后据此恢复任务列表并自动重启运行中任务
use crate::tasks::{Task, TaskStatus};
use rusqlite::{params, Connection};
use std::path::Path;
use std::sync::Mutex;

/// SQLite 存储封装（连接由互斥锁保护，任务量小、写操作短暂）
pub struct Db {
    conn: Mutex<Connection>,
}

fn status_to_str(s: &TaskStatus) -> &'static str {
    match s {
        TaskStatus::Running => "running",
        TaskStatus::Exited => "exited",
        TaskStatus::Crashed => "crashed",
        TaskStatus::Failed => "failed",
        TaskStatus::Stopped => "stopped",
    }
}

fn str_to_status(s: &str) -> TaskStatus {
    match s {
        "running" => TaskStatus::Running,
        "exited" => TaskStatus::Exited,
        "crashed" => TaskStatus::Crashed,
        "failed" => TaskStatus::Failed,
        _ => TaskStatus::Stopped,
    }
}

impl Db {
    /// 打开（不存在则创建）数据库并初始化表结构
    pub fn open(path: &Path) -> Result<Self, String> {
        let conn = Connection::open(path).map_err(|e| format!("打开数据库失败: {e}"))?;
        conn.pragma_update(None, "journal_mode", "WAL")
            .map_err(|e| format!("设置 WAL 失败: {e}"))?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                command TEXT NOT NULL,
                args TEXT NOT NULL,
                work_dir TEXT,
                status TEXT NOT NULL,
                exit_code INTEGER,
                error TEXT,
                created_at INTEGER NOT NULL
            )",
            [],
        )
        .map_err(|e| format!("初始化数据表失败: {e}"))?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// 加载全部任务（按创建时间排序）
    pub fn load_tasks(&self) -> Vec<Task> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = match conn.prepare(
            "SELECT id, name, command, args, work_dir, status, exit_code, error, created_at
             FROM tasks ORDER BY created_at",
        ) {
            Ok(s) => s,
            Err(_) => return Vec::new(),
        };
        let rows = stmt.query_map([], |row| {
            let args_json: String = row.get(3)?;
            let status_str: String = row.get(5)?;
            Ok(Task {
                id: row.get(0)?,
                name: row.get(1)?,
                command: row.get(2)?,
                args: serde_json::from_str(&args_json).unwrap_or_default(),
                work_dir: row.get(4)?,
                status: str_to_status(&status_str),
                exit_code: row.get(6)?,
                error: row.get(7)?,
                created_at: row.get(8)?,
            })
        });
        match rows {
            Ok(mapped) => mapped.filter_map(|r| r.ok()).collect(),
            Err(_) => Vec::new(),
        }
    }

    /// 新增任务记录
    pub fn insert_task(&self, task: &Task) {
        let args = serde_json::to_string(&task.args).unwrap_or_else(|_| "[]".to_string());
        let conn = self.conn.lock().unwrap();
        let _ = conn.execute(
            "INSERT OR REPLACE INTO tasks
             (id, name, command, args, work_dir, status, exit_code, error, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                task.id,
                task.name,
                task.command,
                args,
                task.work_dir,
                status_to_str(&task.status),
                task.exit_code,
                task.error,
                task.created_at,
            ],
        );
    }

    /// 更新任务的配置与状态
    pub fn update_task(&self, task: &Task) {
        self.insert_task(task);
    }

    /// 仅更新任务状态（进程退出等场景）
    pub fn update_status(&self, id: &str, status: &TaskStatus, exit_code: Option<i32>, error: &Option<String>) {
        let conn = self.conn.lock().unwrap();
        let _ = conn.execute(
            "UPDATE tasks SET status = ?2, exit_code = ?3, error = ?4 WHERE id = ?1",
            params![id, status_to_str(status), exit_code, error],
        );
    }

    /// 删除任务记录
    pub fn delete_task(&self, id: &str) {
        let conn = self.conn.lock().unwrap();
        let _ = conn.execute("DELETE FROM tasks WHERE id = ?1", params![id]);
    }
}
