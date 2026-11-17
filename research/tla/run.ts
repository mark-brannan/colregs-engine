// Model-checks TwoVessel.tla with TLC under each reading in
// expectations.json and compares what fails against what is expected.
//
//   npm run tla                      # every run, in sequence
//   npm run tla -- --only=Q55-reset  # one run
//
// A run is base's readings with one changed. Every check outside the run's
// `violated` must hold over the whole state space, about 80k distinct
// states and a minute or so on one worker; each check in it must have a
// counterexample, which TLC finds in seconds, and so must each `reach`
// check, under every reading. A TLC pass that outlasts
// 150 s is stopped and reported, not waited on.
//
// TLC is $TLA2TOOLS, else research/tla/.tools/tla2tools.jar; the README
// says how to fetch it. Each run works in its own temporary directory, so
// TLC's state files and trace modules never land in the tree. Exits
// non-zero on any disagreement. Not wired into `npm test`.

import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Readings = Record<'Q31' | 'Q55' | 'Q57' | 'Trigger', string>;
interface Run {
  name: string;
  set: Partial<Readings>;
  violated: string[];
}
interface Expectations {
  base: Readings;
  invariants: string[];
  properties: string[];
  reach: string[];
  runs: Run[];
}

const HERE = dirname(fileURLToPath(import.meta.url));
const SPEC = 'TwoVessel';
const RUN_TIMEOUT_MS = 150_000;

const expectations = JSON.parse(
  readFileSync(join(HERE, 'expectations.json'), 'utf8'),
) as Expectations;
const only = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length);
const jar = process.env.TLA2TOOLS ?? join(HERE, '.tools', 'tla2tools.jar');

function config(readings: Readings, checks: string[]): string {
  const constants = Object.entries(readings).map(([k, v]) => `  ${k} = "${v}"`);
  const invariants = checks.filter((c) => !expectations.properties.includes(c));
  const properties = checks.filter((c) => expectations.properties.includes(c));
  return [
    'SPECIFICATION Spec',
    'CONSTANTS',
    '  V = {a, b}',
    ...constants,
    'SYMMETRY Mirror',
    ...(invariants.length ? ['INVARIANTS', ...invariants.map((i) => `  ${i}`)] : []),
    ...(properties.length ? ['PROPERTIES', ...properties.map((p) => `  ${p}`)] : []),
    'CHECK_DEADLOCK FALSE',
    '',
  ].join('\n');
}

interface Outcome {
  violated: Set<string>;
  complete: boolean;
  distinct: string;
  seconds: number;
  log: string;
}

function check(readings: Readings, checks: string[]): Outcome {
  const dir = mkdtempSync(join(tmpdir(), 'tla-'));
  try {
    copyFileSync(join(HERE, `${SPEC}.tla`), join(dir, `${SPEC}.tla`));
    writeFileSync(join(dir, `${SPEC}.cfg`), config(readings, checks));
    const start = Date.now();
    const tlc = spawnSync(
      'java',
      [
        '-Xmx1g',
        '-XX:+UseParallelGC',
        '-cp',
        jar,
        'tlc2.TLC',
        '-workers',
        '1',
        '-metadir',
        join(dir, 'states'),
        '-config',
        `${SPEC}.cfg`,
        `${SPEC}.tla`,
      ],
      { cwd: dir, encoding: 'utf8', timeout: RUN_TIMEOUT_MS, maxBuffer: 256 * 1024 * 1024 },
    );
    const log = `${tlc.stdout ?? ''}${tlc.stderr ?? ''}`;
    const violated = new Set(
      [...log.matchAll(/(?:Invariant|Action property) (\w+) is violated/g)].map((m) => m[1]),
    );
    const distinct = [...log.matchAll(/([\d,]+) distinct states found/g)].pop()?.[1] ?? '?';
    return {
      violated,
      complete: [...log.matchAll(/([\d,]+) states left on queue/g)].pop()?.[1] === '0',
      distinct,
      seconds: Math.round((Date.now() - start) / 1000),
      log,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (!existsSync(jar)) {
  console.error(
    `TLC not found at ${jar}: set TLA2TOOLS, or fetch it as research/tla/README.md says.`,
  );
  process.exit(2);
}

function report(ok: boolean, label: string, got: Outcome, expected: string): void {
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(40)} ${got.distinct.padStart(7)} states ` +
      `${String(got.seconds).padStart(4)} s  expected ${expected}, ` +
      `found ${[...got.violated].join(', ') || 'none violated'}`,
  );
  if (!ok) console.log(got.log.split('\n').slice(-15).join('\n'));
}

// Per run: one full pass over every check expected to hold, then one pass
// per expected violation, which TLC ends at its first counterexample.
let failed = 0;
const all = [...expectations.invariants, ...expectations.properties];
for (const run of expectations.runs.filter((r) => !only || r.name === only)) {
  const readings = { ...expectations.base, ...run.set } as Readings;
  const holding = all.filter((c) => !run.violated.includes(c));
  const full = check(readings, holding);
  const fullOk = full.complete && full.violated.size === 0;
  report(fullOk, `${run.name}: ${holding.length} checks`, full, 'all to hold');
  if (!fullOk) failed += 1;
  for (const name of [...run.violated, ...expectations.reach]) {
    const got = check(readings, [name]);
    const ok = got.violated.size === 1 && got.violated.has(name);
    report(ok, `${run.name}: ${name}`, got, 'a counterexample');
    if (!ok) failed += 1;
  }
}
process.exit(failed ? 1 : 0);
