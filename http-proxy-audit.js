// ============================================================
// HTTP 审计代理 - 拦截 Codex ↔ codex-plus-plus 流量，解析 token 用量
// 用法：
//   1. node http-proxy-audit.js
//   2. 改 config.toml: base_url = "http://127.0.0.1:57325/v1"
//   3. 重启 Codex
// ============================================================
const http = require("http");
const https = require("https");
const audit = require("./audit-client.js");
const path = require("path");
const fs = require("fs");

const TARGET_HOST = "127.0.0.1";
const TARGET_PORT = 57321;
const LISTEN_PORT = 57325;
const LOG_FILE = path.join(__dirname, "audit_logs", "proxy_audit.csv");

if (!fs.existsSync(path.join(__dirname, "audit_logs"))) fs.mkdirSync(path.join(__dirname, "audit_logs"), { recursive: true });
if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, "ts,method,path,model,in_tokens,out_tokens,bytes\n");

function logCsv(ts, method, p, model, inp, out, bytes) {
  fs.appendFileSync(LOG_FILE, [ts, method, p, model, inp, out, bytes].join(",") + "\n");
}

function modelShort(m) {
  m = (m || "").toLowerCase();
  if (m.includes("flash")) return "deepseek-v4-flash";
  if (m.includes("deepseek")) return m.split("/").pop();
  return m || "unknown";
}

var server = http.createServer(function(clientReq, clientRes) {
  var ts = new Date().toISOString().replace("T"," ").slice(0,19);
  var chunks = [];

  clientReq.on("data", function(c) { chunks.push(c); });
  clientReq.on("end", function() {
    var body = Buffer.concat(chunks);
    var bodyStr = body.toString("utf-8");

    // 构造转发请求
    var opt = {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: clientReq.url,
      method: clientReq.method,
      headers: Object.assign({}, clientReq.headers),
    };
    delete opt.headers["host"];

    var proxyReq = http.request(opt, function(proxyRes) {
      var resChunks = [];
      proxyRes.on("data", function(c) { resChunks.push(c); });
      proxyRes.on("end", function() {
        var resBody = Buffer.concat(resChunks);
        var resStr = resBody.toString("utf-8");

        // 解析响应，提取 usage
        var model = "", inpTokens = 0, outTokens = 0;
        try {
          if (proxyRes.headers["content-type"] && proxyRes.headers["content-type"].includes("json")) {
            var json = JSON.parse(resStr);
            // Responses API 格式
            if (json.usage) {
              inpTokens = json.usage.input_tokens || 0;
              outTokens = json.usage.output_tokens || 0;
              model = modelShort(json.model || json._model || "");
            }
            // Chat Completions API 格式（兼容）
            if (json.usage && !inpTokens) {
              inpTokens = json.usage.prompt_tokens || 0;
              outTokens = json.usage.completion_tokens || 0;
            }
            if (!model) model = modelShort(json.model || "");
          }
        } catch (e) {}

        // 记录审计（仅记录有 token 消耗的响应）
        if (proxyRes.statusCode === 200 && inpTokens > 0) {
          audit.record({
            model: model || "deepseek-v4-flash",
            task_type: "聊天",
            input_tokens: inpTokens,
            output_tokens: outTokens,
            cache_probability: 0,
            prefix_tokens: 0,
            duration_ms: 0,
            status: "success",
            prompt_preview: (bodyStr.slice(0, 40) || "").replace(/\n/g, " "),
            note: "http-proxy",
            _origin: "user",
          });
        }

        // CSV 日志（所有请求）
        logCsv(ts, clientReq.method, clientReq.url, model, inpTokens, outTokens, resBody.length);

        // 写回客户端
        clientRes.writeHead(proxyRes.statusCode, proxyRes.statusHeaders || proxyRes.headers);
        clientRes.end(resBody);
      });
    });

    proxyReq.on("error", function(e) {
      logCsv(ts, clientReq.method, clientReq.url, "error", 0, 0, 0);
      clientRes.writeHead(502);
      clientRes.end("proxy error: " + e.message);
    });

    if (body.length > 0) proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(LISTEN_PORT, function() {
  console.log("");
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   HTTP 审计代理已启动                       ║");
  console.log("║   监听: 127.0.0.1:" + LISTEN_PORT + "                       ║");
  console.log("║   转发: → 127.0.0.1:" + TARGET_PORT + "                       ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log("");
  console.log("使用：");
  console.log("  1. 改 ~/.codex/config.toml:");
  console.log('     base_url = "http://127.0.0.1:' + LISTEN_PORT + '/v1"');
  console.log("  2. 重启 Codex");
  console.log("  3. 所有对话的 token 用量会自动记录到审计");
  console.log("");
});

process.on("uncaughtException", function(e) {
  console.error("[proxy] 错误:", e.message);
});
