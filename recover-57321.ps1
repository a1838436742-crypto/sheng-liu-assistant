# 省流助手 v3.0 - 稳定恢复脚本 (57321/codex++)
# 日期: 2026-07-17
# 作用: 当代理断连时，一键恢复 config.toml 到 57321 + 清理冲突进程
# 用法: PowerShell -ExecutionPolicy Bypass -File "此脚本路径"

$configPath = "$env:USERPROFILE\.codex\config.toml"
$backupDir = "$env:USERPROFILE\.codex\backups"
$dateStamp = Get-Date -Format "yyyyMMdd-HHmmss"

Write-Output "============================================"
Write-Output "  省流助手 v3.0 - 恢复到 57321 稳定模式"
Write-Output "  日期: $dateStamp"
Write-Output "============================================"
Write-Output ""

# 第1步：备份当前 config
if (!(Test-Path $backupDir)) { New-Item -Path $backupDir -ItemType Directory -Force | Out-Null }
$backupPath = "$backupDir\config.pre-recovery.$dateStamp.toml"
Copy-Item -Path $configPath -Destination $backupPath -Force
Write-Output "  当前 config 已备份 -> $backupPath"

# 第2步：写入稳定 57321 配置
$nl = "`r`n"
$nc = "model = ""deepseek-v4-flash""$nl"
$nc += "model_provider = ""custom""$nl"
$nc += "enabled = true$nl"
$nc += "$nl"
$nc += "notify = [ ""C:\Users\DEWK\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node_modules\@oai\sky\bin\windows\codex-computer-use.exe"", ""turn-ended"" ]$nl"
$nc += "$nl"
$nc += "[model_providers.custom]$nl"
$nc += "name = ""custom""$nl"
$nc += "wire_api = ""responses""$nl"
$nc += "requires_openai_auth = true$nl"
$nc += "base_url = ""http://127.0.0.1:57321/v1""$nl"
$nc += "$nl"
$nc += "[mcp_servers]$nl"
$nc += "[mcp_servers.node_repl]$nl"
$nc += "args = []$nl"
$nc += "command = 'C:\Users\DEWK\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node_repl.exe'$nl"
$nc += "startup_timeout_sec = 120$nl"
$nc += "[mcp_servers.node_repl.env]$nl"
$nc += "NODE_REPL_NATIVE_PIPE_CONNECT_TIMEOUT_MS = ""1000""$nl"
$nc += "NODE_REPL_NODE_MODULE_DIRS = 'C:\Users\DEWK\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node_modules'$nl"
$nc += "NODE_REPL_NODE_PATH = 'C:\Users\DEWK\AppData\Local\OpenAI\Codex\runtimes\cua_node\03b1cdac8af3a530\bin\node.exe'$nl"
$nc += "NODE_REPL_TRUSTED_CODE_PATHS = 'C:\Users\DEWK\.codex'$nl"
$nc += "CODEX_HOME = 'C:\Users\DEWK\.codex'$nl"
$nc += "NODE_REPL_TRUSTED_BROWSER_CLIENT_SHA256S = ""7abc8b22abade944bcd80135500416c7aee60c0e94290c7d644b54428a0013ab,7ed52dae165c3bc22b6d24f282e2c1fbc87f6949fbbe037767a7418d8f517f01""$nl"
$nc += "BROWSER_USE_AVAILABLE_BACKENDS = ""chrome,iab""$nl"
$nc += "NODE_REPL_INSTRUCTIONS_USE_CASE_BROWSER = ""Control the in-app browser in conjunction with the Browser Plugin.""$nl"
$nc += "NODE_REPL_INSTRUCTIONS_USE_CASE_CHROME = ""Control the Chrome browser in conjunction with the Chrome Plugin. Prefer this method of controlling Chrome over alternatives (such as Computer Use) unless the user explicitly mentions an alternative.""$nl"
$nc += "BROWSER_USE_CODEX_APP_BUILD_FLAVOR = ""prod""$nl"
$nc += "BROWSER_USE_CODEX_APP_VERSION = ""26.707.91948""$nl"
$nc += "SKY_CUA_NATIVE_PIPE = ""1""$nl"
$nc += "SKY_CUA_NATIVE_PIPE_DIRECTORY = '\\.\pipe\codex-computer-use-1d495a3c-6a27-4309-bd6a-ac79c6af57ad'$nl"
$nc += "CODEX_CLI_PATH = 'C:\Users\DEWK\AppData\Local\OpenAI\Codex\bin\494ae9d46ab9b3eb\codex.exe'$nl"
$nc += "$nl"
$nc += "[windows]$nl"
$nc += "sandbox = ""elevated""$nl"
$nc += "$nl"
$nc += "[desktop]$nl"
$nc += "conversationDetailMode = ""STEPS_PROSE""$nl"
$nc += "sansFontSize = 14$nl"
$nc += "codeFontSize = 13$nl"
$nc += "ambient-suggestions-enabled = false$nl"
$nc += "followUpQueueMode = ""queue""$nl"
$nc += "$nl"
$nc += "[marketplaces]$nl"
$nc += "[marketplaces.openai-curated]$nl"
$nc += "source_type = ""local""$nl"
$nc += "source = '\\\\?\\C:\\Users\\DEWK\\.codex\\.tmp\\plugins'$nl"
$nc += "[marketplaces.openai-api-curated]$nl"
$nc += "source_type = ""local""$nl"
$nc += "source = '\\\\?\\C:\\Users\\DEWK\\.codex\\.tmp\\plugins'$nl"
$nc += "[marketplaces.openai-curated-remote]$nl"
$nc += "source_type = ""local""$nl"
$nc += "source = '\\\\?\\C:\\Users\\DEWK\\.codex\\.tmp\\plugins-remote'$nl"
$nc += "[marketplaces.openai-bundled]$nl"
$nc += "last_updated = ""2026-07-17T02:01:51Z""$nl"
$nc += "source_type = ""local""$nl"
$nc += "source = '\\\\?\\C:\\Users\\DEWK\\.codex\\.tmp\\bundled-marketplaces\\openai-bundled'$nl"
$nc += "$nl"
$nc += "[plugins.""" + "computer-use@openai-bundled" + """]$nl"
$nc += "enabled = true$nl"
$nc += "[plugins.""" + "visualize@openai-bundled" + """]$nl"
$nc += "enabled = true$nl"
$nc += "[plugins.""" + "browser@openai-bundled" + """]$nl"
$nc += "enabled = true$nl"
$nc += "$nl"
$nc += "[features]$nl"
$nc += "js_repl = false$nl"

$nc | Set-Content -Path $configPath -Encoding utf8 -NoNewline
Write-Output "  config.toml -> base_url = http://127.0.0.1:57321/v1 (codex++)"
Write-Output "  所有关键设置已恢复"

# 第3步：杀死冲突代理
$cp = @(57322, 57324, 57330)
foreach ($p in $cp) {
    $c = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
    if ($c -and $c.Count -gt 0) {
        $pid = $c[0].OwningProcess
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Write-Output "  已杀死端口 $p 的代理进程 (PID $pid)"
    }
}
Write-Output "  冲突代理已清理"

# 第4步：确保 codex++ 正在运行
$cpp = "$env:LOCALAPPDATA\Programs\Codex++\codex-plus-plus.exe"
$run = Get-Process -Name "codex-plus-plus" -ErrorAction SilentlyContinue
if (-not $run) {
    if (Test-Path $cpp) {
        Start-Process -FilePath $cpp -ArgumentList "--debug-port 9229"
        Start-Sleep -Seconds 2
        Write-Output "  codex++ 已启动"
    } else {
        Write-Output "  未找到 codex++ 程序: $cpp"
    }
} else {
    Write-Output "  codex++ 已在运行"
}

Write-Output ""
Write-Output "============================================"
Write-Output "  恢复完成！请重启 Codex 桌面端生效"
Write-Output "  冲突端口 57322/57324/57330 已清理"
Write-Output "============================================"