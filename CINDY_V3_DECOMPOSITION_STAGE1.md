# CINDY V3.0 — Decomposition Stage 1

## Scope
Stage 1 follows the approved Architecture Map V3.0 and extracts only low-risk boundaries. Active Session, History ownership, `renderAll`, Coach lifecycle, and aggregate persistence remain in the monolith.

## Extracted modules

### `src/domain/exercises/exercise_catalog_v3.js`
Moved out of `index.html`:
- `EXERCISES`
- `EXERCISE_MAP`
- `STANDARD_COMPOSITION`
- `EXERCISE_GUIDE`
- `CINDY_FINAL_COACH_MATRIX`
- pure matrix lookup helpers

Compatibility is preserved through `window.CindyFinalCoachMatrix` and the existing local aliases consumed by the legacy runtime.

### `src/infrastructure/browser/feedback_v3.js`
Moved out of `index.html`:
- haptic feedback
- audio/tone sequence generation
- combined feedback dispatch

The adapter receives application configuration through an explicit `getConfig` port and owns its browser `AudioContext` state locally.

### `src/infrastructure/storage/local_storage_v3.js`
Moved low-level LocalStorage I/O and storage diagnostics behind an explicit adapter:
- JSON read
- JSON write
- remove
- storage error classification/diagnostics

Domain normalization and repository ownership are intentionally not moved yet.

## Main runtime effect
`index.html` now consumes explicit external modules before the main application runtime. The deterministic V3 Coach Core and V3 Integration Adapter were not modified.

## Preserved boundaries
- V3 `coach_core_v3.js` unchanged
- V3 `coach_integration_v3.js` unchanged
- PWA manifest unchanged
- Service worker unchanged
- Program Pack unchanged from the fixed release
- Workout / History / Coach lifecycle wrappers unchanged

## Regression gates
- V3 acceptance: **100/100 PASS**
- Integration E2E: **PASS**
- 4-day program tests: **PASS**, 0 reloads during rotation
- Stage 1 decomposition regression: **8/8 PASS**
- Inline JavaScript syntax checks: **PASS**

## Architectural result
The application has real external boundaries for catalog data, browser feedback, and low-level storage I/O. The monolithic aggregate/state boundary remains intact intentionally; the next stage should introduce versioned repositories and state ownership contracts before moving the active Workout/History lifecycle.

## Change control
This build is a new decomposed copy. The previous fixed V3.0 program bundle remains unchanged.
