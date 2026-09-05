# Proposal — rule categories, invariants, and the Rule 2 region

Draft for Mark, 2026-09-04. Not implemented. Approved parts become
ADR-0005 in the `colregs` data repo (amending REQ-PART-4) and `docs/model.md`
here.

**Ink and pencil.** Ink is decided; sessions may build on it. Pencil is
marked `✎` and states what would settle it. A pencilled word is used
consistently so renaming it later is a find-and-replace.

## 1. What this is for

The light rules were chosen first because they are easy: one vessel's facts
in, a display out. The movement rules are not easy, and Rule 2 exists
because the 1972 drafters knew no rule set covers every situation. The
research question is therefore not "how do we evaluate Rule 2" but:

> **Where do the rules, followed correctly, still fail — and how hard is it
> for a human to recover there?**

Formal methods find the first half. Humans, reviewing what the tools
found, answer the second. Everything below serves that.

## 2. Rule categories `✎ term`

Rules are not all the same shape. Each paragraph is tagged with a category
that fixes its input, its output and its verification method.

| category | rules | reads | produces | software decides? | verified by |
|---|---|---|---|---|---|
| `definition` | 1, 3, 21, 22 | — | vocabulary | n/a | traceability |
| `display` | 20–37 | one vessel's facts | signals + modality | yes | enumeration → Z3 → Rocq (existing ladder) |
| `precedence` | 18; 9, 10, 13 as exceptions | two vessels' facts + encounter | give-way / stand-on | yes | Alloy or Z3 |
| `classification` | 12–15 | relative geometry, 13(d) history | encounter type | yes | Alloy partition |
| `conduct` | 8, 9, 10, 16, 17, 19 | encounter + role + phase + time + positions | obligated or prohibited action | as a monitor over a trace | TLA+, STL |
| `care` | 5, 6, 7, 2(a) | anything | factors only | no | not verifiable; explicitly excluded |
| `meta` | 2(b), 1(b)–(e) | a human assertion | status of other norms | no | derived, see §4 |

`✎ term` — "category" is provisional. Candidates: kind, type, flavour,
charge. Settled by Mark; consistent use makes the rename mechanical.

`✎ membership` — which rules sit in `care` versus `conduct` (Rule 7
especially) is a first cut. Settled when the Part B requirements sketch
(epic P4.1) is written.

**Ink:** the per-vessel fact record does not change. Part B reads a
*situation*: a tuple of fact records, relative geometry, and history. Every
existing entry is a `display` norm with one subject. Additive; nothing
published is repointed.

**Ink:** the engine evaluates the three decidable categories and monitors
`conduct`. `care` and `meta` norms are in the data to be cited, listed as
covered, and shown to a reader — never evaluated.

## 3. Invariants, in levels `✎ levels`

An invariant is what the rules are *for*. It is not in the rules. There is
more than one, and they are not equal:

1. **Hard** — no collision. Two hulls never occupy the same water.
2. **Safe** — separation stays above a distance *d*. `✎` fixed distance to
   start; time-to-CPA falls out of the time-budget proxy in §5 and need not
   be in the invariant.
3. **Rule-level** — each `conduct` rule's own promise, e.g. Rule 17: the
   stand-on vessel does not alter until the give-way vessel has clearly
   failed. Violating one of these is not a collision; it is where a
   later collision is set up.
4. `✎` further levels as they earn a place — procedural (a manoeuvre was
   signalled), physical (a manoeuvre was feasible given turning circle).

`✎ levels` — the number and names of levels are provisional. Settled when
the first TLA+ model needs to state one and finds the list wrong.

## 4. The Rule 2 region

**Ink:** Rule 2(b) is not evaluated. It is *computed offline* as a region:

> the set of situations from which every rule-compliant continuation
> violates a level-1 or level-2 invariant.

A model checker finds witnesses to that region as traces. The region,
rendered as vessels and positions, is the artifact humans study. It is
the epic's M4 milestone under its real name.

**Ink:** at runtime, the engine's outputs are identical with and without
any human assertion of danger, except for status labels. The engine never
generates a departure. This is the runtime guard rail; it is a checkable
property and it is the same thing the CMI position paper says the law
requires (§7).

**Ink:** 2(a) is a `care` norm that never fires; its home is the output
contract — every result is a lower bound on the duty of care.

## 5. Tractability of the Rule 2 region `✎ whole section`

Once the region is found, the question is how hard each situation in it is
for a human. Two questions stacked: does a solution exist at all
(formal), and how findable is it (human). Working tiers:

1. a human could reasonably find a solution in the moment, under duress;
2. a human could find it with time, but not under duress;
3. a human would likely fail even with time — every solution is
   counterintuitive or surprising;
4. no known solution, provably or most likely.

Formal tools cannot label the tiers directly. They can compute proxies per
situation, which is what makes a fuzzy estimate honest:

- **solution count** — how many distinct safe actions exist from the state;
- **time budget** — seconds until the last safe action closes;
- **rule violation required** — every safe action breaks a rule; this *is*
  Rule 2 by definition, and where "surprising" lives;
- **counterintuitive action** — turns toward the threat, speeds up;
  flagged by the model, labelled by a human.

`✎` — tiers, proxies, and any thresholds are the research programme, not
a design decision. Expect: TLA+ with a coarse clock finds candidates
cheaply; it cannot prove no escape existed. Proving a state is unwinnable
needs the physics (turning circle, stopping distance, reaction time) and
is a KeYmaera-style job, one or two cases at most.

## 6. Data shape `✎ field names`

Today's entry with three fields added, defaults keeping every existing
entry valid unchanged:

```
norm = { id, jurisdiction, cite,
         category:  display | precedence | classification | conduct | care | meta   (default display)
         subjects:  1 | 2                                                          (default 1)
         when:      predicate over the subjects' facts and the situation          (as today)
         effect:    category-specific payload; today's `lights` is the display payload
         modality:  shall | may | shall-if-practicable | conditional | exempt | shall_not  (shall_not new)
         relations: today's five, plus  rel:overrides }
```

`rel:overrides` is the one new relation: 13 overrides 18 when overtaking;
2(b) overrides all. It is the superiority relation of defeasible logic and
what a solver checks for cycles and for two `shall` norms with no override
between them.

Invariants get their own file, not a norm record: they are not rules.
`✎` file name and schema.

## 7. Outside validation (one research pass, partial)

- **CMI position paper on unmanned ships** (read at source):
  <https://comitemaritime.org/wp-content/uploads/2018/05/CMI-Position-Paper-on-Unmanned-Ships.pdf>.
  "Rule 2 ... requires contemporaneous human judgement in the decision
  making loop ... unsupervised ships would fall foul of Rule 2." Backs §4's
  guard rail.
- **Krasowski & Althoff (IEEE IV 2021)** and the 2024 follow-up could not
  be read at source. Search-level evidence: Rule 2 is out of their scope.
  Unconfirmed; re-check with the PDF in hand.
- **Rule 18** uniformly described as a total order NUC > RAM > CBD > fishing
  > sailing > power > seaplane, with 9/10/13 overriding. No formalisation
  found.
- **No published taxonomy of rule categories, and no published tractability
  taxonomy of the Rule 2 space, was found.** §2 and §5 would be establishing
  them. The ADR must argue them from the rule text, not cite precedent.

## 8. Sequence, if approved

1. ADR-0005 in `colregs`: §2, §3, §4 ink, §6; amends REQ-PART-4. *Mark
   approves this file.* Opus 5, medium.
2. Rules 1–3 text into `rules.json`, verbatim, same provenance as Part C.
   Sonnet 5, low.
3. Rule 2 norm records and the judgment-fact class (`inferable: false`).
   Sonnet 5, low. Depends 1.
4. Engine output envelope: category, `subject_to`, 2(a) notice. Sonnet 5, low.
5. Rule 18 as the first `precedence` set, with the situation record and
   `rel:overrides`. First real test of §6. Opus 5, medium. Depends 1.
6. Rules 13–15 `classification`, feeding epic P2.2. Sonnet 5, medium.
7. `conduct`, invariants file, the Rule 2 region: epic phase 4, with §5 as
   its stated goal.

Steps 2–4 run in parallel as subagents once 1 is approved.
