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

console.log('=== STEP 1: Request and complete Baseline Test ===');
currentTime = '2026-10-01T10:00:00.000Z';
assert.strictEqual(service.requestBaseline(10), true);
assert.strictEqual(service.readiness().phase, 'NEEDS_BASELINE');
assert.strictEqual(service.readiness().testPending, true);

let prepared = service.prepareForStart({ decisionNow: currentTime });
assert(prepared && prepared.isBaseline);
currentSession = { ...prepared.sessionRuntime, status: 'running', startedAt: Date.parse(currentTime) };
service.commitStart({
  frozenSpec: prepared.frozenSpec,
  baselineAuthorizedAtStart: prepared.baselineAuthorizedAtStart,
  isBaseline: true
});

// Finish baseline test: 10 rounds, 600s, endedBy time
const baselineRaw = {
  id: 'baseline-rec-1',
  completedAt: '2026-10-01T10:10:00.000Z',
  rounds: 10,
  duration: 600,
  mode: 'time',
  plannedSeconds: 600,
  target: 0,
  endedBy: 'time',
  composition: cfg.composition,
  laps: Array.from({ length: 10 }, (_, i) => ({ n: i + 1, duration: 60, total: (i + 1) * 60 }))
};
const baselineDecorated = service.handleRecord({ raw: baselineRaw, end: 'time' });
historyRecords.unshift(baselineDecorated);
service.reconcileAfterFinish(baselineDecorated);
currentSession = { status: 'idle', rounds: 0, composition: cfg.composition };

console.log('Post-baseline readiness:', service.readiness());
assert.strictEqual(service.readiness().phase, 'STARTER_READY');
assert.strictEqual(service.readiness().baselineCompleted, true);

// Apply starter personalization if proposed
currentTime = '2026-10-01T10:15:00.000Z';
const starterDerive = service.deriveDecision({ decisionNow: currentTime });
console.log('Starter derive mode:', starterDerive.decisionMode, starterDerive.action ? starterDerive.action.type : 'none');
if (starterDerive.decisionMode === 'ADAPT') {
  const starterApplied = service.apply();
  console.log('Starter applied ok:', starterApplied.ok);
  assert.strictEqual(starterApplied.ok, true);
}

console.log('=== STEP 2: Execute 3 Daily Workouts (Evidence Collection) ===');
const workoutDays = [
  { date: '2026-10-02T10:00:00.000Z', finishDate: '2026-10-02T10:10:00.000Z', rounds: 10 },
  { date: '2026-10-03T10:00:00.000Z', finishDate: '2026-10-03T10:10:00.000Z', rounds: 11 },
  { date: '2026-10-04T10:00:00.000Z', finishDate: '2026-10-04T10:10:00.000Z', rounds: 12 }
];

for (let i = 0; i < workoutDays.length; i++) {
  const day = workoutDays[i];
  currentTime = day.date;
  console.log(`--- Running Day ${i + 1} (${day.date}): target rounds = ${day.rounds} ---`);
  console.log('Before start readiness:', service.readiness().phase, 'qualifyingTrainings:', service.readiness().qualifyingTrainings);
  
  prepared = service.prepareForStart({ decisionNow: currentTime });
  assert(prepared, `prepareForStart must succeed on Day ${i + 1}`);
  
  currentSession = { ...prepared.sessionRuntime, status: 'running', startedAt: Date.parse(currentTime) };
  service.commitStart({
    frozenSpec: prepared.frozenSpec,
    baselineAuthorizedAtStart: prepared.baselineAuthorizedAtStart,
    isBaseline: false
  });
  
  const raw = {
    id: `day-${i + 1}-rec`,
    completedAt: day.finishDate,
    rounds: day.rounds,
    duration: 600,
    mode: 'time',
    plannedSeconds: 600,
    target: 0,
    endedBy: 'time',
    composition: cfg.composition,
    laps: Array.from({ length: day.rounds }, (_, idx) => ({ n: idx + 1, duration: Math.floor(600 / day.rounds), total: (idx + 1) * Math.floor(600 / day.rounds) }))
  };
  
  const decorated = service.handleRecord({ raw, end: 'time' });
  historyRecords.unshift(decorated);
  service.reconcileAfterFinish(decorated);
  currentSession = { status: 'idle', rounds: 0, composition: cfg.composition };
  
  console.log(`After Day ${i + 1} readiness: phase =`, service.readiness().phase, 'qualifyingTrainings =', service.readiness().qualifyingTrainings);
}

console.log('=== STEP 3: Verify Coach Decision on Day 4 ===');
currentTime = '2026-10-05T10:00:00.000Z';
global.__debugQualifying = true;
const day4Readiness = service.readiness();
console.log('Day 4 readiness:', day4Readiness);
assert.strictEqual(day4Readiness.phase, 'READY');
assert.strictEqual(day4Readiness.ready, true);
assert.strictEqual(day4Readiness.qualifyingTrainings, 3);
assert.strictEqual(day4Readiness.qualifyingDays, 3);

const day4Decision = service.deriveDecision({ decisionNow: currentTime });
console.log('Day 4 Decision Mode:', day4Decision.decisionMode);
console.log('Day 4 Decision Status:', day4Decision.decisionStatus);
console.log('Day 4 Action:', day4Decision.action);
assert.strictEqual(day4Decision.decisionMode, 'ADAPT');
assert.strictEqual(day4Decision.decisionStatus, 'VALID');
assert(day4Decision.action, 'Coach must produce an adaptation action based on performance!');
console.log('ADAPTATION CONFIRMED: Coach adapted workout to:', day4Decision.action);

console.log('=== STEP 4: Apply Coach Adaptation ===');
const beforePushCount = cfg.composition.find(x => (x.id || x.exerciseId) === 'push').count;
const applyResult = service.apply();
assert.strictEqual(applyResult.ok, true);
const afterPushCount = cfg.composition.find(x => (x.id || x.exerciseId) === 'push').count;
console.log(`Push count changed from ${beforePushCount} to ${afterPushCount}!`);
assert.strictEqual(afterPushCount, beforePushCount + 1);
console.log('ALL TESTS PASSED WITH 100% SUCCESS!');

