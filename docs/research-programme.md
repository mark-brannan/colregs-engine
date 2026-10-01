# Research programme

The long-run plan for formal verification across
[colregs](https://github.com/mark-brannan/colregs) (the data) and this engine
(the evaluator), tracked by the epic
[#1](https://github.com/mark-brannan/colregs-engine/issues/1). This file
defines the phases and the item ids the code and the colregs docs cite.
Terms: [glossary](formal-methods-glossary.md). Literature:
[reading list](formal-methods-reading-list.md).

## Thesis

Encoded as data and evaluated by a pure function, the COLREGS fail formal
verification in classifiable ways:

- **Pairwise incompleteness.** Rules written for two vessels do not compose
  for three: give-way cycles.
- **Classification boundaries.** Rule 13 against Rule 15 at 22.5° abaft the
  beam; Rule 14's "nearly reciprocal".
- **Regime transitions.** In sight of one another against Rule 19.
- **Kinematic infeasibility.** The Rule 17(b) last-moment boundary is a
  reachability set, not a distance.
- **Vague quantities.** "Ample", "substantial" and "safe speed" are
  parameters before anything about them can be checked.

Rule 2 is the drafters' defeasibility clause: a contrary-to-duty obligation,
not a get-out-of-jail card. 2(a) removes the compliance defence.

## Ground rules

- colregs is data only: requirements with stable `REQ-` ids, ADRs, gates,
  tests that cite ids. Research artefacts (enumerators, encodings, models, the
  findings register) live under `research/` here.
- The engine is a pure function. Timing, freshness and hysteresis belong to
  the switching plugin.
- Engine verification is exhaustive enumeration, not a proof assistant.
  Partitioning each numeric fact at the thresholds its predicates compare
  against (7, 12, 20, 50 and 100 m, and the like) makes the fact space finite,
  and one run checks three properties: **conformance** (engine output equals
  the data's predicate set for every record), **consistency** (no conflicting
  `shall`, every record resolves) and **coverage** (every entry fires).
- Each phase ships something useful from the current repos before the next
  starts. A phase is done when its exhaustive check runs and every
  counterexample is a registered finding; open findings are its output, never
  its blocker (ruled by Solace, [#1](https://github.com/mark-brannan/colregs-engine/issues/1)).

## Phases

An item id is `P<phase>.<n>`; tooling-track items are `T<n>`. An id, once
published, never names different work.

| id | item | where |
|---|---|---|
| | **Phase 0: exhaustive conformance.** Data bugs, dead entries, confidence in each colregs release. | |
| P0.1 | Threshold extractor and partitioned enumerator | `research/conformance` |
| P0.2 | Conformance: engine output equals the reference for every record | `research/conformance` |
| P0.3 | Consistency and coverage, each failure rendered as a vessel in prose | `research/conformance` |
| P0.4 | Traceability: every entry cites a paragraph; every switchable paragraph has an entry or an exclusion | `research/conformance` |
| P0.5 | Triage: a person rules each finding a data, engine or harness bug, or a genuine ambiguity | findings register |
| | **Phase 1: Part B data model.** The engine's classification and obligation verbs; Searoom teaching scenarios. | |
| P1.1 | Encounter classification by relative-bearing sector and visibility | colregs data, `src/` |
| P1.2 | The Rule 18 hierarchy as a partial order, checked acyclic | colregs tests |
| P1.3 | The modalities keep clear, stand on and not impede (Rule 8(f)) | `src/` |
| P1.4 | Pairwise ambiguity zones: the exhaustive harness over the two-subject entries ([#104](https://github.com/mark-brannan/colregs-engine/issues/104)) | `research/conformance` |
| | **Phase 2: multi-vessel incompleteness.** A scenario catalogue; a candidate publishable finding. | |
| P2.1 | Scene evaluation over reduced traffic ([#105](https://github.com/mark-brannan/colregs-engine/issues/105)) | `src/` |
| P2.2 | Three-vessel enumeration and the give-way cycle catalogue ([#106](https://github.com/mark-brannan/colregs-engine/issues/106)) | `research/multivessel` |
| | **Phase 3: kinematics.** | |
| P3.1 | Simple vessel dynamics, with the vague quantities as named parameters | `research/kinematics` |
| P3.2 | The Rule 17(b) envelope by numeric reachability ([#107](https://github.com/mark-brannan/colregs-engine/issues/107)) | `research/kinematics` |
| P3.3 | KeYmaera X proofs, only for specific claims worth proving | `research/kinematics` |
| | **Phase 4: temporal and regime models,** shared with the plugin's timing model ([searoom#8](https://github.com/mark-brannan/searoom/issues/8)). | |
| P4.1 | Part B invariants with stable ids | colregs `docs/part-b-invariants.md` |
| P4.2 | TLA+ two-vessel protocol: Rule 13(d) history, Rule 17 phases, the Rule 19 switch | searoom#8 |
| P4.3 | Three vessels; TLC finds the cyclic-obligation trace | searoom#8 |
| P4.4 | Timed variant (UPPAAL, or TLA+ with a clock): "ample time" against stopping distance | searoom#8 |
| | **Phase 5: simulator.** Seeing is believing; this is the skeptic's deliverable. | |
| P5.1 | Browser encounter simulator, kinematics only, fed a scripted or checker trace | searoom |
| P5.2 | Signal temporal logic monitors on the Krasowski and Althoff predicates | searoom |
| P5.3 | Replay of a checker-found breakdown, each monitor going false at the instant its rule breaks | searoom |
| | **Tooling track, never blocking.** For people who reasonably distrust "we ran a lot of tests". | |
| T1 | Z3 restatement of P0.3 over real-valued axes | `research/z3` |
| T2 | Alloy model of the P1.1 sector partition: no bearing in two sectors, or none | `research/alloy` |
| T3 | Rocq lemma that threshold-partitioned enumeration is complete, which turns Phase 0 from a test into a proof | `research/rocq` |
| T4 | Optional: the evaluator in Gallina, extracted and run as a second implementation against P0.2 | `research/rocq` |

## Findings register

- Every counterexample, from any phase, is a finding with a stable `FIND-nn`
  id. The register, its status ladder (candidate, agent-verified,
  human-reviewed, landed as a fixture, ADR or requirement) and how a finding
  climbs it: [`research/conformance/findings/`](../research/conformance/findings/README.md).
- Every finding cites paragraph paths. Case law is "see also", never a source
  a finding is inferred from.
- Agents never edit colregs `requirements.md` normatively. A normative change
  is a human decision, landed through an ADR.
- The [README](../README.md)'s statement on navigation covers every artefact
  here.

## Agent cycle

A scheduled cloud routine, running once Phase 0 has shipped.

- Each run does one bounded piece of research or verification within a fixed
  token budget, and appends what it finds to the register as candidates.
- Each run leaves one digest issue holding at most three closed questions for
  Solace, each answered yes, no or a number. Solace reviews one digest per
  cycle.
- The routine stops after N consecutive cycles with no new finding. The token
  budget and N are set in the routine's configuration.

## Siting

Research artefacts stay under `research/` here. Whether they move to a repo of
their own is decided when Phase 3 starts. colregs stays data only.
