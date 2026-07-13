// 省流面板服务器
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 57340;

const server = http.createServer((req, res) => {
    const file = req.url === '/' ? 'pricing-panel.html' : req.url.slice(1);
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath);
        const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
        res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
        res.end(fs.readFileSync(filePath));
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log('Pricing panel on http://localhost:' + PORT);
});
