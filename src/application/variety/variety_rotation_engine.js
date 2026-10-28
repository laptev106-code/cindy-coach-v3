(() => {
  'use strict';

  function clone(val) {
    if (val == null) return val;
    return JSON.parse(JSON.stringify(val));
  }

  function getEligibleVariants(baseId, { matrix, equipment = {}, excludedVariantIds = [] } = {}) {
    if (!matrix || !matrix.variants) return [];
    const all = Object.values(matrix.variants).filter(v => {
      if (baseId === 'dip') return v.id === 'push_parallel_bar_dip';
      return v.base === baseId && v.id !== 'push_parallel_bar_dip';
    });

    return all.filter(v => {
      if (excludedVariantIds.includes(v.id)) return false;
      if (v.manualOnly) return false;
      if (Array.isArray(v.equipment)) {
        for (const req of v.equipment) {
          if (!equipment[req]) return false;
        }
      }
      return true;
    });
  }

  function getRecentVariantUsage(history = [], baseId, lookbackCount = 3) {
    const used = [];
    for (const record of history.slice(0, 10)) {
      if (!record || !Array.isArray(record.composition)) continue;
      for (const item of record.composition) {
        if (item.id === baseId && item.variantId) {
          if (!used.includes(item.variantId)) {
            used.push(item.variantId);
          }
        }
      }
      if (used.length >= lookbackCount) break;
    }
    return used;
  }

  function scaleRepsForVariant(baseCount, baseDefaultDifficulty, variantDifficulty) {
    if (!variantDifficulty || !baseDefaultDifficulty || baseCount <= 0) return baseCount;
    const ratio = baseDefaultDifficulty / variantDifficulty;
    const raw = Math.round(baseCount * ratio);
    return Math.max(1, Math.min(raw, Math.round(baseCount * 2.5)));
  }

  function rotateSlot(slotItem, { matrix, equipment = {}, excludedVariantIds = [], history = [], currentVariantId = null } = {}) {
    const baseId = slotItem.id;
    const eligible = getEligibleVariants(baseId, { matrix, equipment, excludedVariantIds });
    if (!eligible.length) {
      return { ...slotItem };
    }

    const defaultVariantId = matrix.baseDefaults && matrix.baseDefaults[baseId];
    const defaultVariant = defaultVariantId ? matrix.variants[defaultVariantId] : null;
    const baseDefaultDifficulty = defaultVariant ? defaultVariant.difficulty : 50;

    const recentUsed = getRecentVariantUsage(history, baseId, 3);
    const activeCurrent = currentVariantId || slotItem.variantId;
    if (activeCurrent && !recentUsed.includes(activeCurrent)) {
      recentUsed.unshift(activeCurrent);
    }

    let candidates = eligible.filter(v => !recentUsed.includes(v.id));

    if (!candidates.length) {
      const ranked = eligible.slice().sort((a, b) => {
        const idxA = recentUsed.indexOf(a.id);
        const idxB = recentUsed.indexOf(b.id);
        const rankA = idxA === -1 ? 999 : idxA;
        const rankB = idxB === -1 ? 999 : idxB;
        return rankB - rankA;
      });
      candidates = [ranked[0]];
    }

    const selected = candidates[0];
    const baseCount = slotItem.baseCount || slotItem.count || 10;
    const scaledCount = scaleRepsForVariant(baseCount, baseDefaultDifficulty, selected.difficulty);

    return {
      id: baseId,
      variantId: selected.id,
      count: scaledCount,
      baseCount: baseCount
    };
  }

  function rotateComposition(composition, { matrix, equipment = {}, excludedExerciseIds = [], excludedVariantIds = [], history = [] } = {}) {
    if (!Array.isArray(composition) || !composition.length) return composition;

    return composition.map(slot => {
      if (excludedExerciseIds.includes(slot.id)) {
        return { ...slot };
      }
      return rotateSlot(slot, {
        matrix,
        equipment,
        excludedVariantIds,
        history,
        currentVariantId: slot.variantId || null
      });
    });
  }

  const VarietyRotationEngine = Object.freeze({
    getEligibleVariants,
    scaleRepsForVariant,
    rotateSlot,
    rotateComposition
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VarietyRotationEngine };
  }
  if (typeof window !== 'undefined') {
    window.CINDYVarietyRotationEngine = VarietyRotationEngine;
  }
})();
