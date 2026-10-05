# CINDY V3 — Decomposition Stage 3

## Scope
Stage 3 implements the architecture-map requirement to establish the Workout + Active Session + History + Provenance vertical slice without moving the timer/DOM lifecycle wholesale.

## Extracted boundaries
- `src/domain/workout/session_contract_v3.js` — explicit V3 frozen-session contract and reload-safe V3 session fields.
- `src/domain/history/history_provenance_v3.js` — pure History V3 provenance and execution-fidelity logic.
- `src/application/workout/workout_history_service_v3.js` — application-level coordinator used by the V3 integration adapter for session freeze, History decoration, and intervention linkage.

## Deliberately not moved yet
- `freshSession`, `startResume`, `pause`, `addLap`, `finish` remain in the legacy runtime as lifecycle coordinators.
- canonical History normalization and History UI remain in the monolith.
- Coach Core is unchanged.
- persistence repositories from Stage 2 remain unchanged.

## Runtime path after Stage 3
`START → Stage3 frozen-session contract → active legacy session → record() → Stage3 provenance service → History repository → next Coach decision`

## Invariants preserved
- V3 `WorkoutSpec` is cloned when frozen and survives reload normalization.
- V3 provenance remains attached to the completed History record.
- execution fidelity remains deterministic for the same input/spec.
- Coach ownership/intervention linkage remains unchanged semantically.
- the V3 deterministic decision core remains isolated from DOM and LocalStorage.

## Tests
- Stage 3 unit/contract tests: PASS.
- V3 acceptance: 100/100 PASS.
- Integration E2E: PASS.
- Program rotation: PASS.
- Stage 1 regression: PASS.
- Stage 2 repository tests: PASS.

## Next stage
Stage 4 should convert `coach_integration_v3.js` from a global lifecycle wrapper into an explicit `CoachApplicationService` using session/history/config providers and mutation ports. Do not start UI/navigation extraction before that boundary is stable.
