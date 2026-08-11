// auth.rs: 密钥登录、登出与会话 token 鉴权中间件
use crate::state::{ApiError, ApiResult, AppState};
use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::middleware::Next;
use axum::response::Response;
use axum::Json;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct LoginRequest {
    pub key: String,
}

#[derive(Serialize)]
pub struct LoginResponse {
    pub token: String,
}

/// 从请求头提取 Bearer token
fn extract_token(req: &Request) -> Option<String> {
    req.headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .map(|s| s.to_string())
}

/// POST /api/login 密钥登录，成功返回会话 token
pub async fn login(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LoginRequest>,
) -> ApiResult<Json<LoginResponse>> {
    if req.key == state.config.auth.key {
        let token = Uuid::new_v4().to_string();
        state.sessions.lock().unwrap().insert(token.clone());
        Ok(Json(LoginResponse { token }))
    } else {
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

/// 鉴权中间件：校验 Authorization 头中的会话 token
pub async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    req: Request,
    next: Next,
) -> Result<Response, ApiError> {
    let valid = extract_token(&req)
        .map(|token| state.sessions.lock().unwrap().contains(&token))
        .unwrap_or(false);
    if valid {
        Ok(next.run(req).await)
    } else {
        Err(ApiError::new(StatusCode::UNAUTHORIZED, "未登录或会话已失效"))
    }
}
