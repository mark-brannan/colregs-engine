// Conformance / consistency / coverage / traceability harness (issue #6
// ladder step 1-3, issue #1 Phase 0). One streaming pass over the
// partitioned fact space -- see enumerate.ts for how it's built, walk.ts
// for the per-record checks -- split across processes, then reduced.
//
//   npm run conformance                       whole space, one process per core
//   npm run conformance -- --jobs=4           whole space, four processes
//   npm run conformance -- --sample=N         first N records per jurisdiction,
//                                             in-process; register untouched
//   npm run conformance -- --shard=i/N --out=f.json
//                                             walk shard i of N (across --jobs
//                                             child processes) and write the
//                                             tally to f; no register
//   npm run conformance -- --merge a.json b.json ...
//                                             reduce shard tallies: coverage,
//                                             traceability, fixtures, register
//
// CI runs the last two: a matrix of --shard jobs, then one --merge. The
// default local run is the same pipeline in one command.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, mkdtempSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { availableParallelism, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import applicabilityJson from 'colregs/data/applicability.json' with { type: 'json' };
import fixturesJson from 'colregs/fixtures/applicability-fixtures.json' with { type: 'json' };
import rulesJson from 'colregs/data/rules.json' with { type: 'json' };
import triageJson from './findings/triage.json' with { type: 'json' };

import type { ApplicabilityData, FactRecord, RulesData } from '../../src/types.js';

import { extractAxes, totalRecords, formatAxisTable, type Shard } from './enumerate.js';
import { referenceAppliedEntries } from './reference.js';
import { unresolvedCite } from './traceability.js';
import { describeVessel } from './prose.js';
import {
  byId,
  displayEntries,
  entries,
  findingKey,
  jurisdictions,
  mergeTallies,
  recordFinding,
  walkShard,
  type FindingGroup,
  type Tally,
} from './walk.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const FINDINGS_DIR = join(HERE, 'findings');
const REGISTER_PATH = join(FINDINGS_DIR, 'README.md');

const data = applicabilityJson as unknown as ApplicabilityData;
const rules = rulesJson as unknown as RulesData;

// The status ladder a human climbs by hand: candidate (found, unreviewed) ->
// agent-verified -> triaged -> human-reviewed -> landed. buildRegister() below owns
// every other column; this is the one thing a run must never overwrite, so
// it lives in its own hand-maintained file, keyed by the same
// `${check}::${groupKey}` identity the harness groups findings under (not
// by FIND-nn id, which is just a position in sorted order and shifts
// whenever a finding appears or disappears).
type TriageStatus = 'candidate' | 'agent-verified' | 'triaged' | 'human-reviewed' | 'landed';
interface TriageEntry {
  status: TriageStatus;
  note?: string;
}
const TRIAGE = triageJson as unknown as Record<string, TriageEntry>;

function triageFor(f: Pick<FindingGroup, 'check' | 'groupKey'>): { status: TriageStatus; note: string } {
  const entry = TRIAGE[findingKey(f)];
  return { status: entry?.status ?? 'candidate', note: entry?.note ?? '' };
}

// ---------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------
const args = process.argv.slice(2);

function flag(name: string): string | undefined {
  const i = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i < 0) return undefined;
  return args[i].includes('=') ? args[i].split('=').slice(1).join('=') : args[i + 1];
}

const sampleArg = flag('sample');
const sampleSize = sampleArg === undefined ? undefined : Number(sampleArg);
const shardArg = flag('shard');
const outArg = flag('out');
const jobsArg = flag('jobs');
const mergeIdx = args.indexOf('--merge');
const mergeFiles = mergeIdx >= 0 ? args.slice(mergeIdx + 1).filter((a) => !a.startsWith('--')) : undefined;

function parseShard(s: string | undefined): Shard {
  if (s === undefined) return { index: 0, of: 1 };
  const m = /^(\d+)\/(\d+)$/.exec(s);
  if (!m) throw new Error(`--shard wants i/N, got '${s}'`);
  return { index: Number(m[1]), of: Number(m[2]) };
}
const shard = parseShard(shardArg);
const jobs = jobsArg !== undefined ? Number(jobsArg) : sampleSize !== undefined ? 1 : availableParallelism();
if (!Number.isInteger(jobs) || jobs < 1) throw new Error(`--jobs wants a positive integer, got '${jobsArg}'`);
if (shardArg !== undefined && outArg === undefined) throw new Error('--shard needs --out=<tally.json>');

// ---------------------------------------------------------------------
// Axis table / enumeration
// ---------------------------------------------------------------------
const { axes, undeclaredEnumValues } = extractAxes(data);
if (undeclaredEnumValues.length > 0) {
  console.error('Predicates reference enum values not declared in facts.json:', undeclaredEnumValues);
  process.exitCode = 1;
}

if (mergeFiles === undefined) {
  console.log(formatAxisTable(axes));
  const fullTotal = totalRecords(axes);
  console.log(
    `total records: ${fullTotal} per jurisdiction (${jurisdictions.length} jurisdictions)` +
      (sampleSize !== undefined ? ` (sampling first ${Math.min(sampleSize, fullTotal)})` : '') +
      (shardArg !== undefined ? ` (shard ${shard.index}/${shard.of})` : '') +
      (jobs > 1 ? ` across ${jobs} processes` : ''),
  );
}

/** Sub-shard `k` of `jobs` within `shard`: index i+N*k of N*J. Composes,
 * so a CI shard split over its cores is still a slice of the one space. */
function subShard(k: number): Shard {
  return { index: shard.index + shard.of * k, of: shard.of * jobs };
}

/** Runs this script again as a child for one sub-shard, returning its tally. */
function walkInChild(sub: Shard, out: string): Promise<Tally> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [...process.execArgv, SELF, `--shard=${sub.index}/${sub.of}`, `--out=${out}`, '--jobs=1'],
      { stdio: ['ignore', 'ignore', 'inherit'] },
    );
    child.on('error', reject);
    child.on('exit', (code) => {
      // A shard exits 1 on a conformance mismatch but still writes its
      // tally; the reduce below re-raises. Anything else is a crash.
      if (code !== 0 && code !== 1) return reject(new Error(`shard ${sub.index}/${sub.of} exited ${code}`));
      if (!existsSync(out)) return reject(new Error(`shard ${sub.index}/${sub.of} wrote no tally`));
      resolve(JSON.parse(readFileSync(out, 'utf8')) as Tally);
    });
  });
}

async function walk(): Promise<Tally> {
  if (jobs === 1) return walkShard(axes, { shard, sample: sampleSize });
  const dir = mkdtempSync(join(tmpdir(), 'conformance-'));
  const tallies = await Promise.all(
    Array.from({ length: jobs }, (_, k) => walkInChild(subShard(k), join(dir, `shard-${k}.json`))),
  );
  rmSync(dir, { recursive: true, force: true });
  return mergeTallies(tallies);
}

function printSummary(t: Tally) {
  const recordsPerSec = t.n / (t.wallMs / 1000);
  console.log(`\nprocessed ${t.n} records in ${(t.wallMs / 1000).toFixed(1)}s wall (${recordsPerSec.toFixed(0)} rec/s)`);
  console.log(`conformance failures (applied-set mismatch): ${t.conformanceFailures}`);
  console.log(`modality mismatches (same applied set, different modality): ${t.modalityMismatches}`);
  console.log(`no-obligation records: ${t.noObligationCount}`);
  console.log(`  by fact:position: ${JSON.stringify(Object.entries(t.noObligationPositions))}`);
  console.log(`conflicting-shall records: ${t.conflictingObligationCount}`);
  console.log(`orphan-shall records: ${t.orphanShallCount}`);
  console.log(`unresolved-conditional records: ${t.unresolvedConditionalCount}`);
}

// ---------------------------------------------------------------------
// After the walk: coverage, traceability, fixture replay, the register.
// Only sound over the whole space -- a shard or a sample can't say an
// entry never fires -- so a --shard run stops before this.
// ---------------------------------------------------------------------
function coverageFindings(t: Tally) {
  const everApplied = new Set(t.everApplied);
  const neverFired = displayEntries.filter((e) => !everApplied.has(e.id));
  for (const e of neverFired) {
    recordFinding(t, 'coverage-entry-never-fires', e.id, `entry ${e.id} never applies across the enumerated fact space`, [e.cite], {}, -1);
  }
  for (const e of displayEntries) {
    if (e.modality !== 'modality:conditional' || !e.modality_by) continue;
    const taken = new Set(t.modalityByBranchTaken[e.id] ?? []);
    for (let i = 0; i < e.modality_by.length; i++) {
      if (!taken.has(i)) {
        recordFinding(
          t,
          'coverage-modality-branch-dead',
          `${e.id}:${i}`,
          `entry ${e.id}'s modality_by[${i}] (-> ${e.modality_by[i].modality}) is never the first matching branch`,
          [e.cite],
          {},
          -1,
        );
      }
    }
  }
  const chosen = new Set(t.oneOfEverChosen);
  const allOneOfOptions = new Set<string>();
  for (const e of entries) {
    for (const ci of e['rel:conditional_includes'] ?? []) {
      for (const ref of ci.one_of ?? []) allOneOfOptions.add(ref);
    }
  }
  for (const ref of allOneOfOptions) {
    if (!chosen.has(ref) && !everApplied.has(ref)) {
      recordFinding(
        t,
        'coverage-one-of-option-dead',
        ref,
        `one_of option ${ref} is never chosen (neither self-applied nor selected via a one_of group) across the enumerated fact space`,
        [byId.get(ref)?.cite ?? ref],
        {},
        -1,
      );
    }
  }
  console.log(`never-fired entries: ${neverFired.map((e) => e.id).join(', ') || '(none)'}`);
}

function traceabilityFindings(t: Tally) {
  const unresolvedCites: { id: string; cite: string; missing: string[] }[] = [];
  for (const e of entries) {
    const missing = unresolvedCite(e.cite, rules, e.jurisdiction);
    if (missing.length > 0) {
      unresolvedCites.push({ id: e.id, cite: e.cite, missing });
      recordFinding(
        t,
        'traceability-unresolved-cite',
        e.id,
        `entry ${e.id}'s cite '${e.cite}' does not resolve to a paragraph in colregs data/rules.json (missing: ${missing.join(', ')})`,
        [e.cite],
        {},
        -1,
      );
    }
  }
  console.log(`unresolved cites: ${unresolvedCites.length === 0 ? '(none)' : JSON.stringify(unresolvedCites)}`);
}

interface FixtureCase {
  name: string;
  facts: FactRecord;
  expect: string[];
  jurisdiction?: string;
}
function replayFixtures() {
  const fixtures = fixturesJson as unknown as { jurisdiction: string; cases: FixtureCase[] };
  let fixtureFailures = 0;
  for (const c of fixtures.cases) {
    const jurisdiction = c.jurisdiction ?? fixtures.jurisdiction;
    const got = referenceAppliedEntries(data, c.facts, jurisdiction).slice().sort();
    const want = [...c.expect].sort();
    if (got.join(',') !== want.join(',')) {
      fixtureFailures++;
      console.error(`reference evaluator fixture mismatch: ${c.name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
    }
  }
  console.log(`fixture replay through reference.ts: ${fixtures.cases.length - fixtureFailures}/${fixtures.cases.length} pass`);
}

type Finding = FindingGroup & { id: string };

function sortAndNumber(t: Tally): Finding[] {
  const sorted = Object.values(t.findings)
    .sort((a, b) => (a.check !== b.check ? a.check.localeCompare(b.check) : a.groupKey.localeCompare(b.groupKey)))
    .map((f, i) => ({ ...f, id: `FIND-${String(i + 1).padStart(2, '0')}` }));
  return sorted;
}

// A ruling in triage.json for a (check, groupKey) that no longer matches any
// finding this run produced means the finding was fixed, renamed, or the
// harness stopped grouping it that way -- not that the ruling should be
// silently dropped. Flag it so a human decides whether to retire or move it.
function warnStaleTriage(findings: Finding[]) {
  const live = new Set(findings.map(findingKey));
  for (const key of Object.keys(TRIAGE)) {
    if (!live.has(key)) {
      console.error(
        `findings/triage.json has a ruling for '${key}' but no current finding matches it -- confirm whether it landed and retire the entry, or the check/groupKey changed and it needs re-keying.`,
      );
    }
  }
}

function buildRegister(findings: Finding[]): string {
  const header = `# Conformance findings register

Findings from \`npm run conformance\` (research/conformance/), the exhaustive
predicate-level check for [issue #6](https://github.com/mark-brannan/colregs-engine/issues/6)
(Phase 0 of [issue #1](https://github.com/mark-brannan/colregs-engine/issues/1)).

Status ladder: **candidate** (found by the harness, unreviewed) ->
**agent-verified** (a second agent pass confirmed it's real and not a
harness bug) -> **triaged** (an agent classified it and wrote the reason,
including "harness false positive"; a person has not yet ruled) ->
**human-reviewed** (a person ruled: data bug, genuine ambiguity, engine
bug, or harness bug) -> **landed** (fixed as a fixture, an ADR, or a
requirement change). A finding may skip agent-verified and go straight to
triaged when the agent's read is that the harness, not the data, is wrong.

Agents never edit colregs normatively; these are candidates for a human to
triage, not fixes.

Every column but the last two is regenerated by the run. **status** and
**triage note** come from [\`triage.json\`](triage.json), a hand-maintained
sidecar keyed by \`check::groupKey\` (not by \`FIND-nn\`, which is just a
position in sorted order and shifts as findings appear or disappear) --
climb a finding up the ladder by editing that file and rerunning
\`npm run conformance\`, not by hand-editing this table, which the next run
overwrites.

| id | check | records | description | cites | status | triage note |
|---|---|---|---|---|---|---|
`;
  const rows = findings
    .map((f) => {
      const t = triageFor(f);
      const escape = (s: string) =>
        s.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r\n?|\n/g, '<br>');
      return `| ${f.id} | ${f.check} | ${f.count} | ${escape(f.description)} | ${f.cites.join('; ') || '-'} | ${t.status} | ${t.note ? escape(t.note) : '-'} |`;
    })
    .join('\n');
  return header + rows + '\n';
}

/** Writes the register and fixtures; true if anything on disk changed. */
function writeRegister(findings: Finding[]): boolean {
  mkdirSync(FINDINGS_DIR, { recursive: true });
  let stale = false;
  const newRegister = buildRegister(findings);
  if (!existsSync(REGISTER_PATH) || readFileSync(REGISTER_PATH, 'utf8') !== newRegister) stale = true;
  writeFileSync(REGISTER_PATH, newRegister);
  for (const f of findings) {
    const fixturePath = join(FINDINGS_DIR, `${f.id}.json`);
    const t = triageFor(f);
    const fixtureContent =
      JSON.stringify(
        {
          id: f.id,
          check: f.check,
          description: f.description,
          cites: f.cites,
          records: f.count,
          status: t.status,
          note: t.note || undefined,
          facts: f.sampleFacts,
          prose: describeVessel(f.sampleFacts),
        },
        null,
        2,
      ) + '\n';
    if (!existsSync(fixturePath) || readFileSync(fixturePath, 'utf8') !== fixtureContent) stale = true;
    writeFileSync(fixturePath, fixtureContent);
  }
  // A finding that has gone away leaves its fixture behind; remove it, and
  // treat that as staleness too.
  const wanted = new Set(findings.map((f) => `${f.id}.json`));
  for (const name of readdirSync(FINDINGS_DIR)) {
    if (!/^FIND-\d+\.json$/.test(name) || wanted.has(name)) continue;
    rmSync(join(FINDINGS_DIR, name));
    stale = true;
  }
  return stale;
}

function failOnMismatch(t: Tally) {
  if (t.conformanceFailures > 0) {
    console.error(`\nCONFORMANCE FAILED: ${t.conformanceFailures} records where engine != reference.`);
    process.exit(1);
  }
}

/** The whole-space epilogue: everything after the walk. */
function reduce(t: Tally) {
  printSummary(t);
  coverageFindings(t);
  traceabilityFindings(t);
  replayFixtures();
  const findings = sortAndNumber(t);
  warnStaleTriage(findings);
  const stale = writeRegister(findings);
  if (stale) {
    console.error(
      '\nfindings register was stale relative to this run: run `npm run conformance` and commit research/conformance/findings/.',
    );
  }
  console.log(`\n${findings.length} distinct findings written to research/conformance/findings/`);
  for (const f of findings) console.log(`  ${f.id}  [${f.check}]  n=${f.count}  ${f.description}`);
  failOnMismatch(t);
  if (stale) process.exit(1);
  console.log('\nconformance run complete.');
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------
if (mergeFiles !== undefined) {
  if (mergeFiles.length === 0) throw new Error('--merge wants one or more tally files');
  const tallies = mergeFiles.map((f) => JSON.parse(readFileSync(f, 'utf8')) as Tally);
  console.log(`merging ${tallies.length} shard tallies`);
  reduce(mergeTallies(tallies));
} else if (shardArg !== undefined) {
  const t = await walk();
  writeFileSync(outArg!, JSON.stringify(t));
  if (jobs > 1 || shard.of === 1) printSummary(t);
  failOnMismatch(t);
} else if (sampleSize !== undefined) {
  const t = await walk();
  printSummary(t);
  coverageFindings(t);
  traceabilityFindings(t);
  replayFixtures();
  const findings = sortAndNumber(t);
  console.log(`\n${findings.length} distinct findings in this sample run (register not written in --sample mode)`);
  failOnMismatch(t);
  console.log('\nconformance run complete.');
} else {
  reduce(await walk());
}
