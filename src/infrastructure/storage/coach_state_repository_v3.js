(() => {
  'use strict';
  const clone = value => {
    if (value == null) return value;
    if (typeof structuredClone === 'function') {
      try { return structuredClone(value); } catch (_) {}
    }
    return JSON.parse(JSON.stringify(value));
  };
  const DEFAULTS = Object.freeze({
    version: 1,
    ownership: 'BUILDER',
    baselineAuthority: false,
    baselineCompletedAt: null,
    baselineRecordId: null,
    baselineTestMinutes: null,
    starterApplied: false,
    preparedSpec: null,
    preparedFingerprint: null,
    appliedConfigFingerprint: null,
    pendingIntervention: null
  });
  const normalize = value => {
    const x = value && typeof value === 'object' ? value : {};
    return {
      version: DEFAULTS.version,
      ownership: x.ownership === 'COACH' ? 'COACH' : 'BUILDER',
      baselineAuthority: Boolean(x.baselineAuthority),
      baselineCompletedAt: typeof x.baselineCompletedAt === 'string' ? x.baselineCompletedAt : null,
      baselineRecordId: typeof x.baselineRecordId === 'string' ? x.baselineRecordId : null,
      baselineTestMinutes: [5, 10, 20].includes(Number(x.baselineTestMinutes)) ? Number(x.baselineTestMinutes) : null,
      starterApplied: Boolean(x.starterApplied),
      preparedSpec: clone(x.preparedSpec || null),
      preparedFingerprint: typeof x.preparedFingerprint === 'string' ? x.preparedFingerprint : null,
      appliedConfigFingerprint: typeof x.appliedConfigFingerprint === 'string' ? x.appliedConfigFingerprint : null,
      pendingIntervention: clone(x.pendingIntervention || null)
    };
  };
  const create = ({ storagePort, key = 'cindyCoachV3State' } = {}) => {
    if (!storagePort || typeof storagePort.read !== 'function' || typeof storagePort.write !== 'function') {
      throw new TypeError('CoachStateRepository requires a storage port');
    }
    const load = () => normalize(storagePort.read(key, clone(DEFAULTS)));
    const save = value => storagePort.write(key, normalize(value));
    return Object.freeze({ key, defaults: clone(DEFAULTS), load, save, normalize });
  };
  window.CINDYCoachStateRepositoryV3 = Object.freeze({ version: 'cindy-coach-state-repository-v3.0', create, normalize });
})();
