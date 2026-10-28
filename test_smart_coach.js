global.window = global;
global.self = global;
const assert = require('assert');
const core = require('./coach_core_v3/coach_core_v3.js');
require('./src/domain/exercises/exercise_catalog_v3.js');
require('./src/infrastructure/storage/local_storage_v3.js');
require('./src/infrastructure/storage/coach_state_repository_v3.js');
require('./src/infrastructure/storage/coach_state_migration_v3.js');
require('./src/domain/workout/session_contract_v3.js');
require('./src/domain/history/history_provenance_v3.js');
require('./src/application/workout/workout_history_service_v3.js');
require('./src/application/coach/coach_application_service_v3.js');

const serviceFactory = window.CINDYCoachApplicationServiceV3;
const repoFactory = window.CINDYCoachStateRepositoryV3;
const storageFactory = window.CINDYLocalStorageV3;
const sessionContract = window.CINDYSessionContractV3;
const provenance = window.CINDYHistoryProvenanceV3;
const workoutHistory = window.CINDYWorkoutHistoryServiceV3;

function createTestHarness(profileOpts = {}) {
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
    equipment: { pullupBar: true, ...(profileOpts.equipment || {}) },
    userRestrictions: {},
    excludedExerciseIds: [],
    profile: {
      age: profileOpts.age || 30,
      weightKg: profileOpts.weightKg || 75
    }
  };

  let historyRecords = [];
  let currentSession = { status: 'idle', rounds: 0, composition: cfg.composition };
  let currentTime = '2026-10-22T10:00:00.000Z';

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

  let svc;
  svc = serviceFactory.create({
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
      profileSnapshot: () => cfg.profile,
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
      profileSnapshot: () => cfg.profile,
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
      isAuthorized: () => Boolean(svc && svc.state && svc.state().baselineAuthority),
      clear: () => Boolean(svc && svc.clearBaselineAuthority && svc.clearBaselineAuthority())
    },
    workoutHistoryService: workoutHistory.create({ sessionContract, provenance }),
    enabledPort: () => true,
    integrityPort: { sha256: x => require('crypto').createHash('sha256').update(String(x)).digest('hex'), canonicalJson: JSON.stringify },
    releaseManifest
  });

  return {
    svc,
    getConfig: () => cfg,
    setConfig: c => Object.assign(cfg, c),
    setTime: t => { currentTime = t; },
    getTime: () => currentTime,
    getCurrentSession: () => currentSession,
    setCurrentSession: s => { currentSession = s; },
    getHistory: () => historyRecords,
    addHistoryRecord: r => historyRecords.unshift(r)
  };
}

console.log('=====================================================');
console.log('  CINDY SMART COACH INTEGRATION & ROTATION TEST');
console.log('=====================================================');

// 1. BASELINE TEST & IMMEDIATE RECOMMENDATION
console.log('\n[TEST 1] Baseline Test & Immediate Post-Test Derivation');
const harness1 = createTestHarness({ age: 30, weightKg: 75 });
const svc1 = harness1.svc;

assert.strictEqual(svc1.requestBaseline(10), true);
let prep = svc1.prepareForStart({ decisionNow: harness1.getTime() });
harness1.setCurrentSession({ ...prep.sessionRuntime, status: 'running', startedAt: Date.parse(harness1.getTime()) });
svc1.commitStart({ frozenSpec: prep.frozenSpec, baselineAuthorizedAtStart: prep.baselineAuthorizedAtStart, isBaseline: true });

const baselineRecord = svc1.handleRecord({
  raw: {
    id: 'base-1',
    completedAt: '2026-10-22T10:10:00.000Z',
    rounds: 10,
    duration: 600,
    mode: 'time',
    plannedSeconds: 600,
    target: 0,
    endedBy: 'time',
    composition: harness1.getConfig().composition,
    laps: Array.from({ length: 10 }, (_, i) => ({ n: i + 1, duration: 60, total: (i + 1) * 60 }))
  },
  end: 'time'
});
harness1.addHistoryRecord(baselineRecord);
svc1.reconcileAfterFinish(baselineRecord);
harness1.setCurrentSession({ status: 'idle', rounds: 0, composition: harness1.getConfig().composition });

const rd1 = svc1.readiness();
console.log('Readiness after baseline:', rd1.phase, '(baselineCompleted =', rd1.baselineCompleted, ')');
assert.strictEqual(rd1.baselineCompleted, true, 'Baseline must be recorded');

harness1.setTime('2026-10-22T10:15:00.000Z');
const postBaselineDerive = svc1.deriveDecision({ decisionNow: harness1.getTime() });
console.log('Post-baseline decision mode:', postBaselineDerive.decisionMode, 'action:', postBaselineDerive.action ? postBaselineDerive.action.type : 'none');
assert.strictEqual(postBaselineDerive.decisionMode, 'ADAPT');
assert.strictEqual(postBaselineDerive.application.allowed, true);

const applyRes = svc1.apply();
assert.strictEqual(applyRes.ok, true, 'Immediate post-baseline recommendation must apply cleanly');
console.log('✓ TEST 1 PASS: Coach immediately provides actionable workout after baseline!');

// 2. BIOMECHANICAL ROTATION ON SESSION 1 & SESSION 2
console.log('\n[TEST 2] Biomechanical Rotation Across Daily Sessions');
// Execute Day 1 workout with pronated pull, classic push, classic squat
harness1.setTime('2026-10-23T10:00:00.000Z');
prep = svc1.prepareForStart({ decisionNow: harness1.getTime() });
harness1.setCurrentSession({ ...prep.sessionRuntime, status: 'running', startedAt: Date.parse(harness1.getTime()) });
svc1.commitStart({ frozenSpec: prep.frozenSpec, baselineAuthorizedAtStart: prep.baselineAuthorizedAtStart, isBaseline: false });

const day1Record = svc1.handleRecord({
  raw: {
    id: 'day1-rec',
    completedAt: '2026-10-23T10:10:00.000Z',
    rounds: 11,
    duration: 600,
    mode: 'time',
    plannedSeconds: 600,
    target: 0,
    endedBy: 'time',
    composition: [
      { slotId: 'slot-1', exerciseId: 'pull', variantId: 'pull_pronated', count: 5, order: 1 },
      { slotId: 'slot-2', exerciseId: 'push', variantId: 'push_classic', count: 10, order: 2 },
      { slotId: 'slot-3', exerciseId: 'squat', variantId: 'squat_classic', count: 15, order: 3 }
    ],
    laps: Array.from({ length: 11 }, (_, i) => ({ n: i + 1, duration: 54, total: (i + 1) * 54 }))
  },
  end: 'time'
});
harness1.addHistoryRecord(day1Record);
svc1.reconcileAfterFinish(day1Record);
harness1.setCurrentSession({ status: 'idle', rounds: 0, composition: harness1.getConfig().composition });

// Request coach decision for Day 2
harness1.setTime('2026-10-24T10:00:00.000Z');
const day2Derive = svc1.deriveDecision({ decisionNow: harness1.getTime() });
console.log('Day 2 Derivation Mode:', day2Derive.decisionMode);
console.log('Day 2 Action Type:', day2Derive.action ? day2Derive.action.type : 'none');
console.log('Coach Explanation:', day2Derive.intervention?.summary || day2Derive.workoutSpec?.explanation?.why);

const day2Comp = day2Derive.workoutSpec?.composition || [];
const pullSlot = day2Comp.find(x => x.exerciseId === 'pull');
const pushSlot = day2Comp.find(x => x.exerciseId === 'push');
const squatSlot = day2Comp.find(x => x.exerciseId === 'squat');

console.log(`Day 2 Rotated Composition:
  - Pull: ${pullSlot?.variantId} (${pullSlot?.count} reps)
  - Push: ${pushSlot?.variantId} (${pushSlot?.count} reps)
  - Squat: ${squatSlot?.variantId} (${squatSlot?.count} reps)`);

assert.strictEqual(pullSlot?.variantId, 'pull_supinated', 'Pull should rotate to supinated (chin-up)');
assert.strictEqual(pushSlot?.variantId, 'push_narrow', 'Push should rotate to narrow (triceps/delts focus)');
assert.strictEqual(squatSlot?.variantId, 'squat_reverse_lunge', 'Squat should rotate to reverse lunge');
assert.strictEqual(day2Derive.application.allowed, true);

const day2Applied = svc1.apply();
assert.strictEqual(day2Applied.ok, true, 'Day 2 rotation applies cleanly');
console.log('✓ TEST 2 PASS: Biomechanical rotation successfully executed (Pronated -> Supinated / Narrow / Lunge)!');

// 3. WEIGHT SCALING FOR HEAVY ATHLETE (95 KG)
console.log('\n[TEST 3] Heavy Bodyweight Scaling (>80 kg)');
const harnessHeavy = createTestHarness({ age: 28, weightKg: 95 });
const svcHeavy = harnessHeavy.svc;
svcHeavy.requestBaseline(10);
let prepH = svcHeavy.prepareForStart({ decisionNow: harnessHeavy.getTime() });
svcHeavy.commitStart({ frozenSpec: prepH.frozenSpec, baselineAuthorizedAtStart: prepH.baselineAuthorizedAtStart, isBaseline: true });
const heavyBase = svcHeavy.handleRecord({
  raw: {
    id: 'heavy-base',
    completedAt: '2026-10-22T10:10:00.000Z',
    rounds: 8,
    duration: 600,
    mode: 'time',
    plannedSeconds: 600,
    target: 0,
    endedBy: 'time',
    composition: harnessHeavy.getConfig().composition,
    laps: Array.from({ length: 8 }, (_, i) => ({ n: i + 1, duration: 75, total: (i + 1) * 75 }))
  },
  end: 'time'
});
harnessHeavy.addHistoryRecord(heavyBase);
svcHeavy.reconcileAfterFinish(heavyBase);
svcHeavy.apply();

// Day 1 completed for heavy athlete
harnessHeavy.setTime('2026-10-23T10:00:00.000Z');
prepH = svcHeavy.prepareForStart({ decisionNow: harnessHeavy.getTime() });
svcHeavy.commitStart({ frozenSpec: prepH.frozenSpec, baselineAuthorizedAtStart: prepH.baselineAuthorizedAtStart, isBaseline: false });
const heavyDay1 = svcHeavy.handleRecord({
  raw: {
    id: 'heavy-day1',
    completedAt: '2026-10-23T10:10:00.000Z',
    rounds: 8,
    duration: 600,
    mode: 'time',
    plannedSeconds: 600,
    target: 0,
    endedBy: 'time',
    composition: harnessHeavy.getConfig().composition,
    laps: Array.from({ length: 8 }, (_, i) => ({ n: i + 1, duration: 75, total: (i + 1) * 75 }))
  },
  end: 'time'
});
harnessHeavy.addHistoryRecord(heavyDay1);
svcHeavy.reconcileAfterFinish(heavyDay1);

harnessHeavy.setTime('2026-10-24T10:00:00.000Z');
const heavyDerive = svcHeavy.deriveDecision({ decisionNow: harnessHeavy.getTime() });
const heavyPullSlot = heavyDerive.workoutSpec?.composition.find(x => x.exerciseId === 'pull');
console.log(`95kg athlete pull-up reps: ${heavyPullSlot?.count} (standard was 5)`);
assert(heavyPullSlot?.count < 5, 'Heavy athlete pull-up reps should be scaled down to protect tendons');
console.log('✓ TEST 3 PASS: Weight scaling correctly reduces pull-up reps for 95kg athlete!');

// 4. AGE GUARD (AGE >= 45)
console.log('\n[TEST 4] Age Guard Protection (Age >= 45)');
const harnessOlder = createTestHarness({ age: 52, weightKg: 75, equipment: { parallelBars: true, pullupBar: true } });
const svcOlder = harnessOlder.svc;
svcOlder.requestBaseline(10);
let prepO = svcOlder.prepareForStart({ decisionNow: harnessOlder.getTime() });
svcOlder.commitStart({ frozenSpec: prepO.frozenSpec, baselineAuthorizedAtStart: prepO.baselineAuthorizedAtStart, isBaseline: true });
const olderBase = svcOlder.handleRecord({
  raw: {
    id: 'older-base',
    completedAt: '2026-10-22T10:10:00.000Z',
    rounds: 7,
    duration: 600,
    mode: 'time',
    plannedSeconds: 600,
    target: 0,
    endedBy: 'time',
    composition: harnessOlder.getConfig().composition,
    laps: Array.from({ length: 7 }, (_, i) => ({ n: i + 1, duration: 85, total: (i + 1) * 85 }))
  },
  end: 'time'
});
harnessOlder.addHistoryRecord(olderBase);
svcOlder.reconcileAfterFinish(olderBase);
svcOlder.apply();

// Complete Day 1
harnessOlder.setTime('2026-10-23T10:00:00.000Z');
prepO = svcOlder.prepareForStart({ decisionNow: harnessOlder.getTime() });
svcOlder.commitStart({ frozenSpec: prepO.frozenSpec, baselineAuthorizedAtStart: prepO.baselineAuthorizedAtStart, isBaseline: false });
const olderDay1 = svcOlder.handleRecord({
  raw: {
    id: 'older-day1',
    completedAt: '2026-10-23T10:10:00.000Z',
    rounds: 8,
    duration: 600,
    mode: 'time',
    plannedSeconds: 600,
    target: 0,
    endedBy: 'time',
    composition: harnessOlder.getConfig().composition,
    laps: Array.from({ length: 8 }, (_, i) => ({ n: i + 1, duration: 75, total: (i + 1) * 75 }))
  },
  end: 'time'
});
harnessOlder.addHistoryRecord(olderDay1);
svcOlder.reconcileAfterFinish(olderDay1);

harnessOlder.setTime('2026-10-24T10:00:00.000Z');
const olderDerive = svcOlder.deriveDecision({ decisionNow: harnessOlder.getTime() });
const olderPushVariants = olderDerive.workoutSpec?.composition.map(x => x.variantId);
console.log('52yo athlete suggested variants:', olderPushVariants);
assert(!olderPushVariants.some(v => v && v.includes('bench_dip')), 'Bench dips must NEVER be offered to 45+ athlete');
console.log('✓ TEST 4 PASS: Shoulder injury risk safely avoided for older athlete!');

// 5. SESSION 3 ROTATION (Neutral Pull, Decline Push, Pause Squat)
console.log('\n[TEST 5] Multi-Cycle Rotation: Supinated -> Neutral / Decline / Pause Squat');
// Execute Day 2 workout with pull_supinated, push_narrow, squat_reverse_lunge
harness1.setTime('2026-10-24T10:00:00.000Z');
prep = svc1.prepareForStart({ decisionNow: harness1.getTime() });
harness1.setCurrentSession({ ...prep.sessionRuntime, status: 'running', startedAt: Date.parse(harness1.getTime()) });
svc1.commitStart({ frozenSpec: prep.frozenSpec, baselineAuthorizedAtStart: prep.baselineAuthorizedAtStart, isBaseline: false });

const day2Record = svc1.handleRecord({
  raw: {
    id: 'day2-rec',
    completedAt: '2026-10-24T10:10:00.000Z',
    rounds: 11,
    duration: 600,
    mode: 'time',
    plannedSeconds: 600,
    target: 0,
    endedBy: 'time',
    composition: harness1.getConfig().composition,
    laps: Array.from({ length: 11 }, (_, i) => ({ n: i + 1, duration: 54, total: (i + 1) * 54 }))
  },
  end: 'time'
});
harness1.addHistoryRecord(day2Record);
svc1.reconcileAfterFinish(day2Record);
harness1.setCurrentSession({ status: 'idle', rounds: 0, composition: harness1.getConfig().composition });

// Request Day 3 decision
harness1.setTime('2026-10-25T10:00:00.000Z');
const day3Derive = svc1.deriveDecision({ decisionNow: harness1.getTime() });
const day3Comp = day3Derive.workoutSpec?.composition || [];
const pullSlot3 = day3Comp.find(x => x.exerciseId === 'pull');
const pushSlot3 = day3Comp.find(x => x.exerciseId === 'push');
const squatSlot3 = day3Comp.find(x => x.exerciseId === 'squat');

console.log(`Day 3 Rotated Composition:
  - Pull: ${pullSlot3?.variantId} (${pullSlot3?.count} reps)
  - Push: ${pushSlot3?.variantId} (${pushSlot3?.count} reps)
  - Squat: ${squatSlot3?.variantId} (${squatSlot3?.count} reps)`);

assert.strictEqual(pullSlot3?.variantId, 'pull_neutral', 'Pull should rotate to neutral grip');
assert.strictEqual(pushSlot3?.variantId, 'push_decline', 'Push should rotate to decline push-up');
assert.strictEqual(squatSlot3?.variantId, 'squat_pause', 'Squat should rotate to pause squat');
console.log('✓ TEST 5 PASS: Multi-Cycle Rotation advances smoothly to neutral grip, decline push and pause squat!');

console.log('\n=====================================================');
console.log('  ALL CINDY SMART COACH TESTS PASSED 100%! ');
console.log('=====================================================');
