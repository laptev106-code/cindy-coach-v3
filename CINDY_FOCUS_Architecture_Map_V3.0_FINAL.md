# CINDY / FOCUS — Architecture Map V3.0 FINAL

## Status

This is the current static architecture map after Decomposition Stage 7. It supersedes the Stage 6 map where statements conflict. It describes the release structure and does not claim real browser/Android execution.

## Current runtime shape

```text
Presentation
  ↓
Application
  ├─ CoachApplicationServiceV3
  ├─ ProgramServiceV3
  └─ WorkoutHistoryServiceV3
  ↓
Domain
  ├─ CoachCoreV3
  ├─ ExerciseCatalogV3
  ├─ SessionContractV3
  └─ HistoryProvenanceV3
  ↑
Infrastructure
  ├─ Config/Session/History/Cloud repositories
  ├─ CoachStateRepositoryV3
  ├─ ProgramMetaRepositoryV3
  └─ Browser feedback / PWA adapters

Composition
  └─ bootstrap_v3.js
```

## Major modules

| Module | Responsibility | Boundary status |
|---|---|---|
| Coach Core V3 | deterministic decision engine, evidence, candidates, WorkoutSpec, validation, provenance | isolated/pure |
| Coach Integration V3 | compatibility adapter between app runtime and CoachApplicationService | explicit runtime bound |
| CoachApplicationServiceV3 | application orchestration around CoachCore | explicit ports |
| ExerciseCatalogV3 | exercise/matrix catalog compatibility surface | extracted |
| Workout/History service | session/history vertical lifecycle helpers | extracted boundary |
| ProgramServiceV3 | ProgramState advancement after completed workout | explicit runtime |
| Program Pack V3 | 4-day program definitions and cycle rotation | explicit runtime + metadata port |
| ProgramMetaRepositoryV3 | `cindyV3ProgramMeta` persistence | infrastructure-only storage |
| Repository layer | Config/Session/History/Cloud persistence | explicit repositories |
| Screen Router/Presenter | route and presentation ownership | extracted |
| Bootstrap V3 | final composition and explicit binding | isolated composition root |
| Legacy V2.8 | old Coach runtime/API/wrappers | retired |

## Critical data flow

```text
Profile + Config + History
        ↓
   Coach Context
        ↓
   CoachCoreV3
        ↓
   WorkoutSpec
        ↓
 Application / START freeze
        ↓
 Active Session
        ↓
 History + provenance
        ↓
 next Coach decision
```

## Ownership

- Coach decision state → CoachApplicationServiceV3 / CoachStateRepositoryV3.
- Program state → ProgramServiceV3 + Config repository boundary.
- Program metadata → ProgramMetaRepositoryV3.
- Active Session → existing Workout/session contract + repository.
- History → History repository + provenance service.
- Exercise matrix → ExerciseCatalogV3.
- UI route/presentation → Screen Router/Presenter.

## Rules verified in Stage 7

- Coach Core does not access DOM, LocalStorage, browser timing, random or window globals.
- Domain/application/presentation source contains no raw LocalStorage calls.
- Program Pack does not patch LocalStorage or reload the page.
- Lifecycle functions are not monkey-patched.
- V2.8 public surfaces are retired.
- Program completion uses explicit application service/event calls.
- `WorkoutSpec` remains the cross-module execution contract.

## Remaining known gaps

### Config aggregate
`config` is still a large legacy closure aggregate. Service/repository boundaries exist, but a full split into independent Profile, WorkoutConfig, ProgramState, UISettings and CoachConstraints owners is a future refactor, not silently claimed as complete.

### External context
The V3 input boundary exists, but a complete app-owned chain for `ExternalContext → Data Quality → Interpretation → Coach Context` is not yet a separate module tree.

### Browser QA
Real browser-rendered and Android/WebView execution remains unverified in the managed environment.

## Final assessment

The application has moved from a legacy monolith with a separately extracted Coach core to a **layered hybrid application with explicit domain/application/infrastructure/presentation boundaries and retired V2.8 runtime ownership**. Stage 7 removes the last identified storage/ProgramState coupling that was safe to address without introducing a new high-risk state migration.
