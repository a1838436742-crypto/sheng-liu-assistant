# Sheng Liu Tie Lv v3.0 (Home Edition)

## 铁律0: 首次部署引导
- **省流助手路径**: 默认与 AGENTS.md 同目录
- **用户需提供**:
  - DeepSeek API Key（`config.json` 的 `api_key`）
  - 智谱 GLM API Key（`config.json` 的 `free_api_key`）
- **自动安装依赖**:
  ```powershell
  pip install requests websockets openai-whisper
  ```
- **检查 Node.js**，没有则提示用户安装
- **检查 ffmpeg** → 优先用剪映自带路径，没有则提示下载
- **启动 GLM 代理**: `node glm-proxy.js`（监听 57330）
- **检查 config.toml**: 确保 `base_url` 指向 `http://127.0.0.1:57322/v1`
- **安装 douyin-transcriber skill**: 复制 `scripts/douyin_transcriber.py` 到 `~/.codex/skills/douyin-transcriber/`
- **验证**: 调一次 GLM-4-Flash 确认免费通道，调一次 DeepSeek 确认付费通道
- 全部完成后输出"部署完成 + 总耗时"

## 铁律7: 绝不碰用户浏览器
- 禁止 taskkill /F /IM chrome.exe
- 启动浏览器用独立 --user-data-dir
- 只关闭自己启动的实例，用完即焚

## 铁律14: DeepSeek 只能看文字
- 不支持图片/音频/视频/文件直接输入
- 所有媒体先本地转文本再送 API

## 铁律15: GLM 免费模型额度
- GLM-4-Flash: 永久免费不限量（日常聊天首选，快）
- GLM-4.7: 约500万赠送tokens（有推理能力）
- GLM-4.5-Air: 约1200万赠送tokens
- GLM-4.6V: 约600万赠送tokens（视觉模型）
- 全部有效期至2026-10-12

## 铁律16: 省流策略——两层架构
- **第1层 - Agent自身判断**：走 config DeepSeek（57322），但缓存命中率~99%，实际费用几乎为0
- **第2层 - 聊天回复文字**：JS kernel 调 GLM-4-Flash 免费 API
- **结果**：DeepSeek 只跑"调度"，GLM 跑"内容"

## 铁律17: 永不切换，智能分流
- **config.toml 永远指向 127.0.0.1:57322（DeepSeek 付费通道）**
- **永不执行 switch-*.ps1**，永不重启 Codex
- **每条聊天回复流程**：
  1. 用户发消息
  2. JS kernel → GLM-4-Flash 免费 API（快，1-7s）
  3. GLM 成功 → 直接输出回复 ✅ ¥0
  4. GLM 超时/失败 → **通知用户"GLM超时，切 DeepSeek"** → 切 DeepSeek
- **任务分流**：
  - 聊天/问答/文案 → `glm-4-flash`（永久免费不限量，不消耗额度）
  - 需要推理能力的任务 → `glm-4.7`（500万额度）
  - 视频帧分析 → `glm-4.6v`（600万额度）
  - 其他需要 GLM 的任务 → `glm-4.5-air`（1200万额度）
- **GLM 额度用尽降级链**（逐级尝试，每次切换通知用户）：
  1. `glm-4.7` 用完 → 通知"GLM-4.7 额度耗尽，切换至 GLM-4.6V"
  2. `glm-4.6v` 用完 → 通知"GLM-4.6V 额度耗尽，切换至 GLM-4.5-Air"
  3. `glm-4.5-air` 用完 → 通知"GLM 赠送额度全部耗尽，降级至 DeepSeek 付费通道"
  4. DeepSeek 也失败 → 通知"所有通道不可用"
- **GLM 免费 API 调用模板**：
  ```javascript
  var https = await import("https");
  var fs = await import("fs");
  var cfg = JSON.parse(fs.readFileSync("config.json","utf-8").replace(/^\uFEFF/,""));
  var body = JSON.stringify({model:"glm-4-flash",messages:[{role:"user",content:"消息内容"}],max_tokens:1500});
  var r = await new Promise(function(ok,fail){var req=https.request({hostname:"open.bigmodel.cn",port:443,path:"/api/paas/v4/chat/completions",method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+cfg.free_api_key,"Content-Length":Buffer.byteLength(body)},timeout:30000},function(res){var d="";res.on("data",function(c){d+=c});res.on("end",function(){try{ok(JSON.parse(d))}catch(e){ok({error:e.message})}})});req.on("error",function(e){ok({error:e.message})});req.on("timeout",function(){req.destroy();ok({error:"timeout"})});req.write(body);req.end()});
  nodeRepl.write(r.choices?.[0]?.message?.content || "");
  ```

## 铁律18: 抖音视频转文字（douyin-transcriber）
- **技能位置**: `~/.codex/skills/douyin-transcriber/`
- **主脚本**: `scripts/douyin_transcriber.py`
- **用法**: `python douyin_transcriber.py "<分享链接>"`
- **全链路**: Chrome headless 拿 cookies → JS fetch API → Python requests 下视频 → ffmpeg → Whisper
- **输出**: 桌面 `douyin_transcript.txt`（默认 tiny 模型 ~40s）
- **注意**: 需要 ffmpeg；视频/音频自动清理
