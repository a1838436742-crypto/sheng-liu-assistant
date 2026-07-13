// 全量审计
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, 'audit_logs');
const SNAPSHOT_FILE = path.join(__dirname, '.cost_baseline.json');

function aggregate() {
    if (!fs.existsSync(LOG_DIR)) return { total: 0, calls: 0 };
    const logs = fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.jsonl'));
    let total = 0, calls = 0;
    logs.forEach(f => {
        const lines = fs.readFileSync(path.join(LOG_DIR, f), 'utf-8').split('\n').filter(Boolean);
        lines.forEach(line => {
            try {
                const entry = JSON.parse(line);
                total += entry.cost || 0;
                calls++;
            } catch(e) {}
        });
    });
    return { total, calls };
}

const result = aggregate();
console.log('Total calls: ' + result.calls + ', Total cost: ' + result.total);

// 对比快照
if (fs.existsSync(SNAPSHOT_FILE)) {
    const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf-8'));
    console.log('Previous snapshot: ' + JSON.stringify(snapshot));
    console.log('Difference: ' + (result.total - (snapshot.cost || 0)));
}
