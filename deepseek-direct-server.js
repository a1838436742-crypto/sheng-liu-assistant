// deepseek-direct-server.js — HTTP 代理服务器（供 config.toml 指向）
// 用法: node deepseek-direct-server.js → 监听 57324
// 内嵌图片过滤，直连 api.deepseek.com
var https = require("https");
var fs = require("fs");
var path = require("path");

var cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf-8").replace(/^\uFEFF/, ""));
var API_KEY = cfg.api_key || "";
var PORT = 57324;
var DS_HOST = "api.deepseek.com";
var GLM_PROXY = "http://127.0.0.1:57330";

var logDir = path.join(__dirname, ".cache");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
var logPath = path.join(logDir, "deepseek-direct.log");
function log(msg) { var ts=new Date().toISOString(); var line="["+ts+"] [ds] "+msg; console.log(line); try{fs.appendFileSync(logPath,line+"\n","utf-8")}catch(e){} }
if (!API_KEY) { log("缺少 api_key"); process.exit(1); }
log("启动中...");

// ── 图片过滤 ──
function stripImages(obj) {
  if (!obj||typeof obj!=="object") return obj;
  if (Array.isArray(obj)) return obj.map(stripImages);
  var clean={};
  for (var key in obj) {
    if (key==="image_url") continue;
    if (key==="input_image") continue;
    if (key==="type"&&(obj[key]==="input_image"||obj[key]==="image_url")) continue;
    clean[key]=stripImages(obj[key]);
  }
  if (Array.isArray(clean.content)) clean.content=clean.content.filter(function(p){return typeof p!=="object"||(p.type!=="input_image"&&p.type!=="image_url")});
  return clean;
}

// ── Responses → Chat Completions messages ──
function flattenInput(input, instructions) {
  var msgs=[];
  if (instructions) msgs.push({role:"system",content:instructions});
  if (!input) return msgs;
  if (typeof input==="string") { msgs.push({role:"user",content:input}); return msgs; }
  if (Array.isArray(input)) input.forEach(function(item){
    if (!item) return;
    var role=item.role||"user", content=item.content;
    if (Array.isArray(content)) {
      var texts=content.map(function(p){
        if (typeof p==="string") return p;
        if (p.type==="input_text"||p.type==="text") return p.text||"";
        if (p.type==="input_image") return "[图片已过滤]";
        if (p.type==="image_url") return "[图片已过滤]";
        return JSON.stringify(p);
      }).filter(Boolean);
      msgs.push({role:role,content:texts.join("\n")});
    } else if (typeof content==="string") msgs.push({role:role,content:content});
    else if (content) msgs.push({role:role,content:JSON.stringify(content)});
  });
  return msgs;
}

// ── 判断任务复杂度 ──
function isComplexTask(parsed, messages) {
  // 有 tools → 复杂
  if (parsed.tools && Array.isArray(parsed.tools) && parsed.tools.length > 0) {
    log("路由判断: 复杂(含工具调用)");
    return true;
  }
  // 消息太长 → 复杂
  var totalLen = 0;
  var maxMsgLen = 0;
  messages.forEach(function(m) {
    if (typeof m.content === "string") {
      totalLen += m.content.length;
      if (m.content.length > maxMsgLen) maxMsgLen = m.content.length;
    }
  });
  if (totalLen > 3000 || maxMsgLen > 1500) {
    log("路由判断: 复杂(长内容 " + totalLen + " chars)");
    return true;
  }
  log("路由判断: 简单 → GLM");
  return false;
}

// ── 转发到 GLM 代理 ──
function proxyToGLM(rawBody, stream, cRes) {
  return new Promise(function(resolve) {
    var buf = Buffer.from(rawBody, "utf-8");
    var urlObj = new URL(GLM_PROXY + "/v1/responses");
    var opts = {
      hostname: urlObj.hostname, port: urlObj.port, path: urlObj.pathname,
      method: "POST", timeout: 180000,
      headers: { "Content-Type":"application/json", "Content-Length":buf.length }
    };
    var r = http.request(opts, function(res) {
      if (stream) {
        cRes.writeHead(res.statusCode, res.headers);
        res.pipe(cRes);
        res.on("end", resolve);
      } else {
        var d="";
        res.on("data",function(c){d+=c;});
        res.on("end",function(){resolve({status:res.statusCode,body:d});});
      }
    });
    r.on("error",function(e){log("GLM转发错误: "+e.message);resolve({error:e.message});});
    r.on("timeout",function(){r.destroy();resolve({error:"timeout"});});
    r.write(buf);
    r.end();
  });
}

// ── 非流式 DeepSeek ──
function callDeepSeek(messages, opts) {
  return new Promise(function(resolve) {
    var body=JSON.stringify({model:opts.model||"deepseek-chat",messages:messages,max_tokens:opts.max_tokens||4096,temperature:opts.temperature??0.7,stream:false});
    var buf=Buffer.from(body,"utf-8");
    var reqOpts={hostname:DS_HOST,path:"/chat/completions",method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+API_KEY,"Content-Length":buf.length},timeout:180000};
    var start=Date.now();
    var r=https.request(reqOpts,function(res){var d="";res.on("data",function(c){d+=c;});res.on("end",function(){try{var j=JSON.parse(d);if(j.error){log("API错误: "+j.error.message);resolve({error:j.error.message})}else{log("成功 "+(Date.now()-start)+"ms, "+(j.usage?.total_tokens||0)+" tokens");resolve(j)}}catch(e){log("JSON错误: "+e.message);resolve({error:"parse:"+e.message})}});});
    r.on("error",function(e){log("请求错误: "+e.message);resolve({error:e.message})});
    r.on("timeout",function(){r.destroy();log("超时");resolve({error:"timeout"})});
    r.write(buf);r.end();
  });
}

// ── 流式 DeepSeek ──
function callDeepSeekStream(messages, opts, onChunk, onDone) {
  var body=JSON.stringify({model:opts.model||"deepseek-chat",messages:messages,max_tokens:opts.max_tokens||4096,temperature:opts.temperature??0.7,stream:true});
  var buf=Buffer.from(body,"utf-8");
  var reqOpts={hostname:DS_HOST,path:"/chat/completions",method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+API_KEY,"Content-Length":buf.length},timeout:180000};
  var fc="",usage={};
  var r=https.request(reqOpts,function(res){var b="";res.on("data",function(c){b+=c.toString();var ls=b.split("\n");b=ls.pop()||"";ls.forEach(function(l){l=l.trim();if(!l||!l.startsWith("data: "))return;var js=l.slice(6);if(js==="[DONE]")return;try{var j=JSON.parse(js);var d=j.choices?.[0]?.delta?.content||"";if(d){fc+=d;onChunk(d)}if(j.usage)usage=j.usage}catch(e){}})});res.on("end",function(){onDone({content:fc,usage:usage})})});
  r.on("error",function(e){log("流式错误: "+e.message);onDone({error:e.message})});
  r.on("timeout",function(){r.destroy();onDone({error:"timeout"})});
  r.write(buf);r.end();
}

// ── HTTP 服务器 ──
var server=http.createServer(function(cReq,cRes){
  var chunks=[];
  cReq.on("data",function(c){chunks.push(c)});
  cReq.on("end",async function(){
    try{
      var rawBody=Buffer.concat(chunks).toString("utf-8"), url=cReq.url, method=cReq.method;
      if(method==="OPTIONS"){cRes.writeHead(204,{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"*"});cRes.end();return}
      if(method==="GET"&&url.includes("/models")){cRes.writeHead(200,{"Content-Type":"application/json"});cRes.end(JSON.stringify({object:"list",data:[{id:"deepseek-chat",object:"model"},{id:"deepseek-v4-flash",object:"model"}]}));return}
            if(url.includes("/responses")){
        var parsed=JSON.parse(rawBody);
        var stream=parsed.stream===true||parsed.stream==="true";
        var model=parsed.model||"deepseek-chat";
        var instructions=parsed.instructions||"";

        // 图片过滤（DeepSeek 不支持图片）
        var hasImg=rawBody.includes("image_url")||rawBody.includes("input_image");
        if(hasImg){parsed=stripImages(parsed);log("过滤了图片数据");}

        var messages=flattenInput(parsed.input,instructions);
        log(model+" (stream="+stream+"), "+messages.length+" msgs");
        var respId="resp_"+Date.now();

        if(stream){
          cRes.writeHead(200,{"Content-Type":"text/event-stream","Cache-Control":"no-cache","Connection":"keep-alive"});
          cRes.write("event: response.created\ndata: "+JSON.stringify({type:"response.created",response:{id:respId,object:"response",model:model,status:"in_progress"}})+"\n\n");
          callDeepSeekStream(messages,{model:model,max_tokens:parsed.max_output_tokens,temperature:parsed.temperature},
            function(d){cRes.write("event: response.output_text.delta\ndata: "+JSON.stringify({type:"response.output_text.delta",delta:d,index:0})+"\n\n")},
            function(r){if(r.error){cRes.write("event: error\ndata: "+JSON.stringify({type:"error",error:{message:r.error}})+"\n\n")}else{var u=r.usage||{};cRes.write("event: response.completed\ndata: "+JSON.stringify({type:"response.completed",response:{id:respId,object:"response",model:model,status:"completed",output:[{type:"message",role:"assistant",content:[{type:"output_text",text:r.content,annotations:[]}]}],usage:{input_tokens:u.prompt_tokens||0,output_tokens:u.completion_tokens||0}}})+"\n\n")}cRes.end()});
        } else {
          var res=await callDeepSeek(messages,{model:model,max_tokens:parsed.max_output_tokens,temperature:parsed.temperature});
          if(res.error){cRes.writeHead(502,{"Content-Type":"application/json"});cRes.end(JSON.stringify({error:{message:res.error}}));return}
          var c=res.choices?.[0]?.message?.content||"",u=res.usage||{};
          cRes.writeHead(200,{"Content-Type":"application/json"});
          cRes.end(JSON.stringify({id:respId,object:"response",model:model,status:"completed",output:[{type:"message",role:"assistant",content:[{type:"output_text",text:c,annotations:[]}]}],usage:{input_tokens:u.prompt_tokens||0,output_tokens:u.completion_tokens||0}}));
        }
        return;
      }
      log("404: "+url);cRes.writeHead(404);cRes.end("not found");
    }catch(e){log("错误: "+e.message+" "+(e.stack||"").slice(0,200));try{cRes.writeHead(500,{"Content-Type":"application/json"});cRes.end(JSON.stringify({error:{message:e.message}}))}catch(e2){}}
  });
});

server.timeout=0;
server.listen(PORT,function(){
  log("deepseek-direct v1.0 已就绪: 127.0.0.1:"+PORT+" => api.deepseek.com (内嵌图片过滤)");
});

