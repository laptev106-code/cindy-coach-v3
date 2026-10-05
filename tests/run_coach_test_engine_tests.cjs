const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const root=path.resolve(__dirname,'..');
const coreSrc=path.join(root,'coach_core_v3','coach_core_v3.js');
const catalogSrc=path.join(root,'src','domain','exercises','exercise_catalog_v3.js');
const localCore=path.join(__dirname,'coach_core_test_runtime.js');
fs.copyFileSync(coreSrc,localCore);
try{
  const CORE=require('./coach_core_test_runtime.js');
  const ctx=vm.createContext({window:{},console,JSON,Object,String,Number,Boolean,Array,Date,Math,structuredClone:global.structuredClone,Intl});
  vm.runInContext(fs.readFileSync(catalogSrc,'utf8'),ctx,{filename:'exercise_catalog_v3.js'});
  const catalog=ctx.window.CINDYExerciseCatalogV3;
  const rawMatrix=catalog.CINDY_FINAL_COACH_MATRIX;

  const variants={};
  for(const [id,v] of Object.entries(rawMatrix.variants||{})){
    variants[id]={
      ...JSON.parse(JSON.stringify(v)),
      id,
      base:v.base||id,
      semanticCompatibilityClass:`${v.base||'unknown'}:${v.id||id}`,
      progressionNeighbors:Array.isArray(v.neighbors)?v.neighbors.slice():[],
      regressionNeighbors:Array.isArray(v.neighbors)?v.neighbors.slice():[],
      substitutionGroups:[v.base||id],
      coachEligibility:v.auto!==false&&!v.manualOnly,
      exposureTags:Object.keys(v.profile||{}),
      comparabilitySensitivity:['pull','push'].includes(v.base)?['BODYWEIGHT']:[]
    };
  }
  const exercises={};
  for(const [base,defaultId] of Object.entries(rawMatrix.baseDefaults||{})){
    const variant=variants[defaultId];
    exercises[base]={
      id:base,
      family:base,
      movementPattern:base,
      subPattern:base,
      progressionNeighbors:variant?variant.progressionNeighbors:[],
      regressionNeighbors:variant?variant.regressionNeighbors:[],
      equipmentRequirements:variant?variant.equipment||[]:[],
      coachEligibility:true,
      substitutionGroups:[base],
      exposureTags:variant?variant.exposureTags:[]
    };
  }
  const matrix={version:CORE.MATRIX_VERSION,sourceVersion:rawMatrix.version,baseDefaults:JSON.parse(JSON.stringify(rawMatrix.baseDefaults)),variants,exercises};

  const MANIFEST={specVersion:'3.0.0',coreVersion:CORE.CORE_VERSION,buildHash:CORE.EXPECTED_BUILD_HASH,sourceHash:CORE.EXPECTED_SOURCE_HASH,fixtureCorpusVersion:'v3.0.0-100',exerciseMatrixVersion:CORE.MATRIX_VERSION,compatibilityVersion:CORE.COMPATIBILITY_VERSION};
  const BASE_COMPOSITION=[
    {slotId:'s1',exerciseId:'pull',variantId:'pull_pronated',count:5,order:1},
    {slotId:'s2',exerciseId:'push',variantId:'push_classic',count:10,order:2},
    {slotId:'s3',exerciseId:'squat',variantId:'squat_classic',count:15,order:3},
  ];
  const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
  const profile=(weight=65)=>({age:39,sex:'M',heightCm:169,weightKg:weight,goal:'GENERAL',trainingExperience:'intermediate',equipment:{pullupBar:true,stableSupport:true,resistanceBand:true}});
  const iso=(day,hour=10)=>`2026-09-${String(day).padStart(2,'0')}T${String(hour).padStart(2,'0')}:00:00Z`;
  const record=({day=20,rounds=10,laps=[],id=`rec-${day}-${rounds}`,composition=BASE_COMPOSITION,weight=65}={})=>{
    const mode='time'; const plannedSeconds=600; const target=null; const targetRounds=null;
    const spec={specVersion:'3.0.0',mode:'time',formatPolicy:'fixed',plannedSeconds,target,targetRounds,composition:clone(composition),programContext:null};
    return {
      id,completedAt:iso(day),mode,formatPolicy:'fixed',plannedSeconds,target,targetRounds,rounds,duration:600,endedBy:'time',composition:clone(composition),valid:true,ownership:'COACH',
      v3:{
        profileSnapshot:profile(weight),
        configSnapshot:{mode:'time',minutes:10,target:null,formatPolicy:'fixed',composition:clone(composition),equipment:{pullupBar:true,stableSupport:true,resistanceBand:true}},
        constraintSnapshot:{minExercises:3,maxExercises:4,maxDurationSeconds:1800},
        semanticSnapshotStatus:'FROZEN_AT_START',semanticSnapshotVersion:'cindy-semantic-history-snapshot-v1',semanticSnapshotHash:'a'.repeat(64),snapshotCapturedAt:iso(day),profileVersion:`profile-${day}`,profileEffectiveFrom:iso(day),
        exerciseMatrixVersion:CORE.MATRIX_VERSION,
        compatibilityVersion:CORE.COMPATIBILITY_VERSION,
        measurementContractVersion:CORE.MEASUREMENT_CONTRACT_VERSION,
        measurementContract:CORE.defaultMeasurementContract('time','fixed'),
        decisionNow:iso(day),decisionTimezone:'UTC',ownership:'COACH',sessionPurpose:'STANDARD',executionFidelity:'EXACT',
        plannedSpecSnapshot:clone(spec),
        actualExecution:{durationSeconds:600,rounds,endedBy:'time',composition:clone(composition),laps:clone(laps)},
        contextFingerprint:`ctx-${day}-${rounds}`,
        coachIntervention:null,
        provenance:{specId:`spec-${day}-${rounds}`,reentryRepeatCount:0,releaseManifest:{...MANIFEST}}
      }
    };
  };
  const input=history=>({
    profile:profile(),
    config:{equipment:{pullupBar:true,stableSupport:true,resistanceBand:true}},
    hardConstraints:{minExercises:3,maxExercises:4,maxDurationSeconds:1800},
    currentWorkout:{mode:'time',formatPolicy:'fixed',allowedModes:['time'],plannedSeconds:600,target:0,targetRounds:null,composition:clone(BASE_COMPOSITION),programContext:null,ownership:'COACH',invalid:false,measurementContractVersion:CORE.MEASUREMENT_CONTRACT_VERSION,sessionType:'STANDARD'},
    currentWorkoutSnapshot:{mode:'time',formatPolicy:'fixed',plannedSeconds:600,target:0,targetRounds:null,composition:clone(BASE_COMPOSITION),programContext:null,ownership:'COACH',invalid:false,measurementContractVersion:CORE.MEASUREMENT_CONTRACT_VERSION,sessionType:'STANDARD'},
    history:clone(history),exerciseMatrix:matrix,programContext:null,externalContext:null,activeState:{running:false,paused:false},
    decisionNow:'2026-09-28T21:00:00Z',decisionTimezone:'UTC',releaseManifest:MANIFEST,measurementContract:CORE.defaultMeasurementContract('time','fixed'),
    equipment:{pullupBar:true,stableSupport:true,resistanceBand:true},restrictions:{},baselineAuthority:false,baselineComposition:clone(BASE_COMPOSITION),interventionWindow:null,missingEvidence:[],missingEvidenceLabels:[],controlQuestion:null,limitingAreaSlot:null
  });

  // 1. Round timing is actually consumed by the core as a qualitative pace signal.
  const decelLaps=[
    {n:1,duration:40},{n:2,duration:42},{n:3,duration:45},{n:4,duration:48},{n:5,duration:51},{n:6,duration:55}
  ];
  const paceHistory=[record({day:20,rounds:8,laps:decelLaps}),record({day:22,rounds:8,laps:decelLaps}),record({day:24,rounds:8,laps:decelLaps})];
  const paceResult=CORE.derive(input(paceHistory));
  assert.strictEqual(paceResult.diagnostics.performanceState.pacePattern,'DECELERATING');
  assert(paceResult.diagnostics.performanceState.paceProfiles.length>=2);

  // 2. Three stable/improving comparable days make exercise variation eligible; the result
  // should be a real variant action, not a choice from the four manual templates.
  const fastLaps=[{n:1,duration:55},{n:2,duration:54},{n:3,duration:53},{n:4,duration:52},{n:5,duration:51},{n:6,duration:50}];
  const goodHistory=[record({day:20,rounds:6,laps:fastLaps}),record({day:22,rounds:7,laps:fastLaps}),record({day:24,rounds:8,laps:fastLaps})];
  const goodResult=CORE.derive(input(goodHistory));
  assert.strictEqual(goodResult.diagnostics.readinessContext.exerciseVariationAllowed,true);
  assert(goodResult.action,'expected an adaptive action');
  assert.strictEqual(goodResult.action.type,'change_variant');
  assert(goodResult.action.toVariantId && goodResult.action.toVariantId !== goodResult.action.fromVariantId,'variant must actually change');
  assert(!['Cindy Classic','Cindy Classic 10','Variant Cindy','Mixed Cindy 15'].includes(goodResult.action.toVariantId));

  console.log('COACH_TEST_ENGINE_TESTS_PASS');
} finally {
  try{fs.unlinkSync(localCore)}catch(_){ }
}
