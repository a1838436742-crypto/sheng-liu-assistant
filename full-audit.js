const { chromium } = require("./test_pkg/node_modules/playwright-core");
const fs = require("fs");
const path = require("path");
const audit = require("./audit-client.js");
var cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8"));
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
function log(m) { process.stdout.write(m + "\n"); }
function cleanNum(s) { return parseFloat((s || "").replace(/[,¥]/g, "")) || 0; }

function getLastSnapshot() {
  var records = audit.loadHistory(), last = null;
  records.forEach(function(r) {
    if (r.task_type !== "【平台快照】") return;
    var p = r.prompt_preview || "";
    var c = p.match(/消费¥([\d.]+)/), q = p.match(/请求([\d,]+)/), t = p.match(/Token([\d,]+)/);
    last = { ts: r.timestamp, cost: cleanNum(c?c[1]:"0"), req: cleanNum(q?q[1]:"0"), tok: cleanNum(t?t[1]:"0") };
  });
  return last;
}

function getLocalDetail() {
  var records = audit.loadHistory();
  var warm = { c:0, cost:0, inp:0, out:0 };
  var system = { c:0, cost:0, inp:0, out:0, grp:{} };
  var real = { c:0, cost:0, inp:0, out:0, grp:{} };
  records.forEach(function(r) {
    var tp = r.task_type || "未知";
    var cost = parseFloat(r.cost||0);
    var inp = parseInt(r.input_tokens||0);
    var out = parseInt(r.output_tokens||0);
    if (r.task_type === "【缓存预热】") {
      warm.c++; warm.cost += cost; warm.inp += inp; warm.out += out;
      return;
    }
    if (r.task_type === "【平台快照】") return;
    // 系统测试特征：_origin=system 或 旧格式（note=0 且 prompt_preview=0.00）
    var isSysTest = r._origin === "system" || (r.note === "0" && (r.prompt_preview || "").trim() === "0.00");
    var bucket = isSysTest ? system : real;
    bucket.c++; bucket.cost += cost; bucket.inp += inp; bucket.out += out;
    if (!bucket.grp[tp]) bucket.grp[tp] = { c:0, cost:0, inp:0, out:0 };
    bucket.grp[tp].c++; bucket.grp[tp].cost += cost;
    bucket.grp[tp].inp += inp; bucket.grp[tp].out += out;
  });
  return { warm: warm, system: system, real: real };
}

async function main() {
  var last = getLastSnapshot();
  log("启动 Chrome...");
  var browser = await chromium.launch({ executablePath: CHROME, headless: false, args: ["--start-maximized"] });
  var ctx = await browser.newContext();
  var page = await ctx.newPage();

  await page.goto("https://platform.deepseek.com/sign_in", { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(2000);
  await page.locator("div.ds-sign-in-form__social-links .ds-button").first().click();
  await page.waitForTimeout(3000);
  var inputs = await page.locator("input").all();
  for (var inp of inputs) {
    var typ = await inp.getAttribute("type");
    if (typ !== "password") { await inp.fill(cfg.platform_email); break; }
  }
  await page.waitForTimeout(500);
  await page.locator("input[type=password]").first().fill(cfg.platform_password);
  await page.waitForTimeout(500);
  await page.locator("div.ds-button--filled").first().click();
  for (var i = 0; i < 60; i++) { await page.waitForTimeout(1000); if (!page.url().includes("sign_in")) break; }

  await page.goto("https://platform.deepseek.com/usage", { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(5000);
  var lines = (await page.evaluate(function() { return document.body.innerText; })).split("\n");
    await browser.close();

  var p = { cost:"", req:"", tok:"", bal:"" };
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i].trim();
    if (l.startsWith("¥") && !p.bal) p.bal = l;
    if (l === "累计消费金额" && i+1 < lines.length) p.cost = lines[i+1].trim();
    if (l === "API 请求次数" && i+1 < lines.length) p.req = lines[i+1].trim();
    if (l === "Tokens" && i+1 < lines.length) p.tok = lines[i+1].trim();
  }

  var curCost = cleanNum(p.cost), curReq = cleanNum(p.req), curTok = cleanNum(p.tok);

  audit.record({
    model: "deepseek-v4-flash", task_type: "【平台快照】",
    input_tokens: curReq, output_tokens: curTok,
    cache_probability: 0, prefix_tokens: 0, duration_ms: 0, status: "snapshot", cost: 0,
    prompt_preview: "平台: 消费¥" + curCost + " 请求" + curReq + " Token" + curTok,
    note: "auto-sync"
  });

  log("\n═══════════════════════════════════");
  log("  DeepSeek 费用报告");
  log("═══════════════════════════════════");
  log("  余额: " + (p.bal || "N/A"));
  log("  累计: ¥" + curCost.toFixed(2) + " | " + curReq + "次 | " + curTok.toLocaleString() + " tokens");
  if (last) {
    var dCost = (curCost - last.cost).toFixed(4), dReq = curReq - last.req, dTok = curTok - last.tok;
    log("    此阶段: ¥" + dCost + " | " + dReq + "次 | " + dTok.toLocaleString() + " tokens");
  }

  var local = getLocalDetail();
  var fmtGroup = function(grp) {
    Object.entries(grp).sort(function(a,b){ return b[1].cost - a[1].cost; }).forEach(function(kv) {
      var g = kv[1];
      log("  " + (kv[0]+"          ").slice(0,12) + "\t" + g.c + "次\t¥" + g.cost.toFixed(4) + "\t" + g.inp + " in\t" + g.out + " out");
    });
  };
  var s = local.system, r = local.real, w = local.warm;

  log("\n  本地明细:");
  if (w.c > 0) log("  缓存预热: " + w.c + "次, ¥" + w.cost.toFixed(4));
  if (s.c > 0) {
    log("  系统测试（非你的任务）:");
    fmtGroup(s.grp);
    log("    小计\t\t" + s.c + "次\t¥" + s.cost.toFixed(4));
  }
  if (r.c > 0) {
    log("  实际任务:");
    fmtGroup(r.grp);
    log("    合计\t\t" + r.c + "次\t¥" + r.cost.toFixed(4) + "\t" + r.inp + " in\t" + r.out + " out");
  } else if (w.c === 0 && s.c === 0) {
    log("  （无本地记录）");
  }
  log("═══════════════════════════════════");
}
main().catch(function(e) { log("错误: " + e.message); process.exit(1); });





