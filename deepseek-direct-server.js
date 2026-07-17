// deepseek-direct-server.js — HTTP 代理服务器（供 config.toml 指向）
// node deepseek-direct-server.js → 监听 57324 → api.deepseek.com
var http = require("http");
var https = require("https");
var fs = require("fs");
var path = require("path");

var cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8").replace(/^\uFEFF/, ""));
var KEY = cfg.api_key || "";
var PORT = 57324;
var HOST = "api.deepseek.com";

var logDir = path.join(__dirname, ".cache");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
var logPath = path.join(logDir, "deepseek-direct.log");
function log(m) { var t=new Date().toISOString(); var l="["+t+"] "+m; console.log(l); try{fs.appendFileSync(logPath,l+"\n","utf-8")}catch(e){} }

if (!KEY) { log("缺少 api_key"); process.exit(1); }
log("启动中...");

function stripImages(o) {
  if (!o||typeof o!=="object") return o;
  if (Array.isArray(o)) return o.map(stripImages);
  var c={}; for(var k in o){if(k==="image_url"||k==="input_image"||(k==="type"&&(o[k]==="input_image"||o[k]==="image_url")))continue; c[k]=stripImages(o[k]);}
  if (Array.isArray(c.content)) c.content=c.content.filter(function(p){return typeof p!=="object"||(p.type!=="input_image"&&p.type!=="image_url")});
  return c;
}

function flatten(input, inst) {
  var msgs=[];
  if (inst) msgs.push({role:"system",content:inst});
  if (!input) return msgs;
  if (typeof input==="string") { msgs.push({role:"user",content:input}); return msgs; }
  if (Array.isArray(input)) input.forEach(function(it){
    if (!it) return;
    var role=it.role||"user", content=it.content;
    if (Array.isArray(content)) {
      var txt=content.map(function(p){if(typeof p==="string")return p; if(p.type==="input_text"||p.type==="text")return p.text||""; if(p.type==="input_image"||p.type==="image_url")return "[图片已过滤]"; return JSON.stringify(p)}).filter(Boolean);
      msgs.push({role:role,content:txt.join("\n")});
    } else if(typeof content==="string") msgs.push({role:role,content:content}); else if(content) msgs.push({role:role,content:JSON.stringify(content)});
  });
  return msgs;
}

// ── 判断任务复杂度：简单→GLM(57330), 复杂→DeepSeek ──
function isSimple(parsed, msgs) {
  if (parsed.tools && Array.isArray(parsed.tools) && parsed.tools.length > 0) return false;
  var total = 0;
  msgs.forEach(function(m){if(typeof m.content==="string")total+=m.content.length});
  return total <= 3000;
}

// ── 转发到 GLM 代理 ──
function proxyToGLM(raw, stream, cRes) {
  return new Promise(function(ok) {
    var buf=Buffer.from(raw);
    var r=require("http").request({hostname:"127.0.0.1",port:57330,path:"/v1/responses",method:"POST",headers:{"Content-Type":"application/json","Content-Length":buf.length,"Connection":"keep-alive"},timeout:180000},
      function(s){if(stream){cRes.writeHead(s.statusCode,s.headers);s.pipe(cRes);s.on("end",ok)}else{var d="";s.on("data",function(c){d+=c});s.on("end",function(){ok({status:s.statusCode,body:d})})}});
    r.on("error",function(e){ok({error:e.message})});
    r.write(buf);r.end();
  });
}

function callDS(mgs, opts) {
  return new Promise(function(ok) {
    var body=JSON.stringify({model:opts.model||"deepseek-chat",messages:mgs,max_tokens:opts.max_tokens||4096,temperature:opts.temperature??0.7,stream:false});
    var buf=Buffer.from(body);
    var r=https.request({hostname:HOST,path:"/chat/completions",method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+KEY,"Content-Length":buf.length},timeout:180000},
      function(res){var d="";res.on("data",function(c){d+=c});res.on("end",function(){try{var j=JSON.parse(d);if(j.error)ok({error:j.error.message});else ok(j)}catch(e){ok({error:"parse:"+e.message})}})});
    r.on("error",function(e){ok({error:e.message})});
    r.on("timeout",function(){r.destroy();ok({error:"timeout"})});
    r.write(buf);r.end();
  });
}

var server=http.createServer(function(req,res){
  req.setTimeout(300000);
  var chunks=[]; req.on("data",function(c){chunks.push(c)});
  req.on("end",async function(){
    try{
      var raw=Buffer.concat(chunks).toString(), url=req.url;
      if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"*"});res.end();return}
      if(req.method==="GET"&&url.includes("/models")){res.writeHead(200,{"Content-Type":"application/json"});res.end(JSON.stringify({object:"list",data:[{id:"deepseek-chat",object:"model"}]}));return}
      if(url.includes("/responses")){
        var p=JSON.parse(raw), stream=p.stream===true||p.stream==="true", model=p.model||"deepseek-chat";
        if(raw.includes("image_url")||raw.includes("input_image")){p=stripImages(p);raw=JSON.stringify(p);log("过滤了图片");}
        var msgs=flatten(p.input,p.instructions||"");
        var rid="resp_"+Date.now();

        // 智能路由：简单→GLM免费，复杂→DeepSeek付费
        if (isSimple(p, msgs)) {
          log("简单→GLM(免费)");
          if (stream) { proxyToGLM(raw, true, res); return }
          var result=await proxyToGLM(raw, false, res);
          if(result.error){res.writeHead(502);res.end(JSON.stringify({error:{message:result.error}}));return}
          res.writeHead(result.status,{"Content-Type":"application/json"});
          res.end(result.body);
          return;
        }

        log("复杂→DeepSeek(付费)");
        log(model+" "+(stream?"流式":"非流式")+", "+msgs.length+"条消息");
        if(stream){
          res.writeHead(200,{"Content-Type":"text/event-stream","Cache-Control":"no-cache","Connection":"keep-alive"});
          res.write("event: response.created\ndata: "+JSON.stringify({type:"response.created",response:{id:rid,object:"response",model:model,status:"in_progress"}})+"\n\n");
          var fc="",usage={}, buf=Buffer.from(JSON.stringify({model:"deepseek-chat",messages:msgs,max_tokens:p.max_output_tokens||4096,temperature:p.temperature??0.7,stream:true}));
          var r=https.request({hostname:HOST,path:"/chat/completions",method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+KEY,"Content-Length":buf.length},timeout:300000},
            function(sr){var b="";sr.on("data",function(c){b+=c.toString();var ls=b.split("\n");b=ls.pop()||"";ls.forEach(function(l){l=l.trim();if(!l||!l.startsWith("data: "))return;if(l.slice(6)==="[DONE]")return;try{var j=JSON.parse(l.slice(6)),d=j.choices?.[0]?.delta?.content||"";if(d){fc+=d;res.write("event: response.output_text.delta\ndata: "+JSON.stringify({type:"response.output_text.delta",delta:d,index:0})+"\n\n")}if(j.usage)usage=j.usage}catch(e){}})});sr.on("end",function(){var u=usage||{};res.write("event: response.completed\ndata: "+JSON.stringify({type:"response.completed",response:{id:rid,object:"response",model:model,status:"completed",output:[{type:"message",role:"assistant",content:[{type:"output_text",text:fc}]}],usage:{input_tokens:u.prompt_tokens||0,output_tokens:u.completion_tokens||0,total_tokens:(u.prompt_tokens||0)+(u.completion_tokens||0)}}})+"\n\n");res.end()})});
          r.on("error",function(e){res.write("event: error\ndata: "+JSON.stringify({type:"error",error:{message:e.message}})+"\n\n");res.end()});
          r.write(buf);r.end();
        } else {
          var result=await callDS(msgs,{model:model,max_tokens:p.max_output_tokens,temperature:p.temperature});
          if(result.error){res.writeHead(502,{"Content-Type":"application/json"});res.end(JSON.stringify({error:{message:result.error}}));return}
          var c=result.choices?.[0]?.message?.content||"",u=result.usage||{};
          res.writeHead(200,{"Content-Type":"application/json"});
          res.end(JSON.stringify({id:rid,object:"response",model:model,status:"completed",output:[{type:"message",role:"assistant",content:[{type:"output_text",text:c}]}],usage:{input_tokens:u.prompt_tokens||0,output_tokens:u.completion_tokens||0,total_tokens:(u.prompt_tokens||0)+(u.completion_tokens||0)}}));
        } return;
      }
      log("404: "+url);res.writeHead(404);res.end("not found");
    }catch(e){log("错误: "+e.message);try{res.writeHead(500,{"Content-Type":"application/json"});res.end(JSON.stringify({error:{message:e.message}}))}catch(e2){}}
  });
});
server.timeout=0;
server.listen(PORT,function(){log("deepseek-direct-server 就绪: 127.0.0.1:"+PORT+" (内嵌图片过滤)");});



