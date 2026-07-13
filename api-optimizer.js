// API Optimizer v3.0 - 缓存管理和请求优化
// 提供统一前缀和缓存逻辑

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CACHE_DIR = path.join(__dirname, ".cache");
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

function cacheKey(input) {
  return crypto.createHash("md5").update(input).digest("hex");
}

function getCached(key, ttlMs) {
  try {
    var p = path.join(CACHE_DIR, key);
    if (!fs.existsSync(p)) return null;
    var stat = fs.statSync(p);
    if (Date.now() - stat.mtimeMs > (ttlMs || 3600000)) {
      fs.unlinkSync(p);
      return null;
    }
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch(e) { return null; }
}

function setCache(key, data) {
  try {
    fs.writeFileSync(path.join(CACHE_DIR, key), JSON.stringify(data), "utf-8");
  } catch(e) { /* silent */ }
}

module.exports = { cacheKey, getCached, setCache };
