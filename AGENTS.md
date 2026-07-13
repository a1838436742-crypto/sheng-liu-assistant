# Sheng Liu Tie Lv v3.0 (Company Edition)
## 铁律0: 首次部署引导（新电脑用）
- **省流助手路径**: 默认 `C:\Users\%USERNAME%\Documents\省流助手v3.0\`，与 AGENTS.md 同目录
- **用户需提供**:
  - DeepSeek API Key（`config.json` 的 `api_key`）
  - 智谱 GLM API Key（`config.json` 的 `free_api_key`）
  - 智谱账号密码（`config.json` 的 `platform_email`/`platform_password`）
- **自动安装依赖**:
  ```powershell
  pip install requests websockets openai-whisper
  ```
- **检查 Node.js**，没有则提示用户安装
- **检查 ffmpeg** → 优先用剪映自带路径 `C:\Users\%USERNAME%\AppData\Local\JianyingPro\Apps\*\ffmpeg.exe`，没有则提示下载
- **启动 GLM 代理**: `node glm-proxy.js`（监听 57330）
- **安装 douyin-transcriber skill**: 复制 `scripts/douyin_transcriber.py` 到 `~/.codex/skills/douyin-transcriber/scripts/`
- **config.toml**: 确认 `base_url` 指向 `http://127.0.0.1:57322/v1`（DeepSeek 通道）
- **验证**: 调用一次 GLM-4-Flash 确认免费通道通，调一次 DeepSeek 确认付费通道通
- 全部完成后说"部署完成"，告诉用户总耗时
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
- 启动浏览器用 Playwright 独立 --user-data-dir
- 只关闭自己启动的实例

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
- 公司 Key: sk-f8964...61b0（剪辑工作用）
- 本地 Key: sk-4af3a...（Codex++ 代理用，平台名称"open ai"）

## 铁律13: API Key 费用拆分
- node key-split-report.js → 按 Key 拆分的详细费用
- 公司 Key 近30天 ¥4.46，缓存命中率 96.6%

## 铁律14: DeepSeek 只能看文字
- 不支持图片/音频/视频/文件直接输入
- 所有媒体先本地转文本再送 API

## 铁律15: GLM 免费模型额度
- GLM-4-Flash: 永久免费不限量（日常聊天首选，快）
- GLM-4.7: 约500万赠送tokens（有推理能力，但慢20-60s）
- GLM-4.5-Air: 约1200万赠送tokens
- GLM-4.6V: 约600万赠送tokens（视觉模型，可处理视频帧）
- 全部有效期至2026-10-12

## 铁律16: 省流策略——两层架构
- **第1层 - Agent自身判断**：走 config DeepSeek（57322），消耗极小
  - 这部分不可避免，因为我的思考过程需要API生成
  - 但缓存命中率99.9%，实际费用几乎为0
- **第2层 - 聊天回复文字**：JS kernel 调 GLM-4-Flash 免费 API
  - 每条回复先走 GLM，失败/超时再切 DeepSeek
  - 不额外通知用户，静默切换
- **结果**：DeepSeek 只跑"调度"，GLM 跑"内容"
- **日常聊天10,000字实测：DeepSeek ¥0，GLM ¥0**

## 铁律17: 永不切换，智能分流（最终版）

### GLM 额度耗尽自动降级链
- **GLM-4-Flash**（永久免费，无限量）→ 日常聊天首选，永远不会用完
- **GLM-4.7**（~500万赠送）→ 用完自动切 GLM-4.6V 或 GLM-4.5-Air
- **GLM-4.6V**（~600万赠送，视觉模型）→ 视觉/视频帧分析用
- **GLM-4.5-Air**（~1200万赠送）→ 推理/代码的免费备选
- **全部赠送额度耗尽** → 自动降级到 DeepSeek 付费通道（不通知用户，静默切换）
- **config.toml 永远指向 127.0.0.1:57322（DeepSeek 付费通道）**
- **永不执行 switch-glm.ps1 / switch-deepseek.ps1**，永不重启 Codex
- **每条聊天回复的流程**：
  1. 用户发消息
  2. JS kernel → GLM-4-Flash 免费 API（fast，1-7s）
  3. GLM 成功 → 直接输出回复 ✅ ¥0
  4. GLM 超时/失败 → 静默切 DeepSeek（不通知用户）
- **剪辑工作路由**（按任务类型自动分流）：
  - 字幕翻译/文案润色/文本格式化 → `glm-4-flash`（永久免费，快）
  - 视频内容摘要/思路梳理/脚本分析 → `glm-4.7`（推理能力强，走赠送）
  - 视频帧画面分析/截图理解 → `glm-4.6v`（视觉模型，走赠送）
  - 代码生成/工具调用/复杂逻辑/自动化脚本 → **DeepSeek 公司 Key**（稳定可靠）
  - GLM 额度用完或失败 → 自动降级到 DeepSeek
- **公司 Key 费用预估**（含剪辑工作后）：
  - 纯调度: ~¥1-2/月
  - +剪辑辅助（文字类走GLM）: ~¥5-10/月
  - 剪辑中DeepSeek独占部分（代码/工具）: ~¥25-55/月
  - **合计: ¥30-65/月**（对比全走DeepSeek: ¥60-120/月）
- **GLM 免费 API 调用模板**（勿改）：
  ```javascript
  var https = await import("https");
  var fs = await import("fs");
  var cfg = JSON.parse(fs.readFileSync("C:/Users/DEWK/Documents/省流助手v3.0/config.json","utf-8").replace(/^\uFEFF/,""));
  var body = JSON.stringify({model:"glm-4-flash",messages:[{role:"user",content:"消息内容"}],max_tokens:1500});
  var r = await new Promise(function(ok,fail){var req=https.request({hostname:"open.bigmodel.cn",port:443,path:"/api/paas/v4/chat/completions",method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+cfg.free_api_key,"Content-Length":Buffer.byteLength(body)},timeout:30000},function(res){var d="";res.on("data",function(c){d+=c});res.on("end",function(){try{ok(JSON.parse(d))}catch(e){ok({error:e.message})}})});req.on("error",function(e){ok({error:e.message})});req.on("timeout",function(){req.destroy();ok({error:"timeout"})});req.write(body);req.end()});
  nodeRepl.write(r.choices?.[0]?.message?.content || "");
  ```
- **优先顺序**：GLM Flash（¥0）→ GLM 4.7/Air/6V（赠送）→ DeepSeek 公司 Key（付费）
- **关键文件**：
  - `deepseek-direct.js` — DeepSeek 直连模块
  - `glm-proxy.js` — GLM 代理（监听 57330）
  - `config.json` — 含 free_api_key
## 铁律18: 抖音视频转文字（douyin-transcriber skill）
- **技能位置**: `~/.codex/skills/douyin-transcriber/`
- **主脚本**: `scripts/douyin_transcriber.py`
- **用法**: `python douyin_transcriber.py "<分享链接>"`
- **全链路**: Chrome headless 拿 cookies → JS fetch API 取下载地址 → Python requests 下视频 → ffmpeg 提音频 → Whisper 转文字
- **无需用户浏览器**：启动独立 headless Chrome 实例，用完即焚
- **输出**: 桌面 `douyin_transcript.txt`（默认 tiny 模型~40s，base 模型更准但慢）
- **已安装依赖**: requests, websockets, openai-whisper, ffmpeg（剪映自带）
- **注意**: 视频 CDN 用 Python requests + 浏览器 cookies 下载（避开了 CDP base64 瓶颈）
- **默认清理**: 视频/音频临时文件自动删除（`--keep-files` 保留）




## 铁律19: Git 双分支隔离（公司 vs 家里）
### 身份识别（文件头检测）
- **本机是 💼 公司机** → 默认分支 company
- **家里机是 🏠 家里机** → 默认分支 main
- 每次运行先确认当前分支：git branch --show-current
  - 公司机不在 company → 切回 company 再操作
  - 家里机不在 main → 切回 main 再操作

### 分支职责
| 分支 | 谁在用 | 推送方式 |
|------|--------|----------|
| main | 🏠 家里 AI | 家里机直接 push |
| company | 💼 公司 AI（本机） | 本机直接 push |

### 同步规则
- **同步家里内容** → 用户说"同步家里"时执行：
  1. git fetch origin main 拉取家里最新版
  2. 比对 company vs origin/main，列出差异
  3. 合并家里需要的改动到 company
- **同步公司内容** → 家里 AI 看到"同步公司"时：
  1. git fetch origin company
  2. 比对 main vs origin/company
  3. 合并公司需要的改动到 main

### 注意事项
- AGENTS.md 在不同分支内容不同（身份声明不同），**merge 时不要覆盖对方的 AGENTS.md**
- config.json 在 .gitignore 中，每台机器各自配置，不会冲突
- 铁律更新后记得 git push，对方 git pull 后自动同步
