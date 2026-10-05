# CINDY V3.0 — Four-Day Program Integration Report

**Date:** 28 September 2026
**Base release:** `CINDY_V30_COACH_TEST_CALIBRATED_20260928_FINAL`
**Change:** canonical four-day training program integrated without changing CoachCore decision policy.

## Four canonical days

1. **Cindy — классика** — 20 min, 10 rounds: 5 pull-ups, 10 push-ups, 15 squats.
2. **Cindy — классика 10** — 10 min, 7 rounds: 5 pull-ups, 10 push-ups, 15 squats.
3. **Cindy — вариант** — 20 min, 15 rounds: 5 supinated pull-ups, 10 knee push-ups, 15 squats.
4. **Cindy — смешанная 15** — 15 min, time-only: 5 narrow pull-ups, 10 classic push-ups, 15 squats, 10 narrow push-ups.

The active Program Pack now references the existing canonical built-in templates by ID. It no longer creates a second hidden set of program-only workout templates or four unrelated cycle variants. After Day 4, the active program returns to Day 1.

## Engineering changes

- `coach_core_v3/program_pack_v3.js`: Program Pack now assembles the four canonical template IDs directly.
- `index.html`: canonical built-in template names are Russian-only (except the Cindy name), and the 15-minute mixed workout has no round target.
- `tests/run_v3_program_tests.cjs`: verifies the exact four-day definition and Day-4 idempotent return to Day 1.
- `tests/run_regression_tests.cjs`: keeps the complete 16-gate regression.

## Verification

- Program four-day definition + rotation: **PASS**
- Program transition hardening: **PASS**
- Coach cold start: **PASS**
- Coach test engine: **PASS**
- Integration E2E: **PASS**
- V3 normative acceptance: **100/100 PASS**
- Master regression: **16/16 PASS**
- Final HTML runtime smoke: **25/25 scripts, 0 runtime errors, bootstrap ready**
- JavaScript syntax checks: **PASS**

## Scope boundary

CoachCore policy was not redesigned. The change only defines the canonical four-day Program sequence and its reusable built-in workouts.

Real Android/iOS/WebView QA remains a separate manual gate.
