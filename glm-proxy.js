// GLM 协议转换代理 - 监听 57330
const http = require('http');
const https = require('https');

const PORT = 57330;
const GLM_HOST = 'open.bigmodel.cn';

const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            const input = JSON.parse(body);
            // Responses API → Chat Completions
            const glmBody = JSON.stringify({
                model: input.model || 'glm-4-flash',
                messages: input.messages || (input.input ? [{role:'user', content:input.input}] : []),
                max_tokens: input.max_tokens || 1500
            });
            const options = {
                hostname: GLM_HOST,
                path: '/api/paas/v4/chat/completions',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': req.headers.authorization,
                    'Content-Length': Buffer.byteLength(glmBody)
                }
            };
            const proxy = https.request(options, glmRes => {
                let data = '';
                glmRes.on('data', c => data += c);
                glmRes.on('end', () => {
                    try {
                        const glmData = JSON.parse(data);
                        // Chat Completions → Responses
                        const output = {
                            id: glmData.id,
                            object: 'response',
                            output: glmData.choices?.[0]?.message?.content || '',
                            model: glmData.model
                        };
                        res.writeHead(200, {'Content-Type': 'application/json'});
                        res.end(JSON.stringify(output));
                    } catch(e) {
                        res.writeHead(502);
                        res.end(JSON.stringify({error: e.message}));
                    }
                });
            });
            proxy.on('error', e => {
                res.writeHead(502);
                res.end(JSON.stringify({error: e.message}));
            });
            proxy.write(glmBody);
            proxy.end();
        } catch(e) {
            res.writeHead(400);
            res.end(JSON.stringify({error: 'Invalid request'}));
        }
    });
});

server.listen(PORT, () => {
    console.log('GLM proxy running on port ' + PORT);
});
