// GLM Proxy - 用于省流的免费模型代理
const http = require("http");
const https = require("https");
const url = require("url");

const PORT = 57330;
const GLM_API = "open.bigmodel.cn";
const GLM_PATH = "/api/paas/v4/chat/completions";

// 从配置读取 Key
let cfg = {};
try {
  cfg = JSON.parse(require("fs").readFileSync(__dirname + "/config.json", "utf-8").replace(/^\uFEFF/, ""));
} catch(e) {
  console.log("[GLM Proxy] 未找到 config.json");
  cfg = { free_api_key: "" };
}

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  let body = "";
  req.on("data", chunk => body += chunk);
  req.on("end", () => {
    const postData = JSON.parse(body || "{}");
    
    const options = {
      hostname: GLM_API,
      port: 443,
      path: GLM_PATH,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + (cfg.free_api_key || ""),
      }
    };

    const proxyReq = https.request(options, proxyRes => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on("error", e => {
      res.writeHead(500);
      res.end(JSON.stringify({ error: e.message }));
    });
    proxyReq.write(JSON.stringify(postData));
    proxyReq.end();
  });
});

server.listen(PORT, () => {
  console.log("[GLM Proxy] 暂听 " + PORT);
  console.log("[GLM Proxy] Key: " + (cfg.free_api_key ? cfg.free_api_key.substring(0, 8) + "..." : "未配置"));
});
