# Conformance findings register

Findings from `npm run conformance` (research/conformance/), the exhaustive
predicate-level check for [issue #6](https://github.com/mark-brannan/colregs-engine/issues/6)
(Phase 0 of [issue #1](https://github.com/mark-brannan/colregs-engine/issues/1)).

Status ladder: **candidate** (found by the harness, unreviewed) ->
**agent-verified** (a second agent pass confirmed it's real and not a
harness bug) -> **human-reviewed** (a person triaged it: data bug, genuine
ambiguity, or engine bug) -> **landed** (fixed as a fixture, an ADR, or a
requirement change).

Agents never edit colregs normatively; these are candidates for a human to
triage, not fixes.

| id | check | records | description | cites | status |
|---|---|---|---|---|---|
| FIND-01 | consistency-conflicting-shall | 114048 | entries 26b-id and 30a are both resolved 'shall' and rel:excludes the other: a conflicting obligation | 26(b)(i); 30(a) | candidate |
| FIND-02 | consistency-conflicting-shall | 114048 | entries 26c-id and 30a are both resolved 'shall' and rel:excludes the other: a conflicting obligation | 26(c)(i); 30(a) | candidate |
| FIND-03 | consistency-no-obligation | 114048 | record has zero applied lights entries and so no lawful display, for a vessel with fact:position = position:moored | - | candidate |
