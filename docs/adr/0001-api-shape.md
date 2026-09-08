# ADR 0001 — The public API: one verb per input

Date: 2026-09-07
Status: accepted. Ink and pencil are marked per item in the register at the
end, under colregs' `docs/conventions.md`.

## Context

The engine shipped one entry point, `evaluateDisplay`, and its README promised
that colregs' `classification` and `precedence` categories would "get their
own entry points". That promise was made in passing while renaming, with no
target for the next PR to build to. Meanwhile colregs' ADR 0005 (pencil, all
of it) fixed the *input* those categories read — a situation record, declared
in `data/facts.json` §`situation` and exercised by
`fixtures/situation-fixtures.json` — and some twenty two-subject entries have
been written against it. The data side exists; the engine side has no shape.

This ADR fixes the shape. It does not build it.

## Decision

### 1. Two inputs, two verbs

| input | verb | result | status |
|---|---|---|---|
| `FactRecord` — one vessel | `evaluateDisplay` | `DisplayEvaluation` | built |
| `Situation` — two vessels and the encounter | `evaluateEncounter` | `EncounterEvaluation` | target |

A verb is named for the thing it evaluates, in colregs' own vocabulary: a
*display* is what one vessel shows, an *encounter* is what colregs calls the
`pair` subject. The proposed pair `classifyEncounter` / `resolvePrecedence`
is **not** built, for three reasons that are about the data, not taste:

- **One predicate pass.** Every `scope`, `classification` and `precedence`
  entry matches against the same situation by the same walker. colregs' own
  reference evaluator does it in one pass; two verbs would run it twice or
  make the caller carry the encounter type from one call into the next.
- **Relations cross categories.** Rule 18's precedence entries override Rule
  15's; entry `13a` overrides every Rule 18 entry. `rel:overrides` can only be
  resolved with both sides applied in the same result.
- **Q-35 is open.** Whether a norm may read another norm's *effect* (8(f)(iii)
  reads "a vessel whose passage is not to be impeded") is a data question
  colregs has not settled. An API seam between classification and precedence
  would settle it by accident, in the wrong repository.

Each verb has a companion that returns only the matched entry ids —
`appliedDisplayEntries` today, `appliedEncounterEntries` to come — because
that is the fixture contract: both fixture files `expect` entry ids.

### 2. `FactRecord` keeps its name

It is colregs' name for the per-vessel record (`own.fact` is "exactly the
record above, key for key"). ADR 0005 §2 has the situation wrap two fact
records; the fact record itself does not widen, and a display consumer never
sees a situation. A name that hinted at two vessels would describe the wrapper,
not the thing.

### 3. The `Situation` type mirrors the fixture, not the predicate

colregs states the situation twice: nested by subject and class in
`facts.json` §`situation.record` and in every fixture case, and flat as
`own:fact:activity` inside predicates. The engine's public type is the
**nested** form. The flat form is the predicate namespace and stays internal
to the walker.

```ts
interface Situation {
  own: Subject;
  other?: Subject;
  pair?: Pair;
}
interface Subject { fact: FactRecord; kin?: Kinematics; geo?: DirectionalGeometry; hist?: History; }
interface Pair    { geo?: PairGeometry; env?: Environment; }
```

- `own` is required; `other`/`Subject.fact` follow colregs' own fixture schema
  (`situation-fixtures.schema.json`, `0.2.0`) — `other` optional (Rule 19's
  single-vessel scope needs no synthesized one), `fact` required. Every other
  class, and every key inside a class, is optional — absent is absent.
- Keys keep their full colregs identifier (`'kin:heading_deg'`, not
  `heading_deg`), as `FactRecord` keeps `'fact:length_m'`. A fixture's
  `situation` object is then assignable to `Situation` unedited.
- `Kinematics`, `History`, the two geometries and `Environment` are
  **generated** from `facts.json` §`situation`, by the generator that already
  produces `FactRecord`, and checked at runtime by the validator that already
  rejects an unknown fact key with a "did you mean" hint. A situation that
  arrives as JSON is rejected on the same terms as a fact record.
- `FactRecord` is reused, not copied, as `Subject.fact`.

### 4. `EncounterEvaluation`, the target result

```ts
interface EncounterEvaluation {
  colregs: { version: string; source: 'resolved' | 'caller' };
  applied: string[];
  scope: string[];
  encounter?: 'head-on' | 'crossing' | 'overtaking' | 'none';
  riskOfCollision: { asserted: boolean; by: string[] };
  roles: { own: SubjectRole[]; other: SubjectRole[] };
  overridden: { id: string; by: string }[];
  modalities: Record<string, Modality>;
}
interface SubjectRole { role: Role; by: string; }
```

`colregs` and `applied` mean what they mean on `DisplayEvaluation`. Roles are
a *set* per subject, each citing the entry that assigned it: colregs' own
suite pins a sailing vessel meeting a CBD vessel as holding `stand-on` and
`shall-not-impede` at once (Q-36), and a result type that could hold one role
would have to lie. `riskOfCollision` carries its grounds because 7(a) lets an
entry add a ground and never deny one. `encounter` is absent when no
classification entry fired, which today conflates "no encounter" with "cannot
say" (Q-43); the status alphabet of ADR 0005 §5 is the intended fix and is not
part of this shape yet.

### 5. What this shape does not evaluate

Scoped to `evaluateDisplay`/`evaluateEncounter` as defined here, not a ceiling
on the package — `conduct` (kinematic/temporal evaluation over a trace) is
out of *this* shape because it needs a different input and tool, not because
it's excluded.

- **`conduct`.** Rules 8, 13(a)'s action, 14(a), 16, 17: what a vessel shall
  *do*. Their predicates read a trace — 8(b)'s "readily apparent" alteration,
  17(a)(ii)'s "as soon as it becomes apparent" — and colregs declares
  `kin:rot_deg_min` as read "by a conduct monitor rather than by a predicate at
  a point". Monitoring is a different function with a different input (a
  sequence of situations) and a different formal tool (STL/TLA+ per the
  programme). It is anticipated future work, not a third verb on this API.
- **`care` and `meta`.** Rules 2(a) and 2(b) are in colregs'
  `represented_paragraphs` registry precisely so nothing computes them.
- **The Rule 2 region solver** (R0/R1/R2) and the status alphabet's semantics.
  Research under `research/` until it earns a repository.
- **Time.** Freshness, hysteresis and the 13(d) latch's clock are the caller's
  (searoom's switching plugin). The engine receives `hist:*` as facts; it does
  not maintain them.
- **Choosing.** No verb picks a display or a role; every lawful answer is
  returned (REQ-MODEL-8).

In scope and expected of `evaluateEncounter`: derived facts (`fact:rule18_class`
is computed before matching, as colregs specifies), `rel:overrides`
resolution, and validation of the situation record.

## Consequences

- The README paragraph promising separate classification and precedence
  entry points is replaced by a pointer here.
- The next PR builds `Situation` generation and validation; the one after
  builds `appliedEncounterEntries` against `situation-fixtures.json`; only then
  `evaluateEncounter`. Composition decisions the data leaves open go in
  `docs/engine-notes.md` as the display ones did.
- `colregs-engine/schema` stays the home of mirrored colregs shapes;
  `Situation` and `EncounterEvaluation` are engine vocabulary and export from
  the root, beside `FactRecord` and `DisplayEvaluation`.

## Register

| item | level | what would settle it |
|---|---|---|
| Two verbs, one per input; no `classifyEncounter` / `resolvePrecedence` | ink | — |
| `evaluateDisplay`, `appliedDisplayEntries`, `DisplayEvaluation`, `opts.data`, `colregs.source` | ink | — |
| `FactRecord` keeps its name | ink | — |
| `Situation` nested by subject and class, generated from `facts.json` | ink | — |
| Verb name `evaluateEncounter`; result name `EncounterEvaluation` | ✎ | colregs renaming the `pair` subject or the `encounter` effect |
| `own` required, `other`/`Subject.fact` per colregs 0.2.0's fixture schema | ✎ | revised 2026-09-07 from "own/other both required"; Mark to confirm before ink |
| `appliedEncounterEntries` as the fixture-replay companion | ✎ | the situation-fixture replay being written |
| `EncounterEvaluation` field set (§4) | ✎ | building it; Q-35, Q-36, Q-43 in colregs |
| `encounter` absent vs the ADR 0005 §5 status alphabet | ✎ | Q-43 |
| `conduct` is a separate package, not a third verb | ✎ | the first conduct monitor being written |
| Geometry-consistency validation (REQ-VERIFY-8) in the engine's validator | ? | deciding whether it is data-suite-only |
