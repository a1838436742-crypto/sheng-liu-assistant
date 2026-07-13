// ============================================================
// 🕵️ Token 审计客户端 v2.0 - 缓存命中可视化版
// 用法:
//   const audit = require('./audit-client.js');
//   audit.record({ model, task_type, input_tokens, output_tokens, ... });
//   audit.printReport(7);    // 近7天报表
//   audit.htmlReport(7);     // 生成 HTML 报告
// ============================================================
const fs = require("fs");
const path = require("path");

// ── DeepSeek 定价 (¥/1M tokens, 2026.07) ──
const PRICING = {
  "deepseek-chat":         { input: 0.14, output: 0.28, cache_hit: 0.035 },
  "deepseek-reasoner":     { input: 0.55, output: 2.19, cache_hit: 0.14 },
  "deepseek-v4":           { input: 0.50, output: 1.50, cache_hit: 0.125 },
  "deepseek-v4-flash":     { input: 0.20, output: 0.60, cache_hit: 0.05 },
};
const DEFAULT_PRICING = { input: 0.20, output: 0.60, cache_hit: 0.05 };
const PEAK_HOURS = new Set([9, 10, 11, 12, 14, 15, 16, 17, 18]);
const LOG_DIR = path.join(__dirname, "audit_logs");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// ── 基础字段定义 ──
const BASE_FIELDS = [
  "timestamp", "hour", "isPeak", "model", "task_type",
  "input_tokens", "output_tokens", "cached_input", "total_tokens",
  "cost", "duration_ms", "status", "prompt_preview",
  "note", "peak_cost", "offpeak_cost", "_cost_peak", "_cost_offpeak", "_version", "_origin"];

// ── 记录一次 API 调用 ──
function record(req) {
  const now = new Date();
  const model = req.model || "deepseek-v4-flash";
  const p = PRICING[model] || DEFAULT_PRICING;
  const hour = now.getHours();
  const isPeak = PEAK_HOURS.has(hour);

  const inp = req.input_tokens || 0;
  const out = req.output_tokens || 0;
  const cacheProb = req.cache_probability ?? 0;
  const prefixT = req.prefix_tokens ?? 0;

  // 缓存命中部分的 tokens = min(prefix_tokens, input_tokens) * cache_probability
  const cachedInput = Math.min(prefixT, inp) * cacheProb;
  const cost = ((inp - cachedInput) * p.input + cachedInput * p.cache_hit + out * p.output) / 1_000_000;

  const entry = {
    timestamp: new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().replace("T", " ").slice(0, 19),
    hour: String(hour),
    isPeak: isPeak ? "1" : "0",
    model,
    task_type: req.task_type || "其他",
    input_tokens: inp,
    output_tokens: out,
    cached_input: Math.round(cachedInput),
    total_tokens: inp + out,
    cost: +cost.toFixed(6),
    cache_probability: cacheProb.toFixed(2),
    prefix_tokens: prefixT,
    duration_ms: req.duration_ms || 0,
    status: req.status || "success",
    prompt_preview: (req.prompt_preview || "").slice(0, 80),
    note: req.note || "",
    _origin: req._origin || "user",
  
    peak_cost: "0",
    offpeak_cost: "0",
    _cost_peak: "0",
    _cost_offpeak: "0",
    _version: "3",};

  // 追加到当月 CSV
  const csvPath = path.join(LOG_DIR, `audit_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}.csv`);
  const isNew = !fs.existsSync(csvPath);
  const line = BASE_FIELDS.map(h => {
    const v = entry[h];
    return typeof v === "string" && (v.includes(",") || v.includes("\n")) ? `"${v}"` : v;
  }).join(",");

  fs.appendFileSync(csvPath, (isNew ? BASE_FIELDS.join(",") + "\n" : "") + line + "\n", "utf-8");
  return entry;
}

// ── 从 CSV 加载历史 ──
function loadHistory() {
  const records = [];
  if (!fs.existsSync(LOG_DIR)) return records;
  fs.readdirSync(LOG_DIR)
    .filter(f => f.startsWith("audit_") && f.endsWith(".csv"))
    .sort()
    .forEach(f => {
      const lines = fs.readFileSync(path.join(LOG_DIR, f), "utf-8").trim().split("\n");
      if (lines.length < 2) return;
      const headers = lines[0].split(",");
      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(",");
        const r = {};
        headers.forEach((h, j) => { r[h.trim()] = vals[j]?.trim(); });
        records.push(r);
      }
    });
  return records;
}

// ── 控制台报表 ──
function printReport(days) {
  let records = loadHistory();
  if (!records.length) { console.log("❌ 无数据"); return; }

  if (days) {
    const cutoff = Date.now() - days * 86400000;
    records = records.filter(r => new Date(r.timestamp).getTime() >= cutoff);
  }
  if (!records.length) { console.log("❌ 周期内无数据"); return; }

  const totalCost = records.reduce((s, r) => s + +r.cost, 0);
  const totalInp = records.reduce((s, r) => s + +r.input_tokens, 0);
  const totalOut = records.reduce((s, r) => s + +r.output_tokens, 0);
  const totalCached = records.reduce((s, r) => s + +(r.cached_input || 0), 0);
  const peakCount = records.filter(r => r.isPeak == "1").length;
  const errCount = records.filter(r => r.status !== "success" && r.status !== "warmup").length;

  // 按任务类型统计
  const byType = {};
  records.forEach(r => {
    const t = r.task_type || "其他";
    if (!byType[t]) byType[t] = { count: 0, cost: 0, inp: 0, out: 0, cached: 0 };
    byType[t].count++;
    byType[t].cost += +r.cost;
    byType[t].inp += +r.input_tokens;
    byType[t].out += +r.output_tokens;
    byType[t].cached += +(r.cached_input || 0);
  });

  // 平均缓存命中率
  const avgCacheProb = records
    .filter(r => r.cache_probability)
    .reduce((s, r, _, a) => s + +r.cache_probability / a.length, 0);

  const cacheSaveRate = totalInp > 0 ? (totalCached / totalInp * 100) : 0;

  console.log(`\n${"=".repeat(62)}`);
  console.log(`  🕵️ Token 审计报告 (${days ? `近 ${days} 天` : "全部"})`);
  console.log(`${"=".repeat(62)}`);

  // 费用摘要
  const avgCost = records.length > 0 ? (totalCost / records.length) : 0;
  console.log(`\n  💰 费用`);
  console.log(`  ${"总消费:".padEnd(16)} ¥${totalCost.toFixed(4)}`);
  console.log(`  ${"均次消费:".padEnd(16)} ¥${avgCost.toFixed(6)}`);
  console.log(`  ${"请求总数:".padEnd(16)} ${records.length} 次`);
  console.log(`  ${"错误/失败:".padEnd(16)} ${errCount} 次`);

  // Token 统计
  console.log(`\n  📊 Token 量`);
  console.log(`  ${"输入 Tokens:".padEnd(16)} ${totalInp.toLocaleString().padStart(12)}`);
  console.log(`  ${"缓存命中:".padEnd(16)} ${totalCached.toLocaleString().padStart(12)} (${cacheSaveRate.toFixed(1)}%)`);
  console.log(`  ${"输出 Tokens:".padEnd(16)} ${totalOut.toLocaleString().padStart(12)}`);
  console.log(`  ${"总 Tokens:".padEnd(16)} ${(totalInp+totalOut).toLocaleString().padStart(12)}`);

  // 缓存信息
  console.log(`\n  🎯 缓存`);
  console.log(`  ${"平均缓存概率:".padEnd(16)} ${(avgCacheProb * 100).toFixed(1)}%`);
  console.log(`  ${"节省输入 Token:".padEnd(16)} ${(cacheSaveRate).toFixed(1)}%`);

  // 高峰/低谷
  console.log(`\n  ⏰ 时段`);
  console.log(`  ${"高峰占比:".padEnd(16)} ${peakCount} 次 (${(peakCount / records.length * 100).toFixed(1)}%)`);
  console.log(`  ${"低谷占比:".padEnd(16)} ${records.length - peakCount} 次 (${((records.length - peakCount) / records.length * 100).toFixed(1)}%)`);

  // 按任务类型
  console.log(`\n  📋 按任务类型`);
  for (const [type, stats] of Object.entries(byType).sort((a, b) => b[1].cost - a[1].cost)) {
    const cachePct = stats.inp > 0 ? (stats.cached / stats.inp * 100) : 0;
    console.log(`  ${type.padEnd(12)} ${String(stats.count).padStart(4)}次 ¥${stats.cost.toFixed(4)} 缓存${cachePct.toFixed(1)}%`);
  }

  console.log(`${"=".repeat(62)}\n`);
}

// ── HTML 报告生成 ──
function htmlReport(days) {
  let records = loadHistory();
  if (!records.length) { console.log("❌ 无数据"); return; }

  if (days) {
    const cutoff = Date.now() - days * 86400000;
    records = records.filter(r => new Date(r.timestamp).getTime() >= cutoff);
  }
  if (!records.length) { console.log("❌ 周期内无数据"); return; }

  // 计算汇总
  const totalCost = records.reduce((s, r) => s + +r.cost, 0);
  const totalInp = records.reduce((s, r) => s + +r.input_tokens, 0);
  const totalOut = records.reduce((s, r) => s + +r.output_tokens, 0);
  const totalCached = records.reduce((s, r) => s + +(r.cached_input || 0), 0);
  const peakCount = records.filter(r => r.isPeak == "1").length;

  // 按天统计（用于趋势图）
  const dailyStats = {};
  records.forEach(r => {
    const day = r.timestamp.slice(0, 10);
    if (!dailyStats[day]) dailyStats[day] = { count: 0, cost: 0, inp: 0, out: 0, cached: 0 };
    dailyStats[day].count++;
    dailyStats[day].cost += +r.cost;
    dailyStats[day].inp += +r.input_tokens;
    dailyStats[day].out += +r.output_tokens;
    dailyStats[day].cached += +(r.cached_input || 0);
  });
  const daysSorted = Object.keys(dailyStats).sort();

  // 按任务类型
  const byType = {};
  records.forEach(r => {
    const t = r.task_type || "其他";
    if (!byType[t]) byType[t] = { count: 0, cost: 0, inp: 0 };
    byType[t].count++;
    byType[t].cost += +r.cost;
    byType[t].inp += +r.input_tokens;
  });

  const tableRows = records.slice(-200).reverse().map((r, i) => {
    const cacheClass = +r.cache_probability >= 0.7 ? "high" : (+r.cache_probability >= 0.4 ? "mid" : "low");
    return `<tr>
      <td>${r.timestamp || ""}</td>
      <td class="${cacheClass}">${r.cache_probability ? (+r.cache_probability * 100).toFixed(0) + "%" : "-"}</td>
      <td>${r.task_type || ""}</td>
      <td>${(+r.input_tokens || 0).toLocaleString()}</td>
      <td>${(+r.output_tokens || 0).toLocaleString()}</td>
      <td>${(+r.cached_input || 0).toLocaleString()}</td>
      <td>¥${(+r.cost || 0).toFixed(6)}</td>
      <td>${r.isPeak == "1" ? "🔴" : "🟢"}</td>
      <td title="${(r.note || "").replace(/"/g, "&quot;")}">${(r.prompt_preview || "").slice(0, 40)}</td>
    </tr>`;
  }).join("\n");

  // 趋势图：每天的缓存率
  const trendLabels = JSON.stringify(daysSorted);
  const trendCacheRates = JSON.stringify(daysSorted.map(d => {
    const s = dailyStats[d];
    return s.inp > 0 ? (s.cached / s.inp * 100).toFixed(1) : 0;
  }));
  const trendCosts = JSON.stringify(daysSorted.map(d => +dailyStats[d].cost.toFixed(4)));
  const trendCounts = JSON.stringify(daysSorted.map(d => dailyStats[d].count));
  // ???????Node.js ???????? records ????
  const binsForChart = [0,0.2,0.4,0.6,0.8,1].map((bin, i, arr) => {
    const allProbs = records.map(r => +r.cache_probability).filter(p => p > 0).length > 0 
      ? records.map(r => +r.cache_probability).filter(p => p > 0) 
      : [0];
    const probs = records.map(r => +r.cache_probability).filter(p => p > 0);
    if (i === arr.length - 1) return probs.filter(p => p >= bin && p <= bin).length;
    return probs.filter(p => p >= bin && p < arr[i+1]).length;
  });
  const binsData = JSON.stringify(binsForChart);


  // 饼图数据
  const typeLabels = JSON.stringify(Object.keys(byType));
  const typeCosts = JSON.stringify(Object.values(byType).map(v => +v.cost.toFixed(4)));

  const avgCacheProb = records
    .filter(r => r.cache_probability)
    .reduce((s, r, _, a) => s + +r.cache_probability / a.length, 0);

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DeepSeek API 审计报告</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', sans-serif; background: #0f1729; color: #e2e8f0; padding: 24px; }
  h1 { font-size: 24px; margin-bottom: 8px; }
  .subtitle { color: #94a3b8; margin-bottom: 24px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .card { background: #1a2332; border-radius: 12px; padding: 16px; border: 1px solid #2d3a4e; }
  .card .label { font-size: 12px; color: #94a3b8; }
  .card .value { font-size: 28px; font-weight: 700; margin-top: 4px; }
  .card .value.green { color: #4ade80; }
  .card .value.orange { color: #fb923c; }
  .card .value.blue { color: #60a5fa; }
  .card .value.purple { color: #a78bfa; }
  .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
  .chart-box { height: 260px; background: #1a2332; border-radius: 12px; padding: 16px; border: 1px solid #2d3a4e; }
  .chart-box.full { grid-column: 1 / -1; }
  .chart-box h3 { font-size: 14px; color: #94a3b8; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; padding: 8px 6px; color: #64748b; border-bottom: 1px solid #2d3a4e; font-weight: 500; }
  td { padding: 6px; border-bottom: 1px solid #1e293b; }
  tr:hover { background: #1e293b; }
  .high { color: #4ade80; font-weight: 600; }
  .mid { color: #fb923c; }
  .low { color: #ef4444; }
  .scroll { max-height: 500px; overflow-y: auto; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; background: #2d3a4e; }
  .suggestion { background: #1a2332; border-radius: 12px; padding: 16px; border: 1px solid #2d3a4e; margin-bottom: 24px; }
  .suggestion h3 { color: #60a5fa; margin-bottom: 8px; }
  .suggestion ul { list-style: none; }
  .suggestion li { padding: 4px 0; color: #94a3b8; font-size: 13px; }
  .suggestion li::before { content: "→ "; color: #60a5fa; }
</style>
</head>
<body>
<h1>🕵️ DeepSeek API 审计报告</h1>
<p class="subtitle">${days ? "近 " + days + " 天" : "全部"} · ${records.length} 次请求 · 报告生成: ${new Date().toLocaleString("zh-CN")}</p>

<div class="cards">
  <div class="card">
    <div class="label">总消费</div>
    <div class="value orange">¥${totalCost.toFixed(4)}</div>
  </div>
  <div class="card">
    <div class="label">请求总数</div>
    <div class="value blue">${records.length}</div>
  </div>
  <div class="card">
    <div class="label">平均缓存命中率</div>
    <div class="value green">${(avgCacheProb * 100).toFixed(1)}%</div>
  </div>
  <div class="card">
    <div class="label">输入 Tokens</div>
    <div class="value purple">${(totalInp / 10000).toFixed(1)}万</div>
  </div>
  <div class="card">
    <div class="label">输出 Tokens</div>
    <div class="value purple">${(totalOut / 10000).toFixed(1)}万</div>
  </div>
  <div class="card">
    <div class="label">缓存命中 Tokens</div>
    <div class="value ${totalCached / totalInp > 0.5 ? 'green' : 'orange'}">${(totalCached / 10000).toFixed(1)}万 (${totalInp > 0 ? (totalCached / totalInp * 100).toFixed(1) : 0}%)</div>
  </div>
</div>

<div class="chart-grid">
  <div class="chart-box">
    <h3>📈 每日请求数 & 缓存率趋势</h3>
    <canvas id="trendChart" style="max-height:220px"></canvas>
  </div>
  <div class="chart-box">
    <h3>💰 每日费用趋势</h3>
    <canvas id="costChart" style="max-height:220px"></canvas>
  </div>
  <div class="chart-box">
    <h3>🧩 费用分布 (按任务类型)</h3>
    <canvas id="pieChart" style="max-height:220px"></canvas>
  </div>
  <div class="chart-box">
    <h3>📊 缓存命中概率分布</h3>
    <canvas id="cacheDistChart" style="max-height:220px"></canvas>
  </div>
</div>

<div class="suggestion">
  <h3>💡 优化建议</h3>
  <ul>
    <li>${totalInp > 0 && (totalCached / totalInp) >= 0.4 ? "缓存命中率" + (totalCached / totalInp * 100).toFixed(1) + "%，保持统一前缀策略即可" : "缓存命中率" + (totalCached / totalInp * 100).toFixed(1) + "%，建议检查前缀一致性"}</li>
    <li>${peakCount > records.length * 0.4 ? "高峰时段请求占比过高，建议将批量任务调度到 18:00-次日09:00" : "高峰时段控制良好"}</li>
    <li>${totalOut > totalInp * 0.3 ? "输出 Token 占比偏高，检查是否设置了合理的 max_tokens" : "输出/输入比例合理"}</li>
    <li>${totalCost > 5 ? "月消费已达 ¥" + totalCost.toFixed(2) + "，考虑缓存预热保持前缀缓存活跃" : "当前消费可控"}</li>
  </ul>
</div>

<h3 style="margin-bottom: 8px;">📋 最近请求明细 (最多200条)</h3>
<div class="scroll">
<table>
<thead>
  <tr>
    <th>时间</th>
    <th>缓存概率</th>
    <th>类型</th>
    <th>输入T</th>
    <th>输出T</th>
    <th>缓存T</th>
    <th>费用</th>
    <th>时段</th>
    <th>预览</th>
  </tr>
</thead>
<tbody>
${tableRows}
</tbody>
</table>
</div>

<script>
new Chart(document.getElementById("trendChart"), {
  type: "bar",
  data: {
    labels: ${trendLabels},
    datasets: [
      { label: "请求数", data: ${trendCounts}, backgroundColor: "#3b82f6", borderColor: "#60a5fa", borderWidth: 1, borderRadius: 4, yAxisID: "y" },
      { label: "缓存率%", data: ${trendCacheRates}, type: "line", borderColor: "#4ade80", backgroundColor: "rgba(74,222,128,0.1)", fill: true, tension: 0.3, yAxisID: "y1", pointRadius: 4 }
    ]
  },
  options: {
    responsive: true, maintainAspectRatio: true,
    scales: {
      y: { beginAtZero: true, grid: { color: "rgba(148,163,184,0.1)" }, ticks: { color: "#94a3b8" } },
      y1: { beginAtZero: true, max: 100, position: "right", grid: { display: false }, ticks: { color: "#4ade80", callback: v => v + "%" } },
      x: { grid: { display: false }, ticks: { color: "#94a3b8" } }
    },
    plugins: { legend: { labels: { color: "#94a3b8" } } }
  }
});

new Chart(document.getElementById("costChart"), {
  type: "line",
  data: {
    labels: ${trendLabels},
    datasets: [{ label: "费用 (¥)", data: ${trendCosts}, borderColor: "#fb923c", backgroundColor: "rgba(251,146,60,0.1)", fill: true, tension: 0.3, pointRadius: 4 }]
  },
  options: {
    responsive: true, maintainAspectRatio: true,
    scales: {
      y: { beginAtZero: true, grid: { color: "rgba(148,163,184,0.1)" }, ticks: { color: "#94a3b8" } },
      x: { grid: { display: false }, ticks: { color: "#94a3b8" } }
    },
    plugins: { legend: { labels: { color: "#94a3b8" } } }
  }
});

new Chart(document.getElementById("pieChart"), {
  type: "doughnut",
  data: {
    labels: ${typeLabels},
    datasets: [{ data: ${typeCosts}, backgroundColor: ["#3b82f6","#4ade80","#fb923c","#a78bfa","#f472b6","#facc15"] }]
  },
  options: {
    responsive: true, maintainAspectRatio: true,
    plugins: { legend: { position: "bottom", labels: { color: "#94a3b8", padding: 12 } } }
  }
});

// 缓存命中概率分布
const bins = ${binsData};
new Chart(document.getElementById("cacheDistChart"), {
  type: "bar",
  data: {
    labels: ["0-20%", "20-40%", "40-60%", "60-80%", "80-100%"],
    datasets: [{ label: "请求数", data: bins, backgroundColor: bins.map((_,i) => ["#ef4444","#fb923c","#facc15","#4ade80","#22c55e"][i]), borderRadius: 4 }]
  },
  options: {
    responsive: true, maintainAspectRatio: true,
    scales: {
      y: { beginAtZero: true, grid: { color: "rgba(148,163,184,0.1)" }, ticks: { color: "#94a3b8" } },
      x: { grid: { display: false }, ticks: { color: "#94a3b8" } }
    },
    plugins: { legend: { display: false } }
  }
});
</script>
</body>
</html>`;

  const outPath = path.join(LOG_DIR, `audit_report_${new Date().toISOString().slice(0,10).replace(/-/g,"")}_${String(Date.now()).slice(-6)}.html`);
  fs.writeFileSync(outPath, html, "utf-8");
  console.log("[审计] ✅ HTML 报告已生成: " + outPath);
  return outPath;
}

// ── 导出 ──
module.exports = { record, loadHistory, printReport, htmlReport, LOG_DIR, PRICING };

// 直接运行: node audit-client.js --report 7
//          node audit-client.js --html 7
if (require.main === module) {
  const args = process.argv.slice(2);
  const days = parseInt(args[1] || "7", 10);

  if (args[0] === "--html") {
    const p = htmlReport(days);
    console.log("  打开: " + p);
  } else {
    printReport(days);
  }
}

