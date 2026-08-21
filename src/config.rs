// config.rs: 配置文件结构与加载逻辑（服务地址、静态资源目录、登录密钥）
use serde::Deserialize;
use std::path::PathBuf;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    #[serde(default)]
    pub server: ServerConfig,
    pub auth: AuthConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    #[serde(default = "default_host")]
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default = "default_static_dir")]
    pub static_dir: PathBuf,
    /// SQLite 数据库文件路径（任务持久化）
    #[serde(default = "default_db_path")]
    pub db_path: PathBuf,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: default_host(),
            port: default_port(),
            static_dir: default_static_dir(),
            db_path: default_db_path(),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct AuthConfig {
    pub key: String,
    /// 会话有效期（分钟），认证请求会滑动续期
    #[serde(default = "default_session_ttl_minutes")]
    pub session_ttl_minutes: u64,
    /// 滑动窗口（秒）内允许的最大登录尝试次数
    #[serde(default = "default_rate_window_secs")]
    pub login_window_secs: u64,
    #[serde(default = "default_max_attempts")]
    pub max_attempts_per_window: u32,
    /// 连续失败多少次后锁定
    #[serde(default = "default_max_failures")]
    pub max_failures: u32,
    /// 锁定时长（分钟）
    #[serde(default = "default_lock_minutes")]
    pub lock_minutes: u64,
}

fn default_host() -> String {
    "127.0.0.1".to_string()
}

fn default_port() -> u16 {
    8080
}

fn default_static_dir() -> PathBuf {
    PathBuf::from("frontend/dist")
}

fn default_db_path() -> PathBuf {
    PathBuf::from("data.db")
}

fn default_session_ttl_minutes() -> u64 {
    1440
}

fn default_rate_window_secs() -> u64 {
    60
}

fn default_max_attempts() -> u32 {
    5
}

fn default_max_failures() -> u32 {
    5
}

fn default_lock_minutes() -> u64 {
    15
}

impl Config {
    pub fn load(path: &str) -> Result<Self, String> {
        let text = std::fs::read_to_string(path)
            .map_err(|e| format!("读取配置文件 {path} 失败: {e}"))?;
        toml::from_str(&text).map_err(|e| format!("解析配置文件 {path} 失败: {e}"))
    }
}
