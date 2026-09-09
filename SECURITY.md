# Security Policy

## Supported versions

This package is pre-release and maintained as a single moving line. Only the
latest version published to npm gets fixes; there are no maintenance
branches, and a pre-1.0 release may change behaviour in a patch.

| Version | Supported |
| ------- | --------- |
| latest `0.x` on [npm](https://www.npmjs.com/package/colregs-engine) | yes |
| anything older | no — upgrade first |

## Reporting a vulnerability

**Please do not open a public issue for a security problem.** Report it
privately through GitHub:

1. Go to
   [Security → Report a vulnerability](https://github.com/mark-brannan/colregs-engine/security/advisories/new).
2. Describe what you found, ideally as a fact record that triggers it.

You should get an acknowledgement within a week. This is a spare-time project
maintained by one person, so a fix may take longer than that — you will be told
where it stands rather than left waiting. If a report is valid and you want
credit, you will be named in the advisory.

If you get no response at all within two weeks, open a public issue saying only
that you are waiting on a private report — no details — and it will be picked
up.

## What is in scope

**Treat a fact record as untrusted input.** `evaluateDisplay` and everything
it calls is meant to run over a caller-supplied fact record, which may come
from a live sensor feed rather than a fixture.

- **The evaluator.** A fact record — any combination of keys and values drawn
  from `colregs`' `data/facts.json`, including ones a real vessel would never
  produce — that crashes it, hangs it, or drives unbounded work from a small
  input is in scope.
- **Schema and type generation** (`scripts/generate-schema-types.ts`,
  `scripts/generate-fact-record.ts`) producing output that doesn't match the
  `colregs` schema it was generated from.
- **The published tarball** — anything shipped in `dist` that should not be
  there, or a discrepancy between npm and this repository at the
  corresponding tag.
- **The supply chain around publishing** — the `publish.yml` and
  `release-please.yml` workflows and the credentials they use.

## What is out of scope

- **A wrong lawful display.** An incorrect result for a well-formed fact
  record is the most serious thing this engine can get wrong, and it is an
  ordinary bug: open a public issue with the fact record that produced it.
- **The data itself.** Rule text, lights and applicability predicates live in
  [colregs](https://github.com/mark-brannan/colregs/issues); report a
  transcription or modelling error there.
- **Consumers of this engine** —
  [nav-wright](https://github.com/mark-brannan/nav-wright/security) and
  [searoom](https://github.com/mark-brannan/searoom/security). Report those in
  their own repositories.
- **Navigational use.** This engine is pre-release, covers Part C lights only,
  and must not be used to make collision-avoidance decisions at sea.

## Notes on how this package is built

- The engine is a pure function of its input fact record and the `colregs`
  data it's evaluated against — no I/O, no network, no filesystem access at
  call time.
- The conformance suite (`npm run conformance`) and the Z3 formal-methods
  work (`npm run z3`) check the rule set itself for consistency and
  completeness, independent of any code path a caller can reach.
- `npm test` runs against the committed fixtures with the network
  unavailable.
