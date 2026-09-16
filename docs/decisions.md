# Decisions

One line per ruling, newest last. An ADR supersedes a line here.

- 2026-09-16 — Traffic in the Rule 2 verb: other vessels enter as reduced facts on `Situation.traffic` (`traffic:<sector>:<key>`), produced by `reduceTraffic`, readable by every verb's predicates; never as a list of vessels. Roles stay pairwise. An n-vessel `Scene` is deferred and builds on this, not instead of it. Ruled by Solace. ([#82](https://github.com/mark-brannan/colregs-engine/issues/82))
