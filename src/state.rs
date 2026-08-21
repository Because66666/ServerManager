// state.rs: 全局共享状态定义（会话、登录防护、任务表、持久化、系统监控缓存）与统一 API 错误类型
use crate::config::Config;
use crate::db::Db;
use crate::tasks::TaskInner;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;
use std::collections::{HashMap, VecDeque};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tokio::sync::mpsc;

/// 整机资源占用快照
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemStats {
    /// 整机 CPU 占用百分比
    pub cpu_usage: f32,
    /// 已用内存（字节）
    pub memory_used: u64,
    /// 总内存（字节）
    pub memory_total: u64,
    /// 内存占用百分比
    pub memory_usage: f32,
    /// 全盘已用空间（字节）
    pub disk_used: u64,
    /// 全盘总空间（字节）
    pub disk_total: u64,
    /// 磁盘占用百分比
    pub disk_usage: f32,
}

/// 单个客户端 IP 的登录防护记录：滑动窗口限速 + 连续失败锁定
#[derive(Default)]
pub struct LoginAttempt {
    /// 近期登录尝试时刻（用于滑动窗口限速）
    pub times: VecDeque<Instant>,
    /// 连续失败次数（成功后清零）
    pub failures: u32,
    /// 锁定截止时间
    pub locked_until: Option<Instant>,
}

/// 全局共享状态
pub struct AppState {
    pub config: Config,
    /// 会话 token -> 过期时刻（认证时滑动续期）
    pub sessions: Mutex<HashMap<String, Instant>>,
    /// 会话有效期
    pub session_ttl: Duration,
    /// 登录防护记录：客户端 IP -> 尝试记录
    pub login_attempts: Mutex<HashMap<String, LoginAttempt>>,
    /// 任务表：任务 id -> 任务内部结构（含输出环形缓冲）
    pub tasks: Mutex<HashMap<String, TaskInner>>,
    /// SQLite 持久层（任务记录）
    pub db: Db,
    /// 运行中任务的停止信号发送端：任务 id -> (进程代数, kill 通道)
    pub kill_senders: Mutex<HashMap<String, (u64, mpsc::Sender<()>)>>,
    /// 整机资源占用缓存，由后台采集任务周期刷新
    pub stats: Mutex<SystemStats>,
}

impl AppState {
    pub fn new(config: Config, db: Db) -> Self {
        let session_ttl = Duration::from_secs(config.auth.session_ttl_minutes * 60);
        Self {
            config,
            sessions: Mutex::new(HashMap::new()),
            session_ttl,
            login_attempts: Mutex::new(HashMap::new()),
            tasks: Mutex::new(HashMap::new()),
            db,
            kill_senders: Mutex::new(HashMap::new()),
            stats: Mutex::new(SystemStats::default()),
        }
    }
}

/// 统一 API 错误，序列化为 { "error": "..." }
pub struct ApiError {
    pub status: StatusCode,
    pub message: String,
}

impl ApiError {
    pub fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }

    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, message)
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, message)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(serde_json::json!({ "error": self.message }))).into_response()
    }
}

pub type ApiResult<T> = Result<T, ApiError>;
