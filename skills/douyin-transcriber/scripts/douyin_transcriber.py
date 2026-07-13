#!/usr/bin/env python3
"""douyin_transcriber.py - Download Douyin video and transcribe audio."""

import asyncio, json, time, subprocess, tempfile, base64
import urllib.request, http.client, websockets, os, sys, argparse, re

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
FFMPEG_DIR = r"C:\Users\%USERNAME%\AppData\Local\JianyingPro\Apps\10.9.0.14199"
FFMPEG_PATH = os.path.join(FFMPEG_DIR, "ffmpeg.exe")

os.environ["PATH"] = FFMPEG_DIR + os.pathsep + os.environ.get("PATH", "")

import whisper


async def recv_until(ws, tid, timeout=8):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            m = json.loads(await asyncio.wait_for(ws.recv(), 0.5))
            if m.get("id") == tid:
                return m
        except Exception:
            pass
    return None


async def js_str(ws, expr, num, timeout=30):
    await ws.send(json.dumps({
        "id": num, "method": "Runtime.evaluate",
        "params": {
            "expression": expr,
            "returnByValue": True,
            "awaitPromise": True,
            "timeout": timeout * 1000
        }
    }))
    r = await recv_until(ws, num, timeout)
    if r is None:
        raise TimeoutError(f"JS eval timed out after {timeout}s")
    return r["result"]["result"]["value"]


async def extract_douyin(share_url: str) -> dict:
    result = {"url": share_url}
    ud = tempfile.mkdtemp()
    proc = await asyncio.create_subprocess_exec(
        CHROME_PATH, "--headless=new", f"--user-data-dir={ud}",
        "--remote-debugging-port=9249", "--no-first-run",
        "--disable-gpu", "--no-sandbox",
        stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL
    )
    await asyncio.sleep(3)

    c = http.client.HTTPConnection("127.0.0.1", 9249)
    c.request("PUT", "/json/new?about:blank")
    page = json.loads(c.getresponse().read())

    async with websockets.connect(page["webSocketDebuggerUrl"]) as ws:
        print("  [1/5] Opening video page...")
        await ws.send(json.dumps({
            "id": 1, "method": "Page.navigate",
            "params": {"url": share_url}
        }))
        await recv_until(ws, 1, 15)
        await asyncio.sleep(5)

        page_url = await js_str(ws, "window.location.href", 2, 5)
        result["page_url"] = page_url

        vid_match = re.search(r"/video/(\d+)", page_url)
        if not vid_match:
            raise ValueError(f"Could not find video ID in URL: {page_url}")
        video_id = vid_match.group(1)
        result["video_id"] = video_id

        print("  [2/5] Fetching video info from API...")
        raw = await js_str(ws, f"""
            (async()=>{{
                var r = await fetch('/aweme/v1/web/aweme/detail/?aweme_id={video_id}&aid=6383', {{credentials:'include'}});
                var d = await r.json();
                if (!d.aweme_detail) throw new Error('API returned: ' + JSON.stringify(d));
                var v = d.aweme_detail.video;
                var ad = d.aweme_detail;
                return JSON.stringify({{
                    desc: ad.desc,
                    author: ad.author.nickname,
                    duration: v.duration,
                    dl_url: v.download_addr.url_list[0]
                }});
            }})()
        """, 3, 15)
        info = json.loads(raw)
        result.update(info)
        dur_s = info["duration"] // 1000
        print(f"       {info['author']} | {dur_s}s | {info['desc'][:50]}...")

        raw_cookies = await js_str(ws, "document.cookie", 4, 5)
        result["cookies"] = raw_cookies

    proc.kill()
    return result


def download_video(dl_url: str, cookies: str, output_path: str) -> None:
    import requests as req
    print("  [3/5] Downloading video...")
    s = req.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
        "Referer": "https://www.douyin.com/",
    })
    for c in cookies.split(";"):
        if "=" in c:
            k, v = c.strip().split("=", 1)
            s.cookies.set(k, v.split(";")[0])

    resp = s.get(dl_url, timeout=120, stream=True)
    if resp.status_code != 200:
        raise RuntimeError(f"Download failed: HTTP {resp.status_code}")
    with open(output_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            if chunk: f.write(chunk)
    size = os.path.getsize(output_path)
    print(f"       {size/1024/1024:.1f}MB downloaded")


def extract_audio(video_path: str, audio_path: str) -> None:
    print("  [4/5] Extracting audio...")
    subprocess.run(
        [FFMPEG_PATH, "-i", video_path, "-vn",
         "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
         audio_path, "-y"],
        capture_output=True, timeout=300
    )
    print(f"       {os.path.getsize(audio_path)/1024/1024:.1f}MB audio extracted")


def transcribe(audio_path: str, model_name: str = "tiny") -> str:
    print(f"  [5/5] Transcribing (model={model_name})...")
    model = whisper.load_model(model_name)
    result = model.transcribe(audio_path, language="zh")
    text = result["text"]
    print(f"       {len(text)} chars transcribed")
    return text


def main():
    parser = argparse.ArgumentParser(description="Douyin video to transcript")
    parser.add_argument("url", help="Douyin share URL")
    parser.add_argument("--model", default="tiny", choices=["tiny","base","small","medium","large"])
    parser.add_argument("--keep-files", action="store_true")
    args = parser.parse_args()

    output_dir = os.getcwd()
    video_path = os.path.join(output_dir, "douyin_video.mp4")
    audio_path = os.path.join(output_dir, "douyin_audio.wav")
    transcript_path = os.path.join(output_dir, "douyin_transcript.txt")

    t0 = time.time()
    try:
        info = asyncio.run(extract_douyin(args.url))
        download_video(info["dl_url"], info["cookies"], video_path)
        extract_audio(video_path, audio_path)
        text = transcribe(audio_path, args.model)
        with open(transcript_path, "w", encoding="utf-8") as f:
            f.write(text)
        elapsed = time.time() - t0
        print(f"\nDone in {elapsed:.0f}s")
        print(f"Transcript saved to {transcript_path}")
        if not args.keep_files:
            for f in [video_path, audio_path]:
                if os.path.exists(f): os.remove(f)
            print("Temp files cleaned up")
    except Exception as e:
        print(f"\nError: {e}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
