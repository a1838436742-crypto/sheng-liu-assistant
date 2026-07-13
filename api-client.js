// API 客户端
const https = require('https');

function callAPI(endpoint, apiKey, data) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const req = https.request({
            hostname: 'api.deepseek.com',
            path: endpoint,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            }
        }, res => {
            let result = '';
            res.on('data', chunk => result += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(result)); }
                catch(e) { resolve({ error: e.message, raw: result }); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

module.exports = { callAPI };
