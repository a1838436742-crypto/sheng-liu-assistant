// cost-diff.js — 与基线对比，看这次"猛操"花了多少
const audit = require("./audit-client.js");
const fs = require("fs"), path = require("path");
var baseline = JSON.parse(fs.readFileSync(path.join(__dirname, ".cost_baseline.json"), "utf-8"));
var records = audit.loadHistory();
var current = null;
records.forEach(function(r) {
  if (r.task_type !== "【平台快照】") return;
  var p = r.prompt_preview || "";
  var c = p.match(/消费¥([\d.]+)/), q = p.match(/请求([\d,]+)/), t = p.match(/Token([\d,]+)/);
  current = { 
    ts: r.timestamp, 
    cost: parseFloat((c ? c[1] : "0").replace(/,/g, "")), 
    req: parseFloat((q ? q[1] : "0").replace(/,/g, "")), 
    tok: parseFloat((t ? t[1] : "0").replace(/,/g, "")) 
  };
});
if (!current) { console.log("没有最新快照，先跑 full-audit.js"); process.exit(1); }
var delta = {
  cost: current.cost - baseline.cost,
  req: current.req - baseline.req,
  tok: current.tok - baseline.tok
};
console.log("╔══════════════════════════════════════╗");
console.log("║      本次操作消耗报告                ║");
console.log("╚══════════════════════════════════════╝");
console.log("基线: " + baseline.ts);
console.log("当前: " + current.ts);
console.log("");
console.log("  费用:     ¥" + delta.cost.toFixed(4));
console.log("  请求:     " + delta.req + " 次");
console.log("  Token:    " + delta.tok.toLocaleString());
console.log("  均次费用: ¥" + (delta.req > 0 ? (delta.cost / delta.req).toFixed(6) : "0"));
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
