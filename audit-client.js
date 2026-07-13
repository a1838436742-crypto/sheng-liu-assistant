// 审计客户端
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, 'audit_logs');

function ensureLogDir() {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function logCall(entry) {
    ensureLogDir();
    const date = new Date().toISOString().split('T')[0];
    const file = path.join(LOG_DIR, date + '.jsonl');
    entry.timestamp = new Date().toISOString();
    fs.appendFileSync(file, JSON.stringify(entry) + '\n');
}

function readLogs(date) {
    const file = path.join(LOG_DIR, date + '.jsonl');
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean).map(JSON.parse);
}

module.exports = { logCall, readLogs };
