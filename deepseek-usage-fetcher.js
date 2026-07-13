// DeepSeek 用量抓取
const https = require('https');

function fetchUsage(apiKey) {
    return new Promise((resolve, reject) => {
        https.get({
            hostname: 'api.deepseek.com',
            path: '/v1/dashboard/usage',
            headers: { 'Authorization': 'Bearer ' + apiKey }
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch(e) { resolve({ error: e.message }); }
            });
        }).on('error', reject);
    });
}

module.exports = { fetchUsage };
