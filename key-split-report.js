// API Key 费用拆分报告
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, 'audit_logs');

function splitReport() {
    if (!fs.existsSync(LOG_DIR)) return {};
    const result = {};
    fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.jsonl')).forEach(f => {
        const lines = fs.readFileSync(path.join(LOG_DIR, f), 'utf-8').split('\n').filter(Boolean);
        lines.forEach(line => {
            try {
                const entry = JSON.parse(line);
                const key = entry.api_key ? entry.api_key.slice(0, 12) + '...' : 'unknown';
                result[key] = result[key] || { calls: 0, cost: 0 };
                result[key].calls++;
                result[key].cost += entry.cost || 0;
            } catch(e) {}
        });
    });
    return result;
}

console.log(JSON.stringify(splitReport(), null, 2));
