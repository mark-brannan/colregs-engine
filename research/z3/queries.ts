// The P1.3 consistency and coverage properties, restated as solver queries
// over the definitions encode.ts emits.
//
// Each query is a set of assertions plus the answer the enumeration
// (research/conformance/) already gives. run.ts fails when Z3 and that
// expectation disagree, because a disagreement is the most valuable thing
// this harness can produce: the enumeration walks one representative per
// threshold interval, the solver walks the reals, and they should still
// agree on every one of these.
//
// Where the enumeration found a real conflict, the expectation is `sat` and
// the query carries the finding id it corresponds to. Those carve-outs are
// named here, not filtered out --- a query whose expectation is `sat`
// still runs, still gets its model decoded, and still gets that model
// replayed through the engine.

import type { ApplicabilityData, Entry } from '../../src/types.js';
import { APPLIES, BRANCH, SHALL, UNRESOLVED, sym } from './encode.js';

export type Expectation = 'sat' | 'unsat';

export interface Query {
  id: string;
  /** Which P1.3 property this is an instance of. */
  property:
    | 'conflicting-shall'
    | 'no-obligation'
    | 'entry-fires'
    | 'unresolved-conditional'
    | 'branch-reachable';
  /** One line, for the SMT-LIB file and the run log. */
  title: string;
  /** SMT-LIB assertions, without the surrounding push/check-sat/pop. */
  asserts: string[];
  expect: Expectation;
  /**
   * Set when `expect` is 'sat' because the enumeration found a real
   * finding here --- the carve-out, named and linked rather than skipped.
   */
  carveOut?: { finding: string; why: string };
  /** What the decoded model must satisfy when the engine replays it. */
  check: ModelCheck;
}

export type ModelCheck =
  | { kind: 'both-shall'; a: string; b: string }
  | { kind: 'no-entries-apply' }
  | { kind: 'entry-applies'; id: string }
  | { kind: 'entry-unresolved'; id: string }
  | { kind: 'branch-first-match'; id: string; index: number };

/** The two conflicting-shall carve-outs the enumeration found, keyed by the
 * ordered entry pair. Anything else that comes back `sat` is new. */
export const CONFLICT_CARVE_OUTS: Record<string, { finding: string; why: string }> = {
  '26b-id,30a': {
    finding: 'FIND-01',
    why:
      "26(b)(i) (a vessel fishing, not trawling, showing red-over-white) and 30(a) " +
      "(anchor lights) both resolve to 'shall' for a vessel that is fishing while " +
      'anchored, and 26(b)(i) rel:excludes 30(a). A real contradiction in the data, ' +
      'awaiting human triage.',
  },
  '26c-id,30a': {
    finding: 'FIND-02',
    why:
      "26(c)(i) (a vessel trawling) and 30(a) both resolve to 'shall' for a vessel " +
      'trawling while anchored, with the same rel:excludes contradiction as FIND-01.',
  },
};

/** The one carve-out for "every satisfiable record carries an obligation":
 * a moored vessel. Rule 30 covers anchored and aground; the data has no
 * entry whose `when` admits `position:moored`, so a moored vessel has no
 * lawful display at all. */
export const NO_OBLIGATION_CARVE_OUT = {
  finding: 'FIND-03',
  why:
    'A vessel with fact:position = position:moored matches no entry, so the data ' +
    'prescribes no display for it. Rule 30 speaks of vessels at anchor and aground; ' +
    'whether a moored vessel is out of scope or a gap is a human call.',
};

/** Ordered pairs of entries where one rel:excludes the other --- the only
 * pairs a conflicting-shall query has to consider, exactly as run.ts's
 * `excludingPairs` computes them. */
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

export function buildQueries(data: ApplicabilityData): Query[] {
  const queries: Query[] = [];

  // (a) No two conflicting `shall` entries can hold simultaneously.
  for (const [a, b] of excludingPairs(data.entries)) {
    const carveOut = CONFLICT_CARVE_OUTS[`${a},${b}`];
    queries.push({
      id: `CONFLICT/${a}+${b}`,
      property: 'conflicting-shall',
      title: `${a} and ${b} both resolve to 'shall' (one rel:excludes the other)`,
      asserts: [SHALL(a), SHALL(b)],
      expect: carveOut ? 'sat' : 'unsat',
      carveOut,
      check: { kind: 'both-shall', a, b },
    });
  }

  // (b) No satisfiable record with zero obligations. Asked twice: once as
  // stated, which is `sat` because of FIND-03, and once with the carve-out
  // subtracted, which must be `unsat`. The second query is what makes the
  // exception a bounded, checkable claim rather than a filter.
  const nothingApplies = data.entries.map((e) => `(not ${APPLIES(e.id)})`);
  queries.push({
    id: 'NO-OBLIGATION/any',
    property: 'no-obligation',
    title: 'some record makes no entry apply at all',
    asserts: nothingApplies,
    expect: 'sat',
    carveOut: NO_OBLIGATION_CARVE_OUT,
    check: { kind: 'no-entries-apply' },
  });
  queries.push({
    id: 'NO-OBLIGATION/not-moored',
    property: 'no-obligation',
    title: 'some NON-moored record makes no entry apply at all',
    asserts: [...nothingApplies, `(not (= ${sym('fact:position')} ${sym('position:moored')}))`],
    expect: 'unsat',
    check: { kind: 'no-entries-apply' },
  });

  // (c) Every entry is satisfiable --- the never-fires check.
  for (const e of data.entries) {
    queries.push({
      id: `FIRES/${e.id}`,
      property: 'entry-fires',
      title: `entry ${e.id} (${e.cite}) can apply to some record`,
      asserts: [APPLIES(e.id)],
      expect: 'sat',
      check: { kind: 'entry-applies', id: e.id },
    });
  }

  // The two consistency checks run.ts also reports: an applied conditional
  // entry no modality_by branch resolves, and a branch that is never the
  // first match.
  for (const e of data.entries) {
    if (e.modality !== 'conditional') continue;
    queries.push({
      id: `UNRESOLVED/${e.id}`,
      property: 'unresolved-conditional',
      title: `entry ${e.id} applies but no modality_by branch matches`,
      asserts: [UNRESOLVED(e.id)],
      expect: 'unsat',
      check: { kind: 'entry-unresolved', id: e.id },
    });
    (e.modality_by ?? []).forEach((b, i) => {
      queries.push({
        id: `BRANCH/${e.id}:${i}`,
        property: 'branch-reachable',
        title: `entry ${e.id}'s modality_by[${i}] (-> ${b.modality}) can be the first match`,
        asserts: [BRANCH(e.id, i)],
        expect: 'sat',
        check: { kind: 'branch-first-match', id: e.id, index: i },
      });
    });
  }

  return queries;
}

/** The queries as one runnable SMT-LIB script: `z3 applicability.smt2`
 * prints an `echo`ed header and a `sat`/`unsat` for each. */
export function queriesToSmtLib(queries: Query[]): string {
  const lines: string[] = [
    '',
    ';; ---------------------------------------------------------------',
    ';; Queries --- each block echoes its id, its expected answer and',
    ';; (where the expectation is sat) the finding that explains it.',
    ';; ---------------------------------------------------------------',
  ];
  for (const q of queries) {
    lines.push('');
    lines.push(`(echo "${q.id} | expect ${q.expect}${q.carveOut ? ` | ${q.carveOut.finding}` : ''} | ${q.title.replace(/"/g, "'")}")`);
    lines.push('(push 1)');
    for (const a of q.asserts) lines.push(`(assert ${a})`);
    lines.push('(check-sat)');
    lines.push('(pop 1)');
  }
  lines.push('');
  return lines.join('\n');
}
