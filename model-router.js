// Model Router - \u6a21\u578b\u8def\u7531\u5668\nconst https = require("https");
const fs = require("fs");
const path = require("path");

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8").replace(/^\uFEFF/, ""));
  } catch(e) { return {}; }
}

// GLM \u514d\u8d39 API \u8c03\u7528
function callGLM(messages, model) {
  model = model || "glm-4-flash";
  var cfg = loadConfig();
  var key = cfg.free_api_key || "";
  
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify({ model: model, messages: messages, max_tokens: 1500 });
    var req = https.request({
      hostname: "open.bigmodel.cn",
      port: 443,
      path: "/api/paas/v4/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + key,
        "Content-Length": Buffer.byteLength(body)
      },
      timeout: 30000
    }, function(res) {
      var data = "";
      res.on("data", function(c) { data += c; });
      res.on("end", function() {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve({ error: e.message }); }
      });
    });
    req.on("error", function(e) { resolve({ error: e.message }); });
    req.on("timeout", function() { req.destroy(); resolve({ error: "timeout" }); });
    req.write(body);
    req.end();
  });
}

module.exports = { callGLM, loadConfig };
