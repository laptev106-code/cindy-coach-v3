(() => {
  'use strict';
  const clone = value => { if (typeof structuredClone === 'function') { try { return structuredClone(value); } catch (_) {} } return value == null ? value : JSON.parse(JSON.stringify(value)); };
  const create = ({sessionContract,provenance}) => {
    if (!sessionContract || !provenance) throw new TypeError('Stage3 workout/history dependencies are required');
    const freezeForStart = ({spec,ownership,decisionNow,decisionTimezone,contextFingerprint,intervention,semanticSnapshots}) => sessionContract.freeze({spec:clone(spec),ownership,decisionNow,decisionTimezone,contextFingerprint,intervention:clone(intervention),semanticSnapshots:clone(semanticSnapshots)});
    const restoreSessionContract = (base,raw) => sessionContract.apply(base,raw);
    const decorateHistoryRecord = ({raw,spec,ownership,intervention,snapshots}) => { const record=clone(raw); record.v3=provenance.create({...snapshots,raw:record,spec:clone(spec),ownership,intervention:clone(intervention)}); return record; };
    const linkInterventionCompletion = ({intervention,record}) => { if(!intervention||!record||!record.v3||!record.v3.coachIntervention)return intervention; const fidelity=record.v3.executionFidelity; return {...clone(intervention),childRecordId:record.id,childRecord:clone(record),fidelity,status:fidelity==='EXACT'||fidelity==='SUFFICIENT'?'EXECUTED':'EXECUTED_LOW_FIDELITY'}; };
    return Object.freeze({version:'cindy-workout-history-service-v3.0',freezeForStart,restoreSessionContract,decorateHistoryRecord,linkInterventionCompletion});
  };
  window.CINDYWorkoutHistoryServiceV3 = Object.freeze({create});
})();
