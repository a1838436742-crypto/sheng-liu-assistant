---
name: douyin-transcriber
description: >-
  Download Douyin videos and transcribe audio to simplified Chinese text.
  Use when the user shares a Douyin link and wants the video content as text.
---

# 抖音视频转文字 Douyin Transcriber

作者：省流助手 v3.0

将抖音分享链接的视频内容转成简体中文文字稿，全程本地处理，¥0 费用。

## 完整流程

`
分享链接 → Headless Chrome → 获取视频信息 → requests 下载 → ffmpeg 提音频 → Whisper 转文字 → 简体输出
`

## 使用方法

`powershell
python skills/douyin-transcriber/scripts/douyin_transcriber.py "<分享链接>"
`

### 参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| --model | 	iny | Whisper 模型：tiny/base/small/medium/large |
| --keep-files | 关闭 | 保留视频/音频临时文件 |
| --output-dir | 桌面 | 输出目录 |

### 示例

`powershell
python douyin_transcriber.py "https://v.douyin.com/siA8AcXBeJY/"
python douyin_transcriber.py "https://v.douyin.com/xxx/" --model base --keep-files
`

## 流程详解

1. **打开页面** — 启动独立 Headless Chrome → 打开分享链接
2. **获取视频信息** — JS 调抖音 API 拿下载地址、标题、作者
3. **下载视频** — Python requests + 浏览器 cookies 下载（防 CDN 超时）
4. **提取音频** — ffmpeg 转为 16kHz 单声道 PCM
5. **语音识别** — Whisper 转为文字
6. **简体转换** — 繁体→简体（zhconv 或 opencc 双备选）
7. **输出** — 桌面 douyin_transcript.txt

## 依赖

`powershell
pip install requests websockets openai-whisper zhconv
`

- ffmpeg：优先用剪映自带路径，否则需要手动安装
- Chrome：自动检测系统安装路径

## 注意事项

- 视频 CDN 有地域限制，国内网络最好
- 首次运行 Whisper 会自动下载模型（~75MB tiny）
- 音频视频临时文件默认自动删除
