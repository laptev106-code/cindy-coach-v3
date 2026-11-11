/**
 * CINDY COACH V3 — HEADLESS PURE CORE ENGINE
 * 100% Platform-Independent (Zero DOM, Zero window, Zero React dependencies)
 * Executable in Node.js, Web PWA, Web Worker, and React Native (Expo).
 */

const { CINDYSessionContractV3 } = require('../domain/workout/session_contract_v3.js');
const exerciseCatalog = require('../domain/exercises/exercise_catalog_v3.js');
const CindyAdaptiveCoachV3 = require('../../coach_core_v3/coach_core_v3.js');
const programPack = require('../../coach_core_v3/program_pack_v3.js');

function calculateExerciseTotals(composition, completedRounds) {
  const safeComp = Array.isArray(composition) ? composition : [
    { id: 'pull', count: 5 },
    { id: 'push', count: 10 },
    { id: 'squat', count: 15 }
  ];
  const rounds = Math.max(0, Number(completedRounds) || 0);
  const totals = {};
  for (const item of safeComp) {
    totals[item.id] = (Number(item.count) || 0) * rounds;
  }
  return totals;
}

function calculatePace(elapsedSeconds, rounds) {
  const sec = Math.max(0, Number(elapsedSeconds) || 0);
  const r = Math.max(0, Number(rounds) || 0);
  if (r === 0 || sec === 0) return { avgLapSeconds: 0, formattedPace: '--:--' };
  const avg = Math.round(sec / r);
  const mins = Math.floor(avg / 60);
  const remainingSec = avg % 60;
  return {
    avgLapSeconds: avg,
    formattedPace: `${mins}:${remainingSec.toString().padStart(2, '0')}`
  };
}

module.exports = {
  CoachCore: CindyAdaptiveCoachV3,
  programPack,
  calculateExerciseTotals,
  calculatePace,
  STANDARD_COMPOSITION: [
    { id: 'pull', count: 5, name: 'Подтягивания' },
    { id: 'push', count: 10, name: 'Отжимания' },
    { id: 'squat', count: 15, name: 'Приседания' }
  ]
};
