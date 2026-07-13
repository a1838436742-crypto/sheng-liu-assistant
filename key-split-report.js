// ============================================================
// API Key 费用拆分报告
// 读取已有 deepseek_export 数据，输出按 Key 拆分的费用详情
// ============================================================
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

var dataDir = path.join(__dirname, "deepseek_export");
var zipPath = path.join(__dirname, ".deepseek_export.zip");
var extractDir = path.join(__dirname, ".deepseek_export_tmp");

function log(m) { process.stdout.write(m + "\n"); }

function parseExport() {
  // 先看已有解压目录
  if (fs.existsSync(dataDir)) {
    var files = fs.readdirSync(dataDir).filter(function(f){ return f.startsWith("amount-"); });
    if (files.length > 0) return parseAmountCsv(path.join(dataDir, files[0]));
  }
  // 再看是否有 ZIP
  if (!fs.existsSync(zipPath)) {
    log("  无导出数据。请先运行 full-audit.js");
    log("  或把 DeepSeek 平台导出的 ZIP 放到: " + zipPath);
    return null;
  }
  // 解压
  try {
    if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
    fs.mkdirSync(extractDir, { recursive: true });
    cp.execFileSync("powershell", ["-NoProfile", "-Command", "Expand-Archive -Path '" + zipPath + "' -DestinationPath '" + extractDir + "' -Force"], { windowsHide: true, timeout: 10000 });
    var files2 = fs.readdirSync(extractDir).filter(function(f){ return f.startsWith("amount-"); });
    if (files2.length > 0) return parseAmountCsv(path.join(extractDir, files2[0]));
  } catch(e) {
    log("  解压失败: " + e.message);
  }
  return null;
}

function parseAmountCsv(csvPath) {
  var lines = fs.readFileSync(csvPath, "utf-8").trim().split("\n");
  var keyData = {};
  lines.forEach(function(l){
    var p = l.split(",");
    if (p.length < 8 || p[0] === "user_id") return;
    var keyName = (p[3] || "").trim();
    var keyMasked = (p[4] || "").trim();
    var type = (p[5] || "").trim();
    var amount = parseFloat(p[7]) || 0;
    if (!keyData[keyName]) keyData[keyName] = { masked: keyMasked, req: 0, cacheHit: 0, cacheMiss: 0, output: 0 };
    if (type === "request_count") keyData[keyName].req += amount;
    else if (type === "input_cache_hit_tokens") keyData[keyName].cacheHit += amount;
    else if (type === "input_cache_miss_tokens") keyData[keyName].cacheMiss += amount;
    else if (type === "output_tokens") keyData[keyName].output += amount;
  });
  return keyData;
}

function printReport(keyData) {
  log("\n╔══════════════════════════════════════════════╗");
  log("║   DeepSeek API Key 费用拆分                ║");
  log("╚══════════════════════════════════════════════╝");
  log("");

  var grandTotal = { req: 0, cost: 0, in: 0, out: 0 };
  var idx = 0;
  Object.entries(keyData).forEach(function(kv){
    var k = kv[0], d = kv[1];
    idx++;
    var totalIn = d.cacheHit + d.cacheMiss;
    var cacheRate = totalIn > 0 ? (d.cacheHit / totalIn * 100).toFixed(1) : "0.0";
    var inputCost = d.cacheMiss * 0.000001 + d.cacheHit * 0.00000002;
    var outputCost = d.output * 0.000002;
    var totalCost = inputCost + outputCost;
    var label = k === "open ai" ? "  🔵 Codex 对话 (旧Key)" : "  🟢 api-client.js (新Key)";

    log(label);
    log("  ─────────────────────────────────────────");
    log("    请求数:     " + d.req + " 次");
    log("    输入Token:  " + totalIn.toLocaleString() + " (缓存命中 " + cacheRate + "%)");
    log("      缓存命中: " + d.cacheHit.toLocaleString() + " × ¥0.00000002");
    log("      缓存未中: " + d.cacheMiss.toLocaleString() + " × ¥0.000001");
    log("    输出Token:  " + d.output.toLocaleString() + " × ¥0.000002");
    log("    费用明细:");
    log("      输入缓存命中: ¥" + (d.cacheHit * 0.00000002).toFixed(4));
    log("      输入缓存未中: ¥" + (d.cacheMiss * 0.000001).toFixed(4));
    log("      输出:        ¥" + (d.output * 0.000002).toFixed(4));
    log("    ───────────────────────────────────");
    log("    总费用:     ¥" + totalCost.toFixed(4));
    log("");

    grandTotal.req += d.req;
    grandTotal.cost += totalCost;
    grandTotal.in += totalIn;
    grandTotal.out += d.output;
  });

  log("  ── 汇总 ──");
  log("    总请求: " + grandTotal.req + " 次");
  log("    总输入: " + grandTotal.in.toLocaleString() + " tokens");
  log("    总输出: " + grandTotal.out.toLocaleString() + " tokens");
  log("    总费用: ¥" + grandTotal.cost.toFixed(4));
  log("");
}

var data = parseExport();
if (data) {
  printReport(data);
} else {
  log("\n请先导出 DeepSeek 用量数据:");
  log("  1. 打开 https://platform.deepseek.com/usage");
  log("  2. 点击「导出」下载 ZIP");
  log("  3. 放到 " + zipPath);
  log("  4. 重新运行: node key-split-report.js");
  log("");
}
