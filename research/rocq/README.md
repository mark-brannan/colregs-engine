# Partition soundness, in Rocq

```
rocq c research/rocq/Partition.v     # under two seconds; `coqc` on Coq 8.18+
```

Step 4 of the [verification ladder](https://github.com/mark-brannan/colregs-engine/issues/6).
The [conformance harness](../conformance/) checks every fact record in a
partitioned space rather than every real number a numeric fact could
take. This file is the argument that the two are the same check.

## The lemma

`partition_sound`: over a sorted, non-empty threshold set, two predicates
that compare the value only against those thresholds and agree on the
harness's representatives agree on every value of the type. Generic over
any type with a strict order and a decidable three-way comparison.

It splits into two facts, each its own theorem:

- `eval_same_cell` — a predicate cannot separate two values no threshold
  separates. Predicates are the constraint forms the predicate semantics
  admit (`lt`, `lte`, `gt`, `gte`, plus equality), closed under `not`,
  conjunction and `any_of`.
- `representatives_cover` — every value shares a cell with one of: a point
  below the least threshold, each threshold, a point strictly between each
  adjacent pair, a point above the greatest. `representatives_length` is
  the harness's `2k+1` count.

`partition_sound_R` instantiates it over the reals with
`numericRepresentatives` from `enumerate.ts` transcribed as the scheme:
`c - 1`, the thresholds, `(a + b) / 2`, `c + 1`. The `fact:length_m`
example checks the eleven representatives for 7, 12, 20, 50 and 100 m.
`Print Assumptions` at the end of the file confirms the generic theorem
uses no axiom; the real-number instance inherits the standard library's
classical reals.

## What it does not cover

One axis at a time. The harness's product over several numeric axes is
this lemma applied to each axis with the others held fixed, which is not
formalised. Nor is the step from `src/evaluate.ts` to the `formula` type
here: that a `when` clause evaluates the way `eval` says it does is ladder
step 5's verified evaluator, not this file. Floating point is not
modelled; the midpoints of integer thresholds are exact in binary, and
comparing them is comparing the reals they denote.

CI compiles the file and fails on a proof or compile error, and on the
generic theorem acquiring an assumption.
