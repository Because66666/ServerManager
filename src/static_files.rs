// static_files.rs: 静态资源托管（运行时读磁盘）与 SPA 路由回退到 index.html
use crate::state::AppState;
use axum::extract::{Request, State};
use axum::http::{header, StatusCode};
use axum::response::Response;
use std::path::Path;
use std::sync::Arc;

/// 静态资源处理：路径不存在时回退到 index.html（SPA 路由）
pub async fn static_handler(
    State(state): State<Arc<AppState>>,
    req: Request,
) -> Result<Response, StatusCode> {
    let rel = req.uri().path().trim_start_matches('/');
    let rel = if rel.is_empty() { "index.html" } else { rel };
    // 防御路径穿越
    if rel.contains("..") {
        return Err(StatusCode::FORBIDDEN);
    }

    let root = &state.config.server.static_dir;
    let mut file = root.join(rel);
    if !file.is_file() {
        file = root.join("index.html");
    }

    let bytes = tokio::fs::read(&file)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;
    let mime = mime_by_extension(&file);
    Response::builder()
        .header(header::CONTENT_TYPE, mime)
        .header(header::CACHE_CONTROL, "no-cache")
        .body(bytes.into())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

/// 按扩展名推断 Content-Type
fn mime_by_extension(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .as_deref()
    {
        Some("html") => "text/html; charset=utf-8",
        Some("js") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("json") => "application/json; charset=utf-8",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("ico") => "image/x-icon",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        Some("txt") => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}
