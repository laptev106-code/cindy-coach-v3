# CINDY V3.0 — Coach test preparation hotfix

## Problem

The UI displayed the fixed test picker correctly, but selecting 5/10/20 minutes could return `Не удалось подготовить тест.` on a fresh configuration.

Root cause: the fixed standard test uses the canonical pull-up exercise, which requires `pullupBar` in the Coach exercise matrix. A fresh optional equipment profile contained no explicit `pullupBar: true`, so the real CoachCore validation rejected the baseline test spec with `equipment` before the Workout screen could be prepared.

The earlier application-level cold-start tests did not catch this because they used a mocked CoachCore path rather than the real CoachCore + application integration.

## Fix

The baseline test preparation now treats the fixed standard test as an explicit product protocol and supplies the protocol's required pull-up equipment capability for validation. This does not change ordinary Coach recommendations: those still use the user's actual equipment constraints.

No change was made to `coach_core_v3/coach_core_v3.js`.

## Verification

- Real CoachCore + real application-service baseline integration: **PASS**
- Coach test engine: **PASS**
- Coach cold-start: **PASS**
- Four-day program: **PASS**
- Master regression: **16/16 PASS**
- Final HTML runtime smoke: **25/25 scripts, 0 runtime errors, bootstrap ready**

The new real-Core integration regression is shipped as:

`tests/run_baseline_real_core_integration_test.cjs`

## Remaining manual gate

Real device/WebView verification remains a separate manual check.
