# Proposal v4 — rule categories, invariants, and the Rule 2 region

Draft for Mark, 2026-09-04. Not implemented. Approved parts become
ADR-0005 in the `colregs` data repo (amending REQ-PART-4) and `docs/model.md`
in `colregs-engine`. Supersedes v3. Reviews of v1–v3 are in
`docs/proposals/reviews/`.

**Ink and pencil** (`docs/conventions.md`): **ink** changes only on
significant evidence, Mark decides; **pencil** `✎` iterates freely and names
what settles it; **open** `?` has no position yet.

**Applied after codex's v4 review** (approve with changes, under terms that
required a paste-ready fix per finding): Rules 5 and 7(a) say "shall" and
are `conduct`, monitored over a trace; `care` is 2(a) alone. R1 is restated
as a model finding that bears on 2(b), not a legal classification, with the
adversary quantified over strategies. `inconclusive-in-model` is a query
result, not a region.

**What changed from v3**, after codex (redesign) and Gemini (approve with
changes) reviewed it:

- 13(a) listed once, as `classification`; its effect on Rule 18 is a
  `rel:overrides` relation, not a second category. 14(c) is
  `classification`. 1(b)–(e) are `scope`. Rule 22 is `standard`.
- Status alphabet renamed to say what the model knows, not what the law
  concludes: `model-rule-conflict` (R1), `no-robust-policy-in-model` (R2),
  `inconclusive-in-model` (solver incomplete), `not-flagged`.
- "Advisories, possibly none" was a contradiction for R1: R1 *means* an
  escape was found. Advisories are ranked, best margin first, and carry an
  uncertainty envelope.
- Guard rail restated: humans correct *facts* (they always could); no human
  *danger* assertion changes the outputs.
- Horizon *T* and the terminal condition join the adversary in the pencil
  block; a sensitivity matrix is owed before the ontology moves to ink.
- Tool adequacy demoted to pencil. R2 is tier 4 *in the model*, not a claim
  about human recovery.

**What changed from v2**, after two outside reviews (codex; Gemini 3.1 Pro):

1. Partition fixed again: 1(a) is `scope`; 8(f) is `precedence`; 20(b)–(c)
   and 3(k)–(l) appear once each. Rules 4–10 apply in *any* visibility;
   only Section II (11–18) is gated on being in sight, Section III (19) on
   not being in sight.
2. The Rule 2 region has a game signature and **two clauses**: compliance
   fails *and* a non-compliant escape exists. That splits the region into
   *departure required* and *unwinnable within the model*, which is the
   ontology Mark asked for.
3. **Mark's ruling on outputs:** in the region the engine emits a Rule 2
   banner *and* the computed escape advisories, possibly none. An advisory
   is not a prescription. Liability hedging is not a design input; the
   README and licence already say this is not for navigation.
4. The status label `ordinary` is gone; it read as "rules sufficient". Now
   `not-flagged`, and every output carries model version and bounds.
5. Rule 17 is not a clock (three reviewers). Time budget is a model-derived
   proxy; 17(b)'s spatial threshold is one landmark on it.
6. Demoted to pencil: "2(b) is a duty" (needs the cases read, not
   advocacy); the relative-frame state count; "computed offline".

## 1. What this is for

The light rules were chosen first because they are easy: one vessel's facts
in, a display out. The movement rules are not easy, and Rule 2 exists
because the 1972 drafters knew no rule set covers every situation. The
research question:

> **Where do the rules, followed correctly, still fail — and how hard is it
> for a human to recover there?**

Formal methods find the first half. Humans, reviewing what the tools found,
answer the second. This is a research and education tool. It is not
navigation equipment, and the README and licence say so; nothing below
repeats that inside the engine's behaviour.

## 2. Rule categories `✎ term`

Every *paragraph* carries exactly one category. The category fixes what the
norm reads and what it produces. The verification column is pencil.

| category | paragraphs (first cut) | reads | produces | software decides? | verified by `✎` |
|---|---|---|---|---|---|
| `definition` | 3, 21 | — | vocabulary | n/a | traceability |
| `standard` | 22, Annex I | — | technical values (ranges, heights) | n/a | already `lights.json`/`geometry.json` |
| `scope` | 1(a)–(e), 4, 11, 19(a), 20(b)–(c) | visibility; whether in sight; jurisdiction | which sections apply | yes | Section II gated on in-sight, III on not-in-sight; I and Part C ungated |
| `display` | 20(a),(d)–(e), 21–31 | one vessel's facts | signals + modality | yes | enumeration → Z3 → Rocq (existing ladder) |
| `classification` | 7(d), 12, 13(a)–(c), 14, 15 | relative geometry, 13(d) history | encounter type, risk of collision | yes | Alloy partition |
| `precedence` | 18(a)–(f), 8(f), 9(b)–(d), 10(i)–(j) | two vessels' facts + encounter type | give-way / stand-on / shall-not-impede / none | yes | Alloy or Z3: never both stand-on |
| `conduct` | 5, 6, 7(a)–(c), 8(a)–(e), 9(a),(e)–(g), 10(a)–(h),(k)–(l), 16, 17, 19(b)–(e) | encounter + role + phase + kinematics + observation record | obligated or prohibited action | as a monitor over a trace | TLA+, STL |
| `care` | 2(a) | anything | residual responsibility | no | represented, never independently evaluated |
| `meta` | 2(b) | the region state (§4) | banner + advisories | computed, §4 | game solver + human review |
| `?` | Part D (32–37) | event-triggered | — | — | blocked on REQ-PART-3's ADR |

Notes:

- **1(b)–(e)** are `scope`: they are the paragraphs the shipped jurisdiction
  dimension (ADR-0001/2) implements. **1(c)** also binds `display` directly
  (additional lights must not be mistakable) and gets a drift-test line.
- **13(a)** is classification; that the overtaking vessel keeps clear
  regardless of Rule 18 is `rel:overrides` from 13 to 18, a relation, not a
  second category. One category per paragraph holds because dual roles are
  relations.
- **7(d)** is the constant-bearing test (7(d)(i)) and the large-vessel /
  close-range caveat (7(d)(ii)). 7(c), no assumptions on scanty
  information, is `conduct`.
- **Rule 18** is a partial order: NUC and RAM unordered; 18(d) and 8(f) are
  shall-not-impede; 8(f)(iii) restores full Section II duties once risk of
  collision exists; 18(f) WIG keeps clear of everything.
- **"Except where Rules 9, 10 and 13 otherwise require"**: `rel:overrides`
  carries all three.

`✎ term` — "category" (kind, type, flavour, charge). Settled by Mark.
`✎ membership` — first cut; settled paragraph by paragraph in epic P4.1.

**Ink:** the per-vessel fact record does not change. Part B reads a
*situation*: two fact records, a kinematic state per vessel (position,
heading, speed, rate of turn, plus a dynamics class), relative geometry,
and history. Kinematic state is a new fact class, not a change to the
existing one.

**Ink:** the engine evaluates `scope`, `display`, `classification`,
`precedence`; monitors `conduct`; represents but never independently
evaluates `care`.

## 3. Invariants, in levels `✎ levels`

1. **Hard** — no collision. Needs hull extent and continuous time; a
   discrete-step model tunnels through crossings.
2. **Safe** — separation above *d*. `✎` fixed *d* to start.
3. **Rule-level** — each `conduct` rule's own promise (Rule 17: stand-on
   holds until give-way has clearly failed). Carries `jurisdiction`.
4. `✎` further levels as they earn a place: procedural, physical.

**Ink:** a dynamics model is a prerequisite of levels 1–2 and of §4.
Minimum: planar kinematics, bounded turn rate and acceleration, per
*dynamics class* (tanker, ferry, yacht…), so the region is computed per
class pair, not once for all shipping. `✎` the model and the class list.

## 4. The Rule 2 region

**Ink:** Rule 2 is not evaluated at runtime as a predicate. It is a
*region* of situation space found by a game solver, and the engine reports
region membership with whatever escapes the solver found.

**Game signature** `✎ every parameter`: two players, own and other; horizon
*T* with a terminal condition (a controlled-invariant clearance state, so
"safe" is not "collision postponed past *T*"); action cadence Δt; own actions bounded by the dynamics class;
information: full (v1 assumption; partial information is the known next
step and may move the region more than anything else); other-vessel
admissible set *A*.

**Ink, the ontology.** Let `Safe(s, σown, σother)` mean no level-1/2
violation within *T*, and *A* the declared set of admissible other-vessel
strategies. For a situation *s*:

| region | definition | meaning |
|---|---|---|
| **R0 rules-suffice** | ∃ compliant σown ∀ σother ∈ A: Safe | a compliant robust policy exists in this model |
| **R1 departure-required-in-model** | ¬R0 ∧ ∃ σown ∀ σother ∈ A: Safe | every robust safe policy breaches at least one Rules 4–19 constraint |
| **R2 unwinnable-in-model** | ¬∃ σown ∀ σother ∈ A: Safe | no robust safe policy exists in this model; Mark's tier 4, or a model artifact |

"Compliant" means satisfying the encoded Rules 4–19 constraints; Rule 2
is not in that predicate, or the definition is circular. R1 is a model
finding that supplies evidence relevant to Rule 2(b), not a legal
classification. In R1 the tools can say *what* the escape is and which
paragraphs it breaches; in R2 they can only say no robust escape was
certified.

`✎ adversary and horizon` — *A* is computed two ways from the start:
other vessel rule-compliant (the rules' own failures) and arbitrary within
physics (the Rule 17(b) world, give-way has already failed). *T* is
co-dependent: too short hides R1/R2 behind the horizon, too long explodes
the game. A parameter-sensitivity matrix over *A*, *T*, *d* and the
information assumption is owed before the ontology moves to ink; the claim
that partial information moves the region most is a guess until then.

`✎ tools` — TLC finds candidates (one compliant trace that collides); it
decides nothing about region membership. Membership is a two-player timed
game; UPPAAL TIGA/STRATEGO are the candidates, KeYmaera X for the few cases
that need real dynamics. Whether the hybrid, partial-information game is
representable soundly in any of them is unproven; settled by a benchmark
with certified bounds. Candidate traces, rendered as vessels, are what
humans study regardless (epic M4).

`✎ offline vs runtime` — v2 said "computed offline". Per dynamics-class
pair and under partial information that may not scale. Settled by the
first two-vessel computation's cost.

**Ink, outputs in the region.** The engine queries the region grid the
solver produced. A query returns exactly one certified result: R0
(`not-flagged`), R1, R2, or `inconclusive-in-model`; only certified R1 and
R2 raise the Rule 2 banner. In R1 or R2 the engine returns:

1. a Rule 2 banner, citing 2(b), with a status that says what the model
   knows and nothing more: `model-rule-conflict` (R1) or
   `no-robust-policy-in-model` (R2);
2. the rule-derived obligations, unchanged, so the reader sees what the
   rules said;
3. **advisories**, in R1: the safe escapes the grid holds, ranked best
   margin first so the first line is the answer, each with the paragraphs
   it breaks and an uncertainty envelope on the action. In R2 the list is
   empty and says so. An advisory is information, not a prescription.
   Silence in R1 would be the wrong answer.
4. model version, dynamics class, horizon, information assumption, and any
   assumption the situation violates (out-of-domain dynamics, uncertain
   state). Provenance (epic goal 4), not hedging.

Outside the region: `status: not-flagged`, meaning "not flagged by this
model", never "rules sufficient".

**Ink, the guard rail.** Humans correct *facts*: the situation record is
theirs to fix, as the light rules' fact record always was, and a
corrected fact changes the outputs. What no human input can do is assert
*danger* and thereby change an obligation or an advisory. With `s` the
situation, `h` any danger assertion, `π` dropping labels:
`∀s ∀h h′ · π(O(s,h)) = π(O(s,h′))`. Discharged by construction. Label
alphabet fixed: `{not-flagged, model-rule-conflict,
no-robust-policy-in-model, inconclusive-in-model}`.

`✎ 2(b) as duty` — working position: where departure is necessary it is
mandatory, and the departing vessel bears the burden. Case law cited by
one reviewer (*The Bywell Castle*; *Boy Andrew v St Rognvald*) is
unverified. Settled by reading the cases. Nothing in §4 depends on it.

**Ink:** 2(b)'s override is scoped to level-1/2 invariant violations, not
a licence to drop any rule.

## 5. Tractability inside R0 and R1 `✎ whole section`

Two questions stacked: does a solution exist (formal: §4 answers it) and
how findable is it by a human. Working tiers, applied to R0 and R1:

1. findable in the moment, under duress;
2. findable with time, not under duress;
3. likely missed even with time: every solution counterintuitive.

R2 is tier 4 *in the model*: no robust policy against *A* under the
assumptions. It is not a claim that no human could recover.

Proxies per situation, all model-derived, none legal:

- **solution measure** — size of the winning control set relative to the
  admissible set, with the coordinates, grid and error bound declared.
- **time to last safe control** — from the dynamics; 17(b)'s "so close
  that collision cannot be avoided by the give-way vessel alone" is a
  landmark on this axis, not its definition.
- **violation cost** — fewest paragraphs any escape breaks (R1 only). No
  severity order among rules exists yet; when one does, a Pareto frontier
  of breached norms replaces the count.
- **counterintuitive action** — a proxy only: the winning set excludes the
  canonical actions, alteration to starboard and reduction of speed. Whether
  humans find it counterintuitive is a bridge-simulator question.

`✎ frame` — relative frame is expected to be tractable; the v2 count
(10⁴–10⁶) was a back-of-envelope guess and is owed a worksheet.

Calibration gap: casualty records almost always name a tier-1 action not
taken, so they will not calibrate tier 3. Human-reliability literature
(time-reliability curves) is the nearest prior art. Andrea Doria /
Stockholm (1956) is one reviewer's tier-3 candidate, unverified.

## 6. Data shape `✎ field names`

Additive; every existing entry, fixture and test stays valid unchanged:

```
norm = { id, jurisdiction, cite,
         category:  scope | definition | standard | display | classification
                    | precedence | conduct                                (default display)
         subjects:  1 | 2                                                    (default 1)
         when:      predicate over the subjects' facts and the situation
         lights:    unchanged for display                                   (never renamed)
         effect:    payload for non-display categories only
         modality:  shall | may | shall-if-practicable | conditional | exempt
                    | shall-not | shall-not-impede
         relations: today's five, plus rel:overrides }
```

- `care` and `meta` paragraphs are not entries; a sibling registry beside
  `known_omissions`.
- `rel:overrides` is the superiority relation; a solver checks it for
  cycles and for two `shall` norms with no override between them.
- Two-subject namespace `✎ own:` / `other:`; no such segment exists in
  `docs/identifiers.md`. Decided before Rule 18.
- Fixture format cannot carry a situation; a fixture-schema step precedes
  Rule 18.
- Invariants and the region grid get their own files; level-3 invariants
  carry `jurisdiction`. `✎` names and schemas.

## 7. Outside validation

- Seven reviews of v1–v3: three Claude subagents (formal methods;
  maritime law and seamanship; data modelling), codex, Gemini 3.1 Pro.
  Verbatim in `docs/proposals/reviews/`. Every v1→v2→v3 change traces to
  one of them or to Mark.
- CMI position paper on unmanned ships (2018, p. 14, verified): advocacy
  supporting §4's human-review framing; not law.
- Krasowski & Althoff (IEEE IV 2021): not read at source; Rule 2 appears out
  of scope. Unconfirmed.
- No published taxonomy of rule categories or of the Rule 2 space found.
  §2, §4 and §5 would be establishing them, argued from the rule text and
  tested by building.

## 8. Sequence, if approved

1. **ADR-0005 in `colregs`**: §2, §3, §4 ink, §6; amends REQ-PART-4. *Mark
   approves this file.* Opus 5, medium.
2. **Rules 1–19 text into `rules.json`**, verbatim. Sonnet 5, low.
3. **Registry for `care`/`meta`**, Rule 2 records, kinematic fact class.
   Sonnet 5, low. Depends 1.
4. **Engine output envelope**: category, status alphabet, provenance
   fields. Sonnet 5, low.
5. **Two-subject namespace + situation fixture schema.** Opus 5, medium.
   Depends 1. Blocks 6.
6. **`scope` and Rule 18** as the first two-subject sets, `rel:overrides`
   for 8(f), 9, 10, 13. Opus 5, medium.
7. **7(d), 12–15 `classification`**, feeding epic P2.2. Sonnet 5, medium.
8. **Dynamics classes, invariants file, `conduct`, the R0/R1/R2 grid**:
   epic phase 4, with §4's ontology as the stated goal.

Steps 2–4 run in parallel as subagents once 1 is approved.
