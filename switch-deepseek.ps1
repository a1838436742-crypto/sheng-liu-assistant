# ⚠️ 已废弃 — 不再需要手动切换和重启
# 现在 config.toml 默认指向 GLM 代理 (57330)，日常对话走免费
# 复杂任务由 Codex 在对话内自动用 deepseek-direct.js 直连 DeepSeek
# 删除此脚本前请确认 .codex\AGENTS.md 中的铁律17已生效
# 切换回 DeepSeek V4 Flash（付费）
# 只改 base_url，不碰其他配置段

$configPath = "$env:USERPROFILE\.codex\config.toml"
Write-Output "正在切换回 DeepSeek V4 Flash..."

# 1. 确保图片过滤代理在运行
$nodePath = "C:\Users\DEWK\AppData\Local\OpenAI\Codex\runtimes\cua_node\ecfc0d9aa02807e3\bin\node.exe"
$filterPath = "C:\Users\DEWK\Documents\省流助手v3.0\image-filter-proxy.js"
$existing = Get-NetTCPConnection -LocalPort 57322 -ErrorAction SilentlyContinue
if ($existing -and $existing.Count -gt 0) {
  $oldPid = $existing[0].OwningProcess
  Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  Write-Output "  已关闭旧过滤代理 (PID $oldPid)"
}
Start-Process -WindowStyle Hidden -FilePath $nodePath -ArgumentList "`"$filterPath`""
Start-Sleep -Seconds 2
Write-Output "  ✅ 图片过滤代理已启动 (127.0.0.1:57322)"

# 2. 只改 config.toml 中的 base_url 行
$config = Get-Content $configPath -Raw
$config = $config -replace '(base_url\s*=\s*")[^"]+(")', '${1}http://127.0.0.1:57322/v1${2}'
$config | Set-Content $configPath -Encoding UTF8 -NoNewline
Write-Output "  ✅ 已切换 base_url → 127.0.0.1:57322 (DeepSeek)"

# 3. 提示
Write-Output ""
Write-Output "请重启 Codex 桌面端生效"
Write-Output "发图不会再导致线程坏死（图片会被过滤代理拦截）"
Write-Output "切回免费: 运行 switch-glm.ps1"

