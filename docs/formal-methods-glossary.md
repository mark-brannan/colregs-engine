# Formal methods glossary — for the colregs / colregs-engine verification track

Written 2026-09-04. Plain-language, one paragraph each, in the order you'd
meet them. Companion: [formal-methods-reading-list.md](formal-methods-reading-list.md).

## Key concepts

- **Formal semantics.** Giving a language's constructs one exact,
  unambiguous mathematical meaning — no "it depends," no reading between
  the lines, no two people implementing the same sentence differently.
  This isn't a tool of its own; it's what every entry below is actually
  doing. TLA+ gives "Rule 17 phase" a formal semantics; Gallina gives the
  evaluator one. Once that clicks, the rest of this glossary is just:
  which language, which tool, which tradeoff.
- **Specification (spec).** A precise statement of what a system must do,
  separate from any code that does it. `docs/requirements.md` in colregs is a
  prose spec; a TLA+ module or a Rocq theorem is a formal one.
- **Formal methods.** Any technique that turns "we tested it" into "we
  showed it mathematically". Three families: **model checking** (explore
  every state of a small model), **SMT/SAT solving** (ask a solver whether a
  logical formula can be satisfied), and **theorem proving** (write a proof a
  machine checks). Each trades convenience for strength in a different way.
- **Invariant.** A property that must hold in every reachable state. "No two
  `shall` entries conflict for one vessel" is an invariant of the colregs data.
- **Safety vs. liveness.** Two shapes a property can take. A safety property
  says a bad thing never happens — an invariant is a safety property.
  A liveness property says a good thing eventually happens — "the give-way
  vessel eventually gives way," not just "never caught failing to at any one
  instant." Rule 17 phase transitions are liveness claims; checkers verify
  the two differently.
- **Counterexample.** What a checker gives you when a property fails: a
  concrete state or trace that violates it. Usually the most valuable output
  of the whole exercise, because it is a bug you can read.
- **Soundness.** A tool is sound if it never says "proved" when the property
  is false. **Completeness** is the reverse: never says "can't prove" when it
  is true. Sound tools are the ones you can trust; complete ones are rare.
- **Abstraction.** Deliberately leaving detail out of a model so a checker
  can handle it — modelling "vessel A is give-way" instead of "vessel A is
  at bearing 047° doing 6.2 kt." Keep only what the property you're
  checking actually depends on; that's what makes the model small enough
  to check at all.
- **Refinement.** The reverse of abstraction, made rigorous: showing a more
  detailed model (or the real code) never does anything the abstract spec
  forbade. Done properly, this is the model–implementation gap closed as a
  proof instead of left as a gap — see the next entry.
- **Model–implementation gap.** A proof is about the model, not the code.
  Unless the code is extracted from the model or checked against it
  (conformance testing), the proof says nothing about what ships.

## Enumeration and solvers

- **Exhaustive enumeration.** Try every input. Only possible when the input
  space is finite and small enough; the colregs fact record is, after
  partitioning.
- **Equivalence partitioning.** If the code only ever asks "is length ≥ 12",
  then 11.9, 12 and 12.1 stand for whole ranges. Testing one value per range
  plus each boundary covers every behaviour. This is what makes enumeration
  a proof rather than a sample, and it is itself a lemma worth proving.
- **SAT (Boolean satisfiability).** Take a formula built only from
  true/false variables and AND/OR/NOT — is there some way to set the
  variables so the whole thing comes out true? That's the entire
  question. Sounds trivial for a handful of variables; for millions,
  it's one of the hardest problems in computer science (NP-complete,
  the canonical one), and yet modern
  solvers crack real instances of that size in seconds.
- **SMT (Satisfiability Modulo Theories).** SAT, but you get real
  building blocks instead of just true/false — numbers, comparisons,
  arrays, strings. So instead of encoding "length ≥ 12" as a pile of
  boolean variables, you write `length_m >= 12 ∧ ¬(length_m < 7)`
  straight into the formula and hand it to the solver. You ask it a
  yes/no question about the colregs predicates — "can two `shall`
  entries both fire for one vessel?" — and it answers yes, with a vessel
  that proves it, or no.
- **Z3.** Microsoft Research's SMT solver, and the default choice — free,
  fast, and the one every other tool here quietly calls underneath (Dafny
  uses it; so does most SMT-backed work in Rocq and Lean). You don't run it
  by hand so much as hand a predicate to something built on it.
- **Alloy.** A lightweight relational modelling language plus a bounded
  checker. Good for structure, sets and relations, with a visualiser that
  draws the counterexample. Encounter-sector classification fits it.

## Model checking and time

- **Model checking.** Build a small abstract model of the system as a state
  machine, state a property, let the tool explore every reachable state.
  Finds bugs you would never construct by hand.
- **State-space explosion.** The reason a model checker can grind to a halt
  or run out of memory: every extra vessel, flag, or variable multiplies
  the number of states it has to visit. Two vessels crossing is small; a
  five-vessel encounter with speed buckets isn't. This is what makes
  Abstraction necessary rather than optional.
- **TLA+** (Temporal Logic of Actions). Lamport's language for specifying
  systems as state machines; **TLC** is its model checker, **PlusCal** a
  friendlier algorithm-shaped syntax that compiles to TLA+. Amazon Web
  Services (AWS) used it on S3 and DynamoDB. Right for protocols and phase
  machines: who is give-way, what Rule 17 phase we're in.
- **Temporal logic.** Logic with time operators: *always*, *eventually*,
  *until*. **LTL (Linear Temporal Logic)** is over discrete steps; **STL
  (Signal Temporal Logic)** adds real-valued time and signals, so "within
  60 s the range must exceed 0.5 nm" is expressible. STL is what the
  maritime literature uses.
- **Runtime monitoring.** Evaluate a temporal-logic formula against a live
  or recorded trace and report the instant it goes false. This is how a
  simulator shows a rule breaking.
- **RTAMT.** A Python library that checks an STL formula against a
  recorded signal trace and hands back the point it went false. No model,
  no proof — just a monitor bolted onto a simulator run.
- **Breach.** The MATLAB/Simulink equivalent of RTAMT: same STL-monitoring
  job, but in a toolchain most maritime and controls papers already run
  in, so it shows up more often in that literature than RTAMT does.
- **Timed automata.** State machines with real clocks and a checker for
  them. Right when the question is "must act before the clock hits
  stopping-distance".
- **UPPAAL.** The tool for timed automata — a modeller plus a model
  checker for state machines with clocks, from Uppsala/Aalborg. You draw
  the automaton, add clock guards ("only fire if `t < 30`"), and it
  explores every timed trace the way TLC explores untimed ones.
- **Hybrid systems.** Systems mixing discrete decisions with continuous
  physics (a ship turning). **KeYmaera X** proves properties of these using
  **differential dynamic logic (dL)**. It is the tool for "the physics plus
  the rule", where TLA+ only does the rule.

## Theorem proving

- **Proof assistant / interactive theorem prover.** You write definitions
  and a proof; the machine checks every step. Nothing is assumed. Slow to
  write, absolute when done.
- **Rocq** (formerly **Coq**, renamed 2025). The most established proof
  assistant. Three layers you'll meet: **Gallina** is its programming and
  specification language, in which you write the functions and theorems;
  **Ltac** is its tactic language, the commands that build a proof step by
  step; **extraction** turns a Gallina function into runnable **OCaml** (or
  Haskell) code that is guaranteed to behave as the proved one.
- **OCaml.** A functional programming language from the **ML family**
  (ML here means "Meta Language," a 1970s lineage of typed functional
  languages — nothing to do with machine learning) and the language Rocq
  itself is written in. Extraction targets it; **js_of_ocaml** then
  compiles OCaml to JavaScript, which is how a proved function could end
  up inside a Node package.
- **Haskell.** Another ML-family functional language, purer than OCaml
  (no side effects without saying so in the type). Rocq's other
  extraction target — same role as OCaml above, less used for this
  project since the ship-to-JS path runs through OCaml.
- **Lean 4.** The other mainstream proof assistant, younger, with the
  strongest AI-assisted proving today and its own compiler instead of
  extraction. Same ideas, different ecosystem.
- **Isabelle/HOL** (Higher-Order Logic). The third; what the
  Foster/Gleirscher maritime verification papers use.
- **Dafny.** Not a proof assistant but a programming language with built-in
  verification: you write pre/postconditions and the compiler proves them
  with Z3 underneath. Cheaper than Rocq, less expressive.
- **Verified evaluator.** The plan's expensive step: write the colregs
  evaluator in Gallina, prove it total, deterministic and conformant to the
  data, extract to OCaml → JS, ship that. The shipped code is then generated
  from a proof rather than merely tested against one.
- **Lemma / theorem.** Same thing at different sizes; a lemma is a step
  toward a theorem. The partition-soundness statement above is the lemma
  that makes the enumeration test a proof.
