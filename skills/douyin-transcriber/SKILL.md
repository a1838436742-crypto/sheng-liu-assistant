---
name: "douyin-transcriber"
description: "Extract and transcribe audio from Douyin (TikTok China) videos. Use when the user wants to: (1) download a Douyin video and get its transcript, (2) transcribe spoken content from a Douyin share link, (3) analyze video content without watching it, or (4) convert a Douyin video to text for summarization or content analysis."
---

# Douyin Transcriber

## Usage
```powershell
python skills/douyin-transcriber/scripts/douyin_transcriber.py "<share_url>"
```

### Options
| Flag | Default | Description |
|------|---------|-------------|
| `--model tiny|base|small|medium|large` | `tiny` | Whisper model size |
| `--keep-files` | off | Keep video/audio after transcription |

### Examples
```powershell
python douyin_transcriber.py "https://v.douyin.com/siA8AcXBeJY/"
python douyin_transcriber.py "https://v.douyin.com/xxx/" --model base
```

## Full Pipeline
1. Headless Chrome → visit douyin page → extract cookies
2. JS fetch to `/aweme/v1/web/aweme/detail/` → get download URL
3. Python requests + cookies → download video
4. ffmpeg → extract PCM audio (16kHz mono)
5. Whisper → transcribe to text
6. Save to `douyin_transcript.txt`

## Dependencies
```powershell
pip install requests websockets openai-whisper
```
ffmpeg required (剪映自带 or download from ffmpeg.org)
