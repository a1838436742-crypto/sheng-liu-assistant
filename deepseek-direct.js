// DeepSeek 直连调用模块
const https = require('https');

function deepseekChat(messages, apiKey) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            model: 'deepseek-chat',
            messages: messages,
            max_tokens: 2000
        });
        const req = https.request({
            hostname: 'api.deepseek.com',
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            }
        }, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

module.exports = { deepseekChat };
