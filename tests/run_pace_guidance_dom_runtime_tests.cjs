const assert=require('assert');
const fs=require('fs');
const http=require('http');
const os=require('os');
const path=require('path');
const {execFileSync,spawn}=require('child_process');

const root=path.resolve(__dirname,'..');
function chromiumPath(){
  if(process.env.CHROMIUM_BIN)return process.env.CHROMIUM_BIN;
  for(const name of ['chromium','chromium-browser','google-chrome']){
    try{return execFileSync('which',[name],{encoding:'utf8'}).trim()}catch(_){/* try next */}
  }
  throw new Error('Chromium is required for the Plan pace-guidance DOM/runtime test (set CHROMIUM_BIN to its executable path).');
}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function waitFor(fn,{timeout=15000,interval=100,label='condition'}={}){
  const deadline=Date.now()+timeout;
  let lastError;
  while(Date.now()<deadline){
    try{const result=await fn();if(result)return result;}catch(error){lastError=error;}
    await sleep(interval);
  }
  throw new Error(`Timed out waiting for ${label}${lastError?`: ${lastError.message}`:''}`);
}
function makeServer(){
  return http.createServer((req,res)=>{
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
    let pathname;
    try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname)}catch(_){res.writeHead(400);res.end();return;}
    const file=path.resolve(root,`.${pathname}`);
    if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    fs.stat(file,(statError,stat)=>{
      if(statError||!stat.isFile()){res.writeHead(404);res.end('Not found');return;}
      const type=({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'})[path.extname(file).toLowerCase()]||'application/octet-stream';
      res.writeHead(200,{'content-type':type,'cache-control':'no-store'});
      if(req.method==='HEAD'){res.end();return;}
      fs.createReadStream(file).pipe(res);
    });
  });
}
function connectCdp(targetUrl){
  return new Promise((resolve,reject)=>{
    const socket=new WebSocket(targetUrl);
    const pending=new Map();
    let nextId=0;
    let closed=false;
    socket.addEventListener('open',()=>resolve({
      socket,
      call(method,params={}){
        if(closed)return Promise.reject(new Error('Chrome DevTools connection is closed'));
        const id=++nextId;
        return new Promise((res,rej)=>{
          const timer=setTimeout(()=>{pending.delete(id);rej(new Error(`CDP timeout: ${method}`));},10000);
          pending.set(id,{res,rej,timer,method});
          socket.send(JSON.stringify({id,method,params}));
        });
      },
      close(){closed=true;try{socket.close()}catch(_){}}
    }));
    socket.addEventListener('message',event=>{
      let message;
      try{message=JSON.parse(String(event.data))}catch(_){return;}
      if(!message.id)return;
      const item=pending.get(message.id);
      if(!item)return;
      clearTimeout(item.timer);pending.delete(message.id);
      if(message.error)item.rej(new Error(`${item.method}: ${message.error.message}`));
      else item.res(message);
    });
    socket.addEventListener('error',()=>reject(new Error('Chrome DevTools WebSocket connection failed')));
    socket.addEventListener('close',()=>{closed=true;for(const item of pending.values()){clearTimeout(item.timer);item.rej(new Error('Chrome DevTools connection closed'));}pending.clear();});
  });
}

(async()=>{
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'cindy-pace-guidance-'));
  const server=makeServer();
  let browser,cdp;
  let browserLog='';
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
    const port=server.address().port;
    const pageUrl=`http://127.0.0.1:${port}/index.html`;
    browser=spawn(chromiumPath(),[
      '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
      '--disable-background-networking','--disable-extensions','--disable-default-apps','--no-first-run',
      '--remote-debugging-port=0','--remote-allow-origins=*',`--user-data-dir=${profile}`,
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost',pageUrl
    ],{stdio:['ignore','ignore','pipe']});
    browser.stderr.on('data',chunk=>{browserLog=(browserLog+chunk.toString()).slice(-4000)});
    const activePortFile=path.join(profile,'DevToolsActivePort');
    const portInfo=await waitFor(async()=>{
      if(browser.exitCode!==null)throw new Error(`Chromium exited with ${browser.exitCode}: ${browserLog}`);
      if(!fs.existsSync(activePortFile))return null;
      const [debugPort]=fs.readFileSync(activePortFile,'utf8').trim().split(/\s+/);
      return debugPort?{debugPort:Number(debugPort)}:null;
    },{timeout:15000,label:'Chromium DevTools endpoint'});
    const debugBase=`http://127.0.0.1:${portInfo.debugPort}`;
    const target=await waitFor(async()=>{
      const response=await fetch(`${debugBase}/json/list`);
      if(!response.ok)return null;
      const pages=await response.json();
      return pages.find(item=>item.type==='page'&&item.webSocketDebuggerUrl);
    },{timeout:10000,label:'Chromium page target'});
    cdp=await connectCdp(target.webSocketDebuggerUrl);
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');
    await cdp.call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    const evaluate=async(expression)=>{
      const reply=await cdp.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
      if(reply.result.exceptionDetails)throw new Error(reply.result.exceptionDetails.text||'page evaluation failed');
      return reply.result.result.value;
    };
    await evaluate(`new Promise((resolve,reject)=>{const start=Date.now();(function poll(){if(document.readyState==='complete'&&window.CINDYBootstrapV3&&window.CINDYBootstrapV3.ready===true){resolve(true);return}if(Date.now()-start>15000){reject(new Error('application bootstrap did not become ready'))}else setTimeout(poll,100)})()})`);

    const nav=await evaluate(`(()=>{const el=document.getElementById('navPrograms');if(!el)return null;el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,height:r.height,disabled:el.disabled}})()`);
    assert(nav&&nav.width>0&&nav.height>0&&!nav.disabled,'Plan tab must be rendered, visible, and enabled');
    await cdp.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:nav.x,y:nav.y});
    await cdp.call('Input.dispatchMouseEvent',{type:'mousePressed',x:nav.x,y:nav.y,button:'left',clickCount:1});
    await cdp.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:nav.x,y:nav.y,button:'left',clickCount:1});
    await waitFor(async()=>evaluate(`getComputedStyle(document.getElementById('programs')).display!=='none'`),{timeout:5000,label:'Plan screen navigation'});

    const defaultMode=await evaluate(`(()=>{const card=document.getElementById('paceGuideSetting'),config=JSON.parse(localStorage.getItem('cindyCfg')||'{}');return{mode:config.mode,hidden:card.classList.contains('hidden'),display:getComputedStyle(card).display}})()`);
    assert.strictEqual(defaultMode.mode,'time','fresh test profile must start in time-only mode');
    assert.strictEqual(defaultMode.hidden,true,'pace guidance remains hidden where its workout-specific feature is unsupported');
    assert.strictEqual(defaultMode.display,'none','unsupported time-only mode must not expose a nonfunctional pace control');

    const combined=await evaluate(`(()=>{const el=document.getElementById('combinedMode');if(!el)return null;el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,height:r.height,disabled:el.disabled}})()`);
    assert(combined&&combined.width>0&&combined.height>0&&!combined.disabled,'Time + rounds mode control must be visible and enabled in Plan');
    await cdp.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:combined.x,y:combined.y});
    await cdp.call('Input.dispatchMouseEvent',{type:'mousePressed',x:combined.x,y:combined.y,button:'left',clickCount:1});
    await cdp.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:combined.x,y:combined.y,button:'left',clickCount:1});
    await waitFor(async()=>evaluate(`JSON.parse(localStorage.getItem('cindyCfg')||'{}').mode==='combined'`),{timeout:5000,label:'Time + rounds mode update'});

    const before=await evaluate(`(()=>{const card=document.getElementById('paceGuideSetting'),control=document.getElementById('paceGuidance'),label=control&&control.closest('label');if(!card||!control||!label)return null;card.scrollIntoView({block:'center'});const cardRect=card.getBoundingClientRect(),labelRect=label.getBoundingClientRect(),style=getComputedStyle(card);return{mode:JSON.parse(localStorage.getItem('cindyCfg')||'{}').mode,hiddenClass:card.classList.contains('hidden'),display:style.display,visibility:style.visibility,cardWidth:cardRect.width,cardHeight:cardRect.height,labelWidth:labelRect.width,labelHeight:labelRect.height,disabled:control.disabled,checked:control.checked,persisted:JSON.parse(localStorage.getItem('cindyCfg')||'{}').paceGuidance===true,labelText:label.innerText}})()`);
    assert(before,'pace guidance card, input, and switch label must exist in the live Plan DOM');
    assert.strictEqual(before.mode,'combined','the behavioral check must use the supported Time + rounds mode');
    assert.strictEqual(before.hiddenClass,false,'pace guidance card must not carry the hidden class in the supported mode');
    assert.notStrictEqual(before.display,'none','pace guidance card must be displayed in the supported mode');
    assert.notStrictEqual(before.visibility,'hidden','pace guidance card must be visible in the supported mode');
    assert(before.cardWidth>0&&before.cardHeight>0&&before.labelWidth>0&&before.labelHeight>0,'pace guidance card and switch must occupy visible DOM bounds');
    assert.strictEqual(before.disabled,false,'pace guidance must be editable when no workout is active');
    assert.strictEqual(before.checked,false,'fresh test profile starts with pace guidance off');
    assert.strictEqual(before.persisted,false,'pace guidance starts off in persisted configuration');

    const switchPoint=await evaluate(`(()=>{const label=document.getElementById('paceGuidance').closest('label');const r=label.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`);
    await cdp.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:switchPoint.x,y:switchPoint.y});
    await cdp.call('Input.dispatchMouseEvent',{type:'mousePressed',x:switchPoint.x,y:switchPoint.y,button:'left',clickCount:1});
    await cdp.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:switchPoint.x,y:switchPoint.y,button:'left',clickCount:1});
    await waitFor(async()=>evaluate(`document.getElementById('paceGuidance').checked===true&&JSON.parse(localStorage.getItem('cindyCfg')||'{}').paceGuidance===true`),{timeout:5000,label:'pace guidance user toggle and persisted configuration'});
    const after=await evaluate(`(()=>({checked:document.getElementById('paceGuidance').checked,persisted:JSON.parse(localStorage.getItem('cindyCfg')||'{}').paceGuidance===true,mode:JSON.parse(localStorage.getItem('cindyCfg')||'{}').mode}))()`);
    assert.strictEqual(after.checked,true,'user click must activate the pace-guidance checkbox');
    assert.strictEqual(after.persisted,true,'user click must persist paceGuidance through the existing Plan setting path');
    assert.strictEqual(after.mode,'combined','the existing workout mode remains Time + rounds');
    console.log('PACE_GUIDANCE_DOM_RUNTIME_PASS');
    console.log(JSON.stringify({mode:after.mode,visible:true,editable:true,checked:after.checked,persisted:after.persisted,verification:'real Chromium DOM interaction on localhost with disposable profile'},null,2));
  }catch(error){
    console.error('PACE_GUIDANCE_DOM_RUNTIME_FAIL',error.stack||error);
    if(browserLog)console.error('Chromium log tail:',browserLog);
    process.exitCode=1;
  }finally{
    if(cdp)cdp.close();
    if(browser&&browser.exitCode===null){
      browser.kill('SIGTERM');
      await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),sleep(2000)]);
      if(browser.exitCode===null)browser.kill('SIGKILL');
    }
    await new Promise(resolve=>server.close(()=>resolve()));
    fs.rmSync(profile,{recursive:true,force:true});
  }
})();
