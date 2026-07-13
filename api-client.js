// ============================================================
// 【省流铁律 v3.0】DeepSeek API 统一客户端
// 即拿即用，所有省流优化已内置
// 
// 用法:
//   const api = require("./api-client.js");
//   
//   // 1. 初始化（只需一次）
//   api.init({ apiKey: "sk-xxxx" });
//   
//   // 2. 发请求，自动 v3.0 缓存优化 + 审计
//   const res = await api.ask("油猴脚本", "在百度加一个悬浮按钮");
//   
//   // 3. 带网页清洗
//   const res2 = await api.ask("爬虫", "提取商品列表", { html: rawHtml });
//   
//   // 4. 看报表
//   api.report();
//   api.htmlReport();
// ============================================================

const UltraCacheOptimizer = require("./api-optimizer.js");
const audit = require("./audit-client.js");
const modelRouter = require("./model-router.js");
const https = require("https");
const http = require("http");

// ── 配置 ──
let _config = {
  apiKey: "",
  baseUrl: "https://api.deepseek.com",
  model: "deepseek-v4-flash",
  temperature: 0.7,
};

const _optimizer = new UltraCacheOptimizer();
let _initialized = false;

// ═══════════════════════════════════════════════════════
// 公开 API

function _readConfigKey() {
  try {
    var cfg = JSON.parse(require("fs").readFileSync(__dirname + "/config.json", "utf-8").replace(/^\\uFEFF/, ""));
    if (cfg.api_key && cfg.api_key.startsWith("sk-")) return cfg.api_key;
  } catch (e) {}
  return null;
}
// ═══════════════════════════════════════════════════════

/**
 * 初始化客户端（只需调用一次）
 */
function init(options = {}) {
  _config.apiKey = options.apiKey || process.env.DEEPSEEK_API_KEY || _readConfigKey() || _config.apiKey;
  _config.baseUrl = options.baseUrl || _config.baseUrl;
  _config.model = options.model || _config.model;
  _config.temperature = options.temperature ?? _config.temperature;
  _config.freeApiKey = options.freeApiKey || process.env.FREE_API_KEY || "";
  modelRouter.init({ freeApiKey: _config.freeApiKey, deepseekKey: _config.apiKey });

  if (!_config.apiKey) {
    console.warn("[api-client] ⚠️ 未设置 API Key，请通过 init() 传入或设置环境变量 DEEPSEEK_API_KEY");
  }

  _initialized = true;

  // 启动缓存预热（非高峰自动执行）
  if (options.warmup !== false) {
    console.log("[api-client] 🔥 缓存预热已启动（间隔5分钟，仅非高峰执行）");
    setInterval(() => {
      if (_optimizer.isPeakHours()) return;
      const req = _optimizer.getWarmUpRequest();
      audit.record({
        model: _config.model,
        task_type: "【缓存预热】",
        _origin: "system",
        input_tokens: Math.ceil(_optimizer.getPrefixStats().prefixTokens),
        output_tokens: 1,
        cache_probability: 0.95,
        prefix_tokens: _optimizer.getPrefixStats().prefixTokens,
        status: "warmup",
      });
    }, 5 * 60 * 1000).unref();  // unref() 不阻止进程退出
  }

  var _freeStatus = _config.freeApiKey ? " 🟢 免费模型就绪" : " ⚠️ 未配置免费模型";
  console.log("[api-client] ✅ v3.0 混合路由就绪 | " + _config.model + " | 前缀: ~" + _optimizer.getPrefixStats().prefixTokens + " tokens" + _freeStatus);
}

/**
 * 向 DeepSeek 发送请求（核心函数）
 *
 * @param {string} taskType - 任务类型: userscript|video|crawler|chat|bugfix
 * @param {string} userInput - 具体需求
 * @param {object} [options]
 * @param {string} [options.html] - 原始 HTML（自动清洗）
 * @param {string} [options.url] - 目标 URL（自动抓取清洗）
 * @param {object} [options.variables] - 模板变量
 * @param {number} [options.maxTokens] - 覆盖自动 max_tokens
 * @param {boolean} [options.peakBlock] - 高峰时是否阻塞等待（默认 false）
 * @returns {Promise<{text: string, usage: object, cache: object}>}
 */
async function ask(taskType, userInput, options = {}) {
  if (!_initialized) {
    console.warn("[api-client] ⚠️ 未调用 init()，使用默认配置");
    init();
  }

  if (!_config.apiKey) {
    throw new Error("[api-client] ❌ 未设置 API Key");
  }

  // 高峰阻塞
  if (options.peakBlock && _optimizer.isPeakHours()) {
    const next = _optimizer.getNextOffPeakTime();
    console.log("[api-client] ⏳ 高峰等待中... 预计 " + next);
    while (_optimizer.isPeakHours()) {
      await new Promise(r => setTimeout(r, 60000));
    }
  }

  // 高峰提醒
  if (_optimizer.isPeakHours()) {
    console.log("[api-client] 🔴 当前高峰，费用较高");
  }

  // 构造消息
  const req = _optimizer.buildRequest({
    taskType,
    userInput,
    html: options.html,
    url: options.url,
    variables: options.variables,
    maxTokens: options.maxTokens,
  });

  const startTime = Date.now();

  // 模型路由：所有任务走省钱模型
  var taskLabel = _optimizer._getTaskLabel(taskType);
  if (_config.freeApiKey) {
    var rt = await modelRouter.smartAsk(taskLabel, req.messages, {
      max_tokens: req.max_tokens,
      temperature: options.temperature ?? _config.temperature,
    });
    if (!rt.error) {
      audit.record({
        model: rt.model,
        task_type: taskLabel,
        _origin: "user",
        input_tokens: rt.usage?.prompt_tokens || Math.ceil(req.messages.join("").length / 3),
        output_tokens: rt.usage?.completion_tokens || req.max_tokens,
        cache_probability: 0, prefix_tokens: 0,
        duration_ms: rt.duration || 0,
        status: "success",
        prompt_preview: userInput.slice(0, 80),
        note: "节省模式: " + rt.model + " " + (rt.model.indexOf("glm")>=0?"(免费/赠送)":"(付费)"),
      });
      return { text: rt.text||"", usage: rt.usage||{}, cached: false, cache: req._cache, duration_ms: rt.duration||0, raw: rt };
    }
    console.log("[api-client] GLM失败，回退 DeepSeek: " + rt.error);
  }

  // DeepSeek API (备用)
  const result = await _callDeepSeek(req.messages, {
    model: options.model || _config.model,
    max_tokens: req.max_tokens,
    temperature: options.temperature ?? _config.temperature,
  });

  const durationMs = Date.now() - startTime;

  // 审计记录
  audit.record({
    model: _config.model,
    task_type: _optimizer._getTaskLabel(taskType),
    _origin: "user",
    input_tokens: result.usage?.prompt_tokens || Math.ceil(req.messages.join("").length / 3),
    output_tokens: result.usage?.completion_tokens || req.max_tokens,
    cache_probability: req._cache.estimate,
    prefix_tokens: req._cache.prefixTokens,
    duration_ms: durationMs,
    status: result.error ? "error" : "success",
    prompt_preview: userInput.slice(0, 80),
    note: (result.cached ? "🔥 缓存命中" : "⚡ 未命中缓存") + " | " + req._cache.note,
  });

  return {
    text: result.text || "",
    usage: result.usage || {},
    cached: result.cached || false,
    cache: req._cache,
    duration_ms: durationMs,
    raw: result,
  };
}

/**
 * 批量发送请求（同类任务聚堆 → 缓存连续命中）
 */
async function batch(tasks) {
  if (!_initialized) init();

  const b = _optimizer.batch();
  for (const t of tasks) {
    b.add({
      taskType: t.taskType,
      userInput: t.userInput,
      html: t.html,
      url: t.url,
      variables: t.variables,
    });
  }

  const requests = b.runAll();
  const results = [];

  for (const req of await requests) {
    const start = Date.now();
    const result = await _callDeepSeek(req.messages, {
      model: _config.model,
      max_tokens: req.max_tokens,
      temperature: _config.temperature,
    });
    results.push({
      text: result.text,
      cache: req._cache,
      duration_ms: Date.now() - start,
    });
  }

  return results;
}

/**
 * 打印控制台报表
 */
function report(days = 7) {
  audit.printReport(days);
}

/**
 * 生成 HTML 报表
 */
function htmlReport(days = 7) {
  return audit.htmlReport(days);
}

/**
 * 获取缓存优化状态
 */
function stats() {
  return {
    initialized: _initialized,
    model: _config.model,
    prefix: _optimizer.getPrefixStats(),
    peak: _optimizer.isPeakHours(),
    nextOffPeak: _optimizer.getNextOffPeakTime(),
  };
}

/**
 * 配置查询/更新
 */
function config(newConfig) {
  if (newConfig) Object.assign(_config, newConfig);
  return { ..._config };
}

// ═══════════════════════════════════════════════════════
// 内部函数
// ═══════════════════════════════════════════════════════

function _callDeepSeek(messages, opts) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: opts.model || _config.model,
      messages: messages,
      max_tokens: opts.max_tokens || 1500,
      temperature: opts.temperature ?? _config.temperature,
      stream: false,
    });

    const url = new URL(_config.baseUrl + "/v1/chat/completions");
    const mod = url.protocol === "https:" ? https : http;
    const reqOpts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + _config.apiKey,
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 120000,
    };

    const req = mod.request(reqOpts, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            resolve({ text: "", usage: null, cached: false, error: json.error.message });
          } else {
            const choice = json.choices?.[0];
            const cached = json.usage?.prompt_cache_hit_tokens > 0 ||
                          (json.usage?.prompt_tokens && json.usage?.prompt_cache_miss_tokens === 0);
            resolve({
              text: choice?.message?.content || choice?.text || "",
              usage: json.usage || null,
              cached: cached,
              raw: json,
            });
          }
        } catch (e) {
          resolve({ text: "", usage: null, cached: false, error: "JSON parse error: " + e.message });
        }
      });
    });

    req.on("error", (e) => resolve({ text: "", usage: null, cached: false, error: e.message }));
    req.on("timeout", () => { req.destroy(); resolve({ text: "", usage: null, cached: false, error: "timeout" }); });
    req.write(body);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════════════════
module.exports = { init, ask, batch, report, htmlReport, stats, config };

// 直接运行: node api-client.js
if (require.main === module) {
  console.log("");
  console.log("╔" + "═".repeat(58) + "╗");
  console.log("║   【省流铁律 v3.0】DeepSeek API 客户端  ║");
  console.log("╚" + "═".repeat(58) + "╝\\n");

  const s = stats();
  console.log("📐 缓存前缀: ~" + s.prefix.prefixTokens + " tokens (" + s.prefix.prefixChars + " chars)");
  console.log("   hash: " + s.prefix.prefixHash);
  console.log("   稳定性: " + s.prefix.consistency);
  console.log("");
  console.log("⏰ 当前: " + (s.peak ? "🔴 高峰" : "🟢 低谷"));
  console.log("");
  console.log("📋 可用函数:");
  console.log("   api.init({ apiKey })         初始化");
  console.log("   await api.ask(type, input)   发送请求（自动缓存优化）");
  console.log("   await api.batch([tasks])     批量发送（同类聚堆）");
  console.log("   api.report(7)                打印报表");
  console.log("   api.htmlReport(7)            生成 HTML 报表");
  console.log("   api.stats()                  当前状态");
  console.log("   api.config({...})            更新配置");
  console.log("");
}

