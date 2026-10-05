# CINDY Lite V1 — implementation notes

## Current Coach behavior (2026-10-04)

The Lite build marker now controls presentation only. It does **not** disable Coach authority or lifecycle participation.

- Fresh Coach preference defaults to **ON**. Only an explicit persisted user choice overrides the default; legacy Lite-forced `false` values without preference provenance are treated conservatively as default ON.
- Coach is globally fail-closed OFF unless runtime binding, persisted preference, storage access, and validated V2.8 migration are all available.
- Persistent Coach, Classic/Pro, and Development mode controls are in **Profile → Settings → Interface**. The Settings shortcut focuses that section; Development mode still controls its optional Profile trajectory.
- Baseline setup/readiness, current Coach status, recommendation actions (**Apply**, **Not now**, **How it works?**) are on **Plan**. Workout-specific controls stay on Plan; the optional workout-local Coach overlay remains hidden in Lite presentation.
- Profile editing includes training experience, available equipment, and exercise/family restrictions.
- V2.8 data is backed up and kept byte-for-byte unless its schema is fully mapped, the V3 state is verified, and a migration receipt is verified. Unsupported V2.8 fields leave the legacy key intact and Coach disabled with a specific blocker.
- Coach OFF closes pending, unstarted baseline/intervention authority. Turning Coach back ON does not resume it. A Coach-owned session already started keeps its frozen WorkoutSpec and start-time semantic provenance and may finish without new post-OFF Coach state or actions.
- User workout records and History editing/deletion remain available. Editing a Coach-provenance record invalidates that record's Coach comparisons while retaining the user-visible History record.

## Preserved presentation behavior

- Workout timer, manual workout composition and variants.
- History persistence, statistics, achievements, and progress.
- Manual templates/programs and Lite branding.
- The Lite UI continues to omit the optional workout-local Coach overlay; Plan Coach surfaces and persistent Profile settings remain available.

## Superseded staging decision

The earlier temporary Lite staging notes below described Coach as disabled and hidden. That staging decision was replaced by the explicit implementation plan on 2026-10-04; it is retained here only as historical context and is not the current product behavior.
