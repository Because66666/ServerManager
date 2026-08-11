// stats.rs: 整机 CPU / 内存占用采集（后台周期刷新）与查询接口
use crate::state::{AppState, SystemStats};
use axum::extract::State;
use axum::Json;
use std::sync::Arc;
use std::time::Duration;
use sysinfo::System;

/// 采集间隔（秒）
const REFRESH_INTERVAL_SECS: u64 = 2;

/// 启动后台采集任务，周期刷新整机 CPU / 内存占用缓存
pub fn start_stats_collector(state: Arc<AppState>) {
    tokio::spawn(async move {
        let mut sys = System::new();
        loop {
            sys.refresh_cpu_usage();
            sys.refresh_memory();
            let total = sys.total_memory();
            let used = sys.used_memory();
            let snapshot = SystemStats {
                cpu_usage: sys.global_cpu_usage(),
                memory_used: used,
                memory_total: total,
                memory_usage: if total > 0 {
                    used as f32 / total as f32 * 100.0
                } else {
                    0.0
                },
            };
            *state.stats.lock().unwrap() = snapshot;
            tokio::time::sleep(Duration::from_secs(REFRESH_INTERVAL_SECS)).await;
        }
    });
}

/// GET /api/stats 查询整机资源占用快照
pub async fn get_stats(State(state): State<Arc<AppState>>) -> Json<SystemStats> {
    Json(state.stats.lock().unwrap().clone())
}
