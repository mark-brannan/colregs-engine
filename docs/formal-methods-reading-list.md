# Formal methods reading list — colregs track

Written 2026-09-04. Verified as existing via web search that day; not all
read. Companion: [formal-methods-glossary.md](formal-methods-glossary.md).
Mostly formal methods, plus a marine-incident-analysis section below.

## COLREGS formalisation

- Krasowski, Althoff — *Temporal Logic Formalization of Marine Traffic Rules* (IEEE IV 2021). Power-driven two-vessel rules in temporal logic, evaluated on 1,200 real vessels. Predicates to borrow.
  <https://mediatum.ub.tum.de/doc/1613345/1es8mip5k7waoasv97t18tlvc.IV_final_submission.pdf> · <https://hanna.krasowski.io/publications/>
- Woerner, Benjamin, Novitzky, Leonard — *Quantifying protocol evaluation for autonomous collision avoidance: toward establishing COLREGS compliance metrics* (Autonomous Robots 43(4), 2019). Scoring algorithms for overtaking, head-on, crossing, give-way, stand-on, plus entry criteria. MIT Marine Autonomy Lab.
  <https://link.springer.com/article/10.1007/s10514-018-9765-y> · open access <https://dspace.mit.edu/bitstream/handle/1721.1/116295/springer_submit.pdf>
- Foster, Gleirscher, Calinescu — *Towards Deductive Verification of Control Algorithms for Autonomous Marine Vehicles* (ICECCS 2020). Isabelle/HOL side.
  <https://arxiv.org/pdf/2006.09233>
- Shokri-Manninen, Vain, Walden — *Formal Verification of COLREG-Based Navigation of Maritime Autonomous Systems* (SEFM 2020). UPPAAL STRATEGO, give-way/stand-on as a correct-by-construction refinement.
  <https://link.springer.com/chapter/10.1007/978-3-030-58768-0_3>
- *Stochastic COLREGs Evaluation for Safe Navigation under Uncertainty* (arXiv 2024).
  <https://arxiv.org/pdf/2402.05662>
- Sreedharan, Ramachandran, Røsæg, Rokseth — *Safety Assurances in Autonomous Vessels* (ER 2024). Digital-twin virtual testing against COLREG, not model checking — different tradeoff worth contrasting with the above.
  <https://link.springer.com/chapter/10.1007/978-3-031-75599-6_22>

## Marine incident analysis

Not formal-methods work — real-world collision forensics, included because
the failure modes it documents (radar misinterpretation, mismatched turn
decisions, ambiguous give-way/stand-on roles) are exactly what the COLREGS
formalisation papers above are trying to model and catch.

- Garzke, Simpson — *The Loss of Andrea Doria: A Marine Forensic Analysis* (Marine Technology Society Journal 46(6), 2012). Reconstructs the 1956 Andrea Doria–Stockholm collision from radar, navigation, and rules-of-the-road evidence.
  <https://www.ingentaconnect.com/content/mts/mtsj/2012/00000046/00000006/art00008> · <https://onepetro.org/JSPD/article/26/02/98/172277/The-Loss-of-Andrea-Doria-A-Marine-Forensic>

## Tools

- Lamport — *Specifying Systems* and the TLA+ video course. <https://lamport.azurewebsites.net/tla/tla.html>
- Wayne — *Learn TLA+*. The practical on-ramp. <https://learntla.com>
- Newcombe et al. — *How Amazon Web Services Uses Formal Methods* (CACM 2015). The talk you saw at Amazon, in paper form.
- Pierce et al. — *Software Foundations*, vol. 1 *Logical Foundations*. The canonical Rocq tutorial. <https://softwarefoundations.cis.upenn.edu>
- Fulton, Mitsch, Quesel, Völp, Platzer — *KeYmaera X: An Axiomatic Tactical Theorem Prover for Hybrid Systems* (CADE 2015). <https://keymaerax.org/> · <https://www.cs.cmu.edu/~smitsch/pdf/keymaerax.pdf>
- Platzer — *Logical Foundations of Cyber-Physical Systems* (book behind KeYmaera X).
- Jackson — *Software Abstractions* (Alloy).
