(() => {
  'use strict';
  const clone = value => { if (typeof structuredClone === 'function') { try { return structuredClone(value); } catch (_) {} } return value == null ? value : JSON.parse(JSON.stringify(value)); };
  const executionCompositionSignature = composition => (Array.isArray(composition) ? composition : []).map((item, index) => {
    const x = item && typeof item === 'object' ? item : {};
    return {
      exerciseId: String(x.exerciseId || x.id || ''),
      variantId: x.variantId == null ? null : String(x.variantId),
      count: Number(x.count || 0),
      order: Number.isFinite(Number(x.order)) ? Number(x.order) : index + 1
    };
  });

  const executionFidelity = ({ core, spec, rawRecord }) => {
    if (!spec) return 'UNKNOWN';
    const rec = rawRecord && typeof rawRecord === 'object' ? rawRecord : {};
    // Workout runtime stores the compact form {id, variantId, count};
    // WorkoutSpec stores {slotId, exerciseId, variantId, count, order}.
    // Compare the semantic execution contract, not the two storage shapes.
    const actualComp = executionCompositionSignature(rec.composition);
    const expectedComp = executionCompositionSignature(spec.composition);
    if (JSON.stringify(actualComp) !== JSON.stringify(expectedComp)) return 'PARTIAL';
    if (rec.mode !== spec.mode) return 'PARTIAL';
    if (Number(rec.target || 0) !== Number(spec.target || 0)) return 'PARTIAL';
    if (spec.mode !== 'rounds') {
      const tolerance = Math.min(60, Math.max(1, Number(spec.plannedSeconds || 0)) * 0.05);
      if (Math.abs(Number(rec.plannedSeconds || 0) - Number(spec.plannedSeconds || 0)) > tolerance) return 'PARTIAL';
    }
    if (rec.endedBy === 'manual' || rec.endedBy === 'system') return 'PARTIAL';
    return 'EXACT';
  };
  const create = ({core,raw,spec,ownership,intervention,profileSnapshot,configSnapshot,constraintSnapshot,measurementContract,releaseManifest,decisionTimezone,sessionPurpose='STANDARD',contextFingerprint=null,matrixVersion,sourceMatrixVersion,compatibilityVersion,semanticSnapshotVersion,semanticSnapshotHash,snapshotCapturedAt,snapshotStatus}) => {
    const record = raw && typeof raw === 'object' ? raw : {};
    const now = record.completedAt || null;
    return {
      specVersion:'3.0.0', effectiveTimestamp:now, timezone:decisionTimezone,
      profileSnapshot:clone(profileSnapshot || null), configSnapshot:clone(configSnapshot || null), constraintSnapshot:clone(constraintSnapshot || null),
      semanticSnapshotVersion:semanticSnapshotVersion || null, semanticSnapshotHash:semanticSnapshotHash || null,
      snapshotCapturedAt:snapshotCapturedAt || null, semanticSnapshotStatus:snapshotStatus || 'LEGACY_COMPLETION_FALLBACK',
      profileVersion:profileSnapshot && profileSnapshot.profileVersion || null,
      profileEffectiveFrom:profileSnapshot && profileSnapshot.effectiveFrom || null,
      exerciseMatrixVersion:matrixVersion || null, sourceExerciseMatrixVersion:sourceMatrixVersion || null, compatibilityVersion:compatibilityVersion || null,
      measurementContractVersion:measurementContract && measurementContract.version || null, measurementContract:clone(measurementContract || null),
      decisionNow:(spec && spec.provenance && spec.provenance.decisionNow) || record.v3DecisionNow || now,
      decisionTimezone:(spec && spec.provenance && spec.provenance.decisionTimezone) || decisionTimezone,
      ownership:ownership || null, contextFingerprint, plannedSpecSnapshot:spec ? clone(spec) : null,
      actualExecution:{durationSeconds:Number(record.duration || 0),rounds:Number(record.rounds || 0),endedBy:String(record.endedBy || 'unknown'),composition:clone(record.composition || []),laps:clone(record.laps || [])},
      executionFidelity:executionFidelity({core,spec,rawRecord:record}), sessionPurpose:spec && spec.sessionPurpose || sessionPurpose,
      coachIntervention:intervention ? clone(intervention) : null,
      provenance:{coachOwned:ownership === 'COACH',specId:spec && spec.specId || null,derivedFrom:spec && spec.provenance && spec.provenance.derivedFrom || null,appliedLevers:spec && spec.adaptation && spec.adaptation.levers || [],releaseManifest:clone(releaseManifest || null),decisionQuestion:spec && spec.provenance && spec.provenance.decisionQuestion || null},
      claimConfounders:[]
    };
  };
  const api=Object.freeze({version:'cindy-history-provenance-v3.0',executionFidelity,create});
  if(typeof window!=='undefined'&&window) window.CINDYHistoryProvenanceV3=api;
})();
