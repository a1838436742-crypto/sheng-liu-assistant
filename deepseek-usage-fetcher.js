const { chromium } = require("./test_pkg/node_modules/playwright-core");
const fs = require("fs");
const path = require("path");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8"));
const EMAIL = CONFIG.platform_email;
const PASSWORD = CONFIG.platform_password;

async function doLogin(page) {
  await page.goto("https://platform.deepseek.com/sign_in", { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(2000);

  // 切换到密码登录
  var pwBtn = page.locator("div.ds-sign-in-form__social-links .ds-button").first();
  await pwBtn.waitFor({ state: "visible", timeout: 10000 });
  await pwBtn.click();
  await page.waitForTimeout(3000);

  // 填账号(非password的input)
  var inputs = await page.locator("input").all();
  for (var inp of inputs) {
    var typ = await inp.getAttribute("type");
    if (typ !== "password") { await inp.fill(EMAIL); break; }
  }
  await page.waitForTimeout(500);

  // 填密码
  await page.locator("input[type='password']").first().fill(PASSWORD);
  await page.waitForTimeout(500);

  // 点击登录
  await page.locator("div.ds-button--filled").first().click();

  // 等登录完成
  for (var i = 0; i < 60; i++) {
    await page.waitForTimeout(1000);
    if (!page.url().includes("sign_in")) return true;
  }
  return false;
}

async function fetchUsage(options) {
  options = options || {};
  console.log("[usage-fetcher] 自动登录 DeepSeek 平台...");

  var browser = await chromium.launch({
    executablePath: CHROME,
    headless: !options.visible
  });
  var page = await browser.newPage();

  try {
    var ok = await doLogin(page);
    if (!ok) {
      console.log("[usage-fetcher] ❌ 登录失败");
      return { error: "login_failed" };
    }

    console.log("[usage-fetcher] ✅ 登录成功，获取用量数据...");
    await page.goto("https://platform.deepseek.com/usage", { waitUntil: "load", timeout: 20000 });
    await page.waitForTimeout(5000);

    var data = await page.evaluate(function() {
      var text = document.body.innerText;
      var lines = text.split("\n").filter(Boolean);
      var result = { balance: "", totalCost: "", requests: "", tokens: "", cost30d: "" };
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i].trim();
        if (l.startsWith("¥") && !result.balance) { result.balance = l; continue; }
        if (l === "累计消费金额" && i+1 < lines.length) result.totalCost = lines[i+1].trim();
        if (l === "API 请求次数" && i+1 < lines.length) result.requests = lines[i+1].trim();
        if (l === "Tokens" && i+1 < lines.length) result.tokens = lines[i+1].trim();
        if (l === "消费金额" && i+2 < lines.length && lines[i+2].trim() === "CNY" && !result.cost30d) result.cost30d = lines[i+1].trim();
      }
      return result;
    });

    console.log("[usage-fetcher] ✅ 数据获取成功");
    return data;
  } finally {
    await browser.close();
  }
}

module.exports = { fetchUsage };

if (require.main === module) {
  (async function() {
    var data = await fetchUsage({ visible: true });
    console.log("\n=== DeepSeek 用量数据 ===");
    console.log(JSON.stringify(data, null, 2));
  })();
}
