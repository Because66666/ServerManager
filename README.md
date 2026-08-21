# ServerManager

一个轻量的服务器任务管理面板：Rust 后端 + React 前端，在浏览器中统一管理常驻进程，并实时查看服务器资源占用。

![界面截图](docs/image.png)

## 功能

- **密钥登录**：管理界面需通过登录密钥访问，会话滑动续期，并带登录限速与 IP 锁定保护
- **持久化任务**：以命令行方式挂载常驻任务，任务列表持久化到 SQLite，服务重启后自动恢复并拉起重启前运行中的任务
- **控制台输出**：实时读取任务进程最近 500 行标准输出/错误
- **异常感知**：进程错误退出后任务不消失，以红点标记错误状态，可查看程序最后的输出
- **资源监控**：环形卡片近似实时展示 CPU、内存、磁盘占用
- **任务总览**：环形图展示运行中 / 错误 / 主动停止 / 已退出的任务分布，支持新建、编辑、停止、删除任务

## 技术栈

| 层 | 技术 |
| --- | --- |
| 后端 | Rust · axum · rusqlite (SQLite) · sysinfo · tokio |
| 前端 | React 19 · TypeScript · Vite · Tailwind CSS 4（SPA，构建为静态资源由后端托管） |

## 快速开始

### 环境要求

- Rust 工具链（stable）
- Node.js 与 npm

### 一键构建（Windows）

```bat
build.bat
```

自动完成：打包前端 → 编译后端 (release) → 将 `server-manager.exe` 复制到项目根目录。PowerShell 用户可使用 `build.ps1`。

### 手动构建

```bash
# 前端
cd frontend
npm install
npm run build

# 后端
cd ..
cargo build --release
```

### 配置与运行

复制配置模板并按需修改：

```bash
copy config.toml.example config.toml
```

`config.toml` 关键项：

```toml
[server]
host = "127.0.0.1"      # 监听地址
port = 5004             # 监听端口
static_dir = "frontend/dist"
db_path = "data.db"

[auth]
key = "请修改为你的登录密钥"   # 为空时服务拒绝启动
session_ttl_minutes = 1440   # 会话有效期（滑动续期）
```

启动：

```bash
server-manager.exe            # 默认读取 config.toml
server-manager.exe my.toml    # 指定配置文件
```

浏览器访问 `http://127.0.0.1:5004`，使用密钥登录后即可管理任务。

## 项目结构

```
├── src/            # Rust 后端（auth / config / db / stats / tasks / static_files）
├── frontend/       # React 前端（Vite + Tailwind）
├── config.toml.example  # 配置模板
├── build.bat / build.ps1  # 一键构建脚本
└── docs/image.png  # 界面截图
```

## 许可证

本项目基于 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans) 协议发布：署名、非商业性使用、相同方式共享。
