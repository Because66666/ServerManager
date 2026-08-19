// state.rs: 全局共享状态定义（会话、任务表、系统监控缓存）与统一 API 错误类型
use crate::config::Config;
use crate::tasks::TaskInner;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
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
}

/// 全局共享状态
pub struct AppState {
    pub config: Config,
    /// 已登录的会话 token 集合
    pub sessions: Mutex<HashSet<String>>,
    /// 任务表：任务 id -> 任务内部结构（含输出环形缓冲）
    pub tasks: Mutex<HashMap<String, TaskInner>>,
    /// 运行中任务的停止信号发送端：任务 id -> (进程代数, kill 通道)
    pub kill_senders: Mutex<HashMap<String, (u64, mpsc::Sender<()>)>>,
    /// 整机资源占用缓存，由后台采集任务周期刷新
    pub stats: Mutex<SystemStats>,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        Self {
            config,
            sessions: Mutex::new(HashSet::new()),
            tasks: Mutex::new(HashMap::new()),
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
