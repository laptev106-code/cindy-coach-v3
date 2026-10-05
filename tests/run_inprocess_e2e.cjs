const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const base = path.join(__dirname,'..');
const read = p => fs.readFileSync(path.join(base,p),'utf8');
const coreCode = read('coach_core_v3/coach_core_v3.js');
const adapterCode = read('coach_core_v3/coach_integration_v3.js');
const bootstrapCode = read('src/composition/bootstrap_v3.js');
const programCode = read('coach_core_v3/program_pack_v3.js');
const sessionContractCode = read('src/domain/workout/session_contract_v3.js');
const provenanceCode = read('src/domain/history/history_provenance_v3.js');
const workoutHistoryServiceCode = read('src/application/workout/workout_history_service_v3.js');
const storageCode = read('src/infrastructure/storage/local_storage_v3.js');
const coachStateRepositoryCode = read('src/infrastructure/storage/coach_state_repository_v3.js');
const coachStateMigrationCode = read('src/infrastructure/storage/coach_state_migration_v3.js');
const applicationServiceCode = read('src/application/coach/coach_application_service_v3.js');
const programServiceCode = read('src/application/program/program_service_v3.js');
const programMetaRepositoryCode = read('src/infrastructure/storage/program_meta_repository_v3.js');

const storage = new Map();
const history = [];
const session = {status:'idle'};
const state = {version:1, ownership:'BUILDER', baselineAuthority:false, preparedSpec:null, preparedFingerprint:null, appliedConfigFingerprint:null, pendingIntervention:null};
let renderCount = 0;

const config = {
  mode:'time', minutes:10, target:20,
  maxExercises:4,
  equipment:{pullupBar:true,resistanceBand:false,stableSupport:false,parallelBars:false,benchDipComfort:false},
  userRestrictions:{}, excludedExerciseIds:[], coachExcludedVariantIds:[], programContext:null,
  templates:[], programs:[], programState:{activeProgramId:'',currentDayIndex:0,completedAt:null},
  composition:[
    {id:'pull', count:1, variantId:'pull_pronated'},
    {id:'push', count:1, variantId:'push_classic'},
    {id:'squat', count:1, variantId:'squat_classic'}
  ], profile:{age:39,heightCm:169,weightKg:65,trainingExperience:'intermediate',goal:'GENERAL'}
};

const matrix = {
  version:'cindy-matrix-v1',
  baseDefaults:{pull:'pull_pronated',push:'push_classic',squat:'squat_classic',abs:'abs_controlled_curlup'},
  variants:{
    pull_pronated:{id:'pull_pronated',base:'pull',tier:'standard',difficulty:70,equipment:['pullupBar'],profile:{PULL:.90,SHOULDER_GIRDLE:.28,CORE:.35},confidence:'moderate',neighbors:['pull_assisted_band','pull_eccentric'],auto:true},
    pull_assisted_band:{id:'pull_assisted_band',base:'pull',tier:'easy',difficulty:45,equipment:['pullupBar','resistanceBand'],profile:{PULL:.70,SHOULDER_GIRDLE:.20,CORE:.25},confidence:'moderate',neighbors:['pull_pronated'],auto:true},
    push_classic:{id:'push_classic',base:'push',tier:'standard',difficulty:60,equipment:[],profile:{PUSH:.75,SHOULDER_GIRDLE:.25,CORE:.30},confidence:'moderate',neighbors:['push_knee'],auto:true},
    squat_classic:{id:'squat_classic',base:'squat',tier:'standard',difficulty:55,equipment:[],profile:{LEGS:.80,CORE:.25},confidence:'moderate',neighbors:['squat_elevated'],auto:true},
    abs_controlled_curlup:{id:'abs_controlled_curlup',base:'abs',tier:'standard',difficulty:50,equipment:[],profile:{CORE:.50},confidence:'practical',neighbors:[],auto:true}
  }
};

const localStorage = {
  getItem(k){return storage.has(k)?storage.get(k):null;},
  setItem(k,v){storage.set(k,String(v));},
  removeItem(k){storage.delete(k);},
  clear(){storage.clear();},
  key(i){return Array.from(storage.keys())[i] || null;},
  get length(){return storage.size;}
};

function saveSession(){return true;}
function currentCoachContext(){ return {mode:config.mode,formatPolicy:'fixed',allowedModes:['time','rounds','combined'],programContext:config.programContext}; }
function active(){ return session.status==='running' || session.status==='paused'; }
function records(){ return history.slice(); }
function setConfig(patch){ Object.assign(config, patch || {}); return true; }
function renderAll(){ renderCount += 1; }
function originalStart(){ session.status='running'; return true; }
function originalRecord(){ throw new Error('legacy record should not be called by Coach wrapper'); }
function originalFinish(){ throw new Error('legacy finish should not be called by Coach wrapper'); }
function normalizeSession(raw){ return raw; }

const context = {
  console,
  Date,
  Intl,
  JSON,
  Math,
  Number,
  String,
  Boolean,
  Object,
  Array,
  RegExp,
  Error,
  TypeError,
  Set,
  Map,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  structuredClone,
  localStorage,
  config,
  session,
  matrix,
  currentCoachContext,
  active,
  records,
  setConfig,
  normalizeSession,
  renderAll,
  saveSession,
  window:null,
  self:null,
  CindyFinalCoachMatrix: matrix,
  CindyAdaptiveCoachV3:undefined,
  startResume:originalStart,
  record:originalRecord,
  finish:originalFinish,
  cindyExternalContextV3:null,
  CINDYAppRuntimeV3:null
};
context.window=context; context.self=context;
vm.createContext(context);

for (const [code,name] of [
  [sessionContractCode,'session_contract_v3.js'],
  [provenanceCode,'history_provenance_v3.js'],
  [workoutHistoryServiceCode,'workout_history_service_v3.js'],
  [storageCode,'local_storage_v3.js'],
  [coachStateRepositoryCode,'coach_state_repository_v3.js'],
  [coachStateMigrationCode,'coach_state_migration_v3.js'],
  [programMetaRepositoryCode,'program_meta_repository_v3.js'],
  [coreCode,'coach_core_v3.js'],
  [programServiceCode,'program_service_v3.js'],
  [applicationServiceCode,'coach_application_service_v3.js']
]) vm.runInContext(code, context, {filename:name});

assert(context.CindyAdaptiveCoachV3,'V3 core did not install');
assert(context.CINDYCoachApplicationServiceV3,'application service did not install');

const originalLifecycle = { start:context.startResume, record:context.record, finish:context.finish, setConfig:context.setConfig };

context.CINDYAppRuntimeV3 = Object.freeze({
  getConfig:()=>config,
  getSession:()=>session,
  replaceSession:next=>{ if(next&&typeof next==='object') Object.assign(session,next); return session; },
  saveSession,
  records,
  active,
  isActive:active,
  isPaused:()=>session.status==='paused',
  readCoachPreference:()=>true,
  isConfigStorageKey:key=>key==='cindyCfg',
  currentCoachContext,
  setConfig,
  renderAll,
  loadPersistedSession:()=>null,
  now:()=> '2026-09-27T12:00:00.000Z'
});

vm.runInContext(programCode, context, {filename:'program_pack_v3.js'});
vm.runInContext(adapterCode, context, {filename:'coach_integration_v3.js'});
assert.strictEqual(context.CindyCoachIntegration.isBound(),false,'adapter must not auto-bind before composition root');
vm.runInContext(bootstrapCode, context, {filename:'bootstrap_v3.js'});
assert.strictEqual(context.CindyCoachIntegration.isBound(),true,'composition root must bind runtime');
assert(context.CINDYBootstrapV3 && context.CINDYBootstrapV3.ready,'composition root did not publish ready state');
assert(renderCount>0,'bootstrap must perform initial render');
assert.strictEqual(context.startResume,originalLifecycle.start,'startResume must not be monkey-patched');
assert.strictEqual(context.record,originalLifecycle.record,'record must not be monkey-patched');
assert.strictEqual(context.finish,originalLifecycle.finish,'finish must not be monkey-patched');
assert.strictEqual(context.setConfig,originalLifecycle.setConfig,'setConfig must not be monkey-patched');

function summary(label,x){ console.log(label, JSON.stringify(x,null,2)); }

// Explicit baseline authority through V3 API. The current Builder config is deliberately non-baseline.
config.mode='time';
config.minutes=1;
config.target=20;
config.composition=[{id:'pull',count:1},{id:'push',count:1},{id:'squat',count:1}];
assert.strictEqual(context.CindyCoachIntegration.requestBaseline(10),true);
context.CindyCoachIntegration.onConfigMutation();
let r = context.CindyCoachIntegration.derive({decisionNow:'2026-09-27T12:00:00.000Z'});
assert.strictEqual(r.authority,'COACH_CORE_V3');
assert.strictEqual(r.sessionPurpose,'BASELINE');
assert.strictEqual(r.workoutSpec.validation.valid,true);
assert.strictEqual(r.workoutSpec.mode,'time');
assert.strictEqual(r.workoutSpec.plannedSeconds,600);
assert.strictEqual(r.workoutSpec.target,0);
assert.deepStrictEqual(r.workoutSpec.composition.map(x=>x.count),[5,10,15]);
summary('BASELINE',{purpose:r.sessionPurpose,status:r.decisionStatus,minutes:r.workoutSpec.plannedSeconds/60,target:r.workoutSpec.target,composition:r.workoutSpec.composition.map(x=>x.count),valid:r.workoutSpec.validation.valid});

// Explicit application lifecycle: the actual session receives the frozen baseline runtime spec.
function appStart(){
  const prepared=context.CindyCoachIntegration.prepareForStart();
  assert(prepared&&prepared.isBaseline,'prepareForStart must explicitly identify baseline session');
  assert.strictEqual(prepared.sessionRuntime.plannedSeconds,600);
  assert.deepStrictEqual(prepared.sessionRuntime.composition.map(x=>x.count),[5,10,15]);
  Object.assign(session,prepared.sessionRuntime);
  session.status='running';
  session.startedAt=Date.parse('2026-09-27T12:01:00.000Z');
  context.CindyCoachIntegration.commitStart({frozenSpec:prepared.frozenSpec,baselineAuthorizedAtStart:prepared.baselineAuthorizedAtStart,isBaseline:prepared.isBaseline});
}
appStart();
assert.strictEqual(session.status,'running');
assert.strictEqual(session.mode,'time');
assert.strictEqual(session.plannedSeconds,600);
assert.strictEqual(session.target,0);
assert.deepStrictEqual(session.composition.map(x=>x.count),[5,10,15]);
assert.strictEqual(session.v3Ownership,'BASELINE');
assert(session.v3Spec&&session.v3Spec.specId,'START must freeze V3 WorkoutSpec');
assert.strictEqual(session.v3Spec.sessionPurpose,'BASELINE');
assert.strictEqual(session.v3DecisionNow,session.v3Spec.provenance.decisionNow);
summary('START_FREEZE',{status:session.status,ownership:session.v3Ownership,specId:session.v3Spec.specId,minutes:session.plannedSeconds/60,target:session.target});

function appRecord(end='time'){
  const raw={
    id:'legacy-id-should-be-replaced',
    completedAt:'2026-09-27T12:05:00.000Z',
    mode:session.v3Spec.mode,
    plannedSeconds:session.v3Spec.plannedSeconds,
    target:session.v3Spec.target == null ? 0 : Number(session.v3Spec.target),
    rounds:1,
    duration:Number(session.v3Spec.plannedSeconds||600),
    endedBy:end,
    composition:JSON.parse(JSON.stringify(session.composition)),
    laps:[{index:1,seconds:52},{index:2,seconds:54},{index:3,seconds:56}],
    sessionPurpose:session.v3Spec.sessionPurpose||'STANDARD'
  };
  return context.CindyCoachIntegration.handleRecord({raw,end});
}
function appFinish(end='time'){
  const result=appRecord(end);
  history.unshift(result);
  context.CindyCoachIntegration.reconcileAfterFinish(result);
  session.status='idle';
  session.startedAt=null;
  return result;
}
const hr=appFinish('time');
assert.strictEqual(history.length,1);
assert(hr.v3,'History must carry V3 snapshot');
assert.strictEqual(hr.v3.specVersion,'3.0.0');
assert.strictEqual(hr.v3.executionFidelity,'EXACT');
assert(hr.v3.profileSnapshot&&hr.v3.configSnapshot&&hr.v3.exerciseMatrixVersion&&hr.v3.compatibilityVersion);
assert.strictEqual(hr.v3.sessionPurpose,'BASELINE','real runtime completion must persist the test purpose');
assert.strictEqual(context.CindyCoachIntegration.state().baselineRecordId,hr.id,'successful real test must establish baselineRecordId');
assert.strictEqual(context.CindyCoachIntegration.readiness().phase,'STARTER_READY','completed test must exit the test-pending state immediately');
const starterDecision=context.CindyCoachIntegration.derive({decisionNow:'2026-09-27T12:06:00.000Z'});
assert.strictEqual(starterDecision.decisionMode,'ADAPT','completed test must produce an initial Coach decision');
assert(starterDecision.action,'completed test must produce a concrete first recommendation');
summary('EXECUTION_HISTORY',{historyCount:history.length,executionFidelity:hr.v3.executionFidelity,sessionPurpose:hr.v3.sessionPurpose,specId:hr.v3.provenance.specId,decisionNow:hr.v3.decisionNow,hasSnapshots:!!hr.v3.profileSnapshot,starterAction:starterDecision.action});

// With the completed baseline still Coach-owned, three later exact/comparable sessions
// should be enough to let the real V3 core evaluate an adaptive decision.
history.push(cloneBaselineForEvidence(hr,28,{comparable:true,rounds:10}));
history.push(cloneBaselineForEvidence(hr,29,{comparable:true,rounds:11}));
history.push(cloneBaselineForEvidence(hr,30,{comparable:true,rounds:12}));
const adaptiveReadiness=context.CindyCoachIntegration.readiness();
assert.strictEqual(adaptiveReadiness.phase,'READY');
assert.strictEqual(adaptiveReadiness.qualifyingTrainings,3);
assert.strictEqual(adaptiveReadiness.qualifyingDays,3);
const adaptiveDecision=context.CindyCoachIntegration.derive({decisionNow:'2026-10-01T12:30:00.000Z'});
assert.notStrictEqual(adaptiveDecision.decisionStatus,'OWNERSHIP_LIMITED','Coach must retain authority after a successful baseline until Builder mutation');
assert(adaptiveDecision.workoutSpec&&adaptiveDecision.workoutSpec.validation&&adaptiveDecision.workoutSpec.validation.valid,'adaptive decision must return a valid WorkoutSpec');
summary('ADAPTIVE_READY',{mode:adaptiveDecision.decisionMode,status:adaptiveDecision.decisionStatus,action:adaptiveDecision.action&&adaptiveDecision.action.type||null,allowed:adaptiveDecision.application&&adaptiveDecision.application.allowed===true});
assert.strictEqual(adaptiveDecision.application.allowed,true,'real CoachCore must authorize the adaptive decision after qualifying evidence');
const applied = context.CindyCoachIntegration.apply();
assert.strictEqual(applied.ok,true,'Coach apply must mutate the current workout through the existing application boundary');
assert(['change_variant','change_duration','change_rounds','increase_count'].includes(adaptiveDecision.action&&adaptiveDecision.action.type), 'adaptive decision must use one supported change lever');

r=context.CindyCoachIntegration.derive({decisionNow:'2026-09-27T12:30:00.000Z'});
assert(r.workoutSpec&&r.workoutSpec.validation.valid);
assert.strictEqual(r.authority,'COACH_CORE_V3');
summary('NEXT_DECISION',{mode:r.decisionMode,purpose:r.sessionPurpose,status:r.decisionStatus,specId:r.workoutSpec.specId,evidenceViews:Object.keys(r.evidenceViews||{}),historyCount:history.length});

context.setConfig({minutes:11});
context.CindyCoachIntegration.onConfigMutation();
const builderResult=context.CindyCoachIntegration.derive({decisionNow:'2026-09-27T12:31:00.000Z'});
assert.strictEqual(builderResult.decisionMode,'NO_ACTION');
assert.strictEqual(builderResult.decisionStatus,'OWNERSHIP_LIMITED');
summary('BUILDER_OWNERSHIP',{mode:builderResult.decisionMode,status:builderResult.decisionStatus,owner:builderResult.provenance&&builderResult.provenance.ownership||null});

// A completed baseline survives a Builder/config mutation; baseline cannot be restarted implicitly.
const stateAfterBaseline=context.CindyCoachIntegration.state();
assert(stateAfterBaseline.baselineRecordId,'baseline record id must persist after successful finish');
assert(stateAfterBaseline.baselineCompletedAt,'baseline completion timestamp must persist');
context.setConfig({minutes:10});
context.CindyCoachIntegration.onConfigMutation();
assert.strictEqual(context.CindyCoachIntegration.state().baselineRecordId,stateAfterBaseline.baselineRecordId);
assert.strictEqual(context.CindyCoachIntegration.requestBaseline(),false,'completed baseline cannot be silently re-requested');
summary('BASELINE_PERSISTENCE',{baselineRecordId:context.CindyCoachIntegration.state().baselineRecordId,minutesAfterBuilderMutation:config.minutes});

// Product evidence gate: arbitrary/non-comparable workouts must not unlock Coach.
history.splice(1);
function cloneBaselineForEvidence(baseRecord, day, {comparable=true, rounds=10}={}) {
  const x = JSON.parse(JSON.stringify(baseRecord));
  x.id = 'evidence-' + day;
  x.completedAt = `2026-09-${String(day).padStart(2,'0')}T12:00:00.000Z`;
  x.v3.sessionPurpose = 'STANDARD';
  x.v3.decisionNow = x.completedAt;
  x.v3.provenance = {...x.v3.provenance, specId:'evidence-spec-'+day};
  if (comparable) {
    x.rounds = rounds;
    x.duration = 600;
    x.plannedSeconds = 600;
    x.mode = 'time';
    x.target = null;
    x.targetRounds = null;
    x.v3.executionFidelity = 'EXACT';
    x.v3.actualExecution = {durationSeconds:600,rounds:rounds,endedBy:'time',composition:JSON.parse(JSON.stringify(x.composition)),laps:[{index:1,seconds:50},{index:2,seconds:52},{index:3,seconds:54}]};
    x.v3.plannedSpecSnapshot = JSON.parse(JSON.stringify(context.CindyCoachIntegration.state().baselineRecordId ? hr.v3.plannedSpecSnapshot : x.v3.plannedSpecSnapshot));
  } else {
    x.rounds = 5;
    x.duration = 1200;
    x.plannedSeconds = 1200;
    x.mode = 'time';
    x.target = null;
    x.v3.executionFidelity = 'EXACT';
    x.v3.plannedSpecSnapshot = {...x.v3.plannedSpecSnapshot,mode:'time',plannedSeconds:1200,target:null,targetRounds:null};
    x.v3.actualExecution = {durationSeconds:1200,rounds:5,endedBy:'time',composition:JSON.parse(JSON.stringify(x.composition)),laps:[]};
  }
  return x;
}

// First: three completed sessions on three days, but all non-comparable with the 10-min baseline.
history.push(cloneBaselineForEvidence(hr,28,{comparable:false}));
history.push(cloneBaselineForEvidence(hr,29,{comparable:false}));
history.push(cloneBaselineForEvidence(hr,30,{comparable:false}));
let evidenceGate = context.CindyCoachIntegration.readiness();
assert.strictEqual(evidenceGate.phase,'COLLECTING_EVIDENCE','non-comparable workouts must not satisfy the Coach evidence gate');
assert.strictEqual(evidenceGate.ready,false);
summary('NON_COMPARABLE_EVIDENCE',{phase:evidenceGate.phase,qualifyingTrainings:evidenceGate.qualifyingTrainings,qualifyingDays:evidenceGate.qualifyingDays});

// Replace them with three exact baseline-compatible sessions on distinct days.
history.splice(1);
history.push(cloneBaselineForEvidence(hr,28,{comparable:true}));
history.push(cloneBaselineForEvidence(hr,29,{comparable:true}));
history.push(cloneBaselineForEvidence(hr,30,{comparable:true}));
evidenceGate = context.CindyCoachIntegration.readiness();
assert.strictEqual(evidenceGate.qualifyingTrainings,3,'three comparable completed sessions should qualify');
assert.strictEqual(evidenceGate.qualifyingDays,3,'evidence must span three distinct training days');
assert.strictEqual(evidenceGate.ready,true,'three qualifying comparable sessions should pass product evidence gate');
summary('QUALIFYING_EVIDENCE',{phase:evidenceGate.phase,qualifyingTrainings:evidenceGate.qualifyingTrainings,qualifyingDays:evidenceGate.qualifyingDays});

console.log('IN_PROCESS_E2E_PASS');
