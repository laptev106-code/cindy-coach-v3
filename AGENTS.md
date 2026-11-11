# 🤖 CINDY Coach V3 — Universal AGENTS.md Standard

> **Universal Agent Operating Standard & Architecture Constitution**  
> Applicable across all AI coding assistants (Antigravity, Claude Code, Cursor, Codex).  
> **Single Source of Operational Truth** for CINDY Coach V3.

---

## 1. Project Profile & Invariants

- **Product:** CINDY Focus / CINDY Coach V3 — offline-first Progressive Web App (PWA) for high-intensity Cindy workouts (pull-ups, push-ups, air squats) with an adaptive deterministic bio-mechanical coach.
- **Tech Stack:** Pure **Vanilla JavaScript (ES6+)**, semantic HTML5, modern CSS3.
- **Zero Build Tooling:** NO `npm install`, NO Webpack, NO Vite, NO Babel. The browser directly executes the source.
- **Local Dev Server:** `START_CINDY_LITE.bat` (Python `http.server` on port 8080: `http://127.0.0.1:8080/index.html`).
- **Global Architecture Boundaries:**
  - `src/domain/`: Immutable entities, business rules, exercise catalogs (`exercise_catalog_v3.js`, `session_contract_v3.js`).
  - `src/application/`: Application services (`coach_application_service_v3.js`, `program_service_v3.js`, `workout_history_service_v3.js`).
  - `src/infrastructure/`: Browser storage and feedback (`local_storage_v3.js`, `coach_state_repository_v3.js`, `feedback_v3.js`).
  - `src/presentation/`: UI components and screen routers (`screen_hosts_v3.js`, `screen_router_v3.js`).
  - `coach_core_v3/`: Deterministic mathematical coach algorithms (`coach_core_v3.js`, `program_pack_v3.js`, `coach_integration_v3.js`).
  - `index.html`: Master presentation layer containing CSS tokens, layout structures, and runtime bindings.

---

## 2. 🎨 Priority #1: Anti-AI Slop Design System & Tactical Mobile Fitness UI

> **Anti-AI Slop Mandate:** Strictly ban synthetic, lifeless "AI-generated slop" aesthetics. CINDY must feel like a precision sports instrument engineered for real, heavy physical exertion.

### 🚫 Banned AI-Slop Anti-Patterns
1. **Generic Purple/Indigo Blob Syndrome:** No glowing purple radial gradients, neon mesh blobs, or generic futuristic AI clichés.
2. **Lifeless Flat Cards:** No grey-on-white 1px border boxes with zero depth, lifeless elevation, or flat lifeless interaction.
3. **Sterile Inter-Only Typography:** No mono-font generic styling. Pair athletic display typography (`Space Grotesk`) with ultra-readable body text (`Manrope`) and monospace numbers (`DM Mono`).
4. **Micro-Text "Flea Dust":** Strictly forbidden font sizes of 8px, 9px, 10px in user-facing controls. Text must be instantly readable while moving, sweating, and shaking.
5. **Low Contrast & Washed Out Text:** Text must meet WCAG 2.2 AA (minimum 4.5:1 for body copy, 3:1 for large display metrics).
6. **Layout Shift Jitter:** Timers and round counters must never jump in width when digits flip.

### ✅ Mandatory Tactical Fitness Ergonomics (2026 Standards)
1. **Sweaty-Hand Ergonomics (Thumb-Zone First):**
   - Minimum tap target size: **48×48px** for all interactive buttons and chips.
   - Primary action (Add Round / Pause / Stop) docked in the bottom thumb reach zone (`calc(var(--nav-h) + 18px + env(safe-area-inset-bottom))`).
2. **Zero Layout Shift (CLS = 0):**
   - All timers, rep counts, and round numbers MUST use `font-variant-numeric: tabular-nums` and monospace/tabular font metrics.
3. **Concentric Border Radii:**
   - Always adhere to the optical nesting formula:
     $$R_{\text{inner}} = \max(4\text{px}, R_{\text{outer}} - \text{padding})$$
   - Never place a sharp 4px inner button inside a round 22px card.
4. **Layered Diffuse Depth (Real 3D Tactility):**
   - Replace harsh single-layer black drop shadows with layered ambient + directional + contact shadows:
     ```css
     box-shadow: 
       0 1px 2px rgba(0, 0, 0, 0.04),
       0 4px 12px rgba(0, 0, 0, 0.06),
       0 14px 28px rgba(0, 0, 0, 0.08);
     ```
   - Physical mechanical button press:
     ```css
     .control:active, .lap-pad:active {
       transform: translateY(3px) scale(0.97);
       transition: transform 70ms cubic-bezier(0.2, 0, 0, 1);
     }
     ```
5. **Mobile-First Bottom Sheets:**
   - Modals and detailed configuration views must slide up from the bottom edge (`transform: translateY(100%)` $\to$ `translateY(0)` with `cubic-bezier(0.16, 1, 0.3, 1)`), respecting `env(safe-area-inset-bottom)`.
6. **Defensive CSS & Multi-Theme Fidelity:**
   - Always use CSS tokens (`var(--paper)`, `var(--panel)`, `var(--ink)`, `var(--blue)`).
   - Prevent text clipping with `min-width: 0` on flex/grid children and `overflow-wrap: anywhere`.
   - Support dark mode (`body.dark`) and custom athlete palettes (`copper`, `blue`, `forest`, `plum`).

---

## 3. ⚡ Superpowers 7-Step Engineering Discipline

Every modification to CINDY Coach V3 must pass through this deterministic 7-step pipeline:

```
[1. Brief & Reality-Check] ──> [2. Architecture Audit] ──> [3. TDD Gatekeeper]
                                                                     │
[6. Manifest & Hash Sync] <── [5. Closed-Loop Verify] <── [4. Surgical Edit]
         │
         v
[7. Plain Language Report]
```

1. **Brief & Reality-Check (Lead Developer Mindset):**
   - Critically evaluate product intent before writing code.
   - Never blindly accept fragile workarounds or anti-patterns; protect user experience and app performance.
2. **Architecture Audit:**
   - Map exact affected layers (Domain, Application, Presentation, or Runtime).
   - Verify that no cyclical dependencies are introduced.
3. **TDD Gatekeeper (Test Contract First):**
   - Identify existing regression test suites covering the feature.
   - For behavioral or algorithmic changes, verify test assertions *before* and *after* implementation.
4. **Surgical Implementation:**
   - Make precise, surgical diffs. Do NOT rewrite unrelated code or erase existing comments.
5. **Closed-Loop Verification:**
   - Run tests in the terminal:
     `node tests\run_final_html_runtime_smoke.cjs`
     `node tests\run_stage5_presentation_tests.cjs`
     `node tests\run_regression_tests.cjs`
   - Validate exit codes and terminal output automatically.
6. **Manifest & Hash Integrity Sync:**
   - Run `py scripts/update_release_manifests.py` whenever tracked project files or hashes are touched.
7. **Plain Language Report:**
   - Explain what changed in human product terms ("What does this mean for the athlete during a workout?").

---

## 4. 🐝 Ruflo Multi-Agent Swarm (4-Role Synergy)

When tackling complex features, the agent operates as a synchronized 4-role engineering team:

1. **Product & UI/UX Designer:**
   - Guards mobile thumb ergonomics, Anti-AI Slop aesthetics, visual contrast, tactile haptic/motion curves, and typography hierarchy.
2. **Senior Frontend Architect:**
   - Guards Clean Architecture boundaries, zero-dependency Vanilla JS purity, memory footprint, and browser lifecycle event integrity.
3. **SecOps & Data Security Lead:**
   - Enforces offline-first data safety, zero-leak localStorage structures, and Google GIS token memory-only isolation (Pattern C).
4. **QA & Verification Engineer:**
   - Enforces the regression baseline (22 PASS / 4 expected browser-only), prevents regressions in the 102 acceptance test matrix, and audits release manifests.

---

## 5. Verification Commands Reference

```powershell
# Set UTF-8 encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8

# 1. HTML Runtime Smoke
node tests\run_final_html_runtime_smoke.cjs

# 2. Stage 5 Presentation Tests (UI & Layout)
node tests\run_stage5_presentation_tests.cjs

# 3. Acceptance Tests (102 Core Test Cases)
node tests\run_v3_acceptance_tests.cjs

# 4. Full Regression Suite (26 Suites)
node tests\run_regression_tests.cjs

# 5. Manifest & Checksum Update
py scripts\update_release_manifests.py --regression-status PASS --zip-status PENDING
```
