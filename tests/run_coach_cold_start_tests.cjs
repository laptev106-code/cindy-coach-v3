const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
const load=(file,context)=>vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const context=vm.createContext({window:{},console,JSON,Object,String,Number,Boolean,Array,Date,Math,structuredClone:global.structuredClone,Intl});
load('src/infrastructure/storage/coach_state_repository_v3.js',context);
load('src/application/coach/coach_application_service_v3.js',context);

const stored=new Map();
const storagePort={
  read:(key,fallback)=>stored.has(key)?JSON.parse(stored.get(key)):fallback,
  write:(key,value)=>{stored.set(key,JSON.stringify(value));return true;}
};
const stateRepository=context.window.CINDYCoachStateRepositoryV3.create({storagePort});
let history=[];
const config={mode:'combined',minutes:1,target:20,composition:[{id:'pull',count:1},{id:'push',count:1},{id:'squat',count:1}],equipment:{},userRestrictions:{},coachEnabled:true};
const clone=value=>JSON.parse(JSON.stringify(value));
const BASE_COMPOSITION=[{id:'pull',count:5},{id:'push',count:10},{id:'squat',count:15}];
const plain=value=>JSON.parse(JSON.stringify(value));
let enabled=true,lastCoreInput=null;
const core={
  MATRIX_VERSION:'test-matrix',
  COMPATIBILITY_VERSION:'test-compat',
  hash:value=>JSON.stringify(value),
  canonicalize:value=>clone(value),
  defaultMeasurementContract:mode=>({version:'test-contract',mode}),
  derive:(input)=>{
    lastCoreInput=clone(input);
    const cw=input.currentWorkout||{};
    const history=Array.isArray(input.history)?input.history:[];
    const isBaseline=input.baselineAuthority===true;
    const strict=history.filter(r=>r&&r.id&&r.v3&&r.v3.sessionPurpose!=='BASELINE').map(r=>r.id);
    const spec={
      specVersion:'3.0.0',decisionMode:'ADAPT',sessionPurpose:isBaseline?'BASELINE':'STANDARD',decisionStatus:'VALID',
      mode:cw.mode,formatPolicy:cw.formatPolicy,plannedSeconds:cw.plannedSeconds,target:cw.target,targetRounds:cw.targetRounds,
      composition:clone(cw.composition||[]),validation:{valid:true,errors:[]},
      contextFingerprint:'fp-'+JSON.stringify(cw),specId:'spec-'+JSON.stringify(cw),
      provenance:{decisionNow:input.decisionNow,decisionTimezone:input.decisionTimezone,specVersion:'3.0.0',coreVersion:'test-core',sourceSpecId:null},
      adaptation:{kind:isBaseline?'NONE':'ATOMIC',levers:isBaseline?[]:['COUNT'],leverCount:isBaseline?0:1,targetSlot:null}
    };
    return {authority:'COACH_CORE_V3',state:'VALID',decisionMode:spec.decisionMode,sessionPurpose:spec.sessionPurpose,decisionStatus:spec.decisionStatus,action:isBaseline?null:{type:'increase_count',exerciseId:'pull',slotId:null,delta:1},workoutSpec:spec,application:{allowed:true,requiresConfirmation:true,reasonCode:null,changedLever:null},diagnostics:{evidenceViews:{strictCohort:strict,trendCohort:strict}},inputProvenance:{strictCohortRecordIds:strict,trendCohortRecordIds:strict}};
  }
};
const makeService=()=>context.window.CINDYCoachApplicationServiceV3.create({
  core,
  stateRepository,
  configPort:{relevantSnapshot:()=>clone(config),currentConfig:()=>config,currentMode:()=>config.mode,maxExercises:()=>4,equipment:()=>({}),restrictions:()=>({}),excludedExerciseIds:()=>[],profileSnapshot:()=>({trainingExperience:'intermediate'}),applyCoachPatch:patch=>{Object.assign(config,patch||{});return true}},
  sessionPort:{get:()=>({status:'idle'}),replace:()=>{},save:()=>true,isRunning:()=>false},
  historyPort:{records:()=>clone(history)},
  contextPort:{currentCoachContext:()=>({mode:config.mode,formatPolicy:'fixed'}),profileSnapshot:()=>({}),formatPolicy:()=> 'fixed',programContext:()=>null},
  matrixPort:{get:()=>({version:'test-matrix',variants:{},baseDefaults:{}})},
  externalContextPort:{get:()=>null},
  activityPort:{isRunning:()=>false,isPaused:()=>false},
  clockPort:{now:()=> '2026-09-28T10:00:00.000Z',timezone:()=> 'UTC'},
  renderPort:{refresh:()=>{}},
  baselineAuthorityPort:{isAuthorized:()=>false,clear:()=>{}},
  workoutHistoryService:{freezeForStart:x=>x,restoreSessionContract:x=>x,decorateHistoryRecord:x=>x.raw,linkInterventionCompletion:x=>x.intervention},
  enabledPort:()=>enabled,
  integrityPort:{sha256:value=>JSON.stringify(value),canonicalJson:value=>JSON.stringify(value)},
  releaseManifest:{specVersion:'3.0.0'}
});

let service=makeService();
assert.deepStrictEqual(plain(service.readiness()),{phase:'NEEDS_BASELINE',baselineCompleted:false,completedTrainings:0,qualifyingTrainings:0,qualifyingDays:0,requiredCompletedTrainings:3,requiredTrainingDays:3,testPending:false,selectedTestMinutes:10,ready:false});
assert.deepStrictEqual(plain(service.baselineTestDefinition()),{version:'cindy-baseline-test-v2',mode:'time',defaultMinutes:10,allowedMinutes:[5,10,20],selectedMinutes:10,target:0,targetRounds:null,composition:BASE_COMPOSITION});

// The user's current configuration must never become the test.
assert.strictEqual(service.requestBaseline(5),true);
assert.strictEqual(service.state().baselineTestMinutes,5);
assert.strictEqual(service.baselineTestDefinition().selectedMinutes,5);
assert.strictEqual(service.readiness().testPending,true);
let prepared=service.prepareForStart({decisionNow:'2026-09-28T10:00:00.000Z'});
assert(prepared&&prepared.isBaseline,'baseline start must produce a dedicated test session');
assert.strictEqual(prepared.sessionRuntime.mode,'time');
assert.strictEqual(prepared.sessionRuntime.plannedSeconds,300);
assert.strictEqual(prepared.sessionRuntime.target,0);
assert.strictEqual(prepared.sessionRuntime.targetRounds,null);
assert.deepStrictEqual(prepared.sessionRuntime.composition,BASE_COMPOSITION);
assert.notDeepStrictEqual(prepared.sessionRuntime.composition,config.composition,'test must not use the current custom composition');

// Pending test survives service reload.
service=makeService();
assert.strictEqual(service.state().baselineTestMinutes,5);
assert.strictEqual(service.readiness().testPending,true);
assert.strictEqual(service.baselineTestDefinition().selectedMinutes,5);

// A different duration is accepted only when explicitly selected.
stored.clear();
service=makeService();
for(const minutes of [10,20]){
  assert.strictEqual(service.requestBaseline(minutes),true);
  const preview=service.previewBaselineTest({decisionNow:'2026-09-28T10:00:00.000Z'});
  assert.strictEqual(preview.sessionRuntime.mode,'time');
  assert.strictEqual(preview.sessionRuntime.plannedSeconds,minutes*60);
  assert.strictEqual(preview.sessionRuntime.target,0);
  stored.clear();
  service=makeService();
}
assert.strictEqual(service.requestBaseline(7),false,'only 5/10/20 minutes are valid test durations');

// Complete a valid 10-minute test; after successful completion it becomes the canonical Coach starting workout.
stored.clear();
config.mode='combined';config.minutes=1;config.target=20;config.composition=[{id:'pull',count:1},{id:'push',count:1},{id:'squat',count:1}];
service=makeService();
service.requestBaseline(10);
prepared=service.prepareForStart({decisionNow:'2026-09-28T10:00:00.000Z'});
service.reconcileAfterFinish({id:'partial-baseline',completedAt:'2026-09-28T10:00:00.000Z',rounds:7,endedBy:'manual',v3:{sessionPurpose:'BASELINE',executionFidelity:'PARTIAL',actualExecution:{endedBy:'manual'},plannedSpecSnapshot:prepared.frozenSpec}});
assert.strictEqual(service.readiness().phase,'NEEDS_BASELINE');
const canonicalBaseline={id:'baseline-record',completedAt:'2026-09-28T10:10:00.000Z',rounds:7,endedBy:'time',valid:true,v3:{sessionPurpose:'BASELINE',executionFidelity:'EXACT',actualExecution:{endedBy:'time',rounds:7,laps:[{n:1,duration:45},{n:2,duration:48},{n:3,duration:50}]},plannedSpecSnapshot:prepared.frozenSpec}};
history=[canonicalBaseline];
service.reconcileAfterFinish(canonicalBaseline);
assert.deepStrictEqual(plain(service.readiness()),{phase:'STARTER_READY',baselineCompleted:true,completedTrainings:0,qualifyingTrainings:0,qualifyingDays:0,requiredCompletedTrainings:3,requiredTrainingDays:3,testPending:false,selectedTestMinutes:10,ready:false});
assert.strictEqual(config.minutes,10,'successful test must establish the canonical Coach starting workout');
assert.strictEqual(config.mode,'time');
assert.strictEqual(config.target,0);
assert.deepStrictEqual(plain(config.composition),BASE_COMPOSITION);
// Time-only workouts must keep target at zero in the application input as well.
const postBaselineDecision=service.deriveDecision({decisionNow:'2026-09-28T10:15:00.000Z'});
assert.strictEqual(postBaselineDecision.workoutSpec.mode,'time');
assert.strictEqual(postBaselineDecision.workoutSpec.target,0);
assert.strictEqual(postBaselineDecision.workoutSpec.targetRounds,null);
assert.strictEqual(lastCoreInput.profile.trainingExperience,'','non-normative trainingExperience values are rejected before CoachCore input');
assert.strictEqual(service.currentOwnership(),'COACH','successful test establishes Coach authority over the canonical starting workout');
const starterApplied=service.apply();
assert.strictEqual(starterApplied.ok,true,'first post-test recommendation should be applicable immediately');
assert.strictEqual(service.state().starterApplied,true,'starter personalization state must persist after Apply');
assert.strictEqual(service.state().pendingIntervention,null,'starter personalization must not open a Level-B intervention window');
service=makeService();
assert.strictEqual(service.state().starterApplied,true,'starterApplied must survive Coach state reload');

history=[
  {id:'baseline-record',completedAt:'2026-09-28T10:10:00.000Z',rounds:7,v3:{sessionPurpose:'BASELINE',plannedSpecSnapshot:prepared.frozenSpec}},
  {id:'evidence-1',completedAt:'2026-09-29T10:00:00.000Z',rounds:4,v3:{sessionPurpose:'STANDARD'}},
  {id:'evidence-2',completedAt:'2026-09-30T10:00:00.000Z',rounds:5,v3:{sessionPurpose:'STANDARD'}},
  {id:'evidence-3',completedAt:'2026-10-01T10:00:00.000Z',rounds:5,v3:{sessionPurpose:'STANDARD'}}
];
assert.deepStrictEqual(plain(service.readiness()),{phase:'READY',baselineCompleted:true,completedTrainings:3,qualifyingTrainings:3,qualifyingDays:3,requiredCompletedTrainings:3,requiredTrainingDays:3,testPending:false,selectedTestMinutes:10,ready:true});

const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const token of [
  "title:'Тест для определения данных'",
  '5, 10 или 20 минут',
  'Количество кругов, время каждого круга и изменение темпа',
  'requestBaseline(minutes)',
  'previewBaselineTest',
  "minutes:10,target:7",
  'Тест подготовлен',
  'testPending',
  'НАЧАТЬ'
]) assert(index.includes(token),`missing updated cold-start UI contract: ${token}`);
assert(!index.includes('Baseline сохранён'),'user-facing baseline wording must be removed');
assert(!index.includes('До завершения evidence Coach'),'user-facing English technical wording must be removed');
const snapshotStart=index.indexOf('function acceptSnapshot(raw,fileId){'),snapshotEnd=index.indexOf('async function locateDriveFile()',snapshotStart),snapshotImport=snapshotStart>=0&&snapshotEnd>snapshotStart?index.slice(snapshotStart,snapshotEnd):'';
assert(snapshotImport.includes("onHistoryMutation({kind:'replace',previousRecords})"),'Google Drive snapshot replacement must route canonical History through Coach invalidation');
assert(snapshotImport.includes('restorePrevious();return false'),'failed Coach invalidation must roll back imported app storage and runtime');

// OFF durably closes both unstarted baseline authority and intervention intent.
stateRepository.save({version:1,ownership:'COACH',baselineAuthority:true,baselineCompletedAt:null,baselineRecordId:null,baselineTestMinutes:10,starterApplied:false,preparedSpec:null,preparedFingerprint:null,appliedConfigFingerprint:'fp',pendingIntervention:{status:'PENDING',parentSpecId:'parent-spec',parentRecordId:'parent-record',childRecordId:null}});
enabled=false;service=makeService();assert.strictEqual(service.deriveDecision({decisionNow:'2026-10-02T10:00:00.000Z'}),null,'OFF blocks the application decision surface');assert.strictEqual(service.disable(),true);
const closed=stateRepository.load();assert.strictEqual(closed.baselineAuthority,false);assert.strictEqual(closed.pendingIntervention.status,'CLOSED_DISABLED');
enabled=true;service=makeService();service.deriveDecision({decisionNow:'2026-10-02T10:01:00.000Z'});
assert.strictEqual(service.state().baselineAuthority,false,'ON does not restore the unstarted baseline intent');assert.strictEqual(service.state().pendingIntervention.status,'CLOSED_DISABLED','terminal intervention audit state is retained');assert.strictEqual(lastCoreInput.baselineAuthority,false);assert.strictEqual(lastCoreInput.interventionWindow,null,'closed intervention state is excluded from CoachInput');
history=[canonicalBaseline];
stateRepository.save({version:1,ownership:'COACH',baselineAuthority:false,baselineCompletedAt:canonicalBaseline.completedAt,baselineRecordId:canonicalBaseline.id,baselineTestMinutes:10,starterApplied:true,preparedSpec:{specId:'stale'},preparedFingerprint:'stale',appliedConfigFingerprint:'fp',pendingIntervention:{status:'APPLIED',parentRecordId:canonicalBaseline.id,childRecordId:'evidence-1',parentSpecId:'baseline-spec'}});
service=makeService();history=[];
assert.strictEqual(service.onHistoryMutation({kind:'clear'}),true,'canonical clear is a supported History mutation');
const afterClear=service.state();assert.strictEqual(afterClear.baselineRecordId,null);assert.strictEqual(afterClear.baselineCompletedAt,null);assert.strictEqual(afterClear.baselineAuthority,false);assert.strictEqual(afterClear.starterApplied,false);assert.strictEqual(afterClear.pendingIntervention.status,'CLOSED_HISTORY_MUTATION');assert.strictEqual(afterClear.preparedSpec,null);assert.strictEqual(service.lastDerived(),null);assert.strictEqual(service.readiness().phase,'NEEDS_BASELINE');

// A full canonical History replacement invalidates pending child evidence and
// does not preserve baseline authority solely because an imported record reuses its ID.
const oldBaseline={id:'replace-baseline',completedAt:'2026-09-28T10:10:00.000Z',rounds:7,valid:true,v3:{sessionPurpose:'BASELINE'}};
const replacedBaseline={...oldBaseline,rounds:8};
const parentRecord={id:'parent-record',completedAt:'2026-09-29T10:00:00.000Z',rounds:5,v3:{sessionPurpose:'STANDARD',provenance:{specId:'parent-spec'}}};
const expectedChild={id:'evidence-child',completedAt:'2026-09-30T10:00:00.000Z',rounds:4,v3:{sessionPurpose:'STANDARD',executionFidelity:'EXACT',coachIntervention:{parentSpecId:'parent-spec'}}};
const replacementChild={...expectedChild,rounds:9};
history=[replacedBaseline,parentRecord,replacementChild];
stateRepository.save({version:1,ownership:'COACH',baselineAuthority:false,baselineCompletedAt:oldBaseline.completedAt,baselineRecordId:oldBaseline.id,baselineTestMinutes:10,starterApplied:true,preparedSpec:{specId:'stale'},preparedFingerprint:'stale',appliedConfigFingerprint:null,pendingIntervention:{status:'EXECUTED',parentSpecId:'parent-spec',parentRecordId:parentRecord.id,childRecordId:expectedChild.id,childRecord:expectedChild}});
service=makeService();
assert.strictEqual(service.onHistoryMutation({kind:'replace',previousRecords:[oldBaseline,parentRecord,expectedChild]}),true,'canonical History replacement is supported');
const afterReplace=service.state();assert.strictEqual(afterReplace.baselineRecordId,null,'changed imported content under a reused baseline ID invalidates baseline authority');assert.strictEqual(afterReplace.baselineCompletedAt,null);assert.strictEqual(afterReplace.starterApplied,false);assert.strictEqual(afterReplace.pendingIntervention.status,'CLOSED_HISTORY_MUTATION');assert.strictEqual(afterReplace.pendingIntervention.closedBy,'history_replace');assert.strictEqual(afterReplace.preparedSpec,null);assert.strictEqual(service.lastDerived(),null);

// Exact child content is accepted, but a record with the same ID and changed
// semantic payload is not allowed into CoachInput by ID alone.
const pendingLink={status:'EXECUTED',parentSpecId:'parent-spec',parentRecordId:parentRecord.id,childRecordId:expectedChild.id,childRecord:expectedChild};
stateRepository.save({version:1,ownership:'COACH',baselineAuthority:false,baselineCompletedAt:null,baselineRecordId:null,baselineTestMinutes:10,starterApplied:false,preparedSpec:null,preparedFingerprint:null,appliedConfigFingerprint:null,pendingIntervention:pendingLink});
history=[parentRecord,expectedChild];service=makeService();service.deriveDecision({decisionNow:'2026-10-02T10:00:00.000Z'});
assert.strictEqual(lastCoreInput.interventionWindow.childRecord.id,expectedChild.id,'an exact canonical child snapshot remains usable');
history=[parentRecord,replacementChild];service=makeService();service.deriveDecision({decisionNow:'2026-10-02T10:01:00.000Z'});
assert.strictEqual(lastCoreInput.interventionWindow,null,'a changed child reusing its ID is excluded from pending evidence');
console.log('COACH_COLD_START_TESTS_PASS');
