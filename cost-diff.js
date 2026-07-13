// Cost Diff - \u8d39\u7528\u5dee\u5f02\u5206\u6790\nconst audit = require("./audit-client.js");

function main() {
  var records = audit.loadHistory();
  if (records.length < 2) {
    console.log("\u6570\u636e\u4e0d\u8db3\uff0c\u81f3\u5c11\u9700\u89812\u6761\u8bb0\u5f55");
    return;
  }
  
  var first = records[0];
  var last = records[records.length - 1];
  
  console.log("=== \u8d39\u7528\u5dee\u5f02 ===");
  console.log("\u65f6\u95f4: " + first.timestamp + " ~ " + last.timestamp);
  console.log("\u6d88\u8d39\u589e\u91cf: " + (parseFloat(last.cost || 0) - parseFloat(first.cost || 0)).toFixed(2));
  console.log("Token\u589e\u91cf: " + (parseInt(last.output_tokens || 0) - parseInt(first.output_tokens || 0)));
}

main();
