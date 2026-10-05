# CINDY V3.0 — Post-Test Starter Personalization Fix

## Problem

After a real user completed the fixed test, History contained the completed workout but the Coach UI could remain in the test-prepared state. The end-to-end path also had no authorized first post-test personalization step.

## Root causes

1. The browser Workout runtime stores composition in compact form (`id/variantId/count`) while V3 `WorkoutSpec` stores semantic form (`exerciseId/variantId/count/order`). The old execution-fidelity comparison treated these shapes as unequal, so a real baseline completion could be classified as partial.
2. The application now has an explicit post-test starter phase; the completed test exits the cold-start gate and allows the first recommendation immediately.
3. Normal long-term progression still requires stronger evidence, but the product contract requires a first conservative personalization step immediately after the test.

## Fix

- Execution fidelity now compares semantic composition signatures, independent of runtime/spec storage shape.
- A successful real test persists `baselineRecordId` and exits the test-pending state.
- New application phase: `STARTER_READY`.
- `Apply` is allowed in `STARTER_READY`; after application, normal evidence collection resumes.
- CoachCore now has a bounded `STARTER_PERSONALIZATION` branch: one exercise variant may change after an exact/sufficient test, without increasing total workload.
- The first branch uses the existing Exercise Matrix and deterministic candidate selection; it does not create a second physiological scoring model.
- A completed test immediately triggers a fresh Coach derivation and refreshes Workout/Plan presentation.
- Program, History, ownership and persistence boundaries remain unchanged.

## Verification

- Coach cold-start: PASS
- Baseline real-core integration: PASS
- Real runtime completion regression: PASS
- First post-test ADAPT regression: PASS
- V3 acceptance: 100/100 PASS
- Master regression: 17/17 PASS after manifest update and post-test lifecycle regression
- Program four-day regression: PASS
- Program transition hardening: PASS
- Domain boundary: PASS
- Final HTML runtime smoke: 25/25 scripts, 0 runtime errors

## Current Coach Core hash

`faf9280a396b9c3b5591cfa5f4573ef08e3aff2767c3f9aba467192bb5238580`
