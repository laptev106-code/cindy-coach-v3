const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');
const servicePath = path.join(root, 'src', 'application', 'coach', 'coach_application_service_v3.js');
const stateRepoPath = path.join(root, 'src', 'infrastructure', 'storage', 'coach_state_repository_v3.js');
const migrationPath = path.join(root, 'src', 'infrastructure', 'storage', 'coach_state_migration_v3.js');
const adapterPath = path.join(root, 'coach_core_v3', 'coach_integration_v3.js');
const indexPath = path.join(root, 'index.html');

const serviceCode = fs.readFileSync(servicePath, 'utf8');
const stateRepoCode = fs.readFileSync(stateRepoPath, 'utf8');
const migrationCode = fs.readFileSync(migrationPath, 'utf8');
const adapterCode = fs.readFileSync(adapterPath, 'utf8');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

const serviceImplementation = serviceCode.split('window.CINDYCoachApplicationServiceV3')[0];
const forbiddenService = [
  /\bwindow\b/,
  /\blocalStorage\b/,
  /\bdocument\b/,
  /\bnavigator\b/,
  /\bstartResume\b/,
  /\bsetConfig\b/,
  /\brenderAll\b/,
  /\bDate\.now\b/,
  /\bMath\.random\b/
];
for (const pattern of forbiddenService) assert(!pattern.test(serviceImplementation), `application service contains ambient dependency: ${pattern}`);
console.log('PASS application service has no ambient browser/lifecycle dependencies');

assert(serviceCode.includes('configPort') && serviceCode.includes('sessionPort') && serviceCode.includes('historyPort'));
assert(serviceCode.includes('contextPort') && serviceCode.includes('matrixPort') && serviceCode.includes('clockPort'));
assert(serviceCode.includes('baselineAuthorityPort') && serviceCode.includes('renderPort'));
console.log('PASS application service exposes explicit ports');

assert(adapterCode.includes('CINDYCoachApplicationServiceV3'));
assert(adapterCode.includes('configPort()'));
assert(adapterCode.includes('sessionPort'));
assert(adapterCode.includes('historyPort'));
assert(adapterCode.includes('function bindRuntime(next)'));
assert(adapterCode.includes('isBound: () => Boolean(runtime)'));
assert(!adapterCode.includes('__cindyV3StartWrapped'));
assert(!adapterCode.includes('__cindyV3RecordWrapped'));
console.log('PASS browser adapter owns explicit runtime compatibility boundary');

const requiredOrder = [
  './coach_core_v3/coach_core_v3.js',
  './src/infrastructure/storage/coach_state_repository_v3.js',
  './src/infrastructure/storage/coach_state_migration_v3.js',
  './src/application/coach/coach_application_service_v3.js',
  './coach_core_v3/coach_integration_v3.js',
  './coach_core_v3/program_pack_v3.js'
].map(src => indexHtml.indexOf(`src="${src}"`));
for (let i = 1; i < requiredOrder.length; i++) assert(requiredOrder[i] > requiredOrder[i - 1], `script order invalid at ${i}`);
console.log('PASS Stage4 module load order');

vm.runInNewContext(stateRepoCode, { window: {}, JSON, Object, structuredClone, TypeError, String, Boolean, Array });
assert(migrationCode.includes('sourceChecksum') && migrationCode.includes('rollback'));
console.log('PASS coach state repository syntax');

let saveCount = 0;
const fakeState = {version:1,ownership:'BUILDER',baselineAuthority:false,preparedSpec:null,preparedFingerprint:null,appliedConfigFingerprint:null,pendingIntervention:null};
const fakeRepo = { load: () => JSON.parse(JSON.stringify(fakeState)), save: value => { saveCount++; Object.assign(fakeState, JSON.parse(JSON.stringify(value))); return true; } };
const fakeConfig = { mode:'time', minutes:10, target:20, composition:[{id:'pull',count:5},{id:'push',count:10},{id:'squat',count:15}], equipment:{}, userRestrictions:{} };
const fakeCore = {
  MATRIX_VERSION:'m', COMPATIBILITY_VERSION:'c', hash: value => JSON.stringify(value), canonicalize: value => value,
  defaultMeasurementContract: mode => ({version:'measurement-v3',mode}),
  derive: input => ({
    authority:'COACH_CORE_V3', decisionMode:'PRESERVE', decisionStatus:'EVIDENCE_LIMITED', sessionPurpose:'STANDARD', action:null,
    application:{allowed:true},
    workoutSpec:{specId:'spec-a',contextFingerprint:'fp-a',mode:input.currentWorkout.mode,plannedSeconds:600,target:20,targetRounds:null,composition:input.currentWorkout.composition,validation:{valid:true},provenance:{decisionNow:input.decisionNow,decisionTimezone:input.decisionTimezone},adaptation:{levers:[]}},
    evidenceViews:{}
  })
};
const fakePorts = {
  configPort:{relevantSnapshot:()=>fakeConfig,currentConfig:()=>fakeConfig,currentMode:()=>fakeConfig.mode,maxExercises:()=>4,equipment:()=>({}),restrictions:()=>({}),excludedExerciseIds:()=>[],profileSnapshot:()=>({}),applyCoachPatch:()=>true},
  sessionPort:{get:()=>({status:'idle'}),replace:()=>{},save:()=>true,isRunning:()=>false},
  historyPort:{records:()=>[]},
  contextPort:{currentCoachContext:()=>({formatPolicy:'fixed',allowedModes:['time','rounds','combined'],programContext:null})},
  matrixPort:{get:()=>({version:'m',baseDefaults:{},variants:{}})},
  externalContextPort:{get:()=>null},
  activityPort:{isRunning:()=>false,isPaused:()=>false},
  clockPort:{now:()=> '2026-09-28T00:00:00.000Z',timezone:()=> 'Europe/Amsterdam'},
  renderPort:{refresh:()=>{throw new Error('render should not run in prepare(false)')}},
  baselineAuthorityPort:{isAuthorized:()=>false,clear:()=>{}},
  workoutHistoryService:{freezeForStart: x=>x,restoreSessionContract:(b)=>b,decorateHistoryRecord:x=>x.raw,linkInterventionCompletion:x=>x.intervention}
};
const testContext = {window:{}, console, JSON, Object, String, Number, Boolean, Array, TypeError, structuredClone};
vm.createContext(testContext);
vm.runInContext(serviceCode, testContext, {filename:'coach_application_service_v3.js'});
assert(testContext.window.CINDYCoachApplicationServiceV3);
const service = testContext.window.CINDYCoachApplicationServiceV3.create({core:fakeCore,stateRepository:fakeRepo,...fakePorts,enabledPort:()=>true,integrityPort:{sha256:()=> 'a'.repeat(64),canonicalJson:value=>JSON.stringify(value)},releaseManifest:{specVersion:'3.0.0'}});
const before=saveCount;
const derived=service.deriveDecision({decisionNow:'2026-09-28T00:00:00.000Z'});
assert.strictEqual(saveCount,before);
assert.strictEqual(derived.workoutSpec.specId,'spec-a');
service.prepare({decisionNow:'2026-09-28T00:00:00.000Z',persist:false});
assert.strictEqual(saveCount,before);
service.prepare({decisionNow:'2026-09-28T00:00:00.000Z',persist:true});
assert.strictEqual(saveCount,before+1);
console.log('PASS service decision is side-effect free until explicit prepare persistence');
console.log('DECOMPOSITION_STAGE4_COACH_BOUNDARY_PASS');
