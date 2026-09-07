# Z3 encoding of the applicability table

✎ **Pencil.** A proof of concept for
[issue #1](https://github.com/mark-brannan/colregs-engine/issues/1) item
P2.1. Nothing here has been triaged.

```
npm run z3                 # 56 queries, under a second
npm run z3 -- --verbose    # plus the decoded witness for every sat
```

`npm test` covers the encoding (test/z3-encoding.test.ts: literal
predicates, the modality layer, a differential check against the engine, and
the three findings as positive controls). The harness itself is not in
`npm test` and not in CI. z3-solver 4.15.3, pinned exactly, WebAssembly
build; no system z3 needed.

## What was asked of the solver

`encode.ts` reads the pinned colregs `applicability.json` and emits a
first-order theory: one SMT constant per fact axis a predicate reads, and per
entry `|applies:<id>|`, `|shall:<id>|`, and for a conditional entry one
`|branch:<id>:<i>|` per `modality_by` branch plus `|unresolved:<id>|`.
`queries.ts` states the P1.3 properties as queries over those definitions.

Only the 40 `category: display` entries are encoded, the scope
`src/evaluate.ts` and `research/conformance/` already work in. The 30
two-vessel entries colregs 0.2.0 added are counted and named by the run, not
solved. The header of `encode.ts` lists the choices that change what an
answer means: Real axes rather than the enumeration's grid, total records,
and the engine's own dispatch order.

| property | queries | asks |
|---|---|---|
| `conflicting-shall` | 5 | two entries, one `rel:excludes` the other, both resolving to `shall` |
| `no-obligation` | 2 | a record where no entry applies at all |
| `entry-fires` | 40 | this entry applies to something |
| `unresolved-conditional` | 3 | this conditional entry applies and no branch matches |
| `branch-reachable` | 6 | this `modality_by` branch can be the first match |

## What a counterexample looks like

A `sat` for a query whose recorded expectation is `unsat`, or the reverse.
run.ts prints it under `=== Z3 DISAGREES WITH THE RECORDED EXPECTATION ===`
with the decoded witness as raw facts and as prose, and exits non-zero. That
is the result worth having: the enumeration and the solver disagree, so one
of them is wrong, or the recorded expectation was. Two other failure modes
are reported the same way: a model the evaluators refuse (the encoding and
the engine have drifted), and a partition-lemma counterexample (a `sat`
model whose property fails once snapped to the enumeration's grid).

`npm run z3` also writes the theory plus queries to
`research/z3/out/applicability.smt2`, gitignored because it is a function of
the pinned colregs. Plain SMT-LIB 2; any other solver takes it unchanged.

## expectations.json

Pencil. Query id → the answer the enumeration observed, the date, the run,
`triaged: false`, a `finding` pointer into `research/conformance/findings/`,
and `would_settle`, naming what a maintainer would have to decide. Code
reads the file; revising a ruling is a data edit.

## Files

- `encode.ts` — the SMT-LIB generator.
- `queries.ts` — the P1.3 properties as queries; loads `expectations.json`.
- `expectations.json` — ✎ the recorded expectations.
- `decode.ts` — Z3 numerals back to fact values; the representative grid.
- `run.ts` — the run, the two replays, the report.
