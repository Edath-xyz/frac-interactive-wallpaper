'use strict';
// Isolated Chrome contexts, local files, actual media. No personal browser profile.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {execFileSync}=require('node:child_process');
const pp=require('puppeteer-core');
const root=path.resolve(__dirname,'..');
const chrome=process.env.PURPLE_CHROME || [process.env.PROGRAMFILES,process.env['PROGRAMFILES(X86)'],process.env.LOCALAPPDATA].filter(Boolean).map(p=>path.join(p,'Google/Chrome/Application/chrome.exe')).find(fs.existsSync);
const project=JSON.parse(fs.readFileSync(path.join(root,'content/project.json'),'utf8'));
const groups=JSON.parse(fs.readFileSync(path.join(root,'content/wardrobes.json'),'utf8'));
const specs=Object.fromEntries(groups.flatMap(g=>g.looks).map(id=>[id,JSON.parse(fs.readFileSync(path.join(root,'content/looks',id,'look.json'),'utf8'))]));
const qa=path.join(root,'.qa','browser-'+Date.now());fs.mkdirSync(qa,{recursive:true});
const report={checks:[],errors:[],nativeHostAccepted:false};
let browser;
const record=(name,evidence)=>{report.checks.push({name,evidence});console.log('PASS '+name);};
const frames=page=>page.evaluate(()=>new Promise(resolve=>{let n=0;const step=()=>++n===6?resolve():requestAnimationFrame(step);requestAnimationFrame(step);}));
(async()=>{
  assert(chrome,'Install Chrome or set PURPLE_CHROME');
  execFileSync('python',['-X','utf8','tools/project.py','build','--host','both'],{cwd:root,stdio:'pipe'});
  browser=await pp.launch({executablePath:chrome,headless:true,args:['--autoplay-policy=no-user-gesture-required','--allow-file-access-from-files'],userDataDir:path.join(qa,'profile')});
  for(const host of ['wallpaper-engine','lively']){
    const context=await browser.createBrowserContext(),page=await context.newPage();
    await page.setViewport({width:1920,height:1080});page.setDefaultTimeout(25000);
    page.on('pageerror',e=>report.errors.push({host,message:e.message}));
    page.on('requestfailed',r=>{if(!/ABORTED/.test(r.failure()?.errorText||''))report.errors.push({host,url:r.url(),error:r.failure()});});
    const preview=path.join(root,'preview',host),url=pathToFileURL(path.join(preview,'index.html')).href;
    const key='purple-diy.'+project.id+'.'+host+'.v1';
    const bootstrap=await page.evaluateOnNewDocument(key=>localStorage.setItem(key,JSON.stringify({autoHide:false,sound:false,welcomeSeen:true})),key);
    await page.goto(url,{waitUntil:'load'});
    await page.removeScriptToEvaluateOnNewDocument(bootstrap.identifier);
    await page.waitForFunction(()=>window.purpleLayoutBridge && document.querySelector('#still').naturalWidth>0);
    const looks=await page.evaluate(()=>PURPLE_LOOKS);
    const state=()=>page.evaluate(()=>purpleLayoutBridge.current());
    assert.equal((await state()).id,project.defaultLook);
    assert.equal(looks.length,Object.keys(specs).length);record(host+' startup and configured catalog',looks.map(x=>x.id));
    const browseGroup=groups.find(g=>g.looks.length>1)||groups[0];
    await page.click(`[data-wardrobe="${browseGroup.id}"]`);
    assert.equal((await state()).id,project.defaultLook);record(host+' wardrobe browsing leaves playback unchanged');
    const forward=await page.$$eval('[data-select]',bs=>bs.map(b=>b.dataset.select));
    await page.click('#wardrobeOrder');const reverse=await page.$$eval('[data-select]',bs=>bs.map(b=>b.dataset.select));
    assert.deepEqual(reverse,[...forward].reverse());await page.click('#wardrobeOrder');record(host+' forward/reverse ordering');
    for(const look of looks){
      await page.evaluate(group=>document.querySelector(`[data-wardrobe="${group}"]`).click(),look.group);
      const index=looks.findIndex(x=>x.id===look.id);await page.click(`[data-select="${index}"]`);
      await page.waitForFunction(id=>purpleLayoutBridge.current().id===id && purpleLayoutBridge.current().phase==='playing',{},look.id);
      await page.waitForFunction(({id,width})=>[...document.querySelectorAll('video')].some(v=>v.dataset.look===id && v.videoWidth===width && v.currentTime>.1),{},{id:look.id,width:specs[look.id].width});
      if(look.companion){
        const start=look.companion.startFrame/look.companion.fps,end=look.companion.endFrame/look.companion.fps;
        assert.equal((await state()).mode,'companion');
        await page.waitForFunction(start=>[...document.querySelectorAll('video')].some(v=>v.classList.contains('visible')&&v.currentTime>start),{timeout:Math.max(25000,(start+5)*1000)},start);
        await page.click('#playButton');await frames(page);assert.equal((await state()).phase,'paused');
        const held=await page.evaluate(()=>[...document.querySelectorAll('video')].filter(v=>v.classList.contains('visible')).map(v=>v.currentTime));
        if(host==='lively')await page.evaluate(()=>livelyWallpaperPlaybackChanged({IsPaused:false}));
        else await page.evaluate(()=>wallpaperPropertyListener.setPaused(false));
        await new Promise(r=>setTimeout(r,200));assert.equal((await state()).phase,'paused');
        await page.click('#playButton');await page.waitForFunction(()=>purpleLayoutBridge.current().phase==='playing');
        // Observe a genuine end-to-loop-start handoff at original playback speed.
        const seam=await page.evaluate(({start,end})=>new Promise((resolve,reject)=>{
          const deadline=performance.now()+(end+8)*1000;let last=null;
          const tick=()=>{
            const deck=[...document.querySelectorAll('video')].find(v=>v.classList.contains('visible'));
            if(deck){const now={time:deck.currentTime,id:deck.id};if(last&&last.time>end-.5&&now.time<last.time-.1)return resolve({outgoing:last,incoming:now});last=now;}
            if(performance.now()>deadline)return reject(new Error('Loop handoff not observed'));requestAnimationFrame(tick);
          };tick();
        }),{start,end});assert(seam.incoming.time>=start-.05);assert(seam.incoming.time<end);record(host+' actual companion decode, pause protection and configured loop',seam);
      }else{
        await page.waitForFunction(()=>purpleLayoutBridge.current().phase==='held',{timeout:Math.max(25000,(look.duration+5)*1000)});
        const actual=await page.evaluate(()=>{const v=[...document.querySelectorAll('video')].find(v=>v.classList.contains('visible'));return v&&{time:v.currentTime,paused:v.paused};});
        assert(actual?.paused);assert(Math.abs(actual.time-look.freeze)<.15);record(host+' entry and actual freeze '+look.id,actual);
      }
    }
    await page.click('#layoutSwitch');await frames(page);
    assert.equal(await page.$eval('body',b=>b.dataset.layout),'island');
    if(await page.$eval('#islandWardrobe',b=>b.getAttribute('aria-expanded')!=='true'))await page.click('#islandWardrobe');
    await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.wardrobe')).opacity)>.99);
    await frames(page);
    await page.screenshot({path:path.join(qa,host+'-compact.png')});
    record(host+' compact layout rendered');
    const selected=looks.find(x=>!x.companion)||looks[0],secondary=looks.find(x=>x.id!==selected.id);
    const oldIds=[...looks.map(x=>x.id).reverse(),'removed-look'];
    const custom=Math.max(.1,Math.min(selected.duration-.1,selected.freeze-.4));
    const seed={catalogIds:oldIds,current:oldIds.indexOf(selected.id),favorites:[oldIds.indexOf(selected.id),oldIds.length-1],
      freezes:oldIds.map(id=>id===selected.id?custom:looks.find(x=>x.id===id)?.freeze+.2),
      defaultFrames:Object.fromEntries(looks.map(x=>[x.id,x.freeze+.2])),
      wardrobeLooks:{[selected.group]:oldIds.indexOf(selected.id)},playbackMode:'freeze',autoHide:false,sound:false,welcomeSeen:true};
    await page.evaluate(({key,seed})=>{localStorage.setItem(key,JSON.stringify(seed));localStorage.setItem(key+'.interface','normal');localStorage.setItem('unrelated.keep','untouched');},{key,seed});
    await page.reload({waitUntil:'load'});
    await page.waitForFunction(({id,time})=>window.purpleLayoutBridge?.current().id===id&&purpleLayoutBridge.current().phase==='held'&&[...document.querySelectorAll('video')].some(v=>v.classList.contains('visible')&&Math.abs(v.currentTime-time)<.1),{},{id:selected.id,time:custom});
    let persisted=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.deepEqual(persisted.favorites.map(i=>looks[i].id),[selected.id]);
    assert.equal(looks[persisted.current].id,selected.id);
    if(secondary)assert.equal(persisted.freezes[looks.findIndex(x=>x.id===secondary.id)],secondary.freeze);
    assert.deepEqual(persisted.catalogIds,looks.map(x=>x.id));
    await page.reload({waitUntil:'load'});
    await page.waitForFunction(id=>window.purpleLayoutBridge?.current().id===id&&purpleLayoutBridge.current().phase==='held',{},selected.id);
    record(host+' stable-ID migration, custom frame, new default and reload persistence');
    await page.click('#settingsButton');await page.click('#resetSettingsButton');await page.click('#confirmReset');
    await page.waitForFunction(id=>purpleLayoutBridge.current().id===id&&purpleLayoutBridge.current().phase==='held',{},project.defaultLook);
    persisted=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    assert.deepEqual(persisted.favorites,[]);assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated.keep')),'untouched');
    record(host+' reset affects only this project');
    assert.equal(report.errors.length,0,JSON.stringify(report.errors));await context.close();
  }
  report.pass=true;
})().catch(e=>{report.pass=false;report.failure=e.stack;process.exitCode=1;console.error(e);}).finally(async()=>{
  if(browser)await browser.close();fs.writeFileSync(path.join(qa,'result.json'),JSON.stringify(report,null,2));console.log(qa);
});
