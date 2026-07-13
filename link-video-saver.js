// Link/Video Saiver - 7-day cache
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '.cache', 'links');
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

function ensureCache() {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
}

function getCacheKey(url) {
    return Buffer.from(url).toString('base64').slice(0, 32) + '.json';
}

function getCached(url) {
    ensureCache();
    const file = path.join(CACHE_DIR, getCacheKey(url));
    if (fs.existsSync(file)) {
        const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
        if (Date.now() - data.timestamp < CACHE_TTL) {
            return data.content;
        }
    }
    return null;
}

function setCache(url, content) {
    ensureCache();
    const file = path.join(CACHE_DIR, getCacheKey(url));
    fs.writeFileSync(file, JSON.stringify({ timestamp: Date.now(), content }));
}

module.exports = { getCached, setCache };
