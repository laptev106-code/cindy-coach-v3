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

const comp = [
  { slotId: 'slot-1', exerciseId: 'pull', count: 5, order: 1 },
  { slotId: 'slot-2', exerciseId: 'push', count: 10, order: 2 },
  { slotId: 'slot-3', exerciseId: 'squat', count: 15, order: 3 }
];

const baselineRecord = {
  id: 'baseline-1',
  completedAt: '2026-10-01T10:00:00.000Z',
  rounds: 10,
  duration: 600,
  mode: 'time',
  plannedSeconds: 600,
  endedBy: 'time',
  valid: true,
  composition: comp,
  v3: {
    sessionPurpose: 'BASELINE',
    valid: true,
    historyMutation: false,
    executionFidelity: 'EXACT',
    plannedSpecSnapshot: {
      mode: 'time',
      formatPolicy: 'fixed',
      plannedSeconds: 600,
      target: 0,
      composition: comp,
      sessionType: 'BASELINE',
      ownership: 'COACH'
    }
  }
};

function testWithPurpose(purpose) {
  const storage = new Map();
  const ls = { getItem: k => storage.get(k) || null, setItem: (k,v) => storage.set(k, String(v)), removeItem: k => storage.delete(k), clear: () => storage.clear() };
  const stateStorage = window.CINDYLocalStorageV3.create({ storage: ls });
  const stateRepo = window.CINDYCoachStateRepositoryV3.create({ storagePort: stateStorage, key: 'cindyCoachV3State' });

  stateRepo.save({
    version: 1, ownership: 'COACH', baselineAuthority: false,
    baselineCompletedAt: '2026-10-01T10:00:00.000Z', baselineRecordId: 'baseline-1',
    baselineTestMinutes: 10, starterApplied: true, preparedSpec: null, preparedFingerprint: null,
    appliedConfigFingerprint: null, pendingIntervention: null
  });

  const makeRecord = (id, dateStr, rounds) => ({
    id, completedAt: dateStr, rounds, duration: 600, mode: 'time', plannedSeconds: 600,
    endedBy: 'time', valid: true, composition: comp,
    v3: {
      sessionPurpose: purpose, valid: true, historyMutation: false, executionFidelity: 'EXACT',
      semanticSnapshotStatus: 'FROZEN_AT_START', semanticSnapshotVersion: 'cindy-semantic-history-snapshot-v1',
      semanticSnapshotHash: 'a'.repeat(64), snapshotCapturedAt: dateStr, profileVersion: 'p1', profileEffectiveFrom: dateStr,
      decisionNow: dateStr, decisionTimezone: 'UTC', exerciseMatrixVersion: 'cindy-matrix-v3', compatibilityVersion: 'cindy-compat-v3',
      measurementContractVersion: 'cindy-measurement-v3.0', profileSnapshot: { weightKg: 70 },
      configSnapshot: { mode: 'time', minutes: 10, target: 0, composition: comp, equipment: { pullupBar: true } },
      constraintSnapshot: { minExercises: 3, maxExercises: 4, maxDurationSeconds: 1800 },
      provenance: { releaseManifest: { specVersion: '3.0.0', coreVersion: core.CORE_VERSION, buildHash: 'ef69c3217fb2b123cfc631483f3bc331df145a7eed5e9feeb1ec3c9734c49a04', sourceHash: '024608c9a30091d1d85105fea25dc28444f8b171fce890d313924b07f0a6f046' } },
      plannedSpecSnapshot: { mode: 'time', formatPolicy: 'fixed', plannedSeconds: 600, target: 0, composition: comp, sessionType: purpose, ownership: 'COACH' }
    }
  });

  const history = [
    baselineRecord,
    makeRecord('d1', '2026-10-02T10:00:00.000Z', 10),
    makeRecord('d2', '2026-10-03T10:00:00.000Z', 11),
    makeRecord('d3', '2026-10-04T10:00:00.000Z', 12)
  ];

  let cfg = { mode: 'time', minutes: 10, target: 0, composition: comp, coachEnabled: true, equipment: { pullupBar: true } };

  const service = window.CINDYCoachApplicationServiceV3.create({
    core, stateRepository: stateRepo,
    configPort: {
      relevantSnapshot: () => ({ ...cfg, ownership: 'COACH', sessionType: 'STANDARD' }),
      currentConfig: () => cfg, currentMode: () => 'time', maxExercises: () => 4,
      equipment: () => ({ pullupBar: true }), restrictions: () => ({}), excludedExerciseIds: () => [],
      profileSnapshot: () => ({}), applyCoachPatch: p => { Object.assign(cfg, p); return true; }
    },
    sessionPort: { get: () => ({ status: 'idle' }), replace: () => {}, save: () => true, restore: () => true, isRunning: () => false },
    historyPort: { records: () => history },
    contextPort: { currentCoachContext: () => ({}), profileSnapshot: () => ({}), formatPolicy: () => 'fixed', programContext: () => null },
    matrixPort: { get: () => window.CINDYExerciseCatalogV3.CINDY_FINAL_COACH_MATRIX },
    externalContextPort: { get: () => null },
    activityPort: { isRunning: () => false, isPaused: () => false },
    clockPort: { now: () => '2026-10-05T10:00:00.000Z', timezone: () => 'UTC' },
    renderPort: { refresh: () => {} },
    baselineAuthorityPort: { isAuthorized: () => false, clear: () => true },
    workoutHistoryService: window.CINDYWorkoutHistoryServiceV3.create({ sessionContract: window.CINDYSessionContractV3, provenance: window.CINDYHistoryProvenanceV3 }),
    enabledPort: () => true,
    integrityPort: { sha256: () => 'hash', canonicalJson: JSON.stringify },
    releaseManifest: {
      specVersion: '3.0.0', coreVersion: core.CORE_VERSION,
      buildHash: 'ef69c3217fb2b123cfc631483f3bc331df145a7eed5e9feeb1ec3c9734c49a04',
      sourceHash: '024608c9a30091d1d85105fea25dc28444f8b171fce890d313924b07f0a6f046',
      fixtureCorpusVersion: 'v3.0.0-100', exerciseMatrixVersion: 'cindy-matrix-v3', compatibilityVersion: 'cindy-compat-v3',
      releaseCandidateId: 'test', integrityVersion: 'CINDY_RELEASE_HASH_V1',
      releaseSourceHash: '83ea6829ca6bd899d2f098bb3e6203113989e3123d90a2bb3a42a23d658fd7cd',
      releaseBuildHash: 'c1cb7411af2c96d436c3742adad2667c1c9ccd6e227e0b2cff34c37f7ae87285'
    }
  });

  const rd = service.readiness();
  const der = service.deriveDecision({ decisionNow: '2026-10-05T10:00:00.000Z' });
  console.log('Purpose ' + purpose + ':');
  console.log('  phase:', rd.phase);
  console.log('  qualifyingTrainings:', rd.qualifyingTrainings);
  console.log('  qualifyingDays:', rd.qualifyingDays);
  console.log('  ready:', rd.ready);
  console.log('  decisionMode:', der.decisionMode);
  console.log('  action:', der.action);
}

testWithPurpose('REPEAT');
testWithPurpose('STANDARD');
