// DeepSeek \u5e73\u53f0\u7528\u91cf\u6570\u636e\u722c\u53d6\nconst { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8"));

async function fetchUsage(options) {
  options = options || {};
  var browser = await chromium.launch({ executablePath: CHROME, headless: !options.visible });
  var page = await browser.newPage();
  
  try {
    await page.goto("https://platform.deepseek.com/sign_in", { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(2000);
    await page.locator("div.ds-sign-in-form__social-links .ds-button").first().click();
    await page.waitForTimeout(2000);
    var inputs = await page.locator("input").all();
    for (var inp of inputs) {
      if ((await inp.getAttribute("type")) !== "password") { await inp.fill(CONFIG.platform_email); break; }
    }
    await page.locator("input[type='password']").first().fill(CONFIG.platform_password);
    await page.locator("div.ds-button--filled").first().click();
    await page.waitForTimeout(5000);
    
    await page.goto("https://platform.deepseek.com/usage", { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(5000);
    
    var data = await page.evaluate(function() {
      var text = document.body.innerText;
      var lines = text.split("\n").filter(Boolean);
      var result = { balance: "", totalCost: "", requests: "", tokens: "", cost30d: "" };
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i].trim();
        if (l.startsWith("\u00a5") && !result.balance) result.balance = l;
        if (l === "\u7d2f\u8ba1\u6d88\u8d39\u91d1\u989d" && i+1 < lines.length) result.totalCost = lines[i+1].trim();
        if (l === "API \u8bf7\u6c42\u6b21\u6570" && i+1 < lines.length) result.requests = lines[i+1].trim();
        if (l === "Tokens" && i+1 < lines.length) result.tokens = lines[i+1].trim();
      }
      return result;
    });
    return data;
  } finally {
    await browser.close();
  }
}

module.exports = { fetchUsage };

if (require.main === module) {
  (async function() {
    var data = await fetchUsage({ visible: true });
    console.log(JSON.stringify(data, null, 2));
  })();
}