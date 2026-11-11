global.window = global;
global.self = global;
const assert = require('assert');
const core = require('../coach_core_v3/coach_core_v3.js');
require('../src/domain/exercises/exercise_catalog_v3.js');
require('../src/infrastructure/storage/local_storage_v3.js');
require('../src/infrastructure/storage/coach_state_repository_v3.js');
require('../src/infrastructure/storage/coach_state_migration_v3.js');
require('../src/domain/workout/session_contract_v3.js');
require('../src/domain/history/history_provenance_v3.js');
require('../src/application/workout/workout_history_service_v3.js');
require('../src/application/coach/coach_application_service_v3.js');

const serviceFactory = window.CINDYCoachApplicationServiceV3;
const repoFactory = window.CINDYCoachStateRepositoryV3;
const storageFactory = window.CINDYLocalStorageV3;
const sessionContract = window.CINDYSessionContractV3;
const provenance = window.CINDYHistoryProvenanceV3;
const workoutHistory = window.CINDYWorkoutHistoryServiceV3;

const storage = new Map();
const ls = {
  getItem: k => storage.has(k) ? storage.get(k) : null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: k => storage.delete(k),
  clear: () => storage.clear()
};

const stateStorage = storageFactory.create({ storage: ls });
const stateRepo = repoFactory.create({ storagePort: stateStorage, key: 'cindyCoachV3State' });

let cfg = {
  mode: 'time',
  minutes: 10,
  target: 0,
  coachEnabled: true,
  composition: [
    { slotId: 'slot-1', exerciseId: 'pull', count: 5, order: 1 },
    { slotId: 'slot-2', exerciseId: 'push', count: 10, order: 2 },
    { slotId: 'slot-3', exerciseId: 'squat', count: 15, order: 3 }
  ],
  equipment: { pullupBar: true }
};

let historyRecords = [];
let currentSession = { status: 'idle', rounds: 0, composition: cfg.composition };
let currentTime = '2026-10-01T10:00:00.000Z';

const releaseManifest = {
  specVersion: '3.0.0',
  coreVersion: core.CORE_VERSION,
  buildHash: 'ef69c3217fb2b123cfc631483f3bc331df145a7eed5e9feeb1ec3c9734c49a04',
  sourceHash: '024608c9a30091d1d85105fea25dc28444f8b171fce890d313924b07f0a6f046',
  fixtureCorpusVersion: 'v3.0.0-100',
  exerciseMatrixVersion: 'cindy-matrix-v3',
  compatibilityVersion: 'cindy-compat-v3',
  releaseCandidateId: 'test',
  integrityVersion: 'CINDY_RELEASE_HASH_V1',
  releaseSourceHash: '83ea6829ca6bd899d2f098bb3e6203113989e3123d90a2bb3a42a23d658fd7cd',
  releaseBuildHash: 'c1cb7411af2c96d436c3742adad2667c1c9ccd6e227e0b2cff34c37f7ae87285'
};

const service = serviceFactory.create({
  core,
  stateRepository: stateRepo,
  configPort: {
    relevantSnapshot: () => ({ ...cfg, ownership: 'COACH', sessionType: 'STANDARD' }),
    currentConfig: () => cfg,
    currentMode: () => cfg.mode,
    maxExercises: () => 4,
    equipment: () => cfg.equipment,
    restrictions: () => ({}),
    excludedExerciseIds: () => [],
    profileSnapshot: () => ({ age: 30, weightKg: 70 }),
    applyCoachPatch: p => { Object.assign(cfg, p); return true; }
  },
  sessionPort: {
    get: () => currentSession,
    replace: s => { currentSession = s; },
    save: () => true,
    restore: s => { currentSession = s; return true; },
    isRunning: () => currentSession.status === 'running'
  },
  historyPort: { records: () => historyRecords },
  contextPort: {
    currentCoachContext: () => ({}),
    profileSnapshot: () => ({ age: 30, weightKg: 70 }),
    formatPolicy: () => 'fixed',
    programContext: () => null
  },
  matrixPort: { get: () => window.CINDYExerciseCatalogV3.CINDY_FINAL_COACH_MATRIX },
  externalContextPort: { get: () => null },
  activityPort: {
    isRunning: () => currentSession.status === 'running',
    isPaused: () => currentSession.status === 'paused'
  },
  clockPort: { now: () => currentTime, timezone: () => 'UTC' },
  renderPort: { refresh: () => {} },
  baselineAuthorityPort: {
    isAuthorized: () => Boolean(service && service.state && service.state().baselineAuthority),
    clear: () => Boolean(service && service.clearBaselineAuthority && service.clearBaselineAuthority())
  },
  workoutHistoryService: workoutHistory.create({ sessionContract, provenance }),
  enabledPort: () => true,
  integrityPort: { sha256: x => require('crypto').createHash('sha256').update(String(x)).digest('hex'), canonicalJson: JSON.stringify },
  releaseManifest
});

function runWorkout({ date, finishDate, rounds }) {
  currentTime = date;
  const prepared = service.prepareForStart({ decisionNow: currentTime });
  assert(prepared, `prepareForStart must succeed at ${date}`);
  currentSession = { ...prepared.sessionRuntime, status: 'running', startedAt: Date.parse(currentTime) };
  service.commitStart({
    frozenSpec: prepared.frozenSpec,
    baselineAuthorizedAtStart: prepared.baselineAuthorizedAtStart,
    isBaseline: Boolean(prepared.isBaseline)
  });
  const raw = {
    id: `rec-${date.slice(0, 10)}`,
    completedAt: finishDate,
    rounds,
    duration: 600,
    mode: 'time',
    plannedSeconds: 600,
    target: 0,
    endedBy: 'time',
    composition: cfg.composition,
    laps: Array.from({ length: rounds }, (_, idx) => ({
      n: idx + 1,
      duration: Math.floor(600 / rounds),
      total: (idx + 1) * Math.floor(600 / rounds)
    }))
  };
  const decorated = service.handleRecord({ raw, end: 'time' });
  historyRecords.unshift(decorated);
  service.reconcileAfterFinish(decorated);
  currentSession = { status: 'idle', rounds: 0, composition: cfg.composition };
  return decorated;
}

console.log('=== CYCLE 1: Baseline + Starter + Days 1-3 ===');
currentTime = '2026-10-01T10:00:00.000Z';
service.requestBaseline(10);
let prepared = service.prepareForStart({ decisionNow: currentTime });
currentSession = { ...prepared.sessionRuntime, status: 'running', startedAt: Date.parse(currentTime) };
service.commitStart({ frozenSpec: prepared.frozenSpec, baselineAuthorizedAtStart: true, isBaseline: true });
const baselineRaw = {
  id: 'baseline-rec',
  completedAt: '2026-10-01T10:10:00.000Z',
  rounds: 6,
  duration: 600,
  mode: 'time',
  plannedSeconds: 600,
  target: 0,
  endedBy: 'time',
  composition: cfg.composition,
  laps: Array.from({ length: 6 }, (_, i) => ({ n: i + 1, duration: 100, total: (i + 1) * 100 }))
};
const baselineDecorated = service.handleRecord({ raw: baselineRaw, end: 'time' });
historyRecords.unshift(baselineDecorated);
service.reconcileAfterFinish(baselineDecorated);
currentSession = { status: 'idle', rounds: 0, composition: cfg.composition };

currentTime = '2026-10-01T10:15:00.000Z';
const starterDerive = service.deriveDecision({ decisionNow: currentTime });
if (starterDerive.decisionMode === 'ADAPT') {
  service.apply();
}

runWorkout({ date: '2026-10-02T10:00:00.000Z', finishDate: '2026-10-02T10:10:00.000Z', rounds: 10 });
runWorkout({ date: '2026-10-03T10:00:00.000Z', finishDate: '2026-10-03T10:10:00.000Z', rounds: 11 });
runWorkout({ date: '2026-10-04T10:00:00.000Z', finishDate: '2026-10-04T10:10:00.000Z', rounds: 12 });

currentTime = '2026-10-05T10:00:00.000Z';
const day4Readiness = service.readiness();
console.log('Cycle 1 readiness on Day 4:', day4Readiness.phase, 'ready:', day4Readiness.ready);
assert.strictEqual(day4Readiness.ready, true);

const day4Decision = service.deriveDecision({ decisionNow: currentTime });
console.log('Cycle 1 Decision:', day4Decision.decisionMode, day4Decision.action);
assert.strictEqual(day4Decision.decisionMode, 'ADAPT');
assert(day4Decision.action);

const apply1 = service.apply();
assert.strictEqual(apply1.ok, true);
console.log('Cycle 1 applied! New composition:', cfg.composition);

console.log('=== CYCLE 2: Training with new composition on Days 5-7 ===');
console.log('State pendingIntervention before Day 5:', service.state().pendingIntervention);
const day5Rec = runWorkout({ date: '2026-10-05T11:00:00.000Z', finishDate: '2026-10-05T11:10:00.000Z', rounds: 11 });
console.log('Day 5 rec v3:', {
  sessionPurpose: day5Rec.v3?.sessionPurpose,
  executionFidelity: day5Rec.v3?.executionFidelity,
  plannedSpecSnapshot: day5Rec.v3?.plannedSpecSnapshot?.composition
});
console.log('State pendingIntervention after Day 5:', service.state().pendingIntervention);

const day6Rec = runWorkout({ date: '2026-10-06T10:00:00.000Z', finishDate: '2026-10-06T10:10:00.000Z', rounds: 12 });
const day7Rec = runWorkout({ date: '2026-10-07T10:00:00.000Z', finishDate: '2026-10-07T10:10:00.000Z', rounds: 13 });

currentTime = '2026-10-08T10:00:00.000Z';
const inputForDay8 = service.buildInput ? service.buildInput(currentTime) : null;
const day8Decision = service.deriveDecision({ decisionNow: currentTime });
console.log('Target composition in core decision:', day8Decision.workoutSpec?.composition);
const normalizedD5 = core.normalizeHistoryRecord(day5Rec);
console.log('Normalized D5 sessionType:', normalizedD5.sessionType, 'fidelity:', normalizedD5.executionFidelity);
console.log('Normalized D5 composition:', normalizedD5.composition);

// Let's test strictCompare against day8Decision.workoutSpec
const day8SpecNormalized = {
  ...day8Decision.workoutSpec,
  sessionType: 'STANDARD',
  validSemanticSnapshot: true,
  executionFidelity: 'EXACT'
};
const matrix = window.CINDYExerciseCatalogV3.CINDY_FINAL_COACH_MATRIX;
const cmp = core.strictCompare(normalizedD5, day8SpecNormalized, matrix, 'LEVEL_A');
console.log('Cmp D5 vs Target:', cmp.comparable, cmp.blocking, cmp.unresolved);
console.log('Cmp D5 vs Target blocking fields:', cmp.fields.filter(f => f.result !== 'PASS'));

const day8Readiness = service.readiness();
console.log('Cycle 2 readiness on Day 8:', day8Readiness);
console.log('Cycle 2 Decision Mode:', day8Decision.decisionMode);
console.log('Cycle 2 Decision Status:', day8Decision.decisionStatus);
console.log('Cycle 2 Action:', day8Decision.action);
console.log('Cycle 2 Diagnostics evidenceViews:', day8Decision.diagnostics?.evidenceViews);
console.log('Cycle 2 Diagnostics performanceState:', day8Decision.diagnostics?.performanceState);
console.log('Cycle 2 Diagnostics confidenceProfile:', day8Decision.diagnostics?.confidenceProfile);
console.log('Cycle 2 Diagnostics goalState:', day8Decision.diagnostics?.goalState);
console.log('--- CALLING deriveDecision AFTER LEVEL B CLOSED ---');
const day8DecisionNext = service.deriveDecision({ decisionNow: '2026-10-08T10:05:00.000Z' });
console.log('Cycle 2 NEXT Decision Mode:', day8DecisionNext.decisionMode);
console.log('Cycle 2 NEXT Decision Status:', day8DecisionNext.decisionStatus);
console.log('Cycle 2 NEXT Action:', day8DecisionNext.action);
console.log('Cycle 2 NEXT Reason Codes:', day8DecisionNext.reasonCodes);
console.log('Cycle 2 NEXT Explanation:', day8DecisionNext.workoutSpec?.explanation);




