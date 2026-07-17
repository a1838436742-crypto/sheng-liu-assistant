// image-filter-proxy.js v1.0
// 拦截 image_url 防止污染会话文件
// Codex → 本代理(57322) → codex-plus-plus(57321)
var http = require("http");
var fs = require("fs");
var path = require("path");

var UPSTREAM_PORT = 57321;
var UPSTREAM_HOST = "127.0.0.1";
var LISTEN_PORT = 57322;
var logDir = path.join(__dirname, ".cache");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
var logPath = path.join(logDir, "image-filter.log");
function log(msg) {
  var ts = new Date().toISOString();
  var line = "[" + ts + "] " + msg;
  console.log(line);
  try { fs.appendFileSync(logPath, line + "\n", "utf-8"); } catch(e) {}
}

// 递归删除所有 image_url / input_image 字段
function stripImages(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(stripImages);
  var clean = {};
  for (var key in obj) {
    // 跳过 image_url 和 input_image
    if (key === "image_url") continue;
    if (key === "input_image") continue;
    // 处理 type 字段
    if (key === "type" && (obj[key] === "input_image" || obj[key] === "image_url")) continue;
    clean[key] = stripImages(obj[key]);
  }
  // 如果是 content 数组，过滤掉图片类型的 part
  if (Array.isArray(clean.content)) {
    clean.content = clean.content.filter(function(part) {
      if (typeof part === "object" && part !== null) {
        if (part.type === "input_image") return false;
        if (part.type === "image_url") return false;
      }
      return true;
    });
  }
  return clean;
}

var server = http.createServer(function(cReq, cRes) {
  var chunks = [];
  cReq.on("data", function(c) { chunks.push(c); });
  cReq.on("end", async function() {
    try {
      var rawBody = Buffer.concat(chunks).toString("utf-8");
      var url = cReq.url;
      var method = cReq.method;

      if (method === "OPTIONS") {
        cRes.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "*"
        });
        cRes.end();
        return;
      }

      // 解析并清洗请求体
      var cleanedBody = rawBody;
      try {
        var parsed = JSON.parse(rawBody);
        if (parsed) {
          var original = JSON.stringify(parsed).length;
          var cleaned = stripImages(parsed);
          cleanedBody = JSON.stringify(cleaned);
          var stripped = original - cleanedBody.length;
          if (stripped > 0) {
            log("拦截并移除 " + stripped + " bytes 的图片数据");
          }
        }
      } catch(e) {
        // 不是 JSON，透传
      }

      // 转发到 codex-plus-plus
      var opts = {
        hostname: UPSTREAM_HOST,
        port: UPSTREAM_PORT,
        path: url,
        method: method,
        headers: Object.assign({}, Object.fromEntries(Object.entries(cReq.headers).filter(function(e){return e[0]!=='transfer-encoding'&&e[0]!=='TE'})), {
          "Content-Length": Buffer.byteLength(cleanedBody)
        }),
        timeout: 180000,
      };

      var upstreamReq = http.request(opts, function(upRes) {
        cRes.writeHead(upRes.statusCode, upRes.headers);
        upRes.pipe(cRes);
      });
      upstreamReq.on("error", function(e) {
        log("转发错误: " + e.message);
        cRes.writeHead(502);
        cRes.end(JSON.stringify({error: "proxy error: " + e.message}));
      });
      upstreamReq.on("timeout", function() {
        upstreamReq.destroy();
        cRes.writeHead(504);
        cRes.end(JSON.stringify({error: "upstream timeout"}));
      });
      upstreamReq.write(cleanedBody);
      upstreamReq.end();
    } catch(e) {
      log("错误: " + e.message);
      try { cRes.writeHead(500); cRes.end(JSON.stringify({error:e.message})); } catch(e2) {}
    }
  });
});

server.timeout = 0;
server.listen(LISTEN_PORT, function() {
  log("图片过滤器已就绪: 127.0.0.1:" + LISTEN_PORT + " → codex-plus-plus:" + UPSTREAM_PORT);
});

