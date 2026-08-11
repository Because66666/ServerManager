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
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: default_host(),
            port: default_port(),
            static_dir: default_static_dir(),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct AuthConfig {
    pub key: String,
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

impl Config {
    pub fn load(path: &str) -> Result<Self, String> {
        let text = std::fs::read_to_string(path)
            .map_err(|e| format!("读取配置文件 {path} 失败: {e}"))?;
        toml::from_str(&text).map_err(|e| format!("解析配置文件 {path} 失败: {e}"))
    }
}
