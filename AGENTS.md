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

## 铁律20: Cookie 复用与网页爬取规范
### 核心原则
- **Cookie 必须用户手动导出**，AI 绝不自动提取浏览器 cookie（铁律7 边界）
- 支持三种 cookie 格式：Netscape cookies.txt / JSON Array / 原始字符串
- Cookie 文件放项目目录，通过 `--cookies` 参数传入

### 用户导出流程（AI 指导用户操作）
1. 装插件：Chrome 装 `Get cookies.txt` 或 Firefox 装 `cookies.txt`
2. 在目标网站**已登录**状态下点插件 → Export → 保存为 cookies.txt
3. 放项目目录，如 `C:\Users\18384\Documents\New project\cookies.txt`

### AI 使用规范
```powershell
# 带 cookie 爬取需要登录的页面
node scrapling_fetch.js --url "https://example.com/dashboard" --cookies cookies.txt -o page.md

# B站大会员视频下载（解锁1080P高码率+字幕）
yt-dlp --cookies cookies.txt -f "bestvideo+bestaudio" "https://www.bilibili.com/video/BVxxx"
```

### B站画质等级（来自 bilibili-helper 插件逆向）
| qn 值 | 画质 | 是否需要大会员 |
|-------|------|:--------:|
| 16 | 360P 流畅 | 否 |
| 32 | 480P 标清 | 否 |
| 64 | 720P 准高清 | 否 |
| 80 | 1080P 高清 | 否 |
| 112 | 1080P 高码率 | **是** |
| 120 | 4K 超高清 | **是** |
| 125 | HDR 真彩 | **是** |

B站 API: `//api.bilibili.com/x/player/wbi/playurl?qn=80&fnval=4048&fourk=1`
- `fnval=4048` = DASH 格式（音视频分离流）
- `wbi` 路径 = WBI 签名（yt-dlp 自动处理）

### 扒网页最佳实践路径
| 场景 | 命令 | 说明 |
|------|------|------|
| 静态页面 | `--mode get` | 最快，无浏览器开销 |
| JS动态页 | `--mode fetch` | 浏览器渲染 |
| Cloudflare 反爬 | `--mode stealthy-fetch --solve-cf` | 隐身浏览器 |
| 需要登录 | `--cookies cookies.txt` | 配合上面任一模式 |
| 精确提取 | `--selector "article.main"` | CSS 选择器 |
| AI 总结 | `--glm "提取产品名和价格"` | GLM-4-Flash 免费通道 |

### 铁律7 补充说明
- ❌ 禁止 `taskkill /F /IM chrome.exe`
- ❌ 禁止自动读取 Chrome 默认 profile 的 cookie
- ❌ 禁止用 Playwright 访问用户浏览器数据目录
- ✅ **允许** 用户手动导出 cookies.txt 后通过 `--cookies` 传入
- ✅ 允许用独立 `--user-data-dir`（Scrapling 内部管理）
- ✅ 允许用 yt-dlp 的 `--cookies` 参数（文件由用户提供）

## 铁律21: 通用视频下载规范（多平台）
### 支持平台
yt-dlp 原生支持 1800+ 网站，常见包括：
- **B站** bilibili.com — DASH 格式，需 ffmpeg 合并
- **YouTube** youtube.com — DASH 格式，需 ffmpeg 合并
- **抖音** douyin.com — 可直接下载合并好的 mp4
- **Twitter/X** twitter.com — 视频直链
- **Instagram** instagram.com — 需登录 cookie
- **小红书** xiaohongshu.com — 视频直链
- **微博** weibo.com — 视频直链
- **TikTok** tiktok.com — 需 cookie
- **Facebook** facebook.com — 视频直链

### 通用工作流
1. yt-dlp --print title --print formats "URL"  ← 查可用画质
2. yt-dlp --print filename "URL"               ← 提取直链
3. Python requests (Referer+UA) 下载              ← 防CDN超时
4. ffmpeg 合并音视频（DASH格式需要）              ← 合并

### 优选工具链（按优先级）
1. **yt-dlp**（首选）→ 自动处理 WBI 签名、画质选择、CDN 容错
2. **Python requests + 直链** → 当 yt-dlp CDN 超时时，从 yt-dlp 提取直链后用 requests 下
3. **you-get** → 备选

### DASH 音视频分离处理
常见视频平台（B站/YouTube 等）采用 DASH 格式，音视频分离为独立流，需下载后合并：
```powershell
# 提取直链
yt-dlp --print filename --print formats "URL"

# 下载音视频分离流
# 视频: format_id 含 video only（无 acodec）
# 音频: format_id 含 audio only（无 vcodec）

# ffmpeg 合并
ffmpeg -i video.mp4 -i audio.m4a -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 -shortest output.mp4
```

### CDN 超时处理（通用）
- 国内 CDN（B站 upos-sz-mirror、抖音、微博等）经常最后一块超时
- 解决方案：用 Python requests + 正确 Referer/UA 头直接下载，不走 yt-dlp 的下载器
- API 返回的 backup_url 备用 CDN 节点可用于容错
- 需要登录的平台：--cookies cookies.txt 带上用户导出的 cookie
- Referer 设置：B站=https://www.bilibili.com/ YouTube=https://www.youtube.com/ 抖音=https://www.douyin.com/

## scrapling-crawler Skill
- **位置**: `~/.codex/skills/scrapling-crawler/`
- **主脚本**: `scripts/scrapling_fetch.js`
- **三层降级**: get → fetch → stealthy-fetch
- **多平台视频下载**: B站 / 抖音 / YouTube / Twitter / Instagram / 小红书 / 微博 / TikTok（yt-dlp 驱动）
- **音频转录**: 支持 Whisper 转文字（需安装 openai-whisper）
- **Cookie 复用**: `--cookies cookies.txt` 爬需要登录的页面
- **依赖**: 自动创建 venv，自动装 scrapling[all] + yt-dlp
- **venv 路径**: `~/.codex/skills/scrapling-crawler/.venv/`
- **ffmpeg 路径**: Codex 内置 (`C:\Users\18384\AppData\Local\Temp\ffmpeg-work-898309298\node_modules\@ffmpeg-installer\win32-x64\ffmpeg.exe`)
