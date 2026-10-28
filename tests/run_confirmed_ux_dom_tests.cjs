const assert=require('assert');
const fs=require('fs');
const http=require('http');
const os=require('os');
const path=require('path');
const {execFileSync,spawn}=require('child_process');

const root=path.resolve(__dirname,'..');
const opaqueExperience='  qa-unlisted-experience Ω / 7  ';
const trainingExperienceHelper='Варианты выбора пока не заданы в нормативной спецификации.';
function chromiumPath(){
  if(process.env.CHROMIUM_BIN)return process.env.CHROMIUM_BIN;
  for(const name of ['chromium','chromium-browser','google-chrome']){
    try{return execFileSync('which',[name],{encoding:'utf8'}).trim()}catch(_){/* try next */}
  }
  throw new Error('Chromium is required for the confirmed UX DOM test (set CHROMIUM_BIN to its executable path).');
}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function waitFor(fn,{timeout=15000,interval=100,label='condition'}={}){
  const deadline=Date.now()+timeout;let lastError;
  while(Date.now()<deadline){try{const result=await fn();if(result)return result;}catch(error){lastError=error;}await sleep(interval);}
  throw new Error(`Timed out waiting for ${label}${lastError?`: ${lastError.message}`:''}`);
}
function makeServer(){
  return http.createServer((req,res)=>{
    if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
    let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname)}catch(_){res.writeHead(400);res.end();return;}
    const file=path.resolve(root,`.${pathname}`);
    if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    fs.stat(file,(error,stat)=>{
      if(error||!stat.isFile()){res.writeHead(404);res.end('Not found');return;}
      const type=({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'})[path.extname(file).toLowerCase()]||'application/octet-stream';
      res.writeHead(200,{'content-type':type,'cache-control':'no-store'});if(req.method==='HEAD'){res.end();return;}fs.createReadStream(file).pipe(res);
    });
  });
}
function connectCdp(targetUrl){
  return new Promise((resolve,reject)=>{
    const socket=new WebSocket(targetUrl),pending=new Map();let nextId=0,closed=false;
    socket.addEventListener('open',()=>resolve({socket,call(method,params={}){if(closed)return Promise.reject(new Error('Chrome DevTools connection is closed'));const id=++nextId;return new Promise((res,rej)=>{const timer=setTimeout(()=>{pending.delete(id);rej(new Error(`CDP timeout: ${method}`));},10000);pending.set(id,{res,rej,timer,method});socket.send(JSON.stringify({id,method,params}));});},close(){closed=true;try{socket.close()}catch(_){}}}));
    socket.addEventListener('message',event=>{let message;try{message=JSON.parse(String(event.data))}catch(_){return;}if(!message.id)return;const item=pending.get(message.id);if(!item)return;clearTimeout(item.timer);pending.delete(message.id);if(message.error)item.rej(new Error(`${item.method}: ${message.error.message}`));else item.res(message)});
    socket.addEventListener('error',()=>reject(new Error('Chrome DevTools WebSocket connection failed')));
    socket.addEventListener('close',()=>{closed=true;for(const item of pending.values()){clearTimeout(item.timer);item.rej(new Error('Chrome DevTools connection closed'));}pending.clear();});
  });
}

(async()=>{
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'cindy-confirmed-ux-'));
  const server=makeServer();let browser,cdp,browserLog='';
  try{
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
    const pageUrl=`http://127.0.0.1:${server.address().port}/index.html`;
    browser=spawn(chromiumPath(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--disable-extensions','--disable-default-apps','--no-first-run','--remote-debugging-port=0','--remote-allow-origins=*',`--user-data-dir=${profile}`,'--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost','about:blank'],{stdio:['ignore','ignore','pipe']});
    browser.stderr.on('data',chunk=>{browserLog=(browserLog+chunk.toString()).slice(-4000)});
    const activePortFile=path.join(profile,'DevToolsActivePort');
    const portInfo=await waitFor(async()=>{if(browser.exitCode!==null)throw new Error(`Chromium exited with ${browser.exitCode}: ${browserLog}`);if(!fs.existsSync(activePortFile))return null;const [port]=fs.readFileSync(activePortFile,'utf8').trim().split(/\s+/);return port?{port:Number(port)}:null;},{timeout:15000,label:'Chromium DevTools endpoint'});
    const target=await waitFor(async()=>{const response=await fetch(`http://127.0.0.1:${portInfo.port}/json/list`);if(!response.ok)return null;return(await response.json()).find(item=>item.type==='page'&&item.webSocketDebuggerUrl);},{timeout:10000,label:'Chromium page target'});
    cdp=await connectCdp(target.webSocketDebuggerUrl);await cdp.call('Page.enable');await cdp.call('Runtime.enable');await cdp.call('Emulation.setDeviceMetricsOverride',{width:1280,height:1400,deviceScaleFactor:1,mobile:false});
    const seedValue=JSON.stringify({mode:'time',profile:{trainingExperience:opaqueExperience}}),seedRegistration=await cdp.call('Page.addScriptToEvaluateOnNewDocument',{source:`window.__profileSeedInjected=true;localStorage.setItem('cindyCfg',${JSON.stringify(seedValue)});`});
    await cdp.call('Page.navigate',{url:pageUrl});
    const evaluate=async(expression)=>{const reply=await cdp.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(reply.result.exceptionDetails)throw new Error(reply.result.exceptionDetails.text||'page evaluation failed');return reply.result.result.value;};
    const waitApp=async()=>waitFor(()=>evaluate(`document.readyState==='complete'&&Boolean(window.CINDYBootstrapV3&&window.CINDYBootstrapV3.ready===true)`),{timeout:15000,label:'application bootstrap'});
    await waitApp();
    await cdp.call('Page.removeScriptToEvaluateOnNewDocument',{identifier:seedRegistration.result.identifier});
    const click=async(selector,{keyboard=false}={})=>{
      const safeSelector=JSON.stringify(selector);
      const prepared=await evaluate(`(()=>{const el=document.querySelector(${safeSelector});if(!el)return null;const r=el.getBoundingClientRect(),v=visualViewport,visible=Boolean(v&&r.width>0&&r.height>0&&r.top>=0&&r.bottom<=v.height&&r.left>=0&&r.right<=v.width);if(!visible)el.scrollIntoView({behavior:'instant',block:'center',inline:'nearest'});return{visible,found:true}})()`);
      assert(prepared?.found,`control must exist: ${selector}`);
      await waitFor(()=>evaluate(`(()=>{const el=document.querySelector(${safeSelector}),r=el?.getBoundingClientRect(),s=el&&getComputedStyle(el),v=visualViewport;return Boolean(el&&r&&v&&r.width>0&&r.height>0&&r.top>=0&&r.bottom<=v.height&&r.left>=0&&r.right<=v.width&&s.display!=='none'&&s.visibility!=='hidden')})()`),{timeout:4000,label:`control scroll into viewport: ${selector}`});
      const point=await evaluate(`(()=>{const el=document.querySelector(${safeSelector}),r=el.getBoundingClientRect(),s=getComputedStyle(el);return{x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height,disabled:Boolean(el.disabled),visible:r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'}})()`);
      assert(point&&point.visible&&!point.disabled,`control must be visible and enabled: ${selector}`);
      if(keyboard){await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);await cdp.call('Input.dispatchKeyEvent',{type:'rawKeyDown',key:' ',code:'Space',windowsVirtualKeyCode:32});await cdp.call('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});}
      else{await cdp.call('Input.dispatchMouseEvent',{type:'mouseMoved',x:point.x,y:point.y});await cdp.call('Input.dispatchMouseEvent',{type:'mousePressed',x:point.x,y:point.y,button:'left',clickCount:1});await cdp.call('Input.dispatchMouseEvent',{type:'mouseReleased',x:point.x,y:point.y,button:'left',clickCount:1});}
      await sleep(120);
    };
    const reload=async()=>{await cdp.call('Page.reload',{ignoreCache:true});await waitApp();await sleep(100);};

    // The fixture is present before the first app load, so this observes loadConfig normalization/persistence.
    const loadedExperience=await evaluate(`JSON.parse(localStorage.getItem('cindyCfg')||'{}').profile?.trainingExperience`);
    assert.strictEqual(loadedExperience,opaqueExperience,'load/normalize preserves the exact opaque string');
    assert.strictEqual(await evaluate(`window.CINDYAppRuntimeV3?.getConfig()?.profile?.trainingExperience`),opaqueExperience,'runtime config retains the exact opaque string');

    // Profile disclosure is keyboard-operable, reports its state and respects reduced motion.
    await click('#navProfile');
    await click('#lightTheme');
    await waitFor(()=>evaluate(`!document.body.classList.contains('dark')&&document.getElementById('lightTheme')?.classList.contains('selected')`),{timeout:4000,label:'explicit light theme selected'});
    await evaluate(`(()=>{window.__uxScrollCalls=[];const original=Element.prototype.scrollIntoView;Element.prototype.scrollIntoView=function(options){if(this.matches&&this.matches('.profile-subsection[data-stage2-category]'))window.__uxScrollCalls.push({id:this.dataset.stage2Category,behavior:options&&options.behavior});return original.call(this,options)}})()`);
    await click('button[data-stage2-category="interface"]',{keyboard:true});
    await waitFor(()=>evaluate(`document.querySelector('.profile-subsection[data-stage2-category="interface"]')?.getAttribute('aria-hidden')==='false'`),{label:'Interface disclosure open'});
    await waitFor(()=>evaluate(`getComputedStyle(document.querySelector('button[data-stage2-category="interface"] .settings-chevron')).color==='rgb(17, 17, 17)'`),{timeout:4000,label:'light-theme disclosure indicator reaches black'});
    const disclosure=await evaluate(`(()=>{const b=document.querySelector('button[data-stage2-category="interface"]'),c=b.querySelector('.settings-chevron'),style=document.getElementById('cindy-confirmed-ux-polish-v1'),matching=[];for(const sheet of document.styleSheets){try{for(const rule of sheet.cssRules){if(rule.style&&rule.selectorText&&c.matches(rule.selectorText)&&rule.style.getPropertyValue('color'))matching.push({selector:rule.selectorText,color:rule.style.getPropertyValue('color'),important:rule.style.getPropertyPriority('color')})}}catch(_){}}return{expanded:b.getAttribute('aria-expanded'),pressed:b.getAttribute('aria-pressed'),controls:b.getAttribute('aria-controls'),detail:document.getElementById(b.getAttribute('aria-controls'))?.getAttribute('aria-hidden'),chevron:c.textContent,transform:getComputedStyle(c).transform,color:getComputedStyle(c).color,inline:c.getAttribute('style'),scroll:window.__uxScrollCalls.at(-1)?.behavior,light:!document.body.classList.contains('dark'),styleRules:style?.sheet?.cssRules.length,selectorMatch:c.matches('body:not(.dark) #profileSettingsCategories .choice[aria-expanded="true"] .settings-chevron'),matching}})()`);
    assert.strictEqual(disclosure.expanded,'true');assert.strictEqual(disclosure.pressed,'true');assert.strictEqual(disclosure.detail,'false');assert.strictEqual(disclosure.chevron,'⌄');assert.strictEqual(disclosure.transform,'none');assert(disclosure.light&&disclosure.color==='rgb(17, 17, 17)',`expanded indicator is black in a light theme: ${JSON.stringify(disclosure)}`);assert.strictEqual(disclosure.scroll,'smooth','normal-motion disclosure scrolls smoothly to its settings');
    await cdp.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    await click('button[data-stage2-category="soundVoice"]',{keyboard:true});
    await waitFor(()=>evaluate(`document.querySelector('.profile-subsection[data-stage2-category="soundVoice"]')?.getAttribute('aria-hidden')==='false'`),{label:'Sound/Voice disclosure open'});
    assert.strictEqual(await evaluate(`window.__uxScrollCalls.at(-1)?.behavior`),'auto','reduced-motion preference disables animated disclosure scroll');

    // Existing Pro and sound controls persist; date filters stay independent when progress display is off.
    await click('button[data-stage2-category="interface"]');
    await click('#experiencePro');
    await waitFor(()=>evaluate(`JSON.parse(localStorage.getItem('cindyCfg')||'{}').experienceMode==='pro'&&document.getElementById('experiencePro').classList.contains('selected')&&document.getElementById('experiencePro').getAttribute('aria-pressed')==='true'`),{label:'Pro mode persisted'});
    await reload();await click('#navProfile');await click('button[data-stage2-category="interface"]');
    assert.deepStrictEqual(await evaluate(`(()=>({mode:JSON.parse(localStorage.getItem('cindyCfg')||'{}').experienceMode,selected:document.getElementById('experiencePro').classList.contains('selected'),pressed:document.getElementById('experiencePro').getAttribute('aria-pressed'),body:document.body.dataset.experience}))()`),{mode:'pro',selected:true,pressed:'true',body:'pro'});
    const development=await evaluate(`document.getElementById('developmentViewSwitch').checked`);
    if(development)await click('#developmentViewSwitch');
    await click('.profile-period button:nth-child(2)');
    const periodCheck=await evaluate(`(()=>({off:JSON.parse(localStorage.getItem('cindyCfg')||'{}').profile.developmentView!==true,buttons:[...document.querySelectorAll('.profile-period button')].map(b=>({text:b.textContent.trim(),selected:b.classList.contains('selected'),visible:b.getBoundingClientRect().width>0}))}))()`);
    assert(periodCheck.off,'development display is off for the independent period-filter check');assert.deepStrictEqual(periodCheck.buttons.map(x=>x.text),['7 ДНЕЙ','28 ДНЕЙ','ВСЁ ВРЕМЯ']);assert(periodCheck.buttons.every(x=>x.visible));assert(periodCheck.buttons[1].selected);

    await click('button[data-stage2-category="soundVoice"]');
    const soundBefore=await evaluate(`document.getElementById('soundEnabled').checked`);
    await click('#soundEnabled');
    await waitFor(()=>evaluate(`document.getElementById('soundEnabled').checked!==${soundBefore}&&JSON.parse(localStorage.getItem('cindyCfg')||'{}').sound===document.getElementById('soundEnabled').checked`),{label:'sound setting persisted'});
    const soundAfter=await evaluate(`document.getElementById('soundEnabled').checked`);
    await reload();await click('#navProfile');await click('button[data-stage2-category="soundVoice"]');
    assert.strictEqual(await evaluate(`document.getElementById('soundEnabled').checked`),soundAfter,'sound control remains visible and persists in Pro mode');

    // Profile fields remain intact and are grouped; exclusions are no longer duplicated there.
    await click('button.profile-edit');
    const profileEditor=await evaluate(`(()=>{const g=document.querySelector('.profile-editor-group'),legend=g?.querySelector('legend'),labels=[...(g?.querySelectorAll('label')||[])],experience=labels.find(x=>x.textContent.includes('ОПЫТ ТРЕНИРОВОК'))?.querySelector('input');return{legend:legend?.textContent.trim(),fieldCount:labels.length,experienceDisabled:experience?.disabled,experienceValue:experience?.value,exerciseEditor:document.querySelector('.restriction-exercise-editor')!==null}})()`);
    assert.strictEqual(profileEditor.legend,'ЛИЧНЫЕ ДАННЫЕ');assert(profileEditor.fieldCount>=5);assert.strictEqual(profileEditor.experienceDisabled,true);assert.strictEqual(profileEditor.experienceValue,'','unsupported data is not exposed as an editable/selected UI value');assert.strictEqual(profileEditor.exerciseEditor,false);
    const responsiveExperience=[];
    for(const width of [320,390]){
      await cdp.call('Emulation.setDeviceMetricsOverride',{width,height:1400,deviceScaleFactor:1,mobile:true});await sleep(60);
      const responsive=await evaluate(`(()=>{const input=document.querySelector('input[aria-describedby="trainingExperienceHelp"]'),helper=document.getElementById('trainingExperienceHelp'),label=input?.closest('label');if(!input||!helper||!label)return null;helper.scrollIntoView({block:'nearest',inline:'nearest'});const r=helper.getBoundingClientRect(),f=label.getBoundingClientRect(),style=getComputedStyle(helper),range=document.createRange();range.selectNodeContents(helper);const lines=[...range.getClientRects()].map(x=>({left:x.left,right:x.right,top:x.top,bottom:x.bottom})),ancestorClips=[];for(let node=helper.parentElement;node;node=node.parentElement){const s=getComputedStyle(node),n=node.getBoundingClientRect(),clipX=['hidden','clip','auto','scroll'].includes(s.overflowX),clipY=['hidden','clip','auto','scroll'].includes(s.overflowY),left=n.left+node.clientLeft,top=n.top+node.clientTop,right=left+node.clientWidth,bottom=top+node.clientHeight,clipPath=s.clipPath;if(clipPath&&clipPath!=='none')ancestorClips.push({type:'clip-path',value:clipPath});if(lines.some(line=>(clipX&&(line.left<left-1||line.right>right+1))||(clipY&&(line.top<top-1||line.bottom>bottom+1))))ancestorClips.push({type:'overflow',tag:node.tagName,overflowX:s.overflowX,overflowY:s.overflowY})}return{text:helper.innerText.trim(),helperId:helper.id,describedBy:input.getAttribute('aria-describedby')?.trim().split(/\\s+/)||[],disabled:input.disabled,value:input.value,belowField:label.nextElementSibling===helper&&r.top>=f.bottom-1,width:innerWidth,viewportHeight:innerHeight,rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},clientWidth:helper.clientWidth,clientHeight:helper.clientHeight,scrollWidth:helper.scrollWidth,scrollHeight:helper.scrollHeight,display:style.display,visibility:style.visibility,opacity:parseFloat(style.opacity),overflowX:style.overflowX,overflowY:style.overflowY,textOverflow:style.textOverflow,lineClamp:style.getPropertyValue('-webkit-line-clamp'),lines,ancestorClips}})()`);
      assert(responsive,`trainingExperience helper exists at ${width}px`);assert.strictEqual(responsive.width,width);assert.strictEqual(responsive.text,trainingExperienceHelper);assert.strictEqual(responsive.helperId,'trainingExperienceHelp');assert(responsive.describedBy.includes('trainingExperienceHelp'),'disabled input is associated to its helper with aria-describedby');assert.strictEqual(responsive.disabled,true);assert.strictEqual(responsive.value,'','trainingExperience remains disabled and blank');assert(responsive.belowField,'helper is visibly below the disabled field');
      assert(responsive.rect.width>0&&responsive.rect.height>0&&responsive.rect.left>=0&&responsive.rect.right<=width+1&&responsive.rect.top>=0&&responsive.rect.bottom<=responsive.viewportHeight+1,'helper is inside the visible viewport');assert(responsive.display!=='none'&&responsive.visibility!=='hidden'&&responsive.opacity>0,'helper is visibly rendered');assert(responsive.scrollWidth<=responsive.clientWidth+1&&responsive.scrollHeight<=responsive.clientHeight+1,'helper content has no horizontal or vertical clipping');assert(responsive.overflowX==='visible'&&responsive.overflowY==='visible'&&responsive.textOverflow!=='ellipsis'&&(!responsive.lineClamp||responsive.lineClamp==='none'),'helper does not use clipping or ellipsis');assert(responsive.lines.length>0&&responsive.lines.every(line=>line.left>=responsive.rect.left-1&&line.right<=responsive.rect.right+1&&line.top>=responsive.rect.top-1&&line.bottom<=responsive.rect.bottom+1&&line.top>=0&&line.bottom<=responsive.viewportHeight+1),'every wrapped helper text line is fully visible');assert.deepStrictEqual(responsive.ancestorClips,[],'no clipping ancestor or clip-path hides any helper line');
      const textPoints=responsive.lines.map(line=>({x:line.left+(line.right-line.left)/2,y:(line.top+line.bottom)/2}));
      const foreground=await evaluate(`(()=>{const helper=document.getElementById('trainingExperienceHelp'),actions=document.getElementById('actionButtons'),sheet=document.querySelector('#actionModal .action-sheet'),body=document.getElementById('actionBody'),bar=actions?.getBoundingClientRect();if(!helper||!actions||!sheet||!body||!bar)return null;const points=${JSON.stringify(textPoints)};return{bar:{left:bar.left,right:bar.right,top:bar.top,bottom:bar.bottom},sticky:getComputedStyle(actions).position,sheetDisplay:getComputedStyle(sheet).display,sheetDirection:getComputedStyle(sheet).flexDirection,sheetOverflow:getComputedStyle(sheet).overflowY,bodyOverflow:getComputedStyle(body).overflowY,bodyScrollHeight:body.scrollHeight,bodyClientHeight:body.clientHeight,hits:points.map(point=>{const stack=document.elementsFromPoint(point.x,point.y),top=stack[0];return{x:point.x,y:point.y,helperOnTop:top===helper||helper.contains(top),actionInStack:stack.some(node=>node===actions||actions.contains(node)),topTag:top?.tagName,topClass:typeof top?.className==='string'?top.className:''}})}})()`);
      assert(foreground,`Profile sticky action geometry is available at ${width}px`);assert.strictEqual(foreground.sticky,'sticky','Cancel/Save controls remain sticky');
      assert.strictEqual(foreground.sheetDisplay,'flex','small-screen Profile sheet separates its scroll region from the action row');assert.strictEqual(foreground.sheetDirection,'column');assert.strictEqual(foreground.sheetOverflow,'hidden');assert(['auto','scroll'].includes(foreground.bodyOverflow),'Profile form content has its own scrollable region');
      assert(responsive.rect.bottom<=foreground.bar.top+0.5||responsive.rect.top>=foreground.bar.bottom-0.5,`the complete helper box is outside the sticky action bar at ${width}px`);
      assert(responsive.lines.every(line=>line.bottom<=foreground.bar.top+0.5||line.top>=foreground.bar.bottom-0.5),`every helper text line is geometrically outside the sticky action bar at ${width}px`);
      assert(foreground.hits.length===responsive.lines.length&&foreground.hits.every(hit=>hit.helperOnTop&&!hit.actionInStack),`elementsFromPoint confirms every helper line is foreground-readable, not covered by Cancel/Save at ${width}px: ${JSON.stringify(foreground.hits)}`);
      assert([2,3,4].includes(responsive.lines.length),`Chromium wraps the helper as expected at ${width}px: got ${responsive.lines.length}`);
      responsiveExperience.push({width,wrappedLines:responsive.lines.length,fullTextVisible:true});
    }
    let accessibleDescription='not available',ax=null,axError=null;
    try{await cdp.call('Accessibility.enable');ax=await cdp.call('Accessibility.getFullAXTree',{depth:-1})}catch(error){axError=error}
    if(ax){const nodes=ax.result.nodes||[],experienceNode=nodes.find(node=>node.role?.value==='textbox'&&node.name?.value?.trim()==='ОПЫТ ТРЕНИРОВОК');assert(experienceNode,'Chromium AX tree is available and exposes the disabled trainingExperience textbox');assert.strictEqual(experienceNode.description?.value,trainingExperienceHelper,'Chromium accessibility tree exposes the helper as the disabled field description');accessibleDescription=experienceNode.description.value}else accessibleDescription=`not available: ${axError?.message||'Chromium AX tree unavailable'}`;
    await cdp.call('Emulation.setDeviceMetricsOverride',{width:1280,height:1400,deviceScaleFactor:1,mobile:false});
    const profileUpdatedAt=await evaluate(`JSON.parse(localStorage.getItem('cindyCfg')||'{}').profile?.updatedAt`);
    const profileSaved=await evaluate(`(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='СОХРАНИТЬ'&&getComputedStyle(b).display!=='none');if(!button)return false;button.click();return true})()`);
    assert(profileSaved,'Profile save action is present');
    await waitFor(()=>evaluate(`JSON.parse(localStorage.getItem('cindyCfg')||'{}').profile?.updatedAt!==${JSON.stringify(profileUpdatedAt)}`),{label:'Profile save persisted'});
    assert.strictEqual(await evaluate(`JSON.parse(localStorage.getItem('cindyCfg')||'{}').profile?.trainingExperience`),opaqueExperience,'saving other Profile fields preserves the exact opaque trainingExperience');

    // The selector/count and arrows share one continuous Plan surface; reorder changes composition only.
    await click('#navPrograms');
    const beforeOrder=await evaluate(`(()=>{const c=JSON.parse(localStorage.getItem('cindyCfg')||'{}');return{composition:c.composition||[],target:c.target,longGoal:c.longGoal}})()`);
    assert(beforeOrder.composition.length>=2,'default composition provides reorderable exercises');
    const rowStyle=await evaluate(`(()=>{const r=document.querySelector('#programs .composition-row[data-composition-index="0"]'),slot=r?.querySelector('.composition-slot'),reorder=r?.querySelector('.composition-reorder'),moves=[...(r?.querySelectorAll('.composition-move')||[])],up=moves[0],down=moves[1],surface=r?.getBoundingClientRect(),selector=slot?.getBoundingClientRect(),controls=reorder?.getBoundingClientRect(),subject=up?.getAttribute('aria-label')?.replace(/^Переместить /,'').replace(/ выше$/,'');return{radius:r&&getComputedStyle(r).borderRadius,columns:r&&getComputedStyle(r).gridTemplateColumns,gap:r&&getComputedStyle(r).gap,sharedParent:Boolean(slot&&reorder&&slot.parentElement===r&&reorder.parentElement===r),arrowsInside:moves.length===2&&moves.every(button=>reorder.contains(button)&&r.contains(button)),labelsIdentifySameExercise:Boolean(subject&&down?.getAttribute('aria-label')==='Переместить '+subject+' ниже'),selectorHasCount:Boolean(slot?.querySelector('small')?.textContent.trim()),selectorWidth:selector?.width,reorderWidth:controls?.width,selectorRight:selector?.right,reorderLeft:controls?.left,insideSurface:Boolean(surface&&selector&&controls&&selector.left>=surface.left&&controls.right<=surface.right&&selector.top>=surface.top&&selector.bottom<=surface.bottom&&controls.top>=surface.top&&controls.bottom<=surface.bottom),upDisabled:up?.disabled,downDisabled:down?.disabled,upLabel:up?.getAttribute('aria-label'),downLabel:down?.getAttribute('aria-label')}})()`);
    assert.strictEqual(rowStyle.radius,'16px');assert(rowStyle.columns);assert(rowStyle.gap==='0px'||rowStyle.gap==='0px 0px','the shared surface has no visible inter-element gap');
    assert(rowStyle.sharedParent,'selector and reorder controls share the same outer exercise surface');assert(rowStyle.arrowsInside,'both up/down buttons are physically nested inside the shared surface');
    assert(rowStyle.selectorWidth>rowStyle.reorderWidth*5,'exercise selector occupies the main width');assert(rowStyle.selectorRight<=rowStyle.reorderLeft+1,'selector and arrow group meet without a visible gap');
    assert(rowStyle.insideSurface,'selector and arrows are geometrically contained by the one outer surface');assert(rowStyle.selectorHasCount,'the selector retains the exercise count');
    assert(rowStyle.labelsIdentifySameExercise,'both arrow labels identify the same exercise plus direction');
    assert.strictEqual(rowStyle.upDisabled,true,'up is disabled on the first exercise');assert.strictEqual(rowStyle.downDisabled,false);
    const initialBoundaries=await evaluate(`(()=>{const rows=[...document.querySelectorAll('#programs .composition-row[data-composition-index]')];return{firstUp:rows[0]?.querySelector('.composition-move:first-child')?.disabled,lastDown:rows.at(-1)?.querySelector('.composition-move:last-child')?.disabled}})()`);
    assert.deepStrictEqual(initialBoundaries,{firstUp:true,lastDown:true},'up/down boundary controls are disabled');
    await evaluate(`document.querySelector('#programs .composition-row[data-composition-index="0"]')?.scrollIntoView({behavior:'instant',block:'center'})`);
    const screenshot=await cdp.call('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
    const screenshotPath=path.resolve(root,'..','CINDY_POINT1_UNIFIED_ROW.png');fs.writeFileSync(screenshotPath,Buffer.from(screenshot.result.data,'base64'));
    await click('#programs .composition-row[data-composition-index="0"] .composition-move:last-child');
    await waitFor(()=>evaluate(`JSON.stringify(JSON.parse(localStorage.getItem('cindyCfg')||'{}').composition)===${JSON.stringify(JSON.stringify([beforeOrder.composition[1],beforeOrder.composition[0],...beforeOrder.composition.slice(2)]))}`),{label:'exercise reorder persisted'});
    const afterOrder=await evaluate(`(()=>{const c=JSON.parse(localStorage.getItem('cindyCfg')||'{}');return{composition:c.composition||[],target:c.target,longGoal:c.longGoal}})()`);
    assert.deepStrictEqual(afterOrder.composition,[beforeOrder.composition[1],beforeOrder.composition[0],...beforeOrder.composition.slice(2)],'reorder preserves all exercise data while swapping only the selected positions');
    assert.strictEqual(afterOrder.target,beforeOrder.target);assert.strictEqual(afterOrder.longGoal,beforeOrder.longGoal);
    const reorderedBoundaries=await evaluate(`(()=>{const rows=[...document.querySelectorAll('#programs .composition-row[data-composition-index]')];return{firstUp:rows[0]?.querySelector('.composition-move:first-child')?.disabled,lastDown:rows.at(-1)?.querySelector('.composition-move:last-child')?.disabled}})()`);
    assert.deepStrictEqual(reorderedBoundaries,{firstUp:true,lastDown:true},'boundary disabling remains correct after reorder');

    await click('#programs .composition-row[data-composition-index="0"] .composition-slot');
    const excludedId=await evaluate(`(()=>{const c=JSON.parse(localStorage.getItem('cindyCfg')||'{}');return c.composition[0].id})()`);
    const excludedName=await evaluate(`document.querySelector('[data-exercise-exclusion="${excludedId}"]')?.closest('label')?.querySelector('span')?.textContent`);
    assert(excludedName,'Plan composer exposes an exclusion control for each exercise');
    await click(`#exerciseExclusionEditor [data-exercise-exclusion="${excludedId}"]`,{keyboard:true});
    await waitFor(()=>evaluate(`(JSON.parse(localStorage.getItem('cindyCfg')||'{}').userRestrictions?.excludedExerciseIds||[]).includes(${JSON.stringify(excludedId)})`),{label:'exercise exclusion saved in existing userRestrictions'});
    const excludedState=await evaluate(`(()=>{const id=${JSON.stringify(excludedId)},name=${JSON.stringify(excludedName)},base=[...document.querySelector('#compositionSlots .composer .exercise-library').querySelectorAll('.exercise-chip')].find(b=>b.textContent.trim()===name),option=document.querySelector('[data-exercise-exclusion="'+id+'"]').closest('label');return{disabled:base?.disabled,marked:base?.classList.contains('is-user-excluded'),aria:base?.getAttribute('aria-label'),red:option.classList.contains('is-user-excluded'),checked:document.querySelector('[data-exercise-exclusion="'+id+'"]').checked}})()`);
    assert.strictEqual(excludedState.disabled,true);assert.strictEqual(excludedState.marked,true);assert(excludedState.aria.includes('исключено'));assert(excludedState.red&&excludedState.checked);
    await click(`#exerciseExclusionEditor [data-exercise-exclusion="${excludedId}"]`,{keyboard:true});
    await waitFor(()=>evaluate(`!(JSON.parse(localStorage.getItem('cindyCfg')||'{}').userRestrictions?.excludedExerciseIds||[]).includes(${JSON.stringify(excludedId)})`),{label:'exercise exclusion removed in the same Plan composer'});
    const restored=await evaluate(`(()=>{const name=${JSON.stringify(excludedName)},base=[...document.querySelector('#compositionSlots .composer .exercise-library').querySelectorAll('.exercise-chip')].find(b=>b.textContent.trim()===name);return{disabled:base?.disabled,marked:base?.classList.contains('is-user-excluded')}})()`);
    assert.strictEqual(restored.disabled,false);assert.strictEqual(restored.marked,false);

    // Ready/running button depth differs; voice still records a round and routes Пауза through pause().
    await cdp.call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
    await click('#navWorkout');
    const idleShadow=await evaluate(`getComputedStyle(document.getElementById('primaryAction')).boxShadow`);
    assert(idleShadow&&idleShadow!=='none','ready-state workout action has physical depth');
    await evaluate(`(()=>{window.__cindyFakeSpeech=[];window.SpeechRecognition=function(){this.start=()=>{};this.abort=()=>{};window.__cindyFakeSpeech.push(this)}})()`);
    await click('#primaryAction');
    await waitFor(()=>evaluate(`window.CINDYAppRuntimeV3.getSession().status==='running'`),{label:'workout starts'});
    await sleep(500);
    const runningStyle=await evaluate(`(()=>({shadow:getComputedStyle(document.getElementById('primaryAction')).boxShadow,live:document.querySelector('.action-deck')?.classList.contains('is-session-active')}))()`);
    assert(runningStyle.live&&runningStyle.shadow&&runningStyle.shadow!==idleShadow,'running action is visually distinct from ready state');
    const pressTransition=await evaluate(`getComputedStyle(document.getElementById('primaryAction')).transitionDuration`);
    await evaluate(`document.getElementById('primaryAction').classList.add('is-physical-press')`);await sleep(60);
    const pressedShadow=await evaluate(`getComputedStyle(document.getElementById('primaryAction')).boxShadow`);
    await evaluate(`document.getElementById('primaryAction').classList.remove('is-physical-press')`);await sleep(300);
    const releasedShadow=await evaluate(`getComputedStyle(document.getElementById('primaryAction')).boxShadow`);
    assert(pressTransition.split(',').some(v=>parseFloat(v)>0)&&pressedShadow!==runningStyle.shadow&&releasedShadow===runningStyle.shadow,'pressed state has distinct depth and returns smoothly to the live resting state');
    await click('#voiceAction');
    await waitFor(()=>evaluate(`window.__cindyFakeSpeech.length===1`),{label:'fake browser voice recognizer starts'});
    const initialRounds=await evaluate(`window.CINDYAppRuntimeV3.getSession().rounds`);
    await evaluate(`window.__cindyFakeSpeech[0].onresult({results:[[{transcript:'Круг'}]]})`);
    await waitFor(()=>evaluate(`window.CINDYAppRuntimeV3.getSession().rounds===${initialRounds+1}`),{label:'existing voice round command remains active'});
    await evaluate(`window.__cindyFakeSpeech[0].onend()`);
    await waitFor(()=>evaluate(`window.__cindyFakeSpeech.length>=2`),{timeout:5000,label:'voice recognizer restarts for its next one-shot command'});
    await evaluate(`window.__cindyFakeSpeech.at(-1).onresult({results:[[{transcript:'Пауза'}]]})`);
    await waitFor(()=>evaluate(`window.CINDYAppRuntimeV3.getSession().status==='paused'`),{label:'voice pause uses canonical paused session state'});

    // Finishing remains a separate user action; the result modal offers only OK and returns to Workout.
    await click('#primaryAction');await waitFor(()=>evaluate(`window.CINDYAppRuntimeV3.getSession().status==='running'`),{label:'paused workout resumes'});
    await click('#stopAction');
    await waitFor(()=>evaluate(`!document.getElementById('actionModal').classList.contains('hidden')&&[...document.querySelectorAll('#actionButtons button')].some(b=>b.textContent.trim()==='ЗАВЕРШИТЬ')`),{label:'finish confirmation is shown'});
    await click('#actionButtons button.stop');
    await waitFor(()=>evaluate(`!document.getElementById('resultModal').classList.contains('hidden')`),{label:'result modal is shown'});
    const result=await evaluate(`(()=>({actions:[...document.querySelectorAll('#resultModal .result-actions button')].map(b=>b.textContent.trim()),workoutVisible:getComputedStyle(document.getElementById('workout')).display!=='none'}))()`);
    assert.deepStrictEqual(result.actions,['ОК']);
    await click('#newWorkout');
    assert.strictEqual(await evaluate(`document.getElementById('resultModal').classList.contains('hidden')`),true);
    assert.strictEqual(await evaluate(`getComputedStyle(document.getElementById('workout')).display!=='none'`),true,'OK returns to Workout');
    await click('#navProgress');
    const journalRoute=await evaluate(`({visible:getComputedStyle(document.getElementById('progress')).display!=='none',tab:document.getElementById('navProgress').getAttribute('aria-current')})`);
    assert(journalRoute.visible,'the separate Progress/Journal tab remains accessible');

    console.log('CONFIRMED_UX_DOM_TESTS_PASS');
    console.log(JSON.stringify({disclosure:'keyboard + aria + light-theme down indicator + smooth/reduced motion',experienceMode:'Pro persists',periods:'7/28/all remain independent when progress display is off',sound:'visible and persistent in Pro',profile:'opaque round-trip preserved; editor remains disabled/blank; approved helper fully visible at 320/390px; aria-describedby linked; AX description: '+accessibleDescription,responsiveExperience,exerciseExclusion:'same userRestrictions field; visible/red/disabled; editable in Plan',reorder:'shared surface; arrows nested, labelled and boundary-disabled; exact composition swap; target/longGoal unchanged',screenshot:screenshotPath,voice:'Круг preserved; Пауза uses paused session state',result:'single OK returns to Workout; Progress tab remains'},null,2));
  }catch(error){console.error('CONFIRMED_UX_DOM_TESTS_FAIL',error.stack||error);if(browserLog)console.error('Chromium log tail:',browserLog);process.exitCode=1;}
  finally{if(cdp)cdp.close();if(browser&&browser.exitCode===null){browser.kill('SIGTERM');await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),sleep(2000)]);if(browser.exitCode===null)browser.kill('SIGKILL')}await new Promise(resolve=>server.close(()=>resolve()));fs.rmSync(profile,{recursive:true,force:true});}
})();
