// ==UserScript==
// @name         省流助手 v3.0 — 计价小窗
// @namespace    sheng-liu-tie-lv
// @version      1.0.0
// @description  浮动小窗显示当前计费规则：GLM免费/DeepSeek ¥0.20-0.60
// @match        app://-/*
// @run-at       document-idle
// ==/UserScript==

(function() {
  "use strict";

  var KEY = "__shengliuPricingInstalled";
  if (window[KEY]) return;
  window[KEY] = true;

  var DAILY_API = "__codexDailyTokenUsage";
  var PRICE_KEY = "__codexDailyTokenUsageModelPricesV1";
  var STYLE_ID = "shengliu-pricing-style";
  var ROOT_ID = "shengliu-pricing-root";

  // ── 默认计价规则（不依赖外部 API） ──
  var PRICES = [
    { model: "gpt-5.6-sol",     route: "glm-4.5-air", cost: "¥0",   note: "免费" },
    { model: "gpt-5.6-terra",   route: "glm-4.5-air", cost: "¥0",   note: "免费" },
    { model: "gpt-5.6-luna",    route: "glm-4-flash", cost: "¥0",   note: "免费" },
    { model: "gpt-5.5",         route: "glm-4-flash", cost: "¥0",   note: "免费" },
    { model: "gpt-5.4",         route: "glm-4.5-air", cost: "¥0",   note: "免费" },
    { model: "deepseek-v4-flash",route: "直连",       cost: "¥0.20", note: "未命中" },
    { model: "deepseek-v4-flash",route: "直连",       cost: "¥0.05", note: "缓存命中" },
    { model: "deepseek-v4-flash",route: "直连",       cost: "¥0.60", note: "输出" },
  ];

  // ── 样式 ──
  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = [
      "#" + ROOT_ID + " {",
      "  all: initial;",
      "  position: fixed; bottom: 60px; right: 12px; z-index: 2147483647;",
      "  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;",
      "  font-size: 11px; line-height: 1.4;",
      "  color: #e0e0e0;",
      "}",
      "#" + ROOT_ID + " .slp-panel {",
      "  background: #1a1a2e; border: 1px solid rgba(255,255,255,0.08);",
      "  border-radius: 10px; padding: 10px 12px;",
      "  width: 280px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);",
      "  backdrop-filter: blur(8px);",
      "}",
      "#" + ROOT_ID + " .slp-header {",
      "  display: flex; justify-content: space-between; align-items: center;",
      "  margin-bottom: 8px; padding-bottom: 6px;",
      "  border-bottom: 1px solid rgba(255,255,255,0.06);",
      "}",
      "#" + ROOT_ID + " .slp-title {",
      "  font-size: 12px; font-weight: 600; color: #e0a050;",
      "}",
      "#" + ROOT_ID + " .slp-close {",
      "  background: none; border: none; color: rgba(255,255,255,0.3);",
      "  cursor: pointer; font-size: 14px; padding: 0 2px;",
      "}",
      "#" + ROOT_ID + " .slp-close:hover { color: #ff6b6b; }",
      "#" + ROOT_ID + " .slp-section { margin-bottom: 6px; }",
      "#" + ROOT_ID + " .slp-section:last-child { margin-bottom: 0; }",
      "#" + ROOT_ID + " .slp-section-title {",
      "  font-size: 10px; color: rgba(255,255,255,0.35);",
      "  text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;",
      "}",
      "#" + ROOT_ID + " .slp-row {",
      "  display: flex; justify-content: space-between; align-items: center;",
      "  padding: 2px 0; font-size: 11px;",
      "}",
      "#" + ROOT_ID + " .slp-label { color: rgba(255,255,255,0.55); }",
      "#" + ROOT_ID + " .slp-free { color: #4ade80; font-weight: 500; }",
      "#" + ROOT_ID + " .slp-paid { color: #fb923c; }",
      "#" + ROOT_ID + " .slp-cache { color: #60a5fa; font-size: 10px; }",
      "#" + ROOT_ID + " .slp-tag {",
      "  display: inline-block; padding: 0 6px; border-radius: 6px;",
      "  font-size: 9px; margin-left: 4px;",
      "}",
      "#" + ROOT_ID + " .slp-tag-green { background: rgba(74,222,128,0.12); color: #4ade80; }",
      "#" + ROOT_ID + " .slp-tag-orange { background: rgba(251,146,60,0.12); color: #fb923c; }",
      "#" + ROOT_ID + " .slp-tag-blue { background: rgba(96,165,250,0.12); color: #60a5fa; }",
      "#" + ROOT_ID + " .slp-route {",
      "  display: flex; align-items: center; gap: 6px; padding: 3px 0;",
      "}",
      "#" + ROOT_ID + " .slp-dot {",
      "  width: 6px; height: 6px; border-radius: 50%; display: inline-block;",
      "}",
      "#" + ROOT_ID + " .slp-dot-green { background: #4ade80; }",
      "#" + ROOT_ID + " .slp-dot-orange { background: #fb923c; }",
      "#" + ROOT_ID + " .slp-footer {",
      "  margin-top: 6px; padding-top: 6px;",
      "  border-top: 1px solid rgba(255,255,255,0.06);",
      "  text-align: center; font-size: 9px; color: rgba(255,255,255,0.2);",
      "}",
    ].join("\n");
    document.head.appendChild(s);
  }

  // ── 渲染面板 ──
  function render() {
    if (document.getElementById(ROOT_ID)) return;

    var root = document.createElement("div");
    root.id = ROOT_ID;

    root.innerHTML = [
      '<div class="slp-panel">',
      '  <div class="slp-header">',
      '    <span class="slp-title">⚡ 省流助手</span>',
      '    <button class="slp-close" onclick="this.parentElement.parentElement.parentElement.remove()">✕</button>',
      '  </div>',

      '  <div class="slp-section">',
      '    <div class="slp-section-title">免费模型</div>',
      '    <div class="slp-row"><span class="slp-label">gpt-5.6-sol → glm-4.5-air</span><span class="slp-free">¥0</span></div>',
      '    <div class="slp-row"><span class="slp-label">gpt-5.6-luna → glm-4-flash</span><span class="slp-free">¥0</span></div>',
      '    <div class="slp-row"><span class="slp-label">glm-4-flash / glm-4.5-air</span><span class="slp-free">¥0</span></div>',
      '  </div>',

      '  <div class="slp-section">',
      '    <div class="slp-section-title">DeepSeek 付费</div>',
      '    <div class="slp-row"><span class="slp-label">未命中</span><span class="slp-paid">¥0.20/1M</span></div>',
      '    <div class="slp-row"><span class="slp-label">缓存命中</span><span class="slp-cache">¥0.05/1M</span></div>',
      '    <div class="slp-row"><span class="slp-label">输出</span><span class="slp-paid">¥0.60/1M</span></div>',
      '  </div>',

      '  <div class="slp-section">',
      '    <div class="slp-section-title">路由</div>',
      '    <div class="slp-route"><span class="slp-dot slp-dot-green"></span><span class="slp-label">日常对话：GLM 免费</span></div>',
      '    <div class="slp-route"><span class="slp-dot slp-dot-orange"></span><span class="slp-label">复杂任务：DeepSeek 直连</span></div>',
      '  </div>',

      '  <div class="slp-footer">省流助手 v3.0 · 点击 ✕ 关闭</div>',
      '</div>',
    ].join("");

    document.body.appendChild(root);
  }

  // ── 启动 ──
  function start() {
    addStyle();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
