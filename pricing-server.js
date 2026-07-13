// pricing-server.js — 独立计价面板 + 统计服务
// 双击运行，自动打开浏览器显示实时数据
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const PORT = 57555;
const PROJ = __dirname;
const AUDIT_DIR = path.join(PROJ, "audit_logs");
const HTML_PATH = path.join(PROJ, "pricing-panel.html");

// ── 读取审计日志 ──
function loadAudit() {
  var records = [];
  if (!fs.existsSync(AUDIT_DIR)) return records;
  fs.readdirSync(AUDIT_DIR).filter(function(f) { return f.endsWith(".csv"); }).sort().forEach(function(f) {
    var lines = fs.readFileSync(path.join(AUDIT_DIR, f), "utf-8").trim().split("\n");
    if (lines.length < 2) return;
    var headers = lines[0].split(",");
    for (var i = 1; i < lines.length; i++) {
      var vals = lines[i].split(",");
      var r = {};
      headers.forEach(function(h, j) { r[h.trim()] = vals[j] ? vals[j].trim() : ""; });
      records.push(r);
    }
  });
  return records;
}

// ── 聚合统计 ──
function aggregateStats(records) {
  var total = { requests: 0, input: 0, output: 0, cached: 0, cost: 0, err: 0 };
  var byModel = {};
  var byType = {};
  var peak = 0;

  records.forEach(function(r) {
    if (r.task_type === "【平台快照】" || r.task_type === "【缓存预热】") return;
    total.requests++;
    var inp = parseInt(r.input_tokens) || 0;
    var out = parseInt(r.output_tokens) || 0;
    var cache = parseInt(r.cached_input) || 0;
    var cost = parseFloat(r.cost) || 0;
    total.input += inp;
    total.output += out;
    total.cached += cache;
    total.cost += cost;
    if (r.status !== "success" && r.status !== "warmup") total.err++;
    if (r.isPeak === "1") peak++;

    var model = r.model || "unknown";
    if (!byModel[model]) byModel[model] = { requests: 0, input: 0, output: 0, cached: 0, cost: 0 };
    byModel[model].requests++;
    byModel[model].input += inp;
    byModel[model].output += out;
    byModel[model].cached += cache;
    byModel[model].cost += cost;

    var type = r.task_type || "其他";
    if (!byType[type]) byType[type] = { requests: 0, cost: 0 };
    byType[type].requests++;
    byType[type].cost += cost;
  });

  return { total: total, byModel: byModel, byType: byType, peakCount: peak };
}

// ── 平台快照（从 DeepSeek 抓的） ──
function getPlatformSnapshot(records) {
  for (var i = records.length - 1; i >= 0; i--) {
    if (records[i].task_type === "【平台快照】") {
      var p = records[i].prompt_preview || "";
      var c = p.match(/消费¥([\d.]+)/);
      var q = p.match(/请求([\d,]+)/);
      var t = p.match(/Token([\d,]+)/);
      return {
        ts: records[i].timestamp,
        cost: c ? parseFloat(c[1]) : 0,
        requests: q ? parseFloat(q[1].replace(/,/g, "")) : 0,
        tokens: t ? parseFloat(t[1].replace(/,/g, "")) : 0,
      };
    }
  }
  return null;
}

// ── HTML 注入数据 ──
function buildHtml(html, stats, snapshot) {
  var script = "<script>\nvar STATS = " + JSON.stringify(stats) + ";\n";
  script += "var SNAPSHOT = " + JSON.stringify(snapshot) + ";\n";
  script += "</script>\n";
  script += "<script>\n";
  script += "function loadStats(){\n";
  script += "  var t = STATS.total;\n";
  script += "  document.getElementById('stats-total').textContent = '本地记录: ' + t.requests + ' ??, \\u00a5' + t.cost.toFixed(4);\n";
  script += "  document.getElementById('stats-input').textContent = t.input.toLocaleString();\n";
  script += "  document.getElementById('stats-output').textContent = t.output.toLocaleString();\n";
  script += "  document.getElementById('stats-cached').textContent = t.cached.toLocaleString();\n";
  script += "  document.getElementById('stats-cost').textContent = '\\u00a5' + t.cost.toFixed(4);\n";
  script += "  if(SNAPSHOT){\n";
  script += "    document.getElementById('platform-cost').textContent = '\\u00a5' + SNAPSHOT.cost.toFixed(2);\n";
  script += "    document.getElementById('platform-req').textContent = SNAPSHOT.requests;\n";
  script += "    document.getElementById('platform-tok').textContent = SNAPSHOT.tokens.toLocaleString();\n";
  script += "    document.getElementById('platform-ts').textContent = SNAPSHOT.ts;\n";
  script += "  }\n";
  script += "}\n";
  script += "window.addEventListener('DOMContentLoaded', loadStats);\n";
  script += "</script>\n";
  return html.replace("</body>", script + "</body>");
}

// ── 启动 HTTP 服务 ──
var html = fs.readFileSync(HTML_PATH, "utf-8");
var records = loadAudit();
var stats = aggregateStats(records);
var snapshot = getPlatformSnapshot(records);
var finalHtml = buildHtml(html, stats, snapshot);

var server = http.createServer(function(req, res) {
    if (req.url === "/shengliu-pricing.user.js") {
    var scriptPath = "C:/Users/DEWK/.codex/skills/token-saver/shengliu-pricing.user.js";
    if (fs.existsSync(scriptPath)) {
      var script = fs.readFileSync(scriptPath, "utf-8");
      res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8", "Access-Control-Allow-Origin": "*" });
      res.end(script);
    } else {
      res.writeHead(404);
      res.end("not found");
    }
    return;
  }
if (req.url === "/api/stats") {
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ stats: stats, snapshot: snapshot }));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(finalHtml);
});

server.listen(PORT, function() {
  console.log("====================================");
  console.log("  ?? ??v3.0 ???");
  console.log("  http://127.0.0.1:" + PORT);
  console.log("====================================");
  console.log("  ??:" + (records.length - 1) + " ??");
  console.log("  ??: \\u00a5" + stats.total.cost.toFixed(4));
  console.log("====================================");
  // Auto open browser
  try {
    execSync("start http://127.0.0.1:" + PORT, { windowsHide: true });
  } catch(e) {}
});
