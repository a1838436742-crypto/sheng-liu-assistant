// Pricing Server - \u7701\u6d41\u9762\u677f\nconst http = require("http");
const fs = require("fs");
const path = require("path");
const audit = require("./audit-client.js");

const PORT = 57333;

function serveHtml(res, html) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

var server = http.createServer(function(req, res) {
  if (req.url === "/api/data") {
    var records = audit.loadHistory();
    var data = { records: records.slice(-100) };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
    return;
  }
  
  var htmlPath = path.join(__dirname, "pricing-panel.html");
  if (fs.existsSync(htmlPath)) {
    serveHtml(res, fs.readFileSync(htmlPath, "utf-8"));
  } else {
    serveHtml(res, "<h1>\u7701\u6d41\u52a9\u624b v3.0</h1><p>\u6b63\u5728\u8fd0\u884c...</p>");
  }
});

server.listen(PORT, function() {
  console.log("[pricing-server] \u7701\u6d41\u9762\u677f http://localhost:" + PORT);
});
