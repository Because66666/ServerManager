@echo off
rem build.bat: 一键构建 ServerManager——打包前端 + 编译后端(release) + 复制 exe 到根目录(覆写)
rem 说明: 因本机用户名含撇号导致外部 MinGW ld 链接失败, 此处改用 rust-lld 链接
chcp 65001 >nul
cd /d "%~dp0"

echo [1/3] 打包前端...
pushd frontend
if not exist node_modules (
    echo 首次构建, 安装前端依赖...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo 前端依赖安装失败
        popd
        pause
        exit /b 1
    )
)
call npm run build
if errorlevel 1 (
    echo 前端打包失败
    popd
    pause
    exit /b 1
)
popd

rem 将 rustup 工具目录加入 PATH, 使 rustc 能找到 rust-lld
set "PATH=%USERPROFILE%\.rustup\toolchains\stable-x86_64-pc-windows-gnu\lib\rustlib\x86_64-pc-windows-gnu\bin;%PATH%"
set "RUSTFLAGS=-C linker=rust-lld"

echo [2/3] 编译后端 (release)...
cargo build --release -j 2
if errorlevel 1 (
    echo 编译失败, 请检查上方错误信息
    pause
    exit /b 1
)

echo [3/3] 复制 exe 到根目录...
copy /y "target\release\server-manager.exe" "server-manager.exe" >nul
if errorlevel 1 (
    echo 复制失败, 请确认根目录的 server-manager.exe 未被占用
    pause
    exit /b 1
)

echo 构建完成: %~dp0server-manager.exe
pause
