// API Client - DeepSeek unified client
const https = require("https");
const fs = require("fs");
const path = require("path");

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8").replace(/^\uFEFF/, ""));
  } catch(e) { return {}; }
}

function callDeepSeek(messages, options) {
  options = options || {};
  var cfg = loadConfig();
  var apiKey = options.apiKey || cfg.api_key;
  
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify({
      model: options.model || "deepseek-chat",
      messages: messages,
      max_tokens: options.max_tokens || 2000,
      temperature: options.temperature || 0.7
    });
    
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
      timeout: options.timeout || 30000
    }, function(res) {
      var data = "";
      res.on("data", function(c) { data += c; });
      res.on("end", function() {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve({ error: e.message, raw: data }); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

module.exports = { callDeepSeek, loadConfig };
