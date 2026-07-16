Write-Output "正在启动 deepseek-direct 直连代理..."

$nodePath = $null
$candidates = @(
    "$env:LOCALAPPDATA\OpenAI\Codex\runtimes\cua_node\*\bin\node.exe",
    "$env:LOCALAPPDATA\Programs\Codex\resources\bin\node.exe"
)
foreach ($c in $candidates) {
    $resolved = Resolve-Path $c -ErrorAction SilentlyContinue
    if ($resolved) { $nodePath = $resolved.Path; break }
}
if (-not $nodePath) { Write-Warning "未找到 Node.js"; exit 1 }

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 启动 deepseek-direct 服务器 (57324)
$d = Get-NetTCPConnection -LocalPort 57324 -ErrorAction SilentlyContinue
if ($d) { Stop-Process -Id $d[0].OwningProcess -Force -ErrorAction SilentlyContinue; Start-Sleep 1 }
Start-Process -WindowStyle Hidden -FilePath $nodePath -ArgumentList "$scriptDir\deepseek-direct-server.js"
Start-Sleep -Seconds 2
Write-Output "  deepseek-direct-server(57324) ✅"

# config.toml → 57324
$configPath = "$env:USERPROFILE\.codex\config.toml"
(Get-Content $configPath) -replace 'base_url = "http://127\.0\.0\.1:5732[0-9]/v1"', 'base_url = "http://127.0.0.1:57324/v1"' -replace 'base_url = "http://127\.0\.0\.1:57330/v1"', 'base_url = "http://127.0.0.1:57324/v1"' | Set-Content $configPath -Encoding utf8

Write-Output "  config.toml → 57324 ✅"
Write-Output "就绪"
