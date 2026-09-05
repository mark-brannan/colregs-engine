# colregs-engine

You describe a vessel: how long, what it's doing, whether it's under way. It
gives back every set of lights and shapes that vessel may lawfully show
under the COLREGS. Where the rules allow a choice you get all the options;
picking one is up to the skipper.

The rules themselves live as data in the
[colregs](https://github.com/mark-brannan/colregs) package. This is the part
that reads them. It checks each entry's conditions against your vessel, then
works out how the surviving entries interact: a display can include another,
replace it, rule it out, or exempt the vessel from showing anything. What
comes out is the set of complete lawful displays.

The evaluator now lives here, in `src/`, extracted from searoom on
2026-09-05; [searoom](https://github.com/mark-brannan/searoom) will consume
it as a package once it's published.

## Constraints

These exist so the engine can be checked exhaustively instead of sampled,
which is what the next section is about.

- **Pure and total.** Facts in, displays out. No I/O, no clock, no state.
  Timing, freshness and hysteresis belong to whatever calls this.
- **Finite input.** Partition the numeric facts at the thresholds the rules
  actually compare against (7, 12, 20, 50 and 100 m, plus the tow, gear and
  speed constants) and the whole fact space is around 5 × 10⁶ records. Minutes
  of CPU.
- **No choosing.** Where several displays are lawful, all of them come back.
  A function that picks one can't be checked against the data.
- **Traceable.** Every entry in an output cites the paragraph it came from.

## Verification

"Does the engine agree with the rules?" should be answered by checking every
case, or by proving it. Each step below is a stronger answer than the one
before.

0. Fixture replay: the package's `fixtures/applicability-fixtures.json`,
   verbatim. The least it should pass.
1. Exhaustive conformance, in CI. For every record in the partitioned fact
   space, engine output equals the set of entries whose conditions hold. The
   same run looks for conflicting `shall` entries, records that end up with
   no obligation at all, and entries that never fire. Whatever it finds gets
   printed as a readable vessel and saved as a fixture.
2. The same properties handed to a solver: Z3 over the applicability table,
   Alloy for the encounter sectors. This is for anyone who distrusts "we ran
   a lot of tests", which is a reasonable thing to distrust.
3. A Rocq proof that partitioning at the thresholds misses nothing, which
   promotes step 1 from a big test to an actual proof.
4. Maybe a verified evaluator: the core written in Gallina, proved total and
   deterministic, extracted, then run as a second implementation against
   step 1's harness. Worth deciding once step 3 lands.

Steering rules are a separate problem — Part B, three-vessel cycles, timing
and kinematics — and they're tracked with the rest of the programme in
[colregs-engine#1](https://github.com/mark-brannan/colregs-engine/issues/1).

New to the tooling? There's a [glossary](docs/formal-methods-glossary.md) and
a [reading list](docs/formal-methods-reading-list.md).

## Licence

Apache-2.0. Nothing here is advice to mariners; the fitness-for-navigation
disclaimer in [colregs](https://github.com/mark-brannan/colregs) carries over.
