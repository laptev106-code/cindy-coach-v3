const fs=require('fs');
const vm=require('vm');
const path=require('path');
const assert=require('assert');

const root=path.join(__dirname,'..');
const packCode=fs.readFileSync(path.join(root,'coach_core_v3','program_pack_v3.js'),'utf8');
const serviceCode=fs.readFileSync(path.join(root,'src','application','program','program_service_v3.js'),'utf8');
const metaCode=fs.readFileSync(path.join(root,'src','infrastructure','storage','program_meta_repository_v3.js'),'utf8');

function loadWorld({failConfig=false,failMeta=false,persist=null}={}){
  const store=new Map();
  let setConfigCalls=0;
  let metaWrites=0;
  let blockConfig=failConfig;
  let blockMeta=failMeta;
  let fakeConfig={version:8,templates:[],programs:[],programState:{activeProgramId:'',currentDayIndex:0,completedAt:null}};
  const clone=x=>JSON.parse(JSON.stringify(x));
  const writeCfg=()=>store.set('cindyCfg',JSON.stringify(fakeConfig));
  writeCfg();
  const localStorage={
    getItem:k=>store.has(k)?store.get(k):null,
    setItem(k,v){store.set(k,String(v));},
    removeItem:k=>store.delete(k)
  };
  const metaRepository={
    read(){const raw=localStorage.getItem('cindyV3ProgramMeta');return raw?JSON.parse(raw):null;},
    save(v){
      metaWrites++;
      if(blockMeta) return false;
      localStorage.setItem('cindyV3ProgramMeta',JSON.stringify(v));
      return true;
    },
    remove(){return localStorage.removeItem('cindyV3ProgramMeta');}
  };
  const runtime={
    getSession:()=>({status:'idle'}),
    getConfig:()=>fakeConfig,
    setConfig(patch){
      setConfigCalls++;
      if(blockConfig) return false;
      fakeConfig={...fakeConfig,...clone(patch)};
      writeCfg();
      return true;
    },
    renderAll(){},
    now:()=> '2026-09-28T00:00:00.000Z'
  };
  const context={localStorage,console,window:{}};
  vm.runInNewContext(metaCode,context,{filename:'program_meta_repository_v3.js'});
  vm.runInNewContext(packCode,context,{filename:'program_pack_v3.js'});
  vm.runInNewContext(serviceCode,context,{filename:'program_service_v3.js'});
  const pack=context.window.CindyProgramPackV3;
  const service=context.window.CINDYProgramServiceV3;
  pack.init({runtime,metaRepository});
  service.bindRuntime(runtime);
  service.bindTransitionPorts({programPack:pack,metaRepository,persist});
  return {pack,service,runtime,getConfig:()=>fakeConfig,meta:()=>metaRepository.read(),setConfigCalls:()=>setConfigCalls,metaWrites:()=>metaWrites,store,failConfig(v=true){blockConfig=v;},failMeta(v=true){blockMeta=v;}};
}

function pass(name,fn){fn();console.log('PASS',name);}

const world=loadWorld();
const programId=world.pack.programId;
world.runtime.setConfig({programState:{activeProgramId:programId,currentDayIndex:0,completedAt:null}});
const rec={id:'r-day4',source:{programId,dayIndex:3}};
pass('stale Day-4 event on Day 1 is ignored',()=>{
  const before=world.getConfig().programState.currentDayIndex;
  const result=world.service.completeWorkoutTransition(rec);
  assert.strictEqual(result.accepted,false);
  assert.strictEqual(result.reason,'day-mismatch');
  assert.strictEqual(world.getConfig().programState.currentDayIndex,before);
});

pass('event from another program is ignored',()=>{
  const result=world.service.completeWorkoutTransition({id:'other',source:{programId:'not-this',dayIndex:0}});
  assert.strictEqual(result.accepted,false);
  assert.strictEqual(result.reason,'inactive-program');
});

pass('wrong day is ignored',()=>{
  const result=world.service.completeWorkoutTransition({id:'wrong-day',source:{programId,dayIndex:2}});
  assert.strictEqual(result.accepted,false);
  assert.strictEqual(result.reason,'day-mismatch');
});

world.runtime.setConfig({programState:{activeProgramId:programId,currentDayIndex:3,completedAt:null}});
const day4={id:'day4-ok',source:{programId,dayIndex:3}};
pass('one Day-4 workout produces exactly one accepted transition and one rotation',()=>{
  const first=world.service.completeWorkoutTransition(day4);
  assert.strictEqual(first.accepted,true);
  assert.strictEqual(first.rotated,true);
  assert.strictEqual(first.toDayIndex,0);
  const replay=world.service.completeWorkoutTransition(day4);
  assert.strictEqual(replay.accepted,false);
  assert.strictEqual(replay.duplicate,true);
  assert.strictEqual(world.getConfig().programState.currentDayIndex,0);
  assert.strictEqual(world.meta().lastRotatedRecordId,'day4-ok');
});

pass('previous-cycle event cannot rotate again from Day 1',()=>{
  const result=world.service.completeWorkoutTransition({id:'old-cycle',source:{programId,dayIndex:3}});
  assert.strictEqual(result.accepted,false);
  assert.strictEqual(world.getConfig().programState.currentDayIndex,0);
});

pass('old processed record cannot replay after later transition',()=>{
  const later={id:'day1-next',source:{programId,dayIndex:0}};
  const advanced=world.service.completeWorkoutTransition(later);
  assert.strictEqual(advanced.accepted,true);
  const replay=world.service.completeWorkoutTransition(day4);
  assert.strictEqual(replay.accepted,false);
  assert.strictEqual(replay.duplicate,true);
  assert.strictEqual(world.getConfig().programState.currentDayIndex,1);
});

pass('program pack event handler does not mutate ProgramState',()=>{
  const before=JSON.stringify(world.getConfig().programState);
  assert.strictEqual(world.pack.onWorkoutFinished(day4),false);
  assert.strictEqual(JSON.stringify(world.getConfig().programState),before);
});

const malformed=loadWorld();
pass('empty program.days is fail-closed',()=>{
  malformed.runtime.setConfig({
    programs:[{id:programId,days:[]}],
    programState:{activeProgramId:programId,currentDayIndex:0,completedAt:null}
  });
  const result=malformed.service.completeWorkoutTransition({id:'empty-days',source:{programId,dayIndex:0}});
  assert.strictEqual(result.accepted,false);
  assert.strictEqual(result.reason,'malformed-program');
  assert.notStrictEqual(malformed.getConfig().programState.currentDayIndex,NaN);
});

pass('non-array program.days is fail-closed',()=>{
  malformed.runtime.setConfig({
    programs:[{id:programId,days:null}],
    programState:{activeProgramId:programId,currentDayIndex:0,completedAt:null}
  });
  const result=malformed.service.completeWorkoutTransition({id:'bad-days',source:{programId,dayIndex:0}});
  assert.strictEqual(result.accepted,false);
});

const failCfg=loadWorld();
failCfg.runtime.setConfig({programState:{activeProgramId:programId,currentDayIndex:1,completedAt:null}});
failCfg.failConfig(true);
pass('config write failure leaves ProgramState unchanged',()=>{
  const before=JSON.parse(JSON.stringify(failCfg.getConfig().programState));
  const result=failCfg.service.completeWorkoutTransition({id:'cfg-fail',source:{programId,dayIndex:1}});
  assert.strictEqual(result.accepted,false);
  assert.strictEqual(result.reason,'persist-failed');
  assert.deepStrictEqual(failCfg.getConfig().programState,before);
});

const failMetaWorld=loadWorld();
failMetaWorld.runtime.setConfig({programState:{activeProgramId:programId,currentDayIndex:3,completedAt:null}});
failMetaWorld.failMeta(true);
pass('metadata write failure rolls config back',()=>{
  const beforeDay=failMetaWorld.getConfig().programState.currentDayIndex;
  const beforeCycle=(failMetaWorld.meta()&&failMetaWorld.meta().cycleIndex)||0;
  const result=failMetaWorld.service.completeWorkoutTransition({id:'meta-fail',source:{programId,dayIndex:3}});
  assert.strictEqual(result.accepted,false);
  assert.strictEqual(failMetaWorld.getConfig().programState.currentDayIndex,beforeDay);
  assert.strictEqual((failMetaWorld.meta()&&failMetaWorld.meta().cycleIndex)||0,beforeCycle);
});

pass('retry after persist failure can succeed',()=>{
  const retry=loadWorld();
  let failOnce=true;
  retry.service.bindTransitionPorts({
    programPack:retry.pack,
    metaRepository:{
      read:()=>retry.meta(),
      save(){ if(failOnce){failOnce=false;return false;} return true; }
    }
  });
  retry.runtime.setConfig({programState:{activeProgramId:programId,currentDayIndex:2,completedAt:null}});
  const first=retry.service.completeWorkoutTransition({id:'retry-1',source:{programId,dayIndex:2}});
  assert.strictEqual(first.accepted,false);
  const second=retry.service.completeWorkoutTransition({id:'retry-1',source:{programId,dayIndex:2}});
  assert.strictEqual(second.accepted,true);
  assert.strictEqual(retry.getConfig().programState.currentDayIndex,3);
});

console.log('PROGRAM_TRANSITION_HARDENING_PASS');
