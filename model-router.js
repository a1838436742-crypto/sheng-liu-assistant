// ============================================================
// 模型路由 - 智能分配任务到最省钱的模型
// 简单任务 → GLM-4-Flash（免费）
// 复杂任务 → DeepSeek V4 Flash（¥0.20/1M）
// ============================================================
const https = require("https");
const http = require("http");
const audit = require("./audit-client.js");

// 模型配置
const PROVIDERS = {
  "deepseek-v4-flash": {
    name: "DeepSeek V4 Flash",
    baseUrl: "https://api.deepseek.com",
    price: "¥0.20/1M in",
    taskTypes: ["userscript", "crawler", "bugfix", "video"],
  },
  "glm-4.5-air": {
    name: "智谱 GLM-4.5-Air",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    price: "赠送额度(1200万tokens)",
    taskTypes: ["userscript", "crawler", "bugfix", "video"],
  },
  "glm-4-flash": {
    name: "智谱 GLM-4-Flash",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    price: "免费",
    taskTypes: ["chat", "qa", "extract", "summary"],
  },
};

// 任务复杂度映射：简单 → 免费模型，复杂 → DeepSeek
var TASK_ROUTES = {
  "聊天":     "glm-4-flash",
  "问答":     "glm-4-flash",
  "提取":     "glm-4-flash",
  "总结":     "glm-4-flash",
  "油猴脚本": "glm-4.5-air",
  "爬虫":     "glm-4.5-air",
  "视频处理": "glm-4.5-air",
  "修Bug":   "glm-4.5-air",
};

// 默认路由
var DEFAULT_ROUTE = {
  simple: "glm-4-flash",
  complex: "deepseek-v4-flash",
};

var _freeApiKey = "";
var _deepseekKey = "";
var _freeFallbackCount = 0;

function init(opts) {
  _freeApiKey = opts.freeApiKey || "";
  _deepseekKey = opts.deepseekKey || "";
}

function getTargetModel(taskType) {
  var route = TASK_ROUTES[taskType] || DEFAULT_ROUTE.complex;
  // 如果没有免费额度了，glm-4.5-air 也回退 DeepSeek
  // 如果没有配置免费 API Key，全部走 DeepSeek
  if (route === "glm-4-flash" && !_freeApiKey) return "deepseek-v4-flash";
  return route;
}

function callProvider(model, messages, opts) {
  var cfg = model === "glm-4-flash" || model === "glm-4.5-air"
    ? { baseUrl: PROVIDERS["glm-4-flash"].baseUrl, apiKey: _freeApiKey, modelName: model }
    : { baseUrl: PROVIDERS["deepseek-v4-flash"].baseUrl, apiKey: _deepseekKey, modelName: "deepseek-v4-flash" };

  return new Promise(function(resolve) {
    var body = JSON.stringify({
      model: cfg.modelName,
      messages: messages,
      max_tokens: opts.max_tokens || 1500,
      temperature: opts.temperature ?? 0.7,
      stream: false,
    });

    var url = new URL(cfg.baseUrl + "/chat/completions");
    var mod = url.protocol === "https:" ? https : http;
    var reqOpts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + cfg.apiKey,
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 60000,
    };

    var start = Date.now();
    var req = mod.request(reqOpts, function(res) {
      var data = "";
      res.on("data", function(c) { data += c; });
      res.on("end", function() {
        var duration = Date.now() - start;
        try {
          var json = JSON.parse(data);
          if (json.error) {
            resolve({ text: "", usage: null, cached: false, error: json.error.message, model: model, duration: duration });
            return;
          }
          var choice = json.choices?.[0];
          resolve({
            text: choice?.message?.content || choice?.text || "",
            usage: json.usage || null,
            cached: false,
            model: model,
            duration: duration,
          });
        } catch (e) {
          resolve({ text: "", usage: null, cached: false, error: "parse error: " + e.message, model: model, duration: duration });
        }
      });
    });
    req.on("error", function(e) { resolve({ text: "", usage: null, cached: false, error: e.message, model: model, duration: Date.now() - start }); });
    req.on("timeout", function() { req.destroy(); resolve({ text: "", usage: null, cached: false, error: "timeout", model: model, duration: Date.now() - start }); });
    req.write(body);
    req.end();
  });
}

/**
 * 发送请求（自动路由到最省钱的模型）
 */
async function smartAsk(taskType, messages, options) {
  var targetModel = getTargetModel(taskType);
  var isFree = targetModel === "glm-4-flash" || targetModel === "glm-4.5-air";

  if (isFree) {
    var modelLabel = targetModel === "glm-4.5-air" ? "GLM-4.5-Air (赠送额度)" : "GLM-4-Flash (免费)";
    console.log("[路由] " + taskType + " → " + modelLabel);
    var result = await callProvider("glm-4-flash", messages, options);
    if (result.error && _freeFallbackCount < 3) {
      _freeFallbackCount++;
      console.log("[路由] 免费模型失败，回退到 DeepSeek: " + result.error);
      audit.record({
        model: "glm-4-flash",
        task_type: taskType,
        _origin: "system",
        input_tokens: 0, output_tokens: 0,
        status: "fallback",
        note: "免费模型失败→回退DeepSeek: " + result.error.slice(0, 60),
      });
      // 回退到 DeepSeek
      // 回退到 DeepSeek
      return await callProvider("deepseek-v4-flash", messages, options);
    }
    // 记录免费模型调用
    audit.record({
      model: "glm-4-flash",
      task_type: taskType,
      _origin: "user",
      input_tokens: result.usage?.prompt_tokens || 0,
      output_tokens: result.usage?.completion_tokens || 0,
      status: result.error ? "error" : "success",
      note: "免费 " + (result.error ? "失败" : "成功"),
    });
    return result;
  }

  // 复杂任务 → DeepSeek
  console.log("[路由] " + taskType + " → DeepSeek V4 Flash");
  return await callProvider("deepseek-v4-flash", messages, options);
}

module.exports = { init, smartAsk, getTargetModel, PROVIDERS, TASK_ROUTES };
