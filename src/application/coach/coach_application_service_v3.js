(() => {
  'use strict';

  const clone = value => {
    if (value == null) return value;
    if (typeof structuredClone === 'function') {
      try { return structuredClone(value); } catch (_) {}
    }
    return JSON.parse(JSON.stringify(value));
  };

  const BASELINE_TEST_PROTOCOL = Object.freeze({
    version: 'cindy-baseline-test-v2',
    mode: 'time',
    defaultMinutes: 10,
    allowedMinutes: Object.freeze([5, 10, 20]),
    target: 0,
    targetRounds: null,
    paceGuidance: false,
    composition: Object.freeze([
      Object.freeze({ id: 'pull', count: 5 }),
      Object.freeze({ id: 'push', count: 10 }),
      Object.freeze({ id: 'squat', count: 15 })
    ])
  });

  // The normative Coach specification declares trainingExperience but does not
  // define any accepted values. Do not infer an enum from UI labels or fixtures.
  const TRAINING_EXPERIENCE_VALUES = Object.freeze([]);
  const normalizeTrainingExperience = value => {
    const candidate = typeof value === 'string' ? value.trim() : '';
    return TRAINING_EXPERIENCE_VALUES.includes(candidate) ? candidate : '';
  };

  const create = ({
    core,
    stateRepository,
    configPort,
    sessionPort,
    historyPort,
    contextPort,
    matrixPort,
    externalContextPort,
    activityPort,
    clockPort,
    renderPort,
    baselineAuthorityPort,
    workoutHistoryService,
    enabledPort,
    integrityPort,
    releaseManifest
  } = {}) => {
    const required = {
      core, stateRepository, configPort, sessionPort, historyPort, contextPort,
      matrixPort, externalContextPort, activityPort, clockPort, enabledPort,
      renderPort, baselineAuthorityPort, workoutHistoryService, integrityPort, releaseManifest
    };
    Object.entries(required).forEach(([name, value]) => {
      if (!value) throw new TypeError(`CoachApplicationService missing port: ${name}`);
    });

    let state = stateRepository.load();
    let lastDerived = null;
    const isEnabled = () => { try { return enabledPort() === true; } catch (_) { return false; } };

    const hash = value => core.hash(value);
    const semanticHash = value => integrityPort.sha256(integrityPort.canonicalJson(value));
    const canonical = value => core.canonicalize(value);

    const runtimeCompositionFromSpec = composition => (Array.isArray(composition) ? composition : []).map((slot, index) => {
      const exerciseId = String(slot && ((slot.exerciseId != null && slot.exerciseId !== '') ? slot.exerciseId : slot.id) || '');
      const item = { id: exerciseId, count: Number(slot && slot.count || 0) };
      if (slot && slot.variantId != null && String(slot.variantId) !== '') item.variantId = String(slot.variantId);
      return item;
    });

    const readState = () => isEnabled() ? clone(state) : null;
    const persistState = (allowDisabled = false) => !isEnabled() && !allowDisabled ? false : stateRepository.save(state);

    const relevantConfigSnapshot = () => canonical(configPort.relevantSnapshot());
    const configFingerprint = () => hash(relevantConfigSnapshot());

    const baselineAuthorized = () =>
      Boolean(state.baselineAuthority || baselineAuthorityPort.isAuthorized());

    const clearLegacyBaselineAuthority = () => {
      baselineAuthorityPort.clear();
    };

    const baselineTestMinutes = () => {
      const value = Number(state.baselineTestMinutes);
      return BASELINE_TEST_PROTOCOL.allowedMinutes.includes(value) ? value : BASELINE_TEST_PROTOCOL.defaultMinutes;
    };

    const evidenceAfterBaseline = () => {
      const baselineRecordId = state.baselineRecordId;
      const baselineAt = Date.parse(state.baselineCompletedAt || '');
      const decisionAt = Date.parse(clockPort.now());
      if (!baselineRecordId || !Number.isFinite(baselineAt)) return [];
      return historyPort.records().filter(record => {
        if (!record || record.valid === false || (record.v3 && (record.v3.valid === false || record.v3.historyMutation)) || record.id === baselineRecordId || Number(record.rounds || 0) < 1) return false;
        const completedAt = Date.parse(record.completedAt || '');
        return Number.isFinite(completedAt) && completedAt > baselineAt && (!Number.isFinite(decisionAt) || completedAt <= decisionAt);
      });
    };

    const currentOwnership = () => {
      const fp = configFingerprint();
      if (state.ownership === 'COACH' && state.appliedConfigFingerprint === fp) return 'COACH';
      if (state.ownership === 'COACH' && !state.appliedConfigFingerprint) return 'COACH';
      if (baselineAuthorityPort.isAuthorized()) return 'COACH';
      return 'BUILDER';
    };

    const markBuilderOwned = () => {
      state = {
        version: state.version || 1,
        ownership: 'BUILDER',
        baselineAuthority: false,
        baselineCompletedAt: state.baselineCompletedAt || null,
        baselineRecordId: state.baselineRecordId || null,
        baselineTestMinutes: state.baselineTestMinutes || null,
        starterApplied: Boolean(state.starterApplied),
        preparedSpec: null,
        preparedFingerprint: null,
        appliedConfigFingerprint: null,
        pendingIntervention: null
      };
      persistState();
    };

    const markCoachOwned = (spec, sourceConfig) => {
      state.ownership = 'COACH';
      state.appliedConfigFingerprint = hash(sourceConfig || relevantConfigSnapshot());
      state.preparedSpec = clone(spec || null);
      state.preparedFingerprint = spec && spec.contextFingerprint || null;
      state.baselineAuthority = false;
      persistState();
    };

    const mapMatrix = () => {
      const matrix = matrixPort.get() || { version: core.MATRIX_VERSION, variants: {}, baseDefaults: {} };
      const variants = {};
      Object.keys(matrix.variants || {}).forEach(id => {
        const v = matrix.variants[id] || {};
        variants[id] = {
          ...clone(v),
          id,
          base: v.base || id,
          semanticCompatibilityClass: `${v.base || 'unknown'}:${v.id || id}`,
          progressionNeighbors: Array.isArray(v.neighbors) ? v.neighbors.slice() : [],
          regressionNeighbors: Array.isArray(v.neighbors) ? v.neighbors.slice() : [],
          substitutionGroups: [v.base || id],
          coachEligibility: v.auto !== false && !v.manualOnly,
          exposureTags: Object.keys(v.profile || {}),
          comparabilitySensitivity: ['pull', 'push'].includes(v.base) ? ['BODYWEIGHT'] : []
        };
      });
      const exercises = {};
      Object.keys(matrix.baseDefaults || {}).forEach(base => {
        const variant = variants[matrix.baseDefaults[base]];
        exercises[base] = {
          id: base,
          family: base,
          movementPattern: base,
          subPattern: base,
          progressionNeighbors: variant ? variant.progressionNeighbors : [],
          regressionNeighbors: variant ? variant.regressionNeighbors : [],
          equipmentRequirements: variant ? variant.equipment || [] : [],
          coachEligibility: true,
          substitutionGroups: [base],
          exposureTags: variant ? variant.exposureTags : []
        };
      });
      return {
        version: core.MATRIX_VERSION,
        sourceVersion: matrix.version || 'cindy-matrix-v1',
        baseDefaults: clone(matrix.baseDefaults || {}),
        variants,
        exercises
      };
    };

    const buildMeasurementContract = (modeOverride = null, formatPolicyOverride = null) => {
      const ctx = contextPort.currentCoachContext();
      const mode = modeOverride || configPort.currentMode() || ctx.mode || 'time';
      return core.defaultMeasurementContract(mode, formatPolicyOverride || ctx.formatPolicy || 'fixed');
    };

    const profileSnapshot = () => {
      const profile = clone(configPort.profileSnapshot() || {});
      const equipment = clone(configPort.equipment() || {});
      const restrictions = clone(configPort.restrictions() || {});
      const semanticFields = {
        age: profile.age ?? null, sex: profile.sex ?? null, heightCm: profile.heightCm ?? null,
        weightKg: profile.weightKg ?? null, weightHistory: clone(profile.weightHistory || []),
        trainingExperience: normalizeTrainingExperience(profile.trainingExperience), goal: profile.goal || 'GENERAL', equipment, restrictions
      };
      return { ...profile, trainingExperience: normalizeTrainingExperience(profile.trainingExperience), equipment, restrictions, profileVersion: `cindy-profile-v1-${hash(semanticFields)}`, effectiveFrom: profile.updatedAt || null };
    };
    const configSnapshot = () => {
      const currentConfig = configPort.currentConfig() || {};
      return {
        ...clone(relevantConfigSnapshot()),
        paceGuidance: Boolean(currentConfig.paceGuidance)
      };
    };
    const constraintSnapshot = (modeOverride = null, formatPolicyOverride = null) => {
      const ctx = contextPort.currentCoachContext();
      const formatPolicy = formatPolicyOverride || ctx.formatPolicy || 'fixed';
      return clone({
        minExercises: 3,
        maxExercises: Number(configPort.maxExercises() || 4),
        maxDurationSeconds: 30 * 60,
        fixedFormat: formatPolicy === 'fixed',
        mode: modeOverride || configPort.currentMode(),
        equipment: configPort.equipment(),
        restrictions: configPort.restrictions(),
        exclusions: configPort.excludedExerciseIds()
      });
    };

    const captureSemanticSnapshots = ({ spec = null, decisionNow = clockPort.now(), status = 'FROZEN_AT_START' } = {}) => {
      const currentProfile = profileSnapshot();
      const profile = { ...currentProfile, effectiveFrom: currentProfile.effectiveFrom || decisionNow };
      const configuration = configSnapshot();
      const constraints = constraintSnapshot(spec && spec.mode || null, spec && spec.formatPolicy || null);
      const measurementContract = clone(spec && spec.measurementContract || buildMeasurementContract(spec && spec.mode || null, spec && spec.formatPolicy || null));
      const matrix = matrixPort.get() || {};
      const matrixVersion = core.MATRIX_VERSION;
      const sourceMatrixVersion = matrix.version || null;
      const compatibilityVersion = matrix.compatibilityVersion || core.COMPATIBILITY_VERSION;
      const decisionTimezone = spec && spec.provenance && spec.provenance.decisionTimezone || clockPort.timezone();
      const snapshotPayload = {
        semanticSnapshotVersion: 'cindy-semantic-history-snapshot-v1',
        snapshotStatus: status,
        profileSnapshot: profile,
        configSnapshot: configuration,
        constraintSnapshot: constraints,
        measurementContract,
        releaseManifest: clone(releaseManifest),
        decisionNow,
        decisionTimezone,
        matrixVersion,
        sourceMatrixVersion,
        compatibilityVersion,
        profileVersion: profile.profileVersion,
        profileEffectiveFrom: profile.effectiveFrom
      };
      return { ...snapshotPayload, semanticSnapshotHash: semanticHash(snapshotPayload), snapshotCapturedAt: decisionNow };
    };

    const buildInput = (now, overrides = {}) => {
      const ctx = contextPort.currentCoachContext();
      const own = currentOwnership();
      const interventionState = state.pendingIntervention;
      const rawHistory = Array.isArray(overrides.historyOverride) ? clone(overrides.historyOverride) : historyPort.records();
      // An abandoned/partial baseline attempt must never become Coach evidence.
      // Only the accepted baselineRecordId is allowed through as a BASELINE history record.
      const history = rawHistory.filter(record => {
        const purpose = record && record.v3 && record.v3.sessionPurpose || record && record.sessionPurpose || 'STANDARD';
        if (purpose !== 'BASELINE') return true;
        return Boolean(state.baselineRecordId && record && record.id === state.baselineRecordId);
      });
      let interventionWindow = interventionState && !String(interventionState.status || '').startsWith('CLOSED_') ? clone(interventionState) : null;
      if (interventionWindow) {
        const parent = interventionWindow.parentRecordId
          ? history.find(r => r && r.id === interventionWindow.parentRecordId)
          : history.find(r => r && r.v3 && r.v3.provenance && r.v3.provenance.specId === interventionWindow.parentSpecId)
            || history.find(r => r && r.provenance && r.provenance.specId === interventionWindow.parentSpecId);
        const child = interventionWindow.childRecordId ? history.find(r => r && r.id === interventionWindow.childRecordId) : null;
        const expectedChild = interventionWindow.childRecord;
        const childMatchesSnapshot = Boolean(child && expectedChild && semanticHash(child) === semanticHash(expectedChild));
        if (!parent || (interventionWindow.childRecordId && !childMatchesSnapshot)) interventionWindow = null;
        else {
          interventionWindow.parentRecord = parent;
          interventionWindow.childRecord = child || null;
        }
      }

      const currentConfig = configPort.currentConfig();
      const currentWorkoutOverride = overrides.currentWorkoutOverride && typeof overrides.currentWorkoutOverride === 'object'
        ? clone(overrides.currentWorkoutOverride)
        : null;
      const effectiveMode = currentWorkoutOverride?.mode || currentConfig.mode || 'time';
      const configuredTarget = currentConfig.target == null ? 20 : Number(currentConfig.target);
      const defaultTarget = effectiveMode === 'time' ? 0 : (Number.isFinite(configuredTarget) ? configuredTarget : 20);
      const currentWorkout = {
        mode: effectiveMode,
        formatPolicy: currentWorkoutOverride?.formatPolicy || ctx.formatPolicy || 'fixed',
        allowedModes: currentWorkoutOverride?.allowedModes || ctx.allowedModes || ['time', 'rounds', 'combined'],
        plannedSeconds: Number(currentWorkoutOverride?.plannedSeconds ?? (Number(currentConfig.minutes || 20) * 60)),
        target: Number(currentWorkoutOverride?.target ?? defaultTarget),
        targetRounds: currentWorkoutOverride?.targetRounds != null
          ? Number(currentWorkoutOverride.targetRounds)
          : (effectiveMode !== 'time' ? Number(currentWorkoutOverride?.target ?? defaultTarget) : null),
        composition: clone(currentWorkoutOverride?.composition || currentConfig.composition || []),
        programContext: clone(currentWorkoutOverride?.programContext || ctx.programContext || null),
        ownership: currentWorkoutOverride?.ownership || own,
        sessionType: currentWorkoutOverride?.sessionType || 'STANDARD',
        invalid: false,
        equipment: { ...clone(currentWorkoutOverride?.equipment || currentConfig.equipment || {}), ...(state.baselineRecordId ? { pullupBar: true } : {}) },
        restrictions: clone(currentWorkoutOverride?.restrictions || currentConfig.userRestrictions || {}),
        measurementContractVersion: buildMeasurementContract(currentWorkoutOverride?.mode || null, currentWorkoutOverride?.formatPolicy || null).version,
        source: clone(currentWorkoutOverride?.source || currentConfig.pendingSource || null)
      };
      return {
        profile: profileSnapshot(),
        config: configSnapshot(),
        hardConstraints: constraintSnapshot(currentWorkout.mode, currentWorkout.formatPolicy),
        currentWorkout,
        history,
        exerciseMatrix: mapMatrix(),
        programContext: clone(ctx.programContext || null),
        externalContext: clone(externalContextPort.get() || null),
        activeState: {
          running: Boolean(activityPort.isRunning()),
          paused: Boolean(activityPort.isPaused())
        },
        decisionNow: now,
        decisionTimezone: clockPort.timezone(),
        releaseManifest: clone(releaseManifest),
        measurementContract: buildMeasurementContract(currentWorkout.mode, currentWorkout.formatPolicy),
        equipment: { ...clone(currentWorkout.equipment || {}), ...(state.baselineRecordId ? { pullupBar: true } : {}) },
        restrictions: clone(currentWorkout.restrictions || {}),
        baselineAuthority: overrides.baselineAuthorityOverride != null ? Boolean(overrides.baselineAuthorityOverride) : baselineAuthorized(),
        baselineComposition: clone((state.preparedSpec && state.preparedSpec.composition) || (currentWorkout.composition || [])),
        interventionWindow
      };
    };

    const deriveDecision = ({ decisionNow, currentWorkoutOverride = null, historyOverride = null, baselineAuthorityOverride = null } = {}) => {
      if (!isEnabled()) return null;
      if (state.baselineRecordId && !baselineRecord()) clearUnverifiedBaseline();
      const now = decisionNow || clockPort.now();
      const result = core.derive(buildInput(now, { currentWorkoutOverride, historyOverride, baselineAuthorityOverride }));
      lastDerived = result;
      return clone(result);
    };

    const baselineWorkoutDefinition = () => ({
      version: BASELINE_TEST_PROTOCOL.version,
      mode: BASELINE_TEST_PROTOCOL.mode,
      formatPolicy: 'fixed',
      allowedModes: ['time'],
      plannedSeconds: baselineTestMinutes() * 60,
      target: BASELINE_TEST_PROTOCOL.target,
      targetRounds: BASELINE_TEST_PROTOCOL.targetRounds,
      composition: clone(BASELINE_TEST_PROTOCOL.composition),
      programContext: null,
      ownership: 'COACH',
      sessionType: 'BASELINE',
      invalid: false,
      // The test is a fixed product protocol. Its standard pull-up exercise must
      // not be blocked merely because the optional equipment profile has not yet
      // been filled in. Normal Coach recommendations still use the user's actual
      // equipment constraints.
      equipment: { ...clone(configPort.equipment()), pullupBar: true },
      restrictions: clone(configPort.restrictions()),
      source: null
    });

    const deriveBaselineTest = ({ decisionNow } = {}) => {
      if (state.baselineRecordId && !baselineRecord()) {
        clearUnverifiedBaseline();
        if (!baselineAuthorized()) return null;
      }
      const now = decisionNow || clockPort.now();
      return deriveDecision({
        decisionNow: now,
        currentWorkoutOverride: baselineWorkoutDefinition(),
        historyOverride: [],
        baselineAuthorityOverride: true
      });
    };

    const baselineRecord = () => {
      if (!state.baselineRecordId) return null;
      return historyPort.records().find(record => record && record.id === state.baselineRecordId &&
        record.valid !== false && record.v3 && record.v3.valid !== false && !record.v3.historyMutation &&
        record.v3.sessionPurpose === 'BASELINE') || null;
    };

    const clearUnverifiedBaseline = () => {
      if (!state.baselineRecordId || baselineRecord()) return false;
      state.baselineRecordId = null;
      state.baselineCompletedAt = null;
      state.baselineAuthority = false;
      clearLegacyBaselineAuthority();
      state.starterApplied = false;
      state.preparedSpec = null;
      state.preparedFingerprint = null;
      lastDerived = null;
      persistState();
      return true;
    };

    const baselineComparisonTarget = () => {
      const record = baselineRecord();
      if (!record) return null;
      const spec = record.v3 && record.v3.plannedSpecSnapshot ? record.v3.plannedSpecSnapshot : null;
      const mode = (spec && spec.mode) || record.mode || 'combined';
      const formatPolicy = (spec && spec.formatPolicy) || record.formatPolicy || 'fixed';
      return {
        mode,
        formatPolicy,
        allowedModes: ['time', 'rounds', 'combined'],
        plannedSeconds: Number((spec && spec.plannedSeconds) ?? record.plannedSeconds ?? 0),
        target: Number((spec && spec.target) ?? record.target ?? 0),
        targetRounds: mode === 'time' ? null : Number((spec && spec.targetRounds) ?? record.targetRounds ?? record.target ?? 0),
        composition: clone((spec && spec.composition) || record.composition || []),
        programContext: clone((spec && spec.programContext) || null),
        ownership: 'COACH',
        sessionType: 'STANDARD',
        invalid: false,
        equipment: { ...clone(configPort.equipment()), pullupBar: true },
        restrictions: clone(configPort.restrictions()),
        source: null
      };
    };

    const qualifyingEvidence = () => {
      const baselineAt = Date.parse(state.baselineCompletedAt || '');
      const target = baselineComparisonTarget();
      if (!target || !Number.isFinite(baselineAt)) return { records: [], core: null };
      const assessment = deriveDecision({
        decisionNow: clockPort.now(),
        currentWorkoutOverride: target,
        historyOverride: historyPort.records(),
        baselineAuthorityOverride: false
      });
      const strictIds = new Set(assessment?.diagnostics?.evidenceViews?.strictCohort || []);
      const trendIds = new Set(assessment?.diagnostics?.evidenceViews?.trendCohort || []);
      const ids = new Set([...strictIds, ...trendIds]);
      const records = historyPort.records().filter(record => {
        if (!record || !record.id || record.id === state.baselineRecordId || !ids.has(record.id)) return false;
        const completedAt = Date.parse(record.completedAt || '');
        return Number.isFinite(completedAt) && completedAt > baselineAt && record.valid !== false && Number(record.rounds || 0) >= 1;
      });
      const uniqueDays = new Set(records.map(record => {
        const stamp = record.v3 && record.v3.decisionTimezone ? record.v3.decisionTimezone : clockPort.timezone();
        const date = new Date(record.completedAt || '');
        return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-CA',{timeZone:stamp,year:'numeric',month:'2-digit',day:'2-digit'}).format(date) : null;
      }).filter(Boolean));
      return { records, uniqueDays, core: assessment };
    };

    const readiness = () => {
      const canonicalBaseline = baselineRecord();
      if (state.baselineRecordId && !canonicalBaseline) clearUnverifiedBaseline();
      if (!state.baselineRecordId || !state.baselineCompletedAt || !canonicalBaseline) {
        return {
          phase: 'NEEDS_BASELINE',
          baselineCompleted: false,
          completedTrainings: 0,
          qualifyingTrainings: 0,
          qualifyingDays: 0,
          requiredCompletedTrainings: 3,
          requiredTrainingDays: 3,
          testPending: baselineAuthorized(),
          selectedTestMinutes: baselineTestMinutes(),
          ready: false
        };
      }
      const evidence = qualifyingEvidence();
      const qualifyingTrainings = evidence.records.length;
      const qualifyingDays = evidence.uniqueDays ? evidence.uniqueDays.size : 0;
      const postBaselineCount = evidenceAfterBaseline().length;
      const ready = qualifyingTrainings >= 3 && qualifyingDays >= 3;
      const phase = ready ? 'READY' : (!state.starterApplied && postBaselineCount === 0 ? 'STARTER_READY' : 'COLLECTING_EVIDENCE');
      return {
        phase,
        baselineCompleted: true,
        completedTrainings: qualifyingTrainings,
        qualifyingTrainings,
        qualifyingDays,
        requiredCompletedTrainings: 3,
        requiredTrainingDays: 3,
        testPending: false,
        selectedTestMinutes: baselineTestMinutes(),
        ready
      };
    };

    const prepare = ({ decisionNow, persist = true } = {}) => {
      if (!isEnabled()) return null;
      const result = deriveDecision({ decisionNow });
      if (!result) return null;
      state.preparedSpec = result.workoutSpec ? clone(result.workoutSpec) : null;
      state.preparedFingerprint = result.workoutSpec && result.workoutSpec.contextFingerprint || null;
      if (persist) persistState();
      return clone(result);
    };

    const fingerprint = result => hash({
      specId: result && result.workoutSpec && result.workoutSpec.specId,
      contextFingerprint: result && result.workoutSpec && result.workoutSpec.contextFingerprint
    });

    const apply = ({ expectedFingerprint = null } = {}) => {
      if (!isEnabled()) return { ok: false, kind: 'disabled' };
      if (activityPort.isRunning() || activityPort.isPaused()) return { ok: false, kind: 'locked' };
      const readinessState = readiness();
      const starterApply = readinessState.phase === 'STARTER_READY';
      if (!readinessState.ready && !starterApply) {
        return {
          ok: false,
          kind: readinessState.phase === 'NEEDS_BASELINE' ? 'needs-baseline' : 'collecting-evidence',
          readiness: readinessState
        };
      }
      const result = prepare({ decisionNow: clockPort.now(), persist: true });
      const spec = result && result.workoutSpec;
      if (!spec || !result.application || !result.application.allowed || !spec.validation || !spec.validation.valid) {
        return { ok: false, kind: 'unavailable' };
      }
      const currentFp = fingerprint(result);
      if (expectedFingerprint && expectedFingerprint !== currentFp) return { ok: false, kind: 'stale' };

      const beforeConfig = relevantConfigSnapshot();
      let patch = null;
      const action = result.action;
      if (action) {
        if (['increase_count', 'decrease_count', 'change_variant', 'replace_exercise', 'remove_extra', 'add_exercise', 'order_change'].includes(action.type)) {
          patch = { composition: runtimeCompositionFromSpec(spec.composition) };
        } else if (action.type === 'change_rounds') {
          patch = { target: Number(spec.targetRounds || spec.target) };
        } else if (action.type === 'change_duration') {
          patch = { minutes: Math.round(Number(spec.plannedSeconds || 0) / 60) };
        } else if (action.type === 'change_format') {
          patch = { mode: spec.mode };
        }
      }
      if (!patch) return { ok: false, kind: 'unavailable' };

      const ok = configPort.applyCoachPatch(patch);
      if (!ok) return { ok: false, kind: 'failed' };
      const afterConfig = relevantConfigSnapshot();
      const interventionTypes = ['increase_count','decrease_count','change_rounds','change_duration','change_variant','replace_exercise','remove_extra','add_exercise','order_change'];
      const intervention = action && action.type && interventionTypes.includes(action.type) ? {
        parentSpecId: spec.provenance && spec.provenance.sourceSpecId || spec.specId,
        sourceSpecId: spec.specId,
        interventionType:
          action.type === 'increase_count' || action.type === 'decrease_count' ? 'COUNT' :
          action.type === 'change_rounds' ? 'ROUNDS' :
          action.type === 'change_duration' ? 'DURATION' :
          action.type === 'order_change' ? 'ORDER_CHANGE' :
          action.type === 'change_variant' ? 'VARIANT' :
          action.type === 'replace_exercise' ? 'REPLACE' :
          action.type === 'remove_extra' ? 'REMOVE' : 'ADD_4TH',
        direction: action.type === 'decrease_count' || (action.type === 'change_duration' && Number(action.delta) < 0) ? 'DOWN' : 'UP',
        targetSlot: action.slotId || (spec.adaptation && spec.adaptation.targetSlot) || null,
        appliedSpecId: spec.specId,
        status: 'APPLIED',
        fidelity: null,
        childRecord: null,
        childRecordId: null,
        parentRecordId: null
      } : null;

      // The first post-test personalization is an initial calibration step,
      // not a causal intervention that needs a Level-B response period.
      // Do not leave the Coach blocked on an unsupported VARIANT response envelope.
      state.pendingIntervention = starterApply ? null : intervention;
      markCoachOwned(spec, afterConfig);
      if (starterApply) state.starterApplied = true;
      persistState();
      renderPort.refresh({ markers: true });
      return { ok: true, before: beforeConfig, after: afterConfig, action, spec: clone(spec), v3: true };
    };

    const prepareForStart = ({ decisionNow } = {}) => {
      if (!isEnabled()) return null;
      if (activityPort.isRunning() || activityPort.isPaused()) return null;
      if (state.baselineRecordId && !baselineRecord()) clearUnverifiedBaseline();
      const now = decisionNow || clockPort.now();
      // paceGuidance is an execution preference carried by CoachInput.config,
      // not a CoachCore adaptation lever or a normative WorkoutSpec field.
      const startConfig = configSnapshot();
      const baselineAuthorizedAtStart = baselineAuthorized();
      const result = baselineAuthorizedAtStart ? deriveBaselineTest({ decisionNow: now }) : prepare({ decisionNow: now, persist: true });
      const frozenSpec = result && result.workoutSpec && result.application && result.application.allowed
        ? clone(result.workoutSpec) : null;
      if (!frozenSpec) return null;
      const sessionRuntime = {
        mode: frozenSpec.mode,
        plannedSeconds: frozenSpec.plannedSeconds,
        target: frozenSpec.target,
        targetRounds: frozenSpec.targetRounds,
        composition: clone(frozenSpec.composition || []),
        paceGuidance: frozenSpec.mode === 'combined' && Boolean(startConfig.paceGuidance),
        source: null
      };
      return {
        result: clone(result),
        frozenSpec,
        baselineAuthorizedAtStart,
        isBaseline: baselineAuthorizedAtStart && frozenSpec.sessionPurpose === 'BASELINE',
        sessionRuntime,
        rollbackSession: clone(sessionPort.get() || null)
      };
    };

    const commitStart = ({ frozenSpec, baselineAuthorizedAtStart, isBaseline = false, rollbackSession = null } = {}) => {
      if (!isEnabled()) return null;
      if (!sessionPort.isRunning() || !frozenSpec) return null;
      const currentSession = sessionPort.get() || {};
      const alreadyFrozen = Boolean(currentSession.v3Spec && currentSession.v3SemanticSnapshots &&
        currentSession.v3SemanticSnapshots.snapshotStatus === 'FROZEN_AT_START' &&
        ['COACH', 'BASELINE'].includes(currentSession.v3Ownership));
      // A repeated commit must not rewrite or cancel a genuinely active frozen workout.
      if (alreadyFrozen) return clone(currentSession);
      const previousState = clone(state);
      const rollback = rollbackSession || null;
      try {
        const ownership = isBaseline ? 'BASELINE' : currentOwnership();
        const frozenContract = workoutHistoryService.freezeForStart({
          spec: frozenSpec,
          ownership,
          decisionNow: frozenSpec.provenance && frozenSpec.provenance.decisionNow || clockPort.now(),
          decisionTimezone: frozenSpec.provenance && frozenSpec.provenance.decisionTimezone || clockPort.timezone(),
          contextFingerprint: frozenSpec.contextFingerprint || configFingerprint(),
          intervention: isBaseline ? null : state.pendingIntervention,
          semanticSnapshots: captureSemanticSnapshots({ spec: frozenSpec, decisionNow: frozenSpec.provenance && frozenSpec.provenance.decisionNow || clockPort.now() })
        });
        const nextSession = workoutHistoryService.restoreSessionContract(currentSession, frozenContract);
        sessionPort.replace({ ...nextSession, v3Ownership: ownership });
        if (baselineAuthorizedAtStart && !isBaseline) {
          markCoachOwned(frozenSpec, relevantConfigSnapshot());
        }
        if (sessionPort.save() !== true) throw new Error('Coach START session commit was not persisted');
        return clone(frozenContract);
      } catch (_) {
        state = previousState;
        try { stateRepository.save(state); } catch (_) {}
        // rollbackSession is captured while the session is idle, before the UI's
        // initial running-session write. Restoring it also removes that tentative
        // persisted session; the active frozen-session fast path above never enters here.
        try { if (sessionPort.restore) sessionPort.restore(rollback); } catch (_) {}
        return null;
      }
    };

    const decorateRecord = ({ raw, spec, ownership, intervention, snapshots } = {}) =>
      workoutHistoryService.decorateHistoryRecord({ raw, spec, ownership, intervention, snapshots });

    const historySnapshots = (spec, ownership, intervention) => {
      const sessionSnapshot = sessionPort.get() || {};
      const currentConfig = configPort.currentConfig();
      const semantic = sessionSnapshot.v3SemanticSnapshots && sessionSnapshot.v3SemanticSnapshots.snapshotStatus === 'FROZEN_AT_START'
        ? clone(sessionSnapshot.v3SemanticSnapshots)
        : captureSemanticSnapshots({ spec, decisionNow: spec && spec.provenance && spec.provenance.decisionNow || sessionSnapshot.v3DecisionNow || clockPort.now(), status: 'LEGACY_COMPLETION_FALLBACK' });
      return {
        ...semantic,
        core,
        profileSnapshot: semantic.profileSnapshot,
        configSnapshot: semantic.configSnapshot,
        constraintSnapshot: semantic.constraintSnapshot,
        measurementContract: semantic.measurementContract,
        releaseManifest: semantic.releaseManifest,
        decisionTimezone: (spec && spec.provenance && spec.provenance.decisionTimezone) || sessionSnapshot.v3DecisionTimezone || clockPort.timezone(),
        contextFingerprint: sessionSnapshot.v3ContextFingerprint || null,
        matrixVersion: semantic.matrixVersion,
        compatibilityVersion: semantic.compatibilityVersion,
        sessionPurpose: spec && spec.sessionPurpose || 'STANDARD',
        currentConfigSnapshot: clone(currentConfig)
      };
    };

    const isFrozenSessionCoachOwned = () => {
      const currentSession = sessionPort.get() || {};
      return Boolean(currentSession.v3Spec && ['COACH','BASELINE'].includes(currentSession.v3Ownership));
    };

    const handleRecord = ({ raw, end = 'manual', passive = false } = {}) => {
      const record = clone(raw);
      const currentSession = sessionPort.get() || {};
      const frozenCoachOwned = isFrozenSessionCoachOwned();
      if (!isEnabled() && !(passive && frozenCoachOwned)) return record;
      const spec = currentSession.v3Spec ? clone(currentSession.v3Spec) : (isEnabled() && state.preparedSpec ? clone(state.preparedSpec) : null);
      const ownership = currentSession.v3Ownership || (isEnabled() ? currentOwnership() : 'BUILDER');
      const intervention = currentSession.v3Intervention || (isEnabled() ? state.pendingIntervention : null);
      record.id = core.hash({
        completedAt: record.completedAt,
        mode: record.mode,
        plannedSeconds: record.plannedSeconds,
        target: record.target,
        rounds: record.rounds,
        duration: record.duration,
        composition: record.composition,
        coachSpecId: spec && spec.specId || null
      });
      const decorated = decorateRecord({
        raw: record,
        spec,
        ownership,
        intervention,
        snapshots: historySnapshots(spec, ownership, intervention)
      });
      if (intervention) {
        const linked = workoutHistoryService.linkInterventionCompletion({ intervention, record: decorated });
        if (decorated.v3 && decorated.v3.coachIntervention) {
          decorated.v3.coachIntervention.fidelity = linked.fidelity;
          decorated.v3.coachIntervention.childRecordId = decorated.id;
          decorated.v3.coachIntervention.status = linked.status;
        }
      }
      return decorated;
    };

    const reconcileAfterFinish = latest => {
      if (!isEnabled()) return false;
      if (!latest || !latest.v3) return;
      if (latest.v3.sessionPurpose === 'BASELINE') {
        const endedBy = latest.v3.actualExecution && latest.v3.actualExecution.endedBy || latest.endedBy || '';
        const fidelity = latest.v3.executionFidelity || '';
        const completedNormally = ['time', 'target'].includes(endedBy) && ['EXACT', 'SUFFICIENT'].includes(fidelity);
        // A manual stop or partial baseline is an attempt, not a completed baseline.
        // Keep it in History if the normal Workout lifecycle saved it, but never promote it
        // to the Coach baseline authority.
        if (!completedNormally) return;
        const baselineSpec = latest.v3.plannedSpecSnapshot;
        if (!baselineSpec || !Array.isArray(baselineSpec.composition) || !Number.isFinite(Number(baselineSpec.plannedSeconds))) return;

        // A completed test establishes the Coach starting workout. Keep the test itself
        // isolated from the user's pre-test settings, but after successful completion the
        // canonical test composition becomes the Coach-owned starting workout so subsequent
        // evidence remains strictly comparable.
        const applied = configPort.applyCoachPatch({
          mode: baselineSpec.mode,
          minutes: Math.round(Number(baselineSpec.plannedSeconds || 0) / 60),
          target: Number(baselineSpec.target || 0),
          composition: runtimeCompositionFromSpec(baselineSpec.composition || [])
        });
        if (!applied) return;
        state.baselineAuthority = false;
        state.baselineRecordId = typeof latest.id === 'string' ? latest.id : null;
        state.baselineCompletedAt = typeof latest.completedAt === 'string' ? latest.completedAt : clockPort.now();
        state.starterApplied = false;
        markCoachOwned(baselineSpec, relevantConfigSnapshot());
        // Immediately derive the first post-test recommendation so the user
        // does not remain in the test-prepared state. The next decision is
        // still intentionally conservative and is governed by CoachCore.
        try { prepare({ decisionNow: clockPort.now(), persist: false }); } catch (_) {}
        persistState();
        try { renderPort.refresh({ markers: true, coach: true }); } catch (_) {}
        return;
      }
      if (!state.pendingIntervention) return;
      if (latest.v3.coachIntervention) {
        state.pendingIntervention = workoutHistoryService.linkInterventionCompletion({ intervention: state.pendingIntervention, record: latest });
        persistState();
      }
    };

    const onHistoryMutation = ({ id, kind = 'edit', record = null, previousRecords = null } = {}) => {
      const clear = kind === 'clear';
      const replace = kind === 'replace' || kind === 'import';
      if (!isEnabled() || (!clear && !replace && (typeof id !== 'string' || !id))) return false;
      const records = historyPort.records();
      const canonicalRecord = clear ? null : records.find(item => item && item.id === id) || null;
      const affectedRecord = record || canonicalRecord;
      let changed = false;
      if (clear) {
        if (state.baselineRecordId || state.baselineCompletedAt || state.baselineAuthority || state.starterApplied) {
          state.baselineRecordId = null;
          state.baselineCompletedAt = null;
          state.baselineAuthority = false;
          state.starterApplied = false;
          changed = true;
        }
        if (state.pendingIntervention && !String(state.pendingIntervention.status || '').startsWith('CLOSED_')) {
          state.pendingIntervention = { ...state.pendingIntervention, status: 'CLOSED_HISTORY_MUTATION', closedBy: 'history_clear', closedAt: clockPort.now() };
          changed = true;
        }
        if (state.preparedSpec || state.preparedFingerprint) {
          state.preparedSpec = null;
          state.preparedFingerprint = null;
          changed = true;
        }
        lastDerived = null;
        return changed ? persistState() : true;
      }
      if (replace) {
        const prior = Array.isArray(previousRecords) ? previousRecords : [];
        const historyChanged = semanticHash(prior) !== semanticHash(records);
        if (state.baselineAuthority && !state.baselineRecordId && historyChanged) {
          state.baselineAuthority = false;
          state.starterApplied = false;
          changed = true;
        }
        if (state.baselineRecordId) {
          const oldBaseline = prior.find(item => item && item.id === state.baselineRecordId) || null;
          const newBaseline = records.find(item => item && item.id === state.baselineRecordId) || null;
          const unchanged = Boolean(oldBaseline && newBaseline && newBaseline.valid !== false &&
            !(newBaseline.v3 && (newBaseline.v3.valid === false || newBaseline.v3.historyMutation)) &&
            semanticHash(oldBaseline) === semanticHash(newBaseline));
          if (!unchanged) {
            state.baselineRecordId = null;
            state.baselineCompletedAt = null;
            state.baselineAuthority = false;
            state.starterApplied = false;
            changed = true;
          }
        }
        if (state.pendingIntervention && !String(state.pendingIntervention.status || '').startsWith('CLOSED_')) {
          state.pendingIntervention = { ...state.pendingIntervention, status: 'CLOSED_HISTORY_MUTATION', closedBy: 'history_replace', closedAt: clockPort.now() };
          changed = true;
        }
        if (state.preparedSpec || state.preparedFingerprint) {
          state.preparedSpec = null;
          state.preparedFingerprint = null;
          changed = true;
        }
        lastDerived = null;
        return changed ? persistState() : true;
      }
      if (state.baselineRecordId === id && (!canonicalRecord || canonicalRecord.valid === false || canonicalRecord.v3 && (canonicalRecord.v3.valid === false || canonicalRecord.v3.historyMutation))) {
        state.baselineRecordId = null;
        state.baselineCompletedAt = null;
        state.baselineAuthority = false;
        state.starterApplied = false;
        changed = true;
      }
      const pending = state.pendingIntervention;
      if (pending) {
        const specId = affectedRecord && affectedRecord.v3 && affectedRecord.v3.provenance && affectedRecord.v3.provenance.specId;
        const related = pending.parentRecordId === id || pending.childRecordId === id || Boolean(specId && (pending.parentSpecId === specId || pending.sourceSpecId === specId || pending.appliedSpecId === specId));
        if (related) {
          state.pendingIntervention = { ...pending, status: 'CLOSED_HISTORY_MUTATION', closedBy: `history_${kind}`, closedRecordId: id, closedAt: clockPort.now() };
          changed = true;
        }
      }
      if (state.preparedSpec || state.preparedFingerprint) {
        state.preparedSpec = null;
        state.preparedFingerprint = null;
        changed = true;
      }
      lastDerived = null;
      return changed ? persistState() : true;
    };

    const requestBaseline = (minutes = BASELINE_TEST_PROTOCOL.defaultMinutes) => {
      if (!isEnabled()) return false;
      if (activityPort.isRunning() || activityPort.isPaused()) return false;
      if (state.baselineRecordId && !baselineRecord()) clearUnverifiedBaseline();
      if (state.baselineRecordId && state.baselineCompletedAt && baselineRecord()) return false;
      const selectedMinutes = Number(minutes);
      if (!BASELINE_TEST_PROTOCOL.allowedMinutes.includes(selectedMinutes)) return false;
      state.baselineAuthority = true;
      state.baselineTestMinutes = selectedMinutes;
      state.starterApplied = false;
      state.ownership = 'BUILDER';
      state.preparedSpec = null;
      state.preparedFingerprint = null;
      persistState();
      return true;
    };

    const previewBaselineTest = ({ decisionNow } = {}) => {
      if (!isEnabled()) return null;
      const result = deriveBaselineTest({ decisionNow: decisionNow || clockPort.now() });
      if (!result || !result.workoutSpec || result.workoutSpec.sessionPurpose !== 'BASELINE') return null;
      return {
        frozenSpec: clone(result.workoutSpec),
        sessionRuntime: {
          mode: result.workoutSpec.mode,
          plannedSeconds: result.workoutSpec.plannedSeconds,
          target: result.workoutSpec.target,
          targetRounds: result.workoutSpec.targetRounds,
          composition: clone(result.workoutSpec.composition || []),
          paceGuidance: Boolean(result.workoutSpec.paceGuidance),
          source: null
        }
      };
    };

    const clearBaselineAuthority = () => {
      if (!isEnabled()) return false;
      state.baselineAuthority = false;
      persistState();
      return true;
    };

    const onBuilderMutation = () => isEnabled() ? markBuilderOwned() : false;

    const disable = () => {
      try { state = stateRepository.load(); } catch (_) {}
      let changed = false;
      if (state.baselineAuthority) { state.baselineAuthority = false; changed = true; }
      if (state.preparedSpec || state.preparedFingerprint) { state.preparedSpec = null; state.preparedFingerprint = null; changed = true; }
      if (state.pendingIntervention && state.pendingIntervention.status !== 'CLOSED_DISABLED') {
        state.pendingIntervention = { ...state.pendingIntervention, status: 'CLOSED_DISABLED', closedBy: 'coach_disabled', closedAt: clockPort.now() };
        changed = true;
      }
      if (state.ownership !== 'BUILDER' || state.appliedConfigFingerprint) {
        state.ownership = 'BUILDER';
        state.appliedConfigFingerprint = null;
        changed = true;
      }
      return changed ? persistState(true) : true;
    };

    return Object.freeze({
      version: 'cindy-coach-application-service-v3.0',
      state: readState,
      readiness: () => isEnabled() ? clone(readiness()) : null,
      baselineTestDefinition: () => isEnabled() ? ({
        version: BASELINE_TEST_PROTOCOL.version,
        mode: BASELINE_TEST_PROTOCOL.mode,
        defaultMinutes: BASELINE_TEST_PROTOCOL.defaultMinutes,
        allowedMinutes: clone(BASELINE_TEST_PROTOCOL.allowedMinutes),
        selectedMinutes: baselineTestMinutes(),
        target: BASELINE_TEST_PROTOCOL.target,
        targetRounds: BASELINE_TEST_PROTOCOL.targetRounds,
        composition: clone(BASELINE_TEST_PROTOCOL.composition)
      }) : null,
      deriveBaselineTest,
      deriveDecision,
      prepare,
      apply,
      fingerprint,
      currentOwnership,
      requestBaseline,
      clearBaselineAuthority,
      onBuilderMutation,
      disable,
      isFrozenSessionCoachOwned,
      prepareForStart,
      previewBaselineTest,
      commitStart,
      handleRecord,
      reconcileAfterFinish,
      onHistoryMutation,
      buildReleaseManifest: () => clone(releaseManifest),
      lastDerived: () => clone(lastDerived)
    });
  };

  window.CINDYCoachApplicationServiceV3 = Object.freeze({ version: 'cindy-coach-application-service-v3.0', create });
})();
