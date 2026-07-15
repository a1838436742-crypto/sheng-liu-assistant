# 切换回 DeepSeek V4 Flash（付费）
# 自动检测 Codex 的 Node.js 路径

$configPath = "$env:USERPROFILE\.codex\config.toml"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Output "正在切换回 DeepSeek V4 Flash..."

# 1. 自动检测 Codex 自带的 Node.js
$nodePath = $null
$candidates = @(
    "$env:LOCALAPPDATA\Programs\Codex\resources\bin\node.exe",
    "$env:LOCALAPPDATA\OpenAI\Codex\runtimes\cua_node\*\bin\node.exe",
    "$env:USERPROFILE\AppData\Local\Programs\Codex\resources\bin\node.exe",
    "C:\Program Files\nodejs\node.exe"
)
foreach ($c in $candidates) {
    $resolved = Resolve-Path $c -ErrorAction SilentlyContinue
    if ($resolved) { $nodePath = $resolved.Path; break }
}

if (-not $nodePath) {
    Write-Warning "未找到 Node.js，跳过图片过滤代理启动"
} else {
    # 启动图片过滤代理
    $filterPath = Join-Path $scriptDir "image-filter-proxy.js"
    if (Test-Path $filterPath) {
        $existing = Get-NetTCPConnection -LocalPort 57322 -ErrorAction SilentlyContinue
        if ($existing -and $existing.Count -gt 0) {
            Stop-Process -Id $existing[0].OwningProcess -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        }
        Start-Process -WindowStyle Hidden -FilePath $nodePath -ArgumentList "`"$filterPath`""
        Start-Sleep -Seconds 2
        Write-Output "  ✅ 图片过滤代理已启动 (127.0.0.1:57322)"
    } else {
        Write-Warning "未找到 image-filter-proxy.js，跳过过滤代理"
    }
}

# 2. 改 config.toml
$config = Get-Content $configPath -Raw
$config = $config -replace '(base_url\s*=\s*")[^"]+(")', '${1}http://127.0.0.1:57322/v1${2}'
$config | Set-Content $configPath -Encoding UTF8 -NoNewline
Write-Output "  ✅ 已切换 base_url → 127.0.0.1:57322 (DeepSeek)"

Write-Output ""
Write-Output "请重启 Codex 桌面端生效"
