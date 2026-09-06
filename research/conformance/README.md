# Exhaustive conformance harness

```
npm run conformance              # the whole fact space, ~3.5 min
npm run conformance -- --sample=200000   # the first N records, seconds
```

Step 1 of the [verification ladder](https://github.com/mark-brannan/colregs-engine/issues/6),
Phase 0 of [the programme](https://github.com/mark-brannan/colregs-engine/issues/1).

The engine is a pure function over a finite fact record, so "does the engine
agree with the data?" is a question you can answer by checking every case
rather than by sampling. This is that check.

## The fact space

`enumerate.ts` reads every `when` an entry can gate on — the entry's own,
each `modality_by[].when`, and any `when` under `rel:conditional_includes` —
and collects the fact keys those predicates read. Facts no predicate reads
are left absent, because the evaluator never looks at them.

What each key is, and which values it takes, comes from `FACT_SPEC` in
`src/generated/fact-record.ts`: generated from the pinned colregs
`facts.json`, and the same table the engine validates every record against
at its door. So the space enumerated here is exactly the vocabulary the
engine accepts, and neither side can drift from the other without the
generator noticing.

Each axis gets representatives:

| kind | representatives |
|---|---|
| enum | every value `FACT_SPEC` declares |
| boolean | `true`, `false` |
| numeric | every constant a predicate compares against, plus one interior point per open interval — `2k+1` for `k` constants |

That gives 5,930,496 records:

| axis | kind | representatives |
|---|---|---|
| `fact:activity` | enum | 13 |
| `fact:composite_unit` | boolean | 2 |
| `fact:gear_extent_m` | numeric | 3 |
| `fact:length_m` | numeric | 11 |
| `fact:making_way` | boolean | 2 |
| `fact:max_speed_kn` | numeric | 3 |
| `fact:near_channel` | boolean | 2 |
| `fact:non_displacement` | boolean | 2 |
| `fact:obstruction_exists` | boolean | 2 |
| `fact:position` | enum | 4 |
| `fact:propulsion` | enum | 3 |
| `fact:tow_length_m` | numeric | 3 |
| `fact:wig` | boolean | 2 |
| `fact:wig_near_surface` | boolean | 2 |

`fact:length_m` has eleven representatives because the entries compare
against five constants — 7, 12, 20, 50 and 100 m; the last is Rule 30(c),
which is easy to forget when counting by hand.

Enumeration is a mixed-radix walk over the axis list, so a record is
addressable by its index and the pass holds one record at a time.

Partitioning at the thresholds is the step that makes this a proof rather
than a large test only if the partition lemma holds — that a predicate
comparing a numeric against a fixed finite constant set is decided by these
representatives. That lemma is ladder step 4 (Rocq), not yet done. Until
then, read this as exhaustive over the partition, not over the reals.

## The reference evaluator

`reference.ts` is a second reading of colregs' "Predicate semantics" section,
written without reference to `src/evaluate.ts` and importing nothing from it.
It implements numeric `gte`/`gt`/`lte`/`lt`, list membership, scalar
equality, `not`, `any_of` at both the constraint and the `when` level, the
rule that an absent fact never satisfies anything (`not` included), the
`activity:ram_underwater` ⊇ `activity:ram` refinement, and `modality_by`
first-match-wins.

Two implementations that agree are worth more than one implementation that
passes its own tests. Where they disagree, the harness fails rather than
picking a winner.

It covers more of the predicate language than `src/evaluate.ts` does: `not`
and both `any_of` forms are implemented here and not there. Neither exists
in the pinned colregs (0.1.2) schema; they arrive in a later release,
together with the two-subject Part B steering entries that use them. So the
agreement over the whole space is real but says nothing about those forms.
When the pin moves, the first entry to use one will be a conformance
failure, which is the behaviour to want from a check like this — and the
Part B entries will need filtering out of the lights evaluation, in the
engine and here alike, before the run is meaningful again.

## The checks

**conformance** — for every record, the engine's applied-entry set equals the
reference's, and every applied entry resolves to the same modality in both.
This is the only check that can fail the build.

**consistency** — (i) two applied entries that both resolve to `shall` where
one `rel:excludes` the other: an obligation the data states twice and
contradicts itself on. (ii) records where nothing applies at all, counted and
broken down by `fact:position`. (iii) an applied entry whose modality resolves
to `conditional` because no `modality_by` branch matched the record — printed
as `unresolved-conditional records`.

**coverage** — entries that never apply anywhere in the space, `modality_by`
branches that are never the first match, and `one_of` options that are
never selectable. All three are currently empty, which is the result you
want: every entry and every branch is reachable.

**traceability** — every entry's `cite` resolves to a paragraph in colregs
`data/rules.json`, including both ends of a range cite like
`23(a)(iii)-(iv)`.

**fixture replay** — colregs' own `applicability-fixtures.json`, replayed
through the reference evaluator rather than the engine. 53/53.

## What this does not check

The conformance verdict is predicate-level: applied entries and their
modalities. It does not compare display composition — `rel:includes`,
`rel:in_lieu_of`, `one_of` resolution — between two implementations, because
there is only one implementation of that layer. So colregs#14 (27(f)/28
carry an unconditional `rel:includes` of the Rule 23 running lights, which
misfires for a vessel at anchor) does **not** appear in any finding below.
It cannot: both entries' `when` clauses are correct, and every check here
operates on predicates. Catching it needs a second composition
implementation, or the fixture colregs#14 asks for.

## The findings register

[`findings/README.md`](findings/) is generated by the run, one row per
distinct finding, grouped by (check, entry set) so that 114,048 records
showing the same conflict are one row and not 114,048. Each row has a
`FIND-nn.json` beside it carrying a representative record as raw facts and
as a sentence of prose, so triage doesn't start with decoding axis keys.

The register is checked in, and CI fails if a run would rewrite it — the
message tells you to run `npm run conformance` and commit the result. Data
findings themselves never fail the build; only a conformance mismatch or a
stale register does.

Status ladder for a finding:

- **candidate** — the harness found it. Nobody has looked.
- **agent-verified** — a second pass confirmed it is real and not an artefact
  of the harness or the reference implementation.
- **human-reviewed** — a person triaged it into data bug, genuine ambiguity
  in the rules, or engine bug.
- **landed** — resolved: a fixture, an ADR, or a change to the requirements.

Agents do not edit colregs. A finding is a candidate for a maintainer to
judge, not a fix to apply.

Every column of the register but two is derived, and the run overwrites them
on every pass. **status** and a free-text **triage note** are the exception:
they live in [`findings/triage.json`](findings/triage.json), a hand-maintained
sidecar keyed by `check::groupKey` rather than `FIND-nn` — the same
derived/hand-maintained split [#15](https://github.com/mark-brannan/colregs-engine/pull/15)
used for `AXIS_FACTS`/`REFINEMENTS`, for the same reason: a run owns what it
can regenerate and nothing else. To climb a finding up the ladder, edit
`triage.json` and rerun `npm run conformance` — hand-editing the register or
a `FIND-nn.json` directly is pointless, the next run overwrites it. On a full
run, a stale ruling (its key no longer matches any finding) prints a warning
instead of being silently dropped; a `--sample` run skips that check, since a
partial pass over the fact space won't reproduce most findings.

## Files

- `enumerate.ts` — threshold extractor and partitioned enumerator.
- `reference.ts` — the independent predicate evaluator.
- `run.ts` — the streaming pass, the checks, and the register writer.
- `traceability.ts` — cite resolution against `rules.json`.
- `prose.ts` — renders a fact record as a vessel description.
- `findings/` — the generated register, plus the hand-maintained
  `triage.json` sidecar.
