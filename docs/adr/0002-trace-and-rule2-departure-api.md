# ADR 0002 — The trace and Rule 2 departure verbs: kinematic and temporal evaluation

Date: 2026-09-07
Status: draft, full stop. It names the verbs and frames their inputs and
results so the programme has a target to build toward; it does not build
them, and it expects to be broken while the package is 0.x.

## Context

ADR 0001 fixed two verbs, one per input, and put kinematic and temporal
evaluation out of *that* shape: a different input and a different tool. It did
not say what the verbs would be, which reads as "never" — the wrong lesson,
since the formal-methods programme (colregs-engine#1, phases 3–5) exists to do
this evaluation and colregs' ADR 0005 has fixed most of the input.

What the data settles today:

- The **situation record** carries `kin:`, `geo:` and `hist:` per subject,
  every threshold a paragraph reads declared once under `situation.constants`.
- `conduct` is "monitored over a trace, not evaluated at a point";
  `kin:rot_deg_min` and `hist:latched_at_s` are read by no point predicate.
- Rule 2 is a region of situation space a game solver finds, with a closed
  status alphabet and a fixed output list (ADR 0005 §5, proposal v4 §4).
  R0/R1/R2 are research-ontology labels — colregs' vocabulary, not this API.

Not settled: the dynamics model (Q-18), the game's parameters (Q-19, Q-20),
offline or runtime (Q-22), the conduct effect shape, a trace fixture schema.

## Decision

### 1. Four inputs, four verbs

| input | verb | result | status |
|---|---|---|---|
| `FactRecord` — one vessel | `evaluateDisplay` | `DisplayEvaluation` | built |
| `Situation` — two vessels, one instant | `evaluateEncounter` | `EncounterEvaluation` | target |
| `Trace` — the situation over time | `evaluateConduct` | `ConductEvaluation` | named here |
| `Situation` under a `Rule2DepartureModel` | `evaluateRule2Departure` | `Rule2DepartureFinding` | named here |

The two new verbs live **in this package**, superseding ADR 0001's pencilled
"separate package": a function of a trace and a lookup in a precomputed grid are
both pure and total, under the same validator, `opts.data` and `colregs.version`
provenance. What is *not* pure — the solver, the model checker — stays in
`research/`.

### 2. `Trace` — the input `conduct` reads

```ts
interface TraceSample { t_s: number; situation: Situation; }
/** Non-empty, strictly increasing `t_s`, the same two vessels throughout. */
interface Trace { samples: TraceSample[]; }
```

`Trace` is runtime-verification vocabulary — the object an STL monitor reads, a
checker's counterexample — not the Rules'. `t_s` is seconds on the caller's
clock; the engine reads differences only. A trace is a window, not a session:
the caller (searoom, the simulator, a fixture) decides how much history to hand
over, and the result says what window it saw. An object, so a field can be added
without breaking a caller. The validator that rejects an unknown fact key
rejects what it can see — an empty trace, non-increasing `t_s`, `other` in some
samples and not others. It cannot see identity (a `Situation` names no vessel):
the pair staying the same is the caller's, like the latch; purity is over
well-formed input.

`hist:was_overtaking` is a snapshot fact the caller supplies and clears, not
history the engine derives: set when 13(b)'s sector held at an earlier sample,
because "finally past and clear" is a judgement colregs declines to threshold
(Q-47). A windowed trace cannot see a latch set before it; time is the caller's.

### 3. `ConductEvaluation` — verdicts over the window

```ts
interface ConductEvaluation {
  colregs: { version: string; source: 'resolved' | 'caller' };
  window: { from_s: number; to_s: number; samples: number };
  applied: EntryId[];
  verdicts: ConductVerdict[];
  phases: ConductPhaseChange[];
}
interface ConductVerdict {
  id: EntryId; subject: 'own' | 'other';
  verdict: 'kept' | 'breached' | 'pending';
  attached_at_s?: number; decided_at_s?: number;
  robustness?: { value: number; unit: string };
}
interface ConductPhaseChange { subject: 'own' | 'other'; phase: ParagraphCite; at_s: number; }
```

- One **verdict** per applied conduct entry per subject it attached to; an
  entry that never attached is absent, as it is from `applied`.
  `kept`/`breached` are decided; `pending` means the window ended before the
  duty could be judged (17(a)(ii)'s "as soon as it becomes apparent" hasn't
  run out). `attached_at_s` is when the entry attached the role judged;
  `decided_at_s` when a breach began or a duty was met. `robustness`, like
  `Trace`, is runtime-verification vocabulary: the STL margin the monitor
  computes, value and unit, so a near miss and a wide pass do not look alike.
- A **phase** is the Rule 13(d)/17 protocol state: the latch, the stand-on
  vessel passing from 17(a)(i) to 17(a)(ii) to 17(b). `phase` is a
  `ParagraphCite`, never an `EntryId` — ADR 0001 §4's aliases, used throughout
  here, and several phases have no entry — naming the state machine
  programme phase 4's TLA+ or UPPAAL model checks; the monitor refines it.
- `applied` and the companion `appliedConductEntries(trace)` keep the fixture
  contract; per-sample encounter evaluations are not returned — call `evaluateEncounter`.

Vague quantities a conduct paragraph reads — "readily apparent" (8(b)), "ample
time" (16), "as soon as it becomes apparent" (17(a)(ii)) — are declared once in
colregs' `situation.constants`, as `appreciable_bearing_change_deg_min` is in
`facts.json` at 0.2.0. A number a paragraph reads belongs in colregs; one only
the solver reads, inside the grid.

### 4. `Rule2DepartureModel` and `Rule2DepartureFinding` — the Rule 2 departure finding

```ts
interface SolverParameters {
  dynamics: string[]; horizon_s: number; cadence_s: number; separation_m: number;
  information: 'full' | 'partial'; adversary: 'compliant' | 'physics';
}
interface Rule2DepartureModel extends SolverParameters {
  version: string; colregs_version: string;
}
interface Rule2DepartureFinding {
  status: 'not-flagged' | 'model-rule-conflict'
        | 'no-robust-policy-in-model' | 'inconclusive-in-model';
  rules: EncounterEvaluation; advisories: Rule2DepartureAdvisory[];
  model: { version: string; colregs_version: string; parameters: SolverParameters;
           assumptions_violated: string[] };
}
interface Rule2DepartureAdvisory {
  action: { alter_deg?: number; sog_kn?: number }; margin_m: number;
  breaches: ParagraphCite[]; envelope: { holds_until_s: number };
}
```

The model is required and positional, not an `opts` field: `opts.data` defaults
to the colregs release this package resolves and a grid has no default. Any
field beyond `version`, `colregs_version` and the parameters is the artefact's
own, not API. `SolverParameters` are the axes the sensitivity matrix will vary
(Q-17 to Q-22): the field set is a claim about what that matrix is. `version`
names one grid, immutably; `colregs_version` the release it was solved against,
carried beside `rules.colregs.version` (a mismatch is reported, not refused);
the finding echoes the parameters, so a consumer can say under which ones it
holds. `action` and `envelope` take the shapes the worked scenarios used.
Otherwise the shape follows proposal v4 §4. `not-flagged`, `model-rule-conflict`
and `no-robust-policy-in-model` name R0, R1 and R2, `inconclusive-in-model`
none, so a `region` field could only repeat the status or invent one. The
rule-derived obligations sit in `rules` unchanged, so the reader sees what the
Rules said; R1's advisories are ranked best margin first, each with the
paragraphs it breaks; R2's list is empty; `assumptions_violated` is display
text, never matched on. `not-flagged` means not flagged by this model, never
"the rules suffice". `breaches` carries `ParagraphCite`s (`17(c)`), as
`phase` does, never entry ids: a `breaches` entry against a shall-if-practicable
paragraph is the model's verdict and not the Rules' — the compliance predicate's
rule for those, and for 17(a)(ii)'s `may`, is open and carded.

The guard rail is narrower than "no danger input": the grid asserts departures,
and a caller who swaps it changes every finding. What the signature buys is that
no *situation* input names a departure — correcting facts moves the outputs;
asserting danger is not an input — and that `model.version` rides on every
finding, so a claim is attributable to a named grid, never to the Rules.
Disclaimers live in the README and licence, not here.

### 5. How each layer is checked

| layer | verb | what discharges it |
|---|---|---|
| point | `evaluateDisplay`, `evaluateEncounter` | exhaustive enumeration; Z3; Alloy for the sectors |
| trace | `evaluateConduct` | STL monitors *are* the verdict function; TLA+/UPPAAL for the 13(d)/17 phase machine |
| Rule 2 departure | `evaluateRule2Departure` | the game solver, offline; the artefact checked in, its parameters on the model |

The tools do not move into `src/`. What moves is their *output*: a counterexample
trace becomes a fixture; a certified grid, a `Rule2DepartureModel`.

## Consequences

- README's roadmap paragraph names all four verbs and their status; ADR 0001
  §5's `conduct` and Rule 2 bullets and its register row point here.
- Order of work, each step shipping something a consumer can call:
  1. colregs: a trace fixture schema and the first `conduct` entries (16,
     17, 8(b)) with an effect shape, as `situation-fixtures.json` did.
  2. `Trace`, `appliedConductEntries` against those fixtures — phase 3
     starts here.
  3. `evaluateConduct` with verdicts and phases; the constants above.
  4. `evaluateRule2Departure` once a grid exists. Until then the name is
     reserved and nothing exported: a stub answering `inconclusive-in-model`
     is a stub wearing a status.

## Register

| item | level | what would settle it |
|---|---|---|
| Two more verbs, one per input, in this package | ✎ | Mark's confirmation; supersedes ADR 0001's "separate package" row |
| `Trace` an object over `TraceSample[]`, `t_s` on the caller's clock, pair identity the caller's | ✎ | the first trace fixture |
| `hist:was_overtaking` a caller-supplied snapshot fact, never engine-derived | ✎ | Q-47; the first conduct monitor |
| `ConductVerdict` alphabet `kept`/`breached`/`pending`; absent is absent | ✎ | the first STL monitor being written |
| Field names snake_case with unit suffixes; `EntryId`/`ParagraphCite` per ADR 0001 §4 | ✎ | that ADR's row; the compiler enforces neither |
| `ConductPhaseChange.phase` values are paragraph cites, not entry ids | ✎ | the programme phase-4 TLA+ or UPPAAL model |
| Vague-quantity constants live in colregs; `SolverParameters` on the model and echoed on the finding, `colregs_version` naming the release solved against; nothing else on the model is API | ✎ | the first constant a conduct entry reads; Q-19's sensitivity matrix |
| `Rule2DepartureFinding` field set — `rules`, `Rule2DepartureAdvisory[]`, no banner cite (it is a function of `status`); the status alphabet is colregs' (ADR 0005 §5), not this package's to rename | ✎ | proposal v4 §4's sensitivity matrix; Q-19, Q-20 |
| No *situation* input names a departure; the grid does, and is named in every finding | ✎ | — |
| Nothing exported until a fixture backs it; exports then carry TSDoc's `@beta` release tag | ✎ | — |
