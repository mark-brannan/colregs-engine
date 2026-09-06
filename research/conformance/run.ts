// Conformance / consistency / coverage / traceability harness (issue #6
// ladder step 1-3, issue #1 Phase 0). One streaming pass over the
// partitioned fact space — see enumerate.ts for how it's built.
//
// `npm run conformance` (full run) or `npm run conformance -- --sample=N`
// (first N records only, for fast PR feedback; the register is not
// rewritten and staleness is not checked in sample mode).

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import applicabilityJson from 'colregs/data/applicability.json' with { type: 'json' };
import fixturesJson from 'colregs/fixtures/applicability-fixtures.json' with { type: 'json' };
import rulesJson from 'colregs/data/rules.json' with { type: 'json' };

import { evaluate, predicateMatches } from '../../src/evaluate.js';
import type { ApplicabilityData, Entry, FactRecord, RulesData } from '../../src/types.js';

import { extractAxes, enumerateRecords, totalRecords, formatAxisTable } from './enumerate.js';
import { referenceAppliedEntries, referenceResolveModality } from './reference.js';
import { unresolvedCite } from './traceability.js';
import { describeVessel } from './prose.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FINDINGS_DIR = join(HERE, 'findings');
const REGISTER_PATH = join(FINDINGS_DIR, 'README.md');

const data = applicabilityJson as unknown as ApplicabilityData;
const rules = rulesJson as unknown as RulesData;

// Every entry in the pinned colregs (0.1.2) is a single-subject lights
// entry; the two-subject Part B steering entries arrive in a later release,
// and filtering them belongs with the pin move, in the engine and here alike.
const entries: Entry[] = data.entries;
const byId = new Map<string, Entry>(entries.map((e) => [e.id, e]));

/** Ordered pairs of entries where one `rel:excludes` the other. The
 * consistency (i) check only has to look at these, not at every pair of
 * applied `shall` entries — 5.9M records times a quadratic scan is the
 * difference between a three-minute run and an hour-long one. */
const excludingPairs: [string, string][] = [];
for (let i = 0; i < entries.length; i++) {
  for (let j = i + 1; j < entries.length; j++) {
    const a = entries[i];
    const b = entries[j];
    if ((a['rel:excludes'] ?? []).includes(b.id) || (b['rel:excludes'] ?? []).includes(a.id)) {
      excludingPairs.push([a.id, b.id]);
    }
  }
}

// ---------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------
const args = process.argv.slice(2);
const sampleArg = args.find((a) => a.startsWith('--sample'));
const sampleSize = sampleArg
  ? Number(sampleArg.includes('=') ? sampleArg.split('=')[1] : args[args.indexOf(sampleArg) + 1])
  : undefined;

// ---------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------
interface Finding {
  id: string;
  check: string;
  groupKey: string;
  count: number;
  description: string;
  cites: string[];
  sampleFacts: FactRecord;
}

const findingGroups = new Map<string, Finding>();

function record(check: string, groupKey: string, description: string, cites: string[], facts: FactRecord) {
  const key = `${check}::${groupKey}`;
  const existing = findingGroups.get(key);
  if (existing) {
    existing.count++;
    return;
  }
  findingGroups.set(key, {
    id: '', // assigned after sort, once collection is done
    check,
    groupKey,
    count: 1,
    description,
    cites,
    sampleFacts: facts,
  });
}

// ---------------------------------------------------------------------
// Axis table / enumeration
// ---------------------------------------------------------------------
const { axes, undeclaredEnumValues } = extractAxes(data);
if (undeclaredEnumValues.length > 0) {
  console.error('Predicates reference enum values not declared in facts.json:', undeclaredEnumValues);
  process.exitCode = 1;
}

console.log(formatAxisTable(axes));
const fullTotal = totalRecords(axes);
const total = sampleSize ? Math.min(sampleSize, fullTotal) : fullTotal;
console.log(`total records: ${fullTotal}${sampleSize ? ` (sampling first ${total})` : ''}`);

// ---------------------------------------------------------------------
// Coverage bookkeeping
// ---------------------------------------------------------------------
const everApplied = new Set<string>();
// entryId -> branchIndex -> taken?
const modalityByBranchTaken = new Map<string, Set<number>>();
// carrier entry id -> ref id -> ever chosen
const oneOfEverChosen = new Set<string>();

for (const e of entries) {
  if (e.modality === 'conditional' && e.modality_by) {
    modalityByBranchTaken.set(e.id, new Set());
  }
}

function trackModalityByBranch(e: Entry, facts: FactRecord) {
  if (e.modality !== 'conditional' || !e.modality_by) return;
  const taken = modalityByBranchTaken.get(e.id)!;
  if (taken.size === e.modality_by.length) return; // already saturated
  for (let i = 0; i < e.modality_by.length; i++) {
    // Reuses the engine's own predicate matcher for coverage bookkeeping
    // only (not for the conformance verdict itself, which compares
    // against reference.ts).
    if (evaluatePredicateForCoverage(e.modality_by[i].when, facts)) {
      taken.add(i);
      return;
    }
  }
}

function evaluatePredicateForCoverage(when: Entry['when'], facts: FactRecord): boolean {
  return predicateMatches(when, facts);
}

// ---------------------------------------------------------------------
// Consistency bookkeeping
// ---------------------------------------------------------------------
let noObligationCount = 0;
const noObligationPositions = new Map<string, number>();
let conflictingObligationCount = 0;
let unresolvedConditionalCount = 0;

let conformanceFailures = 0;
let modalityMismatches = 0;

// ---------------------------------------------------------------------
// Main pass
// ---------------------------------------------------------------------
const t0 = Date.now();
let n = 0;

for (const facts of enumerateRecords(axes)) {
  if (sampleSize && n >= sampleSize) break;
  n++;

  const evalResult = evaluate(data, facts);
  const engineApplied = evalResult.applied;
  const refApplied = referenceAppliedEntries(data, facts);

  const engineSet = new Set(engineApplied);
  const refSet = new Set(refApplied);
  const sameSet =
    engineSet.size === refSet.size && [...engineSet].every((id) => refSet.has(id));

  if (!sameSet) {
    conformanceFailures++;
    const missing = refApplied.filter((id) => !engineSet.has(id));
    const extra = engineApplied.filter((id) => !refSet.has(id));
    const key = `missing:${missing.sort().join(',')}|extra:${extra.sort().join(',')}`;
    record(
      'conformance-applied',
      key,
      `engine and reference disagree on applied entries: engine is missing ${JSON.stringify(missing)}, has extra ${JSON.stringify(extra)}`,
      [...missing, ...extra].map((id) => byId.get(id)?.cite ?? id),
      facts,
    );
  }
  // Order mismatches are structurally unreachable: both engineApplied and
  // refApplied are built by filtering data.entries in the same fixed order,
  // so whenever their sets match, their orders match too. Left uncounted —
  // see the review thread on PR #14 for the reasoning.

  if (sameSet) {
    for (const id of engineApplied) {
      const engineM = evalResult.modalities[id];
      const refM = referenceResolveModality(byId.get(id)!, facts);
      if (engineM !== refM) {
        modalityMismatches++;
        record(
          'conformance-modality',
          `${id}:${engineM}!=${refM}`,
          `entry ${id} resolves to modality '${engineM}' in the engine but '${refM}' in the reference`,
          [byId.get(id)?.cite ?? id],
          facts,
        );
      }
    }
  }

  // Coverage
  for (const id of engineApplied) {
    everApplied.add(id);
    trackModalityByBranch(byId.get(id)!, facts);
  }
  for (const d of evalResult.displays) {
    for (const id of d.chosen) oneOfEverChosen.add(id);
  }

  // Consistency
  if (engineApplied.length === 0) {
    noObligationCount++;
    const pos = String(facts['fact:position'] ?? '(absent)');
    noObligationPositions.set(pos, (noObligationPositions.get(pos) ?? 0) + 1);
    record(
      'consistency-no-obligation',
      pos,
      `record has zero applied lights entries and so no lawful display, for a vessel with fact:position = ${pos}`,
      [],
      facts,
    );
  }

  for (const [aId, bId] of excludingPairs) {
    if (evalResult.modalities[aId] !== 'shall' || evalResult.modalities[bId] !== 'shall') continue;
    if (!engineApplied.includes(aId) || !engineApplied.includes(bId)) continue;
    conflictingObligationCount++;
    record(
      'consistency-conflicting-shall',
      `${aId},${bId}`,
      `entries ${aId} and ${bId} are both resolved 'shall' and rel:excludes the other: a conflicting obligation`,
      [byId.get(aId)!.cite, byId.get(bId)!.cite],
      facts,
    );
  }

  for (const id of engineApplied) {
    if (evalResult.modalities[id] === 'conditional') {
      unresolvedConditionalCount++;
      record(
        'consistency-unresolved-conditional',
        id,
        `entry ${id} is applied and modality: conditional, but no modality_by branch matched this fact record`,
        [byId.get(id)?.cite ?? id],
        facts,
      );
    }
  }
}

const t1 = Date.now();
const wallMs = t1 - t0;
const recordsPerSec = n / (wallMs / 1000);

console.log(`\nprocessed ${n} records in ${(wallMs / 1000).toFixed(1)}s (${recordsPerSec.toFixed(0)} rec/s)`);
console.log(`conformance failures (applied-set mismatch): ${conformanceFailures}`);
console.log(`modality mismatches (same applied set, different modality): ${modalityMismatches}`);
console.log(`no-obligation records: ${noObligationCount}`);
console.log(`  by fact:position: ${JSON.stringify([...noObligationPositions.entries()])}`);
console.log(`conflicting-shall records: ${conflictingObligationCount}`);
console.log(`unresolved-conditional records: ${unresolvedConditionalCount}`);

// ---------------------------------------------------------------------
// Coverage: never-fired entries, dead modality_by branches, dead one_of options
// ---------------------------------------------------------------------
const neverFired = entries.filter((e) => !everApplied.has(e.id));
for (const e of neverFired) {
  record('coverage-entry-never-fires', e.id, `entry ${e.id} never applies across the enumerated fact space`, [e.cite], {});
}

for (const [id, taken] of modalityByBranchTaken) {
  const e = byId.get(id)!;
  for (let i = 0; i < (e.modality_by?.length ?? 0); i++) {
    if (!taken.has(i)) {
      record(
        'coverage-modality-branch-dead',
        `${id}:${i}`,
        `entry ${id}'s modality_by[${i}] (-> ${e.modality_by![i].modality}) is never the first matching branch`,
        [e.cite],
        {},
      );
    }
  }
}

const allOneOfOptions = new Set<string>();
for (const e of entries) {
  for (const ci of e['rel:conditional_includes'] ?? []) {
    for (const ref of ci.one_of ?? []) allOneOfOptions.add(ref);
  }
}
for (const ref of allOneOfOptions) {
  if (!oneOfEverChosen.has(ref) && !everApplied.has(ref)) {
    record(
      'coverage-one-of-option-dead',
      ref,
      `one_of option ${ref} is never chosen (neither self-applied nor selected via a one_of group) across the enumerated fact space`,
      [byId.get(ref)?.cite ?? ref],
      {},
    );
  }
}

console.log(`never-fired entries: ${neverFired.map((e) => e.id).join(', ') || '(none)'}`);

// ---------------------------------------------------------------------
// Traceability
// ---------------------------------------------------------------------
const unresolvedCites: { id: string; cite: string; missing: string[] }[] = [];
for (const e of entries) {
  const missing = unresolvedCite(e.cite, rules);
  if (missing.length > 0) {
    unresolvedCites.push({ id: e.id, cite: e.cite, missing });
    record(
      'traceability-unresolved-cite',
      e.id,
      `entry ${e.id}'s cite '${e.cite}' does not resolve to a paragraph in colregs data/rules.json (missing: ${missing.join(', ')})`,
      [e.cite],
      {},
    );
  }
}
console.log(`unresolved cites: ${unresolvedCites.length === 0 ? '(none)' : JSON.stringify(unresolvedCites)}`);

// ---------------------------------------------------------------------
// Fixture replay through the reference evaluator
// ---------------------------------------------------------------------
interface FixtureCase {
  name: string;
  facts: FactRecord;
  expect: string[];
}
const fixtures = fixturesJson as unknown as { cases: FixtureCase[] };
let fixtureFailures = 0;
for (const c of fixtures.cases) {
  const got = referenceAppliedEntries(data, c.facts).slice().sort();
  const want = [...c.expect].sort();
  if (got.join(',') !== want.join(',')) {
    fixtureFailures++;
    console.error(`reference evaluator fixture mismatch: ${c.name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
}
console.log(`fixture replay through reference.ts: ${fixtures.cases.length - fixtureFailures}/${fixtures.cases.length} pass`);

// ---------------------------------------------------------------------
// Findings register
// ---------------------------------------------------------------------
const sortedFindings = [...findingGroups.values()].sort((a, b) => {
  if (a.check !== b.check) return a.check.localeCompare(b.check);
  return a.groupKey.localeCompare(b.groupKey);
});
sortedFindings.forEach((f, i) => {
  f.id = `FIND-${String(i + 1).padStart(2, '0')}`;
});

function buildRegister(findings: Finding[]): string {
  const header = `# Conformance findings register

Findings from \`npm run conformance\` (research/conformance/), the exhaustive
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
`;
  const rows = findings
    .map(
      (f) =>
        `| ${f.id} | ${f.check} | ${f.count} | ${f.description.replace(/\|/g, '\\|')} | ${f.cites.join('; ') || '-'} | candidate |`,
    )
    .join('\n');
  return header + rows + '\n';
}

const newRegister = buildRegister(sortedFindings);

if (!sampleSize) {
  mkdirSync(FINDINGS_DIR, { recursive: true });
  let stale = false;
  if (existsSync(REGISTER_PATH)) {
    const current = readFileSync(REGISTER_PATH, 'utf8');
    if (current !== newRegister) stale = true;
  } else {
    stale = true;
  }

  writeFileSync(REGISTER_PATH, newRegister);
  for (const f of sortedFindings) {
    const fixturePath = join(FINDINGS_DIR, `${f.id}.json`);
    const fixtureContent = JSON.stringify(
      {
        id: f.id,
        check: f.check,
        description: f.description,
        cites: f.cites,
        records: f.count,
        facts: f.sampleFacts,
        prose: describeVessel(f.sampleFacts),
      },
      null,
      2,
    ) + '\n';
    if (!existsSync(fixturePath) || readFileSync(fixturePath, 'utf8') !== fixtureContent) {
      stale = true;
    }
    writeFileSync(fixturePath, fixtureContent);
  }

  // A finding that has gone away leaves its fixture behind; remove it, and
  // treat that as staleness too.
  const wanted = new Set(sortedFindings.map((f) => `${f.id}.json`));
  for (const name of readdirSync(FINDINGS_DIR)) {
    if (!/^FIND-\d+\.json$/.test(name) || wanted.has(name)) continue;
    rmSync(join(FINDINGS_DIR, name));
    stale = true;
  }

  if (stale) {
    console.error(
      '\nfindings register was stale relative to this run: run `npm run conformance` and commit research/conformance/findings/.',
    );
  }

  console.log(`\n${sortedFindings.length} distinct findings written to research/conformance/findings/`);
  for (const f of sortedFindings) {
    console.log(`  ${f.id}  [${f.check}]  n=${f.count}  ${f.description}`);
  }

  if (conformanceFailures > 0) {
    console.error(`\nCONFORMANCE FAILED: ${conformanceFailures} records where engine != reference.`);
    process.exit(1);
  }
  if (stale) {
    process.exit(1);
  }
} else {
  console.log(`\n${sortedFindings.length} distinct findings in this sample run (register not written in --sample mode)`);
  if (conformanceFailures > 0) {
    console.error(`\nCONFORMANCE FAILED: ${conformanceFailures} records where engine != reference.`);
    process.exit(1);
  }
}

console.log('\nconformance run complete.');
