// full-audit.js - 全量消费审计
// 自动登录 DeepSeek 平台抓累计数据 → 对比快照 → 输出报表

const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");
const audit = require("./audit-client.js");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8"));

async function main() {
  console.log("[full-audit] \u5f00\u59cb\u5168\u91cf\u5ba1\u8ba1...");
  
  var browser = await chromium.launch({ executablePath: CHROME, headless: true });
  var page = await browser.newPage();
  
  try {
    // \u767b\u5f55
    await page.goto("https://platform.deepseek.com/sign_in", { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);
    await page.locator("div.ds-sign-in-form__social-links .ds-button").first().click();
    await page.waitForTimeout(2000);
    var inputs = await page.locator("input").all();
    for (var inp of inputs) {
      if ((await inp.getAttribute("type")) !== "password") { await inp.fill(cfg.platform_email); break; }
    }
    await page.locator("input[type='password']").first().fill(cfg.platform_password);
    await page.locator("div.ds-button--filled").first().click();
    await page.waitForTimeout(5000);
    
    // \u83b7\u53d6\u7528\u91cf\u6570\u636e
    await page.goto("https://platform.deepseek.com/usage", { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(5000);
    
    var data = await page.evaluate(function() {
      var text = document.body.innerText;
      var result = { balance: "", totalCost: "", requests: "", tokens: "" };
      var lines = text.split("\n").filter(Boolean);
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i].trim();
        if (l.startsWith("\u00a5") && !result.balance) result.balance = l;
        if (l === "\u7d2f\u8ba1\u6d88\u8d39\u91d1\u989d" && i+1 < lines.length) result.totalCost = lines[i+1].trim();
        if (l === "API \u8bf7\u6c42\u6b21\u6570" && i+1 < lines.length) result.requests = lines[i+1].trim();
        if (l === "Tokens" && i+1 < lines.length) result.tokens = lines[i+1].trim();
      }
      return result;
    });
    
    console.log("[full-audit] \u8d26\u6237\u4f59\u989d: " + data.balance);
    console.log("[full-audit] \u7d2f\u8ba1\u6d88\u8d39: " + data.totalCost);
    console.log("[full-audit] \u8bf7\u6c42\u6b21\u6570: " + data.requests);
    console.log("[full-audit] Tokens: " + data.tokens);
    
    // \u4fdd\u5b58\u5feb\u7167
    audit.record({
      model: "deepseek-v4-flash",
      task_type: "\u3010\u5e73\u53f0\u5feb\u7167\u3011",
      input_tokens: parseInt(data.requests.replace(/,/g, "")) || 0,
      output_tokens: parseInt(data.tokens.replace(/,/g, "")) || 0,
      cost: parseFloat(data.totalCost.replace(/[\u00a5,]/g, "")) || 0,
      status: "snapshot",
      prompt_preview: "\u5e73\u53f0: \u6d88\u8d39" + data.totalCost + " \u8bf7\u6c42" + data.requests + " Token" + data.tokens,
      _origin: "system"
    });
    
  } finally {
    await browser.close();
  }
}

main().catch(function(e) { console.error(e); process.exit(1); });
