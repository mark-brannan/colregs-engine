# Z3 encoding of the applicability table

✎ **Pencil.** A proof of concept for
[issue #1](https://github.com/mark-brannan/colregs-engine/issues/1) item
P2.1, run once. Nothing here has been triaged.

```
npm run z3                 # 56 queries, ~0.6s
npm run z3 -- --verbose    # plus the decoded witness for every sat
```

`npm test` covers `encodeConstraint`/`encodePredicate` (test/z3-encoding.test.ts,
~1.8s of it a differential check against the engine). The harness itself is
not in `npm test` and not in CI.

z3-solver 4.15.3, pinned exactly, WebAssembly build — no system z3 needed.

## What was asked of the solver

`encode.ts` reads the pinned colregs `applicability.json` and emits a
first-order theory: one SMT constant per fact axis a predicate reads, and
per entry a `|applies:<id>|`, a `|shall:<id>|`, and — for a conditional
entry — one `|branch:<id>:<i>|` per `modality_by` branch plus an
`|unresolved:<id>|`. `queries.ts` states the P1.3 properties as queries over
those definitions. 40 entries, 14 axes, 56 queries.

colregs 0.2.0 (REQ-CAT-1) added a `category` to every entry and, under
scope/precedence/classification, 30 more entries that read a *pair* of
vessels — own:/other:/pair:-prefixed keys (`pair:geo:in_sight`,
`own:kin:wind_side`, `other:geo:rel_bearing_deg`, …) that colregs'
facts.json does not declare at all. Those 30 are excluded from this
encoding, the same way `src/evaluate.ts` and `research/conformance/`
already exclude them from `applied`/`displays` and from the exhaustive
enumeration (`category: 'display'` only — see `encode.ts`'s file header,
point 4). Nothing above changed as a result: 40 display entries, 14 axes and
56 queries are the same counts as under colregs 0.1.2, because this
encoding's scope was always "what `evaluate()`'s applied/display output can
contain," and colregs 0.2.0 didn't touch that set. `npm run z3`'s own output
reports the exclusion explicitly (`excluded  30 (3 scope, 21 precedence, 6
classification)`), so a narrower scope is never silent.

The same properties the exhaustive enumeration checks record by record:

| property | queries | asks |
|---|---|---|
| `conflicting-shall` | 5 | two entries, one `rel:excludes` the other, both resolving to `shall` |
| `no-obligation` | 2 | a record where no entry applies at all |
| `entry-fires` | 40 | this entry applies to something |
| `unresolved-conditional` | 3 | this conditional entry applies and no branch matches |
| `branch-reachable` | 6 | this `modality_by` branch can be the first match |

Three deliberate choices, each of which changes what an answer means:

1. **Numeric axes are `Real`, not the enumeration's finite grid.** An
   `unsat` here holds for every real value, where the enumeration's
   `unsat` holds for one representative per threshold interval and leans on
   the partition lemma that ladder step P3.1 has yet to prove. The Z3
   answer is strictly stronger.
2. **Every declared axis is total** — no "absent" value. That matches the
   enumerated space, and it is sound for `unsat`: `valueMatches(undefined, …)`
   is false for every constraint shape, so an absent fact only ever makes an
   entry apply less often.
3. **The translation follows `src/evaluate.ts`'s `valueMatches` dispatch
   order exactly**, including the type-mismatch early returns — a numeric
   constraint on an enum axis is `false`, so `{not: {gte: 5}}` on that axis
   is `true`. Getting this wrong in the other direction would make the
   encoding a different program from the engine, and the differential test
   is what pins it.

`not` and both `any_of` forms are implemented even though the pinned colregs
(0.1.2) uses neither — the same stance `research/conformance/reference.ts`
takes. Tested against literal predicates; unexercised by real data until the
pin moves.

## What came back

56 queries, all answers matching `expectations.json`, 0.6s wall clock
(0.4s in the solver). Every `sat` model was decoded into a fact record and
replayed through both `src/evaluate.ts` and
`research/conformance/reference.ts`; both accepted all 49.

Two things worth stating plainly:

- **The solver over the reals agrees with the enumeration over the grid, on
  every property.** That is not proof of the partition lemma — it is
  56 instances in which the lemma's conclusion holds.
- **All 49 `sat` models land off the enumeration's representative grid**
  (Z3 has no reason to prefer 12 to 0), and every one of them still
  satisfies its property after being snapped to the representative of its
  own threshold interval. A model that did *not* would be a counterexample
  to the partition lemma; run.ts checks each one and reports it under
  `=== PARTITION-LEMMA COUNTEREXAMPLE ===`. None appeared.

The three `sat` answers that correspond to observations in
`research/conformance/findings/` — FIND-01, FIND-02, FIND-03 — reproduced,
from a completely different mechanism. Their expectations sit in
[`expectations.json`](expectations.json), marked pencil and `triaged: false`,
each recording what a run observed and what would settle it. **None of them
is a ruling**, and a run going green does not make one.

## What a counterexample looks like

A `sat` for a query whose recorded expectation is `unsat` (or the reverse).
run.ts prints it under `=== Z3 DISAGREES WITH THE RECORDED EXPECTATION ===`
with the decoded witness as raw facts and as a sentence of prose, and exits
non-zero:

```
!! CONFLICT/27b-id+30a       sat     expect unsat     4ms

=== Z3 DISAGREES WITH THE RECORDED EXPECTATION ===
  CONFLICT/27b-id+30a: Z3 says sat, expectations.json says unsat
    witness: a 0 m vessel, anchored, engaged in trawling (…)
    facts:   {"fact:activity":"activity:trawling", …}
```

That is the result worth having: the enumeration and the solver disagree, so
one of them is wrong, or the recorded expectation was. **The fix is never to
edit `expectations.json` until it goes green.** Two other failure modes are
reported the same way and also exit non-zero: a model the evaluators refuse
to accept (the encoding and the engine have drifted), and a partition-lemma
counterexample.

`npm run z3` also writes the whole theory plus queries to
`research/z3/out/applicability.smt2` — gitignored, because it is a function
of the pinned colregs and not a source file. It is plain SMT-LIB 2 and can
be handed to any other solver unchanged, which is the cheapest available
check on z3-solver itself.

## expectations.json

Pencil. Query id → the answer the exhaustive enumeration observed, the date,
the run that observed it, `triaged: false`, and a `would_settle` field naming
what a maintainer would have to decide. Code reads the file; revising a
ruling is a data edit.

If [`research/conformance/findings/triage.json`](https://github.com/mark-brannan/colregs-engine/pull/17)
lands, the `triaged` and `finding` fields here should fold into it and be
read from there — a finding should not have two statuses. This file does not
depend on that PR.

## Files

- `encode.ts` — the SMT-LIB generator.
- `queries.ts` — the P1.3 properties as queries; loads `expectations.json`.
- `expectations.json` — ✎ the recorded expectations.
- `decode.ts` — Z3 numerals back to fact values; the representative grid.
- `run.ts` — the run, the two replays, the report.
