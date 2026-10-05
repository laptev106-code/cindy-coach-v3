# CINDY V3.0 Corrective / Hardening Release

**Candidate date:** 2026-10-04  
**Application entry:** `index.html`  
**Coach specification:** CINDY Adaptive Coach V3.0.0  
**Program Pack:** `cindy-program-v3.0.0-four-day-canonical-r1`  
**Deployment/publication:** not performed.

## Confirmed UX pass

- Plan exercise selection/count occupies the main width of one shared surface; up/down arrows sit inside at the right with a subtle divider, no gap and no position numbers. Reorder changes `composition` only, not `target` or `longGoal`.
- Exercise exclusions are edited in Plan through the existing `userRestrictions.excludedExerciseIds` contract; excluded choices remain visible and unavailable. No duplicate Profile exclusion editor remains.
- Progress copy is simplified to “Ваш прогресс по мере тренировок”; 7/28/all-time selectors remain independently available when progress display is disabled.
- Profile fields/disclosures are grouped and keyboard-accessible; Classic/Pro uses the existing persisted `experienceMode`; existing sound setting remains available and persistent in Pro.
- Voice “Пауза” calls the existing pause/session path; “Круг” remains intact. The result modal uses one “ОК” action and returns to Workout; Progress remains a separate screen.
- Workout primary action has distinct ready/live/pressed depth states and honors reduced-motion. Existing local font stacks are reused.
- `trainingExperience` stays disabled/blank in the editor; stored strings round-trip unchanged, and unsupported values remain inert for Coach until an approved enum/rule exists. Matrix-driven eligibility still requires explicit `coachEligibility`; no generic workload effect.

## Verification

- Confirmed UX Chromium DOM/runtime interactions: **PASS** on localhost using a disposable profile.
- Stage 5 presentation checks: **19/19 PASS**.
- Existing pace-guidance Chromium DOM/runtime check: **PASS**.
- Inline JavaScript syntax: **PASS** (five inline script blocks).
- Full master regression: **25/25 PASS**, including the pinned normative acceptance corpus (**102/102 PASS**); standalone release integrity: **PASS**. Final source ZIP: **PASS**, with all 105 members and every packaged file byte compared against the frozen project tree after `--zip-status PASS` generation.
- This author-run browser test is not independent QA. Android/iOS/WebView and production-like-origin behavior remain **NOT VERIFIED**.

The V3.0 normative acceptance corpus remains pinned as `v3.0.0-100` (102 cases). Core/session contracts and Coach scoring are unchanged by this UX pass. See `CINDY_V30_CONFIRMED_UX_IMPLEMENTATION_REPORT_20261004.md`, `CINDY_V30_CONFIRMED_UX_DIFF_INVENTORY_20261004.md`, `RELEASE_NOTES.md` and `RELEASE_INTEGRITY.md` for scope and process.

## Metadata generation and QA handoff

`python3 scripts/update_release_manifests.py --regression-status {PENDING|PASS} --zip-status {PENDING|PASS}` is a **mutating** command: it rewrites the project-release literals in `coach_core_v3/coach_integration_v3.js`, the shell cache identity in `service-worker.js`, and both generated manifests. Refresh `SHA256SUMS.txt` and `CINDY_V30_COACH_4DAY_PROGRAM_SHA256.txt` after generation; rerun the generator after `SHA256SUMS.txt` is refreshed so the manifest records its exact bytes, then refresh the cross-reference list for the final manifests. The Node master test command runs tests and does not itself generate these metadata files.

For the final candidate, run the full suite against the final generated metadata, validate a draft archive, set `--regression-status PASS --zip-status PASS`, refresh checksums, rerun full and standalone integrity tests, and rebuild/byte-compare the delivery ZIP last. Do not edit or regenerate files after the final tree/ZIP comparison; otherwise repeat verification before QA handoff.
