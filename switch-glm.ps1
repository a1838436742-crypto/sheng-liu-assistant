# ⚠️ 已废弃 — 不再需要手动切换和重启
# 现在 config.toml 默认指向 GLM 代理 (57330)，日常对话走免费
# 复杂任务由 Codex 在对话内自动用 deepseek-direct.js 直连 DeepSeek
# 删除此脚本前请确认 .codex\AGENTS.md 中的铁律17已生效
# 切换到 GLM（免费模型）
# 只改 base_url，不碰其他配置段

$configPath = "$env:USERPROFILE\.codex\config.toml"
Write-Output "正在切换至 GLM 免费模型..."

# 1. 确保 GLM 代理在运行
$nodePath = "C:\Users\DEWK\AppData\Local\OpenAI\Codex\runtimes\cua_node\ecfc0d9aa02807e3\bin\node.exe"
$proxyPath = "C:\Users\DEWK\Documents\省流助手v3.0\glm-proxy.js"
$existing = Get-NetTCPConnection -LocalPort 57330 -ErrorAction SilentlyContinue
if ($existing -and $existing.Count -gt 0) {
  $oldPid = $existing[0].OwningProcess
  Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  Write-Output "  已关闭旧 GLM 代理 (PID $oldPid)"
}
Start-Process -WindowStyle Hidden -FilePath $nodePath -ArgumentList "`"$proxyPath`""
Start-Sleep -Seconds 2
Write-Output "  ✅ GLM 代理已启动 (127.0.0.1:57330)"

# 2. 只改 config.toml 中的 base_url 行（不改其他配置）
$config = Get-Content $configPath -Raw
$config = $config -replace '(base_url\s*=\s*")[^"]+(")', '${1}http://127.0.0.1:57330/v1${2}'
$config | Set-Content $configPath -Encoding UTF8 -NoNewline
Write-Output "  ✅ 已切换 base_url → 127.0.0.1:57330 (GLM)"

# 3. 提示
Write-Output ""
Write-Output "请重启 Codex 桌面端生效"
Write-Output "之后所有对话走 GLM-4-Flash（免费），图片走 GLM-4V"
Write-Output "切回付费: 运行 switch-deepseek.ps1"

