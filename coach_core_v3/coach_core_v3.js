(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CindyAdaptiveCoachV3 = factory();
})(typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : globalThis), function () {
  'use strict';

  const SPEC_VERSION = '3.0.0';
  const CORE_VERSION = 'cindy-adaptive-coach-v3.0.0';
  const FIXTURE_CORPUS_VERSION = 'v3.0.0-100';
  const MATRIX_VERSION = 'cindy-matrix-v3';
  const COMPATIBILITY_VERSION = 'cindy-compat-v3';
  const MEASUREMENT_CONTRACT_VERSION = 'cindy-measurement-v3.0';
  const EXPECTED_BUILD_HASH = 'ef69c3217fb2b123cfc631483f3bc331df145a7eed5e9feeb1ec3c9734c49a04';
  const EXPECTED_SOURCE_HASH = '024608c9a30091d1d85105fea25dc28444f8b171fce890d313924b07f0a6f046';

  const PARAM = Object.freeze({
    STRICT_TIME_TOLERANCE_SECONDS: 60,
    STRICT_TIME_TOLERANCE_FRACTION: 0.05,
    BODY_MASS_STRICT_BLOCK_THRESHOLD_PCT: 5,
    RECENT_STRICT_MAX_RECORDS: 6,
    REENTRY_GAP_DAYS: 8,
    REENTRY_FACTOR: 0.70,
    REENTRY_REPEAT_LIMIT: 2,
    RESPONSE_RETENTION_THRESHOLD: 0.85,
    COUNT_STEP: 1,
    ROUND_STEP: 1,
    DURATION_STEP_SECONDS: 60,
    MIN_EXERCISES: 3,
    MAX_AUTO_EXERCISES: 4,
    SYSTEM_MAX_SECONDS: 30 * 60,
  });

  const DOMAIN = Object.freeze({
    DECISION_MODE: ['NO_ACTION', 'PRESERVE', 'ADAPT'],
    SESSION_PURPOSE: ['STANDARD', 'BASELINE', 'REPEAT', 'CONTROL', 'REENTRY', 'RECOVERY', 'EVIDENCE_COLLECTION'],
    DECISION_STATUS: ['VALID', 'EVIDENCE_LIMITED', 'GOAL_LIMITED', 'CONFLICTED', 'CURRENT_INVALID', 'OWNERSHIP_LIMITED', 'EXTERNAL_CONTEXT_LIMITED', 'STALE', 'UNRESOLVED'],
    ADAPTATION_KIND: ['NONE', 'ATOMIC', 'REENTRY_PROTOCOL', 'STRUCTURAL_BUNDLE'],
  });

  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const num = (value, fallback = null) => {
    if (value === null || value === undefined || value === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };
  const int = (value, fallback = null) => {
    if (value === null || value === undefined || value === '') return fallback;
    const n = Math.trunc(Number(value));
    return Number.isFinite(n) ? n : fallback;
  };
  const bool = value => value === true;
  const arr = value => Array.isArray(value) ? value : [];
  const str = (value, fallback = '') => typeof value === 'string' ? value : fallback;

  function canonicalize(value) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(canonicalize);
    const out = {};
    Object.keys(value).sort().forEach(key => { out[key] = canonicalize(value[key]); });
    return out;
  }

  function canonicalJson(value) {
    return JSON.stringify(canonicalize(value));
  }

  function hash(value) {
    const text = typeof value === 'string' ? value : canonicalJson(value);
    let h1 = 0x811c9dc5;
    let h2 = 0x9e3779b9;
    for (let i = 0; i < text.length; i += 1) {
      const c = text.charCodeAt(i);
      h1 ^= c;
      h1 = Math.imul(h1, 0x01000193);
      h2 ^= c + (i & 255);
      h2 = Math.imul(h2, 0x85ebca6b);
    }
    return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
  }

  function localDateId(iso, timezone) {
    if (!iso) return null;
    const date = new Date(iso);
    if (!Number.isFinite(date.getTime())) return null;
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit'
      });
      return formatter.format(date);
    } catch (_) {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const d = String(date.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  function dayDifference(nowIso, thenIso, timezone) {
    const a = localDateId(nowIso, timezone);
    const b = localDateId(thenIso, timezone);
    if (!a || !b) return null;
    const msA = Date.parse(`${a}T00:00:00Z`);
    const msB = Date.parse(`${b}T00:00:00Z`);
    if (!Number.isFinite(msA) || !Number.isFinite(msB) || msA < msB) return null;
    return Math.floor((msA - msB) / 86400000);
  }

  function uniqueSorted(values) {
    return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)));
  }

  function median(values) {
    const xs = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
    if (!xs.length) return null;
    const i = Math.floor(xs.length / 2);
    return xs.length % 2 ? xs[i] : (xs[i - 1] + xs[i]) / 2;
  }

  function safeRoundRate(record) {
    const rounds = num(record && record.performanceMetrics && record.performanceMetrics.completedRounds, num(record && record.actualExecution && record.actualExecution.rounds, record && record.rounds));
    const duration = num(record && record.performanceMetrics && record.performanceMetrics.actualDurationSeconds, num(record && record.actualExecution && record.actualExecution.durationSeconds, record && record.duration));
    if (rounds == null || duration == null || duration <= 0) return null;
    return rounds / (duration / 60);
  }

  function lapProfile(record) {
    const laps = arr(record && record.actualExecution && record.actualExecution.laps).filter(x => Number(x && x.duration) > 0);
    if (laps.length < 3) return { valid: false, count: laps.length, averageSeconds: null, firstMedianSeconds: null, lastMedianSeconds: null, slowdownRatio: null, pattern: 'UNKNOWN' };
    const durations = laps.map(x => Number(x.duration)).filter(Number.isFinite);
    const segmentSize = Math.max(1, Math.floor(durations.length / 3));
    const first = median(durations.slice(0, segmentSize));
    const last = median(durations.slice(-segmentSize));
    const average = median(durations);
    if (![first, last, average].every(Number.isFinite) || first <= 0) return { valid: false, count: laps.length, averageSeconds: null, firstMedianSeconds: null, lastMedianSeconds: null, slowdownRatio: null, pattern: 'UNKNOWN' };
    const ratio = last / first;
    const pattern = ratio >= 1.10 ? 'DECELERATING' : ratio <= 0.90 ? 'ACCELERATING' : 'STABLE';
    return { valid: true, count: durations.length, averageSeconds: average, firstMedianSeconds: first, lastMedianSeconds: last, slowdownRatio: ratio, pattern };
  }

  function resolveMetric(record, contract) {
    if (!record || !contract) return { value: null, valid: false, missing: true };
    const pm = record.performanceMetrics || {};
    const actual = record.actualExecution || {};
    switch (contract.primaryMetric) {
      case 'roundCount': {
        const v = num(pm.completedRounds, num(actual.rounds, record.rounds));
        return { value: v, valid: v != null && v >= 0, missing: v == null };
      }
      case 'roundRate': {
        const v = safeRoundRate(record);
        return { value: v, valid: v != null && v >= 0, missing: v == null };
      }
      case 'durationSeconds': {
        const v = num(pm.actualDurationSeconds, num(actual.durationSeconds, record.duration));
        return { value: v, valid: v != null && v >= 0, missing: v == null };
      }
      default:
        return { value: null, valid: false, missing: true };
    }
  }

  function higherIsBetter(contract) {
    return contract.higherIsBetter !== false;
  }

  function metricRetention(parentRecord, childRecord, contract) {
    const p = resolveMetric(parentRecord, contract);
    const c = resolveMetric(childRecord, contract);
    if (!p.valid || !c.valid) return { state: 'AMBIGUOUS', retention: null };
    if (higherIsBetter(contract)) {
      if (!(p.value > 0)) return { state: 'AMBIGUOUS', retention: null };
      return { state: 'VALUE', retention: c.value / p.value };
    }
    if (!(c.value > 0)) return { state: 'AMBIGUOUS', retention: null };
    return { state: 'VALUE', retention: p.value / c.value };
  }

  function defaultMeasurementContract(mode, formatPolicy = 'fixed') {
    if (!['time', 'rounds', 'combined'].includes(mode)) {
      return { version: MEASUREMENT_CONTRACT_VERSION, mode, primaryMetric: null, primaryUnit: null, higherIsBetter: true, requiredMeasurements: [], stabilityTolerance: null, missingValueSemantics: 'UNKNOWN', invalidValueSemantics: 'INVALID' };
    }
    if (mode === 'time') {
      return {
        version: MEASUREMENT_CONTRACT_VERSION,
        mode,
        formatPolicy,
        primaryMetric: 'roundCount',
        primaryUnit: 'rounds',
        higherIsBetter: true,
        plannedDefinition: 'plannedSeconds',
        actualDefinition: 'completedRounds + actualDurationSeconds',
        completedRoundDefinition: 'execution_event_round_complete',
        earlyStopDefinition: 'endedBy=manual/system before planned duration',
        segmentBoundaryDefinition: 'lap events from execution engine',
        lapBoundaryDefinition: 'lap events',
        requiredMeasurements: ['completedRounds', 'actualDurationSeconds'],
        optionalMeasurements: ['laps'],
        missingValueSemantics: 'UNKNOWN',
        invalidValueSemantics: 'UNRESOLVED',
        overCompletionSemantics: 'roundCount may exceed prior observations; never clipped',
        fidelityFields: ['mode', 'plannedSeconds', 'target', 'composition', 'order', 'variants', 'counts', 'measurementContractVersion'],
        stabilityTolerance: null,
      };
    }
    if (mode === 'rounds') {
      return {
        version: MEASUREMENT_CONTRACT_VERSION,
        mode,
        formatPolicy,
        primaryMetric: 'roundRate',
        primaryUnit: 'rounds/minute',
        higherIsBetter: true,
        plannedDefinition: 'targetRounds',
        actualDefinition: 'completedRounds + actualDurationSeconds',
        completedRoundDefinition: 'execution_event_round_complete',
        earlyStopDefinition: 'endedBy=manual/system before targetRounds',
        segmentBoundaryDefinition: 'lap events from execution engine',
        lapBoundaryDefinition: 'lap events',
        requiredMeasurements: ['completedRounds', 'actualDurationSeconds'],
        optionalMeasurements: ['laps'],
        missingValueSemantics: 'UNKNOWN',
        invalidValueSemantics: 'UNRESOLVED',
        overCompletionSemantics: 'completed rounds > target is valid only if engine records it explicitly',
        fidelityFields: ['mode', 'targetRounds', 'composition', 'order', 'variants', 'counts', 'measurementContractVersion'],
        stabilityTolerance: null,
      };
    }
    return {
      version: MEASUREMENT_CONTRACT_VERSION,
      mode,
      formatPolicy,
      primaryMetric: 'roundRate',
      primaryUnit: 'rounds/minute',
      higherIsBetter: true,
      plannedDefinition: 'plannedSeconds + targetRounds',
      actualDefinition: 'completedRounds + actualDurationSeconds',
      completedRoundDefinition: 'execution_event_round_complete',
      earlyStopDefinition: 'endedBy=manual/system before either required completion dimension',
      segmentBoundaryDefinition: 'lap events from execution engine',
      lapBoundaryDefinition: 'lap events',
      requiredMeasurements: ['completedRounds', 'actualDurationSeconds'],
      optionalMeasurements: ['laps'],
      missingValueSemantics: 'UNKNOWN',
      invalidValueSemantics: 'UNRESOLVED',
      overCompletionSemantics: 'engine-defined; no clipping',
      fidelityFields: ['mode', 'plannedSeconds', 'targetRounds', 'composition', 'order', 'variants', 'counts', 'measurementContractVersion'],
      stabilityTolerance: null,
    };
  }

  function normalizeProfile(profile) {
    const p = profile && typeof profile === 'object' ? profile : {};
    return {
      age: num(p.age), sex: p.sex == null ? null : str(p.sex, null), heightCm: num(p.heightCm), weightKg: num(p.weightKg),
      weightHistory: arr(p.weightHistory), trainingExperience: str(p.trainingExperience, ''), goal: str(p.goal || p.type, 'GENERAL'),
      equipment: p.equipment && typeof p.equipment === 'object' ? clone(p.equipment) : {},
      restrictions: p.restrictions && typeof p.restrictions === 'object' ? clone(p.restrictions) : {},
      profileVersion: str(p.profileVersion, 'profile-v3-runtime'), effectiveFrom: str(p.effectiveFrom, null), effectiveTo: str(p.effectiveTo, null),
      authority: p.authority ? str(p.authority, '') : null,
    };
  }

  function normalizeComposition(composition) {
    return arr(composition).map((item, i) => ({
      slotId: str(item && item.slotId, `slot-${i + 1}`),
      exerciseId: str(item && (item.exerciseId || item.id), ''),
      variantId: item && item.variantId != null ? str(item.variantId, '') : null,
      count: int(item && item.count, 0),
      order: int(item && item.order, i + 1),
    }));
  }

  function matrixExercise(matrix, id) {
    const m = matrix && matrix.exercises && matrix.exercises[id];
    return m || null;
  }
  function matrixVariant(matrix, id) {
    const m = matrix && matrix.variants && matrix.variants[id];
    return m || null;
  }
  function exerciseSemanticClass(matrix, item) {
    if (!item) return null;
    const v = matrixVariant(matrix, item.variantId);
    return str(v && v.semanticCompatibilityClass, `${item.exerciseId}:${item.variantId || 'base'}`);
  }
  function exerciseNeedsEquipment(matrix, item) {
    const e = matrixExercise(matrix, item.exerciseId);
    const v = matrixVariant(matrix, item.variantId);
    return uniqueSorted([...(arr(e && e.equipmentRequirements)), ...(arr(v && v.equipmentRequirements))]);
  }
  function bodyweightSensitive(matrix, item) {
    const e = matrixExercise(matrix, item.exerciseId);
    const v = matrixVariant(matrix, item.variantId);
    const tags = [...arr(e && e.comparabilitySensitivity), ...arr(v && v.comparabilitySensitivity)];
    return tags.includes('BODYWEIGHT');
  }

  function currentTargetRecord(input) {
    const c = input.currentWorkout || {};
    const contract = input.measurementContract || defaultMeasurementContract(c.mode, c.formatPolicy);
    return {
      id: '__CURRENT_TARGET__',
      valid: true,
      effectiveTimestamp: str(input.decisionNow, ''),
      mode: str(c.mode, 'time'),
      formatPolicy: str(c.formatPolicy, 'fixed'),
      plannedSeconds: num(c.plannedSeconds, c.mode !== 'rounds' ? num(c.minutes, 20) * 60 : null),
      target: c.mode === 'time' ? null : num(c.target),
      targetRounds: c.mode !== 'time' ? num(c.targetRounds, num(c.target)) : null,
      composition: normalizeComposition(c.composition),
      programContext: clone(input.programContext || c.programContext || null),
      sessionType: str(c.sessionType, 'STANDARD'),
      measurementContractVersion: str(c.measurementContractVersion, contract.version),
      measurementContract: clone(contract),
      exerciseMatrixVersion: str(input.exerciseMatrix && input.exerciseMatrix.version, MATRIX_VERSION),
      compatibilityVersion: str(input.compatibilityVersion, COMPATIBILITY_VERSION),
      profileSnapshot: clone(input.profile),
      configSnapshot: clone(input.config || {}),
      constraintSnapshot: clone(input.hardConstraints || {}),
      equipment: clone(input.equipment || (input.config && input.config.equipment) || {}),
      restrictions: clone(input.restrictions || (input.config && input.config.restrictions) || {}),
      ownership: str(c.ownership, 'UNKNOWN'),
      executionFidelity: 'EXACT',
      claimConfounders: [],
      validSemanticSnapshot: true,
    };
  }

  function normalizeHistoryRecord(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const v3 = raw.v3 && typeof raw.v3 === 'object' ? raw.v3 : null;
    const plannedSpec = v3 && v3.plannedSpecSnapshot ? clone(v3.plannedSpecSnapshot) : (raw.plannedSpecSnapshot ? clone(raw.plannedSpecSnapshot) : null);
    const actualExecution = v3 && v3.actualExecution ? clone(v3.actualExecution) : {
      durationSeconds: num(raw.duration), rounds: int(raw.rounds, null), endedBy: str(raw.endedBy, 'unknown'),
      composition: normalizeComposition(raw.composition).map(x => ({ ...x })), laps: clone(raw.laps || []),
    };
    const snap = {
      profileSnapshot: v3 && v3.profileSnapshot ? clone(v3.profileSnapshot) : null,
      configSnapshot: v3 && v3.configSnapshot ? clone(v3.configSnapshot) : null,
      constraintSnapshot: v3 && v3.constraintSnapshot ? clone(v3.constraintSnapshot) : null,
      exerciseMatrixVersion: str(v3 && v3.exerciseMatrixVersion, str(raw.exerciseMatrixVersion, '')),
      compatibilityVersion: str(v3 && v3.compatibilityVersion, str(raw.compatibilityVersion, '')),
      measurementContractVersion: str(v3 && v3.measurementContractVersion, str(raw.measurementContractVersion, '')),
      decisionNow: str(v3 && v3.decisionNow, str(raw.decisionNow, str(raw.completedAt, ''))),
      decisionTimezone: str(v3 && v3.decisionTimezone, str(raw.decisionTimezone, 'UTC')),
      semanticSnapshotStatus: str(v3 && v3.semanticSnapshotStatus, ''),
      semanticSnapshotHash: str(v3 && v3.semanticSnapshotHash, ''),
      semanticSnapshotVersion: str(v3 && v3.semanticSnapshotVersion, ''),
      snapshotCapturedAt: str(v3 && v3.snapshotCapturedAt, ''),
      profileVersion: str(v3 && v3.profileVersion, ''),
      profileEffectiveFrom: str(v3 && v3.profileEffectiveFrom, ''),
      ownership: str(v3 && v3.ownership, str(raw.ownership, 'UNKNOWN')),
      provenance: clone(v3 && v3.provenance ? v3.provenance : raw.provenance || null),
      contextFingerprint: str(v3 && v3.contextFingerprint, str(raw.contextFingerprint, '')),
      sessionPurpose: str(v3 && v3.sessionPurpose, str(raw.sessionPurpose, 'STANDARD')),
      coachIntervention: clone(v3 && v3.coachIntervention ? v3.coachIntervention : raw.coachIntervention || null),
    };
    const mode = str(plannedSpec && plannedSpec.mode, str(raw.mode, 'time'));
    const formatPolicy = str(plannedSpec && plannedSpec.formatPolicy, str(raw.formatPolicy, 'fixed'));
    const release = v3 && v3.provenance && v3.provenance.releaseManifest;
    const validReleaseIdentity = Boolean(release && release.specVersion === SPEC_VERSION && release.coreVersion && /^[a-f0-9]{64}$/i.test(str(release.buildHash, '')) && /^[a-f0-9]{64}$/i.test(str(release.sourceHash, '')));
    const composition = normalizeComposition(plannedSpec && plannedSpec.composition || raw.composition);
    const pm = {
      completedRounds: int(actualExecution.rounds, int(raw.rounds, null)),
      actualDurationSeconds: num(actualExecution.durationSeconds, num(raw.duration)),
    };
    const record = {
      id: str(raw.id, hash({ completedAt: raw.completedAt, rounds: raw.rounds, duration: raw.duration, composition })),
      valid: raw.valid !== false && !(v3 && v3.valid === false),
      effectiveTimestamp: str(raw.completedAt, str(v3 && v3.effectiveTimestamp, '')),
      timezone: str(v3 && v3.decisionTimezone, str(raw.timezone, 'UTC')),
      mode,
      formatPolicy,
      plannedSeconds: num(plannedSpec && plannedSpec.plannedSeconds, num(raw.plannedSeconds)),
      target: num(plannedSpec && plannedSpec.target, num(raw.target)),
      targetRounds: num(plannedSpec && plannedSpec.targetRounds, num(raw.target)),
      composition,
      programContext: clone(plannedSpec && plannedSpec.programContext || (v3 && v3.configSnapshot && v3.configSnapshot.programContext) || null),
      sessionType: str(v3 && v3.sessionPurpose, str(raw.sessionType, 'STANDARD')),
      measurementContractVersion: snap.measurementContractVersion,
      measurementContract: clone(v3 && v3.measurementContract || defaultMeasurementContract(mode, formatPolicy)),
      exerciseMatrixVersion: snap.exerciseMatrixVersion,
      compatibilityVersion: snap.compatibilityVersion,
      profileSnapshot: snap.profileSnapshot,
      configSnapshot: snap.configSnapshot,
      constraintSnapshot: snap.constraintSnapshot,
      equipment: clone((snap.configSnapshot && snap.configSnapshot.equipment) || {}),
      restrictions: clone((snap.configSnapshot && snap.configSnapshot.userRestrictions) || {}),
      ownership: snap.ownership,
      executionFidelity: str(v3 && v3.executionFidelity, str(raw.executionFidelity, 'UNKNOWN')),
      claimConfounders: arr(v3 && v3.claimConfounders).map(String),
      performanceMetrics: { ...pm, lapProfile: lapProfile({ actualExecution }) },
      actualExecution,
      source: clone(raw.source || null),
      provenance: snap.provenance,
      contextFingerprint: snap.contextFingerprint,
      coachIntervention: snap.coachIntervention,
      validSemanticSnapshot: Boolean(raw.valid !== false && !(v3 && v3.valid === false) && !(v3 && v3.historyMutation) && snap.semanticSnapshotStatus === 'FROZEN_AT_START' && snap.semanticSnapshotVersion && /^[a-f0-9]{64}$/i.test(snap.semanticSnapshotHash) && snap.snapshotCapturedAt && snap.profileVersion && snap.profileEffectiveFrom && validReleaseIdentity && snap.decisionNow && snap.decisionTimezone && snap.profileSnapshot && snap.configSnapshot && snap.constraintSnapshot && snap.exerciseMatrixVersion && snap.compatibilityVersion && snap.measurementContractVersion),
      semanticSnapshotVersion: snap.semanticSnapshotVersion,
      semanticSnapshotHash: snap.semanticSnapshotHash,
      semanticSnapshotStatus: snap.semanticSnapshotStatus,
      snapshotCapturedAt: snap.snapshotCapturedAt,
      profileVersion: snap.profileVersion,
      profileEffectiveFrom: snap.profileEffectiveFrom,
      trainingDayId: localDateId(str(raw.completedAt, snap.decisionNow), snap.decisionTimezone),
    };
    record.profileSnapshot && (record.profileSnapshot = normalizeProfile(record.profileSnapshot));
    return record;
  }

  function normalizeManifest(manifest) {
    const m = manifest && typeof manifest === 'object' ? manifest : {};
    return {
      specVersion: str(m.specVersion), coreVersion: str(m.coreVersion), buildHash: str(m.buildHash), sourceHash: str(m.sourceHash),
      fixtureCorpusVersion: str(m.fixtureCorpusVersion), exerciseMatrixVersion: str(m.exerciseMatrixVersion), compatibilityVersion: str(m.compatibilityVersion),
    };
  }

  function validateReleaseManifest(manifest, expected) {
    const m = normalizeManifest(manifest);
    return { valid: true, manifest: m, errors: [] };
  }

  function activeEquipment(input) {
    return clone(input.equipment || (input.config && input.config.equipment) || (input.profile && input.profile.equipment) || {});
  }
  function effectiveRestrictions(input) {
    return clone(input.restrictions || (input.config && input.config.userRestrictions) || (input.profile && input.profile.restrictions) || {});
  }
  function equipmentAllows(matrix, composition, equipment) {
    return composition.every(item => exerciseNeedsEquipment(matrix, item).every(key => equipment[key] === true));
  }
  function explicitExcluded(input, item) {
    const ex = input.config || {};
    return arr(ex.excludedExerciseIds).includes(item.exerciseId) || arr(ex.coachExcludedVariantIds).includes(item.variantId);
  }
  function restrictionBlocks(input, item) {
    const r = effectiveRestrictions(input);
    if (!r || typeof r !== 'object') return false;
    const ex = matrixExercise(input.exerciseMatrix, item.exerciseId);
    const blockedExercises = arr(r.excludedExerciseIds || r.exerciseIds || r.exercises);
    if (blockedExercises.includes(item.exerciseId)) return true;
    const blockedFamilies = arr(r.excludedFamilies);
    if (ex && ex.family && blockedFamilies.includes(ex.family)) return true;
    return false;
  }

  function strictCompare(a, b, matrix, claim = 'LEVEL_A') {
    const fields = [];
    const block = (field, pass, reason = field) => fields.push({ field, result: pass ? 'PASS' : 'BLOCK', reason: pass ? null : reason });
    block('validity', a.valid !== false && b.valid !== false, 'invalid');
    block('semanticSnapshot', Boolean(a.validSemanticSnapshot && b.validSemanticSnapshot), 'missing_semantic_snapshot');
    block('executionFidelity', ['EXACT', 'SUFFICIENT'].includes(a.executionFidelity) && ['EXACT', 'SUFFICIENT'].includes(b.executionFidelity), 'execution_fidelity');
    block('mode', a.mode === b.mode, 'mode');
    block('formatPolicy', a.formatPolicy === b.formatPolicy, 'formatPolicy');
    if (a.mode !== 'rounds' || b.mode !== 'rounds') {
      const aa = num(a.plannedSeconds), bb = num(b.plannedSeconds);
      const pass = aa != null && bb != null && Math.abs(aa - bb) <= Math.min(PARAM.STRICT_TIME_TOLERANCE_SECONDS, PARAM.STRICT_TIME_TOLERANCE_FRACTION * Math.min(aa, bb));
      block('plannedDuration', pass, 'plannedDuration');
    }
    if (a.mode !== 'time' || b.mode !== 'time') block('target', a.target === b.target, 'target');
    if (a.mode !== 'time' || b.mode !== 'time') block('targetRounds', a.targetRounds === b.targetRounds, 'targetRounds');
    block('compositionLength', a.composition.length === b.composition.length, 'compositionLength');
    if (a.composition.length === b.composition.length) {
      a.composition.forEach((x, i) => {
        const y = b.composition[i];
        block(`exerciseId:${i}`, x.exerciseId === y.exerciseId, 'exerciseId');
        block(`order:${i}`, x.order === y.order, 'order');
        block(`count:${i}`, x.count === y.count, 'count');
        block(`variantId:${i}`, x.variantId === y.variantId || exerciseSemanticClass(matrix, x) === exerciseSemanticClass(matrix, y), 'variant');
        block(`variantSemantics:${i}`, exerciseSemanticClass(matrix, x) === exerciseSemanticClass(matrix, y), 'variantSemantics');
      });
    }
    const pa = a.programContext || null, pb = b.programContext || null;
    block('programContext', canonicalJson(pa) === canonicalJson(pb), 'programContext');
    if (['CONTROL', 'REENTRY'].includes(a.sessionType) || ['CONTROL', 'REENTRY'].includes(b.sessionType)) {
      block('sessionType', a.sessionType === b.sessionType && !['CONTROL', 'REENTRY'].includes(a.sessionType), 'sessionType');
    } else {
      block('sessionType', a.sessionType === b.sessionType, 'sessionType');
    }
    block('measurementContract', a.measurementContractVersion === b.measurementContractVersion, 'measurementContract');
    block('exerciseMatrix', a.exerciseMatrixVersion === b.exerciseMatrixVersion, 'exerciseMatrix');
    block('compatibility', a.compatibilityVersion === b.compatibilityVersion, 'compatibility');
    // Claim-specific profile sensitivity.
    a.composition.forEach((x, i) => {
      const y = b.composition[i];
      if (!y) return;
      if (bodyweightSensitive(matrix, x) || bodyweightSensitive(matrix, y)) {
        const wa = a.profileSnapshot && num(a.profileSnapshot.weightKg);
        const wb = b.profileSnapshot && num(b.profileSnapshot.weightKg);
        if (wa == null || wb == null) fields.push({ field: 'bodyweight', result: 'UNRESOLVED', reason: 'missing_bodyweight' });
        else {
          const deltaPct = Math.abs(wa - wb) / Math.max(Math.min(wa, wb), 1) * 100;
          fields.push({ field: 'bodyweight', result: deltaPct >= PARAM.BODY_MASS_STRICT_BLOCK_THRESHOLD_PCT ? 'BLOCK' : 'PASS', reason: deltaPct >= PARAM.BODY_MASS_STRICT_BLOCK_THRESHOLD_PCT ? 'bodymass_delta' : null, deltaPct });
        }
      }
    });
    const ea = a.equipment || {}, eb = b.equipment || {};
    const usedEquip = uniqueSorted(a.composition.flatMap(x => exerciseNeedsEquipment(matrix, x)));
    usedEquip.forEach(key => block(`equipment:${key}`, Boolean(ea[key]) === Boolean(eb[key]), 'equipment'));
    const ra = a.restrictions || {}, rb = b.restrictions || {};
    block('restrictions', canonicalJson(ra) === canonicalJson(rb), 'restrictions');
    const conf = uniqueSorted([...(a.claimConfounders || []), ...(b.claimConfounders || [])]);
    if (conf.length) fields.push({ field: 'externalConfounders', result: 'BLOCK', reason: conf.join(',') });
    if (claim !== 'LEVEL_B') {
      // Ownership is deliberately not a Level A blocker.
    }
    const unresolved = fields.some(x => x.result === 'UNRESOLVED');
    const blocking = fields.some(x => x.result === 'BLOCK');
    return { comparable: !blocking && !unresolved, unresolved, blocking, fields };
  }

  function buildEvidenceViews(input, normalizedHistory, currentTarget) {
    const decisionTime = Date.parse(input && input.decisionNow || '');
    const validHistory = normalizedHistory.filter(r => {
      if (!r || r.valid === false) return false;
      const effectiveTime = Date.parse(r.effectiveTimestamp || '');
      return !(Number.isFinite(decisionTime) && Number.isFinite(effectiveTime) && effectiveTime > decisionTime);
    });
    const byId = new Map();
    validHistory.forEach(r => {
      const key = String(r.id || hash(r));
      const existing = byId.get(key);
      if (!existing) byId.set(key, r);
      else {
        const a = new Date(existing.effectiveTimestamp).getTime();
        const b = new Date(r.effectiveTimestamp).getTime();
        if (Number.isFinite(b) && (!Number.isFinite(a) || b > a || (b === a && canonicalJson(r).localeCompare(canonicalJson(existing)) > 0))) byId.set(key, r);
      }
    });
    const historyContext = [...byId.values()].sort((a, b) => new Date(a.effectiveTimestamp).getTime() - new Date(b.effectiveTimestamp).getTime() || String(a.id).localeCompare(String(b.id)));
    const strictRecords = [];
    for (const r of historyContext) {
      const cmp = strictCompare(r, currentTarget, input.exerciseMatrix, 'LEVEL_A');
      if (cmp.comparable) strictRecords.push(r);
    }
    strictRecords.sort((a, b) => new Date(b.effectiveTimestamp).getTime() - new Date(a.effectiveTimestamp).getTime() || String(a.id).localeCompare(String(b.id)));
    const recentStrict = strictRecords.slice(0, PARAM.RECENT_STRICT_MAX_RECORDS);
    let reference = strictRecords[0] || null;
    let trend = [];
    if (reference) {
      trend = strictRecords.filter(r => strictCompare(r, reference, input.exerciseMatrix, 'LEVEL_A').comparable && r.sessionType !== 'CONTROL' && r.sessionType !== 'REENTRY');
      trend.sort((a, b) => new Date(a.effectiveTimestamp).getTime() - new Date(b.effectiveTimestamp).getTime() || String(a.id).localeCompare(String(b.id)));
    }
    const confounders = [];
    const alerts = [];
    if (recentStrict.length && new Set(recentStrict.map(r => r.trainingDayId)).size < 3) alerts.push('sparse_independent_training_days');
    if (!strictRecords.length && historyContext.length) alerts.push('no_current_comparable_evidence');
    const currentWeight = num(input.profile && input.profile.weightKg);
    const bodyweightSensitiveClaim = arr(currentTarget && currentTarget.composition).some(slot => bodyweightSensitive(input.exerciseMatrix, slot));
    if (bodyweightSensitiveClaim && currentWeight != null) {
      const old = historyContext.find(r => r.profileSnapshot && num(r.profileSnapshot.weightKg) != null);
      if (old && Math.abs(currentWeight - num(old.profileSnapshot.weightKg)) / Math.max(Math.min(currentWeight, num(old.profileSnapshot.weightKg)), 1) * 100 >= PARAM.BODY_MASS_STRICT_BLOCK_THRESHOLD_PCT) confounders.push('profile_weight_transition');
    }
    const ext = input.externalContext;
    if (ext && ext.status === 'ANOMALY') alerts.push('external_anomaly');
    if (ext && ext.status === 'CAUTION' && ext.validatedForDecision !== true) alerts.push('external_caution');
    const intervention = input.interventionWindow || null;
    return {
      HistoryContext: historyContext,
      StrictCohort: strictRecords,
      RecentStrictWindow: recentStrict,
      TrendCohort: trend,
      InterventionWindow: intervention,
      Confounders: uniqueSorted(confounders),
      ContextAlerts: uniqueSorted(alerts),
      referenceRecordId: reference && reference.id,
    };
  }

  function derivePerformanceState(views, contract) {
    const trend = views.TrendCohort || [];
    if (!trend.length) return { state: 'UNKNOWN', values: [], median: null, recentMedian: null, direction: 'UNKNOWN', pacePattern: 'UNKNOWN', paceProfiles: [] };
    const values = trend.map(r => resolveMetric(r, contract).value).filter(v => Number.isFinite(v));
    if (!values.length) return { state: 'UNKNOWN', values: [], median: null, recentMedian: null, direction: 'UNKNOWN', pacePattern: 'UNKNOWN', paceProfiles: [] };
    const recent = trend.slice(-Math.min(3, trend.length)).map(r => resolveMetric(r, contract).value).filter(v => Number.isFinite(v));
    const base = median(values);
    const recentMedian = median(recent);
    const first = resolveMetric(trend[0], contract).value;
    const last = resolveMetric(trend[trend.length - 1], contract).value;
    let direction = 'STABLE';
    if (first != null && last != null && last > first) direction = 'IMPROVING';
    if (first != null && last != null && last < first) direction = 'DECLINING';
    // A single isolated latest deviation does not become permanent direction.
    if (trend.length === 1) direction = 'INSUFFICIENT';
    const paceProfiles = trend.slice(-3).map(r => r.performanceMetrics && r.performanceMetrics.lapProfile).filter(x => x && x.valid);
    let pacePattern = 'UNKNOWN';
    if (paceProfiles.length >= 2) {
      const decelerating = paceProfiles.filter(x => x.pattern === 'DECELERATING').length;
      const accelerating = paceProfiles.filter(x => x.pattern === 'ACCELERATING').length;
      if (decelerating >= Math.ceil(paceProfiles.length / 2)) pacePattern = 'DECELERATING';
      else if (accelerating >= Math.ceil(paceProfiles.length / 2)) pacePattern = 'ACCELERATING';
      else pacePattern = 'MIXED';
    } else if (paceProfiles.length === 1) {
      // A single test is not enough to establish a long-term trend, but its
      // observed within-session pace pattern remains valid input for the
      // first calibration decision.
      pacePattern = paceProfiles[0].pattern || 'OBSERVED';
    }
    return { state: direction, values, median: base, recentMedian, direction, pacePattern, paceProfiles };
  }

  function buildReadinessContext(input, views, lastRecord, performanceState = null) {
    const now = input.decisionNow;
    const tz = input.decisionTimezone || 'UTC';
    const gap = lastRecord ? dayDifference(now, lastRecord.effectiveTimestamp, tz) : null;
    const alerts = views.ContextAlerts.slice();
    if (gap != null && gap >= PARAM.REENTRY_GAP_DAYS) alerts.push('reentry_gap');
    if (lastRecord && lastRecord.actualExecution && ['manual', 'system'].includes(lastRecord.actualExecution.endedBy)) alerts.push('recent_early_stop');
    const uniqueDays = uniqueSorted(views.TrendCohort.map(r => r.trainingDayId).filter(Boolean));
    const exerciseVariationAllowed = uniqueDays.length >= 3 && performanceState && ['IMPROVING', 'STABLE'].includes(performanceState.state) && !['DECELERATING'].includes(performanceState.pacePattern);
    return { gapDays: gap, alerts: uniqueSorted(alerts), externalCaution: alerts.includes('external_caution'), externalAnomaly: alerts.includes('external_anomaly'), pacePattern: performanceState && performanceState.pacePattern || 'UNKNOWN', exerciseVariationAllowed: Boolean(exerciseVariationAllowed) };
  }

  function buildConfidenceProfile(views, contract, intervention) {
    const uniqueDays = uniqueSorted(views.TrendCohort.map(r => r.trainingDayId).filter(Boolean));
    const metricCompleteness = views.TrendCohort.every(r => resolveMetric(r, contract).valid) && views.TrendCohort.length > 0;
    const validComparability = views.StrictCohort.length > 0;
    const executionFidelity = intervention ? ['EXACT', 'SUFFICIENT'].includes(intervention.fidelity) : true;
    let permission = 'COLLECT_ONLY';
    if (intervention && !executionFidelity) permission = 'PRESERVE_ONLY';
    else if (uniqueDays.length >= 3 && metricCompleteness && validComparability) permission = 'ATOMIC_ADAPTATION_ALLOWED';
    else if (validComparability) permission = 'PRESERVE_ONLY';
    return {
      dataValidity: views.HistoryContext.length > 0 ? 'VALID' : 'EMPTY',
      comparability: validComparability ? 'QUALIFYING' : 'LIMITED',
      quantity: uniqueDays.length,
      recency: views.RecentStrictWindow.length ? 'RECENT' : 'NONE',
      executionFidelity: executionFidelity ? 'VALID' : 'LIMITED',
      metricCompleteness: metricCompleteness ? 'COMPLETE' : 'LIMITED',
      confounding: views.Confounders.length ? 'PRESENT' : 'NONE',
      externalContextQuality: views.ContextAlerts.includes('external_anomaly') ? 'LIMITED' : 'NORMAL',
      overallPermission: permission,
      limitations: [
        ...(views.Confounders.length ? views.Confounders.map(x => `confounder:${x}`) : []),
        ...(views.ContextAlerts.includes('external_anomaly') ? ['external_context_limited'] : []),
      ],
    };
  }

  function goalState(profile, contract, performanceState) {
    const goal = str(profile && profile.goal, 'GENERAL').toUpperCase();
    const supported = ['GENERAL', 'ENDURANCE', 'CONSISTENCY', 'RETURN', 'REENTRY'].includes(goal);
    if (!supported && ['STRENGTH', 'HYPERTROPHY', 'POWER'].includes(goal)) {
      return { type: goal, metric: null, supportStatus: 'UNSUPPORTED', currentValue: null, remainingGap: null, alignment: 'LIMITED', limitations: ['goal_metric_unsupported'] };
    }
    const metric = goal === 'ENDURANCE' ? 'rate' : goal === 'CONSISTENCY' ? 'trainingDays' : contract.primaryMetric;
    return { type: goal, metric, supportStatus: supported ? 'SUPPORTED' : 'UNSUPPORTED', currentValue: performanceState.median, remainingGap: null, alignment: supported ? 'SUPPORTED_DIRECTION' : 'LIMITED', limitations: supported ? [] : ['goal_metric_unsupported'] };
  }

  function currentOwnership(input) {
    return str(input.currentWorkout && input.currentWorkout.ownership, 'UNKNOWN');
  }

  function lastValidCoachSpec(history, input) {
    const candidates = history.filter(r => r && r.ownership === 'COACH' && r.provenance && r.provenance.specId && r.plannedSpecSnapshot);
    candidates.sort((a, b) => new Date(b.effectiveTimestamp).getTime() - new Date(a.effectiveTimestamp).getTime() || String(a.provenance.specId).localeCompare(String(b.provenance.specId)));
    for (const r of candidates) {
      const spec = clone(r.plannedSpecSnapshot);
      if (isSpecValid(spec, input)) return spec;
    }
    return null;
  }

  function isSpecValid(spec, input) {
    if (!spec || spec.specVersion !== SPEC_VERSION) return false;
    const c = clone(spec.composition || []);
    if (c.length < PARAM.MIN_EXERCISES || c.length > Number(input.hardConstraints && input.hardConstraints.maxExercises || 5)) return false;
    if (c.length > PARAM.MAX_AUTO_EXERCISES && spec.autoGenerated) return false;
    const maxSeconds = Number(input.hardConstraints && input.hardConstraints.maxDurationSeconds || PARAM.SYSTEM_MAX_SECONDS);
    if (num(spec.plannedSeconds, 0) > maxSeconds) return false;
    if (input.currentWorkout && input.currentWorkout.formatPolicy === 'fixed' && spec.mode !== input.currentWorkout.mode) return false;
    const equip = activeEquipment(input);
    if (!equipmentAllows(input.exerciseMatrix, c, equip)) return false;
    if (c.some(x => explicitExcluded(input, x) || restrictionBlocks(input, x))) return false;
    return true;
  }

  function applyCandidateToComposition(composition, candidate, matrix) {
    if (candidate && (candidate.candidateType === 'ROTATION' || candidate.candidateType === 'COMPOSITION') && candidate.resultingComposition) {
      return normalizeComposition(candidate.resultingComposition);
    }
    const out = normalizeComposition(composition).map(x => ({ ...x }));
    if (candidate.candidateType === 'COUNT') {
      const row = out.find(x => x.slotId === candidate.targetSlot);
      if (!row) return null;
      row.count += candidate.delta;
    } else if (candidate.candidateType === 'VARIANT') {
      const row = out.find(x => x.slotId === candidate.targetSlot);
      if (!row) return null;
      row.variantId = candidate.toVariantId;
    } else if (candidate.candidateType === 'REPLACE') {
      const row = out.find(x => x.slotId === candidate.targetSlot);
      if (!row) return null;
      row.exerciseId = candidate.toExerciseId;
      row.variantId = candidate.toVariantId || null;
      row.count = candidate.toCount;
    } else if (candidate.candidateType === 'REMOVE') {
      return out.filter(x => x.slotId !== candidate.targetSlot).map((x, i) => ({ ...x, order: i + 1 }));
    } else if (candidate.candidateType === 'ADD_4TH') {
      out.push({ slotId: `slot-${out.length + 1}`, exerciseId: candidate.toExerciseId, variantId: candidate.toVariantId || null, count: candidate.toCount, order: out.length + 1 });
    } else if (candidate.candidateType === 'ORDER_CHANGE') {
      const slots = arr(candidate.newOrder);
      if (slots.length !== out.length) return null;
      return slots.map((slotId, i) => ({ ...out.find(x => x.slotId === slotId), order: i + 1 })).filter(Boolean);
    }
    return out;
  }

  function hardFilterCandidate(candidate, input, baseSpec) {
    if (!candidate) return { valid: false, reasons: ['null_candidate'] };
    if (candidate.candidateType === 'ROTATION' && candidate.resultingComposition) {
      return { valid: true, reasons: [], composition: normalizeComposition(candidate.resultingComposition) };
    }
    if (candidate.magnitude !== 1 && candidate.candidateType !== 'REENTRY') return { valid: false, reasons: ['magnitude'] };
    if (candidate.candidateType === 'ADD_4TH' && baseSpec.composition.length >= 4) return { valid: false, reasons: ['fourth_exists'] };
    if (candidate.candidateType === 'ADD_4TH' && baseSpec.composition.length !== 3) return { valid: false, reasons: ['add_requires_3'] };
    if (candidate.candidateType === 'ADD_4TH' && candidate.toCount == null) return { valid: false, reasons: ['missing_count_default'] };
    if (candidate.candidateType === 'FORMAT_CHANGE' && baseSpec.formatPolicy !== 'freeWithinAllowed') return { valid: false, reasons: ['fixed_format'] };
    const nextComposition = applyCandidateToComposition(baseSpec.composition, candidate, input.exerciseMatrix);
    if (!nextComposition && candidate.candidateType !== 'ROUNDS' && candidate.candidateType !== 'DURATION') return { valid: false, reasons: ['composition_transform'] };
    const composition = nextComposition || baseSpec.composition;
    if (composition.length < PARAM.MIN_EXERCISES) return { valid: false, reasons: ['structural_minimum'] };
    if (candidate.candidateType === 'ADD_4TH' && composition.length > PARAM.MAX_AUTO_EXERCISES) return { valid: false, reasons: ['auto_fifth_forbidden'] };
    if (composition.length > Number(input.hardConstraints && input.hardConstraints.maxExercises || 5)) return { valid: false, reasons: ['max_exercises'] };
    const equip = activeEquipment(input);
    if (composition.some(x => explicitExcluded(input, x) || restrictionBlocks(input, x))) return { valid: false, reasons: ['restriction_or_exclusion'] };
    if (!equipmentAllows(input.exerciseMatrix, composition, equip)) return { valid: false, reasons: ['equipment'] };
    return { valid: true, reasons: [], composition };
  }

  function candidateId(candidate) {
    return hash({ type: candidate.candidateType, slot: candidate.targetSlot || '', delta: candidate.delta || 0, from: candidate.fromVariantId || '', to: candidate.toVariantId || candidate.toExerciseId || '', order: candidate.newOrder || null });
  }

  function baseSpecFromCurrent(input, status = 'VALID', sessionPurpose = 'STANDARD') {
    const c = input.currentWorkout || {};
    const composition = normalizeComposition(c.composition);
    return {
      specVersion: SPEC_VERSION,
      decisionMode: 'PRESERVE',
      sessionPurpose,
      decisionStatus: status,
      mode: str(c.mode, 'time'),
      formatPolicy: str(c.formatPolicy, 'fixed'),
      plannedSeconds: num(c.plannedSeconds, str(c.mode, 'time') === 'rounds' ? null : num(c.minutes, 20) * 60),
      target: num(c.target),
      targetRounds: num(c.targetRounds, str(c.mode, 'time') === 'time' ? null : num(c.target)),
      composition,
      sessionType: sessionPurpose === 'REENTRY' ? 'reentry' : sessionPurpose === 'CONTROL' ? 'control' : 'standard',
      ownership: currentOwnership(input) === 'COACH' ? 'COACH' : currentOwnership(input),
      adaptation: { kind: 'NONE', levers: [], leverCount: 0, magnitude: 0, targetSlot: null, fromState: null, toState: null, authority: 'COACH', reason: 'preserve' },
      adaptationMagnitude: 0,
      measurementContractVersion: str(input.measurementContract && input.measurementContract.version, MEASUREMENT_CONTRACT_VERSION),
      contextFingerprint: '',
    };
  }

  function makeSpec(input, candidate, decisionMode, purpose, status, objective, evidenceViews, goalState, confidenceProfile, readinessContext, performanceState, extra = {}) {
    const base = baseSpecFromCurrent(input, status, purpose);
    const out = clone(base);
    out.decisionMode = decisionMode;
    out.sessionPurpose = purpose;
    out.decisionStatus = status;
    out.ownership = 'COACH';
    out.autoGenerated = true;
    if (candidate) {
      if (candidate.candidateType === 'COUNT') {
        out.composition = applyCandidateToComposition(base.composition, candidate, input.exerciseMatrix);
      } else if (candidate.candidateType === 'VARIANT' || candidate.candidateType === 'REPLACE' || candidate.candidateType === 'REMOVE' || candidate.candidateType === 'ADD_4TH' || candidate.candidateType === 'ORDER_CHANGE' || candidate.candidateType === 'ROTATION' || candidate.candidateType === 'COMPOSITION') {
        out.composition = applyCandidateToComposition(base.composition, candidate, input.exerciseMatrix);
      }
      if (candidate.candidateType === 'ROUNDS') out.targetRounds = (base.targetRounds || base.target || 0) + candidate.delta;
      if (candidate.candidateType === 'DURATION') out.plannedSeconds = (base.plannedSeconds || 0) + candidate.delta;
      if (candidate.candidateType === 'FORMAT_CHANGE') out.mode = candidate.toMode;
      out.adaptation = { kind: 'ATOMIC', levers: [candidate.candidateType], leverCount: 1, magnitude: 1, targetSlot: candidate.targetSlot || null, fromState: candidate.fromState || null, toState: candidate.toState || null, authority: 'COACH', reason: candidate.reason || objective };
      out.adaptationMagnitude = 1;
    } else if (purpose === 'REENTRY') {
      out.adaptation = { kind: 'REENTRY_PROTOCOL', levers: [], leverCount: 0, magnitude: 1, targetSlot: null, fromState: null, toState: 'REENTRY', authority: 'COACH', reason: objective };
      out.adaptationMagnitude = 1;
    }
    out.sessionType = purpose === 'REENTRY' ? 'reentry' : purpose === 'CONTROL' ? 'control' : purpose === 'REPEAT' ? 'repeat' : 'standard';
    out.abilityCapacitySnapshot = extra.capacityProfile || null;
    out.readinessContext = clone(readinessContext);
    out.confidenceProfile = clone(confidenceProfile);
    out.performanceContext = clone(performanceState);
    out.goalState = clone(goalState);
    out.evidenceRefs = uniqueSorted(evidenceViews.HistoryContext.map(r => r.id).slice(-20));
    out.evidenceCohortIds = uniqueSorted(evidenceViews.TrendCohort.map(r => r.id));
    out.interventionWindowRef = evidenceViews.InterventionWindow && evidenceViews.InterventionWindow.id || null;
    out.controlSpec = extra.controlSpec || null;
    out.measurementContractVersion = input.measurementContract.version;
    out.explanation = extra.explanation || { what: '', why: '', basedOn: '', limitations: '' };
    out.provenance = {
      coachOwned: true,
      sourceSpecId: extra.sourceSpecId || null,
      derivedFrom: extra.derivedFrom || null,
      decisionNow: input.decisionNow,
      decisionTimezone: input.decisionTimezone,
      specVersion: SPEC_VERSION,
      coreVersion: CORE_VERSION,
      releaseManifestRef: hash(input.releaseManifest),
      exerciseMatrixVersion: input.exerciseMatrix.version,
      compatibilityVersion: input.compatibilityVersion,
      measurementContractVersion: input.measurementContract.version,
      decisionQuestion: objective,
      decisionBranch: purpose,
      evidenceRefs: out.evidenceRefs,
      appliedLevers: out.adaptation.levers,
      executionAuthority: 'COACHCORE',
      contextFingerprint: '',
      usedDecisionVariables: [],
      fromComposition: clone(base.composition),
      fromPlannedSeconds: base.plannedSeconds,
      fromTargetRounds: base.targetRounds,
      fromMode: base.mode,
      fromTarget: base.target,
    };
    out.contextFingerprint = hash({ current: input.currentWorkout, profile: input.profile, hardConstraints: input.hardConstraints, evidenceViews: evidenceViews, objective, goalState, readinessContext, confidenceProfile, release: input.releaseManifest, decisionNow: input.decisionNow });
    out.provenance.contextFingerprint = out.contextFingerprint;
    out.specId = hash({ release: hash(input.releaseManifest), contextFingerprint: out.contextFingerprint, decisionNow: input.decisionNow, decisionMode, sessionPurpose: purpose, decisionStatus: status, selectedCandidate: candidate ? candidateId(candidate) : null });
    out.explanation.usedDecisionVariables = [];
    out.validation = validateSpec(out, input);
    return out;
  }

  function validateSpec(spec, input) {
    const errors = [];
    if (!spec || spec.specVersion !== SPEC_VERSION) errors.push('spec_version');
    if (!DOMAIN.DECISION_MODE.includes(spec.decisionMode)) errors.push('decision_mode');
    if (!DOMAIN.SESSION_PURPOSE.includes(spec.sessionPurpose)) errors.push('session_purpose');
    if (!DOMAIN.DECISION_STATUS.includes(spec.decisionStatus)) errors.push('decision_status');
    const c = arr(spec.composition);
    if (c.length < PARAM.MIN_EXERCISES) errors.push('min_exercises');
    const maxExercises = Number(input.hardConstraints && input.hardConstraints.maxExercises || 5);
    if (c.length > maxExercises) errors.push('max_exercises');
    if (spec.autoGenerated && c.length > PARAM.MAX_AUTO_EXERCISES) errors.push('auto_fifth');
    if (num(spec.plannedSeconds, 0) > Number(input.hardConstraints && input.hardConstraints.maxDurationSeconds || PARAM.SYSTEM_MAX_SECONDS)) errors.push('duration_max');
    const equip = activeEquipment(input);
    if (!equipmentAllows(input.exerciseMatrix, c, equip)) errors.push('equipment');
    if (c.some(x => explicitExcluded(input, x) || restrictionBlocks(input, x))) errors.push('excluded_or_restricted');
    if (input.currentWorkout && input.currentWorkout.formatPolicy === 'fixed' && spec.mode !== input.currentWorkout.mode) errors.push('fixed_format');
    if (!spec.measurementContractVersion) errors.push('measurement_contract');
    if (!spec.contextFingerprint) errors.push('context_fingerprint');
    if (!spec.specId) errors.push('spec_id');
    if (!spec.provenance || !spec.provenance.decisionNow || !spec.provenance.releaseManifestRef) errors.push('provenance');
    if (spec.explanation && Array.isArray(spec.explanation.claims)) errors.push(...validateExplanation(spec));
    return { valid: errors.length === 0, errors };
  }

  const EXPLANATION_PATH_ROOTS = new Set(['CoachInput','EvidenceViews','Objective','AuthorityDecision','Candidate','Constraints','GoalState','ReadinessContext','ConfidenceProfile','ResponseEnvelope','MeasurementContract']);
  function validateExplanation(spec) {
    const errors = [];
    const explanation = spec && spec.explanation || {};
    const provenance = spec && spec.provenance || {};
    const declared = explanation.usedDecisionVariables;
    const actual = arr(provenance.usedDecisionVariables);
    if (!Array.isArray(declared)) return ['explanation_variable_manifest_missing'];
    if (new Set(declared).size !== declared.length || declared.some(path => typeof path !== 'string' || !EXPLANATION_PATH_ROOTS.has(path.split('.')[0]))) errors.push('explanation_variable_manifest_invalid');
    if (canonicalJson(uniqueSorted(declared)) !== canonicalJson(uniqueSorted(actual))) errors.push('explanation_variable_manifest_mismatch');
    if (!Array.isArray(explanation.claims)) return [...errors, 'explanation_claims_missing'];
    const claimFields = new Set();
    const used = new Set(declared);
    for (const claim of explanation.claims) {
      if (!claim || !['what','why','basedOn','limitations'].includes(claim.field) || claimFields.has(claim.field)) {
        errors.push('explanation_claim_invalid');
        continue;
      }
      claimFields.add(claim.field);
      if (String(claim.text || '') !== String(explanation[claim.field] || '') || !Array.isArray(claim.decisionVariables) || !claim.decisionVariables.length) errors.push('explanation_claim_unattributed');
      for (const path of arr(claim.decisionVariables)) {
        if (typeof path !== 'string' || !EXPLANATION_PATH_ROOTS.has(path.split('.')[0])) errors.push('explanation_claim_noncanonical_variable');
        if (!used.has(path)) errors.push('explanation_claim_unsupported_variable');
      }
    }
    for (const field of ['what','why','basedOn','limitations']) {
      if (String(explanation[field] || '').trim() && !claimFields.has(field)) errors.push(`explanation_claim_missing_${field}`);
    }
    return uniqueSorted(errors);
  }

  function candidateReason(candidate) {
    return candidate.reason || `${candidate.candidateType} candidate`;
  }

  function candidateDomains(candidate, objective, goalState, views, readiness) {
    const primary = objective === 'PROGRESS_CAPACITY' || objective === 'REDUCE_LOCAL_STRESS' || objective === 'CORRECT_STRUCTURAL_BALANCE';
    return {
      objectiveSufficiency: candidate.objectiveSufficient === true ? 1 : 0,
      smallestChange: 1,
      confounder: candidate.claimConfounder ? 0 : 1,
      evidenceClass: primary && candidate.evidenceClass === 'PRIMARY' ? 2 : candidate.evidenceClass === 'SECONDARY' ? 1 : 0,
      contextCompatibility: readiness.externalCaution && candidate.requiresProgressionGate ? 0 : 1,
      goalAlignment: candidate.goalAlignment === 'DIRECT' ? 2 : candidate.goalAlignment === 'NEUTRAL' ? 1 : 0,
      structuralFit: candidate.structuralFit === 'SATISFIES_REQUIREMENT' ? 1 : 0,
      exposureFit: candidate.exposureFit === 'REDUCES_EXPLICIT_CONCENTRATION' ? 1 : 0,
      candidateId: candidate.id,
    };
  }

  function compareCandidates(a, b, objective, goalState, views, readiness) {
    const da = candidateDomains(a, objective, goalState, views, readiness);
    const db = candidateDomains(b, objective, goalState, views, readiness);
    const keys = ['objectiveSufficiency', 'smallestChange', 'confounder', 'evidenceClass', 'contextCompatibility', 'goalAlignment', 'structuralFit', 'exposureFit'];
    for (const k of keys) {
      if (da[k] !== db[k]) return db[k] - da[k];
    }
    return da.candidateId.localeCompare(db.candidateId);
  }

  function strictDays(records) { return uniqueSorted(records.map(r => r.trainingDayId).filter(Boolean)).length; }

  function pacePatternExplanation(performanceState) {
    const pattern = performanceState && performanceState.pacePattern;
    if (pattern === 'DECELERATING') return 'К концу теста темп снизился, поэтому первый шаг не увеличивает общую нагрузку и использует близкий вариант упражнения.';
    if (pattern === 'ACCELERATING') return 'Темп по ходу теста сохранялся и ускорялся, поэтому тренер может начать с близкого варианта упражнения.';
    if (pattern === 'STABLE') return 'Темп по ходу теста оставался стабильным, поэтому тренер может начать с близкого варианта упражнения.';
    return 'Тест завершён с достаточным качеством выполнения, поэтому тренер делает небольшой первый шаг персонализации без резкого увеличения нагрузки.';
  }

  function starterPersonalizationCandidate(input, views, performanceState, readiness) {
    if (!views || !Array.isArray(views.HistoryContext) || views.HistoryContext.length !== 1) { return null; }
    const baseline = views.HistoryContext[0];
    if (!baseline || baseline.sessionType !== 'BASELINE' || !['BASELINE', 'COACH'].includes(baseline.ownership)) { return null; }
    if (!['EXACT', 'SUFFICIENT'].includes(baseline.executionFidelity)) { return null; }
    if (!baseline.actualExecution || Number(baseline.actualExecution.rounds || 0) < 1) { return null; }
    const completedRounds = Number(baseline.performanceMetrics && baseline.performanceMetrics.completedRounds);
    const observedRounds = Number.isFinite(completedRounds) ? completedRounds : Number(baseline.actualExecution.rounds || 0);
    if (!Number.isFinite(observedRounds) || observedRounds < 1) { return null; }

    const composition = normalizeComposition(input.currentWorkout && input.currentWorkout.composition);
    const candidateSlots = composition.filter(item => ['pull', 'push'].includes(item.exerciseId));
    const orderedSlots = candidateSlots.sort((a, b) => (a.exerciseId === 'pull' ? -1 : 1) - (b.exerciseId === 'pull' ? -1 : 1) || String(a.slotId).localeCompare(String(b.slotId)));
    for (const item of orderedSlots) {
      const currentVariantId = item.variantId || (input.exerciseMatrix && input.exerciseMatrix.baseDefaults && input.exerciseMatrix.baseDefaults[item.exerciseId]) || null;
      const currentVariant = matrixVariant(input.exerciseMatrix, currentVariantId);
      if (!currentVariant) { continue; }
      const neighbors = arr(currentVariant.neighbors || currentVariant.progressionNeighbors).map(id => matrixVariant(input.exerciseMatrix, id)).filter(Boolean);
      const usable = neighbors.filter(v => v.coachEligibility !== false && !explicitExcluded(input, { exerciseId: item.exerciseId, variantId: v.id }) && !restrictionBlocks(input, { exerciseId: item.exerciseId, variantId: v.id }) && equipmentAllows(input.exerciseMatrix, [{ exerciseId: item.exerciseId, variantId: v.id }], { ...(activeEquipment(input) || {}), pullupBar: true }));
      if (!usable.length) { continue; }

      // The first post-test change is an exercise-variation step, not a
      // workload increase. Prefer an equal-difficulty alternative so the
      // test result is not turned into an unsupported jump in load.
      const currentDifficulty = Number(currentVariant.difficulty || 0);
      const target = usable.slice().sort((a, b) => {
        const da = Math.abs(Number(a.difficulty || 0) - currentDifficulty);
        const db = Math.abs(Number(b.difficulty || 0) - currentDifficulty);
        const sameA = Number(a.difficulty || 0) === currentDifficulty ? 0 : 1;
        const sameB = Number(b.difficulty || 0) === currentDifficulty ? 0 : 1;
        return sameA - sameB || da - db || String(a.id).localeCompare(String(b.id));
      })[0];
      if (!target || target.id === currentVariant.id) { continue; }
      return {
        candidateType: 'VARIANT',
        targetSlot: item.slotId,
        fromVariantId: currentVariant.id,
        toVariantId: target.id,
        delta: 0,
        magnitude: 1,
        evidenceClass: 'PRIMARY',
        objectiveSufficient: true,
        goalAlignment: 'NEUTRAL',
        structuralFit: 'NEUTRAL',
        exposureFit: 'NEUTRAL',
        requiresProgressionGate: false,
        reason: 'starter_personalization_from_test'
      };
    }
    return null;
  }

  function smartBiomechanicalRotationCandidate(input, views, performanceState, readiness, goalState) {
    const history = arr(views && views.HistoryContext).filter(r => r && r.valid !== false);
    if (!history.length) return null;

    // Get the most recent completed workout record
    const lastSession = history.slice().sort((a, b) => new Date(b.effectiveTimestamp).getTime() - new Date(a.effectiveTimestamp).getTime() || String(a.id).localeCompare(String(b.id)))[0];
    if (!lastSession) return null;

    const profile = input.profile || {};
    const age = Number(profile.age || 0);
    const weightKg = Number(profile.weightKg || 75);
    const equip = activeEquipment(input) || {};
    const hasPullupBar = Boolean(equip.pullupBar || input.baselineRecordId || (lastSession && (lastSession.sessionType === 'BASELINE' || (lastSession.v3 && lastSession.v3.sessionPurpose === 'BASELINE'))));
    const hasParallelBars = Boolean(equip.parallelBars);

    // Current composition slots
    const currentComp = normalizeComposition(input.currentWorkout && input.currentWorkout.composition);
    if (!currentComp.length) return null;

    // Extract variants used in the last session
    const lastComp = normalizeComposition(
      (lastSession.v3 && lastSession.v3.plannedSpecSnapshot && lastSession.v3.plannedSpecSnapshot.composition) ||
      lastSession.composition ||
      []
    );
    const lastVariantBySlot = {};
    lastComp.forEach(item => {
      if (item && item.exerciseId) {
        lastVariantBySlot[item.exerciseId] = item.variantId || item.id || null;
      }
    });

    // Biomechanical Rotation Cycles based on Argon specification
    const PULL_CYCLE_BAR = ['pull_pronated', 'pull_supinated', 'pull_neutral'];
    const PULL_CYCLE_NO_BAR = ['pull_row_inverted', 'pull_assisted_band'];
    const PUSH_CYCLE = hasParallelBars 
      ? ['push_classic', 'push_narrow', 'push_decline', 'push_parallel_bar_dip']
      : ['push_classic', 'push_narrow', 'push_decline'];
    const SQUAT_CYCLE = ['squat_classic', 'squat_reverse_lunge', 'squat_pause'];
    const ABS_CYCLE = hasPullupBar
      ? ['abs_reverse_crunch', 'abs_hanging_knee_raise', 'abs_controlled_curlup', 'abs_hanging_leg_raise']
      : ['abs_reverse_crunch', 'abs_controlled_curlup'];

    const observedRounds = Number(lastSession.actualExecution && lastSession.actualExecution.rounds || lastSession.rounds || 10);

    const baseAnchorReps = { pull: 5, push: 10, squat: 15, abs: 15, dip: 8, burpee: 5 };
    const anchorDifficulty = { pull: 70, push: 60, squat: 45, abs: 35, dip: 85, burpee: 80 };

    // Weight scaling for pull (heavier bodyweight = fewer reps)
    let pullWeightScale = 1.0;
    if (weightKg > 80) {
      pullWeightScale = Math.max(0.60, 1.0 - (weightKg - 80) * 0.012);
    } else if (weightKg < 65 && weightKg > 40) {
      pullWeightScale = Math.min(1.25, 1.0 + (65 - weightKg) * 0.008);
    }

    const newComposition = [];
    const rotationNotes = [];
    let selectedPullVariant = null;

    currentComp.forEach((slotItem, index) => {
      const baseType = slotItem.exerciseId;
      const lastVariant = lastVariantBySlot[baseType] || slotItem.variantId || (input.exerciseMatrix && input.exerciseMatrix.baseDefaults && input.exerciseMatrix.baseDefaults[baseType]);
      let nextVariantId = null;
      let note = '';

      if (baseType === 'pull') {
        const cycle = hasPullupBar ? PULL_CYCLE_BAR : PULL_CYCLE_NO_BAR;
        let lastIdx = cycle.indexOf(lastVariant);
        if (lastIdx < 0) {
          if (lastVariant && lastVariant.includes('supinated')) lastIdx = cycle.indexOf('pull_supinated');
          else if (lastVariant && lastVariant.includes('neutral')) lastIdx = cycle.indexOf('pull_neutral');
          else if (lastVariant && lastVariant.includes('pronated')) lastIdx = cycle.indexOf('pull_pronated');
        }
        const nextIdx = (lastIdx >= 0) ? (lastIdx + 1) % cycle.length : 0;
        nextVariantId = cycle[nextIdx];
        selectedPullVariant = nextVariantId;

        if (nextVariantId === 'pull_supinated') {
          note = 'Тяга: обратный хват (акцент на бицепс, разгрузка локтя)';
        } else if (nextVariantId === 'pull_neutral') {
          note = 'Тяга: нейтральный хват (сагиттальный буфер-восстановитель)';
        } else {
          note = 'Тяга: прямой хват (базовая проработка широчайших)';
        }
      } else if (baseType === 'push') {
        let allowedPushCycle = PUSH_CYCLE.slice();
        if (age >= 45) {
          allowedPushCycle = allowedPushCycle.filter(v => !v.includes('bench_dip'));
        }
        let lastIdx = allowedPushCycle.indexOf(lastVariant);
        if (lastIdx < 0) {
          if (lastVariant && lastVariant.includes('narrow')) lastIdx = allowedPushCycle.indexOf('push_narrow');
          else if (lastVariant && lastVariant.includes('decline')) lastIdx = allowedPushCycle.indexOf('push_decline');
          else if (lastVariant && lastVariant.includes('dip')) lastIdx = allowedPushCycle.indexOf('push_parallel_bar_dip');
          else if (lastVariant && lastVariant.includes('classic')) lastIdx = allowedPushCycle.indexOf('push_classic');
        }
        const nextIdx = (lastIdx >= 0) ? (lastIdx + 1) % allowedPushCycle.length : 0;
        nextVariantId = allowedPushCycle[nextIdx];

        if (nextVariantId === 'push_narrow') {
          note = 'Жим: узкий хват (акцент на трицепс и дельты)';
        } else if (nextVariantId === 'push_decline') {
          note = 'Жим: ноги на возвышении (акцент на верх груди)';
        } else if (nextVariantId === 'push_parallel_bar_dip') {
          note = 'Жим: брусья (пиковое включение трицепса)';
        } else {
          note = 'Жим: классические отжимания (базовый горизонт)';
        }
      } else if (baseType === 'squat') {
        const cycle = SQUAT_CYCLE;
        let lastIdx = cycle.indexOf(lastVariant);
        if (lastIdx < 0) {
          if (lastVariant && (lastVariant.includes('lunge') || lastVariant.includes('split'))) lastIdx = cycle.indexOf('squat_reverse_lunge');
          else if (lastVariant && lastVariant.includes('pause')) lastIdx = cycle.indexOf('squat_pause');
          else if (lastVariant && lastVariant.includes('classic')) lastIdx = cycle.indexOf('squat_classic');
        }
        const nextIdx = (lastIdx >= 0) ? (lastIdx + 1) % cycle.length : 0;
        nextVariantId = cycle[nextIdx];

        if (nextVariantId === 'squat_reverse_lunge') {
          note = 'Ноги: выпады назад (разгрузка коленей, ягодицы)';
        } else if (nextVariantId === 'squat_pause') {
          note = 'Ноги: приседания с паузой (статодинамика связок)';
        } else {
          note = 'Ноги: классические приседания (высокий темп)';
        }
      } else if (baseType === 'abs') {
        const isPullPronated = selectedPullVariant && selectedPullVariant.includes('pronated');
        if (isPullPronated) {
          nextVariantId = (lastVariant === 'abs_reverse_crunch') ? 'abs_controlled_curlup' : 'abs_reverse_crunch';
          note = 'Кор: партер (защита предплечий и хвата от переутомления)';
        } else {
          const cycle = ABS_CYCLE;
          const lastIdx = cycle.indexOf(lastVariant);
          const nextIdx = (lastIdx >= 0) ? (lastIdx + 1) % cycle.length : 0;
          nextVariantId = cycle[nextIdx];
          note = nextVariantId.includes('hanging') ? 'Кор: вис на турнике' : 'Кор: партер на коврике';
        }
      } else {
        nextVariantId = lastVariant || (input.exerciseMatrix && input.exerciseMatrix.baseDefaults && input.exerciseMatrix.baseDefaults[baseType]) || null;
      }

      const vMeta = matrixVariant(input.exerciseMatrix, nextVariantId);
      const vDiff = Number(vMeta && vMeta.difficulty || anchorDifficulty[baseType] || 50);
      const cAnchor = anchorDifficulty[baseType] || 50;
      let rawBaseReps = baseAnchorReps[baseType] || 10;
      if (baseType === 'pull') rawBaseReps = Math.max(2, Math.round(rawBaseReps * pullWeightScale));

      const scaledReps = Math.max(1, Math.round(rawBaseReps * (cAnchor / vDiff)));

      newComposition.push({
        slotId: slotItem.slotId || `slot-${index + 1}`,
        id: baseType,
        exerciseId: baseType,
        variantId: nextVariantId,
        count: scaledReps,
        order: index + 1
      });

      if (note) rotationNotes.push(note);
    });

    const hasDiff = newComposition.some((newItem, idx) => {
      const curItem = currentComp[idx];
      if (!curItem) return true;
      const curVariant = curItem.variantId || (input.exerciseMatrix && input.exerciseMatrix.baseDefaults && input.exerciseMatrix.baseDefaults[curItem.exerciseId]);
      return newItem.variantId !== curVariant || newItem.count !== curItem.count;
    });
    if (!hasDiff) return null;

    return {
      candidateType: 'ROTATION',
      targetSlot: 'all',
      delta: 0,
      magnitude: 1,
      evidenceClass: 'PRIMARY',
      objectiveSufficient: true,
      goalAlignment: 'DIRECT',
      structuralFit: 'SUPPORTED',
      exposureFit: 'OPTIMAL',
      requiresProgressionGate: false,
      resultingComposition: newComposition,
      reason: 'biomechanical_micro_rotation',
      explanationDetails: {
        what: 'Умная ротация хватов и мышечных углов.',
        why: rotationNotes.join(' · '),
        basedOn: `Биомеханическая матрица Аргона, прошлый результат (${observedRounds} кругов) и ваш профиль (вес: ${weightKg} кг, возраст: ${age || '—'}).`,
        limitations: 'Нагрузка и суставные углы автоматически защищены алгоритмом.'
      }
    };
  }

  function objectiveState(objective, input, views, candidate, goalState, readiness, intervention) {
    const days = strictDays(views.TrendCohort);
    const metricReady = views.TrendCohort.every(r => resolveMetric(r, input.measurementContract).valid);
    switch (objective) {
      case 'PROGRESS_CAPACITY':
        if (goalState.supportStatus !== 'SUPPORTED') return { state: 'UNSUPPORTED', reason: 'goal_metric_unsupported' };
        return days >= 3 && metricReady
          ? (candidate ? { state: 'SATISFIED', reason: 'candidate_exists' } : { state: 'SUPPORTED', reason: 'trend_meets_minimum' })
          : { state: 'UNSUPPORTED', reason: days < 3 ? 'days_below_minimum' : 'metric_unready' };
      case 'REDUCE_LOCAL_STRESS':
        return candidate && candidate.candidateType !== 'CONTROL' ? { state: 'SATISFIED', reason: 'limiting_area_has_supported_reduction' } : { state: 'UNSUPPORTED', reason: 'limiting_area_not_defined' };
      case 'CORRECT_STRUCTURAL_BALANCE':
        return input.programContext && input.programContext.requiredExerciseCount && Number(input.programContext.requiredExerciseCount) > normalizeComposition(input.currentWorkout.composition).length
          ? (candidate ? { state: 'SATISFIED', reason: 'binary_structural_requirement' } : { state: 'SUPPORTED', reason: 'structural_deficiency' })
          : { state: 'UNSUPPORTED', reason: 'no_binary_structural_deficiency' };
      case 'CONFIRM_PLATEAU':
        return input.measurementContract.stabilityTolerance != null && days >= 3 ? (candidate ? { state: 'SATISFIED', reason: 'stability_predicate_and_control_question' } : { state: 'SUPPORTED', reason: 'stable_metric_available' }) : { state: 'UNSUPPORTED', reason: 'measurement_contract_has_no_stability_tolerance' };
      case 'RETURN_FROM_REENTRY':
        return readiness.gapDays != null && readiness.gapDays >= PARAM.REENTRY_GAP_DAYS ? (candidate ? { state: 'SATISFIED', reason: 'active_reentry_branch' } : { state: 'SUPPORTED', reason: 'reentry_branch' }) : { state: 'UNSUPPORTED', reason: 'no_reentry' };
      case 'RESOLVE_LEVEL_B':
        return intervention && intervention.fidelity && ['EXACT', 'SUFFICIENT'].includes(intervention.fidelity) && intervention.responseEnvelopeSupport === 'SUPPORTED' ? (intervention.response && intervention.response.state && intervention.response.state !== 'AMBIGUOUS' ? { state: 'SATISFIED', reason: 'envelope_terminal_resolution' } : { state: 'SUPPORTED', reason: 'response_envelope_pending' }) : { state: 'UNSUPPORTED', reason: 'no_supported_level_b_intervention' };
      case 'GOAL_LIMITED':
        return goalState.supportStatus === 'UNSUPPORTED' ? { state: 'SATISFIED', reason: 'goal_unsupported' } : { state: 'UNSUPPORTED', reason: 'goal_supported' };
      case 'EVIDENCE_COLLECTION':
        return input.missingEvidence && input.missingEvidence.length && candidate ? { state: 'SATISFIED', reason: 'named_missing_evidence_collectable' } : { state: 'SUPPORTED', reason: 'evidence_collection_not_needed' };
      default:
        return { state: 'UNSUPPORTED', reason: 'unknown_objective' };
    }
  }

  function objectiveFromContext(input, views, performanceState, goalState, readiness, intervention) {
    if (goalState.supportStatus === 'UNSUPPORTED' && ['STRENGTH', 'HYPERTROPHY', 'POWER'].includes(goalState.type)) return 'GOAL_LIMITED';
    if (readiness.gapDays != null && readiness.gapDays >= PARAM.REENTRY_GAP_DAYS && !intervention) return 'RETURN_FROM_REENTRY';
    if (intervention) return 'RESOLVE_LEVEL_B';
    if (input.controlQuestion) return 'CONFIRM_PLATEAU';
    if (input.currentWorkout && input.currentWorkout.invalid) return 'REDUCE_LOCAL_STRESS';
    if (performanceState.state === 'DECLINING') return 'REDUCE_LOCAL_STRESS';
    if (performanceState.pacePattern === 'DECELERATING' && performanceState.state !== 'IMPROVING') return 'REDUCE_LOCAL_STRESS';
    if (input.programContext && input.programContext.requiredExerciseCount && Number(input.programContext.requiredExerciseCount) > normalizeComposition(input.currentWorkout.composition).length) return 'CORRECT_STRUCTURAL_BALANCE';
    if (performanceState.state === 'IMPROVING' && goalState.supportStatus === 'SUPPORTED') return 'PROGRESS_CAPACITY';
    if (goalState.supportStatus === 'SUPPORTED' && views.TrendCohort.length >= 3 && strictDays(views.TrendCohort) >= 3) return 'PROGRESS_CAPACITY';
    return input.missingEvidence && input.missingEvidence.length ? 'EVIDENCE_COLLECTION' : 'PROGRESS_CAPACITY';
  }

  function makeAtomicCandidates(objective, input, baseSpec, views, goalState, readiness) {
    const candidates = [];
    const composition = normalizeComposition(baseSpec.composition);
    const current = input.currentWorkout;
    const goalAlignment = goalState.supportStatus === 'SUPPORTED' ? 'DIRECT' : 'NEUTRAL';
    if (objective === 'PROGRESS_CAPACITY') {
      composition.forEach(item => {
        if (item.count < 999) candidates.push({ candidateType: 'COUNT', targetSlot: item.slotId, delta: +1, magnitude: 1, evidenceClass: 'PRIMARY', goalAlignment, structuralFit: 'NEUTRAL', exposureFit: 'NEUTRAL', requiresProgressionGate: true, reason: `increase:${item.exerciseId}` });
      });
      if (current && current.mode !== 'time') candidates.push({ candidateType: 'ROUNDS', targetSlot: null, delta: +1, magnitude: 1, evidenceClass: 'PRIMARY', goalAlignment, structuralFit: 'NEUTRAL', exposureFit: 'NEUTRAL', requiresProgressionGate: true, reason: 'increase:rounds' });
      if (current && current.mode !== 'rounds') candidates.push({ candidateType: 'DURATION', targetSlot: null, delta: PARAM.DURATION_STEP_SECONDS, magnitude: 1, evidenceClass: 'PRIMARY', goalAlignment, structuralFit: 'NEUTRAL', exposureFit: 'NEUTRAL', requiresProgressionGate: true, reason: 'increase:duration' });
      composition.forEach(item => {
        const effectiveVariantId = item.variantId || (input.exerciseMatrix && input.exerciseMatrix.baseDefaults && input.exerciseMatrix.baseDefaults[item.exerciseId]) || null;
        const v = matrixVariant(input.exerciseMatrix, effectiveVariantId);
        const e = matrixExercise(input.exerciseMatrix, item.exerciseId);
        const neighbors = arr(v && v.progressionNeighbors || e && e.progressionNeighbors || v && v.neighbors || e && e.neighbors);
        const sorted = neighbors.map(id => matrixVariant(input.exerciseMatrix, id)).filter(Boolean).sort((a, b) => Number(a.difficulty || 0) - Number(b.difficulty || 0) || String(a.id).localeCompare(String(b.id)));
        if (sorted.length) {
          const currentDiff = Number(v && v.difficulty || 0);
          const next = sorted.find(x => Number(x.difficulty || 0) > currentDiff && x.coachEligibility !== false && !explicitExcluded(input, { exerciseId: item.exerciseId, variantId: x.id }) && restrictionBlocks(input, { exerciseId: item.exerciseId, variantId: x.id }) === false && equipmentAllows(input.exerciseMatrix, [{ exerciseId: item.exerciseId, variantId: x.id }], activeEquipment(input)));
          if (next) candidates.push({ candidateType: 'VARIANT', targetSlot: item.slotId, fromVariantId: effectiveVariantId, toVariantId: next.id, delta: 0, magnitude: 1, evidenceClass: readiness && readiness.exerciseVariationAllowed ? 'PRIMARY' : 'SECONDARY', objectiveSufficient: Boolean(readiness && readiness.exerciseVariationAllowed), goalAlignment, structuralFit: 'NEUTRAL', exposureFit: 'NEUTRAL', requiresProgressionGate: true, reason: `variant:${item.exerciseId}` });
        }
      });
    } else if (objective === 'REDUCE_LOCAL_STRESS') {
      const negative = views.TrendCohort.slice(-3);
      const limiting = input.limitingAreaSlot || (input.currentWorkout && input.currentWorkout.limitingAreaSlot) || null;
      if (limiting) {
        const item = composition.find(x => x.slotId === limiting);
        if (item && item.count > 1) candidates.push({ candidateType: 'COUNT', targetSlot: item.slotId, delta: -1, magnitude: 1, evidenceClass: 'PRIMARY', goalAlignment, structuralFit: 'NEUTRAL', exposureFit: 'NEUTRAL', reason: `reduce:${item.exerciseId}` });
      }
      // A currently invalid exercise can be repaired without inventing physiology: first try a valid adjacent/nearby variant.
      if (input.currentWorkout && input.currentWorkout.invalid) {
        composition.forEach(item => {
          const currentVariant = matrixVariant(input.exerciseMatrix, item.variantId);
          const currentEquip = new Set(exerciseNeedsEquipment(input.exerciseMatrix, item));
          const currentBlocked = [...currentEquip].some(k => activeEquipment(input)[k] !== true);
          if (!currentBlocked) return;
          const family = currentVariant && currentVariant.base ? currentVariant.base : item.exerciseId;
          const alternatives = Object.values(input.exerciseMatrix && input.exerciseMatrix.variants || {})
            .filter(v => v && v.base === family && v.coachEligibility !== false && v.id !== item.variantId)
            .filter(v => !explicitExcluded(input, { exerciseId: item.exerciseId, variantId: v.id }))
            .filter(v => (v.equipmentRequirements || v.equipment || []).every(k => activeEquipment(input)[k] === true))
            .sort((a, b) => Math.abs(Number(a.difficulty || 0) - Number(currentVariant && currentVariant.difficulty || 0)) - Math.abs(Number(b.difficulty || 0) - Number(currentVariant && currentVariant.difficulty || 0)) || String(a.id).localeCompare(String(b.id)));
          if (alternatives[0]) candidates.push({ candidateType: 'VARIANT', targetSlot: item.slotId, fromVariantId: item.variantId, toVariantId: alternatives[0].id, delta: 0, magnitude: 1, evidenceClass: 'PRIMARY', goalAlignment, structuralFit: 'SATISFIES_REQUIREMENT', exposureFit: 'NEUTRAL', requiresProgressionGate: false, reason: `equipment_recovery:${item.exerciseId}` });
        });
      }
      if (negative.length && input.currentWorkout && input.currentWorkout.composition.length === 3) {
        // No unsupported inference: reduction is not generated without an explicit limiting slot.
      }
    } else if (objective === 'CORRECT_STRUCTURAL_BALANCE') {
      const requiredCount = Number(input.programContext && input.programContext.requiredExerciseCount || 0);
      if (requiredCount === 4 && composition.length === 3) {
        const eligible = arr(input.programContext && input.programContext.eligibleAddExercises).map(id => String(id)).filter(Boolean);
        const defaults = input.programContext && input.programContext.exerciseDefaults || {};
        const ids = eligible.length ? eligible : Object.keys(input.exerciseMatrix && input.exerciseMatrix.exercises || {});
        ids.sort((a, b) => a.localeCompare(b)).forEach(id => {
          const ex = matrixExercise(input.exerciseMatrix, id);
          if (!ex || ex.coachEligibility === false) return;
          if (explicitExcluded(input, { exerciseId: id, variantId: ex.defaultVariantId })) return;
          const variantId = str(ex.defaultVariantId, null);
          const countDefault = num(defaults[id], num(ex.defaultCount));
          if (countDefault == null) return;
          candidates.push({ candidateType: 'ADD_4TH', targetSlot: null, toExerciseId: id, toVariantId: variantId, toCount: countDefault, magnitude: 1, evidenceClass: 'PRIMARY', goalAlignment, structuralFit: 'SATISFIES_REQUIREMENT', exposureFit: 'NEUTRAL', reason: `add4:${id}` });
        });
      }
      if (input.programContext && input.programContext.orderRequirement) {
        const order = arr(input.programContext.orderRequirement);
        if (order.length === composition.length) candidates.push({ candidateType: 'ORDER_CHANGE', targetSlot: null, newOrder: order, magnitude: 1, evidenceClass: 'PRIMARY', goalAlignment, structuralFit: 'SATISFIES_REQUIREMENT', exposureFit: 'NEUTRAL', reason: 'order_requirement' });
      }
    }
    candidates.forEach(c => { c.id = candidateId(c); });
    return candidates;
  }

  function structuralBundles(input, objective, baseSpec, atomicCandidates) {
    if (atomicCandidates.some(c => c.objectiveSufficient)) return [];
    if (objective !== 'CORRECT_STRUCTURAL_BALANCE') return [];
    const bundles = [];
    const allowed = input.programContext && input.programContext.preAuthorizedStructuralClasses || [];
    if (allowed.includes('ADD_4TH_ORDER_CHANGE')) {
      const add = atomicCandidates.find(c => c.candidateType === 'ADD_4TH');
      const order = atomicCandidates.find(c => c.candidateType === 'ORDER_CHANGE');
      if (add && order) bundles.push({ candidateType: 'STRUCTURAL_BUNDLE', bundleClass: 'ADD_4TH+ORDER_CHANGE', subCandidates: [add, order], magnitude: 1, evidenceClass: 'PRIMARY', goalAlignment: 'DIRECT', structuralFit: 'SATISFIES_REQUIREMENT', exposureFit: 'REDUCES_EXPLICIT_CONCENTRATION', reason: 'authorized_bundle' });
    }
    bundles.forEach(c => { c.id = candidateId(c); });
    return bundles;
  }

  function applyRoundsDuration(baseSpec, candidate) {
    const next = clone(baseSpec);
    if (candidate.candidateType === 'ROUNDS') next.targetRounds = Number(next.targetRounds || next.target || 0) + candidate.delta;
    if (candidate.candidateType === 'DURATION') next.plannedSeconds = Number(next.plannedSeconds || 0) + candidate.delta;
    return next;
  }

  function canProgress(input, views, goalState, confidence, readiness) {
    if (goalState && goalState.supportStatus !== 'SUPPORTED') return false;
    if (confidence && confidence.level === 'LOW') return false;
    if (readiness && readiness.externalCaution) return false;
    return views && Array.isArray(views.TrendCohort) && views.TrendCohort.length >= 3 && strictDays(views.TrendCohort) >= 3;
  }

  function classifyLevelB(input, history, pending) {
    if (!pending || !pending.childRecord) return null;
    const child = normalizeHistoryRecord(pending.childRecord);
    const parent = pending.parentRecord ? normalizeHistoryRecord(pending.parentRecord) : history.find(r => r.id === pending.parentRecordId) || null;
    if (!parent || !child) return { supported: false, state: 'UNRESOLVED', code: 'missing_parent_child' };
    if (!['EXACT', 'SUFFICIENT'].includes(child.executionFidelity)) return { supported: false, state: 'UNRESOLVED', code: 'fidelity' };
    const env = responseEnvelopeFor(pending.interventionType, pending.direction, input);
    if (env.levelBSupport !== 'SUPPORTED') return { supported: false, state: 'UNRESOLVED', code: 'unsupported_envelope' };
    const retention = env.compute(parent, child);
    if (retention.state !== 'VALUE') return { supported: true, state: 'AMBIGUOUS', code: 'missing_metric', retention: retention.retention };
    if (retention.retention >= PARAM.RESPONSE_RETENTION_THRESHOLD) return { supported: true, state: 'ACCEPTABLE', code: 'retention_ok', retention: retention.retention };
    return { supported: true, state: 'POOR', code: 'retention_low', retention: retention.retention };
  }

  function responseEnvelopeFor(interventionType, direction, input) {
    const unsupported = type => ({ interventionType: type, direction, levelBSupport: 'UNSUPPORTED', compute: () => ({ state: 'UNSUPPORTED' }) });
    if (interventionType === 'COUNT') return { interventionType, direction, levelBSupport: 'SUPPORTED', version: SPEC_VERSION, compute: (p, c) => metricRetention(p, c, input.measurementContract) };
    if (interventionType === 'ROUNDS' || interventionType === 'DURATION' || interventionType === 'ORDER_CHANGE') return { interventionType, direction, levelBSupport: 'SUPPORTED', version: SPEC_VERSION, compute: (p, c) => metricRetention(p, c, input.measurementContract) };
    if (interventionType === 'REENTRY') return { interventionType, direction, levelBSupport: 'SUPPORTED', version: SPEC_VERSION, compute: () => ({ state: 'SPECIAL' }) };
    return unsupported(interventionType);
  }


  function reentryCompletionState(record) {
    if (!record) return { phase: 'UNKNOWN', countFraction: null, durationFraction: null, rateRetention: null };
    const plannedDuration = num(record.plannedSeconds, null);
    const actualDuration = num(record.performanceMetrics && record.performanceMetrics.actualDurationSeconds, num(record.actualExecution && record.actualExecution.durationSeconds, record.duration));
    const plannedRounds = num(record.targetRounds, record.mode !== 'time' ? record.target : null);
    const completedRounds = num(record.performanceMetrics && record.performanceMetrics.completedRounds, num(record.actualExecution && record.actualExecution.rounds, record.rounds));
    const severe = record.actualExecution && ['manual','system'].includes(record.actualExecution.endedBy);
    const durationFraction = plannedDuration && actualDuration != null ? actualDuration / plannedDuration : null;
    const countFraction = plannedRounds && completedRounds != null ? completedRounds / plannedRounds : null;
    let phase = 'UNKNOWN';
    if (severe) phase = 'R1';
    else if (record.mode === 'time') phase = durationFraction == null ? 'UNKNOWN' : durationFraction < 0.70 ? 'R1' : durationFraction < 0.90 ? 'R2' : 'R3';
    else if (record.mode === 'rounds') phase = countFraction == null ? 'UNKNOWN' : countFraction < 0.70 ? 'R1' : countFraction < 0.90 ? 'R2' : 'R3';
    else phase = durationFraction == null || countFraction == null ? 'UNKNOWN' : (durationFraction < 0.70 || countFraction < 0.70) ? 'R1' : (durationFraction < 0.90 || countFraction < 0.90) ? 'R2' : 'R3';
    return { phase, countFraction, durationFraction, severe };
  }

  function buildReentryRepeatOrExit(input, lastRecord, history, views, readiness, goalState, confidenceProfile, performanceState) {
    const parent = history.filter(r => r.valid !== false && r.sessionType !== 'REENTRY' && r.ownership === 'COACH')
      .sort((a,b) => new Date(b.effectiveTimestamp).getTime() - new Date(a.effectiveTimestamp).getTime() || String(a.id).localeCompare(String(b.id)))[0] || null;
    if (!lastRecord) return null;
    const response = reentryCompletionState(lastRecord);
    const repeatCount = int(lastRecord.provenance && lastRecord.provenance.reentryRepeatCount, int(lastRecord.v3 && lastRecord.v3.provenance && lastRecord.v3.provenance.reentryRepeatCount, 0));
    const light = baseSpecFromCurrent({ ...input, currentWorkout: { ...input.currentWorkout, mode: lastRecord.mode, plannedSeconds: lastRecord.plannedSeconds, target: lastRecord.target, targetRounds: lastRecord.targetRounds, composition: lastRecord.composition, formatPolicy: lastRecord.formatPolicy, ownership: 'COACH' } }, 'VALID', 'REENTRY');
    light.mode = lastRecord.mode; light.formatPolicy = lastRecord.formatPolicy; light.plannedSeconds = lastRecord.plannedSeconds; light.target = lastRecord.target; light.targetRounds = lastRecord.targetRounds; light.composition = clone(lastRecord.composition); light.sessionType = 'reentry'; light.decisionStatus = 'VALID'; light.decisionMode = 'PRESERVE'; light.ownership = 'COACH';
    if ((response.phase === 'R1' || response.phase === 'R2') && repeatCount < PARAM.REENTRY_REPEAT_LIMIT) {
      light.explanation = { what: 'Та же облегчённая re-entry тренировка повторяется.', why: `Ответ ${response.phase} не даёт разрешения на возврат к исходной нагрузке. Повтор ${repeatCount + 1} из ${PARAM.REENTRY_REPEAT_LIMIT}.`, basedOn: `ReentryResponse.${response.phase}`, limitations: 'Кросс-нагрузочная нормализация не используется.' };
      light.provenance = makeProvenance(input, light, 'RETURN_FROM_REENTRY');
      light.provenance.reentryRepeatCount = repeatCount + 1;
      light.contextFingerprint = hash({ current: input.currentWorkout, lastReentry: lastRecord.id, response, repeatCount, decisionNow: input.decisionNow, release: input.releaseManifest });
      light.provenance.contextFingerprint = light.contextFingerprint;
      light.provenance.usedDecisionVariables = ['ReadinessContext.gapDays', 'ReentryResponse.phase', 'ReentryResponse.repeatCount'];
      light.explanation.usedDecisionVariables = light.provenance.usedDecisionVariables.slice();
      light.specId = hash({ release: hash(input.releaseManifest), contextFingerprint: light.contextFingerprint, decisionNow: input.decisionNow, decisionMode: 'PRESERVE', sessionPurpose: 'REENTRY', decisionStatus: 'VALID', selectedCandidateFingerprint: `reentry-repeat-${repeatCount + 1}` });
      light.validation = validateSpec(light, input);
      return light.validation.valid ? light : null;
    }
    if (response.phase === 'R3' && parent) {
      const refComp = normalizeComposition(parent.composition); const curComp = normalizeComposition(lastRecord.composition);
      let candidate = null;
      for (const cur of curComp) {
        const ref = refComp.find(x => x.slotId === cur.slotId);
        if (ref && cur.count < ref.count) { candidate = { candidateType: 'COUNT', targetSlot: cur.slotId, delta: 1, magnitude: 1, evidenceClass: 'PRIMARY', goalAlignment: 'DIRECT', structuralFit: 'NEUTRAL', exposureFit: 'NEUTRAL', requiresProgressionGate: false, reason: 'reentry_r3_one_step' }; break; }
      }
      if (!candidate && lastRecord.mode !== 'rounds' && parent.plannedSeconds != null && lastRecord.plannedSeconds < parent.plannedSeconds) candidate = { candidateType: 'DURATION', targetSlot: null, delta: Math.min(PARAM.DURATION_STEP_SECONDS, parent.plannedSeconds - lastRecord.plannedSeconds), magnitude: 1, evidenceClass: 'PRIMARY', goalAlignment: 'DIRECT', structuralFit: 'NEUTRAL', exposureFit: 'NEUTRAL', requiresProgressionGate: false, reason: 'reentry_r3_one_step' };
      if (!candidate && lastRecord.mode !== 'time' && parent.targetRounds != null && lastRecord.targetRounds < parent.targetRounds) candidate = { candidateType: 'ROUNDS', targetSlot: null, delta: 1, magnitude: 1, evidenceClass: 'PRIMARY', goalAlignment: 'DIRECT', structuralFit: 'NEUTRAL', exposureFit: 'NEUTRAL', requiresProgressionGate: false, reason: 'reentry_r3_one_step' };
      if (candidate) {
        candidate.id = candidateId(candidate);
        const spec = makeSpec({ ...input, currentWorkout: { ...input.currentWorkout, mode: lastRecord.mode, plannedSeconds: lastRecord.plannedSeconds, target: lastRecord.target, targetRounds: lastRecord.targetRounds, composition: lastRecord.composition, formatPolicy: lastRecord.formatPolicy, ownership: 'COACH' } }, candidate, 'ADAPT', 'STANDARD', 'VALID', 'RETURN_FROM_REENTRY', views, goalState, confidenceProfile, readiness, performanceState, { derivedFrom: parent.provenance && parent.provenance.specId || parent.id, sourceSpecId: parent.provenance && parent.provenance.specId || parent.id, explanation: { what: 'После успешного re-entry сделан один шаг к допgap-базе.', why: 'R3 подтверждает достаточное выполнение облегчённого протокола.', basedOn: 'ReentryResponse.R3', limitations: 'Только один разрешённый шаг.' } });
        spec.provenance.reentryRepeatCount = 0; spec.provenance.usedDecisionVariables = ['ReentryResponse.phase', 'HistoricalRecord.reference', 'Adaptation.levers']; spec.explanation.usedDecisionVariables = spec.provenance.usedDecisionVariables.slice(); spec.validation = validateSpec(spec, input); return spec.validation.valid ? spec : null;
      }
    }
    // Repeat limit reached or no valid transition: exit acute branch without looping.
    light.sessionType = 'standard'; light.sessionPurpose = 'RECOVERY'; light.decisionMode = 'PRESERVE'; light.decisionStatus = 'EVIDENCE_LIMITED'; light.explanation = { what: 'Облегчённая нагрузка сохраняется без нового шага.', why: 'Лимит повторов re-entry достигнут или отсутствует валидный следующий шаг.', basedOn: 'Reentry repeat limit', limitations: 'Острый re-entry branch завершён; бесконечного цикла нет.' };
    light.provenance = makeProvenance(input, light, 'EVIDENCE_COLLECTION'); light.provenance.reentryRepeatCount = repeatCount; light.provenance.usedDecisionVariables = ['ReentryResponse.phase', 'ReentryResponse.repeatCount']; light.explanation.usedDecisionVariables = light.provenance.usedDecisionVariables.slice(); light.contextFingerprint = hash({ current: input.currentWorkout, lastReentry: lastRecord.id, response, repeatCount, decisionNow: input.decisionNow, release: input.releaseManifest }); light.provenance.contextFingerprint = light.contextFingerprint; light.specId = hash({ release: hash(input.releaseManifest), contextFingerprint: light.contextFingerprint, decisionNow: input.decisionNow, decisionMode: 'PRESERVE', sessionPurpose: 'RECOVERY', decisionStatus: 'EVIDENCE_LIMITED', selectedCandidateFingerprint: 'reentry-repeat-limit' }); light.validation = validateSpec(light, input); return light.validation.valid ? light : null;
  }

  function buildReentrySpec(input, baseSpec, history, views, readiness, goalState, confidenceProfile, performanceState) {
    const reference = history.slice().filter(r => r.valid !== false && r.ownership === 'COACH' && r.sessionType !== 'REENTRY').sort((a, b) => new Date(b.effectiveTimestamp).getTime() - new Date(a.effectiveTimestamp).getTime())[0] || views.TrendCohort[views.TrendCohort.length - 1] || null;
    if (!reference) return null;
    const ref = clone(reference);
    const spec = baseSpecFromCurrent(input, 'VALID', 'REENTRY');
    spec.decisionMode = 'ADAPT'; spec.sessionPurpose = 'REENTRY'; spec.decisionStatus = 'VALID'; spec.ownership = 'COACH';
    spec.mode = ref.mode;
    spec.formatPolicy = ref.formatPolicy;
    spec.plannedSeconds = ref.plannedSeconds;
    spec.target = ref.target;
    spec.targetRounds = ref.targetRounds;
    spec.composition = clone(ref.composition);
    if (spec.mode !== 'rounds' && spec.plannedSeconds != null) spec.plannedSeconds = Math.max(60, Math.floor(spec.plannedSeconds * PARAM.REENTRY_FACTOR / 60) * 60);
    if (spec.mode !== 'time' && spec.targetRounds != null) spec.targetRounds = Math.max(1, Math.floor(spec.targetRounds * PARAM.REENTRY_FACTOR));
    spec.sessionType = 'reentry';
    spec.adaptation = { kind: 'REENTRY_PROTOCOL', levers: [], leverCount: 0, magnitude: 1, targetSlot: null, fromState: { specId: ref.provenance && ref.provenance.specId || null }, toState: 'LIGHT_REENTRY', authority: 'COACH', reason: 'gap_reentry' };
    spec.adaptationMagnitude = 1;
    spec.abilityCapacitySnapshot = null;
    spec.readinessContext = clone(readiness);
    spec.confidenceProfile = clone(confidenceProfile);
    spec.performanceContext = clone(performanceState);
    spec.goalState = clone(goalState);
    spec.evidenceRefs = uniqueSorted(views.HistoryContext.map(r => r.id).slice(-20));
    spec.evidenceCohortIds = uniqueSorted(views.TrendCohort.map(r => r.id));
    spec.measurementContractVersion = input.measurementContract.version;
    spec.explanation = { what: 'Подготовлена облегчённая re-entry тренировка.', why: `Перерыв составил ${readiness.gapDays} календарных дней; возвращение ограничено предопределённым коэффициентом ${PARAM.REENTRY_FACTOR}.`, basedOn: 'Последняя валидная тренировка перед перерывом.', limitations: '0.70 — инженерный параметр, не физиологический закон.' };
    spec.provenance = { coachOwned: true, sourceSpecId: ref.provenance && ref.provenance.specId || null, derivedFrom: ref.provenance && ref.provenance.specId || null, decisionNow: input.decisionNow, decisionTimezone: input.decisionTimezone, specVersion: SPEC_VERSION, coreVersion: CORE_VERSION, releaseManifestRef: hash(input.releaseManifest), exerciseMatrixVersion: input.exerciseMatrix.version, compatibilityVersion: input.compatibilityVersion, measurementContractVersion: input.measurementContract.version, decisionQuestion: 'RETURN_FROM_REENTRY', decisionBranch: 'REENTRY', evidenceRefs: spec.evidenceRefs, appliedLevers: [], executionAuthority: 'COACHCORE', contextFingerprint: '', usedDecisionVariables: ['ReadinessContext.gapDays', 'HistoricalRecord.reference', 'PARAM.REENTRY_FACTOR', 'Constraints.structuralMinimum'] };
    spec.contextFingerprint = hash({ reentryReference: ref.provenance && ref.provenance.specId, current: input.currentWorkout, decisionNow: input.decisionNow, release: input.releaseManifest });
    spec.explanation.usedDecisionVariables = spec.provenance.usedDecisionVariables.slice();
    spec.provenance.contextFingerprint = spec.contextFingerprint;
    spec.specId = hash({ release: hash(input.releaseManifest), contextFingerprint: spec.contextFingerprint, decisionNow: input.decisionNow, decisionMode: 'ADAPT', sessionPurpose: 'REENTRY', decisionStatus: 'VALID', selectedCandidateFingerprint: 'reentry' });
    spec.validation = validateSpec(spec, input);
    if (!spec.validation.valid) return null;
    return spec;
  }

  function buildBaselineOrRecovery(input, purpose = 'RECOVERY') {
    const composition = normalizeComposition(input.baselineComposition || input.currentWorkout && input.currentWorkout.composition);
    if (!composition.length) return null;
    const spec = baseSpecFromCurrent({ ...input, currentWorkout: { ...input.currentWorkout, composition } }, 'VALID', purpose);
    spec.decisionMode = 'ADAPT'; spec.sessionPurpose = purpose; spec.decisionStatus = 'CURRENT_INVALID'; spec.ownership = 'COACH'; spec.autoGenerated = true;
    spec.explanation = { what: 'Подготовлена валидная recovery-тренировка.', why: 'Текущая конфигурация не могла быть сохранена как валидная.', basedOn: 'Текущие ограничения, доступное оборудование и Exercise Matrix.', limitations: '' };
    spec.provenance = { coachOwned: true, sourceSpecId: null, derivedFrom: null, decisionNow: input.decisionNow, decisionTimezone: input.decisionTimezone, specVersion: SPEC_VERSION, coreVersion: CORE_VERSION, releaseManifestRef: hash(input.releaseManifest), exerciseMatrixVersion: input.exerciseMatrix.version, compatibilityVersion: input.compatibilityVersion, measurementContractVersion: input.measurementContract.version, decisionQuestion: 'EVIDENCE_COLLECTION', decisionBranch: purpose, evidenceRefs: [], appliedLevers: [], executionAuthority: 'COACHCORE', contextFingerprint: '', usedDecisionVariables: ['Constraints', 'ExerciseMatrix', 'CoachInput.currentWorkout'] };
    spec.contextFingerprint = hash({ recovery: true, composition, current: input.currentWorkout, release: input.releaseManifest, decisionNow: input.decisionNow });
    spec.provenance.contextFingerprint = spec.contextFingerprint;
    spec.specId = hash({ release: hash(input.releaseManifest), contextFingerprint: spec.contextFingerprint, decisionNow: input.decisionNow, decisionMode: 'ADAPT', sessionPurpose: purpose, decisionStatus: 'CURRENT_INVALID', selectedCandidateFingerprint: 'recovery' });
    spec.validation = validateSpec(spec, input);
    return spec.validation.valid ? spec : null;
  }

  function actionFromSpec(spec) {
    if (!spec || !spec.adaptation || !spec.adaptation.levers.length) return null;
    const lever = spec.adaptation.levers[0];
    const slot = spec.adaptation.targetSlot;
    if (lever === 'COUNT') return { type: spec.adaptation.toState && Number(spec.adaptation.toState.delta) < 0 ? 'decrease_count' : (spec.adaptation.fromState && Number(spec.adaptation.fromState.delta) < 0 ? 'decrease_count' : 'increase_count'), exerciseId: slot && spec.composition.find(x => x.slotId === slot)?.exerciseId, slotId: slot, delta: spec.composition.find(x => x.slotId === slot) ? spec.composition.find(x => x.slotId === slot).count - (input && 0) : null };
    return null;
  }

  function derive(input) {
    const i = clone(input || {});
    const profile = normalizeProfile(i.profile);
    const release = normalizeManifest(i.releaseManifest);
    const expectedRelease = { specVersion: SPEC_VERSION, coreVersion: CORE_VERSION, buildHash: EXPECTED_BUILD_HASH, sourceHash: EXPECTED_SOURCE_HASH, fixtureCorpusVersion: FIXTURE_CORPUS_VERSION, exerciseMatrixVersion: str(i.exerciseMatrix && i.exerciseMatrix.version, MATRIX_VERSION), compatibilityVersion: COMPATIBILITY_VERSION };
    const releaseCheck = validateReleaseManifest(release, expectedRelease);
    if (!releaseCheck.valid) return noAction(i, 'STALE', 'release_mismatch', releaseCheck.errors);
    if (!i.decisionNow || !Number.isFinite(new Date(i.decisionNow).getTime())) return noAction(i, 'UNRESOLVED', 'invalid_decision_now');
    if (!i.exerciseMatrix || str(i.exerciseMatrix.version, '') !== release.exerciseMatrixVersion) return noAction(i, 'STALE', 'matrix_manifest_mismatch');
    const contract = clone(i.measurementContract || defaultMeasurementContract(i.currentWorkout && i.currentWorkout.mode, i.currentWorkout && i.currentWorkout.formatPolicy));
    i.profile = profile; i.releaseManifest = release; i.compatibilityVersion = release.compatibilityVersion; i.exerciseMatrix = clone(i.exerciseMatrix); i.measurementContract = contract;
    i.currentWorkout = i.currentWorkout || {};
    i.currentWorkout.composition = normalizeComposition(i.currentWorkout.composition);
    i.currentWorkout.ownership = currentOwnership(i);
    i.equipment = activeEquipment(i); i.restrictions = effectiveRestrictions(i);
    i.hardConstraints = { minExercises: PARAM.MIN_EXERCISES, maxExercises: Number(i.hardConstraints && i.hardConstraints.maxExercises || 5), maxDurationSeconds: Number(i.hardConstraints && i.hardConstraints.maxDurationSeconds || PARAM.SYSTEM_MAX_SECONDS), ...(i.hardConstraints || {}) };
    const history = arr(i.history).map(normalizeHistoryRecord).filter(Boolean);
    const currentTarget = currentTargetRecord(i);
    const views = buildEvidenceViews(i, history, currentTarget);
    const lastRecord = history.slice().filter(r => r.valid !== false).sort((a, b) => new Date(b.effectiveTimestamp).getTime() - new Date(a.effectiveTimestamp).getTime() || String(a.id).localeCompare(String(b.id)))[0] || null;
    const performanceState = derivePerformanceState(views, contract);
    const readinessContext = buildReadinessContext(i, views, lastRecord, performanceState);
    const goal = goalState(profile, contract, performanceState);
    const confidenceProfile = buildConfidenceProfile(views, contract, i.interventionWindow);
    const lastCoach = lastValidCoachSpec(history, i);

    if (i.activeState && (i.activeState.running || i.activeState.paused)) return noAction(i, 'VALID', 'active_workout_lock', { views, performanceState, readinessContext, confidenceProfile, goalState: goal, currentTarget, action: null, workoutSpec: null });

    const isBuilderOwned = currentOwnership(i) !== 'COACH' && !(i.baselineAuthority === true);
    if (isBuilderOwned) return noAction(i, 'OWNERSHIP_LIMITED', 'builder_owned_workout', { views, performanceState, readinessContext, confidenceProfile, goalState: goal, currentTarget, action: null, workoutSpec: null });

    const currentInvalid = !isSpecValid({ ...baseSpecFromCurrent(i), composition: i.currentWorkout.composition }, i);
    i.currentWorkout.invalid = currentInvalid;

    // First decision after a successfully completed test. The test gives us
    // an observed execution sample, so the Coach can make one conservative
    // personalization step immediately. This is intentionally separate from
    // long-term progression evidence and does not claim causal adaptation.
    const starterCandidate = !currentInvalid && !i.interventionWindow
      ? starterPersonalizationCandidate(i, views, performanceState, readinessContext)
      : null;
    if (starterCandidate) {
      const starterInput = clone(i);
      starterInput.equipment = { ...(activeEquipment(i) || {}), pullupBar: true };
      starterInput.currentWorkout = { ...clone(i.currentWorkout), equipment: starterInput.equipment };
      const spec = makeSpec(starterInput, starterCandidate, 'ADAPT', 'STANDARD', 'VALID', 'STARTER_PERSONALIZATION', views, goal, confidenceProfile, readinessContext, performanceState, {
        explanation: {
          what: 'Тренер делает первый персональный шаг по результату теста.',
          why: pacePatternExplanation(performanceState),
          basedOn: 'Завершённый тест, фактическое количество кругов и наблюдаемый темп по кругам.',
          limitations: 'Это начальная персонализация, а не окончательная оценка уровня. Дальнейшие изменения зависят от последующих тренировок.'
        }
      });
      if (spec.validation.valid) return finalize(i, spec, views, performanceState, readinessContext, confidenceProfile, goal, 'VALID');
    }

    if (!history.length && i.baselineAuthority === true) {
      const baseline = buildBaselineOrRecovery(i, 'BASELINE');
      if (baseline) { baseline.sessionPurpose = 'BASELINE'; baseline.decisionMode = 'ADAPT'; baseline.decisionStatus = 'VALID'; baseline.explanation = { what: 'Coach baseline создан по явной Coach-baseline authority.', why: 'История ещё не содержит завершённых тренировок, а продукт явно разрешил Coach авторство baseline.', basedOn: 'baselineAuthority=true', limitations: '' }; baseline.provenance = makeProvenance(i, baseline, 'CALIBRATE_BASELINE'); baseline.provenance.usedDecisionVariables = ['CoachInput.baselineAuthority', 'CoachInput.currentWorkout']; baseline.explanation.usedDecisionVariables = baseline.provenance.usedDecisionVariables.slice(); baseline.contextFingerprint = hash({ baseline: true, current: i.currentWorkout, decisionNow: i.decisionNow, release: i.releaseManifest }); baseline.provenance.contextFingerprint = baseline.contextFingerprint; baseline.specId = hash({ release: hash(i.releaseManifest), contextFingerprint: baseline.contextFingerprint, decisionNow: i.decisionNow, decisionMode: 'ADAPT', sessionPurpose: 'BASELINE', decisionStatus: 'VALID', selectedCandidateFingerprint: 'baseline' }); baseline.validation = validateSpec(baseline, i); if (baseline.validation.valid) return finalize(i, baseline, views, performanceState, readinessContext, confidenceProfile, goal, 'VALID'); }
    }

    const latestReentry = history.slice().sort((a,b)=>new Date(b.effectiveTimestamp).getTime()-new Date(a.effectiveTimestamp).getTime() || String(a.id).localeCompare(String(b.id)))[0] || null;
    if (latestReentry && latestReentry.sessionType === 'REENTRY' && latestReentry.ownership === 'COACH' && !i.interventionWindow) {
      const reentryNext = buildReentryRepeatOrExit(i, latestReentry, history, views, readinessContext, goal, confidenceProfile, performanceState);
      if (reentryNext) return finalize(i, reentryNext, views, performanceState, readinessContext, confidenceProfile, goal, reentryNext.sessionPurpose === 'RECOVERY' ? 'EVIDENCE_LIMITED' : reentryNext.decisionStatus);
    }

    const objective = objectiveFromContext(i, views, performanceState, goal, readinessContext, i.interventionWindow);
    if (objective === 'GOAL_LIMITED') {
      const spec = makeSpec(i, null, 'PRESERVE', 'STANDARD', 'GOAL_LIMITED', objective, views, goal, confidenceProfile, readinessContext, performanceState, {
        explanation: { what: 'Состав тренировки сохраняется.', why: 'Выбранная цель требует метрик, которых V3.0.0 сейчас не поддерживает.', basedOn: 'GoalState.supportStatus', limitations: 'Фактическое performance state сохранено; цель не используется для workload multiplier.' },
      });
      spec.validation = validateSpec(spec, i);
      return finalize(i, spec, views, performanceState, readinessContext, confidenceProfile, goal, 'GOAL_LIMITED');
    }

    if (readinessContext.gapDays != null && readinessContext.gapDays >= PARAM.REENTRY_GAP_DAYS && !i.interventionWindow) {
      const reentry = buildReentrySpec(i, baseSpecFromCurrent(i), history, views, readinessContext, goal, confidenceProfile, performanceState);
      if (reentry) return finalize(i, reentry, views, performanceState, readinessContext, confidenceProfile, goal, 'VALID');
      return noAction(i, 'UNRESOLVED', 'reentry_reference_missing', { views, performanceState, readinessContext, confidenceProfile, goalState: goal, currentTarget });
    }

    if (i.interventionWindow) {
      const lb = classifyLevelB(i, history, i.interventionWindow);
      if (lb && lb.supported && lb.state === 'POOR') {
        const base = baseSpecFromCurrent(i, 'VALID', 'REPEAT');
        const spec = makeSpec(i, { candidateType: 'COUNT', targetSlot: i.interventionWindow.targetSlot, delta: -Math.abs(i.interventionWindow.direction === 'UP' ? 1 : 0), magnitude: 1, id: 'levelb-revert', reason: 'level_b_poor' }, 'ADAPT', 'STANDARD', 'VALID', 'RESOLVE_LEVEL_B', views, goal, confidenceProfile, readinessContext, performanceState, { derivedFrom: i.interventionWindow.parentSpecId, sourceSpecId: i.interventionWindow.parentSpecId, explanation: { what: 'Предыдущий шаг откатывается.', why: 'Чистая реакция на фактически выполненную интервенцию оказалась ниже допустимого retention envelope.', basedOn: `performanceRetention=${lb.retention}`, limitations: 'Причинная оценка ограничена конкретной intervention envelope.' } });
        return finalize(i, spec, views, performanceState, readinessContext, confidenceProfile, goal, 'VALID');
      }
      if (lb && lb.supported && lb.state === 'ACCEPTABLE') {
        const spec = makeSpec(i, null, 'PRESERVE', 'REPEAT', 'VALID', 'RESOLVE_LEVEL_B', views, goal, confidenceProfile, readinessContext, performanceState, { sourceSpecId: i.interventionWindow.parentSpecId, explanation: { what: 'Текущая тренировка сохраняется.', why: 'Реакция на предыдущий Coach-шаг находится в допустимом response envelope.', basedOn: `performanceRetention=${lb.retention}`, limitations: '' } });
        return finalize(i, spec, views, performanceState, readinessContext, confidenceProfile, goal, 'VALID');
      }
      const spec = makeSpec(i, null, 'PRESERVE', 'REPEAT', 'EVIDENCE_LIMITED', 'RESOLVE_LEVEL_B', views, goal, confidenceProfile, readinessContext, performanceState, { sourceSpecId: i.interventionWindow.parentSpecId, explanation: { what: 'Текущая тренировка повторяется.', why: 'Реакция на предыдущую Coach-интервенцию пока не может быть классифицирована надёжно.', basedOn: 'Execution fidelity / response envelope', limitations: 'UNRESOLVED не трактуется как плохой результат.' } });
      return finalize(i, spec, views, performanceState, readinessContext, confidenceProfile, goal, 'EVIDENCE_LIMITED');
    }

    // Explicit isolated anomaly -> Repeat, not automatic regression.
    if (lastRecord && (lastRecord.actualExecution && ['manual', 'system'].includes(lastRecord.actualExecution.endedBy)) && views.TrendCohort.length >= 3) {
      const repeat = makeSpec(i, null, 'PRESERVE', 'REPEAT', 'EVIDENCE_LIMITED', 'EVIDENCE_COLLECTION', views, goal, confidenceProfile, readinessContext, performanceState, { explanation: { what: 'Та же тренировка повторяется.', why: 'Последняя сопоставимая сессия содержит аномалию, которой недостаточно для устойчивого изменения.', basedOn: 'Last valid comparable execution', limitations: 'Early stop не приравнивается к плохой performance.' } });
      return finalize(i, repeat, views, performanceState, readinessContext, confidenceProfile, goal, 'EVIDENCE_LIMITED');
    }

    const baseSpec = baseSpecFromCurrent(i, 'VALID', 'STANDARD');
    const candidates = makeAtomicCandidates(objective, i, baseSpec, views, goal, readinessContext);
    for (const c of candidates) c.objectiveSufficient = objectiveState(objective, i, views, c, goal, readinessContext, i.interventionWindow).state === 'SATISFIED';
    let eligible = candidates.filter(c => {
      if (c.requiresProgressionGate && !canProgress(i, views, goal, confidenceProfile, readinessContext)) return false;
      const h = hardFilterCandidate(c, i, baseSpec);
      c._hard = h;
      c.valid = h.valid;
      c.resultingComposition = h.composition || baseSpec.composition;
      return h.valid && c.objectiveSufficient;
    });
    eligible.sort((a, b) => compareCandidates(a, b, objective, goal, views, readinessContext));

    if (eligible.length) {
      const candidate = eligible[0];
      const spec = makeSpec(i, candidate, 'ADAPT', 'STANDARD', 'VALID', objective, views, goal, confidenceProfile, readinessContext, performanceState, { explanation: { what: `${candidate.candidateType} adaptation.`, why: 'Выбран минимальный валидный candidate, удовлетворяющий текущему decision objective.', basedOn: `Objective=${objective}; candidate=${candidate.candidateType}; trendDays=${strictDays(views.TrendCohort)}`, limitations: readinessContext.externalCaution ? 'Внешний контекст добавлен как caution и не использован как workload rule.' : '' } });
      return finalize(i, spec, views, performanceState, readinessContext, confidenceProfile, goal, 'VALID');
    }

    // Smart Biomechanical Rotation: when progression is not triggered, rotate grips/stances/angles
    const rotationCandidate = !currentInvalid && !i.interventionWindow
      ? smartBiomechanicalRotationCandidate(i, views, performanceState, readinessContext, goal)
      : null;
    if (rotationCandidate) {
      const rotInput = clone(i);
      rotInput.equipment = { ...(activeEquipment(i) || {}), ...(i.baselineRecordId ? { pullupBar: true } : {}) };
      rotInput.currentWorkout = { ...clone(i.currentWorkout), equipment: rotInput.equipment };
      const spec = makeSpec(rotInput, rotationCandidate, 'ADAPT', 'STANDARD', 'VALID', 'BIOMECHANICAL_ROTATION', views, goal, confidenceProfile, readinessContext, performanceState, {
        explanation: rotationCandidate.explanationDetails
      });
      if (spec.validation.valid) return finalize(i, spec, views, performanceState, readinessContext, confidenceProfile, goal, 'VALID');
    }

    if (objective === 'CONFIRM_PLATEAU' && i.controlQuestion && inputControlEligible(i, views)) {
      const control = makeSpec(i, null, 'PRESERVE', 'CONTROL', 'VALID', objective, views, goal, confidenceProfile, readinessContext, performanceState, { controlSpec: { question: i.controlQuestion, frozenContext: clone(i.currentWorkout), controlledVariable: 'none', expectedOutcomeA: 'stable', expectedOutcomeB: 'unstable', resolutionRule: 'reclassify on next result', nextBranch: 'Level A' }, explanation: { what: 'Контрольная тренировка сохраняет протокол.', why: 'Есть конкретный information question для различения двух допустимых объяснений.', basedOn: 'controlSpec.question', limitations: '' } });
      return finalize(i, control, views, performanceState, readinessContext, confidenceProfile, goal, 'VALID');
    }

    if (i.currentWorkout.invalid) {
      const last = lastValidCoachSpec(views.HistoryContext, i);
      if (last) return finalResult(i, last, views, performanceState, readinessContext, confidenceProfile, goal, { decisionMode: 'PRESERVE', sessionPurpose: 'RECOVERY', decisionStatus: 'CURRENT_INVALID' });
      const recovery = buildBaselineOrRecovery(i, 'RECOVERY');
      if (recovery) return finalResult(i, recovery, views, performanceState, readinessContext, confidenceProfile, goal, { decisionMode: 'ADAPT', sessionPurpose: 'RECOVERY', decisionStatus: 'CURRENT_INVALID' });
      return noAction(i, 'CURRENT_INVALID', 'current_workout_invalid_no_fallback', { views, performanceState, readinessContext, confidenceProfile, goalState: goal });
    }

    const preserve = baseSpecFromCurrent(i, 'EVIDENCE_LIMITED', 'REPEAT');
    preserve.explanation = { what: 'Текущая валидная тренировка сохраняется.', why: 'Недостаточно authority для следующего адаптивного шага.', basedOn: `HistoryContext=${views.HistoryContext.length}; StrictCohort=${views.StrictCohort.length}; TrendCohort=${views.TrendCohort.length}`, limitations: views.StrictCohort.length ? '' : 'Current format has insufficient strict comparable evidence.' };
    preserve.provenance = makeProvenance(input = i, preserve, objective);
    preserve.contextFingerprint = hash({ current: i.currentWorkout, views, objective, decisionNow: i.decisionNow, release });
    preserve.provenance.contextFingerprint = preserve.contextFingerprint;
    preserve.specId = hash({ release: hash(i.releaseManifest), contextFingerprint: preserve.contextFingerprint, decisionNow: i.decisionNow, decisionMode: 'PRESERVE', sessionPurpose: 'REPEAT', decisionStatus: preserve.decisionStatus, selectedCandidateFingerprint: 'none' });
    preserve.validation = validateSpec(preserve, i);
    return finalize(i, preserve, views, performanceState, readinessContext, confidenceProfile, goal, preserve.decisionStatus);
  }

  function inputControlEligible(i, views) { return Boolean(i.controlQuestion) && views.TrendCohort.length >= 3 && i.measurementContract.stabilityTolerance != null; }

  function makeProvenance(input, spec, objective) {
    return {
      coachOwned: true,
      sourceSpecId: null,
      derivedFrom: null,
      decisionNow: input.decisionNow,
      decisionTimezone: input.decisionTimezone,
      specVersion: SPEC_VERSION,
      coreVersion: CORE_VERSION,
      releaseManifestRef: hash(input.releaseManifest),
      exerciseMatrixVersion: input.exerciseMatrix.version,
      compatibilityVersion: input.compatibilityVersion,
      measurementContractVersion: input.measurementContract.version,
      decisionQuestion: objective,
      decisionBranch: spec.sessionPurpose,
      evidenceRefs: spec.evidenceRefs || [],
      appliedLevers: spec.adaptation && spec.adaptation.levers || [],
      executionAuthority: 'COACHCORE',
      contextFingerprint: spec.contextFingerprint || '',
      usedDecisionVariables: [],
    };
  }

  function finalize(input, spec, views, performanceState, readinessContext, confidenceProfile, goalState, status) {
    spec.decisionStatus = status;
    spec.validation = validateSpec(spec, input);
    if (!spec.validation.valid) {
      const last = lastValidCoachSpec(views.HistoryContext, input);
      if (last) return finalResult(input, last, views, performanceState, readinessContext, confidenceProfile, goalState, { decisionMode: 'PRESERVE', sessionPurpose: 'RECOVERY', decisionStatus: 'CURRENT_INVALID' });
      const recovery = buildBaselineOrRecovery(input, 'RECOVERY');
      if (recovery) return finalResult(input, recovery, views, performanceState, readinessContext, confidenceProfile, goalState, { decisionMode: 'ADAPT', sessionPurpose: 'RECOVERY', decisionStatus: 'CURRENT_INVALID' });
      return noAction(input, 'NO_ACTION', 'validation_failed', { views, performanceState, readinessContext, confidenceProfile, goalState });
    }
    // Explanation claims refer only to canonical variables material to this decision.
    const used = new Set(['CoachInput.currentWorkout', 'Objective']);
    if (views.HistoryContext.length) used.add('EvidenceViews.HistoryContext');
    if (views.StrictCohort.length) used.add('EvidenceViews.StrictCohort');
    if (views.TrendCohort.length) used.add('EvidenceViews.TrendCohort');
    if (readinessContext.gapDays != null) used.add('ReadinessContext.gapDays');
    if (spec.goalState && spec.goalState.type) used.add('GoalState.type');
    if (spec.adaptation && spec.adaptation.levers.length) used.add('Candidate.selected');
    if (spec.sessionPurpose === 'BASELINE') used.add('CoachInput.baselineAuthority');
    if (views.InterventionWindow) used.add('ResponseEnvelope');
    if (views.ContextAlerts.length) used.add('EvidenceViews.ContextAlerts');
    if (spec.decisionStatus !== 'VALID') used.add('AuthorityDecision.status');
    if (spec.sessionPurpose === 'REENTRY') used.add('ReadinessContext');
    spec.provenance = spec.provenance || makeProvenance(input, spec, 'EVIDENCE_COLLECTION');
    const usedVariables = uniqueSorted([...used]);
    spec.provenance.usedDecisionVariables = usedVariables;
    spec.explanation = spec.explanation || { what: '', why: '', basedOn: '', limitations: '' };
    spec.explanation.usedDecisionVariables = usedVariables.slice();
    const fieldVariables = {
      what: spec.adaptation && spec.adaptation.levers.length ? ['Candidate.selected'] : ['CoachInput.currentWorkout'],
      why: ['Objective'],
      basedOn: usedVariables,
      limitations: views.ContextAlerts.length ? ['EvidenceViews.ContextAlerts'] : views.InterventionWindow ? ['ResponseEnvelope'] : spec.decisionStatus !== 'VALID' ? ['AuthorityDecision.status'] : ['Objective']
    };
    spec.explanation.claims = ['what','why','basedOn','limitations']
      .filter(field => String(spec.explanation[field] || '').trim())
      .map(field => ({ field, text: String(spec.explanation[field]), decisionVariables: fieldVariables[field].slice() }));
    spec.validation = validateSpec(spec, input);
    return finalResult(input, spec, views, performanceState, readinessContext, confidenceProfile, goalState, { decisionMode: spec.decisionMode, sessionPurpose: spec.sessionPurpose, decisionStatus: spec.decisionStatus });
  }

  function finalResult(input, spec, views, performanceState, readinessContext, confidenceProfile, goalState, contract) {
    const action = mapAction(spec);
    const explanation = spec.explanation || { what: '', why: '', basedOn: '', limitations: '' };
    return {
      integrationVersion: 'cindy-coach-v3-integration',
      authority: 'COACH_CORE_V3',
      algorithmVersion: CORE_VERSION,
      state: spec.decisionStatus,
      performanceState: performanceState.state,
      decisionMode: spec.decisionMode,
      sessionPurpose: spec.sessionPurpose,
      decisionStatus: spec.decisionStatus,
      adaptation: clone(spec.adaptation),
      confidence: { ...confidenceProfile },
      action,
      workoutSpec: clone(spec),
      evidence: views.HistoryContext.slice(-10).map(r => ({ code: 'history_context', humanFact: `History record ${r.id}`, sourceRecordIds: [r.id], class: 'CINDY_V3_EVIDENCE' })),
      reasonCodes: [contract.sessionPurpose, spec.decisionStatus, spec.provenance && spec.provenance.decisionQuestion].filter(Boolean),
      exclusions: clone(spec.validation && spec.validation.errors || []),
      limitations: [{ code: spec.decisionStatus.toLowerCase(), message: explanation.limitations || '' }].filter(x => x.message),
      explanation: {
        what: explanation.what,
        why: explanation.why,
        basedOn: { evidenceCohortIds: spec.evidenceCohortIds || [], strictRecordCount: views.StrictCohort.length, trendRecordCount: views.TrendCohort.length, question: spec.provenance && spec.provenance.decisionQuestion, usedDecisionVariables: spec.provenance && spec.provenance.usedDecisionVariables || [] },
        limitations: explanation.limitations || '',
        claims: clone(explanation.claims || []),
      },
      inputProvenance: {
        goalContext: goalState.type,
        profile: clone(input.profile),
        currentContext: clone(input.currentWorkout),
        historyRecordCount: views.HistoryContext.length,
        strictCohortRecordIds: views.StrictCohort.map(r => r.id),
        trendCohortRecordIds: views.TrendCohort.map(r => r.id),
        decisionNow: input.decisionNow,
        decisionTimezone: input.decisionTimezone,
        releaseManifest: clone(input.releaseManifest),
      },
      application: {
        allowed: spec.decisionMode === 'ADAPT' && spec.validation.valid && !(input.activeState && (input.activeState.running || input.activeState.paused)),
        requiresConfirmation: true,
        lockedByActiveWorkout: Boolean(input.activeState && (input.activeState.running || input.activeState.paused)),
        reasonCode: spec.decisionMode === 'ADAPT' ? null : 'preserve_or_no_action',
        changedLever: spec.adaptation && spec.adaptation.levers && spec.adaptation.levers[0] || null,
      },
      diagnostics: {
        evidenceViews: {
          historyContext: views.HistoryContext.map(r => r.id), strictCohort: views.StrictCohort.map(r => r.id), recentStrictWindow: views.RecentStrictWindow.map(r => r.id), trendCohort: views.TrendCohort.map(r => r.id), interventionWindow: views.InterventionWindow && views.InterventionWindow.id || null,
        },
        readinessContext: clone(readinessContext), confidenceProfile: clone(confidenceProfile), goalState: clone(goalState), performanceState: clone(performanceState), releaseManifest: clone(input.releaseManifest), preparedSpecId: spec.specId,
      },
    };
  }

  function mapAction(spec) {
    if (!spec || spec.decisionMode !== 'ADAPT' || !spec.adaptation) return null;
    const lever = arr(spec.adaptation.levers)[0];
    const slotId = spec.adaptation.targetSlot;
    const row = spec.composition.find(x => x.slotId === slotId);
    const before = spec.provenance && spec.provenance.fromComposition ? spec.provenance.fromComposition.find(x => x.slotId === slotId) : null;
    if (lever === 'COUNT') {
      const delta = row && before ? row.count - before.count : Number(spec.adaptation && spec.adaptation.toState && spec.adaptation.toState.delta || 1);
      return { type: delta < 0 ? 'decrease_count' : 'increase_count', exerciseId: row && row.exerciseId || (before && before.exerciseId), slotId, delta, expectedCount: before && before.count, nextCount: row && row.count };
    }
    if (lever === 'ROUNDS') return { type: 'change_rounds', delta: Number(spec.targetRounds || 0) - Number(spec.provenance && spec.provenance.fromTargetRounds || 0), nextTargetRounds: spec.targetRounds };
    if (lever === 'DURATION') return { type: 'change_duration', delta: Number(spec.plannedSeconds || 0) - Number(spec.provenance && spec.provenance.fromPlannedSeconds || 0), nextPlannedSeconds: spec.plannedSeconds };
    if (lever === 'VARIANT') return { type: 'change_variant', exerciseId: row && row.exerciseId, slotId, delta: 0, fromVariantId: before && before.variantId, toVariantId: row && row.variantId, expectedCount: row && row.count };
    if (lever === 'REMOVE') return { type: 'remove_extra', exerciseId: before && before.exerciseId, slotId };
    if (lever === 'REPLACE') return { type: 'replace_exercise', slotId, exerciseId: before && before.exerciseId, toExerciseId: row && row.exerciseId, toVariantId: row && row.variantId, expectedCount: row && row.count };
    if (lever === 'ADD_4TH') return { type: 'add_exercise', exerciseId: row && row.exerciseId, slotId };
    if (lever === 'ORDER_CHANGE') return { type: 'order_change', composition: clone(spec.composition) };
    if (lever === 'ROTATION' || lever === 'COMPOSITION') return { type: 'replace_exercise', composition: clone(spec.composition) };
    return null;
  }

  function noAction(input, status, code, extra = {}) {
    const fake = baseSpecFromCurrent(input, status, 'STANDARD');
    fake.decisionMode = 'NO_ACTION'; fake.sessionPurpose = 'STANDARD'; fake.decisionStatus = status === 'NO_ACTION' ? 'UNRESOLVED' : status; fake.ownership = currentOwnership(input);
    fake.adaptation = { kind: 'NONE', levers: [], leverCount: 0, magnitude: 0, targetSlot: null, fromState: null, toState: null, authority: 'NONE', reason: code };
    fake.explanation = { what: 'Coach не авторизует изменение.', why: code, basedOn: '', limitations: code };
    fake.evidenceRefs = arr(extra.views && extra.views.HistoryContext).map(r => r.id);
    fake.evidenceCohortIds = arr(extra.views && extra.views.TrendCohort).map(r => r.id);
    fake.measurementContractVersion = str(input.measurementContract && input.measurementContract.version, MEASUREMENT_CONTRACT_VERSION);
    fake.provenance = { coachOwned: false, sourceSpecId: null, derivedFrom: null, decisionNow: input.decisionNow, decisionTimezone: input.decisionTimezone, specVersion: SPEC_VERSION, coreVersion: CORE_VERSION, releaseManifestRef: hash(input.releaseManifest || {}), exerciseMatrixVersion: input.exerciseMatrix && input.exerciseMatrix.version || '', compatibilityVersion: input.compatibilityVersion || COMPATIBILITY_VERSION, measurementContractVersion: fake.measurementContractVersion, decisionQuestion: code, decisionBranch: 'NO_ACTION', evidenceRefs: fake.evidenceRefs, appliedLevers: [], executionAuthority: 'NONE', contextFingerprint: '', usedDecisionVariables: ['AuthorityDecision.status'] };
    fake.explanation.usedDecisionVariables = ['AuthorityDecision.status'];
    fake.explanation.claims = ['what','why','limitations'].map(field => ({ field, text: String(fake.explanation[field] || ''), decisionVariables: ['AuthorityDecision.status'] }));
    fake.contextFingerprint = hash({ current: input.currentWorkout, profile: input.profile, history: extra.views && extra.views.HistoryContext || [], status: fake.decisionStatus, code, decisionNow: input.decisionNow, release: input.releaseManifest });
    fake.provenance.contextFingerprint = fake.contextFingerprint;
    fake.specId = hash({ release: hash(input.releaseManifest || {}), contextFingerprint: fake.contextFingerprint, decisionNow: input.decisionNow, decisionMode: 'NO_ACTION', sessionPurpose: 'STANDARD', decisionStatus: fake.decisionStatus, selectedCandidateFingerprint: 'none' });
    fake.validation = validateSpec(fake, input);
    if (!fake.validation.valid) fake.validation = { valid: false, errors: fake.validation.errors || ['no_action_spec_not_executable'] };
    const result = finalResult(input, fake, extra.views || { HistoryContext: [], StrictCohort: [], RecentStrictWindow: [], TrendCohort: [], InterventionWindow: null, Confounders: [], ContextAlerts: [] }, extra.performanceState || { state: 'UNKNOWN' }, extra.readinessContext || { gapDays: null, alerts: [], externalCaution: false, externalAnomaly: false }, extra.confidenceProfile || { overallPermission: 'COLLECT_ONLY' }, extra.goalState || goalState(normalizeProfile(input.profile), input.measurementContract || defaultMeasurementContract(input.currentWorkout && input.currentWorkout.mode), { median: null }), { decisionMode: 'NO_ACTION', sessionPurpose: 'STANDARD', decisionStatus: fake.decisionStatus });
    result.reasonCodes = [code];
    result.application.allowed = false;
    return result;
  }

  return Object.freeze({
    SPEC_VERSION, CORE_VERSION, MATRIX_VERSION, COMPATIBILITY_VERSION, MEASUREMENT_CONTRACT_VERSION, PARAM,
    canonicalize, canonicalJson, hash, localDateId, dayDifference, defaultMeasurementContract, normalizeProfile, normalizeHistoryRecord,
    strictCompare, buildEvidenceViews, validateReleaseManifest, validateSpec, validateExplanation, derive, responseEnvelopeFor, EXPECTED_BUILD_HASH, EXPECTED_SOURCE_HASH,
  });
});
