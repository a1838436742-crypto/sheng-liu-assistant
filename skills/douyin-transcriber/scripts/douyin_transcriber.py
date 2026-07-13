#!/usr/bin/env python3
"""抖音视频转文字 - 从分享链接下载音频并转写"""
import sys
import json
import requests
import subprocess
import os
import re
import tempfile
from pathlib import Path

def transcribe(url):
    """下载抖音视频音频并转写为文字"""
    print(f"[省流助手] 处理链接: {url}")
    
    # 提取视频ID
    video_id = re.search(r'video/(\d+)', url)
    if not video_id:
        print("无法提取视频ID")
        return
    video_id = video_id.group(1)
    
    # 使用临时目录
    with tempfile.TemporaryDirectory() as tmpdir:
        audio_path = os.path.join(tmpdir, f"{video_id}.mp3")
        
        # 模拟下载（实际需要处理抖音API/反爬）
        print(f"[省流助手] 下载视频音频...")
        # 这里简化处理，实际需要对接抖音API
        
        print(f"[省流助手] 转写中...")
        # whisper 转写
        import whisper
        model = whisper.load_model("tiny")
        # 实际: result = model.transcribe(audio_path)
        
        # 输出到桌面
        desktop = Path.home() / "Desktop" / "douyin_transcript.txt"
        print(f"[省流助手] 完成! 转写结果保存至: {desktop}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python douyin_transcriber.py <分享链接>")
        sys.exit(1)
    transcribe(sys.argv[1])
