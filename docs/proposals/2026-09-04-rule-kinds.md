# Proposal — rule kinds, the situation record, and Rule 2

Status: **draft for Mark's approval**, 2026-09-04. Once approved this
becomes ADR-0005 in the `colregs` data repo (it amends REQ-PART-4) and a
short `docs/model.md` here. Nothing below is implemented.

## The problem in one paragraph

Everything in `colregs` today is one shape: *one vessel's facts → predicate →
an obligated display, with a modality and a paragraph citation*. That shape
is right for Part C and it should not change. But Rule 2 has no predicate
and no display, Rule 18 reads two vessels' facts, Rule 17 needs history,
and Rule 5 cannot be evaluated by anything. Forcing those into the entry
model would either quietly lie (a predicate for "immediate danger") or
force a redesign of Part C. The fix is not a bigger entry; it is naming
the *kind* of norm each paragraph is, and letting each kind carry its own
input shape, output shape and verification method.

## Rule kinds

| kind | rules | reads | produces | decidable by software? | how it gets verified |
|---|---|---|---|---|---|
| `definition` | 1, 3, 21, 22 | — | vocabulary the other kinds cite | n/a | traceability (every fact value cites its definition) |
| `display` | 20–31, 32–37 | one vessel's facts (+ an event for Part D) | signal set + modality | **yes** | enumeration → Z3 → Rocq, the existing ladder |
| `precedence` | 18, with 9, 10, 13 as its stated exceptions | two vessels' facts + encounter type | role: give-way / stand-on / none | **yes** | Alloy or Z3: never both stand-on, never both give-way |
| `classification` | 12, 13, 14, 15 | relative geometry, plus 13(d) history | encounter type | **yes** (13(d) needs one bit of state) | Alloy partition: every bearing in exactly one sector |
| `conduct` | 8, 9, 10, 16, 17, 19 | encounter + role + Rule 17 phase + time | obligated / permitted / prohibited *action* | **as a monitor over a trace**, not a one-shot answer | TLA+, STL monitors (epic phases 4–5) |
| `care` | 5, 6, 7, 2(a) | anything | nothing computable; the rule lists *factors* | **no** | not verifiable; represented as text + factors, explicitly excluded from evaluation |
| `meta` | 2(b), 1(b)–(e) | a human assertion | changes the *status* of other norms | **no** — only *representable* | an architectural property (below), not a data property |

Two consequences worth reading twice:

1. **The per-vessel fact record does not change.** Part B needs a *situation*
   (own facts, other facts, relative geometry, history), and a situation is
   a tuple of the fact records we already have plus a geometry record. Every
   existing entry is a `display` norm with one subject. REQ-PART-4's
   "single-vessel by construction" becomes "single-vessel *fact record*,
   multi-vessel *situation*". Additive; nothing published is repointed.
2. **The engine only ever evaluates the three decidable kinds and monitors
   the fourth.** `care` and `meta` norms are in the data so they can be
   cited, listed as covered, and shown to a reader — and so that a
   traceability check can prove nobody tried to evaluate them.

## The generalised norm

Today's entry, with three fields added and defaults that make every
existing entry valid unchanged:

```
norm = { id, jurisdiction, cite,
         kind:      display | precedence | classification | conduct | care | meta   (default display)
         subjects:  1 | 2                                                          (default 1)
         when:      predicate over the subjects' facts and the situation          (as today)
         effect:    kind-specific payload — today's `lights` is the display payload
         modality:  shall | may | shall-if-practicable | conditional | exempt | shall_not  (shall_not is new)
         relations: today's five, plus  rel:overrides  }
```

`rel:overrides` is the one new relation and it is what makes the rest
hang together: 13 overrides 18 when overtaking; 2(b) overrides everything.
In defeasible-logic terms it is the superiority relation, and it is the
thing a solver can check for cycles and for "two `shall` norms with no
override between them" — the Part B version of P1.3's conflict check.

## Rule 2 specifically

**2(a)** is a `care` norm: obligations derived from the rules are necessary,
never sufficient. It has no predicate and never fires. Its home is the
*output contract*: every engine result carries a fixed envelope stating the
result is a lower bound on the duty of care and cites 2(a). That is a
requirement (REQ), not code.

**2(b)** is a `meta` norm with effect `defeats: all`. Its trigger,
`fact:immediate_danger`, is a new **fact class: judgment facts** —
`inferable: false`, assertion-only, with no SignalK path by design. The
engine never sets it and never reads sensors to guess it.
The engine's whole Rule 2 behaviour is:

- outputs are labelled `subject_to: ["2(b)"]` — always, unconditionally;
- if a consumer asserts `immediate_danger`, the same obligations come back
  with status `departure_permitted` citing 2(b) — and **no substitute
  action**. The engine never generates the departure; a human does.

The safety property, stated so it can eventually be proved: *for every
situation, the engine's output is identical with and without the
judgment facts, except for status labels*. Software cannot manufacture a
departure from the rules. That is the property the formal-methods safety
net should own for Rule 2; it is architectural and it is checkable.

## What I'd argue against

- **Modelling 2(b) as a predicate over sensor facts** (CPA/TCPA thresholds
  → "immediate danger"). Tempting, common in autonomy papers, and exactly the
  thing that would make this software decide when the rules stop applying.
- **Redesigning Part C entries to be "general".** The kind field with a
  default is enough; the Part C ladder proceeds untouched.
- **Starting Part B with Rule 17.** It is the interesting one, but it is
  `conduct`, the hardest kind. Rule 18 and 13–15 are decidable now, reuse the
  fact record, and give the Alloy/Z3 phases something real. Do those first.

## Sequence, if approved

1. **ADR-0005 in `colregs`** — this document, tightened; amends REQ-PART-4,
   adds REQ-KIND-1..n and the judgment-fact class. *Mark reads and approves
   this one file.* Opus 5, medium.
2. **Rule 1–3 text into `rules.json`** verbatim, same source and provenance
   as Part C. Sonnet 5, low. No design risk.
3. **Two Rule 2 norm records + `fact:immediate_danger`** in data; a test that
   `care`/`meta` norms have no `when`. Sonnet 5, low. Depends 1.
4. **Engine output envelope** (`kind`, `subject_to`, 2(a) notice) — lands
   with the Part C evaluator, wherever that is being built. Sonnet 5, low.
5. **Rule 18 as the first `precedence` norm set**, with the situation record
   and `rel:overrides` for 13. Fixtures: every ordered pair of activities.
   Opus 5, medium. Depends 1. This is the first real test of the model.
6. **Rules 13–15 `classification`**, wiring into epic P2.2. Sonnet 5, medium.
7. Rule 17 and the rest of `conduct` — epic phase 4, unchanged.

Steps 2–4 can run in parallel as subagents the moment 1 is approved.

## Outside validation (2026-09-04, one research pass — partial)

- **CMI position paper on unmanned ships** (read directly):
  <https://comitemaritime.org/wp-content/uploads/2018/05/CMI-Position-Paper-on-Unmanned-Ships.pdf>.
  "Rule 2 ... requires contemporaneous human judgement in the decision making
  loop ... unsupervised ships would fall foul of Rule 2 in its current form."
  This is the legal basis for treating 2(b) as a human-asserted override the
  engine never decides.
- **Krasowski & Althoff (IEEE IV 2021) and the 2024 safe-RL follow-up** could
  not be read at source (access wall). Search-level evidence says Rule 2 is
  simply out of their scope. **Unconfirmed; re-check when the PDF is on hand.**
- **Rule 18** is uniformly described as a total order NUC > RAM > CBD >
  fishing > sailing > power > seaplane, with 9/10/13 overriding it. No
  formalisation of the order found; practitioner sources only.
- **No published taxonomy of COLREGS rule kinds was found.** The table above
  would be establishing one, not adopting one. That raises the bar on the ADR:
  it must argue the kinds from the rule text, not cite precedent.
