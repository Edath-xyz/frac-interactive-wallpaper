'use strict';
const {spawn}=require('node:child_process'),path=require('node:path'),assert=require('node:assert/strict'),fs=require('node:fs');
const root=path.resolve(__dirname,'..');
const child=spawn(process.execPath,['tools/serve.cjs'],{cwd:root,env:{...process.env,PURPLE_PORT:'0',PURPLE_SERVER_STATE:'.qa/server-check'},windowsHide:true,stdio:['ignore','pipe','pipe']});
(async()=>{
  const info=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Server start timeout')),10000);let output='';
    child.once('exit',code=>{clearTimeout(timer);reject(new Error('Server exited '+code));});
    child.stdout.on('data',chunk=>{output+=chunk;const end=output.indexOf('\n');if(end>=0){clearTimeout(timer);resolve(JSON.parse(output.slice(0,end)));}});
  });
  const groups=JSON.parse(fs.readFileSync(path.join(root,'content/wardrobes.json'),'utf8')),id=groups[0].looks[0];
  const url=info.url+'media/look-'+id+'.webm';
  const head=await fetch(url,{method:'HEAD'});assert.equal(head.status,200);const size=Number(head.headers.get('content-length'));assert(size>100);
  assert.equal(head.headers.get('accept-ranges'),'bytes');
  const part=await fetch(url,{headers:{Range:'bytes=10-29'}});assert.equal(part.status,206);assert.equal(part.headers.get('content-range'),`bytes 10-29/${size}`);
  assert.equal((await part.arrayBuffer()).byteLength,20);
  const tail=await fetch(url,{headers:{Range:'bytes=-7'}});assert.equal(tail.status,206);assert.equal((await tail.arrayBuffer()).byteLength,7);
  const invalid=await fetch(url,{headers:{Range:`bytes=${size+1}-`}});assert.equal(invalid.status,416);
  console.log('PASS isolated Range/HEAD/suffix/invalid-range server checks');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>child.kill());
