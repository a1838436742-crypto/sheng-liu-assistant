# safe-switch-57321.ps1 — 仅改 base_url，绝不改动其他配置
# 也会同步修复 codex++ provider-sync 备份

$configPath = "$env:USERPROFILE\.codex\config.toml"
$backupDir = "C:\Users\DEWK\Documents\省流助手v3.0\backups"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$TARGET = 'base_url = "http://127.0.0.1:57321/v1"'

# 1. 备份当前 config
if (!(Test-Path $backupDir)) { New-Item $backupDir -ItemType Directory -Force | Out-Null }
Copy-Item $configPath "$backupDir\config.pre-safe-switch.$stamp.toml" -Force
Write-Output "已备份: $backupDir\config.pre-safe-switch.$stamp.toml"

# 2. 只改 config.toml 的 base_url
$content = Get-Content $configPath -Raw
$old = $content
$content = $content -replace 'base_url = "http://127\.0\.0\.1:5732[\d]/v1"', $TARGET
$content = $content -replace 'base_url = "http://127\.0\.0\.1:57330/v1"', $TARGET
if ($content -eq $old) {
    Write-Output "⚠️ 未检测到需修改的 base_url"
} else {
    $content | Set-Content $configPath -Encoding utf8 -NoNewline
    Write-Output "✅ config.toml → 57321 (codex++)"
}

# 3. 同步修复 codex++ provider-sync 备份
$syncDir = "$env:USERPROFILE\.codex\backups_state\provider-sync"
if (Test-Path $syncDir) {
    Get-ChildItem $syncDir -Recurse -Filter "config.toml" | ForEach-Object {
        $c = Get-Content $_.FullName -Raw
        $fixed = $c -replace 'base_url = ".*?"', $TARGET
        if ($fixed -ne $c) {
            $fixed | Set-Content $_.FullName -Encoding utf8 -NoNewline
            Write-Output "  同步: $($_.Directory.Name) → 57321"
        }
    }
    # 补上没有 base_url 的
    Get-ChildItem $syncDir -Recurse -Filter "config.toml" | ForEach-Object {
        $c = Get-Content $_.FullName -Raw
        if ($c -notmatch 'base_url') {
            $c + "`n" + $TARGET | Set-Content $_.FullName -Encoding utf8 -NoNewline
            Write-Output "  补充: $($_.Directory.Name) → 57321"
        }
    }
}
Write-Output "✅ provider-sync 备份已同步"

Write-Output "`n如需切回 57324: cd 省流助手v3.0 && .\switch-direct.ps1"
Write-Output "重启 Codex 生效"
