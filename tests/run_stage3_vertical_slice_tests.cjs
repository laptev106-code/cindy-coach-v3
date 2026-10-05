const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');
const files = [
  ['session_contract_v3.js','src/domain/workout/session_contract_v3.js'],
  ['history_provenance_v3.js','src/domain/history/history_provenance_v3.js'],
  ['workout_history_service_v3.js','src/application/workout/workout_history_service_v3.js']
];
for (const [label, rel] of files) {
  const code = fs.readFileSync(path.join(root, rel), 'utf8');
  vm.runInNewContext(code, {window:{}, structuredClone, JSON, Object, String, Number, Array, TypeError});
  console.log(`PASS module syntax ${label}`);
}


const indexHtml=fs.readFileSync(path.join(root,'index.html'),'utf8');
for (const rel of ['src/domain/workout/session_contract_v3.js','src/domain/history/history_provenance_v3.js','src/application/workout/workout_history_service_v3.js']) {
  const marker=`<script src="./${rel}"></script>`;
  assert(indexHtml.includes(marker),`missing script tag ${rel}`);
}
const appStart=indexHtml.indexOf('<script>', indexHtml.indexOf('workout_history_service_v3.js') + 1);
assert(appStart>indexHtml.indexOf('workout_history_service_v3.js'),'Stage3 modules must load before application runtime');
console.log('PASS Stage3 module load order');
const storage = new Map();
const context = {
  console, Date, Intl, JSON, Math, Number, String, Boolean, Object, Array, RegExp, Error, TypeError, Set, Map,
  localStorage:{getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
  window:null, self:null,
  CindyAdaptiveCoachV3:{canonicalize:v=>v, hash:v=>JSON.stringify(v)},
};
context.window=context; context.self=context;
vm.createContext(context);
for (const [, rel] of files) vm.runInContext(fs.readFileSync(path.join(root, rel),'utf8'), context);
assert(context.CINDYSessionContractV3);
assert(context.CINDYHistoryProvenanceV3);
assert(context.CINDYWorkoutHistoryServiceV3);
const service=context.CINDYWorkoutHistoryServiceV3.create({sessionContract:context.CINDYSessionContractV3,provenance:context.CINDYHistoryProvenanceV3});
const spec={specId:'spec-a',mode:'time',plannedSeconds:600,target:20,composition:[{id:'pull',count:5}],provenance:{decisionNow:'2026-09-28T00:00:00.000Z',decisionTimezone:'Europe/Amsterdam'},adaptation:{levers:['COUNT']}};
const semanticSnapshots={snapshotStatus:'FROZEN_AT_START',semanticSnapshotVersion:'test-v1',semanticSnapshotHash:'snapshot-hash',profileSnapshot:{age:39,profileVersion:'profile-v1-a'},configSnapshot:{minutes:10},constraintSnapshot:{maxExercises:4},measurementContract:{version:'m1'},releaseManifest:{specVersion:'3.0.0'},matrixVersion:'m1',compatibilityVersion:'c1'};
const contract=service.freezeForStart({spec,ownership:'COACH',decisionNow:spec.provenance.decisionNow,decisionTimezone:'Europe/Amsterdam',contextFingerprint:'fp-a',intervention:{parentSpecId:'spec-a'},semanticSnapshots});
assert.deepStrictEqual(JSON.parse(JSON.stringify(contract.v3Spec)),spec);
assert.deepStrictEqual(JSON.parse(JSON.stringify(contract.v3SemanticSnapshots)),semanticSnapshots);
const mutable=JSON.parse(JSON.stringify(spec)); mutable.composition[0].count=99; assert.strictEqual(contract.v3Spec.composition[0].count,5);
semanticSnapshots.profileSnapshot.age=99; assert.strictEqual(contract.v3SemanticSnapshots.profileSnapshot.age,39,'start snapshot must be a deep copy');
const base={status:'running'}; service.restoreSessionContract(base,contract); assert.strictEqual(base.v3Ownership,'COACH'); assert.strictEqual(base.v3ContextFingerprint,'fp-a'); assert.strictEqual(base.v3SemanticSnapshots.semanticSnapshotHash,'snapshot-hash');
const raw={id:'r-a',completedAt:'2026-09-28T00:10:00.000Z',mode:'time',plannedSeconds:600,target:20,rounds:20,duration:600,endedBy:'target',composition:[{id:'pull',count:5}],laps:[]};
const history=service.decorateHistoryRecord({raw,spec,ownership:'COACH',intervention:{parentSpecId:'spec-a'},snapshots:{core:context.CindyAdaptiveCoachV3,profileSnapshot:{age:39,profileVersion:'profile-v1-a',effectiveFrom:'2026-09-01T00:00:00.000Z'},configSnapshot:{minutes:10},constraintSnapshot:{},measurementContract:{version:'m1'},releaseManifest:{specVersion:'3.0.0'},decisionTimezone:'Europe/Amsterdam',matrixVersion:'m1',compatibilityVersion:'c1',semanticSnapshotVersion:'test-v1',semanticSnapshotHash:'snapshot-hash',snapshotCapturedAt:spec.provenance.decisionNow,snapshotStatus:'FROZEN_AT_START'}});
assert.strictEqual(history.v3.executionFidelity,'EXACT'); assert.strictEqual(history.v3.provenance.specId,'spec-a');
assert.strictEqual(history.v3.semanticSnapshotStatus,'FROZEN_AT_START'); assert.strictEqual(history.v3.semanticSnapshotHash,'snapshot-hash'); assert.strictEqual(history.v3.profileEffectiveFrom,'2026-09-01T00:00:00.000Z');
const linked=service.linkInterventionCompletion({intervention:history.v3.coachIntervention,record:history}); assert.strictEqual(linked.childRecordId,'r-a'); assert.strictEqual(linked.status,'EXECUTED');
console.log('PASS freeze/reload contract');
console.log('PASS provenance exact execution');
console.log('PASS intervention linkage');
console.log('DECOMPOSITION_STAGE3_UNIT_PASS');
