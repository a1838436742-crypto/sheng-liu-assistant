# 省流助手 v3.0 — 代理启动脚本
# 功能：启动图片过滤代理 (57322)，codex++ 由 CodexPlusPlusWatcher 独立管理

# ---------- 1. 查找 node ----------
$nodePaths = @(
    "$env:LOCALAPPDATA\OpenAI\Codex\runtimes\cua_node\*\bin\node.exe",
    "$env:LOCALAPPDATA\OpenAI\Codex\runtimes\cua_node\*\node.exe"
)
$nodePath = $null
foreach ($p in $nodePaths) {
    $resolved = Resolve-Path $p -ErrorAction SilentlyContinue
    if ($resolved) { $nodePath = $resolved[-1].Path; break }
}
if (-not $nodePath) {
    Write-Host "? 未找到 node.exe，跳过代理启动"
    exit 1
}

# ---------- 2. 启动 image-filter-proxy (57322) ----------
$port57322 = Get-NetTCPConnection -LocalPort 57322 -ErrorAction SilentlyContinue
if (-not $port57322) {
    $jsFile = "C:\Users\DEWK\Documents\省流助手v3.0\image-filter-proxy.js"
    if (Test-Path $jsFile) {
        Start-Process -WindowStyle Hidden -FilePath $nodePath -ArgumentList """$jsFile"""
        Write-Host "? image-filter-proxy (57322) 已启动"
    } else {
        Write-Host "?? 未找到 $jsFile"
    }
} else {
    Write-Host "??  image-filter-proxy (57322) 已在运行"
}

Write-Host "=== 代理启动完成 ==="