---
name: audio-voiceover-editor
description: "基于 ffmpeg 和 Whisper 的口播音频精剪工具。以 Excel 脚本为基准，切除口误/卡壳/重复/气口，输出干净的配音音频。"
---

# Audio Voiceover Editor Skill

基于 ffmpeg 的口播音频精剪流程。适用于中文配音/旁白的口误切除和气口清理。

## 前置依赖

- ffmpeg（带 silencedetect 滤镜）
- Python + whisper + scipy + numpy（可选，用于转写辅助）
- 原始录音文件 + Excel 分镜脚本

## 什么时候用

- 用户提供了一段口语录音，要求剪掉口误/卡壳/重复
- 用户提供了 Excel 脚本，要求按分镜精剪
- 用户对呼吸声/气口敏感，要求清理干净

## 工作流程

### 第1步：转写与对照

```python
import whisper
model = whisper.load_model("tiny")
result = model.transcribe("录音文件.m4a", language="zh")
for seg in result["segments"]:
    print(f"[{seg['start']:.1f}s-{seg['end']:.1f}s] {seg['text']}")
```

将输出与 Excel 脚本逐镜对照，标记：
- **口误/卡壳**: 说错或说不下去的地方 → 切除
- **重复**: 同一句说了两遍 → 只保留一遍
- **缺失**: 脚本有但录音没有 → 告知用户

### 第2步：定义 keep segments

以脚本镜号为基准，每个镜号对应一个 keep segment：

```python
keep = [
    (0.0, 28.2),      # Shot 1: 开场
    (28.4, 32.0),     # Shot 2
    (32.0, 32.8),     # Shot 3 (确保不含stutter)
    ...
]
```

**关键规则**：
- 不要合并超过 15s 的段（会隐藏内部 stutter）
- 大段要拆分：找到 Whisper 转写中的 stutter 位置，把 clean 部分单独切出
- 镜头切换处留 0.05-0.08s 间隙

### 第3步：单次拼接 + 镜头间留空

```python
parts = []
audio_refs = []
for i, (s, e) in enumerate(keep):
    parts.append(f"[0:a]atrim={s}:{e},asetpts=PTS-STARTPTS[a{i}]")
    audio_refs.append(f"[a{i}]")
    if i < len(keep) - 1:
        parts.append(f"aevalsrc=0:d=0.08[s{i}]")
        audio_refs.append(f"[s{i}]")

filt = ";".join(parts) + ";" + "".join(audio_refs) + f"concat=n={len(audio_refs)}:v=0:a=1[out]"
```

使用 `aevalsrc=0` 在镜头间插入静音间隔，保持自然节奏。

### 第4步：气口检测与切除

```bash
# 检测（阈值 -30dB，最小 0.04s）
ffmpeg -i trimmed.wav -af "silencedetect=noise=-30dB:d=0.04" -f null -

# 切除（物理切除，不衰减，不加门控）
# 用 Python 解析 silencedetect 输出 → 生成反相 keep → atrim 切除
```

**阈值参考**：
| 阈值 | 激进程度 | 适用场景 |
|------|---------|---------|
| -26dB | 激进 | 背景干净的录音 |
| -28dB | 适中 | **默认推荐** |
| -30dB | 保守 | 音量不稳定的录音 |

### 第5步：缓冲防爆音

atrim 切除点两侧加 0.002s 缓冲：

```python
start_pad = max(0, s - 0.002)
end_pad = min(duration, e + 0.002)
```

### 第6步：编码输出

```bash
ffmpeg -i final.wav -c:a aac -b:a 192k output.m4a
```

## 禁止事项

- ❌ 不要用 `noisereduce`（Python 库）— 吞字
- ❌ 不要用 `agate`（ffmpeg 门控）— 残留底噪
- ❌ 不要用 `highpass`/`lowpass` — 引入处理伪影
- ❌ 不要用 `volume=enable` 静音气口 — 产生硬切爆音
- ❌ 不要合并超过 15s 的 keep segment
- ❌ 不要在气口切除后加任何后处理滤镜

## 时长预期

| 阶段 | 时长 | 说明 |
|------|------|------|
| 原始录音 | ~169s | 包含所有口误和气口 |
| 机械粗剪 | ~150s | 按脚本分镜切除明显口误 |
| 气口切除 | ~141s | silencedetect 自动切除 |
| 手动精修 | ~133s | 人工微调（自动可达 90%） |

## 参考脚本

最终完整版 Python 脚本参考 `final_audio.py`（位于工作目录），包含：
1. 分镜切割
2. 镜头间隔
3. 气口检测与切除
4. 缓冲防爆音
5. AAC 编码
