# colregs-engine

Describe a vessel — how long it is, what it is doing, whether it is under
way — and this library tells you every set of lights and shapes that vessel
may lawfully show under the COLREGS. Where the rules permit a choice, it
returns all the options; choosing between them is the skipper's job.

The rules themselves live as data in the
[colregs](https://github.com/mark-brannan/colregs) package. This is the part
that reads them: it tests each entry's conditions against the vessel you
described, then resolves how the surviving entries interact — one display
includes another, replaces it, rules it out, or exempts the vessel
altogether — and returns the complete displays that come out the far end.

**Status: name staked, not yet started.** The engine is being built inside
[searoom](https://github.com/mark-brannan/searoom) first and will be
extracted here once it earns a second consumer.

## What the engine is required to be

These four constraints are not house style. They are what lets us check the
engine exhaustively rather than sample it with a few tests, so they are
load-bearing for the plan in the next section.

- **A pure, total function.** Facts in, set of lawful displays out. No I/O,
  no clock, no state. Timing, freshness and hysteresis belong to whatever
  consumes this, never to it.
- **A finite input space.** The fact record is enumerable: after
  partitioning the numeric facts at the thresholds the data's predicates
  actually compare against (7, 12, 20, 50, 100 m and the tow, gear and
  speed constants), the whole space is on the order of 10⁷ records —
  minutes of CPU, not a sampling problem.
- **Non-committal on alternatives.** Where the rules permit a choice, the
  engine returns all of it. Picking is a human's job, and a function that
  picks is a function whose output can't be checked against the data.
- **Traceable.** Every entry in an output cites the paragraph that put it
  there. A result you can't trace to a paragraph is not a result.

## Verification

"Does the engine agree with the rules?" should be answered by checking every
case, or by proving it — not by trying a few and hoping. Each rung below is
a stronger form of that answer than the one before:

0. **Fixture replay** — the package's `fixtures/applicability-fixtures.json`
   replayed verbatim. The floor, not the ceiling.
1. **Exhaustive conformance in CI** — for every record in the partitioned
   fact space, engine output equals the set of entries whose predicate
   holds. Same run checks consistency (no conflicting `shall` entries, no
   record left with no obligation) and coverage (no entry that never
   fires). Counterexamples render as readable vessels and land as fixtures.
2. **The same properties, stated to a solver** — Z3 over the applicability
   table, Alloy for the encounter-sector partition. For readers who
   reasonably distrust "we ran a lot of tests".
3. **A Rocq lemma that threshold-partitioned enumeration is complete** —
   which turns step 1 from a large test into a proof.
4. **Optionally, a verified evaluator** — the core in Gallina, proved total
   and deterministic, extracted and run as a second implementation against
   step 1's harness. Decided after step 3, on whether the toolchain cost
   earns its keep.

Steering-rule work — Part B, three-vessel cycles, the temporal and
kinematic models — is tracked with the rest of the programme in
[colregs-engine#1](https://github.com/mark-brannan/colregs-engine/issues/1),
not here.

Background for readers new to the tooling:
[glossary](docs/formal-methods-glossary.md) ·
[reading list](docs/formal-methods-reading-list.md).

## Licence

Apache-2.0. Nothing here is advice to mariners; the fitness-for-navigation
disclaimer in [colregs](https://github.com/mark-brannan/colregs) carries over.
