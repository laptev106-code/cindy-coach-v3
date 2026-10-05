# CINDY Adaptive Coach V3.0.0
## NORMATIVE SPECIFICATION

**Status:** Normative specification. **Specification status: IMPLEMENTATION-READY. Runtime/production status: NOT VERIFIED.** The specification is implementation-ready because all normative behaviors have explicit inputs, conditions, outputs, authority, missing-data behavior, edge cases, bounded fallbacks and acceptance fixtures. Production readiness still requires implementation and execution of the declared test corpus.
**Version:** `3.0.0`
**Scope:** CoachCore decision architecture, evidence, adaptation, exercise intelligence, personalization, external-context boundary, WorkoutSpec, provenance, reproducibility, release integrity and deterministic tests.
**Authority:** This document is the sole normative definition for V3.0.0 behavior. Historical V2.8, V2.9.2 and audit documents remain traceability sources only and do not override this specification.

---

# A. PURPOSE

CINDY Adaptive Coach is a deterministic decision system that selects the next appropriate training stimulus from the user's available evidence, current state, goals, constraints, exercise catalog and future external context.

The system is not required to change the workout after every session. Its valid outcomes include preserving the current workout, repeating it intentionally, running a control workout, returning from a gap, adapting one variable, making an explicitly authorized structural adaptation, collecting evidence, or declining to author a workout.

The core design objective is:

> **Increase decision quality by improving evidence separation, authority, question-specific reasoning, exercise intelligence, intervention attribution and uncertainty management, not by accumulating opaque coefficients.**

CINDY must remain:

- deterministic;
- reproducible;
- explainable;
- conservative when evidence is weak or conflicting;
- capable of structural exercise decisions, not only numeric progression;
- able to use long historical context without treating all history as equivalent evidence;
- able to incorporate future wearable/external context through an isolated evidence adapter;
- incapable of inventing physiological, causal or medical certainty unsupported by the data.

## V3.0.0 source basis

V3.0.0 consolidates:

1. CINDY Adaptive Coach V2.8;
2. CINDY Adaptive Coach V2.9.2;
3. Independent Architecture Audit / NextGen;
4. the final comprehensive audit supplied immediately before this specification;
5. the current CINDY and Exercise System concepts.

The final comprehensive audit explicitly required the separation of decision action, session purpose and status; question-scoped authority; execution fidelity for Level B; intervention-specific response envelopes; non-contiguous strict cohorts with trend coherence; reproducible historical snapshots; explicit decision time; a formal Measurement Contract; release manifest integrity; and fail-closed behavior.

---

# B. IMMUTABLE PRINCIPLES

## B1. History is knowledge; evidence is claim-specific

`HistoryContext` describes the user's training life.

`StrictCohort` supports precise performance claims.

`InterventionWindow` supports reaction-to-change claims.

These views must never be collapsed into one generic "history score".

## B2. Hard constraints are absolute

Positive performance, goals, historical success, wearable data and candidate ranking cannot override a hard constraint.

## B3. Coach is the sole decision authority

UI, Builder, Workout Engine, storage helpers and external data adapters cannot create or authorize Coach logic.

## B4. One lever is the default

A normal adaptation changes one atomic lever by one approved step. Multi-lever adaptation is a separate internally authorized exception.

## B5. No action is valid

The system never has to invent a change merely because the Coach was invoked.

## B6. Repeat is not control

Repeat collects confirmatory evidence while preserving the existing workout.

Control is a deliberate test designed to answer a named information question.

## B7. Level B requires real execution

A proposed Coach change is not an intervention merely because it was displayed or applied in the configuration UI. It becomes Level B eligible only when execution fidelity is verified.

## B8. No generic cross-workload normalization

The system must never infer intervention response from an invented linear workload ratio when the relationship is not validated.

## B9. Goal is strategy, not a workload multiplier

Goals may alter candidate eligibility, objective, composition preference and supported metrics. They do not multiply workload through demographic or goal coefficients.

## B10. Wearables are evidence adapters, not authorities

Wearables never call or mutate CoachCore directly.

## B11. Historical meaning is versioned

Historical evidence must retain the snapshots and semantic versions needed to reproduce its original meaning.

## B12. Determinism includes time as an explicit input

CoachCore may use `decisionNow`, but may not obtain current time internally.

## B13. Explanations describe observed decision variables

Every explanation must be reconstructable from the actual variables that influenced the decision.

## B14. Unknown is not negative

Missing or ambiguous data may block a claim without being interpreted as poor performance.

## B15. V3.0.0 does not introduce

- universal workload scores;
- universal readiness/fatigue scores;
- demographic multipliers;
- ML inside CoachCore;
- pseudo-medical logic;
- fractional muscle-dose equations;
- automatic novelty or variety rotation;
- mandatory progression;
- broad multi-lever combinations;
- unsupported physiological coefficients.

---

# C. TERMINOLOGY

## C1. Coach-owned workout

A workout whose current configuration is explicitly authored by Coach and carries valid Coach provenance.

## C2. Builder-owned workout

A workout created or modified by the user/Builder without explicit Coach authorship. Coach may analyze it, but cannot retroactively claim authorship.

## C3. Comparable-to-current

A historical record that satisfies the strict comparability contract against the current target context.

## C4. Trend/reference-coherent evidence

A subset of comparable records that additionally share a stable semantic reference context sufficient for a temporal performance claim.

A record may be comparable to the current target without belonging to a valid trend cohort.

## C5. Intervention

A specific Coach-authored change whose parent context, applied levers and resulting child workout can be identified.

## C6. Execution fidelity

The degree to which the actually completed workout matches the Coach-authored intervention sufficiently to permit Level B reasoning.

## C7. Response envelope

An intervention-specific definition of what evidence is sufficient to classify the user's response to a particular Coach change.

## C8. Decision question

The explicit question the Coach is solving before candidate generation.

Examples:

- What is the smallest supported progression?
- Should the same workout be repeated to confirm an anomaly?
- Did the user tolerate this exact Coach change?
- What conservative return from the gap is valid?
- Is the current composition structurally incomplete?

## C9. Readiness Context

Short-term contextual information relevant to interpretation and caution. It is not a universal physiological readiness score.

## C10. Confidence Profile

A structured description of evidence quantity, comparability, quality, recency and conflict. It is not a single weighted score.

## C11. Capacity Profile

A descriptive representation of long-term observed capability derived from qualifying comparable evidence. It is not an action-driving fitness score.

## C12. Material change

A change is `material` for a claim only when it changes at least one claim-relevant predicate in the applicable contract: admissibility, strict comparability, measurement semantics, candidate eligibility or objective sufficiency. No hidden magnitude rule exists outside those contracts.

## C13. Sufficient evidence

`Sufficient evidence` never means an informal amount of data. It means that the active decision objective or response envelope has all of its explicitly required evidence predicates satisfied.

## C14. Meaningful within-session deterioration

A within-session deterioration is `meaningful` only when the active Measurement Contract defines the required segment metric and the applicable response/pace rule classifies the observed change as deterioration. Without that metric, the state is `UNKNOWN`.

## C15. Appropriate candidate

An `appropriate candidate` is a candidate that has passed hard/admissibility filters, has the required question-scoped evidence authority, satisfies the active Decision Objective, respects the one-lever/multi-lever contract, and can produce a fully valid WorkoutSpec.

## C16. Smallest valid change

Candidates are ordered first by atomic magnitude within the same objective class. The normative default magnitudes are:
`COUNT = ±1 count`, `ROUNDS = ±1 round`, `DURATION = ±60 seconds`, `VARIANT = one adjacent Exercise Matrix ladder position`. No larger magnitude may be synthesized to rescue a failed candidate.

## C17. Strong outcome

`STRONG` is not a generic evidence state. It exists only when an individual ResponseEnvelope explicitly defines a strong-outcome predicate. Otherwise the outcome class is `NOT_SUPPORTED`.

## C18. Where relevant / where supported

These phrases are never permission to infer behavior. `Relevant` means the applicable contract names the field as claim-relevant. `Supported` means the applicable objective, measurement contract or response envelope explicitly lists the mechanism as supported. If neither contract exists, the result is `UNRESOLVED` or `NOT_SUPPORTED`.

---

# D. DATA MODEL

The normative model is composed of the following principal objects.

## D1. CoachInput

```text
CoachInput {
  profile,
  config,
  hardConstraints,
  currentWorkout,
  history,
  exerciseMatrix,
  programContext,
  externalContext,
  activeState,
  decisionNow,
  decisionTimezone,
  releaseManifest
}
```

## D2. Profile

```text
Profile {
  age,
  sex?,
  heightCm?,
  weightKg?,
  weightHistory?,
  trainingExperience,
  goal,
  equipment,
  restrictions,
  profileVersion,
  effectiveFrom,
  effectiveTo?
}
```

## D3. HistoricalRecord

Every historical workout record must retain, where available:

```text
HistoricalRecord {
  id,
  effectiveTimestamp,
  trainingDayId,
  timezone,

  plannedSpecSnapshot,
  actualExecution,
  measurementContractVersion,

  profileSnapshot,
  configSnapshot,
  constraintSnapshot,
  exerciseMatrixVersion,
  compatibilityVersion,

  ownership,                 // COACH | BUILDER | UNKNOWN
  sessionPurpose,
  sessionType,

  provenance,
  quality,
  validity,
  endedBy,
  derivedFrom?,
  appliedLevers?,

  performanceMetrics,
  externalEvidenceRefs?
}
```

## D4. ExerciseMatrix

The Exercise Matrix is versioned and includes, where supported:

```text
ExerciseDefinition {
  id,
  family,
  movementPattern,
  subPattern?,
  baseOrVariant,
  variantParent?,
  variantLadderPosition?,
  progressionNeighbors?,
  regressionNeighbors?,
  difficultyBand?,
  targets?,
  loadCharacteristics?,
  fatigueCharacteristics?,
  skillDemand?,
  stabilityDemand?,
  technicalComplexity?,
  equipmentRequirements?,
  restrictions?,
  substitutionGroups?,
  coachEligibility,
  exposureTags,
  comparabilitySensitivity,
  semanticCompatibilityClass,
  matrixVersion
}

`comparabilitySensitivity` is a finite set of claim-relevant profile/context dependencies, for example:
`BODYWEIGHT`, `EQUIPMENT`, `RESTRICTION`, `FORMAT`, `TARGET`, `ORDER`, `PROGRAM`, `MEASUREMENT`.
An absent sensitivity tag means that the corresponding profile/context transition is not, by itself, strict-blocking for that exercise claim.

`semanticCompatibilityClass` identifies the stable semantic identity used by compatibility mappings. A changed Exercise Matrix version does not change the meaning of an old record when the recorded semantic identity and compatibility mapping remain valid.
```

No Exercise Matrix field may be treated as precise numeric physiology unless explicitly validated and versioned.

## D5. ExternalContext

External context is normalized before entering CoachCore and carries source, quality, timestamp, normalization version and limitations.

## D6. Decision time semantics

```text
decisionNow      = explicit ISO-8601 instant with offset or UTC Z
decisionTimezone = explicit IANA timezone identifier
```

CoachCore must treat both as immutable inputs for one decision call. It must not read system time, browser time, localStorage time, UI time or `Date.now()` internally.

The local training day is computed by converting an event timestamp into `decisionTimezone` and taking its calendar date.

Invalid `decisionNow` or invalid `decisionTimezone` is input-invalid and falls to:
`NO_ACTION + UNRESOLVED`.

`decisionNow` may not precede the latest committed canonical decision/effective event when the application layer declares such ordering mandatory. Future-dated workout records are excluded from current performance evidence until their effective time is reached.

---

# E. EVIDENCE ARCHITECTURE

Every decision constructs distinct evidence views.

```text
HistoryContext
StrictCohort
RecentStrictWindow
InterventionWindow
Confounders
ContextAlerts
```

## E1. HistoryContext

Contains all valid historical records useful for:

- workload context;
- frequency;
- exposure;
- exercise/family recency;
- previous Coach changes;
- profile and environment changes;
- long-term learning.

A record can contribute to HistoryContext even when it cannot support a specific performance claim.

## E2. StrictCohort

`StrictCohort(currentContext)` contains every historical record that is strictly comparable to the current target under the comparability contract.

It is non-contiguous.

A non-comparable intervening workout does not delete valid older comparable records from StrictCohort.

## E3. RecentStrictWindow

A bounded subset of StrictCohort used for current-direction reasoning.

Normative engineering default:

`MAX_RECENT_STRICT_RECORDS = 6`.

This is a versioned engineering parameter, not a scientific law.

When fewer than the available number of qualifying records exist, use all qualifying records.

The window is record-based but must preserve training-day uniqueness for evidence strength. Multiple same-day sessions do not create multiple independent training-day confirmations.

## E4. Trend/reference-coherent evidence

A strict-comparable record is not automatically trend evidence.

A record is admitted to `TrendCohort` only if:

1. it is comparable-to-current;
2. its semantic reference context matches the active trend/reference context;
3. the relevant program/template semantics remain equivalent;
4. no unresolved semantic version mismatch exists;
5. the measured metric and measurement contract are compatible;
6. pairwise/reference coherence is satisfied for the intended trend claim.

The algorithm may therefore have:

```text
ComparableToCurrent = {A,B,C,D}
TrendCohort = {A,C,D}
```

without contradiction.

## E5. InterventionWindow

Contains a parent Coach-authored record, its exact proposed/apply/start/execution chain, and the child result(s) eligible for response analysis.

An intervention window ends when its response is resolved, invalidated by execution fidelity failure, or bounded by the relevant response-envelope policy.

## E6. Confounders

Examples include:

- changed profile or bodyweight where relevant;
- changed exercise semantics;
- changed exercise matrix;
- changed equipment;
- changed format;
- changed target;
- changed composition;
- changed order where order is performance-relevant;
- long gap;
- same-day clustering;
- partial intervention execution;
- external interruption;
- malformed measurements;
- unresolved wearable conflict;
- changed measurement contract.

A confounder does not automatically mean poor performance. It reduces the authority of the affected claim.

## E7. ContextAlerts

ContextAlerts represent cautionary or contextual signals such as:

- unusually sparse recent evidence;
- recent workload clustering;
- conflicting external data;
- recent profile change;
- equipment loss;
- quality degradation.

ContextAlerts do not become a universal readiness/fatigue score.

## E8. StrictComparabilityContract

`StrictComparabilityContract(A, B, claim)` is a deterministic field-by-field predicate. A field either passes, blocks strict comparability, or is excluded from the claim by its declared scope. No aggregate comparability score is used.

| Field | Rule | Units / domain | Missing | Invalid | Strict-blocking? |
|---|---|---|---|---|---|
| validity | both records valid for the claim | enum | block | block | YES |
| execution fidelity | both executions valid for Level A performance | enum | block | block | YES |
| mode | exact normalized enum match | FREE/TIME/ROUNDS/COMBINED | block | block | YES |
| formatPolicy | exact normalized policy match | enum | block | block | YES |
| planned duration | `abs(A-B) <= min(60s, 5%*min(A,B))` when duration is a primary workload dimension | seconds | block | block | YES when duration-relevant |
| target | exact semantic match after normalization | contract-defined target | block when target is required | block | YES |
| targetRounds | exact integer match where rounds are target-defining | rounds | block | block | YES when applicable |
| composition length | exact count match | integer | block | block | YES |
| exercise IDs | exact ordered ID match | IDs | block | block | YES |
| order | exact ordered slot match | ordinal slots | block | block | YES |
| counts | exact count match | reps/counts | block | block | YES |
| variantId | exact match unless compatibility mapping proves same semantic variant | ID | block | block | YES |
| variant semantics | same `semanticCompatibilityClass` | matrix-defined class | block | block | YES |
| programContext | exact identity or explicit compatibility mapping | program/template ID | block if program is relevant | block | YES when relevant |
| sessionType | STANDARD/REPEAT may compare only within the same measurement context; CONTROL and REENTRY are excluded from ordinary Level A | enum | block | block | YES |
| MeasurementContract | exact version or explicit compatible mapping preserving metric semantics | version | block | block | YES |
| ExerciseMatrix | exact version or explicit compatibility mapping preserving all used exercise semantics | version | block | block | YES |
| relevant profile state | exact match for fields named by `comparabilitySensitivity` | profile fields | block if required | block | YES when tagged |
| equipment | same effective equipment for all used exercise sensitivities | equipment set | block if required | block | YES when tagged |
| restrictions | same effective restrictions relevant to used exercises | restriction set | block if relevant | block | YES when relevant |
| external confounders | must be absent or explicitly classified as non-blocking for the claim | contract-defined | if required block | invalid block | YES if claim-affecting |
| ownership/provenance | not required for ordinary Level A; required for Level B intervention claims | enum/provenance | block for Level B | block | CLAIM-SPECIFIC |

### E8.1 Duration tolerance contract

Inputs: planned durations `A`, `B`.
Formula:
`abs(A-B) <= min(60, 0.05*min(A,B))`.
Units: seconds.
Range: non-negative duration.
Threshold: `60s`, `5%`.
Initial state: enabled for duration-relevant modes.
Missing/invalid: strict-blocking for duration-relevant claims.
Fallback: retain in HistoryContext only.
Classification: CDD/PTV engineering comparability parameter.

### E8.2 Bodyweight-sensitive comparability

For an exercise tagged `BODYWEIGHT` in `comparabilitySensitivity`, define:

```text
bodyMassDeltaPct =
  abs(weightA - weightB) / max(min(weightA, weightB), 1 kg)
```

Units: percent after multiplying by 100.
Initial threshold:
`BODY_MASS_STRICT_BLOCK_THRESHOLD = 5%`.

If `bodyMassDeltaPct >= 5%`, strict comparability is blocked for the affected bodyweight-sensitive claim unless the historical/current records carry an explicit validated normalization contract.

If the weight value is missing or invalid for a bodyweight-sensitive claim, strict comparability is `UNRESOLVED` rather than assuming equality.

This is a comparability rule, not a workload conversion and not a physiological statement.

### E8.3 What strict comparability means

`strictly comparable to current` means every applicable blocking predicate above passes against the current target context.

### E8.4 What strict comparability does not mean

A strict-comparable record is not automatically evidence of temporal trend. Trend requires reference coherence.

### E8.5 Trend/reference-coherent evidence

Construct `TrendCohort` deterministically:

1. select the most recent valid `StrictCohort` record that is eligible for the active claim;
2. ties are resolved by `effectiveTimestamp`, then stable record ID;
3. include only records that are strict-comparable both to the current target and to the selected reference record;
4. exclude records with unresolved claim-affecting confounders;
5. exclude CONTROL and REENTRY records from ordinary Level A trend claims.

This converts:
`ComparableToCurrent`
into:
`Trend/reference-coherent evidence`
without requiring records to be adjacent in calendar time.

If no valid reference record exists, `TrendCohort = empty`.

### E8.6 Evidence consequences

- strict-blocking difference → record stays in HistoryContext but is excluded from the affected strict claim;
- non-blocking contextual difference → record may remain in StrictCohort;
- missing optional, non-relevant data → no effect;
- missing required data → strict-blocking;
- unknown is never interpreted as poor performance.

---

# F. AUTHORITY MODEL

V3.0.0 uses a two-level authority architecture.

## F1. Level 1: admissibility authority

This determines whether a fact, candidate or operation is allowed to participate at all.

Precedence:

```text
A0  release integrity / compatibility
A1  hard constraints / explicit restrictions
A2  ownership / execution validity
A3  canonical data validity / measurement validity
A4  Coach rule admissibility
A5  candidate ranking information
A6  contextual preference
```

A lower-priority source cannot override a higher-priority admissibility decision.

Example: positive historical performance cannot make an unavailable exercise eligible.

## F2. Level 2: question-scoped evidence authority

After admissibility, evidence authority depends on the decision question.

| Decision question | Primary evidence authority | Secondary context | Cannot substitute for primary evidence |
|---|---|---|---|
| Current comparable performance | TrendCohort / qualifying StrictCohort | HistoryContext | Wearable anomaly, broad similarity |
| Reaction to Coach intervention | InterventionWindow with verified fidelity | Strict/History context | Generic historical trend |
| Re-entry | pre-gap valid reference + current re-entry execution | History/ContextAlerts | Cross-workload ratio |
| Structural composition | Exercise Matrix + exposure + limiting-area evidence | Goal | Novelty alone |
| Control decision | Named question + frozen control context | relevant evidence | Generic uncertainty |
| Goal limitation | GoalState support contract | actual performance | Goal aspiration alone |
| External caution | validated ExternalContext | performance/history | Raw wearable signal |

## F3. Authority does not mean source truth is absolute

Authority is question-scoped. The same record can be strong evidence for one question and irrelevant for another.

---

# G. DECISION CONTRACT

The final Coach decision is orthogonal.

## G1. DecisionMode

```text
DecisionMode {
  NO_ACTION,
  PRESERVE,
  ADAPT
}
```

`PRESERVE` means the next session configuration is intentionally preserved.

`ADAPT` means the WorkoutSpec differs from the current Coach-owned reference or follows a special re-entry protocol.

`NO_ACTION` means Coach does not author a new configuration.

## G2. SessionPurpose

```text
SessionPurpose {
  STANDARD,
  BASELINE,
  REPEAT,
  CONTROL,
  REENTRY,
  RECOVERY,
  EVIDENCE_COLLECTION
}
```

## G3. DecisionStatus

```text
DecisionStatus {
  VALID,
  EVIDENCE_LIMITED,
  GOAL_LIMITED,
  CONFLICTED,
  CURRENT_INVALID,
  OWNERSHIP_LIMITED,
  EXTERNAL_CONTEXT_LIMITED,
  STALE,
  UNRESOLVED
}
```

## G4. Adaptation

```text
Adaptation {
  kind,                     // NONE | ATOMIC | REENTRY_PROTOCOL | STRUCTURAL_BUNDLE
  levers[],
  leverCount,
  magnitude,
  targetSlot?,
  fromState,
  toState,
  authority,
  reason
}
```

`REENTRY_PROTOCOL` is a predefined special protocol and is not counted as an ordinary adaptive lever.

## G5. Canonical semantic combinations

Examples:

```text
one anomalous session
→ PRESERVE + REPEAT + EVIDENCE_LIMITED + NONE

specific information question
→ PRESERVE + CONTROL + VALID + NONE

valid +1 progression
→ ADAPT + STANDARD + VALID + ATOMIC(count,+1)

long-gap return
→ ADAPT + REENTRY + VALID + REENTRY_PROTOCOL

Builder-owned current workout
→ NO_ACTION + STANDARD + OWNERSHIP_LIMITED + NONE

invalid current spec with valid Coach baseline
→ ADAPT + RECOVERY + CURRENT_INVALID + atomic/recovery adaptation
```

The decision contract prevents branch, status and action from becoming one overloaded enum.

---
## G6. Decision Objective

Every adaptive decision has exactly one primary objective.

```text
PROGRESS_CAPACITY
REDUCE_LOCAL_STRESS
CORRECT_STRUCTURAL_BALANCE
CONFIRM_PLATEAU
RETURN_FROM_REENTRY
RESOLVE_LEVEL_B
GOAL_LIMITED
EVIDENCE_COLLECTION
```

### G6.1 Objective support states

```text
SUPPORTED
INSUFFICIENT_EVIDENCE
UNSUPPORTED
SATISFIED
```

No score is calculated.

### G6.2 Objective sufficiency contract

`objectiveSufficient(objective, context, candidate)` is a boolean predicate plus a reason code.

| Objective | Required evidence | Allowed candidate classes | Objective is satisfied when |
|---|---|---|---|
| PROGRESS_CAPACITY | supported goal metric; valid TrendCohort with >=3 qualifying records across >=3 training days, OR a resolved acceptable Level B transition explicitly authorizing continuation | COUNT/ROUNDS/DURATION/adjacent VARIANT or other explicitly supported atomic progression | at least one candidate advances the supported metric/direction by one permitted step and all gates pass |
| REDUCE_LOCAL_STRESS | explicit limiting-area evidence from a supported performance/reaction rule, or a hard constraint requiring reduction | COUNT-1/ROUNDS-1/DURATION-1/REGRESSION/REMOVE when supported | candidate directly reduces the identified limiting area and does not violate the objective's preservation predicates |
| CORRECT_STRUCTURAL_BALANCE | binary structural deficiency from Exercise Matrix/program/config rules | ADD/REMOVE/REPLACE/ORDER_CHANGE or approved structural bundle | candidate changes the composition so the named structural predicate becomes true |
| CONFIRM_PLATEAU | TrendCohort >=3 qualifying training days and a Measurement Contract with a defined stability predicate | CONTROL only | control question exists and frozen context is fully specified |
| RETURN_FROM_REENTRY | active re-entry branch with valid pre-gap reference | REENTRY_PROTOCOL or one-step transition after R3 | re-entry protocol can be validated without violating structural minimum |
| RESOLVE_LEVEL_B | active intervention with verified execution fidelity and a supported ResponseEnvelope | preserve/revert/continue according to envelope | envelope reaches a terminal resolution state |
| GOAL_LIMITED | requested goal metric is unsupported by current Measurement/Goal contract | no goal-specific adaptation; preserve/collect | factual performance may be preserved but the goal-specific objective cannot authorize adaptation |
| EVIDENCE_COLLECTION | an identified missing/ambiguous fact is observable by a valid future session | REPEAT or CONTROL or explicit collection session | the selected session can collect the missing evidence and has an explicit resolution branch |

### G6.3 Insufficient vs unsupported

`INSUFFICIENT_EVIDENCE` means the mechanism is supported but the current data do not satisfy its predicates.

`UNSUPPORTED` means V3.0.0 does not define a valid evidence/measurement mechanism for the requested claim.

The former may lead to REPEAT/CONTROL/EVIDENCE_COLLECTION.
The latter must never be converted into a guessed candidate.

### G6.4 Plateau stability predicate

A continuous primary metric may use a Measurement-Contract-defined `stabilityTolerance`.

If the contract provides none, `CONFIRM_PLATEAU` is `UNSUPPORTED` for that metric.

For a contract-defined relative tolerance `t`:

```text
relativeSpread =
  (max(metricValues) - min(metricValues))
  / max(abs(median(metricValues)), metricUnitFloor)
```

Plateau is supported only when:
`relativeSpread <= t`.

Units: dimensionless.
Range: `>= 0`.
Threshold: `t` is defined by the Measurement Contract for that metric; no universal hidden value exists.
Initial state: no plateau claim until the contract supplies `t`.
Missing metric/t: unsupported or unresolved.
Fallback: MAINTAIN/REPEAT or EVIDENCE_COLLECTION.

### G6.5 Atomic step contract

```text
COUNT_STEP    = 1 count
ROUNDS_STEP   = 1 round
DURATION_STEP = 60 seconds
VARIANT_STEP  = one adjacent Exercise Matrix ladder position
```

These are CDD/PTV engineering parameters.

They may not be enlarged because a candidate failed validation.


# H. DECISION PIPELINE

The canonical pipeline is finite and deterministic.

```text
1  RECEIVE INPUT
2  VALIDATE RELEASE MANIFEST
3  NORMALIZE INPUTS
4  VALIDATE CANONICAL HISTORY + MEASUREMENT CONTRACT
5  CHECK OWNERSHIP / ACTIVE STATE
6  BUILD EVIDENCE VIEWS
7  DERIVE CONFOUNDERS / CONTEXT ALERTS
8  DERIVE GOAL STATE
9  RESOLVE SPECIAL BRANCHES
10 DEFINE ONE DECISION QUESTION
11 GENERATE FINITE CANDIDATES
12 APPLY ADMISSIBILITY HARD FILTERS
13 APPLY QUESTION-SCOPED EVIDENCE GATES
14 CHECK OBJECTIVE SUFFICIENCY
15 RANK VALID CANDIDATES DETERMINISTICALLY
16 BUILD FULL WorkoutSpec
17 VALIDATE WorkoutSpec
18 APPLY DETERMINISTIC FALLBACK IF NECESSARY
19 ATTACH PROVENANCE
20 BUILD EXPLANATION
21 RETURN DECISION
22 AFTER EXECUTION, STORE IMMUTABLE RESULT + REFERENCE SNAPSHOTS
```

No step may call an unbounded regeneration loop.

---

# I. DECISION TREE

```text
START
 |
 +-- release manifest invalid/incompatible
 |      → NO_ACTION / STALE
 |
 +-- normalized input malformed
 |      → NO_ACTION / UNRESOLVED
 |
 +-- active workout prevents replacement
 |      → NO_ACTION / VALID
 |
 +-- Builder-owned current workout and no Coach baseline authority
 |      → NO_ACTION / OWNERSHIP_LIMITED
 |
 +-- explicit Coach baseline authority + no valid usable history
 |      → BASELINE
 |
 +-- current Coach-owned workout invalid
 |      → recovery branch
 |
 +-- active REENTRY required
 |      → REENTRY branch
 |
 +-- unresolved verified Level B intervention
 |      → LEVEL B branch
 |
 +-- severe/ambiguous early stop gate
 |      → conservative preservation/repeat/control according to question
 |
 +-- no qualifying evidence for directional adaptation
 |      → MAINTAIN or REPEAT
 |
 +-- explicit information question available
 |      → CONTROL
 |
 +-- structural objective required
 |      → structural candidate gate
 |
 +-- sufficient atomic candidate exists
 |      → atomic ADAPT
 |
 +-- no atomic candidate but internal structural gate passes
 |      → approved STRUCTURAL_BUNDLE
 |
 +-- otherwise
        → valid Coach-owned preserve OR NO_ACTION
```

## I1. Dead-end principle

Every branch must terminate in one of:

- a valid WorkoutSpec;
- `NO_ACTION`;
- a valid Coach-owned previous specification;
- a valid baseline/recovery specification.

No branch may terminate with an undefined state.

---

# J. PERFORMANCE MODEL

Performance is factual execution data, not a score.

## J1. Primary performance dimensions

Depending on mode and Measurement Contract:

- actual duration;
- completed rounds;
- repetitions/counts;
- target attainment;
- pace/rate;
- within-session slowdown;
- consistency;
- completion;
- early stop;
- density only when true work/rest timing is measured;
- execution fidelity;
- response to prior Coach change.

## J2. Primary vs secondary vs contextual

### Primary
The metric explicitly defined by the Measurement Contract for the current workout mode.

### Secondary
Metrics useful for corroboration under the current protocol, such as pace integrity or completion detail.

### Contextual
Frequency, exposure, recent workload, profile changes, wearable caution, etc.

### Misleading
A field cannot be used as decision-driving evidence merely because it exists. Examples include estimated workload equivalence without a validated normalization contract.

## J3. Duration comparability

For strict TIME/COMBINED comparison, planned duration compatibility is:

```text
abs(A.plannedSeconds - B.plannedSeconds)
≤ min(60 seconds, 0.05 × min(A.plannedSeconds, B.plannedSeconds))
```

**Rule contract**

- Inputs: `A.plannedSeconds`, `B.plannedSeconds`.
- Formula: shown above.
- Units: seconds.
- Range: non-negative duration; maximum product duration remains a hard constraint.
- Threshold: `60 sec` and `5%` are CDD/PTV engineering parameters.
- Initial state: use the current versioned values.
- Missing data: duration compatibility is unresolved; strict comparison is denied.
- Edge cases: zero/negative planned duration invalid; exact equality always passes.
- Fallback: remove record from StrictCohort for this claim, but preserve it in HistoryContext.
- Classification: engineering/product rule, not scientific law.

## J4. Pace integrity

When the Measurement Contract provides comparable early and late segments, convert each segment to a higher-is-better rate family before comparison.

```text
paceRetention = lateRate / earlyRate
slowdown = 1 - paceRetention
```

**Rule contract**

- Inputs: valid early and late segment rates.
- Formula: above.
- Units: ratio for `paceRetention`; dimensionless for `slowdown`.
- Range: `paceRetention > 0` when rates are positive and valid; `slowdown < 1` under those conditions.
- Threshold: initial `PACE_RETENTION_MIN = 0.85` may be used only as a versioned validation threshold and must not be presented as physiological law.
- Initial state: no pace classification until enough segments exist.
- Missing data: pace signal is unavailable; no pace-based classification.
- Edge cases: zero early rate or malformed segment boundaries invalidate the calculation.
- Fallback: ignore pace as decision-driving evidence and use other valid measurements.
- Classification: engineering validation threshold.

Pace integrity is a modifier, never a standalone proof of fatigue or physiological failure.

## J5. Same-day evidence

Multiple sessions on one local training day:

- may contribute to HistoryContext;
- may contribute to workload/exposure context;
- count as one independent training day for evidence strength;
- cannot create multiple independent confirmations of the same intervention on the same day.

## J6. Outliers

An outlier is not automatically a failure.

Outlier handling is determined by protocol validity, execution fidelity and confounders. The default response to one isolated anomalous comparable session is preservation/repeat, not permanent capacity rewriting.

---

# K. CAPACITY / READINESS / CONFIDENCE

These are separate entities.

## K1. Performance

What actually happened in the current or historical workout.

## K2. Capacity Profile

Longer-term observed ability under qualifying comparable contexts.

Conceptual structure:

```text
CapacityProfile {
  referenceMetric?,
  typicalValue?,
  stableRange?,
  recentTrend?,
  bestStableValue?,
  evidenceCount,
  trainingDays,
  referenceContext,
  limitations[]
}
```

`typicalValue` may be a median over qualifying records.

**Median rule contract**

- Inputs: valid comparable metric values in a trend/reference-coherent cohort.
- Formula: statistical median of the ordered values.
- Units: same as source performance metric.
- Range: bounded by observed valid values.
- Threshold: none required.
- Initial state: absent until sufficient qualifying evidence exists.
- Missing data: capacity remains partially unspecified.
- Edge cases: even sample size uses the mean of the two central observations only within the descriptive statistic; this does not become a workload multiplier.
- Fallback: use qualitative evidence state rather than a numerical capacity.
- Classification: descriptive statistic, not a physiological law.

Capacity cannot by itself authorize a candidate. Candidate eligibility still requires current evidence and branch gates.

## K3. Readiness Context

Readiness Context consists of flags/observations, for example:

```text
ReadinessContext {
  recentGap,
  workloadCluster,
  recentPerformanceInstability,
  earlyStopContext,
  externalCaution,
  profileTransition,
  equipmentTransition,
  confidenceReductionFlags
}
```

No universal readiness score is permitted.

## K4. Confidence Profile

```text
ConfidenceProfile {
  dataValidity,
  comparability,
  quantity,
  recency,
  executionFidelity,
  metricCompleteness,
  confounding,
  externalContextQuality,
  overallPermission,
  limitations[]
}
```

Confidence dimensions are categorical/structured rather than multiplied into one scalar score.

Example permission levels:

```text
BLOCKED
COLLECT_ONLY
PRESERVE_ONLY
ATOMIC_ADAPTATION_ALLOWED
SPECIAL_BRANCH_ONLY
```

The permission level is derived deterministically from the dimensions and is not a black-box score.

## K5. No EMA authority

V3.0.0 does not use a scalar EMA ability value to directly authorize actions.

---

# L. LEVEL A

Level A measures repeated performance under a comparable workload structure.

## L1. Permitted uses

- stable performance;
- trend;
- plateau;
- improvement/decline;
- descriptive capacity calibration.

## L2. Requirements

A Level A claim requires:

1. valid current and historical measurement contracts;
2. qualifying TrendCohort/reference coherence;
3. no unresolved material confounder for the claim;
4. compatible target/format/composition/variant semantics;
5. valid execution records.

## L3. Non-contiguous evidence

Comparable sessions separated by unrelated workouts remain eligible for StrictCohort membership.

They become TrendCohort members only if they remain coherent with the reference context.

## L4. Level A cannot prove causality

A trend across stable comparable workouts can support a performance claim. It cannot prove that a previous change caused that trend.

---

# M. LEVEL B

Level B answers one narrow question:

> How did the user respond to the exact Coach-authored intervention?

## M1. Execution-fidelity gate

Level B eligibility requires the complete chain:

```text
PROPOSED
  ↓
APPLIED
  ↓
STARTED
  ↓
EXECUTED
  ↓
FIDELITY_VERIFIED
  ↓
ELIGIBLE
```

### PROPOSED
Coach created a candidate/WorkoutSpec.

### APPLIED
The user accepted the Coach-owned change through the authorized application boundary, or equivalent product-authorized application event was recorded.

### STARTED
The workout actually started from the applied Coach spec.

### EXECUTED
A workout result exists.

### FIDELITY_VERIFIED
Actual execution matches the intervention sufficiently according to the Measurement Contract and intervention envelope.

### ELIGIBLE
Only now may the result enter Level B response classification.

## M2. Fidelity states

```text
FIDELITY_EXACT
FIDELITY_SUFFICIENT
FIDELITY_PARTIAL
FIDELITY_UNKNOWN
FIDELITY_INVALID
```

Only `EXACT` and explicitly permitted `SUFFICIENT` states may resolve Level B.

Partial or unknown execution cannot be converted into intervention-response evidence.

## M3. Examples

### Exact execution

Coach: `COUNT +1`.

User starts and completes the exact composition, target, variant and planned count change.

→ Level B eligible if measurement contract also passes.

### Partial execution

Coach: `COUNT +1`.

User changes the count manually, skips an exercise, or stops before the altered component is meaningfully exposed.

→ no Level B attribution.

### Applied but not started

→ no Level B attribution.

### Started but malformed result

→ no Level B attribution.

## M4. Level B does not rewrite capacity automatically

A single Level B result answers the intervention question. It does not automatically rewrite the long-term CapacityProfile.

Repeated clean intervention evidence may later become part of Level A/history context if the resulting workload becomes a stable reference context.

---

# N. INTERVENTION RESPONSE ENVELOPES

Generic `ESTIMATED` planned-volume normalization is prohibited.

A Level B response can be resolved only by an intervention-specific envelope. Each supported envelope is explicit about its parent context, child execution, metric, outcome states, confounders, minimum evidence, resolution and version.

## N1. ResponseEnvelope contract

```text
ResponseEnvelope {
  interventionType,
  direction,
  parentContextRequirements,
  childExecutionRequirements,
  primaryMetric,
  secondaryMetrics,
  responseNormalization?,
  acceptableOutcome,
  poorOutcome,
  strongOutcome?,
  ambiguousOutcome,
  confounderRules,
  minimumEvidence,
  resolutionRule,
  unresolvedFallback,
  levelBSupport,
  version
}
```

`levelBSupport ∈ {SUPPORTED, UNSUPPORTED}`.

`UNSUPPORTED` means the Coach may still perform the intervention when an ordinary decision branch authorizes it, but the result cannot resolve a causal-style Level B response.

## N2. Response retention metric

For supported envelopes where parent and child use the same semantic primary metric:

First map the metric to a `higher-is-better` direction according to the Measurement Contract.

```text
performanceRetention =
  childNormalizedValue / parentNormalizedValue
```

For a lower-is-better metric such as time per round:

```text
performanceRetention =
  parentNormalizedValue / childNormalizedValue
```

Inputs: valid parent and child metric values.
Units: dimensionless ratio.
Range: `>0` for valid positive metrics.
Threshold: envelope-specific `responseRetentionThreshold`.
Initial threshold for the supported exact/rate envelopes below:
`0.85`.
Missing/invalid: `AMBIGUOUS`.
Edge case: zero/negative denominator under a metric that requires positive values → invalid.
Fallback: envelope-defined unresolved branch.
Classification: engineering/product validation threshold, not physiology.

This metric measures observed performance retention. It does not normalize workload or claim equivalence between workloads.

## N3. COUNT +1

### Support
`SUPPORTED` only when:

- mode/format/target semantics are unchanged;
- composition/order/variants are unchanged;
- only one count changes by `+1`;
- the active Measurement Contract provides a repeatable primary metric;
- execution fidelity is `EXACT` or explicitly permitted `SUFFICIENT`;
- no claim-affecting confounder exists.

### Primary metric
The Measurement Contract primary performance metric for the unchanged protocol.

### Acceptable
Child completed under the altered count and:

```text
performanceRetention >= 0.85
```

and no severe early stop or claim-affecting confounder exists.

### Poor
Clean execution with:

```text
performanceRetention < 0.85
```

### Strong
`NOT_SUPPORTED` in V3.0.0. No extra progression authority is created from an especially good child.

### Ambiguous
Missing primary metric, invalid segment, fidelity not exact/sufficient, or confounded session.

### Resolution
- ACCEPTABLE → `CONFIRM_CHANGE`; child becomes eligible as the current reference for ordinary future reasoning.
- POOR → `REVERT_CHANGE` when the intervention is clean.
- AMBIGUOUS → `MAINTAIN_COLLECT_EVIDENCE`.
- CONFIRMED but not cleanly measurable → `UNRESOLVED`.

### Minimum evidence
One clean eligible child may resolve this envelope because the question is the direct response to a single atomic Coach change.

### Unsupported cases
FREE format without a repeatable primary metric; cross-format change; variant/composition co-change; partial execution.

## N4. COUNT -1

Same parent-context rules as COUNT +1, but count decreases by exactly one step.

Acceptable:
`performanceRetention >= 0.85`.

Poor:
`performanceRetention < 0.85` under clean execution.

Resolution:
- ACCEPTABLE → `CONFIRM_CHANGE`;
- POOR → `MAINTAIN_CHILD / COLLECT` by default; do not automatically restore the heavier parent;
- AMBIGUOUS → `MAINTAIN_COLLECT_EVIDENCE`.

Strong outcome is unsupported.

## N5. ROUNDS +1 / -1

Supported only in modes where the Measurement Contract supplies a valid rate metric comparable between parent and child.

Recommended primary rate family:

```text
roundRate =
  completedRounds / actualDurationMinutes
```

Inputs: completed rounds, actual duration.
Units: rounds/minute.
Range: `>=0` for valid positive duration.
Missing: unresolved.
Zero duration: invalid.
Threshold: envelope retention threshold `0.85`.

Resolution:
- +1 poor clean response → revert the round increase;
- -1 poor response → maintain reduced workload / collect;
- acceptable → confirm child;
- ambiguous → collect.

No workload-volume ratio is calculated.

## N6. DURATION +1 / -1 step

Supported only in TIME/COMBINED modes where the Measurement Contract supplies a valid rate metric measurable under both parent and child.

Default duration step:
`±60 seconds`.

Primary response metric:
the Measurement-Contract-defined higher-is-better rate.

Threshold:
`performanceRetention >= 0.85` acceptable; `<0.85` poor.

Resolution:
- +1 poor clean response → revert duration increase;
- -1 poor clean response → maintain reduced duration/collect;
- acceptable → confirm child;
- ambiguous → collect.

If no compatible rate metric exists, Level B is `UNSUPPORTED`.

## N7. ORDER_CHANGE

Supported when mode, format, planned duration, target, rounds, composition, exercise IDs, variants and counts are identical and only ordered slot position changes.

Primary metric:
direct primary metric under the unchanged workload structure.

Resolution:
`performanceRetention >= 0.85` → ACCEPTABLE;
`<0.85` → POOR;
missing/confounded → AMBIGUOUS.

- acceptable → confirm order;
- poor → revert order;
- ambiguous → collect.

No exercise-level causal attribution is permitted.

## N8. VARIANT change

`UNSUPPORTED` for causal-style Level B in V3.0.0 unless a future compatible Exercise Matrix version carries a versioned variant-specific response envelope.

Ordinary variant selection remains supported through Exercise Intelligence and Level A reasoning.

Level B result:
`UNRESOLVED / NOT_SUPPORTED`.

No automatic revert/progression may be justified by the unsupported Level B result.

## N9. REPLACE / REMOVE / ADD_4TH

These interventions are `UNSUPPORTED` for causal-style Level B in the current metric model because they change composition semantics without a validated response model.

They remain ordinary Exercise Intelligence actions when a structural or evidence-based objective authorizes them.

Results are historical evidence for the new context; they do not resolve a causal response envelope.

No generic planned-volume ratio is allowed.

## N10. FORMAT_CHANGE

Cross-format Level B is `UNSUPPORTED` unless an explicit future response envelope exists.

A format change remains subject to `formatPolicy`.

## N11. Structural bundle

A structural bundle is one intervention.

For `ADD_4TH + ORDER_CHANGE`, `REPLACE + ORDER_CHANGE`, `REMOVE + ORDER_CHANGE` and `DURATION + ROUNDS` special-format behavior:

- application and execution fidelity can be validated;
- the whole bundle is stored as one intervention;
- Level B causal attribution is `UNSUPPORTED` in V3.0.0 unless a dedicated bundle envelope exists;
- internal levers cannot be separately rewarded or penalized.

## N12. REENTRY

Re-entry uses its dedicated special envelope in Section P, not generic Level B.

Outcome:
`R1`, `R2`, `R3`, or `UNRESOLVED`.

## N13. Envelope registry

| Intervention | Level B support | Primary response basis | Minimum | Clean poor outcome | Unsupported condition |
|---|---|---|---:|---|---|
| COUNT +1 | SUPPORTED | same-context performance retention | 1 child | `<0.85` | no repeatable primary metric/confounder |
| COUNT -1 | SUPPORTED | same-context performance retention | 1 child | `<0.85` | no repeatable primary metric/confounder |
| ROUNDS +1 | SUPPORTED | rate retention | 1 child | `<0.85` | no valid rate metric |
| ROUNDS -1 | SUPPORTED | rate retention | 1 child | `<0.85` | no valid rate metric |
| DURATION +1 step | SUPPORTED | rate retention | 1 child | `<0.85` | no valid rate metric |
| DURATION -1 step | SUPPORTED | rate retention | 1 child | `<0.85` | no valid rate metric |
| ORDER_CHANGE | SUPPORTED | unchanged primary metric retention | 1 child | `<0.85` | workload context changed |
| VARIANT | UNSUPPORTED | none | — | — | no V3.0.0 variant envelope |
| REPLACE | UNSUPPORTED | none | — | — | changed composition semantics |
| REMOVE | UNSUPPORTED | none | — | — | changed composition semantics |
| ADD_4TH | UNSUPPORTED | none | — | — | changed composition semantics |
| structural bundle | UNSUPPORTED | none | — | — | no bundle-specific envelope |
| FORMAT_CHANGE | UNSUPPORTED | none | — | — | cross-format semantics |
| REENTRY | SUPPORTED special branch | completion + within-session deterioration | 1 valid child | R1/R2 | missing reference/metric |

# O. REPEAT / MAINTAIN / CONTROL

## O1. MAINTAIN

Purpose: preserve the current valid workout because there is insufficient authority for change or the current plan is still appropriate.

Requirements:

- current workout must be valid;
- ownership must be known or Coach-owned when Coach provenance is required;
- no branch requires a different protocol.

## O2. REPEAT

Purpose: collect another observation under the same protocol because the current observation is informative but not sufficient for adaptation.

Typical trigger:

```text
one anomalous comparable session
+ no decisive confounder
+ no qualifying repeated negative pattern
→ REPEAT
```

Repeat is not a generic fallback for every uncertainty. The system must be able to explain what evidence is being collected.

## O3. CONTROL

Control is an unchanged or deliberately frozen protocol designed to answer a specific question.

Every control must contain:

```text
question
frozenContext
controlledVariable
expectedOutcomeA
expectedOutcomeB
resolutionRule
nextBranch
```

Without a concrete question:

`CONTROL` is prohibited.

## O4. NO_ACTION

NO_ACTION is required when Coach cannot safely claim authorship, cannot produce a valid spec, or release/semantic integrity prevents reliable execution.

---

# P. RE-ENTRY

Re-entry is a distinct branch, not ordinary Level B.

## P1. Trigger

Initial engineering trigger:

`gapDays >= 8`

This is a versioned CDD/PTV product parameter, not a physiological law.

## P2. Gap calculation

```text
gapDays = localCalendarDay(decisionNow, decisionTimezone)
          - localCalendarDay(lastValidTrainingEnd, decisionTimezone)
```

**Rule contract**

- Inputs: explicit `decisionNow`, `decisionTimezone`, last valid training end timestamp.
- Formula: integer difference between local calendar day IDs.
- Units: calendar days.
- Range: integer ≥ 0 for valid chronological inputs.
- Threshold: `8` days is the initial engineering trigger.
- Initial state: no re-entry if no prior valid training reference exists; use baseline/cold-start rules instead.
- Missing data: no trustworthy gap → no re-entry claim; use conservative evidence-limited handling.
- Edge cases: DST does not alter calendar-day difference because local date IDs are used; future-dated records are invalid.
- Fallback: treat as unresolved/current-history limitation rather than inventing a gap.
- Classification: engineering/product parameter.

## P3. Initial workload reduction

The initial re-entry protocol uses a reference reduction factor:

`REENTRY_FACTOR = 0.70`

This is a CDD/PTV engineering boundary, not a physiological recovery law.

### Critical structural rule

The factor may reduce measurable workload dimensions but may not violate structural minimums.

For a product with minimum three exercises per round:

```text
exerciseCount_reentry =
  max(minExercisesPerRound,
      floor(referenceExerciseCount × 0.70))
```

If the resulting count equals the structural minimum, no further structural reduction is permitted.

If the reference composition already equals the structural minimum, preserve composition and reduce a different permitted workload dimension instead.

Therefore the preferred re-entry order is:

1. reduce the primary measurable workload axis;
2. preserve structural minimum;
3. preserve composition/variants/order where feasible;
4. reduce a secondary measurable workload axis only when the active format and re-entry policy explicitly permit it;
5. never synthesize a 2-exercise re-entry in a 3-exercise-minimum product.

**Rule contract**

- Inputs: reference workload, structural minimum, active format.
- Formula: `reference × 0.70` for eligible workload dimensions; structural count clamp as above only if count reduction is permitted.
- Units: same unit as the workload dimension.
- Range: non-negative; bounded by product hard constraints.
- Threshold: factor `0.70` is engineering.
- Initial state: reference is the most recent valid pre-gap Coach or valid equivalent context.
- Missing data: no valid reference → baseline/recovery/NO_ACTION, not fabricated reduction.
- Edge cases: 3-exercise reference cannot become 2; invalid reference configuration requires valid recovery candidate.
- Fallback: reduce another permitted workload dimension or use valid baseline/recovery spec.
- Classification: engineering/product parameter.

## P4. Re-entry response states

```text
R1 = clearly insufficient return
R2 = borderline/ambiguous return
R3 = sufficient clean return
UNRESOLVED = mandatory re-entry measurement unavailable/invalid
```

### P4.1 Completion fraction by mode

TIME:
```text
completionFraction = actualDurationSeconds / plannedSeconds
```

ROUNDS:
```text
completionFraction = completedRounds / plannedRounds
```

COMBINED:
```text
durationFraction = actualDurationSeconds / plannedSeconds
roundFraction    = completedRounds / plannedRounds
```

For COMBINED:
- R1 if either required fraction `< 0.70`;
- R2 if both required fractions are `>= 0.70` and at least one is `< 0.90`, or valid within-session deterioration exists;
- R3 if all required fractions are `>= 0.90` and no disqualifying deterioration exists.

FREE:
- re-entry classification is supported only if its Measurement Contract defines an explicit primary completion metric;
- otherwise `UNRESOLVED`.

### P4.2 Within-session deterioration

If the active Measurement Contract defines pace/segment semantics:

`paceRetention < 0.85` is deterioration for the re-entry branch.

No such metric → deterioration state `UNKNOWN`, not poor.

### P4.3 Completion rule contract

Inputs: planned/actual values named by the Measurement Contract.
Formula: mode-specific formulas above.
Units: dimensionless ratio.
Range: normally `0..1+`; over-completion is interpreted according to the Measurement Contract.
Thresholds: `0.70`, `0.90`, and pace-retention `0.85`.
Initial state: no classification until required execution validity passes.
Missing required data: `UNRESOLVED`.
Invalid denominator: `UNRESOLVED`.
Fallback: valid current re-entry preserve or baseline/recovery/NO_ACTION according to Section AE.
Classification: CDD/PTV engineering thresholds, not physiological laws.

## P5. Loop control

`MAX_REENTRY_REPEAT = 2` for the same light re-entry protocol.

After two consecutive R1/R2 sessions at the same light protocol:

- do not repeat indefinitely;
- choose one conservative supported transition if a valid local regression/recovery action exists;
- otherwise preserve the current light protocol and exit acute re-entry.

R3 exits acute re-entry and moves at most one ordinary adaptive step toward the pre-gap reference per subsequent decision.

---

# Q. EXERCISE INTELLIGENCE

Exercise choice is first-class Coach reasoning.

## Q1. Supported actions

```text
KEEP
CHANGE_VARIANT
REPLACE
REMOVE
ADD
CHANGE_ORDER
```

## Q2. KEEP

Use when the exercise remains eligible, structurally appropriate and does not create a specific evidence-backed reason for change.

## Q3. CHANGE_VARIANT

Allowed only when:

- a valid progression/regression neighbor exists;
- the new variant is permitted by equipment/restrictions;
- the objective requires a different stimulus;
- the change is smaller and more coherent than unrelated alternatives.

Adjacency on the variant ladder is the default.

## Q4. REPLACE

Use when the existing exercise is no longer an appropriate candidate because of:

- restriction;
- equipment loss;
- exercise-specific limitation;
- structural duplication;
- persistent exercise-specific negative evidence where causal/response authority exists;
- incompatibility with the current objective.

Replacement requires a valid substitution group or equivalent Exercise Matrix relationship.

## Q5. REMOVE

Removal requires a structural reason or repeated qualifying negative evidence. One isolated negative observation is not sufficient by default.

## Q6. ADD

Adding an exercise is permitted only when composition is objectively insufficient.

For 3 → 4:

1. enumerate all eligible candidate exercises;
2. require an explicit program/template/catalog/user count default for the new exercise;
3. rank candidates by structural fit;
4. never fabricate a count;
5. automatic fifth exercise creation remains prohibited unless a future version explicitly changes this invariant.

## Q7. CHANGE_ORDER

Order is a real structural lever.

Use only when order itself is relevant to the decision objective.

No order change may be generated merely for variety.

## Q8. Exposure

Exposure includes:

- exercise family;
- movement pattern;
- variant;
- recent exposure;
- long-term exposure;
- distribution;
- concentration;
- neglected areas.

Exposure is contextual/ranking information. Missing exposure never becomes an automatic instruction to add novelty.

## Q9. Numeric exposure weighting

V3.0.0 does not use arbitrary numeric zone weights as normative CoachCore decision drivers.

Qualitative exposure roles are preferred unless a future validated quantitative model is introduced in a later version.

---

# R. CANDIDATE GENERATION

Candidate generation must be finite and deterministic.

## R1. Candidate classes

Atomic candidates may include:

```text
COUNT ±1
ROUNDS ±1
DURATION one approved step
VARIANT adjacent rung
EXERCISE REPLACE
EXERCISE REMOVE
EXERCISE ADD_4TH
ORDER_CHANGE
FORMAT_CHANGE when explicitly permitted by policy
```

## R2. Candidate generation is branch-specific

The engine first determines the decision objective.

Examples:

```text
PROGRESS_CAPACITY
→ positive atomic progression candidates

REDUCE_LOCAL_STRESS
→ count/round/duration/regression/removal candidates as eligible

CORRECT_STRUCTURAL_BALANCE
→ add/remove/replace/order candidates

CONFIRM_PLATEAU
→ CONTROL only when question exists

RETURN_FROM_REENTRY
→ re-entry branch governs

RESOLVE_LEVEL_B
→ intervention envelope governs
```

## R3. Candidate object

```text
Candidate {
  id,
  candidateType,
  targetSlot?,
  targetExerciseId?,
  fromState,
  toState,
  atomicLever,
  magnitude,
  resultingMode,
  resultingDuration,
  resultingRounds,
  resultingComposition,
  structuralEffect,
  eligibility,
  rankingKey,
  requiredEvidence,
  expectedMeasurement
}
```

## R4. Candidate finiteness

Candidate generation must not invent new candidates after the finite ranked set is exhausted.

---

# S. CANDIDATE RANKING

Ranking is deterministic lexicographic ordering, not a weighted score.

## S1. Atomic candidate ranking

All eligible atomic candidates are first ranked by the following ordered keys:

1. hard/evidence eligibility;
2. objective sufficiency;
3. smallest valid change;
4. context/claim confounder class: NO_CLAIM_CONFOUNDER > NON_BLOCKING_CONTEXT_ONLY;
5. higher-priority question-scoped evidence class under Section F;
6. context compatibility: NO_EXPLICIT_CONFLICT > CONTEXT_CAUTION;
7. goal compatibility for supported goals;
8. exercise/structural fit;
9. exposure fit;
10. deterministic candidate ID.

No candidate receives a hidden numerical composite score.

## S2. Progression ranking

Preferred order:

1. eligible atomic candidate;
2. smallest magnitude;
3. stable recent qualifying performance;
4. no unresolved Level B;
5. no hard/context block;
6. supported-goal alignment;
7. deterministic slot order.

## S3. Regression ranking

Preferred order:

1. identified limiting area;
2. candidate directly reduces that limiting area;
3. smallest sufficient reduction;
4. preserves goal-relevant structure;
5. lowest structural collateral impact;
6. deterministic slot order.

## S0. Ranking value domains

The lexicographic keys use finite, non-scored domains:

```text
objectiveSufficiency:
  TRUE > FALSE

evidenceClass:
  PRIMARY > SECONDARY > CONTEXT_ONLY

goalAlignment:
  DIRECT > NEUTRAL > OFF_AXIS

structuralFit:
  SATISFIES_REQUIREMENT > NEUTRAL

exposureFit:
  REDUCES_EXPLICIT_CONCENTRATION > NEUTRAL

contextCompatibility:
  NO_EXPLICIT_CONFLICT > CONTEXT_CAUTION
```

`CONTEXT_Caution` can never outrank a hard/admissibility block because it is evaluated only after admissibility.

There is no weighted composite score and no arithmetic aggregation of these domains.

## S4. Structural ranking

When structural adaptation is internally authorized, rank:

1. structural objective fit;
2. zone/movement balance;
3. limiting-area relevance;
4. family concentration reduction;
5. equipment feasibility;
6. difficulty fit;
7. freshness only as a secondary tie-break;
8. deterministic candidate ID.

Variety cannot win against a better supported candidate merely because it is novel.

---

# T. MULTI-LEVER

## T1. Default

One atomic lever is mandatory unless the internal structural gate passes.

## T2. Authority

Only CoachCore may authorize multi-lever behavior.

UI and Builder flags are advisory at most and cannot create authority.

External `structuralNeed` or `singleLeverInsufficient` input flags are not accepted as authority.

## T3. Allowed structural classes

Initial automatic multi-lever classes are intentionally narrow:

```text
ADD_4TH + ORDER_CHANGE
REPLACE + ORDER_CHANGE when order reconstruction is structurally required
REMOVE + ORDER_CHANGE when structural validity requires it
DURATION + ROUNDS only where COMBINED semantics explicitly require both dimensions
REENTRY protocol changes as a special branch, not ordinary multi-lever adaptation
```

The following are not automatically allowed merely because they are individually useful:

```text
COUNT + VARIANT
COUNT + ROUNDS
COUNT + DURATION
ROUNDS + VARIANT
DURATION + VARIANT
COUNT + STRUCTURAL_CHANGE
```

They require an explicit versioned intervention envelope and structural gate in a future revision.

## T4. Structural gate

Multi-lever is allowed only if:

1. no sufficient atomic candidate exists;
2. the objective cannot be satisfied by one lever;
3. the combination is a pre-authorized structural class;
4. the resulting spec passes all hard filters;
5. the combination has a defined execution/response envelope;
6. provenance identifies the whole bundle as one intervention.

## T5. Attribution

A structural bundle is one intervention. Level B cannot attribute the response to individual internal levers unless the envelope explicitly permits decomposition.

---

# U. PERSONALIZATION

Personalization uses explicit meanings, not hidden multipliers.

| Parameter | Meaning | Candidate effect | Confidence effect | Comparability effect | Veto | Direct workload multiplier |
|---|---|---|---|---|---|---|
| Age | profile context | NO automatic candidate effect in V3.0.0 | no hidden effect | only if a claim-specific contract explicitly names age sensitivity | only via explicit restriction | NO |
| Sex | contextual demographic field when provided | NO automatic candidate effect in V3.0.0 | no universal effect | only if a claim-specific contract explicitly names sex sensitivity | only via explicit restriction | NO |
| Height | anthropometric context | NO automatic candidate effect in V3.0.0 | no | only if a claim-specific contract explicitly names height sensitivity | no automatic veto | NO |
| Weight | body mass context | no workload multiplier; Exercise Matrix may mark BODYWEIGHT sensitivity | may alter evidence comparability under Section E8 | yes, through the defined modifier | no automatic veto | NO |
| Weight trend | direction of body mass | no direct workload effect | may change contextual interpretation | only through explicit claim sensitivity | no | NO |
| Experience | declared/observed training context | only where Exercise Matrix `coachEligibility` explicitly names experience | may cap eligibility when the matrix says so | no generic effect | only via explicit matrix/config rule | NO |
| Goal | strategic objective | objective, candidate ranking, supported direction | may limit recommendation authority | no generic effect | goal support can gate goal-specific action | NO |
| Equipment | available environment | hard candidate filter | no | yes when relevant exercise semantics depend on it | YES | NO |
| Restrictions | explicit user/system boundary | hard candidate filter | no | yes if historic state differs and the affected claim is restriction-sensitive | YES | NO |

## U1. Weight change

For bodyweight-sensitive exercise claims, Section E8 defines the normative comparability rule.

`BODY_MASS_STRICT_BLOCK_THRESHOLD = 5%`.

No universal formula converting body mass into external workload is used.

For other profile fields, relevance is claim-specific and comes from the Exercise Matrix `comparabilitySensitivity` plus the active Measurement/Program contract.

If a required sensitivity rule is missing:
- preserve the record in HistoryContext;
- exclude the affected strict claim as `UNRESOLVED`.

## U2. Profile transitions

A profile change is an event in historical semantics.

A performance record from before and after a material profile transition may remain historical context but must not be silently treated as one trend cohort when the transition is relevant to the claim.

---

# V. GOALS

Goal is first-class strategic state.

## V1. GoalState

```text
GoalState {
  type,
  metric,
  target?,
  supportStatus,
  currentValue?,
  remainingGap?,
  alignment,
  limitations[]
}
```

## V2. GENERAL

Supported using current factual performance/composition evidence.

## V3. ENDURANCE

Supported where the Measurement Contract supplies meaningful pace/rate/repeatability evidence.

## V4. CONSISTENCY

Supported as a behavioral/regularity objective.

The goal may favor preserving a sustainable current protocol and collecting evidence rather than forcing workload increases.

It is not a workload multiplier.

## V5. RETURN / REENTRY

Handled primarily through `SessionPurpose = REENTRY`, not as an ordinary workload multiplier.

## V6. STRENGTH / HYPERTROPHY / POWER

V3.0.0 remains data-limited unless the required metrics and measurement contracts are explicitly supported.

The Coach may still operate on supported factual performance rules, but it must not pretend the current model can optimize unsupported target metrics.

`DecisionStatus = GOAL_LIMITED` applies to the recommendation authority, not by erasing the factual performance state.

## V7. Goal conflict

Goal pressure never overrides:

- hard constraints;
- evidence insufficiency;
- Level B unresolved status;
- re-entry;
- unsupported metric limitations.

---

# W. WEARABLE / EXTERNAL CONTEXT

Future external sources include Apple Health, Garmin, Fitbit, Oura and other validated sources.

## W1. Adapter pipeline

```text
RAW SIGNAL
→ VALIDATION
→ NORMALIZATION
→ QUALITY
→ PERSONAL BASELINE
→ EVIDENCE
→ CONTEXT
→ COACH INPUT
```

CoachCore receives only the final evidence/context contract.

## W2. Raw signal

Examples:

- sleep duration;
- resting heart rate;
- HRV;
- heart rate;
- HR zones;
- steps/activity;
- training load;
- weight;
- respiratory metrics.

## W3. Validation

Checks include:

- source identity;
- timestamp validity;
- duplicate detection;
- unit validity;
- impossible/out-of-range data;
- source continuity;
- source confidence.

## W4. Personal baseline

Where baseline comparison is useful, it must be source-specific and profile-specific.

No global physiological baseline is assumed.

## W5. Authority

Wearable evidence may:

- add context;
- reduce confidence in a decision;
- trigger a control/preserve branch where the contract explicitly permits;
- contribute to evidence quality.

Wearables may not directly set workout duration, count, rounds or composition.

## W6. Missing wearable data

Missing wearable data is `UNKNOWN`, not `BAD`.

The Coach must fall back to non-wearable evidence without requiring the user to have a device.

## W7. Wearable anomaly

A single anomalous wearable observation is `EXTERNAL_CONTEXT_LIMITED` unless the ExternalContext contract explicitly marks the source and metric as validated for the relevant decision question.

It cannot override qualifying performance evidence.

## W8. Wearable/performance conflict

Default evidence order:

```text
release integrity
→ hard constraints
→ valid execution/performance
→ verified Level B intervention evidence
→ validated external context
→ contextual preference
```

External context may lower recommendation permission only when a specific Coach rule names that external signal as a permissible gate.

Raw wearable data can never directly set duration, count, rounds or composition.

No medical diagnosis or medical state inference is permitted.

## W9. Missing wearable

Missing external data is `UNKNOWN`, not negative, and does not lower internal evidence quality merely because a device is absent.

---

# X. CONFLICT RESOLUTION

Every material conflict must resolve deterministically.

## X1. Positive performance vs wearable caution

If performance is clean and wearable evidence is cautious but not independently validated:

- preserve performance state;
- attach external caution;
- apply only explicitly authorized context gates.

## X2. Stable history vs one poor current session

If the current session is valid but isolated:

- do not permanently rewrite CapacityProfile;
- evaluate current context;
- normally REPEAT or MAINTAIN unless a qualifying repeated negative signal exists.

## X3. Level B vs ordinary progression

Unresolved Level B has precedence over a new unrelated progression.

No unrelated adaptive lever may be stacked on an unresolved intervention unless a safety branch explicitly requires it.

## X4. Goal vs exposure

Goal sets direction. Exposure determines available structural/context information. Neither automatically overrides the other.

## X5. Profile vs actual equipment

Actual validated equipment availability at decision time is authoritative for candidate eligibility.

Historical equipment state remains relevant to comparability of old records.

## X6. Capacity vs current performance

Current valid comparable performance describes the current observation.

CapacityProfile describes longer-term capability.

Current one-session evidence does not silently erase capacity, and old capacity does not erase a current clean negative signal.

## X7. Weight change vs old bodyweight evidence

A material bodyweight change without validated normalization lowers or removes the affected strict claim. The records remain historical context.

## X8. Conflicting release/version semantics

If release components are incompatible:

`NO_ACTION`.

Never guess which version should win.

## X9. Conflicting profile sources

If multiple profile sources disagree:

1. use the explicitly declared profile authority for the effective time;
2. if no authority is declared, set the disputed field to `UNKNOWN`;
3. do not choose by recency alone unless the Profile contract explicitly defines recency as authority;
4. if the disputed field is claim-relevant, the affected claim becomes `UNRESOLVED`;
5. non-affected claims may continue.

Missing/unknown profile data is never interpreted as poor performance.

---

# Y. CONSTRAINTS

## Y1. Hard constraints

At minimum:

- explicit exclusions;
- equipment requirements;
- restrictions;
- invalid exercise/variant;
- forbidden combinations;
- active workout lock;
- stale state;
- malformed WorkoutSpec;
- system maximum duration;
- minimum exercise structure;
- maximum configured exercise structure;
- fixed format policy;
- program/template restrictions;
- compatibility rules.

## Y2. Structural minimum

The current product minimum remains three exercises per round where that format is active.

The maximum remains configuration-dependent within supported product policy.

Automatic fifth-exercise creation remains prohibited in V3.0.0.

## Y3. Constraint precedence

```text
Release integrity
> hard constraints
> ownership/execution validity
> evidence eligibility
> candidate ranking
> goal alignment
> novelty/freshness
```

No positive evidence can move upward across this precedence order.

---

# Z. WORKOUTSPEC

WorkoutSpec is the only artifact the Workout Engine may need to execute the Coach decision.

```text
WorkoutSpec {
  specId,
  specVersion,
  decisionMode,
  sessionPurpose,
  decisionStatus,

  mode,
  formatPolicy,
  plannedSeconds?,
  target?,
  targetRounds?,

  composition: [
    {
      slotId,
      exerciseId,
      variantId,
      count,
      order
    }
  ],

  sessionType,
  ownership,
  adaptation,
  adaptationMagnitude,

  abilityCapacitySnapshot,
  readinessContext,
  confidenceProfile,
  performanceContext,
  goalState,

  evidenceRefs,
  evidenceCohortIds,
  interventionWindowRef?,
  controlSpec?,

  measurementContractVersion,
  explanation,
  provenance,
  contextFingerprint,
  releaseManifestRef,
  validationResult
}
```

## Z1. Rules

- Workout Engine must not need internal Coach decision logic.
- WorkoutSpec must be fully validated before execution.
- A Builder-owned workout may be returned as `NO_ACTION` without Coach provenance.
- A Coach-owned preserve decision may return a valid unchanged spec with `appliedLevers = []`.
- REENTRY carries `sessionPurpose = REENTRY` and `adaptation.kind = REENTRY_PROTOCOL`.
- CONTROL carries a complete ControlSpec.
- REPEAT carries the same valid workout configuration but distinct session purpose and explanation.

---

# AA. MEASUREMENT CONTRACT

The Measurement Contract is mandatory between Workout Engine and Coach.

## AA1. Contract

```text
MeasurementContract {
  version,
  mode,
  primaryMetric,
  primaryUnit,
  plannedDefinition,
  actualDefinition,
  completedRoundDefinition?,
  earlyStopDefinition,
  segmentBoundaryDefinition?,
  lapBoundaryDefinition?,
  requiredMeasurements,
  optionalMeasurements,
  missingValueSemantics,
  invalidValueSemantics,
  overCompletionSemantics,
  fidelityFields
}
```

## AA2. Primary metric

Exactly one primary metric is designated for the supported session mode.

## AA3. Planned vs actual

The contract distinguishes:

- what Coach planned;
- what Workout Engine started;
- what user actually executed.

## AA4. Completed round

A completed round is defined by execution events, not inferred by Coach from elapsed time alone.

## AA5. Early stop

`endedBy` is explicit and must distinguish, at minimum:

- normal completion;
- user stop;
- system interruption;
- malformed/unknown termination.

Early stop is descriptive, not synonymous with failure.

## AA6. Segment boundaries

If pace/slowdown is used, lap/round boundaries must come from the Workout Engine's measurement contract.

## AA7. Mandatory measurements

A workout is not performance-complete for a specific decision claim if a mandatory metric is missing.

## AA8. Missing performance

Missing mandatory performance means:

`Performance = UNKNOWN`

not `Performance = POOR`.

## AA9. Measurement versioning

A historical result can remain valid only for the measurement contract under which it was recorded.

A later contract may not silently reinterpret old measurements.

---

# AB. PROVENANCE / EXPLANATION

## AB1. Provenance

Every Coach-authored WorkoutSpec must contain:

```text
Provenance {
  coachOwned,
  sourceSpecId?,
  derivedFrom?,
  decisionNow,
  decisionTimezone,
  specVersion,
  coreVersion,
  releaseManifestRef,
  exerciseMatrixVersion,
  compatibilityVersion,
  measurementContractVersion,
  decisionQuestion,
  decisionBranch,
  evidenceRefs,
  appliedLevers,
  executionAuthority,
  contextFingerprint,
  usedDecisionVariables[]
}
```

## AB2. Explanation contract

Every meaningful decision answers:

```text
WHAT
WHY
BASED ON WHAT
LIMITATIONS
```

Example structure:

```text
WHAT:
Added +1 pull-up in slot 1.

WHY:
The smallest valid progression satisfied the current progress objective.

BASED ON WHAT:
Three qualifying comparable sessions in the current trend context, stable
primary performance, no unresolved intervention and no hard/context block.

LIMITATIONS:
No wearable evidence was used.
```

## AB3. Explanation provenance

Explanation may reference only variables that materially influenced the decision.

The system must not mention:

- variables that were not used;
- hidden scores;
- unsupported physiological mechanisms;
- invented causal explanations.

## AB4. No generic explanations

"Because you are ready" is invalid unless a concrete Readiness Context variable and rule are named.

"Because your muscles recovered" is invalid under the current data model.

## AB5. Used-variable manifest

Every explanation must be accompanied by `usedDecisionVariables[]`.

Allowed entries are canonical paths into:
`CoachInput`, `EvidenceViews`, `Objective`, `AuthorityDecision`, `Candidate`, `Constraints`, `GoalState`, `ReadinessContext`, `ConfidenceProfile`, `ResponseEnvelope`, and `MeasurementContract`.

A validator must reject any explanation clause that references a variable absent from `usedDecisionVariables`.

## AB6. Deterministic identity

`contextFingerprint` is the hash of canonicalized, ordered decision inputs that are allowed to affect the decision.

`specId` is derived deterministically from:

```text
specId =
hash(
  releaseManifestRef,
  contextFingerprint,
  decisionNow,
  decisionMode,
  sessionPurpose,
  decisionStatus,
  selectedCandidateFingerprint
)
```

No random UUID, wall-clock call, object iteration order, or UI-generated identifier may be used for Coach determinism.

---

# AC. HISTORICAL REPRODUCIBILITY

Long-term reproducibility is a core correctness requirement.

## AC1. Immutable semantic snapshot

Every meaningful historical workout record must retain:

- profile snapshot;
- config snapshot;
- hard-constraint snapshot;
- exerciseMatrixVersion;
- compatibilityVersion;
- measurementContractVersion;
- effective timestamp;
- decision timezone;
- provenance/release information where Coach was involved.

## AC2. Matrix update

If the current Exercise Matrix changes:

- old records retain their original semantic version;
- old records may remain usable if a valid compatibility relationship exists;
- otherwise they are historical context only for the affected claim.

The system must not reinterpret old variants through the new matrix silently.

## AC3. Profile update

If age/height/weight/experience/equipment/restrictions/goal change materially:

- future decisions use the new effective profile;
- prior evidence retains its old profile snapshot;
- cross-profile comparability is claim-specific.

## AC4. Deleted/edited history

Coach state must be recomputable from canonical History plus immutable semantic snapshots.

No hidden score may survive deleted evidence and continue to influence decisions.

## AC5. Same history, new matrix

The same raw History under a different Exercise Matrix version is not necessarily the same semantic input.

Reproducibility requires either:

1. the original matrix snapshot/version;
2. a valid compatibility mapping;
3. or a deterministic `UNRESOLVED` outcome.

## AC6. Effective timestamp

All historical changes are time-scoped.

A later profile change cannot retroactively change the historical profile of an older record.

---

# AD. RELEASE MANIFEST

V3.0.0 requires an explicit release manifest.

```text
CoachReleaseManifest {
  specVersion,
  coreVersion,
  buildHash,
  sourceHash,
  fixtureCorpusVersion,
  exerciseMatrixVersion,
  compatibilityVersion
}
```

## AD1. Required relationships

All components used by CoachCore must resolve to one compatible manifest.

## AD2. Fail-closed rule

If any required release component:

- is missing;
- has a mismatched hash;
- declares incompatible version semantics;
- references an unknown fixture corpus;
- references an unsupported Exercise Matrix compatibility version;

then Coach must not produce an adaptive recommendation.

Permitted result:

`NO_ACTION + DecisionStatus.STALE`.

## AD3. Diagnostics

The active release manifest must be exposed through a diagnostic read path but must not be modifiable by UI state.

## AD4. Version semantics

`specVersion` defines normative behavior.

`coreVersion` defines executable Coach implementation.

`buildHash` identifies compiled/deployed artifact.

`sourceHash` identifies normative source/build input.

`fixtureCorpusVersion` identifies mandatory behavior corpus.

`exerciseMatrixVersion` identifies exercise semantics.

`compatibilityVersion` identifies cross-version interpretation rules.

---

# AE. DETERMINISTIC FALLBACKS

Every dead end has a finite fallback.

## AE1. Candidate validation failure

```text
highest-ranked valid candidate
→ next-ranked valid candidate
→ next-ranked valid candidate
→ last valid Coach-owned spec
→ valid baseline/recovery spec
→ NO_ACTION
```

## AE2. No candidate

If no candidate is admissible:

- preserve current valid Coach-owned spec when appropriate;
- otherwise use valid baseline/recovery;
- otherwise NO_ACTION.

## AE3. Current workout invalid

`MAINTAIN` is not valid merely because it preserves the current state.

If the current spec is invalid, preservation is allowed only after constructing a valid replacement or recovery specification.

## AE4. Builder-owned current workout

No Coach authorship:

`NO_ACTION + OWNERSHIP_LIMITED`.

## AE5. Unknown/conflicting evidence

Unknown evidence reduces claim authority. It does not create a negative performance decision.

Fallback:

`PRESERVE/REPEAT/CONTROL` if valid and question-defined; otherwise valid Coach-owned preserve or NO_ACTION.

## AE6. Release mismatch

Immediate fail-closed:

`NO_ACTION + STALE`.

## AE7. Invalid Exercise Matrix

Do not generate candidate variants or substitutions from an invalid matrix.

Use last valid Coach-owned spec if still valid; otherwise valid recovery/baseline; otherwise NO_ACTION.

## AE8. Missing wearable

Ignore external evidence and continue from internal Coach evidence where sufficient.

## AE9. Last valid Coach-owned spec selection

`last valid Coach-owned spec` means the most recent Coach-authored spec that:
1. has valid release compatibility;
2. satisfies current hard constraints;
3. satisfies current equipment/restrictions;
4. satisfies current format policy;
5. has a valid Measurement Contract;
6. can be executed without violating current structural minimums.

Tie-breaker:
`effectiveTimestamp DESC`, then `specId ASC`.

An invalid current spec may never be returned merely because it is the current spec.

## AE10. Baseline/recovery selection

A baseline/recovery spec must be generated under the current release manifest, current hard constraints, current equipment/restrictions and current Measurement Contract.

If no valid baseline/recovery spec exists:
`NO_ACTION`.
---

# AF. TEST ARCHITECTURE

V3.0.0 is not implementation-ready until the following test layers exist and pass.

## AF1. Pure unit tests

Must test:

- comparability;
- reference coherence;
- decisionNow semantics;
- gap calculation;
- Measurement Contract;
- execution fidelity;
- response envelopes;
- candidate generation;
- ranking;
- hard constraints;
- fallback;
- release manifest validation.

## AF2. Property tests

Required properties:

1. same normalized input + same decisionNow → same output;
2. candidate permutation cannot alter result;
3. History record order cannot alter result when effective timestamps/provenance are unchanged;
4. invalid candidates can only be removed, never resurrected by ranking;
5. hard constraint violations never become valid through positive evidence;
6. a Builder-owned workout never gains Coach provenance accidentally;
7. partial Level B execution never becomes eligible;
8. release mismatch always fails closed;
9. changing Exercise Matrix version cannot silently reinterpret an immutable historical record.

## AF3. Integration tests

Must cover:

- CoachCore → adapter → WorkoutSpec;
- WorkoutSpec → START;
- execution → History;
- History → next Coach decision;
- stale protection;
- profile changes;
- equipment changes;
- Exercise Matrix changes.

## AF4. Regression corpus

The existing V2.8/V2.9.2 behavior corpus must be migrated and explicitly classified as:

- retained invariant;
- changed behavior;
- intentionally removed behavior.

No regression may be silently reinterpreted.

---

# AG. COMPLETE TEST MATRIX

The following cases are mandatory acceptance fixtures for V3.0.0.

| ID | Scenario | Required result |
|---|---|---|
| T01 | Four comparable workouts separated by unrelated workouts | All valid current-comparable records remain in StrictCohort; only reference-coherent records enter TrendCohort |
| T02 | Same as T01, all four mutually coherent | All four may support Level A trend |
| T03 | Current format differs from all historical format | No strict performance inference; history remains contextual |
| T04 | Current 20 min vs historical four 10 min sessions | Historical sessions do not prove 20-min performance |
| T05 | Builder-owned current workout, empty history | NO_ACTION / OWNERSHIP_LIMITED unless explicit Coach-baseline authority exists |
| T06 | Coach-owned baseline, empty history | Valid baseline/collection branch |
| T07 | Coach proposes +1, user applies but never starts | Level B ineligible |
| T08 | Coach proposes +1, user starts but manually changes count | Level B ineligible |
| T09 | Coach +1 executed exactly | Level B eligible if envelope and measurement contract pass |
| T10 | Coach +1 executed partially | Level B ineligible; preserve/collect |
| T11 | Coach +1 exact execution with malformed performance | Level B unresolved |
| T12 | Weight changes materially on pull-up profile | Bodyweight evidence comparability reduced per profile/evidence rule; no hidden load conversion |
| T13 | Weight changes but exercise is externally loaded and profile change is irrelevant | No automatic comparability penalty unless configured by the claim |
| T14 | Goal changes GENERAL → ENDURANCE | New goal applies from effective timestamp; old records preserve old goal snapshot |
| T15 | Unsupported STRENGTH goal | Factual performance state preserved; recommendation status GOAL_LIMITED |
| T16 | Exercise Matrix version changes after old history exists | Old records retain prior semantic version; no silent reinterpretation |
| T17 | New matrix lacks old variant | Old record remains historical; affected current comparability becomes unresolved |
| T18 | Equipment disappears before Apply | Candidate filtered; valid fallback required |
| T19 | Current Coach-owned WorkoutSpec becomes invalid | Do not MAINTAIN invalid spec; construct valid recovery/baseline or NO_ACTION |
| T20 | Current Builder spec becomes invalid | NO_ACTION / OWNERSHIP_LIMITED unless Coach explicitly owns replacement |
| T21 | Re-entry with exactly 3 exercises | Structural minimum preserved; no 2-exercise re-entry |
| T22 | Re-entry with 4 exercises | 0.70 reduction cannot create invalid structural composition |
| T23 | Re-entry severe early stop | R1 branch; bounded response |
| T24 | Re-entry 0.75 completion | R2 |
| T25 | Re-entry 0.95 clean completion | R3 and one-step return toward reference |
| T26 | Two R1/R2 re-entry repeats | No infinite repeat; exit acute loop |
| T27 | Wearable anomaly only | Does not override valid internal performance |
| T28 | Wearable caution + positive valid performance | Performance state preserved; caution may restrict only authorized actions |
| T29 | Wearable missing | Internal evidence used; no penalty for unavailable device |
| T30 | Wearable source invalid timestamp | External evidence rejected/limited |
| T31 | Same History + same decisionNow | Bitwise/logically identical decision inputs produce identical decision |
| T32 | Same History + different decisionNow crossing re-entry threshold | Deterministic different branch allowed |
| T33 | Same History + reordered array | Same output |
| T34 | Candidate list permutation | Same selected candidate |
| T35 | Release manifest hash mismatch | NO_ACTION / STALE |
| T36 | Unknown Exercise Matrix compatibility version | NO_ACTION / STALE or unresolved according to release contract |
| T37 | One anomalous session after long stable trend | No permanent capacity rewrite |
| T38 | Three clean comparable improving sessions | Progression may be eligible if all gates pass |
| T39 | Plateau with no explicit information question | MAINTAIN/REPEAT, not CONTROL |
| T40 | Plateau with explicit control question | CONTROL |
| T41 | Atomic candidate sufficient | Structural bundle cannot outrank it |
| T42 | Atomic candidates insufficient and authorized structural class exists | Structural bundle may be selected |
| T43 | UI sends structuralNeed=true | Ignored as authority |
| T44 | Builder sends singleLeverInsufficient=true | Ignored as authority |
| T45 | New novelty-only candidate | Rejected as insufficient reason |
| T46 | Fifth exercise candidate | Rejected by hard rule |
| T47 | Fourth exercise without valid count default | Candidate not generated |
| T48 | Four eligible add-4th candidates | Deterministic structural ranking selects one |
| T49 | Format change under fixed-format policy | Rejected |
| T50 | Format change in free policy with no cross-format evidence | Only if objective and policy allow; Level B cross-format response unresolved |
| T51 | Missing mandatory primary metric | Performance unknown, not poor |
| T52 | Early stop due to external interruption | Not automatically failure |
| T53 | Same current performance but profile snapshot changed | New context; old evidence not silently reinterpreted |
| T54 | Old historical record after matrix update with valid compatibility map | May remain comparable through explicit compatibility mapping |
| T55 | Old historical record after matrix update without mapping | Historical context only for affected claim |
| T56 | Current release says spec 3.0.0, core 2.9.2 | Fail closed |
| T57 | Current WorkoutSpec explanation mentions unused wearable value | Explanation test fails |
| T58 | Level B bundle response | Must classify bundle as one intervention |
| T59 | Count +1 response envelope unsupported in a new format | UNRESOLVED, no generic ratio |
| T60 | Deleted historical record that caused old capacity context | Recompute from canonical remaining history |
| T61 | Restored historical record | Recompute deterministically including its snapshot |
| T62 | Same History but different timezone near midnight | Correct local training-day semantics |
| T63 | DST transition during gap | Calendar-day semantics remain deterministic |
| T64 | Future-dated history record | Invalid for current evidence until valid effective time |
| T65 | Duplicate historical event | Deduplicated/invalidated under History contract |
| T66 | Conflicting profile sources | Apply explicit profile authority, otherwise status unresolved |
| T67 | Equipment available in profile but absent at decision time | Actual validated equipment wins for candidate eligibility |
| T68 | Positive performance vs hard exclusion | Hard exclusion wins |
| T69 | Goal reached | No automatic larger workload target is generated |
| T70 | No valid candidate but last Coach-owned spec valid | Preserve last valid Coach-owned spec |
| T71 | No valid candidate and current spec invalid, valid baseline exists | Baseline/recovery spec |
| T72 | No valid candidate and no valid previous/baseline spec | NO_ACTION |
| T73 | Partial intervention with positive result | No Level B attribution |
| T74 | Exact intervention with ambiguous result | REPEAT/PRESERVE according to envelope |
| T75 | Exact intervention with clean negative result | Envelope-specific conservative response; no unrelated second lever |
| T76 | Exact intervention with clean acceptable result | Confirm/continue according to envelope |
| T77 | Current History has 4 strict records but only 2 unique training days | Confidence limited; no independent 3-day directional claim |
| T78 | Same-day multiple sessions | Contextual contribution allowed; no multiplied evidence strength |
| T79 | Current Exercise Matrix changes while prepared WorkoutSpec waits for START | Fingerprint becomes stale; recompute before START |
| T80 | Current profile/equipment changes before START | Stale protection invalidates prepared spec when material |
| T81 | Planned duration differs by exactly 60s within tolerance | Strict comparability passes when all other blocking predicates pass |
| T82 | Planned duration exceeds tolerance by 1s | Strict comparability blocks duration-relevant claim |
| T83 | Same exercise ID but changed matrix semanticCompatibilityClass | Strict comparability blocks without explicit mapping |
| T84 | Bodyweight-sensitive exercise with 5% bodyweight increase | Strict comparability blocks affected claim |
| T85 | Bodyweight-sensitive exercise with <5% change | No automatic strict block from weight alone |
| T86 | Missing bodyweight on bodyweight-sensitive strict claim | Strict claim UNRESOLVED, never poor |
| T87 | Four current-comparable records, one not reference-coherent | Non-coherent record excluded from TrendCohort but retained where valid in StrictCohort |
| T88 | Trend reference record deleted | TrendCohort recomputed deterministically |
| T89 | COUNT +1 exact execution, retention exactly 0.85 | ACCEPTABLE |
| T90 | COUNT +1 exact execution, retention 0.849 | POOR |
| T91 | COUNT +1 partial execution with retention 1.20 | Level B ineligible |
| T92 | VARIANT exact execution with good performance | Level B remains UNSUPPORTED |
| T93 | ORDER_CHANGE exact execution, retention 0.85 | ACCEPTABLE |
| T94 | DURATION +1 without valid rate metric | Level B UNSUPPORTED |
| T95 | PROGRESS_CAPACITY with only 2 qualifying training days | Objective INSUFFICIENT_EVIDENCE |
| T96 | PROGRESS_CAPACITY with 3 qualifying training days and valid atomic candidate | Objective SATISFIED if all gates pass |
| T97 | CORRECT_STRUCTURAL_BALANCE without explicit structural deficiency | Objective UNSUPPORTED |
| T98 | CONFIRM_PLATEAU without Measurement-Contract stability tolerance | Objective UNSUPPORTED |
| T99 | EVIDENCE_COLLECTION with named missing metric and valid repeat session | Objective SATISFIED |
| T100 | Same normalized input + same decisionNow + repeated derivation | Same contextFingerprint/specId and same decision |

---

# AG2. CONSISTENCY CHECK + IMPLEMENTATION-READY GATE

## AG2.1 Internal consistency check

| Check | Result | Reason |
|---|---|---|
| Decision Contract ↔ Decision Tree | PASS | DecisionMode, SessionPurpose, DecisionStatus and Adaptation are separate and mapped in Section I |
| Authority ↔ Candidate Ranking | PASS | admissibility is resolved before ranking; question-scoped evidence is explicit |
| StrictCohort ↔ TrendCohort | PASS | Section E8 separates current comparability from reference-coherent trend evidence |
| Level A ↔ Level B | PASS | Level A is non-causal trend evidence; Level B is exact-intervention evidence |
| Level B ↔ Response Envelopes | PASS | supported interventions have explicit envelopes; unsupported types are bounded |
| Reentry ↔ Hard Constraints | PASS | structural minimum is preserved |
| Reentry ↔ Measurement Contract | PASS | response uses contract-defined completion and within-session measures |
| Exercise Intelligence ↔ Multi-Lever | PASS | exercise actions are candidates; multi-lever authority remains internal |
| Goals ↔ Objective Sufficiency | PASS | supported/unsupported goals map to explicit objective states |
| Personalization ↔ Comparability | PASS | profile sensitivity is claim-specific and matrix/config driven |
| Wearables ↔ Authority | PASS | external context reaches Coach only through the evidence boundary |
| WorkoutSpec ↔ Measurement Contract | PASS | measurement contract version is carried by the spec |
| WorkoutSpec ↔ Provenance | PASS | provenance carries evidence, question, versions and used variables |
| History snapshots ↔ Reproducibility | PASS | semantic snapshots are mandatory and immutable |
| Release Manifest ↔ Fail-Closed | PASS | incompatible components produce NO_ACTION/STALE |
| Fallback ↔ Invalid current workout | PASS | invalid current state cannot be returned as MAINTAIN |
| Builder ownership ↔ COLD_START | PASS | Builder-owned state cannot acquire Coach provenance retroactively |
| decisionNow ↔ gapDays | PASS | gap is derived only from explicit decisionNow and timezone |
| deterministic ranking ↔ candidate finiteness | PASS | finite candidate set and stable ordering prevent loops |

## AG2.2 Twenty-point implementation-ready gate

Here `PASS` means the normative specification contains the required input, condition, output, authority, missing-data behavior, edge cases, fallback and acceptance test. It does not claim that the runtime has already passed those tests.

| # | Criterion | Result |
|---|---|---|
| 1 | Every normative rule has a concrete data input | PASS |
| 2 | Every rule has deterministic condition and output | PASS |
| 3 | Every arithmetic rule has a documented parameter contract | PASS |
| 4 | Every supported intervention has a response envelope or explicit unsupported status | PASS |
| 5 | Measurement Contract is versioned and normatively shared by Coach/Workout | PASS |
| 6 | Builder/Coach ownership is mechanically defined | PASS |
| 7 | Level B execution fidelity is represented in canonical History | PASS |
| 8 | Historical semantic snapshots are mandatory | PASS |
| 9 | decisionNow is explicit and internal clock access is forbidden | PASS |
| 10 | Release manifest is checked and fails closed | PASS |
| 11 | Complete acceptance matrix exists | PASS |
| 12 | Determinism/permutation/property tests are specified | PASS |
| 13 | Invalid current configuration cannot be returned as valid MAINTAIN | PASS |
| 14 | Fallback ladder is finite and executable | PASS |
| 15 | Exercise Matrix version/compatibility behavior is specified and tested | PASS |
| 16 | Explanation variables are explicitly validated against used variables | PASS |
| 17 | Correctness requires no hidden state | PASS |
| 18 | Implementation may not invent normative behavior | PASS |
| 19 | Unsupported/unresolved areas have explicit bounded outputs | PASS |
| 20 | Release reproducibility is tied to the declared manifest | PASS |

## AG2.3 Final normative status

**V3.0.0 is now specification-level IMPLEMENTATION-READY.**

No BLOCKING normative gap remains.

This status does not imply production/runtime readiness. Runtime conformance requires actual implementation and successful execution of the complete acceptance corpus and release checks defined by this specification.

# AH. MIGRATION / IMPLEMENTATION NOTES
## AH0. Final V3.0.0 formalization changes

### Change 01 — Strict comparability

**WAS** → StrictCohort existed, but several field-level semantics and trend coherence remained conceptual.

**PROBLEM** → An implementer could choose whether profile, matrix, Measurement Contract or program changes were blocking.

**NEW RULE** → Section E8 defines `StrictComparabilityContract` and deterministic `TrendCohort`.

**BEHAVIOR CHANGE** → A record may be comparable-to-current but not trend/reference-coherent.

**REASON** → Prevents false temporal claims without discarding useful history.

**TEST** → T01–T04, T12–T17, T81–T88.

### Change 02 — Intervention envelopes

**WAS** → COUNT ±1 and several other interventions depended on generic wording around tolerance/validation.

**PROBLEM** → Implementation could invent thresholds or planned-volume ratios.

**NEW RULE** → Section N provides explicit envelopes for supported Level B interventions and declares unsupported interventions explicitly.

**BEHAVIOR CHANGE** → Unsupported interventions cannot resolve causal-style Level B.

**REASON** → Removes false precision.

**TEST** → T07–T11, T58–T59, T73–T76, T89–T94.

### Change 03 — Objective sufficiency

**WAS** → The pipeline used objective sufficiency without a complete logical contract.

**PROBLEM** → A candidate could be ranked before the objective itself was supportable.

**NEW RULE** → Section G6 defines objectives, support states and candidate sufficiency predicates.

**BEHAVIOR CHANGE** → Candidate ranking cannot rescue an unsupported or insufficient objective.

**REASON** → Makes decision intent explicit and testable.

**TEST** → T38–T42, T95–T99.

### Change 04 — Ambiguous implementation language

**WAS** → Terms such as material, meaningful, sufficient and appropriate were used descriptively.

**PROBLEM** → Different implementations could make different decisions.

**NEW RULE** → Section C12–C18 defines these terms or delegates them to the responsible contract.

**BEHAVIOR CHANGE** → Unspecified semantics become UNRESOLVED/NOT_SUPPORTED rather than invented.

**REASON** → One normative interpretation.

**TEST** → T86, T91, T94–T99.

### Change 05 — Deterministic identities

**WAS** → Internal time/randomness was prohibited, but spec identity generation was not fully normative.

**PROBLEM** → Nondeterministic IDs could still break reproducibility.

**NEW RULE** → Section AB6 defines deterministic `contextFingerprint` and `specId`.

**BEHAVIOR CHANGE** → Same normalized input + same decisionNow yields the same decision identity.

**REASON** → Reproducibility becomes directly testable.

**TEST** → T31, T33, T34, T100.

### Change 06 — Re-entry completion semantics

**WAS** → Re-entry had completion thresholds, but COMBINED-mode authority was not fully explicit.

**PROBLEM** → An implementation could choose duration or rounds arbitrarily for R1/R2/R3.

**NEW RULE** → Section P4 defines mode-specific completion formulas and COMBINED requires both active dimensions.

**BEHAVIOR CHANGE** → Re-entry classification is identical across implementations for the same Measurement Contract.

**REASON** → Removes a hidden branch choice.

**TEST** → T21–T26.

### Change 07 — Ranking domains and profile authority

**WAS** → Ranking keys and profile fields were conceptually ordered but some value semantics remained qualitative.

**PROBLEM** → Engineers could accidentally reintroduce numeric weights or invent demographic effects.

**NEW RULE** → Section S0 defines finite ranking domains; Section U explicitly disables automatic age/sex/height workload/candidate effects and Section X9 defines profile-source conflicts.

**BEHAVIOR CHANGE** → No hidden ranking score or demographic multiplier can enter through ambiguous language.

**REASON** → Preserves the no-coefficients architecture.

**TEST** → T66, T67, T81–T86, T89–T100.


This document is normative specification only. It does not modify code.

## AH1. Source consolidation

Historical rules must be mapped into one V3.0.0 rule registry.

Every migrated rule must be labeled:

```text
KEEP
MODIFY
REMOVE
NEW
```

## AH2. V2.8 retained

Retain conceptually:

- deterministic core;
- strict evidence discipline;
- one-lever default;
- hard constraints;
- re-entry as separate branch;
- final WorkoutSpec validation;
- fresh Apply / stale protection;
- provenance;
- no automatic fifth exercise;
- conservative fallback;
- no unsupported physiology.

## AH3. V2.9.2 retained but normalized

Retain conceptually:

- non-contiguous strict cohort;
- recent strict window;
- goal as strategic state;
- explicit decision objective;
- structural gate;
- COLD_START ownership;
- re-entry precedence;
- explicit control question;
- versioned release semantics.

## AH4. V2.9.2 removed or replaced

Remove:

- generic ESTIMATED planned-volume normalization;
- scalar weighted confidence score;
- action-driving EMA ability;
- broad automatic multi-lever classes;
- any authority derived from UI/context flags;
- automatic generic format-change priority.

## AH5. Newly mandatory V3.0.0 infrastructure

Add normatively:

- orthogonal Decision Contract;
- admissibility + question-scoped evidence authority;
- Level B execution fidelity;
- intervention-specific response envelopes;
- current-comparable vs trend-coherent evidence;
- immutable semantic history snapshots;
- explicit decisionNow/timezone semantics;
- formal Measurement Contract;
- release manifest fail-closed behavior;
- last-valid/baseline/NO_ACTION fallback ladder.

## AH6. Migration principle

No code path should be considered conformant merely because it produces a familiar workout.

Conformance is defined by the full contract:

```text
RULE
→ INPUT
→ CONDITION
→ EVIDENCE
→ AUTHORITY
→ CANDIDATE
→ VALIDATION
→ SPEC
→ EXECUTION
→ HISTORY
→ REPRODUCIBILITY
→ TEST
```

---

# AI. KNOWN LIMITATIONS

## AI1. Current metric scope

CINDY cannot honestly optimize unsupported goals merely by relabeling existing metrics.

## AI2. Re-entry factor

`0.70` remains an engineering parameter. It is not claimed as a universal physiological recovery law.

## AI3. Response envelopes

COUNT ±1, ROUNDS ±1, supported DURATION steps, ORDER_CHANGE and REENTRY have explicit Level B response contracts under their defined measurement conditions. VARIANT, REPLACE, REMOVE, ADD_4TH, FORMAT_CHANGE and structural bundles are explicitly `UNSUPPORTED` for causal-style Level B in V3.0.0 unless a later normative version adds a validated envelope.

## AI4. Bodyweight normalization

V3.0.0 deliberately avoids automatic body-mass-to-workload conversion without validated normalization.

The 5% body-mass threshold is a comparability boundary only. It is not a load multiplier.

## AI5. Wearables

Wearables may improve context quality in the future, but raw device data cannot directly control workload.

## AI6. Exercise Matrix quality

Exercise Intelligence is only as good as the versioned Exercise Matrix. Missing substitution/progression relationships reduce candidate availability.

## AI7. Goal scope

GENERAL, ENDURANCE and CONSISTENCY are the practically supported strategic goal classes in the current architecture. STRENGTH/HYPERTROPHY/POWER remain data-limited until their required measurement model exists.

## AI8. Long-term evidence density

Sparse use of the application may prevent confident adaptation even when the user has extensive outside training history that is not represented in canonical History.

## AI9. External-context semantics

A wearable adapter can establish data quality but does not automatically establish causal physiological meaning.

## AI10. Version compatibility

Old records without required semantic snapshots may be usable only as contextual history rather than strict evidence.

---

# FINAL STATUS

## Version identity

**CINDY Adaptive Coach V3.0.0 NORMATIVE SPECIFICATION — FINALIZED IMPLEMENTATION-READY EDITION**

Specification status: `IMPLEMENTATION-READY`.
Production/runtime status: `NOT VERIFIED`.

## Fundamental changes from V2.8

1. Decision output is now orthogonal: `DecisionMode + SessionPurpose + DecisionStatus + Adaptation`.
2. Evidence authority is explicitly question-scoped.
3. Strict evidence is non-contiguous, while trend evidence requires additional reference coherence.
4. Level B now requires full execution fidelity.
5. Generic cross-workload intervention ratios are removed.
6. Historical semantics are immutable and versioned.
7. `decisionNow` is explicit and CoachCore has no internal clock access.
8. Workout Engine and Coach share a formal Measurement Contract.
9. Release integrity is explicit and fail-closed.
10. Exercise choice is a first-class decision domain.

## Fundamental changes from V2.9.2

1. Overloaded decision/status/session enums are separated.
2. Authority is split into admissibility authority and question-scoped evidence authority.
3. Level B gains a complete proposed → applied → started → executed → fidelity verified gate.
4. `ESTIMATED` planned-volume normalization is removed completely.
5. Comparable-to-current is separated from trend/reference-coherent evidence.
6. Re-entry can never violate the structural minimum.
7. Fallback no longer assumes that invalid current configuration can always be maintained.
8. Historical profile/config/matrix/compatibility snapshots become mandatory.
9. Time becomes an explicit deterministic input.
10. Measurement semantics become a normative contract rather than an implementation assumption.
11. Release manifest incompatibility becomes fail-closed.

## Mechanisms intentionally NOT carried forward

- universal workload score;
- universal readiness/fatigue score;
- demographic multipliers;
- BMI-derived load/recovery multipliers;
- scalar weighted confidence score;
- action-driving EMA ability score;
- generic estimated planned-volume Level B ratio;
- numeric zone weighting as normative decision authority;
- automatic novelty/variety rotation;
- mandatory progression;
- wide multi-lever allowlists;
- raw wearable → workload rules;
- ML as the decision authority;
- responder/non-responder classification;
- pseudo-medical interpretations;
- automatic fifth-exercise growth;
- unsupported cross-format causal claims.

## Final gap status

- Blocking normative problems: **NONE**
- Unsupported mechanisms: explicitly bounded in Section N
- Unresolved behavior: only where required measurement/compatibility evidence is absent, with deterministic fallback
- Production implementation: **NOT VERIFIED**

## Implementation-ready criteria

V3.0.0 is **IMPLEMENTATION-READY as a normative specification** because the complete gate is documented in Section AG2.

Runtime/production conformance remains conditional on actual implementation and execution of the declared acceptance and release checks.

---

# CHANGE CONTROL

Any change to a normative rule requires a new spec version and must record:

```text
WAS
→ PROBLEM
→ NEW RULE
→ BEHAVIOR CHANGE
→ REASON
→ TEST
```

No implementation may silently reinterpret a normative rule.

