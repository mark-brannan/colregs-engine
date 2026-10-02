// Fail-closed checks for `npm run conformance`: a broken environment or an
// implausible walk must exit non-zero and leave the committed findings alone.
// Node builtins only, so the dependency check still runs when node_modules is
// missing (run.ts's own imports would fail first, with a raw loader error).

import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, sep } from 'node:path';

/** What the walk imports from the engine's dependencies. */
export const REQUIRED_MODULES = [
  'colregs/data/applicability.json',
  'colregs/data/rules.json',
  'colregs/fixtures/applicability-fixtures.json',
  'ajv',
];

/** The modules in `required` that `resolve` cannot find. */
export function missingModules(resolve: (id: string) => unknown, required: string[] = REQUIRED_MODULES): string[] {
  return required.filter((id) => {
    try {
      resolve(id);
      return false;
    } catch {
      return true;
    }
  });
}

/** Why a finished walk cannot be trusted to rewrite the register, or undefined. */
export function implausibleWalk(walked: number, findings: number, committedFixtures: number): string | undefined {
  if (walked === 0) return 'the walk processed 0 records';
  if (findings === 0 && committedFixtures > 0) {
    return `the walk produced 0 findings but ${committedFixtures} are committed`;
  }
  return undefined;
}

/** Committed FIND-nn.json fixtures in `dir`. */
export function committedFixtureCount(dir: string): number {
  try {
    return readdirSync(dir).filter((n) => /^FIND-\d+\.json$/.test(n)).length;
  } catch {
    return 0;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // A worktree without its own node_modules resolves up the tree to another
  // checkout's, silently walking a different colregs; only this repo's count.
  const own = join(fileURLToPath(new URL('../..', import.meta.url)), 'node_modules') + sep;
  const req = createRequire(import.meta.url);
  const missing = missingModules((id) => {
    const found = req.resolve(id);
    if (!found.startsWith(own)) throw new Error(`${found} is outside ${own}`);
  });
  if (missing.length > 0) {
    console.error(`conformance: cannot resolve ${missing.join(', ')} -- run \`npm ci\` first. Nothing was walked or written.`);
    process.exit(1);
  }
}
