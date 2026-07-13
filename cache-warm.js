// Cache Warm - \u7f13\u5b58\u9884\u70ed\u811a\u672c\nconst api = require("./api-client.js");

async function warm() {
  console.log("[cache-warm] \u5f00\u59cb\u9884\u70ed\u7f13\u5b58...");
  
  // \u9884\u70ed\u5173\u952e\u63d0\u793a\u8bcd\n  var prompts = [
    "\u4f60\u597d", "\u4eca\u5929\u5929\u6c14\u600e\u4e48\u6837",
    "\u76d1\u63a7\u72b6\u6001", "\u5ba1\u8ba1\u8d39\u7528",
    "\u5e2e\u6211\u67e5\u770b\u6700\u65b0\u6d88\u606f"
  ];
  
  for (var p of prompts) {
    try {
      await api.callDeepSeek([{ role: "user", content: p }], { max_tokens: 10 });
      console.log("  [OK] " + p);
    } catch(e) {
      console.log("  [ERR] " + p + ": " + e.message);
    }
  }
  console.log("[cache-warm] \u9884\u70ed\u5b8c\u6210");
}

if (require.main === module) warm();
module.exports = { warm };
