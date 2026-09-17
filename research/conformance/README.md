# Exhaustive conformance harness

```
npm run conformance              # both spaces, ~5 min
npm run conformance -- --part-b  # the situation space only, ~2 min
npm run conformance -- --sample=200000   # the first N of each, seconds
```

Step 1 of the [verification ladder](https://github.com/mark-brannan/colregs-engine/issues/6),
Phase 0 of [the programme](https://github.com/mark-brannan/colregs-engine/issues/1).
The engine is a pure function over a finite record, so "does the engine agree
with the data?" is a question you can answer by checking every case rather
than by sampling. This is that check, in two phases: the one-subject fact
space the lights entries read, then the two-subject situation space Part B's
steering entries read.

## The fact space

`enumerate.ts` reads every `when` an entry can gate on — the entry's own,
each `modality_by[].when`, and any `when` under `rel:conditional_includes` —
and collects the fact keys those predicates read. Facts no predicate reads
are left absent, because the evaluator never looks at them.

What each key is, and which values it takes, comes from `FACT_SPEC` in
`src/generated/fact-record.ts`: generated from the pinned colregs
`facts.json`, and the same table the engine validates every record against
at its door, so neither side can drift without the generator noticing.
Each axis gets representatives:

| kind | representatives |
|---|---|
| enum | every value `FACT_SPEC` declares |
| boolean | `true`, `false` |
| numeric | every constant a predicate compares against, plus one interior point per open interval — `2k+1` for `k` constants |

Fourteen axes, all printed by the run: `fact:activity` with 13 values,
`fact:length_m` with 11 for five constants (7, 12, 20, 50 and 100 m, the
last Rule 30(c) and easy to forget by hand), `fact:position` with 4,
`fact:propulsion` and three numerics with 3, seven booleans with 2. Their
product bounds the space at 5,930,496 records.

`fact:making_way` is declared a modifier that `refines`
`fact:position=position:underway`, so a record carries it only there and
leaves it absent (never `false`) elsewhere, which rules out incoherent
records like `position:moored` + `making_way: true`. That brings the actual
count to 3,706,560; the bound above is what `totalRecords()` reports.
Enumeration is a mixed-radix walk over the axis list, so a record is
addressable by its index and the pass holds one record at a time.

Partitioning at the thresholds is what makes this a proof rather than a
large test, and it rests on the partition lemma: a predicate comparing a
numeric against a fixed finite constant set is decided by these
representatives. That lemma is ladder step 4, proved in
[`research/rocq/`](../rocq/), so each numeric axis is exhaustive over the
reals for a predicate read as the lemma's `formula` reads it; that
`evaluate.ts` reads a `when` the same way is step 5, not yet done.

## The situation space

`situation-enumerate.ts` is the same idea over the two-subject entries — the
21 `precedence`, 5 `classification` and 3 `scope` entries no display record
can reach. It reads the `<subject>:<class>:<key>` axes their `when` clauses
name, takes each axis's values from the generated `situation.ts` and
`fact-record.ts` specs, and gives a numeric axis `numericRepresentatives`,
the same function the fact space uses.

Two things keep the product walkable, both coarsenings of that partition
rather than widenings of it. Representatives satisfying the same set of the
constraints written over their axis are interchangeable in every predicate,
so one of each signature is kept: `fact:position` enumerates
`position:underway` and one value standing for the other three, because
`underway` is the only value any entry names. And an axis is enumerated only
where some entry still able to match reads it — once self ranks
`rule18_class:nuc` no entry reads the other vessel's rank, so that subtree
is one record rather than six.

That leaves 23 axes: `other:fact:rule18_class` with 6 representatives,
`self:fact:rule18_class` and `self:geo:rel_bearing_deg` with 5, both
`fact:propulsion` axes, both `kin:wind_side` axes and
`other:geo:rel_bearing_deg` with 3, the remaining fifteen with 2. Their
product is a bound of 1,194,393,600; **925,770 records** are enumerated, in
about 100 s.

`fact:rule18_class` is derived, not supplied, so a rank is realised through
facts.json's own decode table: the row defining the rank, made concrete,
then checked by re-decoding the record it built. A rank no fact record can
hold alongside the propulsion the point asks for — a sailing vessel ranking
`rule18_class:power` — yields nothing, which is where the bound and the
count part company.

## The reference evaluator

`reference.ts` is a second reading of colregs' "Predicate semantics" section,
written without reference to `src/evaluate.ts` and importing nothing from it.
It implements numeric `gte`/`gt`/`lte`/`lt`, list membership, scalar
equality, `not`, `any_of` at both the constraint and the `when` level, the
rule that an absent fact never satisfies anything (`not` included), the
`activity:ram_underwater` ⊇ `activity:ram` refinement, and `modality_by`
first-match-wins.

Two implementations that agree are worth more than one that passes its own
tests. Where they disagree the harness reports it rather than picking a
winner.

`situation-reference.ts` is the two-subject counterpart: an independent read
of colregs ADR 0016, matching the situation and its swap, pooling the
precedence entries that apply in either frame, resolving `rel:overrides`
over that pool, and reading each vessel's roles from what survives. It
shares `reference.ts`'s constraint matcher — the predicate language is one
language — and imports nothing from `src/encounter.ts`. Both files filter by
category, so a lights entry and a steering entry never reach each other's
applied set (REQ-CAT-1's `category` default).

## The checks

**conformance** — for every record, the engine's applied-entry set equals the
reference's, and every applied entry resolves to the same modality in both.
This is the only check that can fail the build.

**consistency** — (i) two applied entries that both resolve to `shall` where
one `rel:excludes` the other: an obligation the data states twice and
contradicts itself on. (ii) records where nothing applies at all, counted by
`fact:position` — except a declared expected-empty set (today just
`position:moored`, Rule 3(i)'s made-fast-to-the-shore case, which the Rules
prescribe no lights for), still tallied but raising no finding. (iii) an
applied entry whose modality resolves to `conditional` because no
`modality_by` branch matched.

**coverage** — entries that never apply, `modality_by` branches never the
first match, `one_of` options never selectable. All three are empty: every
entry and every branch is reachable.

**traceability** — every entry's `cite` resolves to a paragraph in colregs
`data/rules.json`, including both ends of a range cite like
`23(a)(iii)-(iv)`.

**fixture replay** — colregs' own `applicability-fixtures.json`, replayed
through the reference evaluator rather than the engine.

**Part B** — the same three checks over the situation space. conformance
compares `evaluateEncounter` against the pooled reference on applied
entries, modalities, classification, risk and roles; consistency asks
whether the data can leave both vessels give-way, both stand-on, or an
encounter classified with risk asserted and nobody bound; coverage asks
whether every non-display entry fires. Only a harness error — a situation
the enumerator built that the engine rejects — fails the build. The engine's
own half of ADR 0016 is
[#97](https://github.com/mark-brannan/colregs-engine/issues/97), so a role
disagreement is a finding for a person to triage, not a red run.

## What this does not check

The display verdict is predicate-level: applied entries and their
modalities. It does not compare display composition — `rel:includes`,
`rel:in_lieu_of`, `one_of` resolution — because there is only one
implementation of that layer. So colregs#14 (27(f)/28 carry an unconditional
`rel:includes` of the Rule 23 running lights, which misfires for a vessel at
anchor) cannot appear in any finding here; catching it needs a second
composition implementation, or the fixture colregs#14 asks for. `Situation`'s
`traffic` block and the Rule 2 departure entries are unread on both sides.

## The findings register

[`findings/README.md`](findings/) is generated by the run, one row per
distinct finding, grouped by (check, cause) so that 241,157 records showing
the same conflict are one row and not 241,157. Each row has a
`FIND-nn.json` beside it carrying a representative record — a fact record or
a situation, raw and as a sentence of prose — so triage doesn't start with
decoding axis keys.

The register is checked in, and CI fails if a run would rewrite it — the
message tells you to run `npm run conformance` and commit the result. Data
findings themselves never fail the build; only a conformance mismatch or a
stale register does.

The status ladder is stated once, in the register itself. Agents do not edit
colregs: a finding is a candidate for a maintainer to judge, not a fix.

Every column but two is derived and overwritten on every pass. **status** and
a free-text **triage note** live in [`findings/triage.json`](findings/triage.json),
a hand-maintained sidecar keyed by `check::groupKey` rather than `FIND-nn` —
the same split [#15](https://github.com/mark-brannan/colregs-engine/pull/15)
used for `AXIS_FACTS`/`REFINEMENTS`, for the same reason: a run owns what it
can regenerate and nothing else. To climb a finding up the ladder, edit
`triage.json` and rerun. A stale ruling prints a warning instead of being
silently dropped; a partial run (`--sample`, `--part-b`) writes no register
at all, since it would delete every finding it did not reach.

## Files

- `enumerate.ts` — threshold extractor and partitioned enumerator.
- `reference.ts` — the independent predicate evaluator.
- `situation-enumerate.ts` — the two-subject enumerator.
- `situation-reference.ts` — the independent ADR 0016 read.
- `part-b.ts` — the situation-space phase and its checks.
- `run.ts` — the streaming passes, the checks, and the register writer.
- `traceability.ts` — cite resolution against `rules.json`.
- `prose.ts` — renders a fact record as a vessel description.
- `findings/` — the generated register, plus the hand-maintained
  `triage.json` sidecar.
