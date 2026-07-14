---
name: token-saver
description: >-
  Token saving, model routing, and cost optimization framework (省流助手 v3.0).
  Routes simple tasks to free GLM API, complex tasks to DeepSeek paid.
  Use ALWAYS when model routing decisions are needed.
---

# 省流助手 v3.0 — 模型路由与成本优化

作者：省流助手 v3.0

## 核心原则

当前对话走 Codex 配置的付费模型，但遇到简单任务时通过 Node.js 调 GLM 免费 API，省 token 省钱。

## 路由规则

| 任务类型 | 处理方式 | 费用 |
|---------|---------|------|
| 普通对话/复杂逻辑 | 直接回复（当前付费模型） | 已预付 |
| 翻译/提取/格式化/摘要 | JS kernel 调 GLM 免费 API | **¥0** |
| HTML 清洗/链接提取 | link-video-saver.js 本地处理 | **0 token** |
| 代码/爬虫/修 Bug | 直接回复（当前付费模型） | 已预付 |

## GLM API 调用模板

`javascript
var https = await import("https");
var fs = await import("fs");
var cfg = JSON.parse(fs.readFileSync("config.json","utf-8").replace(/^\uFEFF/,""));
var body = JSON.stringify({
  model: "glm-4-flash",
  messages: [{role:"user", content:"你的问题"}],
  max_tokens: 1500
});
var r = await new Promise(function(ok,fail){
  var req=https.request({
    hostname:"open.bigmodel.cn", port:443,
    path:"/api/paas/v4/chat/completions", method:"POST",
    headers: {
      "Content-Type":"application/json",
      "Authorization":"Bearer "+cfg.free_api_key,
      "Content-Length":Buffer.byteLength(body)
    }, timeout:30000
  }, function(res){
    var d=""; res.on("data",function(c){d+=c});
    res.on("end",function(){
      try{ok(JSON.parse(d))}catch(e){ok({error:e.message})}
    });
  });
  req.on("error",function(e){ok({error:e.message})});
  req.on("timeout",function(){req.destroy();ok({error:"timeout"})});
  req.write(body); req.end();
});
nodeRepl.write(r.choices?.[0]?.message?.content || "");
`

## 成本节省原则

1. 本地预处理优先 — HTML/链接/视频用自有工具处理
2. 缓存优先 — 同 URL 7 天缓存
3. 输出精简 — 只返回必要的代码/内容
4. max_tokens 控制 — 脚本 1200 / 修 Bug 500 / 爬虫 2000 / 默认 1500
5. 模板优先 — 生成前检查 templates/ 目录

## 项目位置

C:\Users\DEWK\Documents\省流助手v3.0

## GLM 模型额度

| 模型 | 额度 | 用途 |
|------|------|------|
| glm-4-flash | 永久免费无限 | 日常聊天/翻译/提取 |
| glm-4.7 | ~500万赠送 | 推理任务 |
| glm-4.6v | ~600万赠送 | 视觉分析 |
| glm-4.5-air | ~1200万赠送 | 代码/推理备选 |

有效期至 2026-10-12。用完自动降级链：flash → 4.7 → 4.6v → 4.5-air → DeepSeek
