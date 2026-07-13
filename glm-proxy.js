// GLM-4-Flash / GLM-4.5-Air / GLM-4V 协议转换代理 v3.0
var http = require("http");
var https = require("https");
var audit = require("./audit-client.js");
var fs = require("fs");
var path = require("path");

var raw = fs.readFileSync(path.join(__dirname, "config.json"), "utf-8").replace(/^\uFEFF/, "");
var cfg = JSON.parse(raw);
var KEY = cfg.free_api_key || "";
var PORT = 57330;
var GLM_HOST = "open.bigmodel.cn";

// ── 日志 ──
var logDir = path.join(__dirname, ".cache");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
var logPath = path.join(logDir, "glm-proxy.log");
function log(msg) {
  var ts = new Date().toISOString();
  var line = "[" + ts + "] " + msg;
  console.log(line);
  try { fs.appendFileSync(logPath, line + "\n", "utf-8"); } catch(e) {}
}

if (!KEY) { log("[glm] 缺少 free_api_key"); process.exit(1); }
log("[glm] 启动中...");

// ── 模型名映射 ──
var MODEL_MAP = {
  "gpt-5.5": "glm-4-flash",
  "gpt-5.6-sol": "glm-4.5-air",
  "gpt-5.6-terra": "glm-4.5-air",
  "gpt-5.6-luna": "glm-4-flash",
  "gpt-5.4": "glm-4.5-air",
  "deepseek-v4-flash": "glm-4.5-air",
  "deepseek-chat": "glm-4.5-air",
  "glm-4-flash": "glm-4-flash",
  "glm-4.5-air": "glm-4.5-air",
};
function mapModel(m) { return MODEL_MAP[m] || "glm-4-flash"; }

// ── 是否有图片 ──
function hasImageParts(content) {
  if (!Array.isArray(content)) return false;
  return content.some(function(p) {
    return p && (p.type === "input_image" || p.type === "image_url");
  });
}

// ── 获取 Content-Type 后缀 ──
function mimeExt(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return "png";
  if (buf[0] === 0xFF && buf[1] === 0xD8) return "jpeg";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "gif";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return "webp";
  return "png";
}
function mimeType(ext) {
  return ext === "jpeg" ? "image/jpeg" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/png";
}

// ── 下载图片 → base64 data URL ──
function downloadImage(url) {
  return new Promise(function(ok, fail) {
    // data URL
    if (url.startsWith("data:")) {
      ok(url);
      return;
    }
    // 本地文件
    if (url.startsWith("file://")) {
      var p = url.slice(7);
      if (process.platform === "win32" && p.startsWith("/")) p = p.slice(1);
      try {
        var buf = fs.readFileSync(p);
        var ext = mimeExt(buf);
        ok("data:" + mimeType(ext) + ";base64," + buf.toString("base64"));
      } catch(e) { fail("读取本地图片失败: " + e.message); }
      return;
    }
    // HTTP/HTTPS URL
    var mod = url.startsWith("https") ? https : http;
    mod.get(url, function(res) {
      var chunks = [];
      res.on("data", function(c) { chunks.push(c); });
      res.on("end", function() {
        var buf = Buffer.concat(chunks);
        var ext = mimeExt(buf);
        ok("data:" + mimeType(ext) + ";base64," + buf.toString("base64"));
      });
    }).on("error", fail);
  });
}

// ── 从 content part 提取图片 URL ──
function extractImageUrl(part) {
  if (part.type === "input_image") {
    if (typeof part.image_url === "string") return part.image_url;
    if (part.image_url && typeof part.image_url.url === "string") return part.image_url.url;
  }
  if (part.type === "image_url") {
    if (typeof part.image_url === "string") return part.image_url;
    if (part.image_url && typeof part.image_url.url === "string") return part.image_url.url;
  }
  return null;
}

// ── 展平 Responses API input → GLM 格式 ──
function flattenInput(input, instructions) {
  var msgs = [];
  if (instructions) msgs.push({role:"system", content:instructions});
  if (!input) return msgs;
  if (typeof input === "string") {
    msgs.push({role:"user", content:input});
    return msgs;
  }
  if (Array.isArray(input)) {
    input.forEach(function(item) {
      if (!item) return;
      var role = item.role || "user";
      var content = item.content;
      if (Array.isArray(content)) {
        if (hasImageParts(content)) {
          msgs.push({role:role, _hasImage:true, content:content});
        } else {
          var texts = content.map(function(part) {
            if (typeof part === "string") return part;
            if (part.type === "input_text" || part.type === "text") return part.text || "";
            if (part.type === "input_image") return "";
            if (part.type === "image_url") return "";
            return JSON.stringify(part);
          }).filter(Boolean);
          msgs.push({role:role, content:texts.join("\n")});
        }
      } else if (typeof content === "string") {
        msgs.push({role:role, content:content});
      } else {
        msgs.push({role:role, content:JSON.stringify(content)});
      }
    });
  }
  return msgs;
}

// ── 构建多模态 messages ──
async function buildMultiModalMessages(messages) {
  var result = [];
  for (var i = 0; i < messages.length; i++) {
    var m = messages[i];
    if (m._hasImage && Array.isArray(m.content)) {
      var parts = [];
      for (var j = 0; j < m.content.length; j++) {
        var p = m.content[j];
        if (p.type === "input_text" || p.type === "text") {
          if (p.text) parts.push({type:"text", text:p.text});
        } else if (p.type === "input_image" || p.type === "image_url") {
          var url = extractImageUrl(p);
          if (url) {
            try {
              var dataUrl = await downloadImage(url);
              parts.push({type:"image_url", image_url:{url:dataUrl}});
            } catch(e) {
              log("[glm] 图片下载失败: " + e.message);
              parts.push({type:"text", text:"[图片加载失败: " + e.message + "]"});
            }
          }
        }
      }
      result.push({role:m.role, content:parts});
    } else {
      result.push({role:m.role, content:m.content});
    }
  }
  return result;
}

// ── 检查是否需要 vision ──
function needsVision(messages) {
  return messages.some(function(m) { return m._hasImage; });
}

// ── GLM 文本 API 调用 ──
function glmCall(model, messages, maxTokens, temp) {
  return new Promise(function(ok, fail) {
    var body = JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: maxTokens || 4096,
      temperature: temp || 0.7,
      stream: false,
    });
    log("[glm] → GLM " + model + ", " + messages.length + " 条消息");
    var opts = {
      hostname: GLM_HOST, port: 443, path: "/api/paas/v4/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + KEY,
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 120000,
    };
    var r = https.request(opts, function(res) {
      var d = "";
      res.on("data", function(c) { d += c; });
      res.on("end", function() {
        try { ok(JSON.parse(d)); }
        catch (e) { fail("parse:" + e.message + " body:" + d.slice(0,200)); }
      });
    });
    r.on("error", fail);
    r.on("timeout", function() { r.destroy(); fail("timeout"); });
    r.write(body);
    r.end();
  });
}

// ── GLM 视觉 API 调用 (glm-4v) ──
function glmCallVision(model, messages, maxTokens, temp) {
  return new Promise(function(ok, fail) {
    var body = JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: maxTokens || 4096,
      temperature: temp || 0.7,
      stream: false,
    });
    log("[glm] → GLM-4V " + model + ", " + messages.length + " 条消息 (含图片)");
    var opts = {
      hostname: GLM_HOST, port: 443, path: "/api/paas/v4/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + KEY,
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 120000,
    };
    var r = https.request(opts, function(res) {
      var d = "";
      res.on("data", function(c) { d += c; });
      res.on("end", function() {
        try {
          var j = JSON.parse(d);
          if (j.error && j.error.code === "NO_PERMISSION") {
            log("[glm] GLM-4V 无权限，回退到文本说明");
            ok({_fallback:true});
          } else {
            ok(j);
          }
        }
        catch (e) { fail("parse:" + e.message + " body:" + d.slice(0,200)); }
      });
    });
    r.on("error", fail);
    r.on("timeout", function() { r.destroy(); fail("timeout"); });
    r.write(body);
    r.end();
  });
}

// ── 服务器 ──
var server = http.createServer(function(cReq, cRes) {
  var chunks = [];
  cReq.on("data", function(c) { chunks.push(c); });
  cReq.on("end", async function() {
    try {
      var rawBody = chunks.length > 0 ? Buffer.concat(chunks).toString("utf-8") : "{}";
      log("[glm] " + cReq.method + " " + cReq.url);

      if (cReq.method === "OPTIONS") {
        cRes.writeHead(204, {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"*"});
        cRes.end();
        return;
      }

      if (cReq.method === "GET" && cReq.url.includes("/models")) {
        cRes.writeHead(200, {"Content-Type":"application/json"});
        cRes.end(JSON.stringify({object:"list", data:[
          {id:"glm-4-flash", object:"model"},
          {id:"glm-4.5-air", object:"model"},
          {id:"glm-4v", object:"model"}
        ]}));
        log("[glm] GET /models -> 200");
        return;
      }

      if (cReq.url.includes("/responses")) {
        var reqBody = JSON.parse(rawBody);
        var originalModel = reqBody.model || "unknown";
        var glmModel = mapModel(originalModel);
        var stream = reqBody.stream === true || reqBody.stream === "true";
        var messages = flattenInput(reqBody.input, reqBody.instructions);

        log("[glm] " + originalModel + " → " + glmModel + " (stream=" + stream + "), " + messages.length + " msgs");

        if (messages.length > 0) {
          var last = messages[messages.length-1];
          var preview = typeof last.content === "string" ? last.content.slice(0,80) : JSON.stringify(last.content).slice(0,80);
          log("[glm] 最后消息: " + preview);
        }

        var glmRes;
        var usedVision = false;
        var useVisionModel = "glm-4v";

        if (needsVision(messages)) {
          log("[glm] 检测到图片，转为多模态请求");
          var visionMsgs = await buildMultiModalMessages(messages);
          glmRes = await glmCallVision(useVisionModel, visionMsgs, reqBody.max_output_tokens, reqBody.temperature);

          if (glmRes._fallback) {
            log("[glm] GLM-4V 降级，图片替换为 [图片]");
            var textMsgs = messages.map(function(m) {
              if (m._hasImage) {
                return {role:m.role, content:"[用户发送了一张图片]"};
              }
              return m;
            });
            glmRes = await glmCall(glmModel, textMsgs, reqBody.max_output_tokens, reqBody.temperature);
          } else {
            usedVision = true;
          }
        } else {
          glmRes = await glmCall(glmModel, messages, reqBody.max_output_tokens, reqBody.temperature);
        }

        var choice = glmRes.choices && glmRes.choices[0];
        var content = choice?.message?.content || "";
        var out = content ? [{type:"message", role:"assistant", content: [{type:"output_text", text: content, annotations:[]}]}] : [];
        var respId = "resp_"+Date.now();
        var usage = glmRes.usage || {input_tokens:0, output_tokens:0};

        var resp = {
          id: respId, object:"response",
          model: originalModel, output: out,
          usage: {input_tokens: usage.prompt_tokens||0, output_tokens: usage.completion_tokens||0},
          status:"completed"
        };
        log("[glm] 回复: " + content.slice(0,60));

        var note = usedVision ? "free: glm-4v" : "free: " + glmModel;
        try {
          audit.record({
            model: originalModel + "→" + (usedVision ? useVisionModel : glmModel),
            task_type: usedVision ? "视觉" : "聊天",
            _origin: "user",
            input_tokens: usage.prompt_tokens || 0,
            output_tokens: usage.completion_tokens || 0,
            duration_ms: 0,
            status: content ? "success" : "empty",
            note: note,
          });
        } catch(e) { log("[glm] audit err: " + e.message); }

        if (stream) {
          cRes.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          });
          cRes.write("event: response.created\ndata: " + JSON.stringify({type:"response.created", response:{id:respId, object:"response", model:originalModel, status:"in_progress"}}) + "\n\n");
          if (content) {
            for (var i = 0; i < content.length; i += 15) {
              cRes.write("event: response.output_text.delta\ndata: " + JSON.stringify({type:"response.output_text.delta", delta:content.slice(i,i+15), index:0}) + "\n\n");
            }
          }
          cRes.write("event: response.completed\ndata: " + JSON.stringify({type:"response.completed", response:resp}) + "\n\n");
          cRes.end();
        } else {
          cRes.writeHead(200, {"Content-Type":"application/json"});
          cRes.end(JSON.stringify(resp));
        }
        log("[glm] 响应完成 (" + content.length + " chars)");
        return;
      }

      log("[glm] 404: " + cReq.url);
      cRes.writeHead(404);
      cRes.end("not found");
    } catch(e) {
      log("[glm] 错误: " + e.message + " " + (e.stack||"").slice(0,200));
      try { cRes.writeHead(500, {"Content-Type":"application/json"}); cRes.end(JSON.stringify({error:{message:e.message}})); } catch(e2) {}
    }
  });
});

server.timeout = 0;
server.listen(PORT, function() {
  log("[glm] 代理 v3.0 已就绪: 127.0.0.1:" + PORT + " (支持 GLM-4V 图片)");
});
