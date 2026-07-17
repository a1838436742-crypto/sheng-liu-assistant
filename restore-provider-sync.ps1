# 省流助手 v3.0 — 复原 provider-sync 备份脚本
# 日期: 2026-07-17
# 作用: 将 provider-sync 备份文件恢复为原始状态（57321）
# 用法: PowerShell -ExecutionPolicy Bypass -File "此脚本路径"

$restoreDir = "$env:USERPROFILE\.codex\backups\restore-snapshot-2026-07-17"
$backupDir = "$env:USERPROFILE\.codex\backups"

Write-Output "============================================"
Write-Output "  复原 provider-sync 备份 (57321)"
Write-Output "============================================"
Write-Output ""

if (!(Test-Path $restoreDir)) {
    Write-Output "  错误: 找不到备份目录 $restoreDir"
    exit 1
}

$restored = 0
Get-ChildItem "$restoreDir\*.bak" | ForEach-Object {
    $origName = $_.Name -replace "\.config\.toml\.bak$", ""
    $targetDir = Join-Path $backupDir $origName
    $targetFile = Join-Path $targetDir "config.toml"
    if (Test-Path $targetDir) {
        Copy-Item -Path $_.FullName -Destination $targetFile -Force
        Write-Output "  $origName -> 已恢复"
        $restored++
    } else {
        Write-Output "  $origName -> 目标目录不存在，跳过"
    }
}

if ($restored -gt 0) {
    Write-Output ""
    Write-Output "  完成！已恢复 $restored 个备份文件"
    Write-Output "  所有备份的 base_url 均为 127.0.0.1:57321"
} else {
    Write-Output "  没有文件被恢复"
}
Write-Output ""
Write-Output "重启 Codex 后生效（如果当前配置被同步覆盖）"