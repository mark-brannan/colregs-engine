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

## Usage

One call. Pass the colregs applicability data and a fact record describing
one vessel at one moment; get back every complete lawful display.

```ts
import { evaluateDisplay } from 'colregs-engine';

const result = evaluateDisplay({
  'fact:propulsion': 'propulsion:sail',
  'fact:activity':   'activity:none',
  'fact:position':   'position:underway',
  'fact:length_m':   11.6,
});
```

For that 12 m sloop the result is three displays, because Rule 25 offers a
choice and the engine never picks for you:

```
applied:  25a, 25b, 25c
displays:
  chosen []      sidelights[shall], sternlight[shall]
  chosen [25b]   combined lantern[may]
  chosen [25c]   sidelights[shall], sternlight[shall], all-round red[may], all-round green[may]
```

Every light in a display names the entry that prescribes it (`sourceEntry`),
the entry that pulled it in if different (`via`), and how strongly the rule
requires it (`modality`). Every display names the choices that produced it
(`chosen`), so a UI can let the user eliminate options.

When one rule vetoes another, the result says who did it. A fishing vessel
aground:

```ts
evaluateDisplay({
  'fact:propulsion': 'propulsion:power',
  'fact:activity':   'activity:fishing',
  'fact:position':   'position:aground',
  'fact:length_m':   30,
});
```
```
applied:  26c-id, 30d-anchor, 30d-red
excluded: [{ id: "30a", by: "26c-id" }, { id: "30b", by: "26c-id" }]
displays:
  chosen []   all-round[shall], all-round[shall], all-round[shall-if-practicable]
```

Rule 26(a) says a fishing vessel shows only the lights in that Rule, so the
ordinary anchor lights are struck and reported as excluded. The aground
signal of Rule 30(d) still stands.

Fact keys and values are the identifiers in colregs' `data/facts.json`, and
the types are generated from it: `{ propulsion: 'sail' }` does not compile,
because the key is not namespaced and the value is not one Rule 3(c) knows.
Both are also checked at runtime, so a record that arrives as JSON or
through a cast is rejected too:

```ts
import type { FactRecord } from 'colregs-engine';

evaluateDisplay({ propulsion: 'sail' } as unknown as FactRecord);
// Error: unknown fact key 'propulsion'; did you mean 'fact:propulsion'? …
```

That is a change of behaviour: such a record used to evaluate to one empty
display, which is also the honest answer for a vessel that lawfully shows
nothing. The two must not look alike. `appliedDisplayEntries(facts)` returns
just the matching entry ids, without composing displays, and validates on
the same terms.

## Why `display`, and what the other cases will be called

`display` is colregs' own category name (ADR 0005) for the case this
function serves: one vessel's facts in, the signals she shows out. It covers
lights and day shapes together, because in the data they are one category
separated by a visibility condition, not two evaluations.

The other engine-evaluable categories read a *situation* — two vessels, with
relative geometry and kinematics — which is a different input type, not a
wider fact record. So they will arrive as their own entry points rather than
as more fields on `DisplayEvaluation`:

| category | input | entry point |
|---|---|---|
| `display` | one vessel's facts | `evaluateDisplay` |
| `classification` | a situation | not yet built |
| `precedence` | a situation | not yet built |
| `conduct` | a trace, not a point | not an evaluation at all |

Those names are not settled, and neither is the ADR they come from — both
are `pencil` in colregs' own sense. The shape of the seam is the durable
part: a second input type, not a fatter first one.

## Data, and the version stamp

`evaluateDisplay` reads the applicability data from the colregs release this
package resolves. Pass `opts.data` to evaluate against something else — the
conformance harness injects synthetic tables, and other jurisdictions will
arrive as separate files.

Every result carries `colregs.version` and `colregs.source`, because an
answer is a function of the data as much as of the facts. `source:
'resolved'` means the version describes the data exactly. `source: 'caller'`
means you supplied the data, and the version then names only what this
package resolved: colregs' schema carries no version field, so nothing here
can tell whether the two agree. The field says which claim it is making
rather than leaving the two indistinguishable.

## Entry points

- `colregs-engine` — `evaluateDisplay`, `appliedDisplayEntries`, and the
  engine's own output vocabulary: `DisplayEvaluation`, `Display`,
  `DisplayLight`, `FactRecord`, `Modality`. This is what most consumers
  want, and it does not move when colregs releases data.
- `colregs-engine/schema` — the colregs data shapes, generated from that
  package's JSON Schema: `Entry`, `Predicate`, `LightSpec`, `LightDef`,
  `ApplicabilityData` and the rest. Import these only if you read the data
  files yourself; they change when the data changes.

`evaluate(data, facts)`, `appliedEntries(data, facts)` and the `Evaluation`
type still exist as deprecated aliases, and go in a later 0.x.

The composition decisions the engine makes on top of the data are recorded
in [docs/engine-notes.md](docs/engine-notes.md).

## Constraints

These exist so the engine can be checked exhaustively instead of sampled,
which is what the next section is about.

- **Pure and total.** Facts in, displays out. No I/O, no clock, no state.
  Timing, freshness and hysteresis belong to whatever calls this.
- **Finite input.** Partition the numeric facts at the thresholds the rules
  actually compare against (7, 12, 20, 50 and 100 m, plus the tow, gear and
  speed constants) and the whole fact space is around 5 × 10⁶ records. Minutes
  of CPU.
- **Complete answers.** Where several displays are lawful, all of them come
  back. The fact record describes a situation, not a fitted vessel: nothing
  in it says whether a sloop carries a tricolour lantern, so nothing in it
  could settle Rule 25(b) against 25(c). Narrowing the set would take a fact
  the engine is not given. Composition itself is a different matter — the
  engine makes seven judgment calls the data leaves open, each recorded in
  [docs/engine-notes.md](docs/engine-notes.md).
- **Traceable.** Every entry in an output cites the paragraph it came from.

## Verification

"Does the engine agree with the rules?" should be answered by checking every
case, or by proving it. Each step below is a stronger answer than the one
before.

0. Fixture replay: the package's `fixtures/applicability-fixtures.json`,
   verbatim. The least it should pass.
1. Exhaustive conformance, in CI. `npm run conformance` walks all 5,930,496
   records of the partitioned fact space and checks that engine output equals
   the set of entries whose conditions hold, against a second reading of the
   predicate semantics written independently of `src/`. The same run looks for
   conflicting `shall` entries, records that end up with no obligation at all,
   entries and branches that never fire, and cites that don't resolve to a
   paragraph. Whatever it finds is printed as a readable vessel and saved as a
   fixture in [`research/conformance/`](research/conformance/), which explains
   how to run it and how a finding is triaged.
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
