// 图片过滤代理 - 监听 57322
const http = require('http');
const https = require('https');
const fs = require('fs');

const PORT = 57322;
const TARGET_HOST = 'api.deepseek.com';

function filterContent(messages) {
    return (messages || []).map(msg => {
        if (typeof msg.content === 'string') return msg;
        if (Array.isArray(msg.content)) {
            const textParts = msg.content.filter(p => p.type === 'text').map(p => p.text);
            return { ...msg, content: textParts.join(' ') || '[图片已过滤]' };
        }
        return msg;
    });
}

const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
        try {
            const input = JSON.parse(body);
            if (input.messages) input.messages = filterContent(input.messages);
            
            const fwdBody = JSON.stringify(input);
            const options = {
                hostname: TARGET_HOST,
                path: req.url,
                method: req.method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': req.headers.authorization,
                    'Content-Length': Buffer.byteLength(fwdBody)
                }
            };
            const proxy = https.request(options, targetRes => {
                let data = '';
                targetRes.on('data', c => data += c);
                targetRes.on('end', () => {
                    res.writeHead(targetRes.statusCode, { 'Content-Type': 'application/json' });
                    res.end(data);
                });
            });
            proxy.on('error', e => { res.writeHead(502); res.end(JSON.stringify({error: e.message})); });
            proxy.write(fwdBody);
            proxy.end();
        } catch(e) {
            res.writeHead(400);
            res.end(JSON.stringify({error: 'Invalid request'}));
        }
    });
});

server.listen(PORT, () => {
    console.log('Image filter proxy on port ' + PORT);
});
