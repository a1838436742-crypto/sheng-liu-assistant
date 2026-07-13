// deepseek-direct.js — 从 js kernel 直接调 DeepSeek API（不经过 proxy）
// 不走 config.toml，不重启 Codex
// 
// 用法 (js kernel):
//   var ds = await import("C:/Users/DEWK/Documents/省流助手v3.0/deepseek-direct.js");
//   var r = await ds.ask("写个爬虫脚本");
//   nodeRepl.write(r);

const https = await import("https");
const fs = await import("fs");
var cfg = JSON.parse(
  fs.readFileSync("C:/Users/DEWK/Documents/省流助手v3.0/config.json", "utf-8").replace(/^\uFEFF/, "")
);
const KEY = cfg.api_key;  // sk-4af3a...

async function ask(prompt, opts) {
  var maxTokens = opts?.max_tokens || 2000;
  var body = JSON.stringify({
    model: "deepseek-v4-flash",
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
    temperature: 0.7,
    stream: false,
  });
  return new Promise(function(ok, fail) {
    var r = https.request({
      hostname: "api.deepseek.com", port: 443,
      path: "/v1/chat/completions", method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + KEY,
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 120000,
    }, function(res) {
      var d = "";
      res.on("data", function(c) { d += c; });
      res.on("end", function() {
        try {
          var j = JSON.parse(d);
          ok(j.choices?.[0]?.message?.content || "");
        } catch(e) { fail(e.message); }
      });
    });
    r.on("error", fail);
    r.on("timeout", function() { r.destroy(); fail("timeout"); });
    r.write(body);
    r.end();
  });
}

async function askWithMessages(messages, opts) {
  var maxTokens = opts?.max_tokens || 2000;
  var body = JSON.stringify({
    model: "deepseek-v4-flash",
    messages: messages,
    max_tokens: maxTokens,
    temperature: 0.7,
    stream: false,
  });
  return new Promise(function(ok, fail) {
    var r = https.request({
      hostname: "api.deepseek.com", port: 443,
      path: "/v1/chat/completions", method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + KEY,
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 120000,
    }, function(res) {
      var d = "";
      res.on("data", function(c) { d += c; });
      res.on("end", function() {
        try {
          var j = JSON.parse(d);
          ok(j.choices?.[0]?.message?.content || "");
        } catch(e) { fail(e.message); }
      });
    });
    r.on("error", fail);
    r.on("timeout", function() { r.destroy(); fail("timeout"); });
    r.write(body);
    r.end();
  });
}

export { ask, askWithMessages };
