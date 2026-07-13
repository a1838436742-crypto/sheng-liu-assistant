// API Optimizer v3.0 - Cache & Optimize
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '.cache', 'api');
const CACHE_TTL = 3600000; // 1 hour

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getCacheKey(method, params) {
    return method + '_' + Buffer.from(JSON.stringify(params)).toString('base64').slice(0, 40);
}

function getCached(method, params) {
    ensureDir(CACHE_DIR);
    const file = path.join(CACHE_DIR, getCacheKey(method, params) + '.json');
    if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
        if (Date.now() - data.ts < CACHE_TTL) return data.result;
    }
    return null;
}

function setCache(method, params, result) {
    ensureDir(CACHE_DIR);
    const file = path.join(CACHE_DIR, getCacheKey(method, params) + '.json');
    fs.writeFileSync(file, JSON.stringify({ ts: Date.now(), result }));
}

module.exports = { getCached, setCache };
