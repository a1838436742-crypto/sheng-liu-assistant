// Link Video Saver - 提取链接内容，7天缓存
const api = require("./api-optimizer.js");
const https = require("https");

module.exports = async function(url) {
  var key = "link_" + api.cacheKey(url);
  var cached = api.getCached(key, 7 * 24 * 3600000);
  if (cached) return cached;
  
  return new Promise(function(resolve) {
    https.get(url, { timeout: 15000 }, function(res) {
      var data = "";
      res.on("data", function(c) { data += c; });
      res.on("end", function() {
        api.setCache(key, data);
        resolve(data);
      });
    }).on("error", function(e) {
      resolve(null);
    });
  });
};
