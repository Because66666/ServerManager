// main.rs: ServerManager 后端入口——加载配置、装配路由（登录/任务/监控/静态托管）并启动 HTTP 服务
mod auth;
mod config;
mod state;
mod stats;
mod static_files;
mod tasks;

use axum::middleware;
use axum::routing::{delete, get, post};
use axum::Router;
use config::Config;
use state::AppState;
use std::sync::Arc;

#[tokio::main]
async fn main() {
    let config_path = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "config.toml".to_string());
    let config = Config::load(&config_path).unwrap_or_else(|e| {
        eprintln!("{e}");
        std::process::exit(1);
    });

    let state = Arc::new(AppState::new(config.clone()));
    stats::start_stats_collector(state.clone());

    // 需要鉴权的 API 路由
    let protected = Router::new()
        .route("/api/logout", post(auth::logout))
        .route("/api/stats", get(stats::get_stats))
        .route(
            "/api/tasks",
            get(tasks::list_tasks).post(tasks::create_task),
        )
        .route("/api/tasks/{id}/output", get(tasks::get_output))
        .route("/api/tasks/{id}/stop", post(tasks::stop_task))
        .route("/api/tasks/{id}", delete(tasks::delete_task))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth::auth_middleware,
        ));

    let app = Router::new()
        .route("/api/login", post(auth::login))
        .merge(protected)
        .fallback(static_files::static_handler)
        .with_state(state);

    let addr = format!("{}:{}", config.server.host, config.server.port);
    println!("ServerManager 已启动: http://{addr}");
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .unwrap_or_else(|e| {
            eprintln!("绑定端口 {addr} 失败: {e}");
            std::process::exit(1);
        });
    axum::serve(listener, app).await.expect("HTTP 服务异常退出");
}
