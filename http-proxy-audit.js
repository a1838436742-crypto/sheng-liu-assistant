// HTTP 代理审计
const http = require('http');

const PORT = 57331;
let requestCount = 0;

const server = http.createServer((req, res) => {
    requestCount++;
    console.log('Request #' + requestCount + ': ' + req.method + ' ' + req.url);
    
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
        const data = JSON.stringify({ status: 'logged', requests: requestCount });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log('Audit proxy on port ' + PORT);
});
