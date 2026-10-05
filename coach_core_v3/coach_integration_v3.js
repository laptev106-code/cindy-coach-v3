/* CINDY Adaptive Coach V3.0.0 browser composition/compatibility adapter. */
(function () {
  'use strict';

  const CORE = window.CindyAdaptiveCoachV3;
  const SERVICE_FACTORY = window.CINDYCoachApplicationServiceV3;
  const STATE_REPOSITORY_FACTORY = window.CINDYCoachStateRepositoryV3;
  const SESSION_CONTRACT = window.CINDYSessionContractV3;
  const PROVENANCE = window.CINDYHistoryProvenanceV3;
  const WORKOUT_HISTORY = window.CINDYWorkoutHistoryServiceV3;
  const STORAGE_FACTORY = window.CINDYLocalStorageV3;
  const MIGRATION_FACTORY = window.CINDYCoachStateMigrationV3;

  if (!CORE) throw new Error('CINDY V3 CoachCore missing');
  if (!SERVICE_FACTORY) throw new Error('CINDY V3 CoachApplicationService missing');
  if (!STATE_REPOSITORY_FACTORY) throw new Error('CINDY V3 CoachStateRepository missing');
  if (!SESSION_CONTRACT || !PROVENANCE || !WORKOUT_HISTORY) throw new Error('CINDY V3 Stage3 vertical-slice modules missing');
  if (!STORAGE_FACTORY) throw new Error('CINDY V3 LocalStorage adapter missing');
  if (!MIGRATION_FACTORY) throw new Error('CINDY V3 CoachStateMigration missing');

  const V3_STATE_KEY = 'cindyCoachV3State';
  const V3_FIXTURES_VERSION = 'v3.0.0-100';
  const V3_CORE_VERSION = CORE.CORE_VERSION;
  const V3_SOURCE_HASH = '024608c9a30091d1d85105fea25dc28444f8b171fce890d313924b07f0a6f046';
  const V3_BUILD_HASH = 'ef69c3217fb2b123cfc631483f3bc331df145a7eed5e9feeb1ec3c9734c49a04';
  const V3_RELEASE_SOURCE_HASH = '83ea6829ca6bd899d2f098bb3e6203113989e3123d90a2bb3a42a23d658fd7cd';
  const V3_RELEASE_BUILD_HASH = '5542bcb39215c510445e46716bd7e0f009aca298249e4fb867479a6bc46af6a8';

  const clone = value => {
    if (value == null) return value;
    if (typeof structuredClone === 'function') {
      try { return structuredClone(value); } catch (_) {}
    }
    return JSON.parse(JSON.stringify(value));
  };

  const releaseManifest = Object.freeze({
    specVersion: '3.0.0',
    coreVersion: V3_CORE_VERSION,
    buildHash: V3_BUILD_HASH,
    sourceHash: V3_SOURCE_HASH,
    fixtureCorpusVersion: V3_FIXTURES_VERSION,
    exerciseMatrixVersion: CORE.MATRIX_VERSION,
    compatibilityVersion: CORE.COMPATIBILITY_VERSION,
    releaseCandidateId: 'CINDY_V3_P0_TIME_BASELINE_FIX_20261005',
    integrityVersion: 'CINDY_RELEASE_HASH_V1',
    releaseSourceHash: V3_RELEASE_SOURCE_HASH,
    releaseBuildHash: V3_RELEASE_BUILD_HASH
  });

  const clockPort = Object.freeze({
    now: () => new Date().toISOString(),
    timezone: () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  });

  const stateStorage = STORAGE_FACTORY.create({ storage: window.localStorage });
  const stateRepository = STATE_REPOSITORY_FACTORY.create({ storagePort: stateStorage, key: V3_STATE_KEY });
  const migration = MIGRATION_FACTORY.create();
  const migrationResult = migration.migrate({ storage: window.localStorage, stateRepository, now: () => new Date().toISOString() });

  let runtime = null;
  let service = null;
  let forceOffInThisTab = false;
  let pendingClosedForOff = false;

  const closePendingCoachState = () => {
    if (pendingClosedForOff) return true;
    if (!service || typeof service.disable !== 'function') return false;
    try {
      pendingClosedForOff = service.disable() === true;
      return pendingClosedForOff;
    } catch (_) { return false; }
  };

  const requireRuntime = () => {
    if (!runtime) throw new Error('CINDY V3 application runtime is not bound');
    return runtime;
  };

  const isCoachEnabled = () => {
    if (!runtime || !service || !migrationResult.ready) return false;
    try {
      const preference = typeof runtime.readCoachPreference === 'function'
        ? runtime.readCoachPreference()
        : (runtime.getConfig().coachEnabled === true);
      if (preference !== true) {
        forceOffInThisTab = true;
        closePendingCoachState();
        return false;
      }
      if (forceOffInThisTab) {
        closePendingCoachState();
        return false;
      }
      return true;
    } catch (_) { return false; }
  };

  const onPreferenceChange = (enabled, persisted = false) => {
    if (enabled !== true) {
      forceOffInThisTab = true;
      return closePendingCoachState();
    }
    if (!persisted || !runtime || !migrationResult.ready) return false;
    try {
      if (typeof runtime.readCoachPreference !== 'function' || runtime.readCoachPreference() !== true) return false;
      if ((forceOffInThisTab || pendingClosedForOff) && !closePendingCoachState()) return false;
      forceOffInThisTab = false;
      pendingClosedForOff = false;
      return true;
    } catch (_) { return false; }
  };

  function configPort() {
    return {
      relevantSnapshot() {
        const rt = requireRuntime();
        const cfg = rt.getConfig();
        const ctx = rt.currentCoachContext ? rt.currentCoachContext() : {};
        return CORE.canonicalize({
          mode: cfg.mode,
          minutes: cfg.minutes,
          target: cfg.target,
          formatPolicy: ctx.formatPolicy,
          allowedModes: ctx.allowedModes,
          composition: clone(cfg.composition || []),
          equipment: clone(cfg.equipment || {}),
          restrictions: clone(cfg.userRestrictions || {}),
          excludedExerciseIds: clone(cfg.excludedExerciseIds || []),
          coachExcludedVariantIds: clone(cfg.coachExcludedVariantIds || []),
          programContext: clone(cfg.programContext || null),
          pendingSource: clone(cfg.pendingSource || null)
        });
      },
      currentConfig: () => requireRuntime().getConfig(),
      currentMode: () => requireRuntime().getConfig().mode,
      maxExercises: () => requireRuntime().getConfig().maxExercises,
      equipment: () => clone(requireRuntime().getConfig().equipment || {}),
      restrictions: () => clone(requireRuntime().getConfig().userRestrictions || {}),
      excludedExerciseIds: () => clone(requireRuntime().getConfig().excludedExerciseIds || []),
      profileSnapshot: () => clone(requireRuntime().getConfig().profile || {}),
      applyCoachPatch: patch => Boolean(requireRuntime().setConfig(patch))
    };
  }

  const contextPort = Object.freeze({
    currentCoachContext: () => requireRuntime().currentCoachContext ? requireRuntime().currentCoachContext() : {},
    profileSnapshot: () => clone(requireRuntime().getConfig().profile || {}),
    formatPolicy: () => (requireRuntime().currentCoachContext ? requireRuntime().currentCoachContext().formatPolicy : 'fixed'),
    programContext: () => clone((requireRuntime().currentCoachContext ? requireRuntime().currentCoachContext().programContext : null) || null)
  });

  const historyPort = Object.freeze({
    records: () => requireRuntime().records()
  });

  const sessionPort = Object.freeze({
    get: () => requireRuntime().getSession(),
    replace: next => requireRuntime().replaceSession(next),
    save: () => requireRuntime().saveSession(),
    restore: snapshot => requireRuntime().restoreSession(snapshot),
    isRunning: () => Boolean(requireRuntime().getSession() && requireRuntime().getSession().status === 'running')
  });

  const matrixPort = Object.freeze({
    get: () => (window.CINDYExerciseCatalogV3 && window.CINDYExerciseCatalogV3.CINDY_FINAL_COACH_MATRIX) || window.CindyFinalCoachMatrix || null
  });

  const externalContextPort = Object.freeze({
    get: () => clone(window.cindyExternalContextV3 || null)
  });

  const activityPort = Object.freeze({
    isRunning: () => Boolean(requireRuntime().isActive && requireRuntime().isActive()),
    isPaused: () => Boolean(requireRuntime().isPaused && requireRuntime().isPaused())
  });

  const renderPort = Object.freeze({
    refresh: markers => {
      if (requireRuntime().renderAll) requireRuntime().renderAll(markers || { markers: true });
    }
  });

  const baselineAuthorityPort = Object.freeze({
    isAuthorized: () => {
      try { return Boolean(service && service.state && service.state().baselineAuthority); }
      catch (_) { return false; }
    },
    clear: () => {
      try { return Boolean(service && service.clearBaselineAuthority && service.clearBaselineAuthority()); }
      catch (_) { return false; }
    }
  });

  const workoutHistoryService = WORKOUT_HISTORY.create({
    sessionContract: SESSION_CONTRACT,
    provenance: PROVENANCE
  });

  service = SERVICE_FACTORY.create({
    core: CORE,
    stateRepository,
    configPort: configPort(),
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
    enabledPort: isCoachEnabled,
    integrityPort: Object.freeze({ sha256: migration.sha256, canonicalJson: migration.canonicalJson }),
    releaseManifest
  });

  function bindRuntime(next) {
    if (!next || typeof next.getConfig !== 'function' || typeof next.getSession !== 'function' ||
        typeof next.replaceSession !== 'function' || typeof next.saveSession !== 'function' ||
        typeof next.records !== 'function' || typeof next.setConfig !== 'function') {
      throw new Error('CINDY V3 runtime binding is incomplete');
    }
    runtime = Object.freeze(next);
    try {
      if (typeof runtime.loadPersistedSession === 'function') {
        const raw = runtime.loadPersistedSession();
        if (raw) runtime.replaceSession(SESSION_CONTRACT.apply(runtime.getSession(), raw));
      }
    } catch (_) {}
    if (typeof window.addEventListener === 'function') {
      window.addEventListener('storage', event => {
        try {
          if (!runtime || typeof runtime.isConfigStorageKey !== 'function' || !runtime.isConfigStorageKey(event.key)) return;
          const preference = typeof runtime.readCoachPreference === 'function' ? runtime.readCoachPreference() : false;
          if (typeof runtime.syncCoachPreference === 'function') runtime.syncCoachPreference(preference);
          if (preference === true) {
            if (forceOffInThisTab || pendingClosedForOff) onPreferenceChange(true, true);
          }
          else onPreferenceChange(false, true);
          if (runtime.renderAll) runtime.renderAll({ markers: true, coach: true });
        } catch (_) {}
      });
    }
    return true;
  }

  function onConfigMutation() {
    if (!isCoachEnabled()) return true;
    try {
      const snapshot = service.state();
      const fingerprint = service.fingerprint();
      // A pending baseline is a dedicated Coach protocol and is intentionally
      // independent from the user's editable Builder configuration. Changing
      // the Builder config must not cancel the pending baseline test.
      if (snapshot.baselineAuthority) return true;
      if (snapshot.ownership === 'COACH' && snapshot.appliedConfigFingerprint && fingerprint !== snapshot.appliedConfigFingerprint) {
        service.onBuilderMutation();
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  // V3.0.0 has no normative trainingExperience enum; accept no non-empty value
  // until the specification defines one. Guard this public facade before core
  // execution so OFF cannot compute or expose an actionable decision.
  const TRAINING_EXPERIENCE_VALUES = Object.freeze([]);
  const normalizeTrainingExperience = value => {
    const candidate = typeof value === 'string' ? value.trim() : '';
    return TRAINING_EXPERIENCE_VALUES.includes(candidate) ? candidate : '';
  };
  window.CindyAdaptiveCoachV3 = Object.freeze({
    ...CORE,
    derive: input => {
      if (!isCoachEnabled()) return null;
      const source = input && typeof input === 'object' ? input : {};
      const profile = source.profile && typeof source.profile === 'object' ? source.profile : {};
      return CORE.derive({ ...source, profile: { ...profile, trainingExperience: normalizeTrainingExperience(profile.trainingExperience) } });
    }
  });

  window.CindyCoachIntegration = Object.freeze({
    integrationVersion: 'cindy-coach-v3-application-adapter',
    authority: 'COACH_CORE_V3',
    algorithmVersion: V3_CORE_VERSION,
    bindRuntime,
    onConfigMutation,
    onPreferenceChange,
    apply: (expectedFingerprint = null) => isCoachEnabled() ? service.apply({ expectedFingerprint }) : { ok: false, kind: 'disabled' },
    derive: (options = {}) => {
      if (!isCoachEnabled()) return null;
      const baselinePending = Boolean(service.state && service.state().baselineAuthority);
      return baselinePending && typeof service.deriveBaselineTest === 'function'
        ? service.deriveBaselineTest({ decisionNow: options.decisionNow || clockPort.now() })
        : service.prepare({ decisionNow: options.decisionNow || clockPort.now(), persist: false });
    },
    prepareForStart: () => isCoachEnabled() ? service.prepareForStart({ decisionNow: clockPort.now() }) : null,
    previewBaselineTest: () => isCoachEnabled() && service.state().baselineAuthority && typeof service.previewBaselineTest === 'function' ? service.previewBaselineTest({ decisionNow: clockPort.now() }) : null,
    commitStart: payload => isCoachEnabled() ? service.commitStart(payload) : null,
    handleRecord: payload => isCoachEnabled() ? service.handleRecord(payload) : service.isFrozenSessionCoachOwned() ? service.handleRecord({ ...(payload || {}), passive: true }) : (payload && payload.raw),
    reconcileAfterFinish: latest => isCoachEnabled() ? service.reconcileAfterFinish(latest) : null,
    onHistoryMutation: payload => isCoachEnabled() ? service.onHistoryMutation(payload) : false,
    releaseManifest: () => clone(releaseManifest),
    ownership: () => isCoachEnabled() ? service.currentOwnership() : 'BUILDER',
    state: () => isCoachEnabled() ? service.state() : null,
    readiness: () => isCoachEnabled() ? service.readiness() : null,
    isEnabled: isCoachEnabled,
    requestBaseline: minutes => isCoachEnabled() ? service.requestBaseline(minutes) : false,
    baselineTestDefinition: () => isCoachEnabled() ? service.baselineTestDefinition() : null,
    migrationStatus: () => clone(migrationResult),
    isBound: () => Boolean(runtime),
    applicationServiceVersion: service.version
  });

  window.CindyCoachV3 = Object.freeze({
    coreVersion: CORE.CORE_VERSION,
    application: Object.freeze({
      derive: options => isCoachEnabled() ? service.deriveDecision({ decisionNow: options && options.decisionNow || clockPort.now() }) : null,
      prepare: options => isCoachEnabled() ? service.prepare({ decisionNow: options && options.decisionNow || clockPort.now(), persist: false }) : null,
      apply: expectedFingerprint => isCoachEnabled() ? service.apply({ expectedFingerprint }) : { ok: false, kind: 'disabled' },
      state: () => isCoachEnabled() ? service.state() : null,
      readiness: () => isCoachEnabled() ? service.readiness() : null,
      onHistoryMutation: payload => isCoachEnabled() ? service.onHistoryMutation(payload) : false
    }),
    derive: options => isCoachEnabled() ? service.deriveDecision({ decisionNow: options && options.decisionNow || clockPort.now() }) : null,
    releaseManifest: () => clone(releaseManifest),
    state: () => isCoachEnabled() ? service.state() : null,
    readiness: () => isCoachEnabled() ? service.readiness() : null,
    isEnabled: isCoachEnabled,
    migrationStatus: () => clone(migrationResult)
  });

  try {
    console.info('[CINDY V3] CoachApplicationService ready for explicit runtime binding', releaseManifest);
  } catch (_) {}
})();
