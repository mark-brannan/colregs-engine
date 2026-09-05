# Proposal v2 — rule categories, invariants, and the Rule 2 region

Draft for Mark, 2026-09-04. Not implemented. Approved parts become
ADR-0005 in the `colregs` data repo (amending REQ-PART-4) and `docs/model.md`
in `colregs-engine`. Supersedes v1 (`2026-09-04-rule-kinds.md`), which is kept
for the diff.

**Ink and pencil.** Every decision carries a confidence level, and the level
is the rule for reopening it (`docs/conventions.md`):

- **Ink** — change only on significant evidence. A session may argue, citing
  evidence; Mark decides. Sessions never edit ink.
- **Pencil** `✎` — iterate freely over many sessions; log the change; each
  item names what would settle it.
- **Open** `?` — no position yet.

**What changed from v1**, after three independent critical reviews (formal
methods, maritime law and seamanship, data modelling):

1. Categories are assigned per *paragraph*, not per rule; v1's table was not
   a partition.
2. A `scope` category was added: Rules 4, 11 and 19 decide whether vessels
   are in sight of one another. Without it, stand-on and give-way fire in
   fog, where neither exists.
3. Rule 7(d) moved from `care` to `classification`: constant bearing and
   decreasing range is a computable test, and it is the trigger for Rules 15
   to 17.
4. `shall-not-impede` is its own modality (Rules 9, 10, 18(d)). Rule 18 is a
   partial order, not a total one. WIG craft (18(f)) added.
5. Rule 2(b) is a *duty*, not a permission, where departure is necessary.
   The engine gains an explicit abstention output instead of silence.
6. The Rule 2 region is defined as a controllability problem, with the
   physics model as an ink prerequisite and the adversary's admissible set
   in pencil.
7. The CMI position paper is cited as advocacy supporting a design choice,
   not as law.
8. The data shape keeps the `lights` key unchanged; `effect` is used only by
   non-display categories. Two-vessel predicates and fixtures get a schema
   step before Rule 18.

## 1. What this is for

The light rules were chosen first because they are easy: one vessel's facts
in, a display out. The movement rules are not easy, and Rule 2 exists
because the 1972 drafters knew no rule set covers every situation. The
research question is not "how do we evaluate Rule 2" but:

> **Where do the rules, followed correctly, still fail — and how hard is it
> for a human to recover there?**

Formal methods find the first half. Humans, reviewing what the tools found,
answer the second. Everything below serves that.

## 2. Rule categories `✎ term`

Every *paragraph* carries exactly one category. The category fixes what the
norm reads and what it produces. The verification-method column is pencil:
it is a plan, and no published taxonomy exists to borrow from.

| category | paragraphs (first cut) | reads | produces | software decides? | verified by `✎` |
|---|---|---|---|---|---|
| `definition` | 1(a), 3, 21, 22 | — | vocabulary | n/a | traceability |
| `scope` | 4, 11, 19(a), 20(b)–(c), 3(k)–(l) | visibility, whether in sight | which section of Part B applies | yes | every `precedence`/`classification`/`conduct` norm is gated on it |
| `display` | 20–31 | one vessel's facts | signals + modality | yes | enumeration → Z3 → Rocq (existing ladder) |
| `classification` | 7(d), 12, 13(a)–(c), 14(a)–(b), 15 | relative geometry, 13(d) history | encounter type, risk of collision | yes | Alloy partition |
| `precedence` | 18(a)–(f), 9(b)–(d), 10(i)–(j), 13(a) effect | two vessels' facts + encounter type | give-way / stand-on / shall-not-impede / none | yes | Alloy or Z3: never both stand-on |
| `conduct` | 6, 7(b)–(c), 8, 9(a),(e)–(g), 10(a)–(h),(k)–(l), 14(c), 16, 17, 19(b)–(e) | encounter + role + phase + time + kinematics | obligated or prohibited action | as a monitor over a trace | TLA+, STL |
| `care` | 2(a), 5, 7(a) | anything | factors only | no | not verifiable; represented, never evaluated |
| `meta` | 2(b) | the invariant state (§4) | departure required | offline only, §4 | game solver + human review |
| `?` | Part D (32–37) | event-triggered | — | — | blocked on REQ-PART-3's ADR |

Notes on the cut:

- **1(b)–(e)** are the basis of the jurisdiction dimension already shipped
  (ADR-0001, ADR-0002). They are not `meta`. **1(c)** binds the `display`
  corpus directly (additional lights must not be mistakable for prescribed
  ones) and should get a drift-test line.
- **Rule 18** is a partial order: NUC and RAM are unordered with respect to
  each other; 18(d) is shall-not-impede, not give-way; 8(f)(iii) preserves
  full Section II duties once risk of collision exists; 18(f) WIG craft
  keeps well clear of everything.
- **"Except where Rules 9, 10 and 13 otherwise require"** disapplies 18 by
  imposing shall-not-impede (9, 10) or by making the overtaking vessel keep
  clear regardless of category (13). So `rel:overrides` carries all three.

`✎ term` — "category" is provisional (kind, type, flavour, charge). Settled
by Mark; consistent use makes the rename mechanical.

`✎ membership` — the paragraph assignments above are a first cut. Settled by
the Part B requirements sketch (epic P4.1), paragraph by paragraph.

**Ink:** the per-vessel fact record does not change. Part B reads a
*situation*: two fact records, a kinematic state per vessel (position,
heading, speed, rate of turn), relative geometry, and history. The
kinematic state is a new fact class, not a change to the existing one.

**Ink:** the engine evaluates `scope`, `display`, `classification` and
`precedence`; monitors `conduct` over a trace; never evaluates `care`.
`meta` is computed offline (§4), never at runtime.

## 3. Invariants, in levels `✎ levels`

An invariant is what the rules are *for*. It is not in the rules. There is
more than one, and they are not equal:

1. **Hard** — no collision. Requires hull extent and continuous time to
   state; a discrete-step model tunnels through crossings.
2. **Safe** — separation stays above a distance *d*. `✎` fixed *d* to start.
3. **Rule-level** — each `conduct` rule's own promise, e.g. Rule 17: the
   stand-on vessel holds until the give-way vessel has clearly failed.
   Carries a `jurisdiction`, because Part B numbering and text diverge
   between `intl` and `us/inland` (requirements Q-8).
4. `✎` further levels as they earn a place: procedural (a manoeuvre was
   signalled), physical (a manoeuvre was feasible).

**Ink:** a dynamics model is a prerequisite of levels 1–2 and of §4, not
an afterthought. Minimum: planar kinematics with bounded turn rate and
bounded acceleration per vessel. `✎` the exact model.

## 4. The Rule 2 region

**Ink:** Rule 2(b) is a duty. "Due regard *shall* be had … which may make a
departure … necessary": where departure is the only way to preserve the
invariant, departing is mandatory, and the vessel invoking it bears the
burden. 2(a) is a savings clause that applies precisely when the rules
were obeyed: compliance never exhausts the duty of care. Neither is
evaluated at runtime.

**Ink:** the Rule 2 region is computed offline. Definition, as a
controllability problem:

> A situation *s* is in the region if, for every own-vessel strategy that
> stays within Rules 4–19 (2(b) excluded, or the definition is circular),
> there exists an admissible other-vessel behaviour under which a level-1 or
> level-2 invariant is violated.

`✎ adversary` — what "admissible other-vessel behaviour" means is the
biggest open choice: rule-compliant only (the region of the rules'
*own* failures), or arbitrary within physics (the Rule 17(b) world, where
the give-way vessel has already failed). Both are interesting; they are
different regions. Settled by computing both on the first two-vessel model
and seeing which one humans want to look at.

**Ink on tools:** TLC finds *candidates* (one compliant trace that
collides). It cannot prove no escape existed; that is a two-player timed
game and needs a game solver (UPPAAL TIGA or STRATEGO) with KeYmaera X for
the one or two cases that need real dynamics. Candidate traces, rendered as
vessels and positions, are the artifact humans study. This is the epic's
M4 milestone under its real name.

**Ink, the runtime guard rail:** the engine's obligations are a function of
the situation alone; no human assertion of danger is an input to them.
Formally, with `O(s, h)` the output for situation `s` under human input `h`
and `π` the projection that drops status labels:
`∀s ∀h h′ · π(O(s,h)) = π(O(s,h′))`. Discharged by construction: `h` is not
an argument of the evaluator. The label alphabet is fixed in ink so the
property is not vacuous: `status ∈ {ordinary, rules-insufficient}`.

**Ink, abstention:** when `s` is in the precomputed region, the engine
returns its obligations with `status: rules-insufficient` and the citation
2(b). It never prescribes the departure. Silence in the region would be
the wrong answer; a labelled abstention is the right one. `✎` how the
runtime looks the region up (table, classifier, not at all in v1).

**Ink:** 2(b)'s override is scoped to level-1 and level-2 invariant
violations. It is not the top of a lattice from which any rule may be
dropped.

## 5. Tractability of the Rule 2 region `✎ whole section`

Two questions stacked: does a solution exist at all (formal), and how
findable is it by a human (empirical). Working tiers:

1. a human could reasonably find a solution in the moment, under duress;
2. a human could find it with time, but not under duress;
3. a human would likely fail even with time — every solution is
   counterintuitive or surprising;
4. no known solution, provably or most likely.

Tools cannot label the tiers. They can compute proxies per situation:

- **solution measure** — the volume of the winning control set, normalised
  by the admissible set. (A *count* is discretisation noise: halve the
  heading grid and it doubles.)
- **time budget** — derived from Rule 17's own stages: 17(a)(i) hold,
  17(a)(ii) may act, 17(b) must act. The law already defines the clock;
  use it rather than inventing thresholds.
- **violation cost** — the number of paragraphs the cheapest escape breaks.
  ("Some violation is required" is the region's membership test, §4, and
  discriminates nothing inside it.)
- **counterintuitive action** — defined syntactically: the winning set
  excludes the COLREGS-canonical actions (alteration to starboard, reduction
  of speed). Flagged by the tool, labelled by a human.

**Ink:** the model works in a relative frame. In absolute coordinates the
joint state space is on the order of 10¹²; relative, 10⁴–10⁶.

Calibration gap, stated plainly: casualty investigations almost always
identify a tier-1 action not taken, so the record will not calibrate tiers
3–4. Human-reliability literature (time-reliability curves, THERP/HEART)
is the nearest prior art. Andrea Doria / Stockholm (1956) is the one
candidate tier-3 case named by a reviewer; **unverified**.

## 6. Data shape `✎ field names`

Additive to today's entry. Every existing entry, fixture and test stays
valid unchanged:

```
norm = { id, jurisdiction, cite,
         category:  scope | display | classification | precedence | conduct   (default display)
         subjects:  1 | 2                                                    (default 1)
         when:      predicate over the subjects' facts and the situation    (as today for 1 subject)
         lights:    unchanged for display                                   (never renamed)
         effect:    payload for non-display categories only
         modality:  shall | may | shall-if-practicable | conditional | exempt
                    | shall-not | shall-not-impede                          (last two new)
         relations: today's five, plus rel:overrides }
```

- `care` and `meta` paragraphs are **not** entries. They go in a sibling
  registry beside `known_omissions`, so the drift test's iteration over
  `entries[]` is untouched and nothing without a predicate sits in the
  predicate table.
- `rel:overrides` is the superiority relation of defeasible logic; a solver
  checks it for cycles and for two `shall` norms with no override between
  them (the Part B version of P1.3).
- Two-subject predicates need a namespace: `✎ own:fact:activity` /
  `other:fact:activity`. No such segment exists in `docs/identifiers.md`.
  **Decided before Rule 18, not during it.**
- The fixture format asserts one fact record → entry ids. It cannot carry a
  situation (Q-5 already notes it cannot carry modality). A fixture-schema
  step precedes Rule 18 (§8).
- Invariants get their own file; they are not rules. Level-3 entries carry
  `jurisdiction`. `✎` file name and schema.

## 7. Outside validation

- **Three independent critical reviews, 2026-09-04** (formal methods; maritime
  law and seamanship; data modelling), each hostile by instruction. Their
  blockers are the v1→v2 changes listed at the top. Two verdicts on v1 were
  "redesign §2 and §4", one "approve with changes".
- **CMI position paper on unmanned ships** (2018, p. 14, quote verified at
  source): Rule 2 "requires contemporaneous human judgement in the decision
  making loop"; departure "is mandatory"; supervised autonomy "arguably
  satisfies" it. Cited as advocacy supporting the §4 design choice, not as
  law. `✎` It concerns who may navigate, not what a decision aid may print.
- **Krasowski & Althoff (IEEE IV 2021)** could not be read at source. Rule 2
  appears out of their scope. Unconfirmed.
- **No published taxonomy of rule categories, and no tractability taxonomy
  of the Rule 2 space, was found.** §2 and §5 would be establishing them,
  argued from the rule text.

## 8. Sequence, if approved

1. **ADR-0005 in `colregs`**: §2, §3, §4 ink, §6; amends REQ-PART-4. *Mark
   approves this file.* Opus 5, medium.
2. **Rules 1–19 text into `rules.json`**, verbatim, same source and
   provenance as Part C. Sonnet 5, low.
3. **Registry for `care`/`meta`**, Rule 2 records, kinematic fact class
   with `inferable: false` on nothing yet (no judgment facts in v2). Sonnet
   5, low. Depends 1.
4. **Engine output envelope**: category, `status`, 2(a) notice. Sonnet 5,
   low.
5. **Two-subject namespace + situation fixture schema.** Opus 5, medium.
   Depends 1. *Blocks 6.*
6. **`scope` and Rule 18 as the first two-subject sets**, with
   `rel:overrides` for 9, 10, 13. First real test of §6. Opus 5, medium.
7. **Rules 7(d), 12–15 `classification`**, feeding epic P2.2. Sonnet 5,
   medium.
8. **Dynamics model, invariants file, `conduct`, the Rule 2 region**: epic
   phase 4, with §4's definition and §5 as its stated goal.

Steps 2–4 run in parallel as subagents once 1 is approved.
