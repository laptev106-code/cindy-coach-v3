(() => {
  'use strict';
  const clone = value => { if (typeof structuredClone === 'function') { try { return structuredClone(value); } catch (_) {} } return value == null ? value : JSON.parse(JSON.stringify(value)); };
  const sanitize = raw => {
    const x = raw && typeof raw === 'object' ? raw : {};
    return Object.freeze({
      v3Spec: x.v3Spec ? clone(x.v3Spec) : null,
      v3DecisionNow: typeof x.v3DecisionNow === 'string' ? x.v3DecisionNow : null,
      v3DecisionTimezone: typeof x.v3DecisionTimezone === 'string' ? x.v3DecisionTimezone : null,
      v3Ownership: typeof x.v3Ownership === 'string' ? x.v3Ownership : null,
      v3ContextFingerprint: typeof x.v3ContextFingerprint === 'string' ? x.v3ContextFingerprint : null,
      v3Intervention: x.v3Intervention ? clone(x.v3Intervention) : null,
      v3SemanticSnapshots: x.v3SemanticSnapshots && typeof x.v3SemanticSnapshots === 'object' ? clone(x.v3SemanticSnapshots) : null
    });
  };
  const apply = (base, patch) => {
    const out = base && typeof base === 'object' ? base : {};
    const next = sanitize(patch);
    if (next.v3Spec) out.v3Spec = clone(next.v3Spec);
    if (next.v3DecisionNow) out.v3DecisionNow = next.v3DecisionNow;
    if (next.v3DecisionTimezone) out.v3DecisionTimezone = next.v3DecisionTimezone;
    if (next.v3Ownership) out.v3Ownership = next.v3Ownership;
    if (next.v3ContextFingerprint) out.v3ContextFingerprint = next.v3ContextFingerprint;
    if (next.v3Intervention) out.v3Intervention = clone(next.v3Intervention);
    if (next.v3SemanticSnapshots) out.v3SemanticSnapshots = clone(next.v3SemanticSnapshots);
    return out;
  };
  const freeze = ({ spec, ownership, decisionNow, decisionTimezone, contextFingerprint, intervention, semanticSnapshots } = {}) => sanitize({
    v3Spec: spec, v3Ownership: ownership, v3DecisionNow: decisionNow, v3DecisionTimezone: decisionTimezone, v3ContextFingerprint: contextFingerprint, v3Intervention: intervention, v3SemanticSnapshots: semanticSnapshots
  });
  const api=Object.freeze({version:'cindy-session-contract-v3.0',clone,sanitize,apply,freeze});
  if(typeof window!=='undefined'&&window) window.CINDYSessionContractV3=api;
})();
