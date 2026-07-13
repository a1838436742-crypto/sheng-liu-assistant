// 费用差异对比
const fs = require('fs');

const baseline = JSON.parse(fs.readFileSync('.cost_baseline.json', 'utf-8'));
const current = { timestamp: Date.now(), cost: 0 }; // placeholder

const diff = current.cost - (baseline.cost || 0);
console.log('Fee diff: ' + diff);
