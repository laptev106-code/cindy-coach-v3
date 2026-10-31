const assert=require('assert');
const fs=require('fs');
const http=require('http');
const path=require('path');
const {execFileSync,spawn}=require('child_process');

const root=path.resolve(__dirname,'..');
const expectedComposition=[{id:'pull',count:5},{id:'push',count:10},{id:'squat',count:15}];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function chromiumPath(){
  if(process.env.CHROMIUM_BIN)return process.env.CHROMIUM_BIN;
  for(const name of ['chromium','chromium-browser','google-chrome']){
    try{return execFileSync('which',[name],{encoding:'utf8'}).trim()}catch(_){}
  }
  throw new Error('Chromium is required for the TIME baseline UI/runtime regression test.');
}

async function waitFor(fn,{timeout=15000,interval=50,label='condition'}={}){
  const deadline=Date.now()+timeout;let lastError;
  while(Date.now()<deadline){
    try{const value=await fn();if(value)return value}catch(error){lastError=error}
    await sleep(interval);
  }
  throw new Error(`Timed out waiting for ${label}${lastError?`: ${lastError.message}`:''}`);
}

function makeServer(){
  const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
  return http.createServer((req,res)=>{
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return}
    let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname)}catch(_){res.writeHead(400);res.end();return}
    const file=path.resolve(root,`.${pathname}`),relative=path.relative(root,file);
    if(relative.startsWith('..')||path.isAbsolute(relative)||relative==='evidence'||relative.startsWith(`evidence${path.sep}`)||relative.endsWith('.zip')){res.writeHead(403);res.end();return}
    fs.stat(file,(error,stat)=>{
      if(error||!stat.isFile()){res.writeHead(404);res.end('Not found');return}
      res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});
      if(req.method==='HEAD'){res.end();return}
      fs.createReadStream(file).pipe(res);
    });
  });
}

function connectCdp(targetUrl){
  return new Promise((resolve,reject)=>{
    const socket=new WebSocket(targetUrl),pending=new Map();let nextId=0,closed=false;
    socket.addEventListener('open',()=>resolve({
      call(method,params={}){
        if(closed)return Promise.reject(new Error('Chrome DevTools connection is closed'));
        const id=++nextId;
        return new Promise((res,rej)=>{
          const timer=setTimeout(()=>{pending.delete(id);rej(new Error(`CDP timeout: ${method}`))},30000);
          pending.set(id,{res,rej,timer,method});socket.send(JSON.stringify({id,method,params}));
        });
      },
      close(){closed=true;try{socket.close()}catch(_){}}
    }));
    socket.addEventListener('message',event=>{
      let message;try{message=JSON.parse(String(event.data))}catch(_){return}
      if(!message.id)return;
      const item=pending.get(message.id);if(!item)return;
      clearTimeout(item.timer);pending.delete(message.id);
      if(message.error)item.rej(new Error(`${item.method}: ${message.error.message}`));else item.res(message);
    });
    socket.addEventListener('error',()=>reject(new Error('Chrome DevTools WebSocket connection failed')));
    socket.addEventListener('close',()=>{closed=true;for(const item of pending.values()){clearTimeout(item.timer);item.rej(new Error('Chrome DevTools connection closed'))}pending.clear()});
  });
}

(async()=>{
  const profile=fs.mkdtempSync(path.join(require('os').tmpdir(),'cindy-time-baseline-chromium-'));
  const server=makeServer();let browser,cdp,browserLog='';
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
    const pageUrl=`http://127.0.0.1:${server.address().port}/index.html`;
    browser=spawn(chromiumPath(),[
      '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
      '--disable-background-networking','--disable-extensions','--disable-default-apps',
      '--no-first-run','--no-default-browser-check','--remote-debugging-port=0',
      '--remote-allow-origins=*',`--user-data-dir=${profile}`,
      '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost','about:blank'
    ],{stdio:['ignore','ignore','pipe']});
    browser.stderr.on('data',chunk=>{browserLog=(browserLog+chunk.toString()).slice(-4000)});
    const activePortFile=path.join(profile,'DevToolsActivePort');
    const endpoint=await waitFor(async()=>{
      if(browser.exitCode!==null)throw new Error(`Chromium exited ${browser.exitCode}: ${browserLog}`);
      if(!fs.existsSync(activePortFile))return null;
      const [port]=fs.readFileSync(activePortFile,'utf8').trim().split(/\s+/);
      return port?Number(port):null;
    },{timeout:20000,label:'disposable Chromium DevTools endpoint'});
    const target=await waitFor(async()=>{
      const response=await fetch(`http://127.0.0.1:${endpoint}/json/list`);
      if(!response.ok)return null;
      return(await response.json()).find(item=>item.type==='page'&&item.webSocketDebuggerUrl);
    },{timeout:10000,label:'Chromium page target'});
    cdp=await connectCdp(target.webSocketDebuggerUrl);
    await cdp.call('Page.enable');await cdp.call('Runtime.enable');await cdp.call('Network.enable');
    await cdp.call('Network.setBypassServiceWorker',{bypass:true});
    await cdp.call('Emulation.setDeviceMetricsOverride',{width:1280,height:1200,deviceScaleFactor:1,mobile:false});
    await cdp.call('Page.navigate',{url:pageUrl});

    const evaluate=async expression=>{
      const reply=await cdp.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
      if(reply.result.exceptionDetails)throw new Error(reply.result.exceptionDetails.text||'page evaluation failed');
      return reply.result.result.value;
    };
    const clickElement=async selector=>{
      const safe=JSON.stringify(selector);
      const prepared=await evaluate(`(()=>{const el=document.querySelector(${safe});if(!el)return null;el.scrollIntoView({behavior:'instant',block:'center',inline:'nearest'});const r=el.getBoundingClientRect(),s=getComputedStyle(el),v=visualViewport;return{found:true,disabled:Boolean(el.disabled),visible:Boolean(r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&v&&r.top>=0&&r.bottom<=v.height&&r.left>=0&&r.right<=v.width),x:r.left+r.width/2,y:r.top+r.height/2,text:(el.innerText||el.textContent||'').replace(/\\s+/g,' ').trim()}})()`);
      assert(prepared&&prepared.found,`UI element exists: ${selector}`);
      assert(prepared.visible&&!prepared.disabled,`UI element is visible and enabled: ${selector}`);
      await cdp.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:prepared.x,y:prepared.y});
      await cdp.call('Input.dispatchMouseEvent',{type:'mousePressed',x:prepared.x,y:prepared.y,button:'left',clickCount:1});
      await cdp.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:prepared.x,y:prepared.y,button:'left',clickCount:1});
      await sleep(120);
      return prepared.text;
    };
    const clickText=async label=>{
      const safe=JSON.stringify(label);
      const point=await evaluate(`(()=>{const wanted=${safe}.replace(/\\s+/g,' ').trim(),el=[...document.querySelectorAll('button')].find(item=>{const r=item.getBoundingClientRect(),s=getComputedStyle(item);return(item.innerText||item.textContent||'').replace(/\\s+/g,' ').trim()===wanted&&!item.disabled&&r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'});if(!el)return null;el.scrollIntoView({behavior:'instant',block:'center',inline:'nearest'});const r=el.getBoundingClientRect(),s=getComputedStyle(el),v=visualViewport;return{disabled:Boolean(el.disabled),visible:Boolean(r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&v&&r.top>=0&&r.bottom<=v.height&&r.left>=0&&r.right<=v.width),rect:{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height,viewportHeight:v?.height},x:r.left+r.width/2,y:r.top+r.height/2}})()`);
      assert(point,`visible UI button exists: ${label}`);
      assert(point.visible&&!point.disabled,`UI button is visible and enabled: ${label}; found=${JSON.stringify(point)}`);
      // Select by visible text, but invoke the application through real CDP mouse input.
      await cdp.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});
      await cdp.call('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});
      await cdp.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});
      await sleep(120);
      return label;
    };

    await waitFor(()=>evaluate(`document.readyState==='complete'&&Boolean(window.CINDYBootstrapV3&&window.CINDYBootstrapV3.ready===true)`),{timeout:20000,label:'application bootstrap'});
    assert.strictEqual(await evaluate(`localStorage.getItem('cindyHistory')`),null,'the truly disposable browser profile starts without training history');
    assert.strictEqual(await evaluate(`localStorage.getItem('cindyCoachV3State')`),null,'the truly disposable browser profile starts without Coach state');

    await clickElement('#navPrograms');
    await waitFor(()=>evaluate(`[...document.querySelectorAll('button')].some(b=>(b.innerText||b.textContent||'').replace(/\\s+/g,' ').trim()==='ПРОЙТИ ТЕСТ'&&getComputedStyle(b).display!=='none')`),{timeout:10000,label:'ordinary visible Coach baseline entry point'});
    await clickText('ПРОЙТИ ТЕСТ');
    await waitFor(()=>evaluate(`[...document.querySelectorAll('button')].some(b=>(b.innerText||b.textContent||'').replace(/\\s+/g,' ').trim()==='10 МИНУТ · РЕКОМЕНДУЕТСЯ'&&getComputedStyle(b).display!=='none')`),{label:'10-minute baseline choice in the UI'});
    await clickText('10 МИНУТ · РЕКОМЕНДУЕТСЯ');

    const prepared=await evaluate(`(()=>{const s=window.CINDYAppRuntimeV3?.getSession?.();return{timer:document.getElementById('timer')?.textContent?.trim(),mode:s?.mode,plannedSeconds:s?.plannedSeconds,target:s?.target,targetRounds:s?.targetRounds,composition:s?.composition?.map(x=>({id:x.id||x.exerciseId,count:x.count}))}})()`);
    assert.strictEqual(prepared.timer,'10:00','the visible Workout screen reflects the selected ten-minute baseline');
    assert.strictEqual(prepared.mode,'time','the UI path prepares normative TIME mode');
    assert.strictEqual(prepared.plannedSeconds,600,'the UI path prepares exactly 600 seconds');
    assert.strictEqual(prepared.target,0,`TIME has no planned round target before start (observed target ${prepared.target})`);
    assert(prepared.targetRounds==null,'TIME has no planned round targetRounds');
    assert.deepStrictEqual(prepared.composition,expectedComposition,'the planned baseline preserves 5/10/15 composition');

    await clickElement('#primaryAction');
    await waitFor(()=>evaluate(`window.CINDYAppRuntimeV3?.getSession?.()?.status==='running'`),{label:'ordinary Workout start action'});
    let running=await evaluate(`(()=>{const s=window.CINDYAppRuntimeV3.getSession(),p=JSON.parse(localStorage.getItem('cindyActiveSession')||'null');return{session:s,persisted:p}})()`);
    for(const [label,session] of [['runtime',running.session],['persisted',running.persisted]]){
      assert.strictEqual(session.mode,'time',`${label} session keeps TIME mode`);
      assert.strictEqual(session.plannedSeconds,600,`${label} session keeps plannedSeconds=600`);
      assert.strictEqual(session.target,0,`${label} session keeps target=0`);
      assert.deepStrictEqual(session.composition.map(x=>({id:x.id||x.exerciseId,count:x.count})),expectedComposition,`${label} session keeps 5/10/15 composition`);
      assert(session.targetRounds==null,`${label} session has no planned targetRounds`);
    }
    assert.strictEqual(running.session.status,'running','the normal Start control enters running state');
    assert.strictEqual(running.session.v3Ownership,'BASELINE','the normal application start freezes baseline ownership');
    assert.strictEqual(running.session.v3Spec?.mode,'time');
    assert.strictEqual(running.session.v3Spec?.plannedSeconds,600);
    assert.strictEqual(running.session.v3Spec?.target,0);
    assert(running.session.v3Spec?.targetRounds==null,'the frozen WorkoutSpec has no TIME round target');
    assert.deepStrictEqual(running.session.v3Spec?.composition?.map(x=>({id:x.exerciseId||x.id,count:x.count})),expectedComposition,'the frozen WorkoutSpec has standard 5/10/15 composition');
    assert.strictEqual(running.session.v3Spec?.sessionPurpose,'BASELINE');

    // A deliberately synthetic QA lap is recorded only through the ordinary visible primary UI control.
    await clickElement('#primaryAction');
    await waitFor(()=>evaluate(`window.CINDYAppRuntimeV3?.getSession?.()?.rounds===1`),{label:'one explicitly synthetic test-only UI lap'});
    running=await evaluate(`window.CINDYAppRuntimeV3.getSession()`);
    assert.strictEqual(running.laps.length,1,'the synthetic test lap is a real UI event, not an internal output mutation');

    // Reload the disposable app normally so the persisted session passes through normalizeSession before timer completion.
    await cdp.call('Page.reload',{ignoreCache:true});
    await waitFor(()=>evaluate(`window.CINDYAppRuntimeV3?.getSession?.()?.status==='running'&&window.CINDYAppRuntimeV3.getSession().rounds===1`),{timeout:20000,label:'ordinary active TIME session recovery after page reload'});
    running=await evaluate(`(()=>{const s=window.CINDYAppRuntimeV3.getSession(),p=JSON.parse(localStorage.getItem('cindyActiveSession')||'null');return{session:s,persisted:p}})()`);
    for(const [label,session] of [['recovered runtime',running.session],['recovered persistence',running.persisted]]){
      assert.strictEqual(session.mode,'time',`${label} keeps TIME mode`);
      assert.strictEqual(session.plannedSeconds,600,`${label} keeps plannedSeconds=600`);
      assert.strictEqual(session.target,0,`${label} keeps TIME target=0 after reload`);
      assert.strictEqual(session.rounds,1,`${label} preserves the actual UI lap after reload`);
      assert(session.targetRounds==null,`${label} has no planned round target`);
      assert.deepStrictEqual(session.composition.map(x=>({id:x.id||x.exerciseId,count:x.count})),expectedComposition,`${label} preserves 5/10/15 composition`);
    }
    assert.strictEqual(running.session.v3Spec?.target,0,'the recovered frozen WorkoutSpec keeps target=0');
    assert(running.session.v3Spec?.targetRounds==null,'the recovered frozen WorkoutSpec has no TIME round target');

    await cdp.call('Emulation.setVirtualTimePolicy',{policy:'advance',budget:610000,maxVirtualTimeTaskStarvationCount:10000});
    await waitFor(()=>evaluate(`!document.getElementById('resultModal')?.classList.contains('hidden')`),{timeout:20000,label:'ordinary ten-minute timer expiration and result UI'});
    const completed=await evaluate(`(()=>({history:JSON.parse(localStorage.getItem('cindyHistory')||'[]'),state:JSON.parse(localStorage.getItem('cindyCoachV3State')||'{}'),note:document.getElementById('resultNote')?.textContent?.trim()}))()`);
    const record=completed.history[0];
    assert(record,'the ordinary finish event persists a history record');
    assert.strictEqual(completed.history.length,1,'the disposable run creates only its one test record');
    assert.strictEqual(record.mode,'time');
    assert.strictEqual(record.plannedSeconds,600);
    assert.strictEqual(record.target,0,'persisted History does not re-clamp TIME target to one');
    assert.strictEqual(record.rounds,1,'the actual recorded UI lap is preserved');
    assert.strictEqual(record.endedBy,'time','the app timer, not manual stop, ends the baseline');
    assert.strictEqual(record.v3?.sessionPurpose,'BASELINE');
    assert.strictEqual(record.v3?.executionFidelity,'EXACT','normal TIME baseline execution reconciles as exact rather than globally relaxed');
    const spec=record.v3?.plannedSpecSnapshot,actual=record.v3?.actualExecution;
    assert(spec,'provenance preserves the planned/frozen WorkoutSpec');
    assert.strictEqual(spec.mode,'time');assert.strictEqual(spec.plannedSeconds,600);assert.strictEqual(spec.target,0);
    assert(spec.targetRounds==null,'the provenance snapshot has no TIME round target');
    assert.deepStrictEqual(spec.composition.map(x=>({id:x.exerciseId||x.id,count:x.count})),expectedComposition);
    assert.strictEqual(actual?.rounds,1,'actual execution rounds remain in provenance');
    assert.strictEqual(actual?.endedBy,'time','provenance records endedBy=time');
    assert.deepStrictEqual(actual?.composition?.map(x=>({id:x.id||x.exerciseId,count:x.count})),expectedComposition);
    assert.strictEqual(completed.state.baselineRecordId,record.id,'successful ordinary reconciliation promotes this exact baseline record');
    assert.strictEqual(completed.state.baselineCompletedAt,record.completedAt);
    assert.strictEqual(completed.state.baselineAuthority,false,'completed baseline authority is consumed normally');
    assert(completed.note.includes('Время закончилось'),'the visible result reports time expiration');

    console.log(JSON.stringify({result:'TIME_BASELINE_UI_RUNTIME_PASS',profile:'disposable candidate-local Chromium profile',ordinaryUiEntry:true,ordinaryStart:true,normalTimerFinish:true,syntheticTestOnlyUiLaps:1,mode:record.mode,plannedSeconds:record.plannedSeconds,target:record.target,targetRounds:spec.targetRounds??null,composition:record.composition,rounds:record.rounds,endedBy:record.endedBy,fidelity:record.v3.executionFidelity,baselineRecordId:completed.state.baselineRecordId},null,2));
  }catch(error){
    console.error(JSON.stringify({result:'TIME_BASELINE_UI_RUNTIME_FAIL',error:error.message,browserLog},null,2));
    process.exitCode=1;
  }finally{
    try{cdp?.close()}catch(_){}
    if(browser&&browser.exitCode===null){
      browser.kill('SIGTERM');
      await Promise.race([new Promise(resolve=>browser.once('close',resolve)),sleep(4000)]);
      if(browser.exitCode===null){browser.kill('SIGKILL');await Promise.race([new Promise(resolve=>browser.once('close',resolve)),sleep(2000)])}
    }
    if(server.listening)await new Promise(resolve=>server.close(()=>resolve()));
    try{fs.rmSync(profile,{recursive:true,force:true})}catch(error){console.error(`Could not remove disposable profile ${profile}: ${error.message}`);process.exitCode=1}
  }
})();
