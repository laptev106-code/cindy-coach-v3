# CINDY V3.0 — 4-day Program Integration / Final Architecture Report

Date: 2026-09-28
Program Pack: `cindy-program-v3.0.0-4day-rotation-r3`

## Architecture correction history

The initial 4-day program implementation caused preview flicker because it intercepted `localStorage.setItem()` and used `location.reload()`.

That implementation was removed. The current program path is fully explicit:

`CINDYAppRuntimeV3 → ProgramServiceV3 / ProgramPackV3 → repositories`

There is no page reload and no storage monkey-patching.

## Current contract

- Day 1: **10 minutes + 7 rounds**, classic composition.
- Days 2–4: **10 minutes + exactly 3 exercises** each.
- Day 4 completion rotates the three non-classic combinations.
- Four deterministic cycle variants are supported.
- The same completion record cannot rotate twice.

## Current cycle examples

Cycle 1:
`abs+pull+push | abs+burpee+squat | dip+push+squat`

Cycle 2:
`dip+pull+squat | abs+burpee+push | abs+dip+pull`

## Architecture

`ProgramServiceV3` owns day-index advancement.
`ProgramMetaRepositoryV3` owns `cindyV3ProgramMeta` persistence.
`ProgramPackV3` owns cycle definitions/rotation and uses explicit runtime + metadata ports.

## Verification

- Master regression: **11/11 PASS**.
- V3 acceptance: **100/100 PASS**.
- Program rotation: **PASS**.
- Explicit-runtime integration E2E: **PASS**.
- Stage 7 hardening: **9/9 PASS**.
- JavaScript syntax: **PASS**.
- Raw LocalStorage scan of Program Pack: **PASS**.
- Reload/monkey-patch scan: **PASS**.

## Browser limitation

Real browser-rendered UI smoke remains unavailable because the managed Chromium environment blocks local application execution before the app starts. Runtime behavior was therefore verified with deterministic in-process and static checks.
