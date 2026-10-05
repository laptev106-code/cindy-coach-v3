# CINDY V3.0 — Decomposition Stage 5

## Status

Stage 5 — UI / Navigation decomposition is implemented as a controlled presentation-layer split.

This release is a continuation of `CINDY_V30_DECOMPOSED_STAGE4_20260928`.

### Baseline preserved
- Coach V3 Core SHA-256: `731cd20834b4a94bc14491daaea37858df04975216d3431bb99ea4457c941201`
- Coach Integration V3 SHA-256: `7e55face6e89cf09d6b1473ef7e6a7321f9b7b119c5c0e3c62f09042335dfec9`
- Program Pack V3 SHA-256: `fa190a9511f8bbca34d7d873d226d78265d1c95f66510034624245663ac1c7ab`
- Stage 5 `index.html` SHA-256: `3677b7e80b859bf06edac2416e6853d351991beb62f3b0987c59b339f16cdb74`

No Coach decision rule was changed in Stage 5.

## What changed

### 1. Stable screen ownership
The application now has explicit static screen roots for:
- Workout
- Plan
- Progress
- Profile

The former standalone `settings` screen is removed from the runtime DOM. `settings` remains a compatibility route alias to `profile`, while `history` remains an alias to `progress`.

### 2. Plan ownership
Workout configuration controls are physically owned by the Plan screen. `trainingFormatSetting`, `timeSetting`, and `roundSetting` are grouped under `trainingFormatZone` with explicit reveal containers. No runtime cross-screen move is required for these controls.

### 3. Profile / Progress separation
Profile remains responsible for profile and settings data. Progress owns its own analytics host, `progressAnalytics`, and its own History host.

`renderProgressAnalyticsV3()` constructs analytics content directly in the Progress host. It does not move analytics nodes out of Profile.

### 4. Router / Presenter boundary
Added:
- `screen_router_v3.js` — route normalization and activation.
- `screen_presenter_v3.js` — explicit route → renderer dispatch through injected renderer callbacks.
- `screen_hosts_v3.js` — stable host IDs.
- `leaf_components_v3.js` — small standalone DOM factories.

`show()` now delegates to `CindyScreenPresenterV3` instead of directly owning screen dispatch.

### 5. Runtime structural cleanup
The current runtime contains no `MutationObserver` construction and no calls to the former `stage5Move` / `stage2Move` reparent helpers. Those helpers remain inert compatibility placeholders only.

Experience-mode changes use the visible-screen presentation path rather than forcing the universal `renderAll()` path when the presenter is available.

## What was deliberately not changed

The following remain intentionally outside Stage 5:
- Workout timer/lifecycle ownership.
- History repository and provenance contract.
- Coach V3 Core.
- Coach Application Service and legacy lifecycle adapter.
- Persistence contracts.
- Program rotation logic.
- Bootstrap/legacy retirement.

These are governed by the earlier stages and Stage 6 plan.

## Regression gates

- Master decomposition regression: **9/9 PASS**
- Stage 5 presentation checks: **13/13 PASS**
- V3 acceptance fixtures: **100/100 PASS**
- Integration E2E: **PASS**
- 4-day program rotation: **PASS**
- Stage 4 Coach boundary: **PASS**
- Stage 3 vertical slice: **PASS**
- Stage 2 repositories: **PASS**
- Stage 1 regression: **8/8 PASS**
- Static DOM validation: **PASS**; no duplicate IDs.

## Stage 5 architecture rules now enforced

1. Screen roots have stable DOM ownership.
2. `settings` is an alias, not a second physical screen.
3. Presentation routing is separate from application/domain state.
4. Leaf presentation factories do not read application state or persistence.
5. Cross-screen DOM reparenting is not part of the Stage 5 runtime path.
6. Domain/Coach logic remains outside presentation modules.

## Remaining Stage 5 limitations

`renderAll()` still exists because a number of legacy domain mutations intentionally refresh multiple parts of the existing application. Stage 5 removes it as the route dispatcher, but does not yet eliminate every domain-wide invalidation call. That is deferred until the remaining screen/application commands are migrated safely.

The progress Classic/PRO grouping runtime still performs presentation restructuring within the dedicated Progress host. This is not cross-screen ownership; full conversion to declarative view-model rendering is a later presentation cleanup step.

Browser-rendered UI smoke remains a separate QA gate. The managed Chromium environment used in this workspace blocks local page execution, so this release has been verified through static DOM inspection, runtime/in-process tests and deterministic integration tests rather than a genuine browser-rendered screenshot pass.

## Next stage

Stage 6 — Bootstrap / Legacy retirement:
- remove embedded V2.8 Coach after consumer scan;
- retire V2.8 state and wrappers;
- remove temporary compatibility bridges;
- remove obsolete program/storage bootstrap logic;
- simplify the final composition root.
