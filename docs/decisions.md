# Decisions

One line per ruling, newest last. An ADR supersedes a line here.

- 2026-09-16 — Traffic in the Rule 2 verb: other vessels enter as reduced facts on `Situation.traffic` (`traffic:<sector>:<key>`), produced by `reduceTraffic`, readable by every verb's predicates; never as a list of vessels. Roles stay pairwise. An n-vessel `Scene` is deferred and builds on this, not instead of it. Ruled by Solace. ([#82](https://github.com/mark-brannan/colregs-engine/issues/82))
- 2026-09-22 — `displays[]` is ordered most specific concession first, base rule last, derived from `modality`, `when` and `rel:in_lieu_of`; consumers take index 0. No colregs data field, no per-display id, no consumer-side table. Ruled by Solace. ([searoom #152](https://github.com/mark-brannan/searoom/issues/152), [#137](https://github.com/mark-brannan/colregs-engine/issues/137))
