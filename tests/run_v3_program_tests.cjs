const fs=require('fs');
const vm=require('vm');
const path=require('path');
const root=path.join(__dirname,'..');
const packCode=fs.readFileSync(path.join(root,'coach_core_v3','program_pack_v3.js'),'utf8');
const metaCode=fs.readFileSync(path.join(root,'src','infrastructure','storage','program_meta_repository_v3.js'),'utf8');
const serviceCode=fs.readFileSync(path.join(root,'src','application','program','program_service_v3.js'),'utf8');
const store=new Map();
let setConfigCalls=0;
let renderCalls=0;
let fakeConfig={version:8,templates:[
  {id:'cindy-classic',name:'Cindy — классика',builtIn:true,mode:'combined',minutes:20,target:10,paceGuidance:false,composition:[{id:'pull',count:5,variantId:'pull_pronated'},{id:'push',count:10,variantId:'push_classic'},{id:'squat',count:15,variantId:'squat_classic'}]},
  {id:'cindy-classic-10',name:'Cindy — классика 10',builtIn:true,mode:'combined',minutes:10,target:7,paceGuidance:false,composition:[{id:'pull',count:5,variantId:'pull_pronated'},{id:'push',count:10,variantId:'push_classic'},{id:'squat',count:15,variantId:'squat_classic'}]},
  {id:'cindy-variant',name:'Cindy — вариант',builtIn:true,mode:'combined',minutes:20,target:15,paceGuidance:false,composition:[{id:'pull',count:5,variantId:'pull_supinated'},{id:'push',count:10,variantId:'push_knee'},{id:'squat',count:15,variantId:'squat_classic'}]},
  {id:'cindy-mixed-15',name:'Cindy — смешанная 15',builtIn:true,mode:'time',minutes:15,target:0,paceGuidance:false,composition:[{id:'pull',count:5,variantId:'pull_narrow_pronated'},{id:'push',count:10,variantId:'push_classic'},{id:'squat',count:15,variantId:'squat_classic'},{id:'push',count:10,variantId:'push_narrow'}]}
],programs:[],programState:{activeProgramId:'',currentDayIndex:0,completedAt:null},mode:'time',minutes:20,target:20,composition:[{id:'pull',count:5},{id:'push',count:10},{id:'squat',count:15}]};
const clone=x=>JSON.parse(JSON.stringify(x));
function writeCfg(){store.set('cindyCfg',JSON.stringify(fakeConfig));}
writeCfg();
const localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem(k,v){store.set(k,String(v));},removeItem:k=>store.delete(k)};
const metaRepository={read(){const raw=localStorage.getItem('cindyV3ProgramMeta');return raw?JSON.parse(raw):null;},save(v){localStorage.setItem('cindyV3ProgramMeta',JSON.stringify(v));return true;},remove(){return localStorage.removeItem('cindyV3ProgramMeta')}};
const session={status:'idle'};
const runtime={
  getSession:()=>session,
  getConfig:()=>fakeConfig,
  setConfig(patch){
    setConfigCalls++;
    if(session.status==='running'||session.status==='paused') return false;
    fakeConfig={...fakeConfig,...clone(patch)};
    writeCfg();
    return true;
  },
  renderAll(){renderCalls++},
  now:()=> '2026-09-28T00:00:00.000Z'
};
const context={localStorage,console,window:{CINDYAppRuntimeV3:runtime,CINDYProgramMetaRepositoryV3:{create:()=>metaRepository}}};
vm.runInNewContext(metaCode,context,{filename:'program_meta_repository_v3.js'});
vm.runInNewContext(packCode,context,{filename:'program_pack_v3.js'});
vm.runInNewContext(serviceCode,context,{filename:'program_service_v3.js'});
if(!context.window.CindyProgramPackV3)throw new Error('program pack missing');
if(typeof context.window.CindyProgramPackV3.init!=='function')throw new Error('explicit init missing');
context.window.CindyProgramPackV3.init({runtime,metaRepository});
const service=context.window.CINDYProgramServiceV3;
service.bindRuntime(runtime);
service.bindTransitionPorts({programPack:context.window.CindyProgramPackV3,metaRepository});
let cfg=JSON.parse(store.get('cindyCfg'));
let p=cfg.programs.find(x=>x.id==='cindy-v3-four-day-rotation');
if(!p)throw new Error('program missing');
if(p.days.length!==4)throw new Error('expected 4 days');
const templates=new Map(cfg.templates.map(x=>[x.id,x]));
const day1=templates.get(p.days[0].templateId);
if(day1.id!=='cindy-classic'||day1.mode!=='combined'||day1.minutes!==20||day1.target!==10)throw new Error('day 1 must be 20 min + 10 rounds classic Cindy');
const day2=templates.get(p.days[1].templateId);
if(day2.id!=='cindy-classic-10'||day2.mode!=='combined'||day2.minutes!==10||day2.target!==7)throw new Error('day 2 must be 10 min + 7 rounds classic Cindy');
const day3=templates.get(p.days[2].templateId);
if(day3.id!=='cindy-variant'||day3.mode!=='combined'||day3.minutes!==20||day3.target!==15)throw new Error('day 3 must be 20 min + 15 rounds variant Cindy');
if(JSON.stringify(day3.composition.map(x=>[x.id,x.count,x.variantId]))!==JSON.stringify([['pull',5,'pull_supinated'],['push',10,'push_knee'],['squat',15,'squat_classic']]))throw new Error('day 3 composition mismatch');
const day4=templates.get(p.days[3].templateId);
if(day4.id!=='cindy-mixed-15'||day4.mode!=='time'||day4.minutes!==15||day4.composition.length!==4)throw new Error('day 4 must be 15 min mixed four-exercise Cindy');
if(JSON.stringify(day4.composition.map(x=>[x.id,x.count,x.variantId]))!==JSON.stringify([['pull',5,'pull_narrow_pronated'],['push',10,'push_classic'],['squat',15,'squat_classic'],['push',10,'push_narrow']]))throw new Error('day 4 composition mismatch');
const cycle1=p.days.map(d=>d.templateId).join('|');
if(setConfigCalls<1)throw new Error('initial plan was not applied through explicit runtime');

fakeConfig={...fakeConfig,programState:{activeProgramId:'cindy-v3-four-day-rotation',currentDayIndex:3,completedAt:null}};
writeCfg();
const rec={id:'record-day4',completedAt:'2026-09-27T20:30:00Z',rounds:7,source:{programId:'cindy-v3-four-day-rotation',dayIndex:3}};
const transition=service.completeWorkoutTransition(rec);
if(!transition.accepted||!transition.rotated)throw new Error('cycle did not rotate after explicit day4 completion event');
if(context.window.CindyProgramPackV3.onWorkoutFinished(rec))throw new Error('program pack must not own ProgramState after workout finish');
cfg=JSON.parse(store.get('cindyCfg'));
p=cfg.programs.find(x=>x.id==='cindy-v3-four-day-rotation');
const tm2=new Map(cfg.templates.map(x=>[x.id,x]));
const cycle2=p.days.map(d=>d.templateId).join('|');
if(cycle1!==cycle2)throw new Error('canonical four-day sequence changed after day 4 rotation');
if(JSON.parse(store.get('cindyV3ProgramMeta')).lastRotatedRecordId!=='record-day4')throw new Error('rotation marker missing');
if(cfg.programState.currentDayIndex!==0)throw new Error('rotation must return to day 1');

// Idempotency: same completion event cannot rotate twice.
const second=service.completeWorkoutTransition(rec);
if(second.accepted||second.rotated)throw new Error('same completion event rotated twice');
console.log('V3 PROGRAM FIXED TEST: PASS');
console.log(JSON.stringify({setConfigCalls,renderCalls,cycle1,cycle2,days:p.days.map(d=>d.templateId)},null,2));
