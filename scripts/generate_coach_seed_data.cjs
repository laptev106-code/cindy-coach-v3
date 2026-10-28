const fs = require('fs');
const path = require('path');

global.window = global;
global.self = global;

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
  target: 1,
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

const releaseManifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../release-manifest.json'), 'utf8'));

const getCanonicalConfigSnapshot = () => core.canonicalize({
  mode: cfg.mode,
  minutes: cfg.minutes,
  target: cfg.target,
  formatPolicy: 'fixed',
  allowedModes: ['time', 'rounds', 'combined'],
  composition: (cfg.composition || []).map(item => {
    const id = item.exerciseId || item.id;
    const res = { id, count: item.count };
    if (item.variantId) res.variantId = item.variantId;
    return res;
  }),
  equipment: {
    benchDipComfort: false,
    parallelBars: false,
    pullupBar: true,
    resistanceBand: false,
    stableSupport: false
  },
  restrictions: {},
  excludedExerciseIds: [],
  coachExcludedVariantIds: [],
  programContext: null,
  pendingSource: null
});

const service = serviceFactory.create({
  core,
  stateRepository: stateRepo,
  configPort: {
    relevantSnapshot: getCanonicalConfigSnapshot,
    currentConfig: () => cfg,
    currentMode: () => cfg.mode,
    maxExercises: () => 4,
    equipment: () => cfg.equipment,
    restrictions: () => ({}),
    excludedExerciseIds: () => [],
    profileSnapshot: () => ({ age: 30, weightKg: 70 }),
    applyCoachPatch: p => {
      Object.assign(cfg, p);
      if (!cfg.target || cfg.target < 1) cfg.target = 1;
      return true;
    }
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
  currentSession = { ...prepared.sessionRuntime, status: 'running', startedAt: Date.parse(currentTime) };
  service.commitStart({
    frozenSpec: prepared.frozenSpec,
    baselineAuthorizedAtStart: prepared.baselineAuthorizedAtStart,
    isBaseline: Boolean(prepared.isBaseline)
  });
  const raw = {
    id: `cindy-rec-${date.slice(0, 10)}`,
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

// 1. Baseline test
currentTime = '2026-10-01T10:00:00.000Z';
service.requestBaseline(10);
let prepared = service.prepareForStart({ decisionNow: currentTime });
currentSession = { ...prepared.sessionRuntime, status: 'running', startedAt: Date.parse(currentTime) };
service.commitStart({ frozenSpec: prepared.frozenSpec, baselineAuthorizedAtStart: true, isBaseline: true });
const baselineRaw = {
  id: 'cindy-baseline-rec',
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

// 2. Starter calibration
currentTime = '2026-10-01T10:15:00.000Z';
const starterDerive = service.deriveDecision({ decisionNow: currentTime });
if (starterDerive.decisionMode === 'ADAPT') {
  console.log('CFG BEFORE APPLY:', cfg);
  const applyRes = service.apply();
  console.log('Starter applied! afterConfig:', JSON.stringify(applyRes.after, null, 2));
  console.log('appliedConfigFingerprint:', service.state().appliedConfigFingerprint);
}

// 3. Evidence collection: 3 distinct days
runWorkout({ date: '2026-10-02T10:00:00.000Z', finishDate: '2026-10-02T10:10:00.000Z', rounds: 10 });
runWorkout({ date: '2026-10-03T10:00:00.000Z', finishDate: '2026-10-03T10:10:00.000Z', rounds: 11 });
runWorkout({ date: '2026-10-04T10:00:00.000Z', finishDate: '2026-10-04T10:10:00.000Z', rounds: 12 });

// Coach readiness
currentTime = '2026-10-05T10:00:00.000Z';
const r = service.readiness();
const dec = service.deriveDecision({ decisionNow: currentTime });

const seedBundle = {
  cindyCfg: {
    version: 8,
    mode: cfg.mode,
    minutes: cfg.minutes,
    target: cfg.target,
    longGoal: 20,
    theme: 'light',
    colorTheme: 'copper',
    sound: true,
    hapticMode: 2,
    cueInterval: 0,
    cueTone: 'soft',
    composition: cfg.composition,
    proWorkout: null,
    paceGuidance: false,
    templates: [],
    programs: [],
    programState: { activeProgramId: '', currentDayIndex: 0, completedAt: null },
    pendingSource: null,
    profile: { name: 'Геннадий', age: 30, heightCm: 178, weightKg: 70, goal: '', avatarTone: 'copper', developmentView: true, trainingExperience: '', updatedAt: null },
    equipment: { pullupBar: true, resistanceBand: false, stableSupport: false, parallelBars: false, benchDipComfort: false },
    userRestrictions: null,
    excludedExerciseIds: [],
    coachExcludedVariantIds: [],
    experienceMode: 'simple',
    coachEnabledChoice: 'default',
    coachEnabled: true
  },
  cindyHistory: historyRecords,
  cindyCoachV3State: service.state(),
  readiness: r,
  decision: dec
};

fs.writeFileSync(path.join(__dirname, '../seed_data.json'), JSON.stringify(seedBundle, null, 2), 'utf8');
console.log('Seed bundle generated successfully!');
console.log('Readiness:', r.phase, 'ready:', r.ready, 'qualifyingTrainings:', r.qualifyingTrainings);
console.log('Decision:', dec.decisionMode, 'action:', dec.action);
