// auth.rs: 密钥登录、登出与会话 token 鉴权中间件
// 登录防护：IP 维度滑动窗口限速 + 连续失败锁定；会话带 TTL 且认证时滑动续期
use crate::state::{ApiError, ApiResult, AppState};
use axum::extract::{ConnectInfo, Request, State};
use axum::http::{HeaderMap, StatusCode};
use axum::middleware::Next;
use axum::response::Response;
use axum::Json;
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use uuid::Uuid;

#[derive(Deserialize)]
pub struct LoginRequest {
    pub key: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
    /// 会话有效期（秒）
    pub expires_in: u64,
}

/// 从请求头提取 Bearer token
fn extract_token(req: &Request) -> Option<String> {
    req.headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .map(|s| s.to_string())
}

/// 提取客户端 IP：优先 X-Forwarded-For 首个地址（需反代可信），否则取连接对端地址
fn client_ip(headers: &HeaderMap, addr: &SocketAddr) -> String {
    headers
        .get("X-Forwarded-For")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .unwrap_or_else(|| addr.ip().to_string())
}

/// 常量时间字符串比较，避免时序侧信道
fn constant_time_eq(a: &str, b: &str) -> bool {
    let (ab, bb) = (a.as_bytes(), b.as_bytes());
    if ab.len() != bb.len() {
        return false;
    }
    ab.iter().zip(bb).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

/// 登录前置检查：锁定与滑动窗口限速。通过则记录本次尝试时刻
fn check_login_allowed(state: &AppState, ip: &str) -> ApiResult<()> {
    let auth = &state.config.auth;
    let window = Duration::from_secs(auth.login_window_secs);
    let now = Instant::now();

    let mut attempts = state.login_attempts.lock().unwrap();
    // 顺带清理过期会话与失效的防护记录，控制内存增长
    state.sessions.lock().unwrap().retain(|_, exp| *exp > now);
    attempts.retain(|_, a| {
        a.locked_until.is_some_and(|t| t > now)
            || a.failures > 0
            || a.times.back().is_some_and(|t| now.duration_since(*t) < window)
    });

    let entry = attempts.entry(ip.to_string()).or_default();

    // 失败锁定检查
    if let Some(until) = entry.locked_until {
        if until > now {
            let secs = (until - now).as_secs() + 1;
            return Err(ApiError::new(
                StatusCode::TOO_MANY_REQUESTS,
                format!("连续失败次数过多，已锁定，请 {secs} 秒后再试"),
            ));
        }
        entry.locked_until = None;
    }

    // 滑动窗口限速
    while entry
        .times
        .front()
        .is_some_and(|t| now.duration_since(*t) > window)
    {
        entry.times.pop_front();
    }
    if entry.times.len() as u32 >= auth.max_attempts_per_window {
        let retry = window - now.duration_since(*entry.times.front().unwrap());
        return Err(ApiError::new(
            StatusCode::TOO_MANY_REQUESTS,
            format!("登录过于频繁，请 {} 秒后再试", retry.as_secs() + 1),
        ));
    }

    entry.times.push_back(now);
    Ok(())
}

/// 记录登录失败：累计连续失败次数，达到阈值则锁定
fn record_login_failure(state: &AppState, ip: &str) {
    let auth = &state.config.auth;
    let mut attempts = state.login_attempts.lock().unwrap();
    if let Some(entry) = attempts.get_mut(ip) {
        entry.failures += 1;
        if entry.failures >= auth.max_failures {
            entry.locked_until = Some(Instant::now() + Duration::from_secs(auth.lock_minutes * 60));
        }
    }
}

/// 登录成功：清空该 IP 的失败计数与限速记录
fn record_login_success(state: &AppState, ip: &str) {
    state.login_attempts.lock().unwrap().remove(ip);
}

/// POST /api/login 密钥登录，成功返回带 TTL 的会话 token
pub async fn login(
    State(state): State<Arc<AppState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(req): Json<LoginRequest>,
) -> ApiResult<Json<LoginResponse>> {
    let ip = client_ip(&headers, &addr);

    check_login_allowed(&state, &ip)?;

    if constant_time_eq(&req.key, &state.config.auth.key) {
        record_login_success(&state, &ip);
        let token = Uuid::new_v4().to_string();
        let ttl = state.session_ttl;
        state
            .sessions
            .lock()
            .unwrap()
            .insert(token.clone(), Instant::now() + ttl);
        Ok(Json(LoginResponse {
            token,
            expires_in: ttl.as_secs(),
        }))
    } else {
        record_login_failure(&state, &ip);
        Err(ApiError::new(StatusCode::UNAUTHORIZED, "密钥不正确"))
    }
}

/// POST /api/logout 登出，作废当前 token
pub async fn logout(State(state): State<Arc<AppState>>, req: Request) -> StatusCode {
    if let Some(token) = extract_token(&req) {
        state.sessions.lock().unwrap().remove(&token);
    }
    StatusCode::NO_CONTENT
}

/// 鉴权中间件：校验会话 token 有效性与 TTL，通过后滑动续期
pub async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    req: Request,
    next: Next,
) -> Result<Response, ApiError> {
    let token = extract_token(&req);
    let valid = token.as_ref().is_some_and(|token| {
        let mut sessions = state.sessions.lock().unwrap();
        let now = Instant::now();
        match sessions.get(token) {
            Some(exp) if *exp > now => {
                // 滑动续期：活跃会话自动延长有效期
                sessions.insert(token.clone(), now + state.session_ttl);
                true
            }
            Some(_) => {
                sessions.remove(token);
                false
            }
            None => false,
        }
    });
    if valid {
        Ok(next.run(req).await)
    } else {
        Err(ApiError::new(StatusCode::UNAUTHORIZED, "未登录或会话已失效"))
    }
}
