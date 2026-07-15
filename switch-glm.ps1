# 切换回 GLM 免费模型
# 自动检测 Codex 的 Node.js 路径

$configPath = "$env:USERPROFILE\.codex\config.toml"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Output "正在切换到 GLM 免费通道..."

# 1. 先关掉图片过滤代理（57222 端口被 GLM 代理占用）
$existingFilter = Get-NetTCPConnection -LocalPort 57322 -ErrorAction SilentlyContinue
if ($existingFilter -and $existingFilter.Count -gt 0) {
    Stop-Process -Id $existingFilter[0].OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

# 2. 自动检测 Node.js
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

if ($nodePath) {
    # 启动 GLM 代理（监听 57330）
    $glmProxy = Join-Path $scriptDir "glm-proxy.js"
    if (Test-Path $glmProxy) {
        $existingGLM = Get-NetTCPConnection -LocalPort 57330 -ErrorAction SilentlyContinue
        if ($existingGLM -and $existingGLM.Count -gt 0) {
            Stop-Process -Id $existingGLM[0].OwningProcess -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        }
        Start-Process -WindowStyle Hidden -FilePath $nodePath -ArgumentList "`"$glmProxy`""
        Start-Sleep -Seconds 2

        # 启动图片过滤代理（监听 57322，转发到 GLM 代理 57330）
        $filterPath = Join-Path $scriptDir "image-filter-proxy.js"
        if (Test-Path $filterPath) {
            Start-Process -WindowStyle Hidden -FilePath $nodePath -ArgumentList "`"$filterPath`""
            Start-Sleep -Seconds 2
        }
        Write-Output "  ✅ GLM 代理已启动 (127.0.0.1:57330)"
    }
} else {
    Write-Warning "未找到 Node.js，跳过代理启动"
}

# 3. 改 config.toml
$config = Get-Content $configPath -Raw
$config = $config -replace '(base_url\s*=\s*")[^"]+(")', '${1}http://127.0.0.1:57322/v1${2}'
$config | Set-Content $configPath -Encoding UTF8 -NoNewline
Write-Output "  ✅ 已切换 base_url → 127.0.0.1:57322 (GLM 代理)"

Write-Output ""
Write-Output "请重启 Codex 桌面端生效"
Write-Output "切回付费: 运行 switch-deepseek.ps1"
