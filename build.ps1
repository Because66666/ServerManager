# build.ps1: 临时构建脚本——从注册表重建 PATH，使用 rust-lld 链接（规避用户名含撇号导致外部 ld 解析路径失败）
$machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$env:PATH = "$machinePath;$userPath"
$rustLld = Join-Path $env:USERPROFILE ".rustup\toolchains\stable-x86_64-pc-windows-gnu\lib\rustlib\x86_64-pc-windows-gnu\bin\rust-lld.exe"
$env:RUSTFLAGS = "-C linker=rust-lld"
if (-not (Test-Path $rustLld)) { Write-Error "rust-lld not found: $rustLld"; exit 1 }
$env:PATH = (Split-Path $rustLld) + ";" + $env:PATH
Set-Location $PSScriptRoot
cargo build -j 2 2>&1 | Out-String
exit $LASTEXITCODE
