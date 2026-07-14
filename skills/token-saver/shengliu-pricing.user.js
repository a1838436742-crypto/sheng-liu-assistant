// ==UserScript==
// @name         省流助手 v3.0 — 计价小窗
// @namespace    sheng-liu-tie-lv
// @version      1.0.0
// @description  浮动小窗显示当前计费规则：GLM免费/DeepSeek ¥0.20-0.60
// @match        app://-/*
// @run-at       document-start
// ==/UserScript==

(function() {
  try {
    var KEY = "__slpInstalled";
    if (window[KEY]) return;
    window[KEY] = true;

    var ROOT_ID = "slp-root";
    var STYLE_ID = "slp-style";

    function addStyle() {
      if (document.getElementById(STYLE_ID)) return;
      var s = document.createElement("style");
      s.id = STYLE_ID;
      s.textContent = [
        "#" + ROOT_ID + " {",
        "  all: initial; display: block !important;",
        "  position: fixed !important; bottom: 60px !important; right: 12px !important;",
        "  z-index: 2147483647 !important;",
        "  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;",
        "  font-size: 11px !important; line-height: 1.4 !important;",
        "  color: #e0e0e0 !important;",
        "}",
        "#" + ROOT_ID + " .slp-box {",
        "  background: #1a1a2e; border: 1px solid rgba(255,255,255,0.08);",
        "  border-radius: 10px; padding: 10px 12px; width: 270px;",
        "  box-shadow: 0 8px 32px rgba(0,0,0,0.4);",
        "}",
        "#" + ROOT_ID + " .slp-hdr {",
        "  display: flex; justify-content: space-between; align-items: center;",
        "  margin-bottom: 6px; padding-bottom: 5px;",
        "  border-bottom: 1px solid rgba(255,255,255,0.06);",
        "}",
        "#" + ROOT_ID + " .slp-title { font-size: 12px; font-weight: 600; color: #e0a050; }",
        "#" + ROOT_ID + " .slp-x {",
        "  background: none; border: none; color: rgba(255,255,255,0.3);",
        "  cursor: pointer; font-size: 14px; padding: 0 4px; line-height: 1;",
        "}",
        "#" + ROOT_ID + " .slp-x:hover { color: #ff6b6b; }",
        "#" + ROOT_ID + " .slp-sec { margin-bottom: 5px; }",
        "#" + ROOT_ID + " .slp-sec-lbl {",
        "  font-size: 10px; color: rgba(255,255,255,0.35);",
        "  text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;",
        "}",
        "#" + ROOT_ID + " .slp-row {",
        "  display: flex; justify-content: space-between; align-items: center;",
        "  padding: 2px 0; font-size: 11px;",
        "}",
        "#" + ROOT_ID + " .slp-lbl { color: rgba(255,255,255,0.55); }",
        "#" + ROOT_ID + " .slp-grn { color: #4ade80; font-weight: 500; }",
        "#" + ROOT_ID + " .slp-org { color: #fb923c; }",
        "#" + ROOT_ID + " .slp-blu { color: #60a5fa; font-size: 10px; }",
        "#" + ROOT_ID + " .slp-rt { display: flex; align-items: center; gap: 5px; padding: 2px 0; }",
        "#" + ROOT_ID + " .slp-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }",
        "#" + ROOT_ID + " .slp-dg { background: #4ade80; }",
        "#" + ROOT_ID + " .slp-do { background: #fb923c; }",
        "#" + ROOT_ID + " .slp-ft {",
        "  margin-top: 5px; padding-top: 5px; text-align: center;",
        "  border-top: 1px solid rgba(255,255,255,0.06);",
        "  font-size: 9px; color: rgba(255,255,255,0.2);",
        "}",
      ].join("\n");
      document.head.appendChild(s);
    }

    function render() {
      if (document.getElementById(ROOT_ID)) return;
      var r = document.createElement("div");
      r.id = ROOT_ID;
      r.innerHTML = [
        '<div class="slp-box">',
        '  <div class="slp-hdr">',
        '    <span class="slp-title">\u26a1 \u7701\u6d41\u52a9\u624b</span>',
        '    <button class="slp-x" id="slp-close-btn">\u2715</button>',
        '  </div>',
        '  <div class="slp-sec">',
        '    <div class="slp-sec-lbl">\u514d\u8d39\u6a21\u578b</div>',
        '    <div class="slp-row"><span class="slp-lbl">gpt-5.6-sol/terra \u2192 glm-4.5-air</span><span class="slp-grn">\u00a50</span></div>',
        '    <div class="slp-row"><span class="slp-lbl">gpt-5.6-luna/5.5 \u2192 glm-4-flash</span><span class="slp-grn">\u00a50</span></div>',
        '    <div class="slp-row"><span class="slp-lbl">glm-4-flash / 4.5-air / 4v</span><span class="slp-grn">\u00a50</span></div>',
        '  </div>',
        '  <div class="slp-sec">',
        '    <div class="slp-sec-lbl">DeepSeek \u4ed8\u8d39</div>',
        '    <div class="slp-row"><span class="slp-lbl">\u672a\u547d\u4e2d</span><span class="slp-org">\u00a50.20/1M</span></div>',
        '    <div class="slp-row"><span class="slp-lbl">\u7f13\u5b58\u547d\u4e2d</span><span class="slp-blu">\u00a50.05/1M</span></div>',
        '    <div class="slp-row"><span class="slp-lbl">\u8f93\u51fa</span><span class="slp-org">\u00a50.60/1M</span></div>',
        '  </div>',
        '  <div class="slp-sec">',
        '    <div class="slp-sec-lbl">\u8def\u7531</div>',
        '    <div class="slp-rt"><span class="slp-dot slp-dg"></span><span class="slp-lbl">\u65e5\u5e38\u5bf9\u8bdd\uff1aGLM \u514d\u8d39</span></div>',
        '    <div class="slp-rt"><span class="slp-dot slp-do"></span><span class="slp-lbl">\u590d\u6742\u4efb\u52a1\uff1aDeepSeek \u76f4\u8fde</span></div>',
        '  </div>',
        '  <div class="slp-ft">\u7701\u6d41\u52a9\u624b v3.0</div>',
        '</div>',
      ].join("");
      document.body.appendChild(r);

      setTimeout(function() {
        var btn = document.getElementById("slp-close-btn");
        if (btn) btn.addEventListener("click", function() {
          var el = document.getElementById(ROOT_ID);
          if (el) el.remove();
        });
      }, 0);
    }

    function start() {
      if (document.body) {
        addStyle();
        render();
      } else {
        document.addEventListener("DOMContentLoaded", function() {
          addStyle();
          render();
        }, { once: true });
      }
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
  } catch(e) {
    console.error("[slp] init error:", e);
  }
})();
