// static_files.rs: 静态资源托管（运行时读磁盘）与 SPA 路由回退到 index.html
// 安全防护：百分号解码归一化 + canonicalize 后的目录包含性校验，杜绝路径穿越、
// 绝对路径/UNC 注入、编码绕过（%22/%2e%2e/%2f）与符号链接逃逸
use crate::state::AppState;
use axum::extract::{Request, State};
use axum::http::{header, StatusCode};
use axum::response::Response;
use std::path::Path;
use std::sync::Arc;

/// 百分号解码（UTF-8 有损），将 %22 / %2e%2e / %2f 等编码形态归一化后再做安全检查
fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).ok();
            if let Some(b) = hex.and_then(|h| u8::from_str_radix(h, 16).ok()) {
                out.push(b);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// 静态资源处理：仅允许落在静态根目录内部的文件，其余一律回退 index.html（SPA 路由）
pub async fn static_handler(
    State(state): State<Arc<AppState>>,
    req: Request,
) -> Result<Response, StatusCode> {
    // 根目录不存在时直接 404，避免无意义的回退读取
    let root = state
        .config
        .server
        .static_dir
        .canonicalize()
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let raw_path = req.uri().path();
    let rel = percent_decode(raw_path.trim_start_matches('/'));

    // 显式拒绝路径穿越与空字节；编码形态已在解码后归一化，无法绕过
    if rel.contains("..") || rel.contains('\0') {
        return Err(StatusCode::FORBIDDEN);
    }

    // join 对绝对路径（含 D:\ 盘符与 \\UNC）会整体替换根目录，
    // 因此必须用 canonicalize + starts_with 做最终的目录包含性校验
    let target = if rel.trim_matches(['/', '\\']).is_empty() {
        root.join("index.html")
    } else {
        root.join(rel.trim_start_matches(['/', '\\']))
    };
    let file = match target.canonicalize() {
        Ok(c) if c.starts_with(&root) && c.is_file() => c,
        _ => root.join("index.html"),
    };

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
