# 抖音视频转文字 skill

将抖音分享链接转换为文字稿。

## 使用方法

```bash
python douyin_transcriber.py "<分享链接>"
```

## 输出

- 桌面 `douyin_transcript.txt`
- 默认 tiny 模型，约 40s

## 依赖

- ffmpeg
- openai-whisper
- requests
