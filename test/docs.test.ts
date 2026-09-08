// Runs the shared prose-budget engine (mark-brannan/dotfiles, .local/bin)
// over the tree with docs/budgets.json. Engine lookup: $PROSE_BUDGET, then
// PATH, then ~/.local/bin/prose-budget. A missing engine fails; set
// PROSE_BUDGET_ALLOW_MISSING_ENGINE=1 to skip instead.

import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SEARCHED = '$PROSE_BUDGET, prose-budget on PATH, ~/.local/bin/prose-budget';
const engine = [process.env.PROSE_BUDGET, 'prose-budget', join(homedir(), '.local/bin/prose-budget')]
  .filter((c): c is string => !!c)
  .find((c) => spawnSync(c, ['--version']).status === 0);

const skip = !engine && !!process.env.PROSE_BUDGET_ALLOW_MISSING_ENGINE;
if (skip) console.warn(`prose-budget engine not found (searched ${SEARCHED}); PROSE_BUDGET_ALLOW_MISSING_ENGINE is set, skipping`);

(skip ? it.skip : it)('prose budgets hold (prose-budget --tree)', () => {
  expect(engine, `prose-budget engine not found (searched ${SEARCHED}); set PROSE_BUDGET_ALLOW_MISSING_ENGINE=1 to skip`).toBeTruthy();
  const run = spawnSync(engine!, ['--tree', '--require-config'], { cwd: ROOT, encoding: 'utf8' });
  expect(run.status, `${run.stdout}${run.stderr}`).toBe(0);
});
