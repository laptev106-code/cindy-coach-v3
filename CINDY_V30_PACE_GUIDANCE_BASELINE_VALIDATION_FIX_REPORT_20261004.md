# CINDY V3.0 — Pace Guidance Freeze and Canonical Baseline Validation

**Candidate:** `CINDY_V3_ADAPTIVE_COACH_IMPLEMENTATION_20261004`  
**Status:** Implementation change only; independent QA must rerun the final hash. No release acceptance, deployment, or publication is claimed.

**Final candidate identifiers:** `releaseSourceHash` `8c06d5449d28c11bd9e7a375e60e9bf09db28a18a7802b2f5983ebe96deb46e5`; `releaseBuildHash` `7cea74939cc3d887f104ee1e2a0fbdc3ed82bf07d2ce76e056729b75d893a941`.

## Scope

This follow-up addresses two bounded QA findings:

1. A Plan-selected `paceGuidance` value was visible and persisted, but the Coach `prepareForStart()` path did not reliably carry it into the frozen session.
2. After Coach OFF → same-ID invalid baseline import → ON, a first direct `CindyCoachIntegration.derive()` could reach CoachCore before a readiness/render path had validated the canonical baseline.

The unresolved `trainingExperience` enum decision was not changed. No CoachCore adaptation code or WorkoutSpec schema was changed.

## Contract trace and implementation choice

- Normative specification §D1 (CoachInput, lines 218–235) includes `config` as a supported core input. The application config snapshot now retains `paceGuidance` and supplies it through that existing input object; no new adaptation semantics are assigned to the value.
- Normative specification §Z (WorkoutSpec, lines 2295–2345) defines the validated executable decision artifact. It does not list `paceGuidance`; accordingly, this fix does **not** add it to WorkoutSpec.
- In combined (`Time + rounds`) mode, `prepareForStart()` captures the current config snapshot and constructs `sessionRuntime.paceGuidance` from that value. The actual start/commit path freezes the runtime setting with the Coach session contract. The explicit `false` case remains false.
- When Coach is OFF, the existing manual workout constructor and its persisted Plan preference are unchanged.
- Before application-level derive/start work, the service now rechecks the canonical baseline row associated with `baselineRecordId`. If it is missing or invalid, the stale baseline ID/timestamp/authority are cleared and the existing `buildInput()` baseline-ID filter excludes that BASELINE row before CoachCore receives input. The core algorithm itself remains untouched.

The normative contract therefore supports preserving this execution preference through `CoachInput.config` and frozen session runtime metadata; it neither requires nor justifies adding a WorkoutSpec field.

## Regression coverage

- Real browser-like app runtime + real CoachCore + real Coach application service: combined-mode `true` and explicit `false` across `prepareForStart()` → session start → `commitStart()` → persisted session reload.
- Asserts `paceGuidance` is present in CoachInput.config, absent from WorkoutSpec, present in the frozen Coach session/snapshot, and restored on reload.
- Confirms the manual workout path retains its pre-existing behavior.
- No-precondition baseline fixture re-enables Coach without calling readiness or rendering, then invokes `CindyCoachIntegration.derive()` as the first public derive. It verifies the invalid same-ID baseline is absent from CoachCore history input and stale baseline state is cleared.

## Changed-file inventory

- `src/application/coach/coach_application_service_v3.js` — CoachInput config projection, runtime freeze, and canonical baseline preflight/cleanup.
- `tests/run_real_post_test_browser_lifecycle.cjs` — Coach freeze/reload and direct-derive invalid-baseline fixtures.
- `tests/run_pace_guidance_coach_freeze_tests.cjs` — targeted pace-guidance lifecycle runner.
- `tests/run_coach_off_session_tests.cjs` — runs the new invalid-baseline fixture within the full regression gate.
- `tests/run_regression_tests.cjs` — includes the targeted Coach pace-guidance test.
- `tests/run_release_integrity_tests.cjs` — synchronized expected verification-path inventory and 24-gate assertion.
- `scripts/update_release_manifests.py` — release paths/status and actual master-gate count.
- `RELEASE_README.md`, `RELEASE_NOTES.md` — candidate status and verification summary.
- `release-manifest.json`, `decomposition-manifest.json`, `service-worker.js`, `coach_core_v3/coach_integration_v3.js` — generator-produced inventory/hash/cache identity updates as applicable.
- `CINDY_V30_PACE_GUIDANCE_BASELINE_VALIDATION_FIX_REPORT_20261004.md` — this report and handoff.

## Verification record

All listed checks passed in the candidate runtime/build hash, and this report is included in the verified artifact inventory. Independent QA must still rerun the final hash before any release acceptance.

| Command | Result |
|---|---|
| `node tests/run_pace_guidance_coach_freeze_tests.cjs` | PASS — Coach true/false frozen and reloaded; manual path unchanged |
| `CINDY_TEST_HISTORY_OFF_BASELINE=v3-invalid node tests/run_real_post_test_browser_lifecycle.cjs` | PASS — direct derive first; invalid baseline excluded and stale authority/ID cleared |
| `node tests/run_coach_off_session_tests.cjs` | PASS — includes direct-derive fixture plus OFF lifecycle/failure cases |
| `node tests/run_v3_acceptance_tests.cjs` | PASS — 102/102 normative cases |
| `node tests/run_regression_tests.cjs` | PASS — 24/24 master gates |
| `node tests/run_release_integrity_tests.cjs` | PASS — exact artifact set, hashes, cache identity, and manifest self-hashes |

## Remaining limits and handoff

- Independent QA must rerun this exact final `releaseSourceHash`/`releaseBuildHash`; the implementation does not claim release acceptance.
- No deployment or publication occurred.
- Native Android/iOS/WebView, extracted-package verification, and real-device behavior remain outside this run.
- No MCP or external connector was enabled or used.
- The `trainingExperience` enum remains blocked pending the user's decision; this change does not touch that field.
