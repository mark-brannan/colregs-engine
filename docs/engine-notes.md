# Engine notes — display composition semantics

colregs defines predicate semantics and the five relations, and leaves
final composition to the consumer (REQ-CONS-3). The evaluator in
`src/evaluate.ts` implements the predicate layer exactly as the
colregs README states it, replaying all 53 fixture cases verbatim in CI.
Composing applied entries into *complete lawful displays* required a
handful of decisions the data does not make. They are recorded here so
they can be reviewed as decisions, not archaeology. Each is tested in
`test/displays.test.ts`.

## Applied-entry layer (from the data, no decisions)

- An entry applies when every constraint in `when` is satisfied; an
  absent fact never satisfies a constraint.
- Numeric constraints are `{gte, gt, lte, lt}`; a list is membership;
  anything else is equality.
- `activity:ram_underwater` is a refinement of `activity:ram`
  (facts.json): predicates written for `ram` also read it.
- `modality: conditional` resolves through `modality_by` against the
  fact record (first matching branch).

## Composition decisions (this app's, documented as such)

1. **Exempts relieve, they don't forbid.** An applied entry exempted by
   a `rel:exempts` entry (30(e)) is removed from every display and
   reported as exempted. The UI shows it struck through, not silently
   absent.

2. **A required entry's `rel:excludes` suppresses.** 26(b)(i) is
   `shall` and excludes 30(a)/30(b): the anchor lights are removed from
   composition and reported as excluded, with the excluder named — that
   is Rule 26(a)'s "only the lights prescribed in this Rule". The same
   bar applies to one_of import options (a fishing vessel aground does
   not import the Rule 30 anchor lights 26(a) forbids). When the
   excluder is itself an alternative (25(b) vs 25(c)), exclusion is a
   co-occurrence constraint between displays instead.

3. **Alternatives branch.** An applied entry whose `rel:in_lieu_of`
   references applied entries is a choice: in a display it replaces its
   references; out of it, they stand. Two chosen alternatives with
   overlapping replacement targets are alternatives to each other and
   never co-occur. This yields exactly the three displays for the 12 m
   sloop (25(a) | 25(b) | 25(a)+25(c)).

4. **`rel:includes` imports stand on their own.** An import's carrier
   gates only its own lights: Rule 28's three reds are `may`, but the
   Rule 23 lights it imports stay `shall` (the data's own note). An
   import whose source entry names a contradicting `fact:position` is
   skipped — 27(f)'s include of the Rule 23 running lights reads "as
   appropriate" in the rule text, and a mine-clearance vessel at anchor
   shows Rule 30 lights, not mastheads.

5. **`one_of` chooses exactly one** (30(d): anchor lights per 30(a) *or*
   30(b)) — or none, when the carrier is `may` (25(d)(ii): sailing
   lights, or failing that the carrier's own torch; choosing an option
   replaces the carrier's own lights). An option that is itself applied
   satisfies the group by its own dynamics. A non-applied option is
   available only if its scalar gates (30(b)'s "less than 50 metres")
   hold for this vessel; its situation axes are deliberately overridden
   by the carrier's redirect.

6. **Relation-free `may` entries are optional additions**, not display
   multipliers: the second masthead below 50 m, deck lights below
   100 m, the trawler's optional masthead, Rule 28's three reds. They
   are rendered as toggleable additions beside the display chips. A
   `may` entry that participates in relations (25(c)'s includes and
   excludes) is a display alternative and multiplies.

7. **Displays are deduplicated** by entry set + light fingerprint, and
   every display records which choices produced it — that is the data
   behind the elimination UX.

If any of these turn out to disagree with the data's intent, that is a
colregs conversation (an issue with the failing fact record), not a
quiet app-side patch.
