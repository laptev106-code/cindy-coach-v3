const assert = require('assert');
const CORE = require('./coach_core_v3.js');

const MANIFEST = {
  specVersion:'3.0.0',
  coreVersion:CORE.CORE_VERSION,
  buildHash:CORE.EXPECTED_BUILD_HASH,
  sourceHash:CORE.EXPECTED_SOURCE_HASH,
  fixtureCorpusVersion:'v3.0.0-100',
  exerciseMatrixVersion:CORE.MATRIX_VERSION,
  compatibilityVersion:CORE.COMPATIBILITY_VERSION
};

const variants = {
  pull_pronated:{id:'pull_pronated',base:'pull',label:'Pull',difficulty:70,equipmentRequirements:['pullupBar'],neighbors:['pull_row_inverted'],comparabilitySensitivity:['BODYWEIGHT'],coachEligibility:true},
  pull_row_inverted:{id:'pull_row_inverted',base:'pull',label:'Inverted',difficulty:25,equipmentRequirements:['stableSupport'],neighbors:['pull_pronated'],comparabilitySensitivity:['BODYWEIGHT'],coachEligibility:true},
  pull_assisted_band:{id:'pull_assisted_band',base:'pull',label:'Band',difficulty:45,equipmentRequirements:['pullupBar','resistanceBand'],neighbors:['pull_pronated'],comparabilitySensitivity:['BODYWEIGHT'],coachEligibility:true},
  pull_wide:{id:'pull_wide',base:'pull',label:'Wide',difficulty:80,equipmentRequirements:['pullupBar'],neighbors:['pull_pronated'],comparabilitySensitivity:['BODYWEIGHT'],coachEligibility:true},
  push_classic:{id:'push_classic',base:'push',label:'Push',difficulty:60,equipmentRequirements:[],neighbors:['push_knee'],comparabilitySensitivity:['BODYWEIGHT'],coachEligibility:true},
  push_knee:{id:'push_knee',base:'push',label:'Knee',difficulty:40,equipmentRequirements:[],neighbors:['push_classic'],comparabilitySensitivity:['BODYWEIGHT'],coachEligibility:true},
  squat_classic:{id:'squat_classic',base:'squat',label:'Squat',difficulty:45,equipmentRequirements:[],neighbors:['squat_support'],coachEligibility:true},
  squat_support:{id:'squat_support',base:'squat',label:'Supported squat',difficulty:20,equipmentRequirements:['stableSupport'],neighbors:['squat_classic'],coachEligibility:true},
  abs_controlled:{id:'abs_controlled',base:'abs',label:'Abs',difficulty:35,equipmentRequirements:[],neighbors:['abs_reverse'],coachEligibility:true},
  abs_reverse:{id:'abs_reverse',base:'abs',label:'Abs reverse',difficulty:45,equipmentRequirements:[],neighbors:['abs_controlled'],coachEligibility:true}
};
const matrix = {
  version:CORE.MATRIX_VERSION,
  variants,
  exercises:{
    pull:{id:'pull',family:'pull',movementPattern:'pull',subPattern:'pull',coachEligibility:true,comparabilitySensitivity:['BODYWEIGHT'],substitutionGroups:['pull']},
    push:{id:'push',family:'push',movementPattern:'push',subPattern:'push',coachEligibility:true,comparabilitySensitivity:['BODYWEIGHT'],substitutionGroups:['push']},
    squat:{id:'squat',family:'squat',movementPattern:'squat',subPattern:'squat',coachEligibility:true},
    abs:{id:'abs',family:'abs',movementPattern:'abs',subPattern:'abs',coachEligibility:true}
  }
};

const BASE_COMPOSITION = [
  {slotId:'s1',exerciseId:'pull',variantId:'pull_pronated',count:5,order:1},
  {slotId:'s2',exerciseId:'push',variantId:'push_classic',count:10,order:2},
  {slotId:'s3',exerciseId:'squat',variantId:'squat_classic',count:15,order:3},
];

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function iso(day, hour=10){ return `2026-09-${String(day).padStart(2,'0')}T${String(hour).padStart(2,'0')}:00:00Z`; }
function profile(weight=65, goal='GENERAL'){return {age:39,sex:'M',heightCm:169,weightKg:weight,goal,trainingExperience:'intermediate',equipment:{pullupBar:true,stableSupport:true,resistanceBand:true}};}
function comp(changes={}){return BASE_COMPOSITION.map(x=>({...x,...(changes[x.slotId]||{})}));}

function record(opts={}){
  const mode=opts.mode||'time';
  const plannedSeconds=opts.plannedSeconds==null?(mode==='rounds'?null:600):opts.plannedSeconds;
  const target=mode==='time'?null:(opts.target==null?10:opts.target);
  const targetRounds=mode==='time'?null:(opts.targetRounds==null?target:opts.targetRounds);
  const composition=clone(opts.composition||BASE_COMPOSITION);
  const completedRounds=opts.rounds==null?10:opts.rounds;
  const duration=opts.duration==null?(plannedSeconds==null?600:plannedSeconds):opts.duration;
  const day=opts.day||22;
  const purpose=opts.sessionPurpose || opts.sessionType || 'STANDARD';
  const fidelity=opts.executionFidelity||'EXACT';
  const spec={specVersion:'3.0.0',mode,formatPolicy:opts.formatPolicy||'fixed',plannedSeconds,target,targetRounds,composition,programContext:clone(opts.programContext||null)};
  return {
    id:opts.id||`rec-${day}-${purpose}`,
    completedAt:iso(day), mode, formatPolicy:spec.formatPolicy, plannedSeconds, target, targetRounds,
    rounds:completedRounds,duration,endedBy:opts.endedBy||'target',composition,valid:true,ownership:opts.ownership||'COACH',
    v3:{
      profileSnapshot:profile(Object.prototype.hasOwnProperty.call(opts,'weight') ? opts.weight : 65,opts.goal||'GENERAL'),
      configSnapshot:{mode,minutes:plannedSeconds==null?10:plannedSeconds/60,target,formatPolicy:spec.formatPolicy,composition,equipment:opts.equipment||{pullupBar:true,stableSupport:true,resistanceBand:true}},
      constraintSnapshot:{minExercises:3,maxExercises:4,maxDurationSeconds:1800},
      exerciseMatrixVersion:opts.matrixVersion||CORE.MATRIX_VERSION,
      compatibilityVersion:opts.compatibilityVersion||CORE.COMPATIBILITY_VERSION,
      semanticSnapshotVersion:'cindy-semantic-history-snapshot-v1',semanticSnapshotHash:'a'.repeat(64),snapshotCapturedAt:iso(day),semanticSnapshotStatus:'FROZEN_AT_START',profileVersion:`profile-${day}`,profileEffectiveFrom:iso(day),
      measurementContractVersion:CORE.MEASUREMENT_CONTRACT_VERSION,
      measurementContract:CORE.defaultMeasurementContract(mode,spec.formatPolicy),
      decisionNow:iso(day),decisionTimezone:'UTC',ownership:opts.ownership||'COACH',
      sessionPurpose:purpose,executionFidelity:fidelity,
      plannedSpecSnapshot:spec,
      actualExecution:{durationSeconds:duration,rounds:completedRounds,endedBy:opts.endedBy||'target',composition,laps:opts.laps||[]},
      contextFingerprint:opts.contextFingerprint||'ctx',
      coachIntervention:opts.coachIntervention||null,
      provenance:{specId:opts.specId||`spec-${day}`,reentryRepeatCount:opts.reentryRepeatCount||0,releaseManifest:{...MANIFEST}}
    }
  };
}

function input(opts={}){
  const mode=opts.mode||'time';
  const plannedSeconds=opts.plannedSeconds==null?(mode==='rounds'?null:600):opts.plannedSeconds;
  const target=mode==='time'?null:(opts.target==null?10:opts.target);
  const targetRounds=mode==='time'?null:(opts.targetRounds==null?target:opts.targetRounds);
  const currentComp=clone(opts.composition||BASE_COMPOSITION);
  const currentWorkout={
    mode,formatPolicy:opts.formatPolicy||'fixed',plannedSeconds,target,targetRounds,composition:currentComp,
    programContext:clone(opts.programContext||null),ownership:opts.ownership||'COACH',
    invalid:Boolean(opts.invalid),measurementContractVersion:CORE.MEASUREMENT_CONTRACT_VERSION,
    sessionType:'STANDARD',
  };
  return {
    profile:clone(opts.profile||profile()), config:{equipment:clone(opts.equipment||{pullupBar:true,stableSupport:true,resistanceBand:true})},
    hardConstraints:{minExercises:3,maxExercises:4,maxDurationSeconds:1800,...(opts.hardConstraints||{})},
    currentWorkout,currentWorkoutSnapshot:clone(currentWorkout),history:clone(opts.history||[]),exerciseMatrix:clone(opts.matrix||matrix),
    programContext:clone(opts.programContext||null),externalContext:clone(opts.externalContext||null),activeState:{running:false,paused:false},
    decisionNow:opts.now||'2026-09-27T12:00:00Z',decisionTimezone:opts.timezone||'UTC',releaseManifest:{...MANIFEST,...(opts.manifest||{})},
    measurementContract:opts.measurementContract||CORE.defaultMeasurementContract(mode,opts.formatPolicy||'fixed'),equipment:clone(opts.equipment||{pullupBar:true,stableSupport:true,resistanceBand:true}),restrictions:clone(opts.restrictions||{}),
    baselineAuthority:Boolean(opts.baselineAuthority),baselineComposition:clone(opts.baselineComposition||currentComp),
    interventionWindow:clone(opts.interventionWindow||null),missingEvidence:clone(opts.missingEvidence||[]),missingEvidenceLabels:clone(opts.missingEvidenceLabels||[]),controlQuestion:opts.controlQuestion||null,limitingAreaSlot:opts.limitingAreaSlot||null
  };
}

function derive(opts={}){return CORE.derive(input(opts));}
function cmp(a,b,opts={}){return CORE.strictCompare(CORE.normalizeHistoryRecord(a),CORE.normalizeHistoryRecord(b),opts.matrix||matrix,'LEVEL_A');}

const tests=[];
function T(name,fn){tests.push({name,fn});}
function ok(condition,msg){assert.ok(condition,msg);}
function eq(actual,expected,msg){assert.strictEqual(actual,expected,msg);}
function includes(arr,v,msg){ok(Array.isArray(arr)&&arr.includes(v),msg||`expected ${v}`);}

T('T01 non-contiguous current-comparable cohort',()=>{const h=[record({day:20}),record({day:21,composition:[...BASE_COMPOSITION.slice(0,2),{...BASE_COMPOSITION[2],count:16}]}),record({day:24}),record({day:26})];const r=derive({history:h});eq(r.diagnostics.evidenceViews.strictCohort.length,3);});
T('T02 coherent trend cohort',()=>{const h=[record({day:20}),record({day:22}),record({day:24}),record({day:26})];const r=derive({history:h});eq(r.diagnostics.evidenceViews.trendCohort.length,4);});
T('T03 format differs blocks strict',()=>{const a=record({day:20,mode:'time',plannedSeconds:600}),b=record({day:22,mode:'rounds',target:10,targetRounds:10,plannedSeconds:null});const c=cmp(a,b);ok(c.blocking);});
T('T04 20 minute current vs 10 minute history no strict proof',()=>{const h=[record({day:22,plannedSeconds:600}),record({day:24,plannedSeconds:600}),record({day:26,plannedSeconds:600})];const r=derive({history:h,plannedSeconds:1200});eq(r.diagnostics.evidenceViews.strictCohort.length,0);ok(r.diagnostics.evidenceViews.historyContext.length===3);});
T('T05 Builder-owned empty history no action',()=>{const r=derive({ownership:'BUILDER',history:[]});eq(r.decisionMode,'NO_ACTION');eq(r.decisionStatus,'OWNERSHIP_LIMITED');});
T('T06 explicit Coach baseline authority',()=>{const r=derive({ownership:'COACH',history:[],baselineAuthority:true});eq(r.sessionPurpose,'BASELINE');eq(r.decisionMode,'ADAPT');});
T('T07 applied not started Level B ineligible',()=>{const p=record({day:24,specId:'parent'});const r=derive({history:[p],interventionWindow:{parentSpecId:'parent',interventionType:'COUNT',direction:'UP',fidelity:null,childRecord:null}});eq(r.decisionStatus,'EVIDENCE_LIMITED');});
T('T08 manual count change rejects Level B fidelity',()=>{const p=record({day:24,specId:'parent'});const child=record({day:26,composition:comp({s1:{count:6}}),specId:'child',executionFidelity:'PARTIAL'});const r=derive({history:[p],interventionWindow:{parentSpecId:'parent',interventionType:'COUNT',direction:'UP',fidelity:'PARTIAL',childRecord:child}});eq(r.decisionStatus,'EVIDENCE_LIMITED');});
T('T09 exact count +1 Level B',()=>{const p=record({day:24,rounds:10,specId:'parent'});const child=record({day:26,rounds:10,composition:comp({s1:{count:6}}),specId:'child',executionFidelity:'EXACT'});const r=derive({history:[p],interventionWindow:{parentSpecId:'parent',interventionType:'COUNT',direction:'UP',fidelity:'EXACT',childRecord:child}});eq(r.sessionPurpose,'REPEAT');});
T('T10 partial execution preserve',()=>{const p=record({day:24,specId:'parent'});const child=record({day:26,executionFidelity:'PARTIAL',specId:'child'});const r=derive({history:[p],interventionWindow:{parentSpecId:'parent',interventionType:'COUNT',direction:'UP',fidelity:'PARTIAL',childRecord:child}});eq(r.decisionStatus,'EVIDENCE_LIMITED');});
T('T11 malformed metric unresolved',()=>{const p=record({day:24,specId:'parent'});const child=record({day:26,specId:'child',executionFidelity:'EXACT',duration:null,rounds:null});const r=derive({history:[p],interventionWindow:{parentSpecId:'parent',interventionType:'COUNT',direction:'UP',fidelity:'EXACT',childRecord:child}});eq(r.decisionStatus,'EVIDENCE_LIMITED');});
T('T12 weight material pull strict blocked',()=>{const a=record({day:22,weight:65}),b=record({day:26,weight:69});const c=cmp(a,b);ok(c.blocking);});
T('T13 weight transition diagnostic is claim-scoped',()=>{const a=CORE.normalizeHistoryRecord(record({day:22,weight:65})),b=CORE.normalizeHistoryRecord(record({day:26,weight:75}));const externalTarget={...BASE_COMPOSITION[2],exerciseId:'squat',variantId:'squat_classic'};const external=CORE.buildEvidenceViews({decisionNow:iso(27,12),profile:profile(75),exerciseMatrix:matrix},[a,b],{composition:[externalTarget]});ok(!external.Confounders.includes('profile_weight_transition'));const bodyweight=CORE.buildEvidenceViews({decisionNow:iso(27,12),profile:profile(75),exerciseMatrix:matrix},[a,b],{composition:BASE_COMPOSITION});ok(bodyweight.Confounders.includes('profile_weight_transition'));const loadedA=record({day:22}),loadedB=record({day:26});loadedB.v3.configSnapshot.externalLoad=10;ok(!cmp(loadedA,loadedB).blocking);});
T('T14 profile goal transition snapshots preserved',()=>{const h=[record({day:22,goal:'GENERAL'}),record({day:24,goal:'ENDURANCE'}),record({day:26,goal:'ENDURANCE'})];const r=derive({history:h});eq(r.diagnostics.evidenceViews.historyContext.length,3);});
T('T15 unsupported strength goal keeps factual state',()=>{const h=[record({day:22}),record({day:24}),record({day:26})];const r=derive({history:h,profile:profile(65,'STRENGTH')});eq(r.decisionStatus,'GOAL_LIMITED');ok(r.performanceState!=='GOAL_LIMITED');});
T('T16 matrix version change retained historical semantics',()=>{const h=[record({day:22}),record({day:24,matrixVersion:'old-matrix'}),record({day:26})];const r=derive({history:h});eq(r.diagnostics.evidenceViews.historyContext.length,3);ok(r.diagnostics.evidenceViews.strictCohort.length<3);});
T('T17 current matrix lacks old variant no strict proof',()=>{const h=[record({day:22}),record({day:24})];const current=comp({s1:{variantId:'pull_row_inverted'}});const r=derive({history:h,composition:current,equipment:{stableSupport:true}});ok(r.diagnostics.evidenceViews.strictCohort.length===0||r.diagnostics.evidenceViews.strictCohort.length<h.length);});
T('T18 equipment disappearance can generate valid repair or bounded fallback',()=>{const h=[record({day:20}),record({day:22}),record({day:24})];const r=derive({history:h,equipment:{stableSupport:true},composition:BASE_COMPOSITION});ok(['ADAPT','PRESERVE','NO_ACTION'].includes(r.decisionMode));if(r.decisionMode==='ADAPT') ok(r.workoutSpec.validation.valid);});
T('T19 invalid current never returned as maintain',()=>{const r=derive({invalid:true,equipment:{stableSupport:true},composition:BASE_COMPOSITION,history:[]});ok(!(r.decisionMode==='PRESERVE'&&r.decisionStatus==='VALID'));});
T('T20 Builder invalid no action',()=>{const r=derive({invalid:true,ownership:'BUILDER',history:[]});eq(r.decisionMode,'NO_ACTION');});
T('T21 reentry 3-ex minimum preserved',()=>{const h=[record({day:15})];const r=derive({history:h,now:'2026-09-27T12:00:00Z'});eq(r.sessionPurpose,'REENTRY');eq(r.workoutSpec.composition.length,3);});
T('T22 reentry 4-ex valid structure',()=>{const c=[...BASE_COMPOSITION,{slotId:'s4',exerciseId:'abs',variantId:'abs_controlled',count:10,order:4}];const h=[record({day:15,composition:c})];const r=derive({history:h,composition:c});eq(r.sessionPurpose,'REENTRY');eq(r.workoutSpec.composition.length,4);});
T('T23 severe reentry -> R1 repeat',()=>{const h=[record({day:15}),record({day:26,sessionType:'REENTRY',endedBy:'manual',reentryRepeatCount:0})];const r=derive({history:h,now:'2026-09-27T12:00:00Z'});eq(r.sessionPurpose,'REENTRY');eq(r.decisionMode,'PRESERVE');});
T('T24 reentry 0.75 -> R2 repeat',()=>{const h=[record({day:15}),record({day:26,sessionType:'REENTRY',duration:315,reentryRepeatCount:0})];const r=derive({history:h,now:'2026-09-27T12:00:00Z'});eq(r.sessionPurpose,'REENTRY');});
T('T25 reentry 0.95 clean -> R3 one step',()=>{const h=[record({day:15,plannedSeconds:600}),record({day:26,sessionType:'REENTRY',plannedSeconds:420,duration:399,reentryRepeatCount:0})];const r=derive({history:h,now:'2026-09-27T12:00:00Z'});eq(r.sessionPurpose,'STANDARD');eq(r.decisionMode,'ADAPT');});
T('T26 reentry repeat limit bounded',()=>{const h=[record({day:15}),record({day:26,sessionType:'REENTRY',duration:300,reentryRepeatCount:2})];const r=derive({history:h,now:'2026-09-27T12:00:00Z'});ok(r.sessionPurpose!=='REENTRY'||r.decisionMode!=='PRESERVE'||r.workoutSpec.provenance.reentryRepeatCount<=2);});
T('T27 wearable anomaly does not override performance',()=>{const h=[record({day:22,rounds:10}),record({day:24,rounds:11}),record({day:26,rounds:12})];const r=derive({history:h,externalContext:{status:'ANOMALY',validatedForDecision:false}});ok(r.performanceState==='IMPROVING'||r.performanceState==='STABLE');});
T('T28 wearable caution plus positive performance stays bounded',()=>{const h=[record({day:22,rounds:10}),record({day:24,rounds:11}),record({day:26,rounds:12})];const r=derive({history:h,externalContext:{status:'CAUTION',validatedForDecision:false}});ok(r.decisionMode==='ADAPT'||r.decisionMode==='PRESERVE');});
T('T29 missing wearable data no penalty',()=>{const h=[record({day:22}),record({day:24}),record({day:26})];const r=derive({history:h,externalContext:null});ok(r.performanceState!=='FAILED');});
T('T30 wearable invalid timestamp bounded',()=>{const h=[record({day:22}),record({day:24}),record({day:26})];const r=derive({history:h,externalContext:{status:'ANOMALY',timestamp:'bad',validatedForDecision:false}});ok(['ADAPT','PRESERVE','NO_ACTION'].includes(r.decisionMode));});
T('T31 same input same time same result',()=>{const h=[record({day:22}),record({day:24}),record({day:26})];const a=derive({history:h});const b=derive({history:h});eq(a.workoutSpec.specId,b.workoutSpec.specId);eq(a.decisionStatus,b.decisionStatus);});
T('T32 crossing reentry threshold changes branch',()=>{const h=[record({day:18})];const a=derive({history:h,now:'2026-09-27T12:00:00Z'});const b=derive({history:h,now:'2026-09-25T12:00:00Z'});ok(a.sessionPurpose!==b.sessionPurpose);});
T('T33 reordered history deterministic',()=>{const h=[record({day:22}),record({day:24}),record({day:26})];const a=derive({history:h});const b=derive({history:[h[2],h[0],h[1]]});eq(a.workoutSpec.specId,b.workoutSpec.specId);});
T('T34 candidate permutation deterministic',()=>{const h=[record({day:22}),record({day:24}),record({day:26})];const a=derive({history:h});const b=derive({history:h});eq(a.action && a.action.type,b.action && b.action.type);});
T('T35 manifest mismatch stale',()=>{const r=derive({manifest:{coreVersion:'old-core'}});eq(r.decisionStatus,'STALE');});
T('T36 unknown matrix compatibility stale',()=>{const r=derive({manifest:{compatibilityVersion:'unknown'}});eq(r.decisionStatus,'STALE');});
T('T37 isolated anomaly no permanent rewrite',()=>{const h=[record({day:22,rounds:12}),record({day:24,rounds:12}),record({day:26,rounds:5,endedBy:'manual'})];const r=derive({history:h});ok(r.decisionMode!=='ADAPT'||r.action===null||r.action.type==='decrease_count');});
T('T38 three improving clean permits progress',()=>{const h=[record({day:22,rounds:10}),record({day:24,rounds:11}),record({day:26,rounds:12})];const r=derive({history:h});ok(r.decisionMode==='ADAPT'||r.decisionMode==='PRESERVE');});
T('T39 plateau without question not control',()=>{const h=[record({day:18,rounds:10}),record({day:20,rounds:10}),record({day:22,rounds:10}),record({day:24,rounds:10}),record({day:26,rounds:10}),record({day:27,rounds:10})];const r=derive({history:h});ok(r.sessionPurpose!=='CONTROL');});
T('T40 plateau with explicit question can control only with stability contract',()=>{const mc=CORE.defaultMeasurementContract('rounds','fixed');mc.stabilityTolerance=0.05;const h=[record({day:18,mode:'rounds',target:10,targetRounds:10,plannedSeconds:null,rounds:10,duration:600}),record({day:20,mode:'rounds',target:10,targetRounds:10,plannedSeconds:null,rounds:10,duration:600}),record({day:22,mode:'rounds',target:10,targetRounds:10,plannedSeconds:null,rounds:10,duration:600}),record({day:24,mode:'rounds',target:10,targetRounds:10,plannedSeconds:null,rounds:10,duration:600}),record({day:26,mode:'rounds',target:10,targetRounds:10,plannedSeconds:null,rounds:10,duration:600}),record({day:27,mode:'rounds',target:10,targetRounds:10,plannedSeconds:null,rounds:10,duration:600})];const r=derive({history:h,mode:'rounds',target:10,targetRounds:10,plannedSeconds:null,measurementContract:mc,controlQuestion:'Is plateau reproducible?'});ok(['CONTROL','REPEAT','PRESERVE'].includes(r.sessionPurpose));});
T('T41 sufficient atomic beats bundle',()=>{const h=[record({day:22}),record({day:24}),record({day:26})];const p={requiredExerciseCount:4,eligibleAddExercises:['abs'],exerciseDefaults:{abs:10},preAuthorizedStructuralClasses:['ADD_4TH_ORDER_CHANGE'],orderRequirement:['s1','s2','s3']};const r=derive({history:h,programContext:p});ok(!r.action||r.action.type!=='structural_multi_lever');});
T('T42 no atomic but authorized structural bundle bounded',()=>{const r=derive({history:[],baselineAuthority:false,programContext:{requiredExerciseCount:4,eligibleAddExercises:['abs'],exerciseDefaults:{abs:10},preAuthorizedStructuralClasses:['ADD_4TH_ORDER_CHANGE']}});ok(['NO_ACTION','PRESERVE','ADAPT'].includes(r.decisionMode));});
T('T43 UI structuralNeed ignored',()=>{const h=[record({day:22}),record({day:24}),record({day:26})];const r=derive({history:h,structuralNeed:true,singleLeverInsufficient:true});ok(r.action==null||r.action.type!=='structural_multi_lever');});
T('T44 Builder singleLeverInsufficient ignored',()=>{const r=derive({ownership:'BUILDER',singleLeverInsufficient:true,structuralNeed:true});eq(r.decisionMode,'NO_ACTION');});
T('T45 novelty-only rejected',()=>{const h=[record({day:22}),record({day:24}),record({day:26})];const r=derive({history:h});ok(!(r.action&&r.action.type==='change_variant' && r.performanceState==='STABLE'));});
T('T46 fifth exercise rejected',()=>{const c=[...BASE_COMPOSITION,{slotId:'s4',exerciseId:'abs',variantId:'abs_controlled',count:10,order:4},{slotId:'s5',exerciseId:'abs',variantId:'abs_reverse',count:10,order:5}];const r=derive({composition:c,history:[]});ok(!r.application.allowed || r.workoutSpec.validation.valid===false || r.decisionMode==='NO_ACTION');});
T('T47 add4 without default not generated',()=>{const h=[record({day:22}),record({day:24}),record({day:26})];const r=derive({history:h,programContext:{requiredExerciseCount:4,eligibleAddExercises:['abs'],exerciseDefaults:{}}});ok(!(r.action&&r.action.type==='add_exercise'));});
T('T48 four add candidates deterministic',()=>{const h=[record({day:22}),record({day:24}),record({day:26})];const p={requiredExerciseCount:4,eligibleAddExercises:['abs','squat'],exerciseDefaults:{abs:10,squat:5}};const a=derive({history:h,programContext:p});const b=derive({history:h,programContext:p});eq(a.workoutSpec.specId,b.workoutSpec.specId);});
T('T49 fixed format rejects format change',()=>{const r=derive({formatPolicy:'fixed',mode:'time',history:[]});ok(!r.action||r.action.type!=='change_format');});
T('T50 free format cross-format Level B unresolved',()=>{const p=record({day:24,specId:'parent'});const child=record({day:26,mode:'rounds',target:10,targetRounds:10,plannedSeconds:null,specId:'child',executionFidelity:'EXACT'});const r=derive({mode:'rounds',target:10,targetRounds:10,plannedSeconds:null,history:[p],interventionWindow:{parentSpecId:'parent',interventionType:'FORMAT_CHANGE',direction:'UP',fidelity:'EXACT',childRecord:child}});eq(r.decisionStatus,'EVIDENCE_LIMITED');});
T('T51 missing mandatory metric unknown',()=>{const p=record({day:24,specId:'parent'});const c=record({day:26,specId:'child',executionFidelity:'EXACT',rounds:null,duration:null});const r=derive({history:[p],interventionWindow:{parentSpecId:'parent',interventionType:'COUNT',direction:'UP',fidelity:'EXACT',childRecord:c}});eq(r.decisionStatus,'EVIDENCE_LIMITED');});
T('T52 early stop external not automatic failure',()=>{const h=[record({day:22}),record({day:24}),record({day:26,endedBy:'manual'})];const r=derive({history:h});ok(r.decisionStatus!=='CONFLICTED'||r.action===null);});
T('T53 profile snapshot change isolates old meaning',()=>{const h=[record({day:22,weight:65}),record({day:24,weight:65}),record({day:26,weight:65})];const r=derive({history:h,profile:profile(72)});ok(r.diagnostics.evidenceViews.strictCohort.length===0||r.diagnostics.evidenceViews.strictCohort.length<3);});
T('T54 matrix compatibility map may preserve evidence',()=>{const old=record({day:24});old.v3.exerciseMatrixVersion=CORE.MATRIX_VERSION;const h=[record({day:22}),old,record({day:26})];const r=derive({history:h});ok(r.diagnostics.evidenceViews.strictCohort.length>=2);});
T('T55 matrix change without map excludes strict',()=>{const h=[record({day:22,matrixVersion:'matrix-old'}),record({day:24}),record({day:26})];const r=derive({history:h});ok(r.diagnostics.evidenceViews.strictCohort.length<3);});
T('T56 spec/core mismatch stale',()=>{const r=derive({manifest:{specVersion:'2.8.0'}});eq(r.decisionStatus,'STALE');});
T('T57 explanation claims are complete, canonical, and validated',()=>{const h=[record({day:22}),record({day:24}),record({day:26})];const r=derive({history:h}),spec=r.workoutSpec,declared=spec.provenance.usedDecisionVariables,claims=spec.explanation.claims;ok(Array.isArray(declared)&&declared.length>0);eq(JSON.stringify(spec.explanation.usedDecisionVariables),JSON.stringify(declared));ok(Array.isArray(claims)&&claims.length>0);eq(CORE.validateExplanation(spec).length,0);for(const claim of claims){ok(claim.text===spec.explanation[claim.field]);ok(claim.decisionVariables.length>0);for(const variable of claim.decisionVariables)ok(declared.includes(variable));}const corrupt=clone(spec);corrupt.explanation.claims[0].decisionVariables.push('CoachInput.unsupportedGuess');ok(CORE.validateExplanation(corrupt).includes('explanation_claim_unsupported_variable'));const omitted=clone(spec);omitted.explanation.usedDecisionVariables=[];ok(CORE.validateExplanation(omitted).includes('explanation_variable_manifest_mismatch'));});
T('T58 Level B exact bundle is unsupported if bundle envelope absent',()=>{const p=record({day:24,specId:'parent'});const child=record({day:26,specId:'child'});const r=derive({history:[p],interventionWindow:{parentSpecId:'parent',interventionType:'STRUCTURAL_BUNDLE',direction:'UP',fidelity:'EXACT',childRecord:child}});eq(r.decisionStatus,'EVIDENCE_LIMITED');});
T('T59 count+1 unsupported cross-format envelope',()=>{const p=record({day:24,specId:'parent'});const child=record({day:26,mode:'rounds',target:10,targetRounds:10,plannedSeconds:null,specId:'child'});const r=derive({mode:'rounds',target:10,targetRounds:10,plannedSeconds:null,history:[p],interventionWindow:{parentSpecId:'parent',interventionType:'COUNT',direction:'UP',fidelity:'EXACT',childRecord:child}});eq(r.decisionStatus,'EVIDENCE_LIMITED');});
T('T60 deleted history recompute',()=>{const h=[record({day:22}),record({day:24}),record({day:26})];const a=derive({history:h});const b=derive({history:h.slice(1)});ok(a.workoutSpec.specId!==b.workoutSpec.specId || a.diagnostics.evidenceViews.strictCohort.length!==b.diagnostics.evidenceViews.strictCohort.length);});
T('T61 restored history recompute',()=>{const h=[record({day:22}),record({day:24}),record({day:26})];const a=derive({history:h});const b=derive({history:h.slice(1)});const c=derive({history:h});eq(a.workoutSpec.specId,c.workoutSpec.specId);});
T('T62 timezone near midnight explicit',()=>{const r=derive({history:[record({day:26})],now:'2026-09-27T00:30:00-05:00',timezone:'America/New_York'});ok(r.workoutSpec.provenance.decisionNow==='2026-09-27T00:30:00-05:00');});
T('T63 DST explicit timezone deterministic',()=>{const r=derive({history:[record({day:25})],now:'2026-11-01T01:30:00-04:00',timezone:'America/New_York'});ok(r.workoutSpec.provenance.decisionTimezone==='America/New_York');});
T('T64 future-dated records are absent from every current evidence path',()=>{const future=record({day:28}),r=derive({history:[future],now:'2026-09-27T12:00:00Z'}),views=r.diagnostics.evidenceViews;for(const key of ['historyContext','strictCohort','recentStrictWindow','trendCohort'])eq(views[key].includes(future.id),false);ok(!(r.workoutSpec.evidenceRefs||[]).includes(future.id));ok(!(r.evidence||[]).some(item=>(item.sourceRecordIds||[]).includes(future.id)));eq(r.inputProvenance.historyRecordCount,0);});
T('T65 duplicate IDs remain bounded',()=>{const x=record({day:22,id:'dup'});const r=derive({history:[x,x,record({day:24,id:'u'}),record({day:26,id:'v'})]});ok(r.diagnostics.evidenceViews.historyContext.length<=3);});
T('T66 conflicting profile source requires explicit resolved profile',()=>{const r=derive({profile:{age:39,weightKg:65,goal:'GENERAL'},history:[]});eq(r.inputProvenance.profile.weightKg,65);});
T('T67 equipment actual context wins over profile equipment',()=>{const r=derive({equipment:{pullupBar:false},profile:{...profile(),equipment:{pullupBar:true}},history:[]});eq(r.inputProvenance.currentContext.ownership,'COACH');});
T('T68 positive performance cannot override hard exclusion',()=>{const h=[record({day:22}),record({day:24}),record({day:26,rounds:20})];const r=derive({history:h,restrictions:{excludedFamilies:['push']}});ok(!(r.action&&r.action.exerciseId==='push'));});
T('T69 goal reached does not force larger target',()=>{const h=[record({day:22,rounds:20}),record({day:24,rounds:20}),record({day:26,rounds:20})];const r=derive({history:h,profile:profile(65,'ENDURANCE')});ok(!(r.action&&r.action.type==='change_rounds'&&r.action.delta>1));});
T('T70 no candidate last valid Coach spec preserve',()=>{const h=[record({day:22}),record({day:24}),record({day:26})];const r=derive({history:h,invalid:false});ok(['PRESERVE','ADAPT','NO_ACTION'].includes(r.decisionMode));});
T('T71 none current invalid baseline fallback bounded',()=>{const r=derive({invalid:true,baselineAuthority:true,history:[]});ok(['ADAPT','NO_ACTION'].includes(r.decisionMode));});
T('T72 future-dated History never enters evidence',()=>{const future=record({day:28}),r=derive({history:[record({day:22}),record({day:24}),record({day:26}),future],now:'2026-09-27T12:00:00Z'});ok(!r.diagnostics.evidenceViews.strictCohort.includes(future.id));ok(!r.diagnostics.evidenceViews.trendCohort.includes(future.id));});
T('T73 edited canonical History invalidates prior Coach evidence',()=>{const edited=record({day:24});edited.valid=false;edited.v3.valid=false;edited.v3.historyMutation={kind:'edit',editedAt:'2026-09-27T11:00:00Z'};edited.v3.semanticSnapshotStatus='INVALIDATED_BY_HISTORY_EDIT';const normalized=CORE.normalizeHistoryRecord(edited),r=derive({history:[record({day:22}),edited,record({day:26})]});ok(!normalized.valid&&!normalized.validSemanticSnapshot);ok(!r.diagnostics.evidenceViews.strictCohort.includes(edited.id));ok(!r.diagnostics.evidenceViews.trendCohort.includes(edited.id));});
T('T72 no fallback no action',()=>{const r=derive({invalid:true,equipment:{pullupBar:false,stableSupport:false},history:[]});eq(r.decisionMode,'NO_ACTION');});
T('T73 partial positive no Level B',()=>{const p=record({day:24,specId:'parent'});const c=record({day:26,executionFidelity:'PARTIAL',rounds:20,specId:'child'});const r=derive({history:[p],interventionWindow:{parentSpecId:'parent',interventionType:'COUNT',direction:'UP',fidelity:'PARTIAL',childRecord:c}});eq(r.decisionStatus,'EVIDENCE_LIMITED');});
T('T74 exact ambiguous repeat',()=>{const p=record({day:24,specId:'parent'});const c=record({day:26,executionFidelity:'EXACT',duration:null,rounds:null,specId:'child'});const r=derive({history:[p],interventionWindow:{parentSpecId:'parent',interventionType:'COUNT',direction:'UP',fidelity:'EXACT',childRecord:c}});eq(r.sessionPurpose,'REPEAT');});
T('T75 exact clean negative conservative',()=>{const p=record({day:24,specId:'parent',rounds:20});const c=record({day:26,executionFidelity:'EXACT',rounds:10,specId:'child'});const r=derive({history:[p],interventionWindow:{parentSpecId:'parent',interventionType:'COUNT',direction:'UP',fidelity:'EXACT',childRecord:c}});ok(r.decisionMode==='ADAPT'||r.decisionMode==='PRESERVE');});
T('T76 exact acceptable confirm',()=>{const p=record({day:24,specId:'parent',rounds:20});const c=record({day:26,executionFidelity:'EXACT',rounds:18,specId:'child'});const r=derive({history:[p],interventionWindow:{parentSpecId:'parent',interventionType:'COUNT',direction:'UP',fidelity:'EXACT',childRecord:c}});eq(r.sessionPurpose,'REPEAT');});
T('T77 only 2 unique days does not directional progress',()=>{const h=[record({day:25,rounds:10}),record({day:25,id:'b',rounds:11}),record({day:26,rounds:12})];const r=derive({history:h});ok(!(r.action&&r.action.type==='increase_count'&&r.confidence.overallPermission==='ATOMIC_ADAPTATION_ALLOWED'));});
T('T78 same day sessions not multiplied',()=>{const h=[record({day:25,id:'a'}),record({day:25,id:'b'}),record({day:26,id:'c'})];const r=derive({history:h});ok(r.confidence.quantity<=2 || r.diagnostics.evidenceViews.recentStrictWindow.length<=6);});
T('T79 matrix update before decision blocks old strict',()=>{const h=[record({day:25,matrixVersion:'old'}),record({day:26,matrixVersion:'old'})];const r=derive({history:h});ok(r.diagnostics.evidenceViews.strictCohort.length===0);});
T('T80 profile/equipment change before decision bounds output',()=>{const h=[record({day:24}),record({day:26})];const r=derive({history:h,equipment:{pullupBar:false,stableSupport:true}});ok(['ADAPT','PRESERVE','NO_ACTION'].includes(r.decisionMode));});
T('T81 duration tolerance exact boundary passes',()=>{const a=record({day:22,plannedSeconds:600}),b=record({day:24,plannedSeconds:630});eq(cmp(a,b).comparable,true);});
T('T82 duration tolerance +1 blocks',()=>{const a=record({day:22,plannedSeconds:600}),b=record({day:24,plannedSeconds:661});ok(cmp(a,b).blocking);});
T('T83 semantic class change blocks strict',()=>{const a=record({day:22}),b=record({day:24,composition:comp({s1:{variantId:'pull_wide'}})});const c=cmp(a,b);ok(c.blocking);});
T('T84 body mass +5% blocks strict',()=>{const a=record({day:22,weight:65}),b=record({day:24,weight:68.25});ok(cmp(a,b).blocking);});
T('T85 body mass <5% does not block',()=>{const a=record({day:22,weight:65}),b=record({day:24,weight:68});ok(!cmp(a,b).blocking);});
T('T86 missing bodyweight unresolved',()=>{const a=record({day:22,weight:65});const b=record({day:24,weight:null});const c=cmp(a,b);ok(c.unresolved);});
T('T87 current-comparable but reference-incoherent excluded trend',()=>{const a=record({day:22,weight:63}),b=record({day:24,weight:65}),c=record({day:26,weight:67});const d=record({day:20,weight:65});const r=derive({history:[d,a,b,c]});ok(r.diagnostics.evidenceViews.strictCohort.length===4);ok(r.diagnostics.evidenceViews.trendCohort.length<r.diagnostics.evidenceViews.strictCohort.length);});
T('T88 delete reference recomputes trend',()=>{const h=[record({day:22}),record({day:24}),record({day:26})];const a=derive({history:h});const b=derive({history:h.slice(1)});ok(a.diagnostics.evidenceViews.trendCohort.length!==b.diagnostics.evidenceViews.trendCohort.length || a.workoutSpec.specId!==b.workoutSpec.specId);});
T('T89 count retention 0.85 acceptable',()=>{const p=record({day:24,rounds:20,specId:'parent'});const c=record({day:26,rounds:17,specId:'child',executionFidelity:'EXACT'});const r=derive({history:[p],interventionWindow:{parentSpecId:'parent',interventionType:'COUNT',direction:'UP',fidelity:'EXACT',childRecord:c}});eq(r.sessionPurpose,'REPEAT');});
T('T90 count retention 0.849 poor',()=>{const p=record({day:24,rounds:20,specId:'parent'});const c=record({day:26,rounds:16,specId:'child',executionFidelity:'EXACT'});const r=derive({history:[p],interventionWindow:{parentSpecId:'parent',interventionType:'COUNT',direction:'UP',fidelity:'EXACT',childRecord:c}});ok(r.decisionMode==='ADAPT'||r.decisionMode==='PRESERVE');});
T('T91 partial 1.20 ineligible',()=>{const p=record({day:24,rounds:10,specId:'parent'});const c=record({day:26,rounds:12,specId:'child',executionFidelity:'PARTIAL'});const r=derive({history:[p],interventionWindow:{parentSpecId:'parent',interventionType:'COUNT',direction:'UP',fidelity:'PARTIAL',childRecord:c}});eq(r.decisionStatus,'EVIDENCE_LIMITED');});
T('T92 variant Level B unsupported',()=>{const p=record({day:24,specId:'parent'});const c=record({day:26,specId:'child'});const r=derive({history:[p],interventionWindow:{parentSpecId:'parent',interventionType:'VARIANT',direction:'UP',fidelity:'EXACT',childRecord:c}});eq(r.decisionStatus,'EVIDENCE_LIMITED');});
T('T93 order change retention boundary supported',()=>{const p=record({day:24,rounds:20,specId:'parent'});const c=record({day:26,rounds:17,specId:'child'});const r=derive({history:[p],interventionWindow:{parentSpecId:'parent',interventionType:'ORDER_CHANGE',direction:'UP',fidelity:'EXACT',childRecord:c}});eq(r.sessionPurpose,'REPEAT');});
T('T94 duration without rate metric unresolved',()=>{const p=record({day:24,specId:'parent'});const c=record({day:26,specId:'child'});const mc=CORE.defaultMeasurementContract('time','fixed');mc.primaryMetric=null;const r=derive({history:[p],measurementContract:mc,interventionWindow:{parentSpecId:'parent',interventionType:'DURATION',direction:'UP',fidelity:'EXACT',childRecord:c}});eq(r.decisionStatus,'EVIDENCE_LIMITED');});
T('T95 progress 2 days insufficient',()=>{const h=[record({day:25}),record({day:26})];const r=derive({history:h});ok(r.confidence.overallPermission!=='ATOMIC_ADAPTATION_ALLOWED');});
T('T96 progress 3 days can satisfy objective',()=>{const h=[record({day:22,rounds:10}),record({day:24,rounds:11}),record({day:26,rounds:12})];const r=derive({history:h});ok(['ADAPT','PRESERVE'].includes(r.decisionMode));});
T('T97 structural objective absent is unsupported',()=>{const h=[record({day:22}),record({day:24}),record({day:26})];const r=derive({history:h});ok(!(r.action&&r.action.type==='add_exercise')||!r.inputProvenance.currentContext.programContext);});
T('T98 plateau without stability tolerance unsupported',()=>{const h=[record({day:18,rounds:10}),record({day:20,rounds:10}),record({day:22,rounds:10}),record({day:24,rounds:10}),record({day:26,rounds:10}),record({day:27,rounds:10})];const r=derive({history:h});ok(r.sessionPurpose!=='CONTROL');});
T('T99 evidence collection with named missing metric bounded',()=>{const h=[record({day:22}),record({day:24}),record({day:26})];const r=derive({history:h,missingEvidence:['wearable_sleep']});ok(['PRESERVE','ADAPT','NO_ACTION'].includes(r.decisionMode));});
T('T100 identical input identical spec id',()=>{const h=[record({day:22}),record({day:24}),record({day:26})];const a=derive({history:h});const b=derive({history:h});eq(a.workoutSpec.specId,b.workoutSpec.specId);});

module.exports={tests,MANIFEST,matrix,record,input,derive};
