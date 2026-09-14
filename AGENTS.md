# colregs-engine

Evaluates structured COLREGS data against one vessel's facts and returns every lawful lights-and-shapes display.

Checks: `npm run typecheck && npm test`. Regenerate `src/generated` with `npm run generate`; `npm run conformance` rewrites `research/conformance/findings/`.

## Prose budget

READMEs describe the project's intended state in present tense. Do not flag a README for describing behaviour the code does not yet have.

Each argument has one home: README for what and why, `docs/` for design notes, colregs `docs/adr/` for decisions (ADRs for the whole family live there, one sequence; a bare `ADR NNNN` means colregs; this repo keeps only pointers), a TS header for what that file does, a JSON note for what that record means. Say it once and link to it. No PR numbers, dates or session references in JSON, tests, READMEs or TS headers; those belong in the PR body. Line counts, prose lengths and header sizes are capped in `docs/budgets.json` and enforced by `prose-budget` (mark-brannan/dotfiles `.local/bin`) in CI and in `test/docs.test.ts`, which looks for it at `$PROSE_BUDGET`, then on PATH, then `~/.local/bin`. Raising a budget is a deliberate diff, reviewed like any other.

## Stage: pre-consumer

Published on npm at 0.x. The only consumers are colregs-mcp and searoom, repos
Solace owns. Until Solace says otherwise that is a fact, not an estimate, and not
an agent's to re-evaluate. The family stanza in colregs `AGENTS.md` is the long
form; this is what it means here.

**Breaking changes need no ceremony.** Rename or delete an export, change a
signature, reshape the display envelope, move something between `.` and
`./schema` — no deprecation window, no alias, no overload kept alive for
compatibility, no paragraph weighing who might be hurt. `git revert` is the
migration path.

**Stub as the safe default.** Anything named in an ADR or a README gets an export
the same day — throwing, or answering with an inconclusive status. Both are stubs
doing their job. Withholding an export is never the careful choice; it is the
failure mode. Risk conversations about stub behaviour belong to a 1.0 with formal
verification behind it, and they are Solace's to open.

**Where the rigour goes instead.** The schema, the envelope's shape and its status
alphabets, determinism, the conformance corpus, the formal-methods work. Those
outlive every API decision in this package.

**Never hedge in an output or a doc.** No disclaimers, no "may change", no
liability language, no sentence closing an option on risk grounds. An agent that
does risk arithmetic in a subordinate clause has made Solace's decision for her —
`docs/adr/0012`'s struck line is the worked example.
