// DeepSeek 直连模块
// 用法: nodeRepl 中 dynamic import

const https = require("https");
const fs = require("fs");
const path = require("path");

function getConfig() {
  try {
    var p = path.join(__dirname, "config.json");
    return JSON.parse(fs.readFileSync(p, "utf-8").replace(/^\uFEFF/, ""));
  } catch(e) { return {}; }
}

module.exports = async function(prompt, options) {
  options = options || {};
  var cfg = getConfig();
  var apiKey = cfg.api_key || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DeepSeek API Key 未配置");

  var body = JSON.stringify({
    model: options.model || "deepseek-chat",
    messages: Array.isArray(prompt) ? prompt : [{ role: "user", content: prompt }],
    max_tokens: options.max_tokens || 4000,
    temperature: options.temperature || 0.7,
    stream: false
  });

  return new Promise((ok, fail) => {
    var req = https.request({
      hostname: "api.deepseek.com",
      port: 443,
      path: "/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey,
        "Content-Length": Buffer.byteLength(body)
      },
      timeout: options.timeout || 60000
    }, res => {
      var d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try { ok(JSON.parse(d)); }
        catch(e) { ok({ error: e.message, raw: d }); }
      });
    });
    req.on("error", fail);
    req.on("timeout", () => { req.destroy(); fail(new Error("timeout")); });
    req.write(body);
    req.end();
  });
};
