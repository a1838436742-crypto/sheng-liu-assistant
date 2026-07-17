# switch-direct.ps1
# 切直连 57324 + 同步 provider-sync 备份防止manager覆盖

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
$TARGET = 'base_url = "http://127.0.0.1:57324/v1"'

# 启动 deepseek-direct 服务器 (57324)
$d = Get-NetTCPConnection -LocalPort 57324 -ErrorAction SilentlyContinue
if ($d) { Stop-Process -Id $d[0].OwningProcess -Force -ErrorAction SilentlyContinue; Start-Sleep 1 }
Start-Process -WindowStyle Hidden -FilePath $nodePath -ArgumentList "$scriptDir\deepseek-direct-server.js"
Start-Sleep -Seconds 2
Write-Output "  deepseek-direct-server(57324) OK"

# 改 config.toml -> 57324
$configPath = "$env:USERPROFILE\.codex\config.toml"
$content = Get-Content $configPath -Raw
$content = $content -replace 'base_url = "http://127\.0\.0\.1:5732[\d]/v1"', $TARGET
$content = $content -replace 'base_url = "http://127\.0\.0\.1:57330/v1"', $TARGET
$content | Set-Content $configPath -Encoding utf8 -NoNewline
Write-Output "  config.toml -> 57324 OK"

# 同步 provider-sync 备份
$syncDir = "$env:USERPROFILE\.codex\backups_state\provider-sync"
if (Test-Path $syncDir) {
    Get-ChildItem $syncDir -Recurse -Filter "config.toml" | ForEach-Object {
        $c = Get-Content $_.FullName -Raw
        $fixed = $c -replace 'base_url = ".*?"', $TARGET
        if ($fixed -ne $c) {
            $fixed | Set-Content $_.FullName -Encoding utf8 -NoNewline
            Write-Output "  同步: $($_.Directory.Name) -> 57324"
        }
    }
    Get-ChildItem $syncDir -Recurse -Filter "config.toml" | ForEach-Object {
        $c = Get-Content $_.FullName -Raw
        if ($c -notmatch 'base_url') {
            $c + "`n" + $TARGET | Set-Content $_.FullName -Encoding utf8 -NoNewline
            Write-Output "  补充: $($_.Directory.Name) -> 57324"
        }
    }
}
Write-Output "  provider-sync 备份已同步 OK"

Write-Output "`n就绪！请重启 Codex 生效"
Write-Output "切回 57321: .\safe-switch-57321.ps1 + 重启"
