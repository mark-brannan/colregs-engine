# ADR 0002 — The trace and region verbs: kinematic and temporal evaluation

Date: 2026-09-07
Status: accepted as a straw man, **all of it in pencil**. It names the
verbs and frames their inputs and results so the programme has a target to
build toward; it does not build them, and it expects to be broken while the
package is 0.x. Ink and pencil per item in the register at the end.

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
- Rule 2 is a **region** of situation space, found by a game solver, with a
  closed status alphabet and a fixed output list (ADR 0005 §5, proposal v4
  §4). Invariants come in levels: hard, safe, rule-level.

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
| `Situation` under a `RegionModel` | `evaluateRegion` | `RegionEvaluation` | named here |

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
interface Sample { t_s: number; situation: Situation; }
/** Strictly increasing `t_s`; the same two vessels throughout. */
type Trace = Sample[];
```

`t_s` is seconds on the caller's clock; the engine reads differences only.
A trace is a window, not a session: the caller (searoom's switching plugin,
the simulator, a fixture) decides how much history to hand over, and the
result says what window it saw. Nothing is kept between calls.

`deriveHistory(trace): { own: History; other: History }` is the one helper
the trace earns. 13(b)'s sector having held at an earlier sample *sets*
`hist:was_overtaking`; nothing here clears it, because "finally past and
clear" is a seamanship judgement colregs declines to threshold (Q-47). The
engine still does not maintain history; it computes it from a trace the
caller holds, which keeps ADR 0001 §5's "time is the caller's" true.

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
  verdict: 'kept' | 'breached' | 'open' | 'not-in-force';
  at_s?: number; margin?: number; by: string;
}
interface PhaseChange { subject: 'own' | 'other'; phase: string; at_s: number; by: string; }
```

- A **verdict** is per conduct entry per subject. `kept` and `breached` are
  decided; `open` means the window ended before the duty could be judged
  (17(a)(ii)'s "as soon as it becomes apparent" has not yet run out);
  `not-in-force` means the entry never applied. `at_s` is the instant a
  breach began or a duty attached. `margin` is the signal-temporal-logic
  robustness where the monitor computes one, in the entry's own unit, so a
  near miss and a wide pass do not look alike.
- A **phase** is the Rule 13(d)/17 protocol state: the latch setting, the
  stand-on vessel passing from 17(a)(i) to 17(a)(ii) to 17(b). Phase values
  are the ids of the paragraphs that put a vessel there, not a new
  vocabulary. The phase machine is the same state machine phase 4's TLA+ or
  UPPAAL model checks; the monitor is its refinement.
- `applied` and the companion `appliedConductEntries(trace)` keep the
  fixture contract: a trace fixture will `expect` entry ids, as the point
  fixtures do. The per-sample encounter evaluations are not returned; call
  `evaluateEncounter` on a sample.

Vague quantities a conduct paragraph reads — "readily apparent" (8(b)),
"ample time" (16), "as soon as it becomes apparent" (17(a)(ii)) — are
declared once in colregs' `situation.constants` in pencil, as
`appreciable_bearing_change_deg_min` already is. A number the Rules read
belongs in colregs; a number only the model reads belongs in the model.

### 4. `RegionModel` and `RegionEvaluation` — the Rule 2 query

```ts
interface RegionModel {
  version: string; dynamics: string[]; horizon_s: number; cadence_s: number;
  separation_m: number; information: 'full' | 'partial';
  adversary: 'compliant' | 'physics'; grid: unknown;
}
interface RegionEvaluation {
  status: 'not-flagged' | 'model-rule-conflict'
        | 'no-robust-policy-in-model' | 'inconclusive-in-model';
  region?: 'R0' | 'R1' | 'R2';
  banner?: { cite: string };
  obligations: EncounterEvaluation;
  advisories: Advisory[];
  model: { version: string; violated: string[] };
}
interface Advisory { action: unknown; margin_m: number; breaches: string[]; envelope: unknown; }
```

The model is passed like `opts.data` is: a versioned artefact the solver
produced offline, checked in, and named in every result. The shape follows
proposal v4 §4 exactly and adds nothing: status from the closed alphabet;
the rule-derived obligations unchanged so the reader sees what the Rules
said; advisories in R1 ranked best margin first, each with the paragraphs
it breaks; an empty list in R2 that says so; and the assumptions the
situation violates, named. `not-flagged` means not flagged by this model,
never "the rules suffice".

The guard rail is a property of the signature: there is no danger input.
A caller corrects *facts* in the situation and the outputs change; no
input asserts danger and thereby moves an obligation or an advisory. An
advisory is information a reader may act on; it carries no disclaimer,
because disclaimers live in the README and the licence, not in outputs.

### 5. How each layer is checked

| layer | verb | what discharges it |
|---|---|---|
| point | `evaluateDisplay`, `evaluateEncounter` | exhaustive enumeration; Z3; Alloy for the sectors |
| trace | `evaluateConduct` | STL monitors *are* the verdict function; TLA+/UPPAAL for the 13(d)/17 phase machine |
| region | `evaluateRegion` | the game solver, offline; the grid checked in with its parameters |

The tools do not move into `src/`. What moves is their *output*: a
counterexample trace becomes a trace fixture; a certified grid becomes a
`RegionModel`.

## Consequences

- README's roadmap paragraph names all four verbs and their status; ADR
  0001 §5's `conduct` bullet and register row point here.
- Order of work, each step shipping something a consumer can call:
  1. colregs: a trace fixture schema and the first `conduct` entries (16,
     17, 8(b)) with an effect shape — the data step that precedes any
     engine step, as `situation-fixtures.json` did for encounters.
  2. `Trace`, `deriveHistory`, `appliedConductEntries` against those
     fixtures. Phase 3 of the programme starts here.
  3. `evaluateConduct` with verdicts and phases; the constants above.
  4. `evaluateRegion` once a grid exists. Until then the name is reserved
     and nothing is exported: a verb that always answers
     `inconclusive-in-model` would be a stub wearing a status.

## Register

| item | level | what would settle it |
|---|---|---|
| Two more verbs, one per input, in this package | ✎ | Mark's confirmation; supersedes ADR 0001's "separate package" row |
| `Trace` as `Sample[]`, `t_s` on the caller's clock | ✎ | the first trace fixture |
| `deriveHistory` sets the latch and never clears it | ✎ | Q-47; the first conduct monitor |
| `ConductVerdict` alphabet `kept`/`breached`/`open`/`not-in-force` | ✎ | the first STL monitor being written |
| Phase values are paragraph ids | ✎ | the phase-4 TLA+ or UPPAAL model |
| Vague-quantity constants live in colregs, model parameters in `RegionModel` | ✎ | the first constant a conduct entry reads |
| `RegionEvaluation` field set, status alphabet | ✎ | proposal v4 §4's sensitivity matrix; Q-19, Q-20 |
| No danger input, no disclaimer in outputs | ink | — |
| Nothing exported until a fixture backs it | ink | — |
