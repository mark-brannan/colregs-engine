// The P1.3 consistency and coverage properties, restated as solver queries
// over the definitions encode.ts emits.
//
// Each query is a set of assertions plus the answer expected of it. The
// expectations are NOT in this file: they live in expectations.json, marked
// pencil, each carrying the date it was observed and `triaged: false`. That
// separation is deliberate. FIND-01, FIND-02 and FIND-03 are observations
// from one enumeration run, not rulings; when a maintainer triages them the
// change should be a data edit, not a code edit.
//
// run.ts reports when Z3 and the recorded expectation disagree. A
// disagreement is the most valuable thing this harness can produce -- the
// enumeration walks one representative per threshold interval, the solver
// walks the reals -- and is never to be resolved by editing expectations.json
// to match the run.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ApplicabilityData, Entry } from '../../src/types.js';
import { APPLIES, BRANCH, SHALL, UNRESOLVED, sym } from './encode.js';

export type Expectation = 'sat' | 'unsat';

export type Property =
  | 'conflicting-shall'
  | 'no-obligation'
  | 'entry-fires'
  | 'unresolved-conditional'
  | 'branch-reachable';

/** One `queries` record in expectations.json. Prose fields are carried
 * through to the run log verbatim; this file never restates them. */
export interface RecordedExpectation {
  expect: Expectation;
  triaged: boolean;
  observed_on: string;
  observed_by: string;
  finding?: string;
  observed: string;
  would_settle: string;
}

export interface Expectations {
  status: string;
  defaults: Record<string, Expectation | string>;
  queries: Record<string, RecordedExpectation>;
}

const EXPECTATIONS_PATH = fileURLToPath(new URL('./expectations.json', import.meta.url));

export function loadExpectations(path: string = EXPECTATIONS_PATH): Expectations {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as Expectations;
  if (parsed.status !== 'pencil') {
    // Not a hard failure of the run, but the README's claim about this file
    // and the file itself must not drift apart silently.
    throw new Error(
      `${path} is marked "${parsed.status}"; research/z3/README.md documents it as pencil. Update both or neither.`,
    );
  }
  return parsed;
}

export interface Query {
  id: string;
  /** Which P1.3 property this is an instance of. */
  property: Property;
  /** One line, for the SMT-LIB file and the run log. */
  title: string;
  /** SMT-LIB assertions, without the surrounding push/check-sat/pop. */
  asserts: string[];
  expect: Expectation;
  /** Present when expectations.json names this query explicitly. */
  recorded?: RecordedExpectation;
  /** What the decoded model must satisfy when the evaluators replay it. */
  check: ModelCheck;
}

export type ModelCheck =
  | { kind: 'both-shall'; a: string; b: string }
  | { kind: 'no-entries-apply' }
  | { kind: 'entry-applies'; id: string }
  | { kind: 'entry-unresolved'; id: string }
  | { kind: 'branch-first-match'; id: string; index: number };

/** Ordered pairs of entries where one rel:excludes the other -- the only
 * pairs a conflicting-shall query has to consider, exactly as
 * research/conformance/run.ts pairs them. */
export function excludingPairs(entries: Entry[]): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      if ((a['rel:excludes'] ?? []).includes(b.id) || (b['rel:excludes'] ?? []).includes(a.id)) {
        out.push([a.id, b.id]);
      }
    }
  }
  return out;
}

export function buildQueries(data: ApplicabilityData, expectations: Expectations): Query[] {
  const queries: Query[] = [];

  const resolve = (id: string, property: Property): Pick<Query, 'expect' | 'recorded'> => {
    const recorded = expectations.queries[id];
    if (recorded) return { expect: recorded.expect, recorded };
    const fallback = expectations.defaults[property];
    if (fallback !== 'sat' && fallback !== 'unsat') {
      throw new Error(
        `expectations.json has no default for property "${property}" (query ${id})`,
      );
    }
    return { expect: fallback };
  };

  // (a) No two entries where one rel:excludes the other can both resolve to
  // `shall` for the same record.
  for (const [a, b] of excludingPairs(data.entries)) {
    const id = `CONFLICT/${a}+${b}`;
    queries.push({
      id,
      property: 'conflicting-shall',
      title: `${a} and ${b} both resolve to 'shall' (one rel:excludes the other)`,
      asserts: [SHALL(a), SHALL(b)],
      ...resolve(id, 'conflicting-shall'),
      check: { kind: 'both-shall', a, b },
    });
  }

  // (b) No satisfiable record with zero obligations. Asked twice: once as
  // stated, and once with fact:position = position:moored ruled out. The
  // second is what makes the exception a bounded, checkable claim rather
  // than a filter -- if some other record with no obligation exists, that
  // query comes back sat and the solver hands us the record.
  const nothingApplies = data.entries.map((e) => `(not ${APPLIES(e.id)})`);
  queries.push({
    id: 'NO-OBLIGATION/any',
    property: 'no-obligation',
    title: 'some record makes no entry apply at all',
    asserts: nothingApplies,
    ...resolve('NO-OBLIGATION/any', 'no-obligation'),
    check: { kind: 'no-entries-apply' },
  });
  queries.push({
    id: 'NO-OBLIGATION/not-moored',
    property: 'no-obligation',
    title: 'some record with fact:position other than position:moored makes no entry apply',
    asserts: [...nothingApplies, `(not (= ${sym('fact:position')} ${sym('position:moored')}))`],
    ...resolve('NO-OBLIGATION/not-moored', 'no-obligation'),
    check: { kind: 'no-entries-apply' },
  });

  // (c) Every entry is satisfiable -- the never-fires check.
  for (const e of data.entries) {
    const id = `FIRES/${e.id}`;
    queries.push({
      id,
      property: 'entry-fires',
      title: `entry ${e.id} (${e.cite}) can apply to some record`,
      asserts: [APPLIES(e.id)],
      ...resolve(id, 'entry-fires'),
      check: { kind: 'entry-applies', id: e.id },
    });
  }

  // The two consistency checks research/conformance/run.ts also reports: an
  // applied conditional entry no modality_by branch resolves, and a branch
  // that is never the first match.
  for (const e of data.entries) {
    if (e.modality !== 'conditional') continue;
    const unresolvedId = `UNRESOLVED/${e.id}`;
    queries.push({
      id: unresolvedId,
      property: 'unresolved-conditional',
      title: `entry ${e.id} applies but no modality_by branch matches`,
      asserts: [UNRESOLVED(e.id)],
      ...resolve(unresolvedId, 'unresolved-conditional'),
      check: { kind: 'entry-unresolved', id: e.id },
    });
    (e.modality_by ?? []).forEach((b, i) => {
      const branchId = `BRANCH/${e.id}:${i}`;
      queries.push({
        id: branchId,
        property: 'branch-reachable',
        title: `entry ${e.id}'s modality_by[${i}] (-> ${b.modality}) can be the first match`,
        asserts: [BRANCH(e.id, i)],
        ...resolve(branchId, 'branch-reachable'),
        check: { kind: 'branch-first-match', id: e.id, index: i },
      });
    });
  }

  return queries;
}

/** The queries as one runnable SMT-LIB script: `z3 applicability.smt2`
 * prints an `echo`ed header and a `sat`/`unsat` for each. Written out by
 * run.ts so the theory can be handed to any other solver unchanged. */
export function queriesToSmtLib(queries: Query[]): string {
  const lines: string[] = [
    '',
    ';; ---------------------------------------------------------------',
    ';; Queries --- each block echoes its id, the expectation recorded in',
    ';; expectations.json, and (where one is recorded) the finding id.',
    ';; An expectation marked [untriaged] is an observation from one',
    ';; enumeration run, not a ruling.',
    ';; ---------------------------------------------------------------',
  ];
  for (const q of queries) {
    const tag = q.recorded
      ? ` | ${q.recorded.finding ?? 'recorded'}${q.recorded.triaged ? '' : ' [untriaged]'}`
      : '';
    lines.push('');
    lines.push(`(echo "${q.id} | expect ${q.expect}${tag} | ${q.title.replace(/"/g, "'")}")`);
    lines.push('(push 1)');
    for (const a of q.asserts) lines.push(`(assert ${a})`);
    lines.push('(check-sat)');
    lines.push('(pop 1)');
  }
  lines.push('');
  return lines.join('\n');
}
