const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const pack=fs.readFileSync(path.join(root,'coach_core_v3','program_pack_v3.js'),'utf8');
const service=fs.readFileSync(path.join(root,'src','application','program','program_service_v3.js'),'utf8');
const meta=fs.readFileSync(path.join(root,'src','infrastructure','storage','program_meta_repository_v3.js'),'utf8');
const boot=fs.readFileSync(path.join(root,'src','composition','bootstrap_v3.js'),'utf8');
function ok(name,fn){fn();console.log('PASS '+name)}
ok('dead legacy adaptive coach stage removed',()=>assert(!/legacyAdaptiveCoachStage2\(|function comparableRecords\(|function tempoMetrics\(|function coachLevel\(|function loadPoint\(/.test(index)));
ok('program pack has no raw localStorage dependency',()=>assert(!/localStorage\./.test(pack)));
ok('program pack has no reload, monkey patch or hidden clock',()=>assert(!/location\.reload|localStorage\.setItem\s*=|originalSetItem|new Date\(|Date\.now/.test(pack)));
ok('program service is explicit and browser-free',()=>{assert(!/window\.localStorage|document\.|localStorage|MutationObserver|location\.|navigator\.|new Date\(|Date\.now/.test(service));assert(/bindRuntime/.test(service));});
ok('program metadata storage isolated in repository',()=>{assert(/localStorage/.test(meta));assert(/create\(/.test(meta));assert(!/localStorage/.test(service));});
ok('bootstrap wires program service and metadata repository',()=>{assert(/programService\.bindRuntime\(runtime\)/.test(boot));assert(/metaRepositoryApi\.create\(\)/.test(boot));assert(/program\.init\(\{runtime,metaRepository:programMetaRepository\}\)/.test(boot));});
ok('application index has one authoritative Program transition call',()=>{assert(!/function advanceProgram\(/.test(index));const matches=index.match(/completeWorkoutTransition\(result\)/g)||[];assert.strictEqual(matches.length,1);assert(!/CindyProgramPackV3\.onWorkoutFinished/.test(index));});
ok('program cycle API remains explicit',()=>assert(/prepareCycleRotation/.test(pack)&&/init\(options=\{\}\)/.test(pack)));
ok('bootstrap binds program transition ports',()=>assert(/bindTransitionPorts/.test(boot)));
ok('program service advances explicit program state',()=>{
  const vm=require('vm');
  const code=service;
  const calls=[];
  const config={programs:[{id:'p',days:[{}, {}, {}, {}]}],programState:{activeProgramId:'p',currentDayIndex:2,completedAt:null}};
  const context={console,window:{}};
  vm.runInNewContext(code,context,{filename:'program_service_v3.js'});
  context.window.CINDYProgramServiceV3.bindRuntime({getConfig:()=>config,setConfig:p=>{calls.push(p);return true},now:()=> '2026-09-28T00:00:00.000Z'});
  assert(context.window.CINDYProgramServiceV3.advanceAfterWorkout({id:'day3-complete',source:{programId:'p',dayIndex:2}}));
  assert.strictEqual(calls[0].programState.currentDayIndex,3);
});

console.log('DECOMPOSITION_STAGE7_HARDENING_PASS');
