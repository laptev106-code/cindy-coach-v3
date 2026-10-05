const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const serviceSrc=fs.readFileSync(path.join(root,'src/application/coach/coach_application_service_v3.js'),'utf8');
const coreSrc=fs.readFileSync(path.join(root,'coach_core_v3/coach_core_v3.js'),'utf8');
const catalogSrc=fs.readFileSync(path.join(root,'src/domain/exercises/exercise_catalog_v3.js'),'utf8');
const integrationSrc=fs.readFileSync(path.join(root,'coach_core_v3/coach_integration_v3.js'),'utf8');
// Lightweight direct integration test of the real application service + real CoachCore.
const state={version:1,ownership:'BUILDER',baselineAuthority:false,baselineCompletedAt:null,baselineRecordId:null,baselineTestMinutes:null,preparedSpec:null,preparedFingerprint:null,appliedConfigFingerprint:null,pendingIntervention:null};
let cfg={version:8,mode:'time',minutes:1,target:20,composition:[{id:'pull',count:1},{id:'push',count:1},{id:'squat',count:1}],equipment:{},userRestrictions:{},excludedExerciseIds:[],coachExcludedVariantIds:[],maxExercises:4,profile:{},pendingSource:null};
const history=[];
const context={
  window:{},console,JSON,Object,String,Number,Boolean,Array,Date,Math,structuredClone:global.structuredClone,Intl,
};
vm.createContext(context);
vm.runInContext(coreSrc,context,{filename:'coach_core_v3.js'});
vm.runInContext(catalogSrc,context,{filename:'exercise_catalog_v3.js'});
const CORE=context.window.CindyAdaptiveCoachV3;
const matrixRaw=context.window.CINDYExerciseCatalogV3.CINDY_FINAL_COACH_MATRIX;
function clone(v){return JSON.parse(JSON.stringify(v));}
const variants={};
for(const [id,v] of Object.entries(matrixRaw.variants)) variants[id]={...clone(v),id,base:v.base||id,semanticCompatibilityClass:`${v.base||'unknown'}:${v.id||id}`,progressionNeighbors:(v.neighbors||[]).slice(),regressionNeighbors:(v.neighbors||[]).slice(),substitutionGroups:[v.base||id],coachEligibility:v.auto!==false&&!v.manualOnly,exposureTags:Object.keys(v.profile||{}),comparabilitySensitivity:['pull','push'].includes(v.base)?['BODYWEIGHT']:[]};
const exercises={};
for(const [base,defaultId] of Object.entries(matrixRaw.baseDefaults)){const v=variants[defaultId];exercises[base]={id:base,family:base,movementPattern:base,subPattern:base,progressionNeighbors:v?v.progressionNeighbors:[],regressionNeighbors:v?v.regressionNeighbors:[],equipmentRequirements:v?(v.equipment||[]):[],coachEligibility:true,substitutionGroups:[base],exposureTags:v?v.exposureTags:[]};}
const matrix={version:CORE.MATRIX_VERSION,sourceVersion:matrixRaw.version,baseDefaults:clone(matrixRaw.baseDefaults),variants,exercises};
const releaseManifest={specVersion:'3.0.0',coreVersion:CORE.CORE_VERSION,buildHash:CORE.EXPECTED_BUILD_HASH,sourceHash:CORE.EXPECTED_SOURCE_HASH,fixtureCorpusVersion:'v3.0.0-100',exerciseMatrixVersion:CORE.MATRIX_VERSION,compatibilityVersion:CORE.COMPATIBILITY_VERSION};
const stateRepository={load:()=>clone(state),save:x=>{Object.assign(state,clone(x));return true;}};
vm.runInContext(serviceSrc,context,{filename:'coach_application_service_v3.js'});
const FACT=context.window.CINDYCoachApplicationServiceV3;
const svc=FACT.create({
  core:CORE,stateRepository,
  configPort:{relevantSnapshot:()=>clone(cfg),currentConfig:()=>cfg,currentMode:()=>cfg.mode,maxExercises:()=>cfg.maxExercises,equipment:()=>clone(cfg.equipment),restrictions:()=>clone(cfg.userRestrictions),excludedExerciseIds:()=>cfg.excludedExerciseIds||[],profileSnapshot:()=>clone(cfg.profile),applyCoachPatch:patch=>{cfg={...cfg,...clone(patch)};return true}},
  sessionPort:{get:()=>({status:'idle'}),replace:()=>{},save:()=>true,isRunning:()=>false},
  historyPort:{records:()=>clone(history)},
  contextPort:{currentCoachContext:()=>({mode:cfg.mode,formatPolicy:'fixed',allowedModes:['time','rounds','combined'],programContext:null}),profileSnapshot:()=>clone(cfg.profile),formatPolicy:()=> 'fixed',programContext:()=>null},
  matrixPort:{get:()=>matrix},externalContextPort:{get:()=>null},activityPort:{isRunning:()=>false,isPaused:()=>false},clockPort:{now:()=> '2026-09-28T19:00:00.000Z',timezone:()=> 'UTC'},renderPort:{refresh:()=>{}},baselineAuthorityPort:{isAuthorized:()=>Boolean(state.baselineAuthority),clear:()=>{state.baselineAuthority=false;return true}},workoutHistoryService:{freezeForStart:x=>x,restoreSessionContract:x=>x,decorateHistoryRecord:x=>x.raw,linkInterventionCompletion:x=>x.intervention},enabledPort:()=>true,integrityPort:{sha256:()=> 'a'.repeat(64),canonicalJson:value=>JSON.stringify(value)},releaseManifest
});
assert.strictEqual(svc.requestBaseline(10),true);
const prepared=svc.previewBaselineTest({decisionNow:'2026-09-28T19:00:00.000Z'});
assert(prepared,'real CoachCore baseline preview must succeed even when equipment profile is unset');
assert.strictEqual(prepared.sessionRuntime.plannedSeconds,600);
assert.strictEqual(prepared.sessionRuntime.mode,'time');
assert.strictEqual(prepared.sessionRuntime.target,0);
assert.deepStrictEqual(prepared.sessionRuntime.composition.map(x=>({id:x.exerciseId,count:x.count})),[{id:'pull',count:5},{id:'push',count:10},{id:'squat',count:15}]);
console.log('BASELINE_REAL_CORE_INTEGRATION_PASS');
