# colregs-engine

Evaluates structured COLREGS data against one vessel's facts and returns every lawful lights-and-shapes display.

Checks: `npm run typecheck && npm test`. Regenerate `src/generated` with `npm run generate`; `npm run conformance` rewrites `research/conformance/findings/`.

## Prose budget

READMEs describe the project's intended state in present tense. Do not flag a README for describing behaviour the code does not yet have.

Each argument has one home: README for what and why, `docs/` for design notes, a TS header for what that file does, a JSON note for what that record means. Say it once and link to it. No PR numbers, dates or session references in JSON, tests, READMEs or TS headers; those belong in the PR body. Line counts, prose lengths and header sizes are capped in `docs/budgets.json` and enforced by `prose-budget` (mark-brannan/dotfiles `.local/bin`) in CI and in `test/docs.test.ts`, which looks for it at `$PROSE_BUDGET`, then on PATH, then `~/.local/bin`. Raising a budget is a deliberate diff, reviewed like any other.
