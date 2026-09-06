// Runs the Z3 encoding of the applicability table and cross-checks every
// answer twice over (issue #1 Phase 2, P2.1).
//
//   npm run z3                 # the whole query set
//   npm run z3 -- --verbose    # plus the decoded model for every sat
//
// For each query in queries.ts:
//
//   1. Z3 answers sat or unsat over the REALS (numeric axes are Real, not
//      the enumeration's finite grid of representatives).
//   2. The answer is compared against the expectation recorded in
//      expectations.json -- which is what the exhaustive enumeration
//      observed, marked pencil and untriaged. A disagreement is the most
//      valuable output this harness has and is reported as such. It is
//      never to be resolved by editing expectations.json to match a run.
//   3. Every sat model is decoded back into a FactRecord and replayed
//      through BOTH src/evaluate.ts and research/conformance/reference.ts.
//      A model the solver calls a witness and the evaluators do not is a
//      bug in the encoding, and this is the check that catches it.
//   4. Every sat model is also snapped to the enumeration's representative
//      grid and replayed again. If a property holds at the solver's point
//      and not at the grid point in the same threshold interval, the
//      partition lemma that P3.1 is meant to prove is FALSE, and the
//      counterexample is right there. That is reported loudest of all.
//
// Exits non-zero on any of: a Z3/expectation disagreement, a model the
// evaluators reject, engine and reference disagreeing on a model, or a
// partition-lemma counterexample. Not wired into `npm test`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import applicabilityJson from 'colregs/data/applicability.json' with { type: 'json' };
import { init } from 'z3-solver';

import { predicateMatches, resolveModality } from '../../src/evaluate.js';
import type { ApplicabilityData, Entry, FactRecord, FactValue } from '../../src/types.js';
import {
  referenceAppliedEntries,
  referenceResolveModality,
  referenceWhenMatches,
} from '../conformance/reference.js';
import { describeVessel } from '../conformance/prose.js';
import { offGridAxes, parseNumeral, snapRecord } from './decode.js';
import { buildEncoding, type Encoding } from './encode.js';
import {
  buildQueries,
  loadExpectations,
  queriesToSmtLib,
  type ModelCheck,
  type Query,
} from './queries.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, 'out');

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');

const data = applicabilityJson as unknown as ApplicabilityData;
const byId = new Map<string, Entry>(data.entries.map((e) => [e.id, e]));

// ---------------------------------------------------------------------
// Replaying a model through the two evaluators
// ---------------------------------------------------------------------

type Evaluator = 'engine' | 'reference';

function appliedBy(which: Evaluator, facts: FactRecord): Set<string> {
  return new Set(
    which === 'engine'
      ? data.entries.filter((e) => predicateMatches(e.when, facts)).map((e) => e.id)
      : referenceAppliedEntries(data, facts),
  );
}

function modalityBy(which: Evaluator, entry: Entry, facts: FactRecord): string {
  return which === 'engine'
    ? resolveModality(entry, facts)
    : referenceResolveModality(entry, facts);
}

function firstBranchIndex(which: Evaluator, entry: Entry, facts: FactRecord): number {
  const branches = entry.modality_by ?? [];
  for (let i = 0; i < branches.length; i++) {
    const hit =
      which === 'engine'
        ? predicateMatches(branches[i].when, facts)
        : referenceWhenMatches(branches[i].when, facts);
    if (hit) return i;
  }
  return -1;
}

/** Does the model satisfy the property its query asserted, according to
 * `which` evaluator? Returns null on success, or why it failed. */
function replay(which: Evaluator, check: ModelCheck, facts: FactRecord): string | null {
  const applied = appliedBy(which, facts);
  switch (check.kind) {
    case 'both-shall': {
      for (const id of [check.a, check.b]) {
        if (!applied.has(id)) return `${id} does not apply`;
        const m = modalityBy(which, byId.get(id)!, facts);
        if (m !== 'shall') return `${id} resolves to '${m}', not 'shall'`;
      }
      return null;
    }
    case 'no-entries-apply':
      return applied.size === 0 ? null : `${applied.size} entries apply: ${[...applied].join(', ')}`;
    case 'entry-applies':
      return applied.has(check.id) ? null : `${check.id} does not apply`;
    case 'entry-unresolved': {
      if (!applied.has(check.id)) return `${check.id} does not apply`;
      const m = modalityBy(which, byId.get(check.id)!, facts);
      return m === 'conditional' ? null : `${check.id} resolves to '${m}', not unresolved`;
    }
    case 'branch-first-match': {
      if (!applied.has(check.id)) return `${check.id} does not apply`;
      const i = firstBranchIndex(which, byId.get(check.id)!, facts);
      return i === check.index
        ? null
        : `first matching modality_by branch is ${i < 0 ? 'none' : i}, not ${check.index}`;
    }
  }
}

// ---------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------

interface Result {
  query: Query;
  answer: 'sat' | 'unsat' | 'unknown';
  ms: number;
  facts?: FactRecord;
  offGrid?: string[];
  problems: string[];
  lemmaCounterexample?: string;
}

async function main(): Promise<void> {
  const wall0 = Date.now();

  const encoding: Encoding = buildEncoding(data);
  const expectations = loadExpectations();
  const queries = buildQueries(data, expectations);

  mkdirSync(OUT_DIR, { recursive: true });
  const smtPath = join(OUT_DIR, 'applicability.smt2');
  writeFileSync(smtPath, encoding.base + queriesToSmtLib(queries));

  console.log(`Z3 encoding of the applicability table (issue #1, P2.1)`);
  console.log(`  entries      ${data.entries.length}`);
  console.log(`  axes         ${encoding.axes.length}`);
  console.log(`  queries      ${queries.length}`);
  console.log(`  expectations ${expectations.status} (research/z3/expectations.json)`);
  console.log(`  SMT-LIB      ${smtPath}`);
  console.log('');

  const { Context, em } = await init();
  const Z3 = Context('main');
  const solver = new Z3.Solver();
  solver.fromString(encoding.base);

  // Handles for the declared constants, by the same names and sorts the
  // theory declares, so the model can be read back through them.
  const handles = encoding.axes.map((axis) => ({
    axis,
    expr:
      axis.kind === 'boolean'
        ? Z3.Bool.const(axis.key)
        : axis.kind === 'numeric'
          ? Z3.Real.const(axis.key)
          : Z3.Int.const(axis.key),
  }));

  const results: Result[] = [];

  for (const q of queries) {
    const t0 = Date.now();
    solver.push();
    solver.fromString(q.asserts.map((a) => `(assert ${a})`).join('\n'));
    const answer = await solver.check();

    const result: Result = { query: q, answer, ms: 0, problems: [] };

    if (answer === 'sat') {
      const model = solver.model();
      const facts: Record<string, FactValue> = {};
      for (const { axis, expr } of handles) {
        const raw = model.eval(expr as never, true).toString();
        switch (axis.kind) {
          case 'boolean':
            facts[axis.key] = raw === 'true';
            break;
          case 'numeric':
            facts[axis.key] = parseNumeral(raw);
            break;
          case 'enum': {
            const idx = parseNumeral(raw);
            const value = axis.values[idx];
            if (value === undefined) {
              result.problems.push(
                `model gives ${axis.key} index ${idx}, outside the declared range; the range assertion did not hold`,
              );
              facts[axis.key] = axis.values[0];
            } else {
              facts[axis.key] = value;
            }
            break;
          }
        }
      }
      const record = facts as FactRecord;
      result.facts = record;
      result.offGrid = offGridAxes(encoding.axes, record);

      // (3) the model must be a witness for both evaluators.
      for (const which of ['engine', 'reference'] as Evaluator[]) {
        const why = replay(which, q.check, record);
        if (why) result.problems.push(`${which} rejects the model: ${why}`);
      }

      // (4) partition lemma: does the property survive snapping to the
      // enumeration's grid?
      if (result.offGrid.length > 0 && result.problems.length === 0) {
        const snapped = snapRecord(encoding.axes, record);
        const why = replay('engine', q.check, snapped);
        if (why) {
          result.lemmaCounterexample =
            `the property holds at the solver's point but not at the representative ` +
            `in the same threshold interval (${why}). Off-grid: ${result.offGrid.join(', ')}. ` +
            `The enumeration could not have found this record.`;
        }
      }
    }

    solver.pop();
    result.ms = Date.now() - t0;
    results.push(result);
  }

  // -------------------------------------------------------------------
  // Report
  // -------------------------------------------------------------------
  const disagreements = results.filter((r) => r.answer !== r.query.expect);
  const rejected = results.filter((r) => r.problems.length > 0);
  const lemma = results.filter((r) => r.lemmaCounterexample);

  const width = Math.max(...results.map((r) => r.query.id.length));
  for (const r of results) {
    const flag = r.answer === r.query.expect ? '  ' : '!!';
    const note = r.query.recorded
      ? `  [${r.query.recorded.finding ?? 'recorded'}${r.query.recorded.triaged ? '' : ', untriaged'}]`
      : '';
    console.log(
      `${flag} ${r.query.id.padEnd(width)}  ${r.answer.padEnd(7)} expect ${r.query.expect.padEnd(5)} ${String(r.ms).padStart(5)}ms${note}`,
    );
    if (verbose && r.facts) {
      console.log(`     ${describeVessel(r.facts)}`);
      if (r.offGrid && r.offGrid.length > 0) {
        console.log(`     off the enumeration's grid: ${r.offGrid.join(', ')}`);
      }
    }
  }

  console.log('');
  const satCount = results.filter((r) => r.answer === 'sat').length;
  console.log(
    `${results.length} queries: ${satCount} sat, ${results.length - satCount - results.filter((r) => r.answer === 'unknown').length} unsat, ` +
      `${results.filter((r) => r.answer === 'unknown').length} unknown`,
  );
  console.log(
    `${results.filter((r) => (r.offGrid?.length ?? 0) > 0).length} sat models land off the enumeration's representative grid ` +
      `(expected: the solver is free over the reals).`,
  );

  if (disagreements.length > 0) {
    console.log('');
    console.log('=== Z3 DISAGREES WITH THE RECORDED EXPECTATION ===');
    console.log('This is the result worth having. Do not edit expectations.json to');
    console.log('silence it: one of the two harnesses is wrong, or the expectation was.');
    for (const r of disagreements) {
      console.log('');
      console.log(`  ${r.query.id}: Z3 says ${r.answer}, expectations.json says ${r.query.expect}`);
      console.log(`    ${r.query.title}`);
      if (r.query.recorded) {
        console.log(`    recorded ${r.query.recorded.observed_on}: ${r.query.recorded.observed}`);
      }
      if (r.facts) console.log(`    witness: ${describeVessel(r.facts)}`);
      if (r.facts) console.log(`    facts:   ${JSON.stringify(r.facts)}`);
    }
  }

  if (lemma.length > 0) {
    console.log('');
    console.log('=== PARTITION-LEMMA COUNTEREXAMPLE ===');
    console.log("The claim that a predicate over numeric facts is decided by the");
    console.log('enumeration\'s representatives (P3.1) does not hold here.');
    for (const r of lemma) {
      console.log('');
      console.log(`  ${r.query.id}: ${r.lemmaCounterexample}`);
      console.log(`    facts: ${JSON.stringify(r.facts)}`);
    }
  }

  if (rejected.length > 0) {
    console.log('');
    console.log('=== A MODEL THE EVALUATORS DO NOT ACCEPT ===');
    console.log('The encoding and the evaluator disagree: encode.ts is wrong, or');
    console.log('the evaluators are.');
    for (const r of rejected) {
      console.log('');
      console.log(`  ${r.query.id}`);
      for (const p of r.problems) console.log(`    ${p}`);
      console.log(`    facts: ${JSON.stringify(r.facts)}`);
    }
  }

  const wall = Date.now() - wall0;
  console.log('');
  console.log(`wall clock: ${(wall / 1000).toFixed(1)}s (solver: ${(results.reduce((a, r) => a + r.ms, 0) / 1000).toFixed(1)}s)`);

  em.PThread.terminateAllThreads();

  const failed = disagreements.length + rejected.length + lemma.length;
  if (failed > 0) {
    console.log('');
    console.log(`FAILED: ${failed} ${failed === 1 ? 'query needs' : 'queries need'} a human.`);
    process.exitCode = 1;
  }
}

await main();
