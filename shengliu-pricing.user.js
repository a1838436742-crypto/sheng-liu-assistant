// ==UserScript==
// @name         \u7701\u6d41\u52a9\u624b v3.0 - \u8d39\u7528\u76d1\u63a7\u9762\u677f
// @namespace    shengliu
// @version      1.0.0
// @description  \u7701\u6d41\u52a9\u624b\u8d39\u7528\u76d1\u63a7\u6d6e\u52a8\u7a97\u53e3
// @match        app://-/*
// @run-at       document-start
// ==/UserScript==

(function() {
  "use strict";
  
  var panel = document.createElement("div");
  panel.id = "shengliu-panel";
  panel.innerHTML = "<div style=\"position:fixed;top:4px;right:4px;z-index:99999;background:#1a1a2e;color:#eee;padding:6px 10px;border-radius:6px;font-size:12px;font-family:sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.3);\">\n  \u7701\u6d41\u52a9\u624b v3.0\n  <br/><span id=\"sl-status\">\u52a0\u8f7d\u4e2d...</span>\n</div>";
  document.documentElement.appendChild(panel);
  
  var statusEl = document.getElementById("sl-status");
  if (statusEl) statusEl.textContent = "\u5df2\u542f\u7528";
})();
