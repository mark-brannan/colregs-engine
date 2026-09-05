# Three Claude subagent reviews of proposal v1 — 2026-09-04

Reviewers: three Claude subagents (Opus 5 for formal methods and maritime
law; Sonnet 5 for data modelling), each instructed to be hostile but fair.
Findings condensed faithfully from the verbatim reports; severity and
verdicts as given.

## Formal methods — verdict: redesign

1. BLOCKER. Rule 7(d)(i) (constant bearing) is decidable and is the
   precondition of Rules 15–17; filing all of 7 as `care` makes conduct
   unevaluable. Split 7.
2. SERIOUS. Table not a partition: 13 under both precedence and
   classification; 9/10 under precedence though conduct. Tag per paragraph.
3. SERIOUS. "Shall not impede" (9(b)–(d), 10(i)–(j), 18(d)) is a distinct
   deontic operator, not give-way/stand-on. Add it to modality.
4. SERIOUS. `display` = 20–37 overrides REQ-PART-3 (Part D is
   event-triggered, needs an ADR first).
5. SERIOUS. 1(b)–(e) are the jurisdiction dimension, not `meta`.
6. BLOCKER. Region definition under-quantified: reachability vs two-player
   safety game give different regions; adversary's admissible set must
   exclude 2(b) or the definition is circular.
7. BLOCKER. TLC witnesses one bad trace; it cannot prove no escape exists.
   Needs a timed-game solver (UPPAAL TIGA/STRATEGO), KeYmaera X for dynamics.
8. BLOCKER. Physics enters silently: hull extent, continuous time, turning
   circle, stopping distance. Make a dynamics model an ink prerequisite.
9. SERIOUS. "Solution count" is discretisation noise; use a normalised
   measure of the winning set.
10. SERIOUS. "Rule violation required" is the region's membership test, not
    a tier proxy.
11. SERIOUS. "Counterintuitive" needs a syntactic definition (winning set
    excludes starboard alteration / speed reduction).
12. SERIOUS. Absolute-frame state space ~3e12; relative frame 1e4–1e6.
13. SERIOUS. Guard rail is non-interference: ∀s ∀h h′ · π(O(s,h)) =
    π(O(s,h′)); discharge by construction; fix the label alphabet or it is
    vacuous.
14. SERIOUS. CMI is an NGO position paper, not law; supports
    human-in-the-loop, not output-invariance.
15. SERIOUS. "Fact record does not change" is false as written: kinematics
    are a new fact class.
16. MINOR. `shall_not` should be hyphenated.
17. MINOR. Rule 18 is not a total order (18(d) not-impede; 18(b)/(e)
    conditioned differently).

## Maritime law and seamanship — verdict: redesign

1. BLOCKER. Table not a partition; categorise per paragraph.
2. BLOCKER. Rules 4 and 11 absent: Section II applies only in sight; Rule 19
   only out of sight. Without a `scope` category precedence fires in fog.
3. BLOCKER. Rule 7(d) computable; 7(c) monitorable; 7(a) care.
4. BLOCKER. Rule 18 is a partial order (NUC vs RAM unordered); 18(d) is
   shall-not-impede; 8(f)(iii) restores Section II duties; 18(f) WIG
   missing; the exception clause disapplies 18 for 9 and 10 too.
5. BLOCKER. "The engine never generates a departure": silence in the region
   is the wrong answer; require an explicit abstention output.
6. SERIOUS. CMI quote verified (p. 14) but same paragraph says departure "is
   mandatory" and supervised autonomy "arguably satisfies"; it concerns who
   may navigate, not what a decision aid prints; 2018, superseded in
   practice by IMO MASS work [expertise].
7. SERIOUS. 2(b) is a duty where departure is necessary, burden on the
   departing vessel [expertise: The Bywell Castle (1879); Boy Andrew v St
   Rognvald [1948]]; 2(a) fires precisely when the rules were obeyed.
8. SERIOUS. "2(b) overrides all" licenses dropping any rule; scope it to
   the invariant violation.
9. SERIOUS. Tiers reinvent existing vocabulary: Rule 17's stages;
   human-reliability analysis (THERP/HEART/CREAM) [expertise]. Casualty
   records will not calibrate tiers 3–4. Andrea Doria/Stockholm (1956) as a
   tier-3 candidate [expertise].
10. SERIOUS. 1(c) binds the display corpus directly.
11. MINOR. Presenting "obligations" with 4, 7, 11 unmodelled invites
    reliance-induced breach [expertise: The Pennsylvania (1873)].

## Data modelling — verdict: approve with changes

1. BLOCKER. Renaming `lights` to `effect` changes every entry and breaks
   `test/data.test.mjs`; keep `lights` for display.
2. BLOCKER. Two-subject situation record has no schema; no vessel-scoping
   segment in `docs/identifiers.md`; blocks Rule 18.
3. SERIOUS. Fixture format cannot express a situation (worsens Q-5).
4. SERIOUS. Invariants file needs `jurisdiction` (ADR-0001/2; Q-8 shows Part
   B numbering diverges).
5. MINOR. `care`/`meta` should not sit in `entries[]`; use a registry beside
   `known_omissions`.
6. Decide now: the two-subject namespace. Premature ink: the
   verification-method column.
