# Engine notes — display composition semantics

**In plain terms:** the colregs data says which lighting rules apply to
a vessel. Turning those rules into complete, lawful light displays needed
seven judgment calls that the data does not make. This file records them
so they can be reviewed as decisions, not archaeology.

colregs defines predicate semantics and the five relations, and leaves
final composition to the consumer (REQ-CONS-3). The evaluator in
`src/evaluate.ts` implements the predicate layer exactly as the
colregs README states it, replaying all 53 fixture cases verbatim in CI.
Each composition decision below is tested in `test/displays.test.ts`.

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

1. **An exemption removes a light and shows it crossed out, never
   hidden.** An applied entry exempted by a `rel:exempts` entry (30(e))
   is removed from every display and reported as exempted. Exempts
   relieve; they don't forbid.

2. **A mandatory rule can veto lights another rule would add, and the
   veto is recorded with its source.** 26(b)(i) is `shall` and excludes
   30(a)/30(b): the anchor lights are removed from composition and
   reported as excluded, with the excluder named — that is Rule 26(a)'s
   "only the lights prescribed in this Rule". The same bar applies to
   one_of import options (a fishing vessel aground does not import the
   Rule 30 anchor lights 26(a) forbids). When the excluder is itself an
   alternative (25(b) vs 25(c)), exclusion is a co-occurrence constraint
   between displays instead.

3. **Genuine alternatives split into separate displays, one per lawful
   choice.** An applied entry whose `rel:in_lieu_of` references applied
   entries is a choice: in a display it replaces its references; out of
   it, they stand. Two chosen alternatives with overlapping replacement
   targets are alternatives to each other and never co-occur. This
   yields exactly the three displays for the 12 m sloop
   (25(a) | 25(b) | 25(a)+25(c)).

4. **When one rule borrows lights from another, the borrowed lights keep
   their original strictness, and borrowing skips lights that contradict
   the vessel's situation.** An import's carrier gates only its own
   lights: Rule 28's three reds are `may`, but the Rule 23 lights it
   imports stay `shall` (the data's own note). An import whose source
   entry names a contradicting `fact:position` is skipped — 27(f)'s
   include of the Rule 23 running lights reads "as appropriate" in the
   rule text, and a mine-clearance vessel at anchor shows Rule 30 lights,
   not mastheads.

5. **A "pick one of these" group picks exactly one, or none when the
   whole group is optional.** `one_of` (30(d): anchor lights per 30(a)
   *or* 30(b)) chooses exactly one — or none, when the carrier is `may`
   (25(d)(ii): sailing lights, or failing that the carrier's own torch;
   choosing an option replaces the carrier's own lights). An option that
   is itself applied satisfies the group by its own dynamics. A
   non-applied option is available only if its scalar gates (30(b)'s
   "less than 50 metres") hold for this vessel; its situation axes are
   deliberately overridden by the carrier's redirect.

6. **Standalone optional lights are toggles, not extra displays.**
   Relation-free `may` entries are optional additions, not display
   multipliers: the second masthead below 50 m, deck lights below
   100 m, the trawler's optional masthead, Rule 28's three reds. They
   are rendered as toggleable additions beside the display chips. A
   `may` entry that participates in relations (25(c)'s includes and
   excludes) is a display alternative and multiplies.

7. **Duplicate displays are merged, and each remembers the choices that
   produced it.** Displays are deduplicated by entry set + light
   fingerprint, and every display records which choices produced it —
   that is the data behind the elimination UX.

If any of these turn out to disagree with the data's intent, that is a
colregs conversation (an issue with the failing fact record), not a
quiet app-side patch.

8. **Part B entries are out of this evaluator's domain.** colregs'
   `applicability.json` also carries two-subject Part B entries
   (`subjects: 2`, a `category` and an `effect` describing which steering
   rules apply, no `lights`) alongside the single-subject lights entries
   this evaluator was built for. They describe two-vessel steering
   obligations (give-way/stand-on, Part B Section I/II/III scope), not
   lights and shapes, and have no `lights` clause to display. The lights
   evaluator filters them out at the top of `appliedEntries`/`evaluate`
   (`isLightsEntry`, keyed on `subjects !== 2`) before predicate matching
   ever runs. Part B steering gets its own data model and evaluator in a
   later phase of the [research programme](https://github.com/mark-brannan/colregs-engine/issues/1).
