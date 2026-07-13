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

## Rule 1: Input Preprocess
- Never put raw HTML into API
- Use link-video-saver.js to extract text locally first

## Rule 2: Output
- Append: only return code, no markdown, no explanation
- max_tokens: userscript=1200, bugfix=500, crawler=2000, default=1500

## Rule 3: Cache
- Use api-optimizer.js v3.0 unified prefix

## Rule 4: Off-peak
- Batch tasks at 18:00-09:00 or 12:00-14:00

## Rule 5: Template
- Check templates/ before generating

## Link/Video
- Use link-video-saver.js first, 7-day cache

## Context Compression
- Dont repeat done work, prioritize latest question

## 铁律7: 绝不碰用户浏览器
- 禁止 taskkill /F /IM chrome.exe
- 启动浏览器用独立 --user-data-dir
- 只关闭自己启动的实例，用完即焚

## 铁律8: 用完即焚
- 启动的进程/浏览器跟踪PID，结束后关闭

## 铁律9: DeepSeek 费用页面
- 访问 platform.deepseek.com/usage 时自动用 config.json 账号密码登录
- 登录流程: sign_in → 密码登录 → 填账号密码 → 跳转 usage

## 铁律10: 全量审计
- node full-audit.js → 自动登录 DeepSeek 平台抓累计 → 对比快照
- 平台快照 100% 准确，包含所有并行任务总和

## 铁律11: 审计数据纯净
- 用户请求 _origin: "user"，系统调用 _origin: "system"
- full-audit.js 分离"实际任务"和"系统测试"

## 铁律12: 模型与 Key 配置
- 当前主模型: deepseek-v4-flash（备用）
- Codex++ 代理使用 Key: sk-4af3a...（平台名称"open ai"）

## 铁律13: API Key 费用拆分
- node key-split-report.js → 按 Key 拆分的详细费用

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

## 铁律19: 机器身份识别 + Git 双分支同步
### 身份识别（自动，无需人工判断）
- 每台机器首次部署时自动创建 machine.json（已加入 .gitignore，不同步）
- 内容格式：`{"guid": "本机 MachineGuid", "role": "company/home"}`
- **AI 每次运行先读 machine.json 的 role 字段**：
  - role = company → 公司机，默认分支 company
  - role = home → 家里机（本机），默认分支 main
- **不在自己分支时** → git checkout 切回去再操作
- 如果没有 machine.json → 触发 铁律0 引导创建

### 同步规则
- **同步公司内容** → 用户说"同步公司"时执行：
  1. git fetch origin company 拉取公司最新版
  2. 比对 main vs origin/company，列出差异
  3. 合并公司需要的改动到 main
- **同步家里内容** → 公司 AI 看到"同步家里"时：
  1. git fetch origin main
  2. 比对 company vs origin/main
  3. 合并家里需要的改动到 company

### 注意事项
- AGENTS.md merge 时不要覆盖对方的版本（各自维护）
- config.json、machine.json 都在 .gitignore，各自配置
- 铁律更新后 git push，对方 git pull 后自动同步
