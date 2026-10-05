# CINDY V3.0 Corrective / Hardening Report

**Date:** 2026-09-28  
**Baseline:** `CINDY_V30_FINAL_DECOMPOSED_20260928`  
**Scope:** corrective/hardening pass only; no Coach policy redesign  
**Final status:** `RELEASE-READY WITH KNOWN LIMITATIONS`

## 1. Executive Summary

The corrective pass started from the paused Manus working copy. The original baseline was preserved unchanged.

The following blocking defects were fixed:

- stale executable V1 Coach integration reference in `index.html`;
- runtime initialization order for `configRepository`;
- duplicate Program transition path from `finish()`;
- stale Day-4 program rotation;
- split ProgramState transition ownership;
- malformed/empty `program.days` handling;
- Program persistence failure rollback paths;
- missing release-level final HTML execution gate.

No change was made to `coach_core_v3/coach_core_v3.js`. The 100-fixture Coach acceptance corpus remains 100/100 PASS.

## 2. Program Transition Hardening

`ProgramServiceV3.completeWorkoutTransition()` is now the authoritative completion transition.

It validates:

- event shape and record ID;
- program identity;
- active ProgramState;
- current day index;
- program structure;
- duplicate/replay events, including previously processed record IDs retained in Program metadata.

A valid Day-4 event rotates exactly once. `ProgramPackV3` provides the rotation patch through `prepareCycleRotation()` and no longer mutates ProgramState from `onWorkoutFinished()`.

Targeted hardening tests cover stale events, replay, wrong program, wrong day, malformed program, config-write failure, metadata-write failure and retry.

## 3. Runtime / Bootstrap

The stale `cindyCoachCoreIntegrationLegacyV1Module` reference was removed instead of restoring a retired V1 module.

A new release-level final HTML smoke executes all 25 script blocks in a browser-like VM and asserts:

- `CINDYAppRuntimeV3` exists;
- `CindyCoachIntegration` exists and is bound;
- `CINDYProgramServiceV3` exists;
- `CindyProgramPackV3` exists;
- `CINDYBootstrapV3.ready === true`;
- zero script execution errors occur.

The smoke test passes.


## 3a. Additional Independent Hardening Review

After the initial corrective pass, an additional replay scenario was reviewed: an older completed workout could theoretically be replayed after later ProgramState transitions if only the most recent record ID were retained.

The transition metadata now retains `processedRecordIds`, and both normal day advancement and Day-4 rotation preserve this ledger. A regression test confirms that a previously processed record remains rejected after a later accepted transition.

The application `finish()` path now has exactly one authoritative `completeWorkoutTransition(result)` call and no fallback to the legacy `advanceAfterWorkout()` path.

This is still idempotency metadata, not a multi-key LocalStorage transaction. Persistence failure guarantees remain snapshot/write/rollback semantics.

## 4. Domain Boundary

Domain modules now tolerate non-browser loading and publish browser globals only when `window` exists.

This is a safe compatibility boundary for the current script-loader architecture. It is not a full native-module conversion.

## 5. Tests

- V3 acceptance: **100/100 PASS**
- Program hardening: **PASS**
- Domain boundary: **PASS**
- Stage 1: **9/9 PASS**
- Stage 2: **PASS**
- Stage 3: **PASS**
- Stage 4: **7/7 PASS**
- Stage 4 Coach boundary: **PASS**
- Stage 5: **13/13 PASS**
- Stage 6: **PASS**
- Stage 7: **PASS**
- In-process E2E: **PASS**
- Final HTML runtime smoke: **PASS (25 script blocks, zero script execution errors)**
- Master regression: **14/14 PASS**
- All shipped JavaScript syntax checks: **PASS**

## 6. Real Browser / Device Verification

A real Chromium binary is present in the available environment, but launching the final local application timed out without producing a DOM result. Therefore real Chromium/WebView execution is not claimed as verified.

Android/iOS device verification was not performed.

## 7. Known Limitations

- The broad application `config` aggregate remains.
- The current script-loader architecture still uses conditional `window` publication in Domain modules.
- External context/data-quality pipeline is not yet a dedicated application-owned adapter.
- Multiple-tab locking/ownership remains unsupported/unknown.
- Real Chromium/WebView execution remains unverified in this environment; browser-like VM verification is not a substitute.

These are not blockers for the corrective pass itself, but they remain architectural limitations.

## 8. Files Changed in the Corrective Pass

- `index.html`
- `coach_core_v3/program_pack_v3.js`
- `src/application/program/program_service_v3.js`
- `src/composition/bootstrap_v3.js`
- `src/domain/exercises/exercise_catalog_v3.js`
- `src/domain/history/history_provenance_v3.js`
- `src/domain/workout/session_contract_v3.js`
- `tests/run_final_html_runtime_smoke.cjs`
- `tests/run_program_transition_hardening_tests.cjs`
- `tests/run_domain_boundary_tests.cjs`
- related regression gates and release metadata

## 9. Release Integrity

Final ZIP hash is generated only after clean-package verification. The final release manifest and decomposition manifest are included in the package.
