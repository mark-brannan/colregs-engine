# ADR 0002 — The trace and Rule 2 departure verbs: kinematic and temporal evaluation

Date: 2026-09-07
Status: draft, full stop. It names the verbs and frames their inputs and
results so the programme has a target to build toward; it does not build
them, and it expects to be broken while the package is 0.x.

## Context

ADR 0001 fixed two verbs, one per input, and put kinematic and temporal
evaluation out of *that* shape because it needs a different input and a
different tool. It did not say what the verbs would be, and the README
talked around the gap. That reads as "never", which is the wrong lesson:
the formal-methods programme (colregs-engine#1, phases 3–5) exists to do
this evaluation, and colregs' ADR 0005 has already fixed most of the input.

What the data settles today:

- The **situation record** carries kinematic state (`kin:`), relative
  geometry (`geo:`) and history (`hist:`) per subject, with every threshold
  a paragraph reads declared once under `situation.constants`.
- `conduct` is a category "monitored over a trace, not evaluated at a
  point"; `kin:rot_deg_min` and `hist:latched_at_s` are declared for a
  conduct monitor and read by no point predicate.
- Rule 2 is a region of situation space, found by a game solver, with a
  closed status alphabet and a fixed output list (ADR 0005 §5, proposal v4
  §4). Invariants come in levels: hard, safe, rule-level. R0/R1/R2 are
  research-ontology labels for that region — colregs' vocabulary, not this
  package's API.

Not settled: the dynamics model and class list (Q-18), the game's
parameters (Q-19, Q-20), offline or runtime (Q-22), the conduct effect
shape, a trace fixture schema. None of that blocks naming the API.

## Decision

### 1. Four inputs, four verbs

| input | verb | result | status |
|---|---|---|---|
| `FactRecord` — one vessel | `evaluateDisplay` | `DisplayEvaluation` | built |
| `Situation` — two vessels, one instant | `evaluateEncounter` | `EncounterEvaluation` | target |
| `Trace` — the situation over time | `evaluateConduct` | `ConductEvaluation` | named here |
| `Situation` under a `Rule2DepartureModel` | `evaluateRule2Departure` | `Rule2DepartureFinding` | named here |

The two new verbs live **in this package**, superseding ADR 0001's pencilled
"separate package". The grounds are the constraints the README already
states: a function of a trace is still pure and total, a query against a
precomputed grid is still pure and total, and the same validator, the same
`opts.data` and the same `colregs.version` provenance apply. What is *not*
pure — the solver that builds the grid, the model checker that hunts for
counterexample traces — stays in `research/` until it earns a repository.
The verbs are the programme's runtime face; the tools are its workshop.

### 2. `Trace` — the input `conduct` reads

```ts
interface TraceSample { t_s: number; situation: Situation; }
/** Strictly increasing `t_s`; the same two vessels throughout. */
type Trace = TraceSample[];
```

`t_s` is seconds on the caller's clock; the engine reads differences only.
A trace is a window, not a session: the caller (searoom's switching plugin,
the simulator, a fixture) decides how much history to hand over, and the
result says what window it saw. Nothing is kept between calls.

`hist:was_overtaking` is a present-tense snapshot fact the caller supplies
and clears, not history the engine derives: it answers "are you now in a
state where you were previously overtaking", set on the caller's side by
13(b)'s sector having held at an earlier sample, because "finally past and
clear" is a seamanship judgement colregs declines to threshold (Q-47). A
windowed trace cannot see a latch set before the window, so the engine has
no business computing it — ADR 0001 §5's "time is the caller's" stays true.

### 3. `ConductEvaluation` — verdicts over the window

```ts
interface ConductEvaluation {
  colregs: { version: string; source: 'resolved' | 'caller' };
  window: { from_s: number; to_s: number; samples: number };
  applied: string[];
  verdicts: ConductVerdict[];
  phases: PhaseChange[];
}
interface ConductVerdict {
  id: string; subject: 'own' | 'other';
  verdict: 'kept' | 'breached' | 'pending' | 'not-in-force';
  attached_at_s?: number; decided_at_s?: number;
  robustness?: { value: number; unit: string };
}
interface PhaseChange { subject: 'own' | 'other'; phase: string; at_s: number; }
```

- A **verdict** is per conduct entry per subject. `kept`/`breached` are
  decided; `pending` means the window ended before the duty could be judged
  (17(a)(ii)'s "as soon as it becomes apparent" hasn't run out); `not-in-force`
  means the entry never applied. `attached_at_s` is when the entry attached
  the role judged; `decided_at_s` is when a breach began or a duty was met.
  `robustness` is the STL margin the monitor computes, value and unit, so a
  near miss and a wide pass do not look alike.
- A **phase** is the Rule 13(d)/17 protocol state: the latch, the stand-on
  vessel passing from 17(a)(i) to 17(a)(ii) to 17(b). `phase` is the id of
  the paragraph that put a vessel there — the same state machine phase 4's
  TLA+ or UPPAAL model checks; the monitor is its refinement.
- `applied` and the companion `appliedConductEntries(trace)` keep the
  fixture contract, as the point fixtures do; per-sample encounter
  evaluations are not returned — call `evaluateEncounter` on a sample.

Vague quantities a conduct paragraph reads — "readily apparent" (8(b)),
"ample time" (16), "as soon as it becomes apparent" (17(a)(ii)) — are
declared once in colregs' `situation.constants`, as
`appreciable_bearing_change_deg_min` is in `facts.json` at 0.2.0. A number
the Rules read belongs in colregs; one only the model reads belongs in it.

### 4. `Rule2DepartureModel` and `Rule2DepartureFinding` — the Rule 2 departure finding

```ts
interface Rule2DepartureModel {
  version: string; dynamics: string[]; horizon_s: number; cadence_s: number;
  separation_m: number; information: 'full' | 'partial';
  adversary: 'compliant' | 'physics'; grid: unknown;
}
interface Rule2DepartureFinding {
  status: 'not-flagged' | 'model-rule-conflict'
        | 'no-robust-policy-in-model' | 'inconclusive-in-model';
  banner?: { cite: string };
  obligations: EncounterEvaluation;
  advisories: Advisory[];
  model: { version: string; assumptions_violated: string[] };
}
interface Advisory { action: unknown; margin_m: number; breaches: string[]; envelope: unknown; }
```

The model is passed like `opts.data` is: a versioned artefact the solver
produced offline, checked in, named in every result. The shape follows
proposal v4 §4 exactly and adds nothing: status from the closed alphabet,
carrying the R0/R1/R2 region one-to-one so the field isn't repeated; the
rule-derived obligations unchanged so the reader sees what the Rules said;
advisories in R1 ranked best margin first, each with the paragraphs it
breaks; an empty list in R2; the assumptions violated, named. `not-flagged`
means not flagged by this model, never "the rules suffice". A `breaches`
entry citing a shall-if-practicable paragraph is a model verdict, not the
Rules': the compliance predicate's own rule for those paragraphs (and for
17(a)(ii)'s `may`) is open, carded.

The guard rail is a property of the signature: no input names a departure or
asserts one. A caller corrects *facts* and the outputs change; no input
moves an obligation or advisory by asserting danger. Disclaimers live in
the README and the licence, not in outputs.

### 5. How each layer is checked

| layer | verb | what discharges it |
|---|---|---|
| point | `evaluateDisplay`, `evaluateEncounter` | exhaustive enumeration; Z3; Alloy for the sectors |
| trace | `evaluateConduct` | STL monitors *are* the verdict function; TLA+/UPPAAL for the 13(d)/17 phase machine |
| Rule 2 departure | `evaluateRule2Departure` | the game solver, offline; the grid checked in with its parameters |

The tools do not move into `src/`. What moves is their *output*: a
counterexample trace becomes a fixture; a certified grid, a `Rule2DepartureModel`.

## Consequences

- README's roadmap paragraph names all four verbs and their status; ADR
  0001 §5's `conduct` and Rule 2 bullets and register row point here.
- Order of work, each step shipping something a consumer can call:
  1. colregs: a trace fixture schema and the first `conduct` entries (16,
     17, 8(b)) with an effect shape, as `situation-fixtures.json` did for
     encounters.
  2. `Trace`, `appliedConductEntries` against those fixtures — phase 3
     starts here.
  3. `evaluateConduct` with verdicts and phases; the constants above.
  4. `evaluateRule2Departure` once a grid exists. Until then the name is
     reserved, nothing exported: a stub always answering
     `inconclusive-in-model` is a stub wearing a status.

## Register

| item | level | what would settle it |
|---|---|---|
| Two more verbs, one per input, in this package | ✎ | Mark's confirmation; supersedes ADR 0001's "separate package" row |
| `Trace` as `TraceSample[]`, `t_s` on the caller's clock | ✎ | the first trace fixture |
| `hist:was_overtaking` a caller-supplied snapshot fact, never engine-derived | ✎ | Q-47; the first conduct monitor |
| `ConductVerdict` alphabet `kept`/`breached`/`pending`/`not-in-force` | ✎ | the first STL monitor being written |
| Phase values are paragraph ids | ✎ | the phase-4 TLA+ or UPPAAL model |
| Vague-quantity constants live in colregs, model parameters in `Rule2DepartureModel` | ✎ | the first constant a conduct entry reads |
| `Rule2DepartureFinding` field set, status alphabet | ✎ | proposal v4 §4's sensitivity matrix; Q-19, Q-20 |
| No input names a departure or asserts one, no disclaimer in outputs | ✎ | — |
| Nothing exported until a fixture backs it | ✎ | — |
