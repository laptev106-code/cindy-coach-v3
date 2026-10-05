const fs=require('fs');const path=require('path');const vm=require('vm');const assert=require('assert');
const root=path.resolve(__dirname,'..');
const turnOff=process.env.CINDY_TEST_COACH_OFF==='1';
const turnOffFailure=process.env.CINDY_TEST_COACH_OFF_FAILURE==='1';
const turnOffConfigFailure=process.env.CINDY_TEST_COACH_OFF_CONFIG_FAILURE==='1';
const turnCrossTab=process.env.CINDY_TEST_CROSS_TAB_OFF==='1';
const startOffBeforeCommit=process.env.CINDY_TEST_START_OFF_BEFORE_COMMIT==='1';
const startCommitSessionSaveFailure=process.env.CINDY_TEST_START_COMMIT_SAVE_FAILURE==='1';
const preferenceFixture=process.env.CINDY_TEST_COACH_PREF||'';
const directFacadeOff=process.env.CINDY_TEST_PUBLIC_COACH_OFF==='1';
const historyImportFixture=process.env.CINDY_TEST_HISTORY_IMPORT==='1';
const historyOffBaselineFixture=process.env.CINDY_TEST_HISTORY_OFF_BASELINE||'';
const paceGuidanceFixture=process.env.CINDY_TEST_PACE_GUIDANCE_FREEZE==='1';
const instrumentCore=directFacadeOff||preferenceFixture==='training-experience-invalid'||paceGuidanceFixture||Boolean(historyOffBaselineFixture);
let rawCoreDeriveCalls=0,lastRawCoreInput=null;
let paceBaselineHistory=null;
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace("function finish(end='manual')","window.__testFinish=()=>finish('time');window.__testDisableCoach=()=>setCoachEnabled(false);window.__testEnableCoach=()=>setCoachEnabled(true);window.__testCoachTransitionStatus=()=>coachTransitionStatus;function finish(end='manual')");
html=html.replace("function startResume(){","window.__testStartResume=()=>startResume();function startResume(){");
html=html.replace("function loadSession(){return normalizeSession(sessionRepository.load())}","window.__testReloadCoachSession=()=>{const raw=sessionRepository.load();session=normalizeSession(raw);if(raw&&window.CINDYSessionContractV3)session=window.CINDYSessionContractV3.apply(session,raw);return session};function loadSession(){return normalizeSession(sessionRepository.load())}");
html=html.replace("function acceptSnapshot(raw,fileId){","window.__testAcceptSnapshot=(raw,fileId)=>acceptSnapshot(raw,fileId);function acceptSnapshot(raw,fileId){");
html=html.replace("committed=coachApi&&typeof coachApi.commitStart", "if(window.__testBeforeCoachCommit)window.__testBeforeCoachCommit(prepared);committed=coachApi&&typeof coachApi.commitStart");
html=html.replace("const result=record(end),previousBest=allTimeBest()","const result=record(end);window.__lastRecord=result;const previousBest=allTimeBest()");
function scripts(src){const out=[],re=/<script\b([^>]*)>([\s\S]*?)<\/script>/gi;let m;while((m=re.exec(src))){const a=m[1]||'',s=a.match(/\bsrc=["']([^"']+)["']/i);if(s)out.push({src:s[1].replace(/^\.\//,'')});else if((m[2]||'').trim())out.push({code:m[2]})}return out}
function el(){const t={id:'',className:'',hidden:false,disabled:false,checked:false,value:'',textContent:'',innerHTML:'',dataset:{},children:[],parentElement:null,offsetWidth:320,offsetHeight:48,style:{setProperty(){},removeProperty(){},getPropertyValue(){return''}}};const p=new Proxy(t,{get(o,k){if(k in o)return o[k];if(k==='classList')return o.classList||(o.classList={add(){},remove(){},toggle(){return false},contains(){return false}});if(['addEventListener','removeEventListener','focus','blur','click','remove'].includes(k))return()=>{};if(k==='setAttribute')return(n,v)=>o[n]=v;if(k==='removeAttribute'||k==='getAttribute')return()=>null;if(k==='append'||k==='replaceChildren'||k==='appendChild'||k==='insertAdjacentElement')return(...xs)=>{if(k==='replaceChildren')o.children=[];xs.flat(Infinity).forEach(n=>{if(n){o.children.push(n);try{n.parentElement=p}catch{}}});return xs[0]||p};if(k==='querySelector')return()=>el();if(k==='querySelectorAll')return()=>[];if(k==='closest')return()=>null;if(k==='getBoundingClientRect')return()=>({left:0,top:0,width:100,height:48,right:100,bottom:48});if(typeof k==='symbol')return;const n=el();o[k]=n;return n},set(o,k,v){o[k]=v;return true}});t.parentElement=p;return p}
let failWriteKey=null,failWriteCount=null;const storage=new Map(),ls={getItem:k=>storage.has(k)?storage.get(k):null,setItem(k,v){if(k===failWriteKey){if(failWriteCount===null)throw new Error('injected-storage-write-failure:'+k);if(failWriteCount>1)failWriteCount-=1;else if(failWriteCount===1){failWriteCount=0;throw new Error('injected-storage-write-failure:'+k)}}storage.set(k,String(v))},removeItem:k=>storage.delete(k),clear(){storage.clear()},key:i=>Array.from(storage.keys())[i]||null,get length(){return storage.size}};
if(preferenceFixture==='legacy-unmarked-false')storage.set('cindyCfg',JSON.stringify({mode:'time',coachEnabled:false}));
if(preferenceFixture==='explicit-off')storage.set('cindyCfg',JSON.stringify({mode:'time',coachEnabled:false,coachEnabledChoice:'user'}));
if(preferenceFixture==='explicit-on')storage.set('cindyCfg',JSON.stringify({mode:'time',coachEnabled:true,coachEnabledChoice:'user'}));
if(preferenceFixture==='training-experience-invalid')storage.set('cindyCfg',JSON.stringify({mode:'time',profile:{trainingExperience:'intermediate'}}));
if(paceGuidanceFixture){
  storage.set('cindyCfg',JSON.stringify({mode:'combined',minutes:20,target:10,paceGuidance:true,equipment:{pullupBar:true}}));
  const composition=[{slotId:'slot-1',exerciseId:'pull',variantId:null,count:5,order:1},{slotId:'slot-2',exerciseId:'push',variantId:null,count:10,order:2},{slotId:'slot-3',exerciseId:'squat',variantId:null,count:15,order:3}];
  paceBaselineHistory={id:'pace-fixture-baseline',completedAt:'2026-10-03T10:00:00.000Z',mode:'time',plannedSeconds:600,target:0,rounds:1,duration:600,endedBy:'time',composition,sessionPurpose:'BASELINE',v3:{effectiveTimestamp:'2026-10-03T10:00:00.000Z',ownership:'BASELINE',sessionPurpose:'BASELINE',executionFidelity:'EXACT',actualExecution:{durationSeconds:600,rounds:1,endedBy:'time',composition,laps:[{index:1,seconds:52},{index:2,seconds:54},{index:3,seconds:56}]},plannedSpecSnapshot:{mode:'time',formatPolicy:'fixed',plannedSeconds:600,target:0,targetRounds:null,composition,sessionType:'BASELINE',ownership:'COACH'}}};
  storage.set('cindyHistory',JSON.stringify([paceBaselineHistory]));
  storage.set('cindyCoachV3State',JSON.stringify({version:1,ownership:'COACH',baselineAuthority:false,baselineCompletedAt:paceBaselineHistory.completedAt,baselineRecordId:paceBaselineHistory.id,baselineTestMinutes:10,starterApplied:false,preparedSpec:null,preparedFingerprint:null,appliedConfigFingerprint:null,pendingIntervention:null}));
}
if(historyOffBaselineFixture){
  const baseline={id:'qa-baseline-id',completedAt:'2026-10-03T10:00:00.000Z',rounds:5,duration:300,mode:'combined',plannedSeconds:300,target:5,v3:{sessionPurpose:'BASELINE',valid:true,historyMutation:false}};
  storage.set('cindyCfg',JSON.stringify({mode:'combined',minutes:5,target:5,coachEnabled:false,coachEnabledChoice:'user'}));
  storage.set('cindyHistory',JSON.stringify([baseline]));
  storage.set('cindyCoachV3State',JSON.stringify({version:1,ownership:'COACH',baselineAuthority:false,baselineCompletedAt:baseline.completedAt,baselineRecordId:baseline.id,baselineTestMinutes:5,starterApplied:false,preparedSpec:null,preparedFingerprint:null,appliedConfigFingerprint:'prior-fingerprint',pendingIntervention:null}));
}
const coachSwitchElement=el(),document={documentElement:{classList:{add(){},remove(){},toggle(){},contains(){return false}},style:{setProperty(){},removeProperty(){},getPropertyValue(){return''}},dataset:{}},body:{classList:{add(){},remove(){},toggle(){},contains(){return false}},appendChild(){},style:{},dataset:{}},visibilityState:'visible',getElementById:id=>id==='coachEnabledSwitch'?coachSwitchElement:el(),querySelector:()=>el(),querySelectorAll:()=>[],createElement:()=>el(),createTextNode:x=>{const n=el();n.textContent=String(x);return n},createTreeWalker:()=>({nextNode(){return null}}),addEventListener(){},removeEventListener(){}};
const ctx={console,Date,Intl,JSON,Math,Number,String,Boolean,Object,Array,RegExp,Error,TypeError,ReferenceError,Set,Map,parseInt,parseFloat,isNaN,isFinite,structuredClone,encodeURIComponent,decodeURIComponent,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},queueMicrotask:fn=>fn&&fn(),requestAnimationFrame:()=>0,cancelAnimationFrame(){},localStorage:ls,sessionStorage:ls,navigator:{userAgent:'CINDY-POST-TEST-SMOKE',vibrate(){return false}},location:{protocol:'https:',href:'https://cindy.local/index.html',pathname:'/index.html',reload(){}},history:{replaceState(){},pushState(){}},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init&&init.detail}},Event:class{constructor(type){this.type=type}},document,Node:function(){},NodeFilter:{SHOW_TEXT:4},HTMLElement:function(){},AudioContext:undefined,webkitAudioContext:undefined,MutationObserver:function(){this.observe=()=>{};this.disconnect=()=>{};this.takeRecords=()=>[]},matchMedia(){return{matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}}},getComputedStyle(){return{getPropertyValue(){return''}}},alert(){},confirm(){return false},prompt(){return null},innerWidth:390,innerHeight:844};ctx.window=ctx;ctx.self=ctx;ctx.globalThis=ctx;const windowEvents=new Map();ctx.dispatchEvent=event=>{for(const handler of windowEvents.get(event.type)||[])handler(event);return true};ctx.addEventListener=(type,handler)=>{const list=windowEvents.get(type)||[];list.push(handler);windowEvents.set(type,list)};ctx.removeEventListener=(type,handler)=>{const list=windowEvents.get(type)||[];windowEvents.set(type,list.filter(item=>item!==handler))};ctx.__dispatchWindowEvent=event=>ctx.dispatchEvent(event);vm.createContext(ctx);
for(const s of scripts(html)){
  vm.runInContext(s.src?fs.readFileSync(path.join(root,s.src),'utf8'):s.code,ctx,{filename:s.src||'index.html#inline'});
  if(instrumentCore&&s.src==='coach_core_v3/coach_core_v3.js'){
    const raw=ctx.CindyAdaptiveCoachV3;
    ctx.CindyAdaptiveCoachV3={...raw,derive(input){rawCoreDeriveCalls+=1;lastRawCoreInput=JSON.parse(JSON.stringify(input||{}));return raw.derive(input)}};
  }
}
assert(ctx.CindyCoachIntegration&&ctx.CINDYAppRuntimeV3&&ctx.CINDYBootstrapV3&&ctx.CINDYBootstrapV3.ready);
if(paceGuidanceFixture){
  const runtime=ctx.CINDYAppRuntimeV3,config=runtime.getConfig();
  assert.strictEqual(config.mode,'combined','the regression uses the supported Time + rounds Plan mode');
  assert.strictEqual(config.paceGuidance,true,'Plan starts with the user-selected pace guidance enabled');
  assert.strictEqual(ctx.CindyCoachIntegration.state().ownership,'COACH','fixture models an already Coach-owned current workout');
  assert.strictEqual(ctx.CINDYAppRuntimeV3.records()[0].v3.sessionPurpose,'BASELINE','fixture has a completed canonical Coach baseline');
  const startAndReload=expected=>{
    let prepared=null;
    ctx.__testBeforeCoachCommit=value=>{prepared=value};
    ctx.__testStartResume();
    const live=runtime.getSession();
    assert(prepared&&prepared.frozenSpec&&prepared.result,'real prepareForStart ran immediately before commitStart');
    assert.strictEqual(prepared.frozenSpec.mode,'combined');
    assert.strictEqual(prepared.sessionRuntime.paceGuidance,expected,'prepared Coach runtime freezes the Plan value');
    assert(prepared.frozenSpec.validation&&prepared.frozenSpec.validation.valid);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(prepared.frozenSpec,'paceGuidance'),false,'WorkoutSpec remains the normative schema without the runtime preference');
    assert.strictEqual(live.status,'running');
    assert.strictEqual(live.paceGuidance,expected,'commitStart installs the prepared setting on the frozen Coach session');
    assert(live.v3Spec&&live.v3Spec.specId,'commitStart freezes the real Coach WorkoutSpec');
    assert.strictEqual(live.v3SemanticSnapshots.configSnapshot.paceGuidance,expected,'the start-time Coach snapshot retains config.paceGuidance');
    assert.strictEqual(lastRawCoreInput.config.paceGuidance,expected,'the documented CoachInput.config receives the Plan value');
    const persisted=JSON.parse(storage.get('cindyActiveSession'));
    assert.strictEqual(persisted.paceGuidance,expected,'the Coach session runtime value persists');
    const reloaded=ctx.__testReloadCoachSession();
    assert.strictEqual(reloaded.paceGuidance,expected,'the app session normalizer restores the selected value on reload');
    assert.strictEqual(reloaded.v3Spec.specId,live.v3Spec.specId,'the frozen Coach WorkoutSpec contract restores on reload');
    ctx.__testFinish();
    assert.strictEqual(runtime.getSession().status,'idle','the fixture returns to idle before another Plan choice');
    storage.set('cindyHistory',JSON.stringify([paceBaselineHistory]));
  };
  startAndReload(true);
  assert.strictEqual(runtime.setConfig({paceGuidance:false}),true,'the Plan preference can be disabled between sessions');
  assert.strictEqual(ctx.CindyCoachIntegration.state().ownership,'COACH','changing the execution-only preference does not become a Builder mutation');
  startAndReload(false);
  assert.strictEqual(runtime.setConfig({paceGuidance:true}),true);
  assert.strictEqual(ctx.__testDisableCoach(),true,'Coach can be disabled to exercise the unchanged manual path');
  ctx.__testStartResume();
  const manualSession=runtime.getSession();
  assert.strictEqual(manualSession.mode,'combined');
  assert.strictEqual(manualSession.paceGuidance,true,'manual workout construction still uses the existing Plan setting');
  assert.strictEqual(manualSession.v3Spec||null,null,'manual workout start remains user-owned and does not acquire Coach provenance');
  assert.strictEqual(JSON.parse(storage.get('cindyActiveSession')).paceGuidance,true);
  assert.strictEqual(ctx.__testReloadCoachSession().paceGuidance,true,'manual session reload behavior is unchanged');
  console.log(JSON.stringify({result:'PACE_GUIDANCE_COACH_FREEZE_PASS',mode:'combined',coachTrueFrozenAndReloaded:true,coachFalseFrozenAndReloaded:true,manualPathUnchanged:true,workoutSpecContractUnchanged:true,coreAlgorithmChanged:false},null,2));
  process.exit(0);
}
if(directFacadeOff){
  rawCoreDeriveCalls=0;
  assert.strictEqual(ctx.__testDisableCoach(),true,'the persisted Coach switch transitions OFF');
  assert.strictEqual(ctx.CINDYAppRuntimeV3.getConfig().coachEnabled,false);
  assert.strictEqual(ctx.CindyAdaptiveCoachV3.derive({}),null,'direct public core facade fails closed');
  assert.strictEqual(ctx.CindyCoachV3.derive({}),null,'Coach V3 facade fails closed');
  assert.strictEqual(ctx.CindyCoachV3.application.derive({}),null,'application facade fails closed');
  assert.strictEqual(ctx.CindyCoachIntegration.derive({}),null,'integration facade fails closed');
  assert.strictEqual(ctx.CindyCoachIntegration.prepareForStart(),null);
  assert.strictEqual(ctx.CindyCoachIntegration.apply().kind,'disabled');
  assert.strictEqual(rawCoreDeriveCalls,0,'no public derive route invokes CoachCore while OFF');
  console.log(JSON.stringify({result:'PUBLIC_COACH_OFF_FACADE_PASS',allPublicDeriveFacadesClosed:true,coreDeriveCalls:rawCoreDeriveCalls},null,2));process.exit(0);
}
if(historyImportFixture){
  assert.strictEqual(ctx.CindyCoachIntegration.requestBaseline(5),true,'fixture creates a pending baseline authority');
  assert.strictEqual(ctx.CindyCoachIntegration.state().baselineAuthority,true);
  const imported={updatedAt:Date.now()+1000,config:ctx.CINDYAppRuntimeV3.getConfig(),history:[{id:'drive-imported-record',completedAt:'2026-10-03T10:00:00.000Z',rounds:4,valid:true}],active:ctx.CINDYAppRuntimeV3.getSession()};
  assert.strictEqual(ctx.__testAcceptSnapshot(imported,'drive-test-file'),true,'Google Drive snapshot import commits through the actual transaction');
  assert.strictEqual(ctx.CindyCoachIntegration.state().baselineAuthority,false,'canonical imported History invalidates pending baseline evidence');
  assert.strictEqual(ctx.CINDYAppRuntimeV3.records()[0].id,'drive-imported-record');
  console.log(JSON.stringify({result:'COACH_HISTORY_IMPORT_INVALIDATION_PASS',baselineAuthorityInvalidated:true,importedHistoryVisible:true},null,2));process.exit(0);
}
if(historyOffBaselineFixture){
  assert.strictEqual(ctx.CindyCoachIntegration.isEnabled(),false,'the pre-import preference is OFF');
  const original=ctx.CINDYAppRuntimeV3.records()[0];
  assert.strictEqual(original.id,'qa-baseline-id');
  assert.strictEqual(original.v3.sessionPurpose,'BASELINE');
  assert.strictEqual(original.v3.valid,true);
  const replacement=JSON.parse(JSON.stringify(original));
  if(historyOffBaselineFixture==='v3-invalid')replacement.v3.valid=false;
  else if(historyOffBaselineFixture==='history-mutation')replacement.v3.historyMutation=true;
  else throw new Error(`unknown History baseline fixture: ${historyOffBaselineFixture}`);
  const imported={updatedAt:Date.now()+1000,config:ctx.CINDYAppRuntimeV3.getConfig(),history:[replacement],active:ctx.CINDYAppRuntimeV3.getSession()};
  assert.strictEqual(ctx.__testAcceptSnapshot(imported,'drive-baseline-test-file'),true,'Drive replacement commits while Coach is OFF');
  assert.strictEqual(ctx.CindyCoachIntegration.isEnabled(),false,'snapshot import leaves Coach OFF');
  assert.strictEqual(ctx.CINDYAppRuntimeV3.records()[0].id,'qa-baseline-id','replacement deliberately reuses the baseline ID');
  if(historyOffBaselineFixture==='v3-invalid'){
    const reenabled={...JSON.parse(storage.get('cindyCfg')),coachEnabled:true,coachEnabledChoice:'user'};
    storage.set('cindyCfg',JSON.stringify(reenabled));
    assert.strictEqual(ctx.CINDYAppRuntimeV3.syncCoachPreference(true),true,'persisted ON preference is synchronized without rendering');
    assert.strictEqual(ctx.CindyCoachIntegration.onPreferenceChange(true,true),true,'Coach is explicitly re-enabled without calling readiness/render');
    assert.strictEqual(ctx.CindyCoachIntegration.isEnabled(),true);
    assert.strictEqual(rawCoreDeriveCalls,0,'no readiness, render, or prior public derive invoked CoachCore after re-enable');
    const stale=JSON.parse(storage.get('cindyCoachV3State'));
    assert.strictEqual(stale.baselineRecordId,'qa-baseline-id','same-ID invalid import leaves the stale identifier for direct derive to validate');
    assert.strictEqual(stale.baselineAuthority,false);
    assert.strictEqual(ctx.CINDYAppRuntimeV3.records()[0].v3.valid,false,'the canonical History row is invalid before direct derive');
    const direct=ctx.CindyCoachIntegration.derive();
    assert(direct,'direct public derive still returns the normal Coach decision envelope');
    assert.strictEqual(rawCoreDeriveCalls,1,'the direct integration derive is the first and only CoachCore call');
    assert.strictEqual(lastRawCoreInput.history.some(record=>record&&record.id==='qa-baseline-id'),false,'invalid BASELINE History is excluded before reaching CoachCore');
    assert.strictEqual(lastRawCoreInput.baselineAuthority,false,'stale baseline authority does not reach CoachCore');
    const cleared=JSON.parse(storage.get('cindyCoachV3State'));
    assert.strictEqual(cleared.baselineRecordId,null,'direct derive clears the stale baseline ID');
    assert.strictEqual(cleared.baselineCompletedAt,null,'direct derive clears the stale baseline timestamp');
    assert.strictEqual(cleared.baselineAuthority,false,'direct derive clears stale baseline authority');
    console.log(JSON.stringify({result:'COACH_OFF_DIRECT_DERIVE_BASELINE_VALIDATION_PASS',directDeriveFirst:true,invalidBaselineExcludedBeforeCore:true,staleBaselineIdCleared:true,staleBaselineAuthorityCleared:true},null,2));
    process.exit(0);
  }
  assert.strictEqual(ctx.__testEnableCoach(),true,'Coach can be enabled after import');
  const readiness=ctx.CindyCoachIntegration.readiness(),state=ctx.CindyCoachIntegration.state();
  assert.strictEqual(readiness.phase,'NEEDS_BASELINE',`${historyOffBaselineFixture}: invalid canonical baseline requires a fresh baseline`);
  assert.strictEqual(readiness.baselineCompleted,false,`${historyOffBaselineFixture}: ID alone cannot report completion`);
  assert.strictEqual(state.baselineRecordId,null,`${historyOffBaselineFixture}: stale baseline ID is cleared`);
  assert.strictEqual(state.baselineCompletedAt,null,`${historyOffBaselineFixture}: stale completion timestamp is cleared`);
  assert.strictEqual(JSON.parse(storage.get('cindyCoachV3State')).baselineRecordId,null,'the invalidation is persisted');
  console.log(JSON.stringify({result:'COACH_OFF_DRIVE_BASELINE_REVALIDATION_PASS',fixture:historyOffBaselineFixture,phase:readiness.phase,baselineCompleted:readiness.baselineCompleted,staleBaselineRecordIdCleared:true},null,2));process.exit(0);
}
if(preferenceFixture==='training-experience-invalid'){
  const cfg=ctx.CINDYAppRuntimeV3.getConfig();
  const storedValue=cfg.profile&&cfg.profile.trainingExperience;
  assert.strictEqual(storedValue,'intermediate','an unlisted string remains intact as opaque Profile data');
  ctx.CindyAdaptiveCoachV3.derive({profile:{trainingExperience:'intermediate'}});
  const unsupportedProfile=JSON.stringify(lastRawCoreInput.profile);
  assert.strictEqual(lastRawCoreInput.profile.trainingExperience,'','unsupported Profile data is neutralized before CoachCore');
  ctx.CindyAdaptiveCoachV3.derive({profile:{trainingExperience:''}});
  assert.strictEqual(JSON.stringify(lastRawCoreInput.profile),unsupportedProfile,'an unsupported value produces the same Coach semantic profile as an empty value');
  console.log(JSON.stringify({result:'TRAINING_EXPERIENCE_VALIDATION_PASS',storedProfileStringPreserved:true,unsupportedCoachValueNeutralized:true,coachSemanticProfileMatchesEmpty:true},null,2));process.exit(0);
}
if(preferenceFixture){
  const cfg=ctx.CINDYAppRuntimeV3.getConfig(),expectedOn=!['explicit-off'].includes(preferenceFixture),expectedOrigin=['explicit-off','explicit-on'].includes(preferenceFixture)?'user':'default';
  assert.strictEqual(cfg.coachEnabled,expectedOn,`${preferenceFixture}: Coach preference resolution`);
  assert.strictEqual(cfg.coachEnabledChoice,expectedOrigin,`${preferenceFixture}: preference provenance`);
  assert.strictEqual(ctx.CindyCoachIntegration.isEnabled(),expectedOn,`${preferenceFixture}: runtime gate`);
  if(!expectedOn){assert.strictEqual(ctx.CindyCoachIntegration.requestBaseline(5),false);assert.strictEqual(ctx.CindyCoachIntegration.derive(),null)}
  console.log(JSON.stringify({result:'COACH_PREFERENCE_FIXTURE_PASS',fixture:preferenceFixture,enabled:expectedOn,origin:expectedOrigin},null,2));process.exit(0);
}
if(startOffBeforeCommit||startCommitSessionSaveFailure){
  assert.strictEqual(ctx.CindyCoachIntegration.requestBaseline(5),true,'fixture requests an authorized baseline');
  if(startCommitSessionSaveFailure){failWriteKey='cindyActiveSession';failWriteCount=2}
  if(startOffBeforeCommit){
    ctx.__testBeforeCoachCommit=()=>{
      const tentative=ctx.CINDYAppRuntimeV3.getSession();
      ctx.__tentativeCoachSession=JSON.parse(JSON.stringify(tentative));
      ctx.__tentativePersistedSession=storage.get('cindyActiveSession');
      ctx.__coachEnabledImmediatelyBeforeOff=ctx.CINDYAppRuntimeV3.getConfig().coachEnabled;
      ctx.__disableCoachResult=ctx.__testDisableCoach();
    };
  }
  ctx.__testStartResume();
  const rolledBack=ctx.CINDYAppRuntimeV3.getSession();
  assert.strictEqual(rolledBack.status,'idle','an uncommitted Coach start returns to idle in runtime');
  assert.strictEqual(rolledBack.v3Spec||null,null);
  assert.strictEqual(rolledBack.v3SemanticSnapshots||null,null);
  assert.strictEqual(storage.get('cindyActiveSession')||null,null,'the tentative running session is removed from storage');
  if(startOffBeforeCommit){
    assert.strictEqual(ctx.__tentativeCoachSession.status,'running');
    const initiallyPersisted=JSON.parse(ctx.__tentativePersistedSession);
    assert.strictEqual(initiallyPersisted.status,'running','the initial save is visible immediately before OFF');
    assert.strictEqual(initiallyPersisted.v3Spec||null,null);
    assert.strictEqual(initiallyPersisted.v3SemanticSnapshots||null,null);
    assert.strictEqual(ctx.__coachEnabledImmediatelyBeforeOff,true);
    assert.strictEqual(ctx.__disableCoachResult,true,'the injected second-tab OFF transition is accepted');
    assert.deepStrictEqual(ctx.__tentativeCoachSession.composition.map(x=>({id:x.id,count:x.count})),[{id:'pull',count:5},{id:'push',count:10},{id:'squat',count:15}]);
    assert.strictEqual(ctx.CINDYAppRuntimeV3.getConfig().coachEnabled,false);
    assert.strictEqual(ctx.CindyCoachIntegration.isEnabled(),false);
    assert.strictEqual(JSON.parse(storage.get('cindyCoachV3State')).baselineAuthority,false,'OFF still closes baseline authority durably');
    console.log(JSON.stringify({result:'COACH_START_OFF_BEFORE_COMMIT_PASS',tentativeStartCancelled:true,runtimeAndStorageIdle:true,offRemainedFailClosed:true},null,2));
  }else{
    assert.strictEqual(ctx.CINDYAppRuntimeV3.getConfig().coachEnabled,true);
    assert.strictEqual(ctx.CindyCoachIntegration.isEnabled(),true);
    assert.strictEqual(JSON.parse(storage.get('cindyCoachV3State')).baselineAuthority,true,'a failed commit does not consume the authorized baseline attempt');
    console.log(JSON.stringify({result:'COACH_START_COMMIT_SAVE_FAILURE_PASS',secondSaveFailed:true,tentativeStartCancelled:true,runtimeAndStorageIdle:true},null,2));
  }
  process.exit(0);
}
assert.strictEqual(ctx.CindyCoachIntegration.requestBaseline(5),true);
const prepared=ctx.CindyCoachIntegration.prepareForStart();assert(prepared&&prepared.isBaseline&&prepared.frozenSpec);assert.strictEqual(prepared.sessionRuntime.plannedSeconds,300);assert.deepStrictEqual(prepared.sessionRuntime.composition.map(x=>({id:x.id||x.exerciseId,count:x.count})),[{id:'pull',count:5},{id:'push',count:10},{id:'squat',count:15}]);
ctx.CINDYAppRuntimeV3.replaceSession({...ctx.CINDYAppRuntimeV3.getSession(),...prepared.sessionRuntime,status:'running',startedAt:Date.now()-300000,accumulatedMs:300000,rounds:6});ctx.CindyCoachIntegration.commitStart({frozenSpec:prepared.frozenSpec,baselineAuthorizedAtStart:prepared.baselineAuthorizedAtStart,isBaseline:prepared.isBaseline});
const s=ctx.CINDYAppRuntimeV3.getSession();s.laps=Array.from({length:6},(_,i)=>({n:i+1,duration:40+i,total:(i+1)*40+i}));s.exerciseTotals={pull:30,push:60,squat:90};
let frozenAtStart=null,stateBeforePassiveFinish=null;
if(turnCrossTab){
  const beforeOrdinaryUpdate=storage.get('cindyCoachV3State'),otherConfig=JSON.parse(storage.get('cindyCfg'));
  otherConfig.theme=otherConfig.theme==='dark'?'light':'dark';storage.set('cindyCfg',JSON.stringify(otherConfig));
  ctx.__dispatchWindowEvent({type:'storage',key:'cindyCfg',newValue:storage.get('cindyCfg')});
  assert.strictEqual(ctx.CindyCoachIntegration.isEnabled(),true,'ordinary cross-tab config updates leave Coach enabled');
  assert.strictEqual(storage.get('cindyCoachV3State'),beforeOrdinaryUpdate,'ordinary cross-tab config updates must not close a pending Coach intent');
  assert.strictEqual(ctx.document.getElementById('coachEnabledSwitch').checked,true,'ordinary cross-tab config update keeps the visible switch ON');
  otherConfig.coachEnabled=false;otherConfig.coachEnabledChoice='user';storage.set('cindyCfg',JSON.stringify(otherConfig));
  ctx.__dispatchWindowEvent({type:'storage',key:'cindyCfg',newValue:storage.get('cindyCfg')});
  assert.strictEqual(ctx.CindyCoachIntegration.isEnabled(),false,'a second-tab explicit OFF immediately closes this tab runtime');
  assert.strictEqual(ctx.CINDYAppRuntimeV3.getConfig().coachEnabled,false,'the in-memory Coach preference follows the second tab');
  assert.strictEqual(ctx.document.getElementById('coachEnabledSwitch').checked,false,'the visible Settings switch follows the second tab');
  assert.strictEqual(ctx.CindyCoachIntegration.derive(),null,'derive cannot proceed after cross-tab OFF');
  assert.strictEqual(ctx.CindyCoachIntegration.apply().kind,'disabled','Apply cannot proceed after cross-tab OFF');
  assert.strictEqual(JSON.parse(storage.get('cindyCoachV3State')).baselineAuthority,false,'cross-tab OFF closes pending baseline authority durably');
  console.log(JSON.stringify({result:'CROSS_TAB_COACH_OFF_PASS',ordinaryConfigPreservedPendingIntent:true,explicitOffPropagated:true,visibleSwitchUpdated:true},null,2));
  process.exit(0);
}
if(turnOffConfigFailure){
  failWriteKey='cindyCfg';
  assert.strictEqual(ctx.__testDisableCoach(),false,'failed config persistence is reported to the switch handler');
  assert.strictEqual(ctx.CINDYAppRuntimeV3.getConfig().coachEnabled,false,'current-tab config remains OFF after failed save');
  assert.strictEqual(ctx.CindyCoachIntegration.isEnabled(),false,'raw prior ON value cannot reopen the current tab');
  assert.strictEqual(JSON.parse(storage.get('cindyCfg')).coachEnabled,true,'fixture proves the persisted ON value was not overwritten');
  assert.strictEqual(JSON.parse(storage.get('cindyCoachV3State')).baselineAuthority,false,'the durable Coach state transition still closes baseline authority');
  assert(ctx.__testCoachTransitionStatus().includes('выключен в этой вкладке'),'the persistence failure is exposed as a user-facing status');
  console.log(JSON.stringify({result:'COACH_OFF_CONFIG_FAILURE_PASS',currentTabFailClosed:true,failedChoiceReported:true},null,2));
  process.exit(0);
}
if(turnOffFailure){
  failWriteKey='cindyCoachV3State';
  const before=storage.get('cindyCoachV3State');
  assert.strictEqual(ctx.__testDisableCoach(),true,'OFF preference itself should persist while Coach-state storage is unavailable');
  assert.strictEqual(ctx.CindyCoachIntegration.isEnabled(),false,'failed state closure keeps the runtime OFF');
  assert.strictEqual(JSON.parse(storage.get('cindyCfg')).coachEnabled,false,'OFF preference remains persisted');
  assert.strictEqual(storage.get('cindyCoachV3State'),before,'failed closure does not corrupt or overwrite V3 state');
  assert.strictEqual(ctx.__testEnableCoach(),false,'ON is refused while pending-state closure cannot be verified');
  assert.strictEqual(ctx.CINDYAppRuntimeV3.getConfig().coachEnabled,false,'failed ON attempt restores the OFF switch');
  assert.strictEqual(ctx.CindyCoachIntegration.isEnabled(),false,'failed ON attempt remains fail-closed');
  failWriteKey=null;
  assert.strictEqual(ctx.__testEnableCoach(),true,'a later ON may proceed after retry durably closes pending state');
  assert.strictEqual(ctx.CindyCoachIntegration.isEnabled(),true);
  assert.strictEqual(ctx.CindyCoachIntegration.state().baselineAuthority,false,'retry cleared the old unstarted baseline request');
  console.log(JSON.stringify({result:'COACH_OFF_FAILURE_RETRY_PASS',offRemainedFailClosed:true,onBlockedUntilStateClosure:true,retryRecovered:true},null,2));
  process.exit(0);
}
if(turnOff){
  const frozenBeforeRetry=JSON.stringify(ctx.CINDYAppRuntimeV3.getSession()),persistedFrozenBeforeRetry=storage.get('cindyActiveSession');
  failWriteKey='cindyActiveSession';
  const duplicateCommit=ctx.CindyCoachIntegration.commitStart({frozenSpec:prepared.frozenSpec,baselineAuthorizedAtStart:prepared.baselineAuthorizedAtStart,isBaseline:prepared.isBaseline,rollbackSession:prepared.rollbackSession});
  failWriteKey=null;
  assert(duplicateCommit,'repeated commit recognizes an already frozen Coach session');
  assert.strictEqual(JSON.stringify(ctx.CINDYAppRuntimeV3.getSession()),frozenBeforeRetry,'recommit cannot mutate the genuinely running frozen session');
  assert.strictEqual(storage.get('cindyActiveSession'),persistedFrozenBeforeRetry,'recommit does not rewrite the active frozen session');
  ctx.__testDisableCoach();
  assert.strictEqual(ctx.CindyCoachIntegration.isEnabled(),false,'OFF must become an immediate runtime barrier');
  assert.strictEqual(ctx.CindyCoachIntegration.derive(),null,'derive is disabled immediately');
  assert.strictEqual(ctx.CindyCoachIntegration.apply().kind,'disabled','Apply cannot cross the OFF barrier');
  assert.strictEqual(ctx.CindyCoachIntegration.requestBaseline(5),false,'OFF cannot create a baseline intent');
  assert.strictEqual(ctx.CindyCoachIntegration.prepareForStart(),null,'OFF cannot prepare a Coach start');
  frozenAtStart=JSON.parse(JSON.stringify(ctx.CINDYAppRuntimeV3.getSession().v3SemanticSnapshots));
  ctx.CINDYAppRuntimeV3.getConfig().profile.age=99;
  stateBeforePassiveFinish=storage.get('cindyCoachV3State');
}
ctx.__testFinish();
if(turnOff){
  const hist=ctx.CINDYAppRuntimeV3.records(),latest=hist[0],stateAfterPassiveFinish=storage.get('cindyCoachV3State');
  assert(latest&&latest.v3,'OFF completion must still be recorded in History');
  assert.strictEqual(latest.v3.sessionPurpose,'BASELINE');
  assert.strictEqual(latest.v3.semanticSnapshotStatus,'FROZEN_AT_START');
  assert.strictEqual(latest.v3.semanticSnapshotHash,frozenAtStart.semanticSnapshotHash,'History uses the frozen start-time semantic hash');
  assert.strictEqual(latest.v3.snapshotCapturedAt,frozenAtStart.snapshotCapturedAt,'History keeps the original capture time');
  assert.strictEqual(latest.v3.profileSnapshot.age,frozenAtStart.profileSnapshot.age,'completion-time Profile changes cannot rewrite start semantics');
  assert.strictEqual(stateAfterPassiveFinish,stateBeforePassiveFinish,'passive OFF completion performs no post-OFF Coach-state write');
  assert.strictEqual(ctx.CindyCoachIntegration.state(),null);
  assert.strictEqual(ctx.CindyCoachIntegration.readiness(),null);
  assert.strictEqual(ctx.CindyCoachIntegration.migrationStatus().ready,true);
  const disabledState=JSON.parse(stateAfterPassiveFinish);
  assert.strictEqual(disabledState.baselineAuthority,false,'baseline attempt completed while OFF stays unauthorized');
  assert.strictEqual(disabledState.baselineRecordId,null,'baseline completion is not promoted after OFF');
  ctx.__testEnableCoach();
  assert.strictEqual(ctx.CindyCoachIntegration.isEnabled(),true,'an explicit ON choice restores Coach');
  assert.strictEqual(ctx.CindyCoachIntegration.state().baselineAuthority,false,'re-enable does not resurrect pending baseline intent');
  assert.strictEqual(ctx.CindyCoachIntegration.state().baselineRecordId,null);
  const noAutoResume=ctx.CindyCoachIntegration.prepareForStart();
  assert(!noAutoResume||noAutoResume.isBaseline===false,'ON cannot resume the former baseline request');
  assert.strictEqual(ctx.CindyCoachIntegration.requestBaseline(5),true,'a fresh explicit baseline request is required');
  const restarted=ctx.CindyCoachIntegration.prepareForStart();
  assert(restarted&&restarted.isBaseline,'only the new explicit request authorizes the next baseline');
  console.log(JSON.stringify({result:'COACH_OFF_SESSION_PASSIVE_COMPLETION_PASS',historyPreserved:true,frozenHash:latest.v3.semanticSnapshotHash,postOffStateUnchanged:true,baselineReauthorizedOnlyByExplicitRequest:true},null,2));
  process.exit(0);
}
const st=ctx.CindyCoachIntegration.state(),rd=ctx.CindyCoachIntegration.readiness(),dec=ctx.CindyCoachIntegration.derive({now:new Date().toISOString()}),hist=ctx.CINDYAppRuntimeV3.records(),latest=hist[0];
assert(st.baselineRecordId);assert.strictEqual(rd.phase,'STARTER_READY');assert.strictEqual(rd.testPending,false);assert(latest&&latest.v3);assert.strictEqual(latest.v3.sessionPurpose,'BASELINE');assert.strictEqual(latest.v3.executionFidelity,'EXACT');assert.strictEqual(latest.rounds,6);assert.strictEqual(dec.decisionMode,'ADAPT');assert(dec.action);assert.strictEqual(dec.action.type,'change_variant');assert(dec.workoutSpec&&dec.workoutSpec.validation&&dec.workoutSpec.validation.valid);assert.strictEqual(dec.application.allowed,true);
const before=JSON.stringify(ctx.CINDYAppRuntimeV3.getConfig().composition);const applied=ctx.CindyCoachIntegration.apply();assert(applied.ok);const after=JSON.stringify(ctx.CINDYAppRuntimeV3.getConfig().composition);assert.notStrictEqual(after,before);assert.strictEqual(ctx.CindyCoachIntegration.state().starterApplied,true);assert.strictEqual(ctx.CindyCoachIntegration.state().pendingIntervention,null);
console.log(JSON.stringify({result:'REAL_POST_TEST_BROWSER_LIFECYCLE_PASS',testMinutes:5,testRounds:latest.rounds,fidelity:latest.v3.executionFidelity,firstAction:dec.action,applied:true,starterApplied:ctx.CindyCoachIntegration.state().starterApplied,pendingIntervention:ctx.CindyCoachIntegration.state().pendingIntervention},null,2));
