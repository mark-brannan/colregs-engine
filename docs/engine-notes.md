# Engine notes — display composition semantics

**In plain terms:** the colregs data says which lighting rules apply to
a vessel. Turning those rules into complete, lawful light displays needed
the judgment calls that the data does not make. This file records them
so they can be reviewed as decisions, not archaeology.

colregs defines predicate semantics and the five relations, and leaves
final composition to the consumer (REQ-CONS-3). The evaluator in
`src/evaluate.ts` implements the predicate layer exactly as the
colregs README states it, replaying every fixture case verbatim in CI.
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

Items 2–5 are colregs' readings now, ruled in
[ADR 0019](https://github.com/mark-brannan/colregs/blob/main/docs/adr/0019-relation-reach-and-import-reads.md);
each line below names the point that owns it.

2. **How far a relation reaches** — ADR 0019 point 1: `rel:overrides`
   fires from an obligation and reaches entries in force; `rel:excludes`
   fires from nowhere and is a co-occurrence check within a display.
3. **Alternatives whose `rel:in_lieu_of` targets intersect never share a
   display** — ADR 0019 point 4.
4. **What an import reads** — ADR 0019 point 3: lights, their modality and
   the source's scalar gates; never its axes.
5. **What a `one_of` yields** — ADR 0019 point 2: one option per display,
   or none under a `may` carrier; an option already in force discharges it.

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

## Encounter, conduct and Rule 2 decisions

8. **Bare keys mean `own:`; `fact:rule18_class` is decoded per subject first.**
9. **Any obligation overrides, `shall-not-impede` included** (9(b) is
   written with it and overrides 18(a)(iv)); only a `may` overrider is inert.
10. **A `none` effect confers no role.** 8(f)(iii) still appears in `applied`.
11. **Competing classifications resolve overtaking, head-on, crossing, in
    that order:** 13(d) forbids reclassifying a latch, 14(c) errs head-on.
12. **A stated `pair:geo:risk_of_collision` counts as asserted, `by: []`.**
13. **A latch in a classified overtaking is `13(d)`, read before any role;
    then phases follow roles, strongest first:** give-way `16`, keep-clear
    `18(f)(i)`, stand-on `17(a)(i)` (`17(a)(ii)` once turning),
    shall-not-impede `8(f)(i)`. `17(b)` is not emitted.
14. **Every conduct verdict is `pending`** until a monitor exists.
15. **A Rule 2 grid is a first-match list of predicate regions.** None, or
    no match, is `inconclusive-in-model`, named in `assumptions_violated`.

If any of these turn out to disagree with the data's intent, that is a
colregs conversation (an issue with the failing fact record), not a
quiet app-side patch.
