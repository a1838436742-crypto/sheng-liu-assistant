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







## 铁律19: 机器身份识别 + Git 双分支同步
### 身份识别（自动，无需人工判断）
- 每台机器首次部署时自动创建 machine.json（已加入 .gitignore，不同步）
- 内容格式：{"guid": "本机 MachineGuid", "role": "company/home"}
- **AI 每次运行先读 machine.json 的 role 字段**：
  - role = company → 💼 公司机，默认分支 company
  - role = home → 🏠 家里机，默认分支 main
- **不在自己分支时** → git checkout 切回去再操作
- 如果没有 machine.json → 触发 铁律0 引导创建

### 分支职责
| 分支 | 谁在用 | 推送方式 |
|------|--------|----------|
| main | 🏠 role=home 的机器 | 家里机直接 push |
| company | 💼 role=company 的机器（本机） | 本机直接 push |

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


## 铁律31: 语音精剪经验总结 (2026-07-15 更新)
- **核心原则：物理切割 > 滤波器/门控**
  - `noisereduce`（Python）会吞字（"的"被吃掉），禁止使用
  - `agate` 门控会残留底噪（类似电流声），禁止使用  
  - `highpass`/`lowpass` 滤波会引入处理伪影，禁止使用
  - 唯一正确方法：`silencedetect` 检测 → `atrim` 物理切除
- **切割流程**：
  1. Whisper 转写原始音频，与 Excel 脚本逐镜对照
  2. 以脚本镜号为基准定义 keep segments（大段 = 隐藏 stutter）
  3. 多段合并前必须确认衔接处没有卡壳/重复
  4. 镜头切换处留 0.05-0.08s 间隔（`aevalsrc=0` 插入静音）
  5. 拼接后用 `silencedetect=noise=-30dB:d=0.04` 检测气口
  6. 物理切除气口（体积 = 0，非衰减），切除点加 0.002s 缓冲防爆音
  7. 编码 AAC 192k，不重采样（保持 44100Hz）
- **阈值参考**：
  - -26dB：激进（容易切到字头），仅用于背景很干净的录音
  - -28dB：适中（默认推荐），大部分录音适用
  - -30dB：保守（只抓深呼吸），用于音量不稳定的录音
- **时长预期**：
  - 原始 169s → 机械粗剪 ~150s → 精剪 ~141s → 手动精修 ~133s
  - 自动工具可达 90%，最后 10% 需要手动调整
- **避坑**：
  - 不要用 `volume=enable` 静音气口（产生硬切爆音）
  - 不要一次性合并大段（>15s），内部 stutter 会被隐藏
  - 气口检测的 `d`（最小持续时间）设 0.04 避免切到词内微顿
  - 转写用 Whisper tiny 只是参考，实际切割点需用频谱/波形验证

## 铁律32: GitHub 仓库配置与多机同步 (2026-07-15 新增)
- **仓库地址**：
  - SSH: `git@github.com:a1838436742-crypto/sheng-liu-assistant.git`
  - HTTPS: `https://github.com/a1838436742-crypto/sheng-liu-assistant.git`
- **本地路径**：`C:\Users\DEWK\Documents\省流助手v3.0`
- **角色分支策略**（基于 `machine.json` 中的 `role`）：
  - `"role": "company"` → 操作 `company` 分支
  - `"role": "home"` → 操作 `home` 分支
  - `"role": "family"` → 操作 `family` 分支
- **日常同步流程**：
  - 修改文件后：`git add → git commit → git push origin <当前分支>`
  - 同步对方更新：`git pull origin <当前分支>`
  - 首次克隆：`git clone git@github.com:a1838436742-crypto/sheng-liu-assistant.git`
- **常见问题**：
  - "没有找到已有的 Git 仓库" → 前往 `C:\Users\DEWK\Documents\省流助手v3.0` 目录操作
  - HTTPS 在公司网络被墙 → 改用 SSH（已在公司机配置好密钥）
  - 家里网络 SSH 不通 → 改用 HTTPS 或 `gh` CLI 认证
- **跨分支合并**：
  - 需要同步另一台机器的修改时：`git pull origin <对方分支>`
  - 或者直接在 GitHub 上开 PR 合并

## 铁律33: 代理断流应急处理 (2026-07-15 新增)
- **症状**: `stream disconnected before completion: error sending request for url (http://127.0.0.1:57322/v1/responses)`
- **原因**: GLM 代理/图片过滤代理到上游 API 的连接不稳定或崩溃
- **应急方案**:
  - 优先运行 `.\switch-direct.ps1`（切直连 57324，重启 Codex 生效）
  - 备选: `.\switch-deepseek.ps1`（走旧链 57322）
## 铁律34: deepseek-direct 直连方案 (2026-07-16 新增)
- **端口**: 57324
- **文件**: `deepseek-direct-server.js`（HTTP 代理服务器，供 config.toml 指向）
- **文件**: `deepseek-direct.js`（JS kernel 模块，供 token-saver 调 DeepSeek API）
- **优势**: 绕过 codex++ 断连问题，内嵌图片过滤
- **切换**:
  - 切直连: `.\switch-direct.ps1` → config.toml 指向 57324
  - 切回旧链: `.\switch-deepseek.ps1` → config.toml 指向 57322
- **config.toml 建议值**: `base_url = "http://127.0.0.1:57324/v1"`
- **新增文件**: `deepseek-direct-server.js`, `switch-direct.ps1`



## 铁律35: 配置恢复三原则 (2026-07-17 新增)
- **保底脚本**: `recover-57321.ps1` → 一键恢复 `base_url = 57321`（codex++），清理冲突代理，启动 codex++
- **备份不能直接覆盖**: 桌面 `config.toml` 备份可能有 `base_url = ""`（空字符串），直接覆盖会导致连不上任何 API
- **恢复流程**: 运行保底脚本 → 重启 Codex → 确认对话正常，不行再手动检查 `config.toml` 的 `base_url` 字段

## 铁律36: 中文路径.bat文件编码规则 (2026-07-17 新增)
- **症状**: `.bat` 文件里的中文路径变成 `????`
- **原因**: 用 UTF-8 写 `.bat` 文件，Windows 启动时会按系统默认编码（GBK）解析，导致中文乱码
- **修复**: 用 PowerShell 的 `Set-Content -Encoding Default` 或记事本的 ANSI 保存
- **检查**: 从 Startup 文件夹读 `.bat` 内容，确认中文显示正常

## 铁律37: 开机自启三件套 (2026-07-17 新增)
- **Startup 文件夹**（本机）有三个自启项：
  - `CodexPlusPlusWatcher.lnk` → codex++（端口 57321，带 provider-sync 自动同步 config.toml）
  - `DeepSeekDirect.bat` → deepseek-direct-server.js（端口 57324，注意编码规则铁律36）
  - `FixPlugins.lnk` → `fix-plugins-on-startup.ps1`（修复插件列表，同时启动 57324）
- **冲突说明**: 57321 和 57324 同时运行时不冲突，但 `config.toml` 只能指向一个
- **provider-sync**: codex++ 的自动同步会覆盖 `config.toml`，备份在 `.codex\\backups\\codex-plus-live-*`
