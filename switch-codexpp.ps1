# 切换回 Codex++ 代理（57321，稳定模式）
# 风格: 保留原端口代理，只改 config.toml

$configPath = "$env:USERPROFILE\.codex\config.toml"

Write-Output "正在切换回 Codex++ 代理 (57321)..."
Write-Output ""

# 1. 改 config.toml 指向 codex++
$config = Get-Content $configPath -Raw
$config = $config -replace '(base_url\s*=\s*")[^"]+(")', '${1}http://127.0.0.1:57321/v1${2}'
$config | Set-Content $configPath -Encoding UTF8 -NoNewline
Write-Output "  ✅ 已切换 base_url → 127.0.0.1:57321 (codex++)"
Write-Output ""
Write-Output "请重启 Codex 桌面端生效"
Write-Output ""
Write-Output "备用方案:"
Write-Output "  切直连 57324: .\switch-direct.ps1"
Write-Output "  切旧链 57322: .\switch-deepseek.ps1"
Write-Output "  一键恢复:  PowerShell -ExecutionPolicy Bypass -File .\recover-57321.ps1"
