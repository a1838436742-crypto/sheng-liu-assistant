// image-filter-proxy.js v2.0
// 拦截图片 → 保存到文件 → 替换为带路径的提示文字
// Codex → 本代理(57322) → codex-plus-plus(57321)
var http = require("http");
var fs = require("fs");
var path = require("path");
var crypto = require("crypto");

var UPSTREAM_PORT = 57321;
var UPSTREAM_HOST = "127.0.0.1";
var LISTEN_PORT = 57322;
var logDir = path.join(__dirname, ".cache");
var imgDir = path.join(logDir, "intercepted_images");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
var logPath = path.join(logDir, "image-filter.log");
function log(msg) {
  var ts = new Date().toISOString();
  var line = "[" + ts + "] " + msg;
  console.log(line);
  try { fs.appendFileSync(logPath, line + "\n", "utf-8"); } catch(e) {}
}

function extFromMime(mime) {
  var map = {"image/png":"png","image/jpeg":"jpg","image/jpg":"jpg","image/gif":"gif","image/webp":"webp","image/bmp":"bmp"};
  return map[mime] || "png";
}

function saveBase64Image(dataUri) {
  try {
    var m = dataUri.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return null;
    var mime = m[1], b64 = m[2], ext = extFromMime(mime);
    var hash = crypto.createHash("md5").update(b64.substring(0, 1000)).digest("hex").substring(0, 8);
    var ts = Date.now().toString(36);
    var filename = "img_" + ts + "_" + hash + "." + ext;
    var filepath = path.join(imgDir, filename);
    try { fs.statSync(filepath); return filepath; } catch(e) {}
    var buf = Buffer.from(b64, "base64");
    fs.writeFileSync(filepath, buf);
    log("保存图片 -> " + filename + " (" + buf.length + " bytes)");
    return filepath;
  } catch(e) {
    log("保存图片失败: " + e.message);
    return null;
  }
}

// 在 strip 之前从原始对象提取所有图片并保存（去重）
function saveAllImages(obj) {
  var seen = new Set();
  var paths = [];
  function walk(v) {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v.type === "input_image" && v.image_url) {
      var fp = saveBase64Image(v.image_url);
      if (fp && !seen.has(fp)) { seen.add(fp); paths.push(fp); }
    }
    for (var key in v) { if (key !== "image_url") walk(v[key]); }
  }
  walk(obj);
  return paths;
}

function stripImages(obj, savedPaths) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(function(v) { return stripImages(v, savedPaths); });
  var clean = {};
  for (var key in obj) {
    if (key === "image_url") continue;
    if (key === "input_image") continue;
    if (key === "type" && (obj[key] === "input_image" || obj[key] === "image_url")) continue;
    clean[key] = stripImages(obj[key], savedPaths);
  }
  if (Array.isArray(clean.content)) {
    var hasImage = false, newContent = [];
    for (var i = 0; i < clean.content.length; i++) {
      var part = clean.content[i];
      if (typeof part === "object" && part !== null) {
        if (part.type === "input_image" || part.type === "image_url") { hasImage = true; continue; }
        else { newContent.push(part); }
      } else { newContent.push(part); }
    }
    if (hasImage) {
      var hint = "\n\n[此消息包含图片，已被 57322 拦截保存]";
      if (savedPaths && savedPaths.length > 0) hint += "\n本地路径: " + savedPaths.join(", ");
      hint += "\n如需分析图片内容，请用 GLM-4.6V（vision）或 Python PIL 本地处理";
      var lastText = newContent.length > 0 ? newContent[newContent.length - 1] : null;
      if (lastText && lastText.type === "input_text" && typeof lastText.text === "string") {
        lastText.text += hint;
      } else {
        newContent.push({type: "input_text", text: hint.trim()});
      }
    }
    clean.content = newContent;
  }
  return clean;
}

var server = http.createServer(function(cReq, cRes) {
  var chunks = [];
  cReq.on("data", function(c) { chunks.push(c); });
  cReq.on("end", async function() {
    try {
      var rawBody = Buffer.concat(chunks).toString("utf-8");
      var url = cReq.url, method = cReq.method;
      if (method === "OPTIONS") {
        cRes.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "*" });
        cRes.end(); return;
      }
      var cleanedBody = rawBody;
      try {
        var parsed = JSON.parse(rawBody);
        if (parsed) {
          var original = JSON.stringify(parsed).length;
          var savedPaths = saveAllImages(parsed);
          var cleaned = stripImages(parsed, savedPaths);
          cleanedBody = JSON.stringify(cleaned);
          var stripped = original - cleanedBody.length;
          if (stripped > 0) log("拦截并移除 " + stripped + " bytes 的图片数据");
        }
      } catch(e) {}
      var opts = {
        hostname: UPSTREAM_HOST, port: UPSTREAM_PORT, path: url, method: method,
        headers: Object.assign({}, Object.fromEntries(Object.entries(cReq.headers).filter(function(e){return e[0]!=='transfer-encoding'&&e[0]!=='TE'})), { "Content-Length": Buffer.byteLength(cleanedBody) }),
        timeout: 180000,
      };
      var upstreamReq = http.request(opts, function(upRes) { cRes.writeHead(upRes.statusCode, upRes.headers); upRes.pipe(cRes); });
      upstreamReq.on("error", function(e) { log("转发错误: " + e.message); cRes.writeHead(502); cRes.end(JSON.stringify({error: "proxy error: " + e.message})); });
      upstreamReq.on("timeout", function() { upstreamReq.destroy(); cRes.writeHead(504); cRes.end(JSON.stringify({error: "upstream timeout"})); });
      upstreamReq.write(cleanedBody); upstreamReq.end();
    } catch(e) {
      log("错误: " + e.message);
      try { cRes.writeHead(500); cRes.end(JSON.stringify({error:e.message})); } catch(e2) {}
    }
  });
});
server.timeout = 0;
server.listen(LISTEN_PORT, function() {
  log("图片过滤器 v2.0 已就绪: 127.0.0.1:" + LISTEN_PORT + " -> codex-plus-plus:" + UPSTREAM_PORT);
  log("拦截的图片将保存到: " + imgDir);
});