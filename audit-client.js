// Token \u5ba1\u8ba1\u5ba2\u6237\u7aef v2.0
const fs = require("fs");
const path = require("path");

const PRICING = {
  "deepseek-chat":         { input: 0.14, output: 0.28, cache_hit: 0.035 },
  "deepseek-reasoner":     { input: 0.55, output: 2.19, cache_hit: 0.14 },
  "deepseek-v4":           { input: 0.50, output: 1.50, cache_hit: 0.125 },
  "deepseek-v4-flash":     { input: 0.20, output: 0.60, cache_hit: 0.05 },
};
const DEFAULT_PRICING = { input: 0.20, output: 0.60, cache_hit: 0.05 };
const PEAK_HOURS = new Set([9, 10, 11, 12, 14, 15, 16, 17, 18]);
const LOG_DIR = path.join(__dirname, "audit_logs");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const BASE_FIELDS = ["timestamp","hour","isPeak","model","task_type","input_tokens","output_tokens","cached_input","total_tokens","cost","duration_ms","status","prompt_preview","note","peak_cost","offpeak_cost","_cost_peak","_cost_offpeak","_version","_origin"];

function getLogFile() {
  var d = new Date();
  return path.join(LOG_DIR, "audit_" + d.getFullYear() + ("0"+(d.getMonth()+1)).slice(-2) + ".csv");
}

function loadHistory() {
  var p = getLogFile();
  if (!fs.existsSync(p)) return [];
  var lines = fs.readFileSync(p, "utf-8").split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  var headers = lines[0].split(",");
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var vals = lines[i].split(",");
    var row = {};
    for (var j = 0; j < headers.length; j++) row[headers[j]] = vals[j] || "";
    rows.push(row);
  }
  return rows;
}

function record(fields) {
  var now = new Date();
  var ts = now.getFullYear() + "-" + ("0"+(now.getMonth()+1)).slice(-2) + "-" + ("0"+now.getDate()).slice(-2) + " " + ("0"+now.getHours()).slice(-2) + ":" + ("0"+now.getMinutes()).slice(-2) + ":" + ("0"+now.getSeconds()).slice(-2);
  var hour = now.getHours();
  var isPeak = PEAK_HOURS.has(hour) ? 1 : 0;
  var model = fields.model || "unknown";
  var p = PRICING[model] || DEFAULT_PRICING;
  var inp = parseInt(fields.input_tokens) || 0;
  var out = parseInt(fields.output_tokens) || 0;
  var cached = parseInt(fields.cached_input) || 0;
  var total = inp + out + cached;
  var cost = fields.cost != null ? parseFloat(fields.cost) : (inp * p.input + out * p.output + cached * p.cache_hit) / 1000000;
  
  var row = {};
  BASE_FIELDS.forEach(function(f) { row[f] = ""; });
  row.timestamp = ts;
  row.hour = hour;
  row.isPeak = isPeak;
  row.model = model;
  row.task_type = fields.task_type || "";
  row.input_tokens = inp;
  row.output_tokens = out;
  row.cached_input = cached;
  row.total_tokens = total;
  row.cost = cost.toFixed(6);
  row.duration_ms = fields.duration_ms || "";
  row.status = fields.status || "";
  row.prompt_preview = (fields.prompt_preview || "").replace(/,/g, " ");
  row.note = (fields.note || "").replace(/,/g, " ");
  row._origin = fields._origin || "system";
  row._version = "3";
  
  var csvPath = getLogFile();
  var exists = fs.existsSync(csvPath);
  var line = BASE_FIELDS.map(function(f) { return row[f]; }).join(",");
  fs.appendFileSync(csvPath, (exists ? "" : BASE_FIELDS.join(",") + "\n") + line + "\n", "utf-8");
}

module.exports = { record, loadHistory, PRICING, PEAK_HOURS };
