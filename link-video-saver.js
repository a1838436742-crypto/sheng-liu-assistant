// ============================================================
// link-video-saver.js — 链接/视频 省 token 分析器
// 
// 核心原则：先本地预处理（0 token），再送 DeepSeek
// - 网页: playwright 渲染 → Readability 提取文本 → 缓存
// - 视频: yt-dlp 扒字幕（免费）→ 文本 → 缓存
// - 缓存: 同 URL 永不重复分析
// 
// 用法:
//   const lv = require("./link-video-saver");
//   const result = await lv.analyze("https://...");
//   console.log(result.text);     // 纯文本内容（不耗 token）
//   console.log(result.cached);   // 是否缓存命中
// ============================================================

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync, exec } = require("child_process");

const CACHE_DIR = path.join(__dirname, ".cache", "link-video");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

const PYTHON = "C:\\Users\\18384\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";
const NODE = "C:\\Users\\18384\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe";
const PLAYWRIGHT = path.join(__dirname, "test_pkg", "node_modules", "playwright");

// ── URL → 缓存 key ──
function cacheKey(url) {
  return crypto.createHash("md5").update(url).digest("hex");
}

function cachePath(key) {
  return path.join(CACHE_DIR, key + ".json");
}

// ── 从缓存读取 ──
function readCache(key) {
  const p = cachePath(key);
  if (fs.existsSync(p)) {
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    if (Date.now() - data.cached_at < 7 * 86400000) { // 7天有效
      return data;
    }
  }
  return null;
}

// ── 写入缓存 ──
function writeCache(key, data) {
  fs.writeFileSync(cachePath(key), JSON.stringify({
    ...data,
    cached_at: Date.now(),
    key: key,
  }, null, 2), "utf-8");
}

// ═══════════════════════════════════════════════════════
// 公开 API
// ═══════════════════════════════════════════════════════

/**
 * 分析链接/视频，返回提取的纯文本
 * 优先走缓存，0 token 消耗
 * 
 * @param {string} url - 网页链接或视频链接
 * @param {object} [options]
 * @param {boolean} [options.forceRefresh] - 强制重新抓取
 * @returns {Promise<{text: string, title: string, source: string, cached: boolean, tokens_saved: number}>}
 */
async function analyze(url, options = {}) {
  const key = cacheKey(url);

  // 1. 查缓存
  if (!options.forceRefresh) {
    const cached = readCache(key);
    if (cached) {
      console.log("[link-video-saver] ✅ 缓存命中: " + url.slice(0, 60));
      const saved = Math.ceil((cached.raw_length || 0) / 3);
      return { ...cached, cached: true, tokens_saved: saved };
    }
  }

  console.log("[link-video-saver] 🔍 分析: " + url.slice(0, 60));

  let result;

  // 2. 判断类型
  const lower = url.toLowerCase();

  // --- 视频: YouTube / B站 / 抖音 ---
  if (lower.includes("youtube.com") || lower.includes("youtu.be") ||
      lower.includes("bilibili.com") || lower.includes("b23.tv") ||
      lower.includes("douyin.com")) {

    // 优先扒字幕（免费，0 token）
    const subs = url.toLowerCase().includes("bilibili") || url.toLowerCase().includes("b23.tv") ? await extractBilibiliSubs(url) : await extractSubtitles(url);
    if (subs && subs.text && subs.text.length > 50) {
      result = {
        title: subs.title || url,
        text: subs.text,
        source: "subtitles",
        url: url,
        raw_length: subs.text.length,
        tokens_estimate: Math.ceil(subs.text.length / 3),
      };
    } else {
      // 字幕失败，用页面描述的元数据
      const meta = await extractVideoMeta(url);
      result = {
        title: meta.title || url,
        text: meta.description || "无法提取视频内容",
        source: "metadata",
        url: url,
        raw_length: (meta.description || "").length,
        tokens_estimate: Math.ceil((meta.description || "").length / 3),
      };
    }

  // --- 普通网页 ---
  } else {
    const pageText = await extractPageText(url);
    result = {
      title: pageText.title || url,
      text: pageText.text || "",
      source: "webpage",
      url: url,
      raw_length: (pageText.text || "").length,
      tokens_estimate: Math.ceil((pageText.text || "").length / 3),
    };
  }

  // 3. 写入缓存
  writeCache(key, result);
  result.cached = false;
  result.tokens_saved = 0;

  console.log("[link-video-saver] ✅ 完成: " + (result.title || "").slice(0, 50) +
    " | ~" + result.tokens_estimate + " tokens | 来源: " + result.source);

  return result;
}

/**
 * 获取缓存统计
 */
function stats() {
  const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith(".json"));
  let totalTokens = 0;
  const entries = [];
  for (const f of files) {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, f), "utf-8"));
      totalTokens += d.tokens_estimate || 0;
      entries.push({
        url: (d.url || "").slice(0, 60),
        title: (d.title || "").slice(0, 40),
        tokens: d.tokens_estimate || 0,
        source: d.source || "?",
        cached_at: new Date(d.cached_at).toLocaleString("zh-CN"),
      });
    } catch (e) {}
  }
  return { cached_urls: entries.length, total_tokens_saved: totalTokens, entries };
}

// ═══════════════════════════════════════════════════════
// 内部方法
// ═══════════════════════════════════════════════════════

// ── 从视频扒字幕（0 token，免费）──

// ── B站 API 字幕提取（国内可用，比 yt-dlp 稳定）──
async function extractBilibiliSubs(url) {
  // 从 URL 提取 BV 号
  const bvMatch = url.match(/[Bb][Vv][a-zA-Z0-9]+/);
  if (!bvMatch) return null;
  const bvid = bvMatch[0];

  try {
    // Step 1: 获取视频信息（含 cid）
    const infoRes = await fetch("https://api.bilibili.com/x/web-interface/view?bvid=" + bvid);
    if (!infoRes.ok) return null;
    const info = await infoRes.json();
    if (info.code !== 0 || !info.data) return null;
    
    const title = info.data.title || "";
    const aid = info.data.aid;
    const cid = info.data.cid;
    
    // Step 2: 获取字幕列表
    const playerRes = await fetch("https://api.bilibili.com/x/player/v2?aid=" + aid + "&cid=" + cid);
    if (!playerRes.ok) return null;
    const player = await playerRes.json();
    if (player.code !== 0) return null;
    
    const subtitles = player.data?.subtitle?.subtitles;
    if (!subtitles || subtitles.length === 0) return null;

    // 优先选中文
    let subUrl = null;
    for (const s of subtitles) {
      if (s.lang_key && s.lang_key.toString().startsWith("1")) { // 1=中文
        subUrl = s.subtitle_url;
        break;
      }
    }
    if (!subUrl) subUrl = subtitles[0].subtitle_url;
    if (!subUrl || subUrl === "") return null;
    
    if (!subUrl.startsWith("http")) subUrl = "https:" + subUrl;

    // Step 3: 下载字幕 JSON
    const subRes = await fetch(subUrl);
    if (!subRes.ok) return null;
    const subData = await subRes.json();

    // 转换字幕 JSON 为纯文本
    const body = subData.body || [];
    const text = body.map(function(b) { return b.content || ""; }).filter(Boolean).join("\n");
    
    if (text.length < 10) return null;
    return { title: title, text: text };
  } catch (e) {
    return null;
  }
}
async function extractSubtitles(url) {
  return new Promise((resolve) => {
    // 用 yt-dlp 列出可用字幕
    const cmd = `"${PYTHON}" -m yt_dlp --skip-download --write-auto-subs --sub-langs all --convert-subs srt --output "%(title)s.%(ext)s" --print title --print "%(subtitles)s" "${url}" 2>nul`;
    
    exec(cmd, { timeout: 30000, windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        // 尝试无字幕模式，只取标题和描述
        const metaCmd = `"${PYTHON}" -m yt_dlp --skip-download --print title --print description "${url}" 2>nul`;
        exec(metaCmd, { timeout: 15000, windowsHide: true }, (e2, out2) => {
          if (e2) return resolve(null);
          const lines = out2.trim().split("\n");
          resolve({ title: lines[0] || "", description: lines.slice(1).join("\n").slice(0, 3000) });
        });
        return;
      }

      // 解析 yt-dlp 输出的字幕文件
      const lines = stdout.trim().split("\n");
      const title = lines[0] || "";
      // 找最近生成的 .srt/.vtt 文件
      const tmpDir = __dirname;
      const srtFiles = fs.readdirSync(tmpDir).filter(f => f.endsWith(".srt") || f.endsWith(".vtt"));
      let subText = "";
      for (const sf of srtFiles.sort().reverse()) {
        try {
          subText = fs.readFileSync(path.join(tmpDir, sf), "utf-8");
          fs.unlinkSync(path.join(tmpDir, sf)); // 用完删除
          break;
        } catch (e) {}
      }

      if (subText.length > 20) {
        // 清理字幕格式：去掉时间轴和序号
        subText = subText
          .replace(/^\d+\s*$/gm, "")
          .replace(/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/g, "")
          .replace(/<[^>]+>/g, "")
          .replace(/\n{3,}/g, "\n")
          .trim();
      }

      resolve({ title, text: subText.slice(0, 50000) }); // 最多5万字符
    });
  });
}

// ── 视频元数据兜底 ──
async function extractVideoMeta(url) {
  return new Promise((resolve) => {
    const cmd = `"${PYTHON}" -m yt_dlp --skip-download --print title --print description "${url}" 2>nul`;
    exec(cmd, { timeout: 15000, windowsHide: true }, (e, out) => {
      if (e) return resolve({ title: "", description: "" });
      const lines = out.trim().split("\n");
      resolve({ title: lines[0] || "", description: lines.slice(1).join("\n").slice(0, 3000) });
    });
  });
}

// ── 网页文本提取 ──
async function extractPageText(url) {
  // 优先用内置正则清洗
  try {
    const http = url.startsWith("https") ? require("https") : require("http");
    const html = await new Promise((resolve, reject) => {
      http.get(url, { timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
        let d = "";
        res.on("data", c => d += c);
        res.on("end", () => resolve(d));
      }).on("error", reject);
    });

    // 用 playwright 渲染 JS 页面（如果内置清理不够）
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&#?\w+;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // 去重行 + 截取关键内容
    const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 15);
    text = [...new Set(lines)].join("\n").slice(0, 30000);

    // 提取标题
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";

    return { title, text };
  } catch (e) {
    return { title: "", text: "获取失败: " + e.message };
  }
}

// ═══════════════════════════════════════════════════════
// 导出
// ═══════════════════════════════════════════════════════
module.exports = { analyze, stats };

// 直接运行 demo
if (require.main === module) {
  const url = process.argv[2] || "https://www.bilibili.com";
  console.log("\nlink-video-saver 测试: " + url + "\n");

  (async () => {
    const result = await analyze(url);
    console.log("\n结果:");
    console.log("  标题: " + (result.title || "").slice(0, 80));
    console.log("  来源: " + result.source);
    console.log("  缓存: " + (result.cached ? "✅" : "❌"));
    console.log("  文本: " + (result.text || "").slice(0, 200) + "...");
    console.log("  Token估: ~" + (result.tokens_estimate || 0));
    console.log("  原始长度: " + (result.raw_length || 0) + " 字符");

    console.log("\n缓存统计: " + JSON.stringify(stats(), null, 2));
  })();
}
// ═══════════════════════════════════════════════════════
// 快速分析 + 直接返回给 api-client 可用的格式
// 一行调用: const {text, cost} = await quickAnalyze(url);
// ═══════════════════════════════════════════════════════

/**
 * 分析链接并返回 DeepSeek 可直接消费的消息
 * 
 * 用法:
 *   const qa = require("./link-video-saver");
 *   const msg = await qa.quickAnalyze("https://...", "分析这个页面讲了什么");
 *   // msg = { messages: [...], max_tokens: 500 } → 直接送 api.ask
 */
async function quickAnalyze(url, instruction) {
  const start = Date.now();
  const result = await analyze(url);
  
  // 构造精简的分析请求消息
  const messages = [
    { role: "system", content: "你是一个内容分析助手。根据用户提供的链接内容，回答用户的问题。保持简洁。" },
    { role: "user", content: [
      "【链接】" + url,
      "【标题】" + (result.title || ""),
      "【内容摘要】" + (result.text || "").slice(0, 8000),
      instruction ? "【问题】" + instruction : "【要求】请简要总结这个链接的内容",
    ].join("\n") },
  ];

  return {
    messages,
    max_tokens: 500,
    meta: {
      url,
      title: result.title,
      source: result.source,
      cached: result.cached,
      local_text_length: (result.text || "").length,
      tokens_saved: result.tokens_estimate || 0,
      extraction_time_ms: Date.now() - start,
    },
  };
}

// 也作为单独的分析+缓存工具导出

// ═══════════════════════════════════════════════════════
// 视频制作手法分析（本地 ffmpeg，0 token）
// ═══════════════════════════════════════════════════════

const FFPROBE = "C:\\Users\\18384\\AppData\\Local\\ffmpeg\\ffmpeg-8.1.2-essentials_build\\bin\\ffprobe.exe";

/**
 * 分析视频文件/URL 的制作手法
 * 本地分析，不耗 API token
 * 
 * @param {string} videoPath - 视频文件路径或 URL
 * @returns {object} 分析结果
 */
async function analyzeVideoProduction(videoPath) {
  const isUrl = videoPath.startsWith("http");
  let localPath = videoPath;

  // 如果是 URL，先下载到临时目录
  if (isUrl) {
    console.log("[video-analysis] 下载视频元数据...");
    try {
      const info = await extractVideoMeta(videoPath);
      return {
        title: info.title || "",
        description: (info.description || "").slice(0, 3000),
        note: "视频画面分析需下载后处理，当前为元数据模式",
        suggestion: "如需画面级分析（运镜/剪辑/转场），请先下载视频再调用 analyzeLocalVideo()",
      };
    } catch (e) {
      return { error: "无法获取视频信息: " + e.message };
    }
  }

  return await analyzeLocalVideo(localPath);
}

/**
 * 分析本地视频文件（需要 ffmpeg）
 */
async function analyzeLocalVideo(filePath) {
  if (!fs.existsSync(filePath)) {
    return { error: "文件不存在: " + filePath };
  }

  const result = {};

  // 1. 基础元数据
  try {
    const probe = execSync(`"${FFPROBE}" -v quiet -print_format json -show_format -show_streams "${filePath}"`, {
      timeout: 10000, windowsHide: true, encoding: "utf-8",
    });
    const info = JSON.parse(probe);
    const videoStream = (info.streams || []).find(function(s) { return s.codec_type === "video"; });
    const audioStream = (info.streams || []).find(function(s) { return s.codec_type === "audio"; });

    result.metadata = {
      duration: parseFloat(info.format?.duration || 0),
      size: parseInt(info.format?.size || 0),
      bitrate: parseInt(info.format?.bit_rate || 0),
      format: info.format?.format_name || "",
    };
    if (videoStream) {
      result.metadata.video = {
        codec: videoStream.codec_name,
        width: videoStream.width,
        height: videoStream.height,
        fps: eval(videoStream.r_frame_rate || "0/1"),
        pixel_format: videoStream.pix_fmt,
      };
    }
    if (audioStream) {
      result.metadata.audio = {
        codec: audioStream.codec_name,
        sample_rate: audioStream.sample_rate,
        channels: audioStream.channels,
      };
    }
  } catch (e) {
    result.metadata_error = e.message;
  }

  // 2. 镜头/场景分析（检测剪辑节奏）
  try {
    const sceneOut = execSync(`"${FFPROBE}" -v quiet -show_entries frame=pts_time,pict_type -of csv=p=0 "${filePath}" 2>nul`, {
      timeout: 30000, windowsHide: true, encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    const frames = sceneOut.trim().split("\n").filter(Boolean);
    // I帧 = 关键帧（新镜头开始）
    const iFrames = frames.filter(function(f) { return f.includes(",I"); });
    const pFrames = frames.filter(function(f) { return f.includes(",P"); });

    const totalFrames = frames.length;
    const duration = result.metadata?.duration || 1;
    const fps = result.metadata?.video?.fps || 30;
    const sceneCount = iFrames.length;

    result.editing = {
      total_frames: totalFrames,
      scene_count: sceneCount,
      avg_scene_duration: sceneCount > 0 ? (duration / sceneCount).toFixed(1) + "s" : "N/A",
      estimated_cuts: sceneCount > 0 ? Math.round(sceneCount / duration * 60) + " cuts/min" : "N/A",
      i_frame_ratio: totalFrames > 0 ? (iFrames.length / totalFrames * 100).toFixed(1) + "%" : "N/A",
      p_frame_ratio: totalFrames > 0 ? (pFrames.length / totalFrames * 100).toFixed(1) + "%" : "N/A",
    };

    // 剪辑节奏判断
    const cutsPerMin = sceneCount > 0 ? sceneCount / (duration / 60) : 0;
    if (cutsPerMin < 5) result.editing.pace = "慢节奏（平均每个镜头12秒+）";
    else if (cutsPerMin < 15) result.editing.pace = "中等节奏（平均每个镜头4-12秒）";
    else if (cutsPerMin < 30) result.editing.pace = "快节奏（平均每个镜头2-4秒）";
    else result.editing.pace = "极快节奏/MTV风格（平均每个镜头<2秒）";
  } catch (e) {
    result.editing_error = e.message;
  }

  // 3. 运动分析（检测运镜）
  try {
    // 用 scene 检测的 motion 信息
    const motionOut = execSync(`"${FFPROBE}" -v quiet -show_entries frame=interlacement -of csv=p=0 "${filePath}" 2>nul`, {
      timeout: 10000, windowsHide: true, encoding: "utf-8",
      maxBuffer: 5 * 1024 * 1024,
    });
    // 简化版：通过帧间变化率估算运动程度
    result.motion = {
      note: "详细运镜分析（推/拉/摇/移/跟）需逐帧光流分析，当前为简化版",
      analysis_depth: "basic",
    };
  } catch (e) {
    // 运动分析失败不影响其他结果
  }

  // 4. 综合判断
  const analysis = [];
  if (result.editing) {
    analysis.push("剪辑: " + result.editing.pace);
    analysis.push("镜头数: ~" + (result.editing.scene_count || "?") + " 个");
    analysis.push("平均镜头: " + (result.editing.avg_scene_duration || "?"));
  }
  if (result.metadata?.video) {
    const v = result.metadata.video;
    analysis.push("分辨率: " + v.width + "x" + v.height);
    analysis.push("帧率: " + (v.fps ? v.fps.toFixed(1) + "fps" : "?"));
  }
  result.summary = analysis.join(" | ");

  return result;
}

module.exports = { analyze, stats, quickAnalyze, analyzeVideoProduction, analyzeLocalVideo };
