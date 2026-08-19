// tasks.rs: 进程任务管理——创建、编辑、监控、输出环形缓冲（最新 500 行）、停止与删除
use crate::state::{ApiError, ApiResult, AppState};
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::process::Stdio;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, ChildStderr, ChildStdout, Command};
use tokio::sync::mpsc;
use uuid::Uuid;

/// 每个任务保留的最大输出行数
pub const MAX_OUTPUT_LINES: usize = 500;

/// 任务状态
#[derive(Serialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    /// 运行中
    Running,
    /// 正常退出（退出码 0）
    Exited,
    /// 错误退出（退出码非 0），前端展示红点
    Crashed,
    /// 启动失败，前端展示红点
    Failed,
    /// 被手动停止
    Stopped,
}

/// 任务对外信息
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub work_dir: Option<String>,
    pub status: TaskStatus,
    pub exit_code: Option<i32>,
    pub error: Option<String>,
    /// 创建时间（Unix 秒）
    pub created_at: i64,
}

/// 任务内部结构：对外信息 + 输出环形缓冲
pub struct TaskInner {
    pub info: Task,
    pub output: VecDeque<String>,
    /// 进程代数：每次（重新）启动递增，用于识别旧进程的监控句柄与输出
    pub generation: u64,
}

/// 任务输出查询响应
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskOutputResponse {
    pub task: Task,
    pub lines: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskRequest {
    pub name: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    pub work_dir: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaskRequest {
    pub name: String,
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    pub work_dir: Option<String>,
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// 向任务输出环形缓冲追加一行（仅当代数匹配，防止旧进程输出污染新会话）
fn push_line(state: &AppState, id: &str, generation: u64, line: String) {
    let mut tasks = state.tasks.lock().unwrap();
    if let Some(task) = tasks.get_mut(id) {
        if task.generation != generation {
            return;
        }
        if task.output.len() >= MAX_OUTPUT_LINES {
            task.output.pop_front();
        }
        task.output.push_back(line);
    }
}

/// GET /api/tasks 任务列表
pub async fn list_tasks(State(state): State<Arc<AppState>>) -> Json<Vec<Task>> {
    let mut list: Vec<Task> = state
        .tasks
        .lock()
        .unwrap()
        .values()
        .map(|t| t.info.clone())
        .collect();
    list.sort_by_key(|t| t.created_at);
    Json(list)
}

/// POST /api/tasks 创建并启动任务；启动失败时任务保留并标记为 failed
pub async fn create_task(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateTaskRequest>,
) -> ApiResult<(StatusCode, Json<Task>)> {
    let name = req.name.trim().to_string();
    let command = req.command.trim().to_string();
    if name.is_empty() {
        return Err(ApiError::bad_request("任务名称不能为空"));
    }
    if command.is_empty() {
        return Err(ApiError::bad_request("启动命令不能为空"));
    }

    let info = Task {
        id: Uuid::new_v4().to_string(),
        name,
        command,
        args: req.args,
        work_dir: req.work_dir,
        status: TaskStatus::Running,
        exit_code: None,
        error: None,
        created_at: now_secs(),
    };

    match spawn_process(&state, &info, 0) {
        Ok((child, stdout, stderr, kill_rx)) => {
            let id = info.id.clone();
            state.tasks.lock().unwrap().insert(
                id.clone(),
                TaskInner {
                    info: info.clone(),
                    output: VecDeque::new(),
                    generation: 0,
                },
            );
            tokio::spawn(monitor_task(state.clone(), id, 0, child, stdout, stderr, kill_rx));
            Ok((StatusCode::CREATED, Json(info)))
        }
        Err(e) => {
            // 启动失败也保留任务，标记 failed 以便前端展示红点与错误原因
            let mut failed = info.clone();
            failed.status = TaskStatus::Failed;
            failed.error = Some(e);
            state.tasks.lock().unwrap().insert(
                failed.id.clone(),
                TaskInner {
                    info: failed.clone(),
                    output: VecDeque::new(),
                    generation: 0,
                },
            );
            Ok((StatusCode::CREATED, Json(failed)))
        }
    }
}

/// PUT /api/tasks/:id 编辑任务（名称/命令/参数/工作目录），保存后立即以新配置重启进程
pub async fn update_task(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<UpdateTaskRequest>,
) -> ApiResult<Json<Task>> {
    let name = req.name.trim().to_string();
    let command = req.command.trim().to_string();
    if name.is_empty() {
        return Err(ApiError::bad_request("任务名称不能为空"));
    }
    if command.is_empty() {
        return Err(ApiError::bad_request("启动命令不能为空"));
    }

    // 更新配置并递增代数；旧监控句柄因代数不匹配而自动失效
    let (was_running, generation) = {
        let mut tasks = state.tasks.lock().unwrap();
        let task = tasks
            .get_mut(&id)
            .ok_or_else(|| ApiError::not_found("任务不存在"))?;
        let was_running = task.info.status == TaskStatus::Running;
        task.info.name = name;
        task.info.command = command;
        task.info.args = req.args;
        task.info.work_dir = req.work_dir;
        task.info.status = TaskStatus::Running;
        task.info.exit_code = None;
        task.info.error = None;
        task.generation += 1;
        // 重启后输出从新会话开始，清空旧输出
        task.output.clear();
        (was_running, task.generation)
    };

    // 旧进程仍在运行时先发送停止信号
    if was_running {
        if let Some((_, tx)) = state.kill_senders.lock().unwrap().get(&id).cloned() {
            let _ = tx.try_send(());
        }
    }

    let info = state
        .tasks
        .lock()
        .unwrap()
        .get(&id)
        .map(|t| t.info.clone())
        .ok_or_else(|| ApiError::not_found("任务不存在"))?;

    match spawn_process(&state, &info, generation) {
        Ok((child, stdout, stderr, kill_rx)) => {
            tokio::spawn(monitor_task(state.clone(), id, generation, child, stdout, stderr, kill_rx));
            Ok(Json(info))
        }
        Err(e) => {
            // 重启失败：标记 failed 并保留错误原因
            {
                let mut tasks = state.tasks.lock().unwrap();
                if let Some(task) = tasks.get_mut(&id) {
                    task.info.status = TaskStatus::Failed;
                    task.info.error = Some(e.clone());
                }
            }
            Err(ApiError::bad_request(e))
        }
    }
}

/// 启动子进程并返回句柄、输出流与停止信号接收端
fn spawn_process(
    state: &AppState,
    info: &Task,
    generation: u64,
) -> Result<(Child, ChildStdout, ChildStderr, mpsc::Receiver<()>), String> {
    let mut cmd = Command::new(&info.command);
    cmd.args(&info.args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(dir) = &info.work_dir {
        cmd.current_dir(dir);
    }
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("启动失败: {e}"))?;
    let stdout = child.stdout.take().expect("stdout 已被管道化");
    let stderr = child.stderr.take().expect("stderr 已被管道化");
    let (kill_tx, kill_rx) = mpsc::channel::<()>(1);
    state
        .kill_senders
        .lock()
        .unwrap()
        .insert(info.id.clone(), (generation, kill_tx));
    Ok((child, stdout, stderr, kill_rx))
}

/// 后台监控任务：汇聚 stdout/stderr 写入环形缓冲，进程退出后更新状态
async fn monitor_task(
    state: Arc<AppState>,
    id: String,
    generation: u64,
    mut child: Child,
    stdout: ChildStdout,
    stderr: ChildStderr,
    mut kill_rx: mpsc::Receiver<()>,
) {
    let mut out_lines = BufReader::new(stdout).lines();
    let mut err_lines = BufReader::new(stderr).lines();
    let mut out_done = false;
    let mut err_done = false;
    let mut stop_requested = false;

    loop {
        if out_done && err_done {
            break;
        }
        tokio::select! {
            res = out_lines.next_line(), if !out_done => match res {
                Ok(Some(line)) => push_line(&state, &id, generation, line),
                _ => out_done = true,
            },
            res = err_lines.next_line(), if !err_done => match res {
                Ok(Some(line)) => push_line(&state, &id, generation, line),
                _ => err_done = true,
            },
            _ = kill_rx.recv(), if !stop_requested => {
                stop_requested = true;
                let _ = child.start_kill();
            }
        }
    }

    let exit = child.wait().await;
    {
        let mut tasks = state.tasks.lock().unwrap();
        // 代数不匹配说明任务已被编辑重启或删除，旧监控不再更新状态
        let current = tasks.get_mut(&id).filter(|t| t.generation == generation);
        if let Some(task) = current {
            match exit {
                Ok(s) if stop_requested => {
                    task.info.status = TaskStatus::Stopped;
                    task.info.exit_code = s.code();
                }
                Ok(s) if s.success() => {
                    task.info.status = TaskStatus::Exited;
                    task.info.exit_code = s.code();
                }
                Ok(s) => {
                    task.info.status = TaskStatus::Crashed;
                    task.info.exit_code = s.code();
                }
                Err(e) => {
                    task.info.status = TaskStatus::Crashed;
                    task.info.error = Some(e.to_string());
                }
            }
        }
    }
    // 仅当代数匹配时才清理停止通道，避免误删新进程的信号
    let mut kill_senders = state.kill_senders.lock().unwrap();
    if kill_senders.get(&id).is_some_and(|(g, _)| *g == generation) {
        kill_senders.remove(&id);
    }
}

/// GET /api/tasks/:id/output 读取任务最新 500 行输出与当前状态
pub async fn get_output(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> ApiResult<Json<TaskOutputResponse>> {
    let tasks = state.tasks.lock().unwrap();
    let task = tasks.get(&id).ok_or_else(|| ApiError::not_found("任务不存在"))?;
    Ok(Json(TaskOutputResponse {
        task: task.info.clone(),
        lines: task.output.iter().cloned().collect(),
    }))
}

/// POST /api/tasks/:id/stop 停止运行中的任务
pub async fn stop_task(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> ApiResult<Json<Task>> {
    let sender = state
        .kill_senders
        .lock()
        .unwrap()
        .get(&id)
        .map(|(_, tx)| tx.clone());
    match sender {
        Some(tx) => {
            let _ = tx.try_send(());
        }
        None => {
            // 无停止通道说明进程已退出，仅确认任务存在
            let exists = state.tasks.lock().unwrap().contains_key(&id);
            if !exists {
                return Err(ApiError::not_found("任务不存在"));
            }
        }
    }
    let info = state
        .tasks
        .lock()
        .unwrap()
        .get(&id)
        .map(|t| t.info.clone())
        .ok_or_else(|| ApiError::not_found("任务不存在"))?;
    Ok(Json(info))
}

/// DELETE /api/tasks/:id 删除任务（运行中则先终止进程）
pub async fn delete_task(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> ApiResult<StatusCode> {
    let existed = state.tasks.lock().unwrap().remove(&id).is_some();
    if !existed {
        return Err(ApiError::not_found("任务不存在"));
    }
    if let Some((_, tx)) = state.kill_senders.lock().unwrap().remove(&id) {
        let _ = tx.try_send(());
    }
    Ok(StatusCode::NO_CONTENT)
}
