'use strict';
// Local safe WE preview. Byte ranges are required for paused-frame restoration;
// a basic python http.server can report seeked while Chrome remains at zero.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const HOST=process.env.PURPLE_HOST || 'wallpaper-engine';
if(!['wallpaper-engine','lively'].includes(HOST))throw new Error('Invalid PURPLE_HOST');
const ROOT=path.resolve(__dirname,'../preview',HOST);
const STATE=path.resolve(__dirname,'..',process.env.PURPLE_SERVER_STATE||'.qa/server');
const PORT=process.env.PURPLE_PORT===undefined?0:Number(process.env.PURPLE_PORT);
if(!Number.isInteger(PORT)||PORT<0||PORT>65535)throw new Error('Invalid PURPLE_PORT');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.webm':'video/webm'};
const server=http.createServer((req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'}).end();return;}
  let rel;
  try{rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html';}catch{res.writeHead(400).end();return;}
  if(rel==='favicon.ico'){res.writeHead(204).end();return;}
  const file=path.resolve(ROOT,rel);
  if(!file.startsWith(ROOT+path.sep)){res.writeHead(403).end();return;}
  fs.stat(file,(error,stat)=>{
    if(error||!stat.isFile()){res.writeHead(404).end();return;}
    let start=0,end=stat.size-1,status=200;
    const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range||'');
    if(range&&(range[1]||range[2])){
      if(range[1]){start=Number(range[1]);end=range[2]?Math.min(Number(range[2]),end):end;}
      else start=Math.max(0,stat.size-Number(range[2]));
      status=206;
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();return;}
    }
    const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':Math.max(0,end-start+1),'Accept-Ranges':'bytes','Cache-Control':'no-cache'};
    if(status===206)headers['Content-Range']=`bytes ${start}-${end}/${stat.size}`;
    res.writeHead(status,headers);if(req.method==='HEAD'||!stat.size){res.end();return;}
    const stream=fs.createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);
  });
});
server.listen(PORT,'127.0.0.1',()=>{
  fs.mkdirSync(STATE,{recursive:true});
  const info={url:`http://127.0.0.1:${server.address().port}/`,pid:process.pid,script:__filename,root:ROOT,byteRanges:true};
  fs.writeFileSync(path.join(STATE,'server.json'),JSON.stringify(info));console.log(JSON.stringify(info));
});
