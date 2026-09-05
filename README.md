# colregs-engine

Applicability evaluator over the
[colregs](https://github.com/mark-brannan/colregs) data package: predicates
over a fact record → applicable entries → relations resolved (`includes`,
`conditional_includes`, `in_lieu_of`, `excludes`, `exempts`) → the set of
complete lawful displays. Alternatives stay unresolved: every lawful option
is returned; the engine never picks one.

**Status: name staked, not yet started.** The engine is being built inside
[searoom](https://github.com/mark-brannan/searoom) first and will be
extracted here once it earns a second consumer.

## What the engine is required to be

The constraints below are not house style. They are what makes the engine
verifiable rather than merely tested, and they are load-bearing for the
plan in the next section.

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

The intent is that "does the engine agree with the data?" is answered by
proof or exhaustion, never by a sample. The ladder, roughly in order:

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
