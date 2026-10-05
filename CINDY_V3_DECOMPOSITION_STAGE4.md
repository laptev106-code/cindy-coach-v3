# CINDY V3 — Decomposition Stage 4

## Scope

Stage 4 converts the V3 Coach integration boundary from a global-state-heavy integration block into an explicit application-service boundary while preserving the legacy browser lifecycle through a thin compatibility adapter.

This stage is based on the Stage 3 release and the approved V3 architecture map. The deterministic Coach Core was not modified.

## Changes

### 1. CoachApplicationServiceV3

New module:
`src/application/coach/coach_application_service_v3.js`

Responsibilities moved into the application service:
- Coach input assembly from explicit ports.
- Ownership resolution.
- Decision preparation.
- Coach Apply command generation.
- START freeze preparation and commit.
- History record decoration orchestration.
- Intervention completion reconciliation.
- Coach state transitions.

The service does not access `window`, DOM, LocalStorage, browser APIs, or legacy lifecycle functions directly.

### 2. Explicit application ports

The service receives explicit ports for:
- config
- session
- history
- context
- matrix
- external context
- activity state
- clock
- rendering
- baseline authority
- workout/history vertical slice
- Coach state repository

### 3. Coach state repository

New module:
`src/infrastructure/storage/coach_state_repository_v3.js`

`cindyCoachV3State` is now persisted through an explicit repository boundary rather than being read and written directly by the application service.

### 4. Browser compatibility adapter

`coach_core_v3/coach_integration_v3.js` is now composition/compatibility code. It is responsible for wiring the ports and preserving the required legacy lifecycle wrappers:
- `setConfig`
- `normalizeSession`
- `startResume`
- `record`
- `finish`

The adapter also preserves the existing public compatibility surfaces:
- `window.CindyCoachIntegration`
- `window.CindyCoachV3`
- `window.applyCoachAdjustment`

### 5. Side-effect boundary

The new service separates:
- `deriveDecision()` — no state persistence;
- `prepare()` — decision plus optional explicit state persistence;
- `apply()` — explicit configuration mutation;
- `prepareForStart()` / `commitStart()` — explicit lifecycle operations.

This removes the architectural requirement that a pure UI read must itself write Coach state.

## Preservation guarantees

The following behavior was retained and verified:
- V3 decision authority remains `COACH_CORE_V3`.
- V3 Core source is unchanged.
- 100 acceptance fixtures remain green.
- START freezes the same V3 WorkoutSpec contract.
- History still receives V3 provenance and execution fidelity.
- Builder mutation invalidates Coach ownership.
- deterministic `specId` / `contextFingerprint` behavior is preserved.
- 4-day program rotation remains unchanged.
- Stage 1, Stage 2 and Stage 3 decomposition contracts remain green.

## Regression result

Master Stage 4 regression:
**7/7 PASS**

Included:
- V3 acceptance: 100/100
- Stage 1 static decomposition checks: PASS
- Stage 2 repository checks: PASS
- Stage 3 vertical slice: PASS
- Stage 4 Coach boundary: PASS
- 4-day program rotation: PASS
- integration E2E: PASS

## Important test-history note

The historical Stage 1 hash checker intentionally expects the Stage 1 integration file hash. Stage 4 deliberately changes that integration file as part of the Coach boundary extraction, so that historical hash assertion is no longer a valid current-release gate. The new Stage 4 regression runner replaces that check with explicit validation of the new application-service boundary while retaining all behavioral regression coverage.

## Remaining architecture

The application is still not fully decomposed. The next architecture-map stage remains UI/navigation and screen ownership after the Coach boundary is stabilized.

Stage 4 does not remove the legacy V2.8 implementation or the legacy lifecycle wrappers. Those remain compatibility debt to be retired only after consumer migration and characterization gates.
