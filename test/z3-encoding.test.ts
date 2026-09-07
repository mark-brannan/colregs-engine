// encodeConstraint / encodePredicate against literal predicates, including
// `not` and both `any_of` forms, which no display entry of the pinned colregs
// uses yet (asserted below), so nothing else in the repo exercises them.
//
// Then, against the real theory under Z3: a differential check on random
// records (the encoding's truth value must equal `predicateMatches`), the
// modality layer against `resolveModality`, and the three recorded findings
// as positive controls. String assertions pin the shape; Z3 pins the meaning.

import { describe, expect, it } from 'vitest';
import applicabilityJson from 'colregs/data/applicability.json' with { type: 'json' };
import { init } from 'z3-solver';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { appliedEntries, predicateMatches, resolveModality } from '../src/evaluate.js';
import type { ApplicabilityData, Constraint, Entry, FactRecord, FactValue, Predicate } from '../src/types.js';
import { extractAxes, type Axis } from '../research/conformance/enumerate.js';
import {
  APPLIES,
  SHALL,
  buildEncoding,
  encodeConstraint,
  encodePredicate,
  isDisplay,
  sym,
  EncodingError,
} from '../research/z3/encode.js';
import { parseNumeral, snapToGrid } from '../research/z3/decode.js';
import { buildQueries, loadExpectations } from '../research/z3/queries.js';

const boolAxis: Axis = { kind: 'boolean', key: 'fact:making_way' as never, values: [true, false] };
const numAxis: Axis = {
  kind: 'numeric',
  key: 'fact:length_m' as never,
  constants: [7, 12, 50],
  values: [6, 7, 9.5, 12, 31, 50, 51],
};
const enumAxis: Axis = {
  kind: 'enum',
  key: 'fact:activity' as never,
  values: ['activity:none', 'activity:ram', 'activity:ram_underwater', 'activity:fishing'],
};

const axes = new Map<string, Axis>([
  [boolAxis.key, boolAxis],
  [numAxis.key, numAxis],
  [enumAxis.key, enumAxis],
]);

const enc = (axis: Axis, c: unknown) => encodeConstraint(axis, c as Constraint);

describe('encodeConstraint', () => {
  it('encodes boolean equality', () => {
    expect(enc(boolAxis, true)).toBe('|fact:making_way|');
    expect(enc(boolAxis, false)).toBe('(not |fact:making_way|)');
  });

  it('encodes numeric comparisons, conjoined when a constraint carries several', () => {
    expect(enc(numAxis, { gte: 12 })).toBe('(>= |fact:length_m| 12.0)');
    expect(enc(numAxis, { lt: 50 })).toBe('(< |fact:length_m| 50.0)');
    expect(enc(numAxis, { gte: 12, lt: 50 })).toBe(
      '(and (>= |fact:length_m| 12.0) (< |fact:length_m| 50.0))',
    );
  });

  it('encodes non-integer and negative constants as Real literals', () => {
    expect(enc(numAxis, { gt: 9.5 })).toBe('(> |fact:length_m| 9.5)');
    expect(enc(numAxis, { gt: -3 })).toBe('(> |fact:length_m| (- 3.0))');
  });

  it('encodes an enum scalar, and admits the values that refine it', () => {
    expect(enc(enumAxis, 'activity:fishing')).toBe('(= |fact:activity| |activity:fishing|)');
    // activity:ram_underwater refines activity:ram (src/evaluate.ts REFINEMENTS)
    expect(enc(enumAxis, 'activity:ram')).toBe(
      '(or (= |fact:activity| |activity:ram|) (= |fact:activity| |activity:ram_underwater|))',
    );
  });

  it('encodes a list constraint as membership', () => {
    expect(enc(enumAxis, ['activity:none', 'activity:fishing'])).toBe(
      '(or (= |fact:activity| |activity:none|) (= |fact:activity| |activity:fishing|))',
    );
  });

  it('encodes `not`', () => {
    expect(enc(boolAxis, { not: true })).toBe('(not |fact:making_way|)');
    expect(enc(numAxis, { not: { gte: 12 } })).toBe('(not (>= |fact:length_m| 12.0))');
    expect(enc(enumAxis, { not: 'activity:fishing' })).toBe(
      '(not (= |fact:activity| |activity:fishing|))',
    );
  });

  it('encodes constraint-level `any_of` as a disjunction', () => {
    expect(enc(numAxis, { any_of: [{ lt: 7 }, { gte: 50 }] })).toBe(
      '(or (< |fact:length_m| 7.0) (>= |fact:length_m| 50.0))',
    );
  });

  it('encodes `not` of `any_of`, and `any_of` of `not`', () => {
    expect(enc(enumAxis, { not: { any_of: ['activity:none', 'activity:fishing'] } })).toBe(
      '(not (or (= |fact:activity| |activity:none|) (= |fact:activity| |activity:fishing|)))',
    );
    expect(enc(enumAxis, { any_of: [{ not: 'activity:none' }, 'activity:fishing'] })).toBe(
      '(or (not (= |fact:activity| |activity:none|)) (= |fact:activity| |activity:fishing|))',
    );
  });

  it('is false, not an error, where the engine takes an early return on type', () => {
    // valueMatches: `typeof value !== 'number'` returns false for a numeric
    // constraint on a non-numeric fact -- so its negation is true.
    expect(enc(enumAxis, { gte: 5 })).toBe('false');
    expect(enc(enumAxis, { not: { gte: 5 } })).toBe('(not false)');
    expect(enc(boolAxis, 'activity:none')).toBe('false');
    expect(enc(numAxis, true)).toBe('false');
  });

  it('is false for an enum value facts.json does not declare', () => {
    expect(enc(enumAxis, 'activity:not-a-real-value')).toBe('false');
  });

  it('encodes an empty any_of, and a bare `{}`, as false', () => {
    expect(enc(enumAxis, { any_of: [] })).toBe('false');
    // `{}` has none of gte/gt/lte/lt, so the engine falls through to `===`.
    expect(enc(numAxis, {})).toBe('false');
    expect(enc(enumAxis, {})).toBe('false');
  });
});

describe('encodePredicate', () => {
  it('conjoins the constraints of a `when`', () => {
    const when = { 'fact:making_way': true, 'fact:length_m': { gte: 12 } } as unknown as Predicate;
    expect(encodePredicate(axes, when)).toBe(
      '(and |fact:making_way| (>= |fact:length_m| 12.0))',
    );
  });

  it('encodes an empty `when` as true -- it applies to everything', () => {
    expect(encodePredicate(axes, {} as Predicate)).toBe('true');
  });

  it('encodes the reserved `any_of` key as predicate-level disjunction', () => {
    const when = {
      any_of: [{ 'fact:making_way': true }, { 'fact:length_m': { lt: 7 } }],
    } as unknown as Predicate;
    expect(encodePredicate(axes, when)).toBe('(or |fact:making_way| (< |fact:length_m| 7.0))');
  });

  it('nests a predicate-level any_of inside a conjunction', () => {
    const when = {
      'fact:making_way': true,
      any_of: [{ 'fact:length_m': { lt: 7 } }, { 'fact:activity': 'activity:fishing' }],
    } as unknown as Predicate;
    expect(encodePredicate(axes, when)).toBe(
      '(and |fact:making_way| (or (< |fact:length_m| 7.0) (= |fact:activity| |activity:fishing|)))',
    );
  });

  it('throws when a predicate reads an axis the extractor did not find', () => {
    const when = { 'fact:unknown': true } as unknown as Predicate;
    expect(() => encodePredicate(axes, when)).toThrow(EncodingError);
  });
});

describe('sym', () => {
  it('quotes an identifier carrying a colon', () => {
    expect(sym('fact:length_m')).toBe('|fact:length_m|');
  });
  it('refuses one that cannot be quoted', () => {
    expect(() => sym('a|b')).toThrow();
    expect(() => sym('a\\b')).toThrow();
  });
});

describe('model decoding', () => {
  it('parses the numeral forms Z3 prints', () => {
    expect(parseNumeral('4.0')).toBe(4);
    expect(parseNumeral('(- 3.0)')).toBe(-3);
    expect(parseNumeral('1/2')).toBe(0.5);
    expect(parseNumeral('(/ 1.0 2.0)')).toBe(0.5);
    expect(() => parseNumeral('(root-obj (+ (^ x 2) (- 2)) 1)')).toThrow();
  });

  it('snaps a value to the representative of its threshold interval', () => {
    expect(snapToGrid(numAxis, 0)).toBe(6); // below the first constant
    expect(snapToGrid(numAxis, 12)).toBe(12); // on a constant
    expect(snapToGrid(numAxis, 8)).toBe(9.5); // the 7..12 midpoint
    expect(snapToGrid(numAxis, 40)).toBe(31); // the 12..50 midpoint
    expect(snapToGrid(numAxis, 1e6)).toBe(51); // above the last
    expect(snapToGrid(boolAxis, 1)).toBe(1); // not a numeric axis
  });
});

// ---------------------------------------------------------------------
// Against the real theory under Z3
// ---------------------------------------------------------------------

const data = applicabilityJson as unknown as ApplicabilityData;
const displayEntries = data.entries.filter(isDisplay);
const byId = new Map(displayEntries.map((e) => [e.id, e]));

function finding(id: string): string {
  return fileURLToPath(new URL(`../research/conformance/findings/${id}.json`, import.meta.url));
}

/** `(assert ...)` lines fixing every declared axis to the record's value. */
function pinRecord(realAxes: Axis[], facts: FactRecord): string[] {
  const rec = facts as Record<string, FactValue | undefined>;
  return realAxes.map((a) => {
    const v = rec[a.key];
    if (v === undefined) throw new Error(`record has no value for axis ${a.key}`);
    switch (a.kind) {
      case 'boolean':
        return `(assert (= ${sym(a.key)} ${v}))`;
      case 'numeric':
        return `(assert (= ${sym(a.key)} ${Number.isInteger(v) ? `${v}.0` : v}))`;
      case 'enum':
        return `(assert (= ${sym(a.key)} ${a.values.indexOf(v as string)}))`;
    }
  });
}

/** Ids of display entries whose `when` or modality_by branches use `key`. */
function displayEntriesUsing(key: string): string[] {
  const uses = (x: unknown): boolean =>
    Array.isArray(x)
      ? x.some(uses)
      : typeof x === 'object' && x !== null
        ? Object.entries(x).some(([k, v]) => k === key || uses(v))
        : false;
  return displayEntries
    .filter((e) => uses(e.when) || uses((e.modality_by ?? []).map((b) => b.when)))
    .map((e) => e.id);
}

it('no display entry of the pinned colregs uses `not` or `any_of` yet', () => {
  // When this fails, the literal-predicate tests above are no longer the
  // only exercise of those forms: drop this test and the header comment.
  expect(displayEntriesUsing('not')).toEqual([]);
  expect(displayEntriesUsing('any_of')).toEqual([]);
});

describe('the encoding against Z3', () => {
  const { axes: realAxes } = extractAxes(data);
  const axesByKey = new Map(realAxes.map((a) => [a.key as string, a]));
  const encoding = buildEncoding(data);

  /** Runs `f` with a solver loaded with the base theory; `check` answers one
   * set of assertions inside a push/pop. */
  async function withSolver(f: (check: (asserts: string[]) => Promise<string>) => Promise<void>) {
    const { Context, em } = await init();
    try {
      const Z3 = Context('test');
      const solver = new Z3.Solver();
      solver.fromString(encoding.base);
      await f(async (asserts) => {
        solver.push();
        solver.fromString(asserts.join('\n'));
        const answer = await solver.check();
        solver.pop();
        return answer;
      });
    } finally {
      em.PThread.terminateAllThreads();
    }
  }

  it('matches predicateMatches for every entry on 500 random records', async () => {
    // A deterministic PRNG, so a failure is reproducible from the seed.
    let seed = 20260906;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

    await withSolver(async (check) => {
      for (let n = 0; n < 500; n++) {
        const facts: Record<string, FactValue> = {};
        for (const a of realAxes) {
          switch (a.kind) {
            case 'boolean':
              facts[a.key] = rnd() < 0.5;
              break;
            case 'numeric':
              // Deliberately off the representative grid as often as on it.
              facts[a.key] = Math.round(rnd() * 220 * 2) / 2;
              break;
            case 'enum':
              facts[a.key] = a.values[Math.floor(rnd() * a.values.length)];
              break;
          }
        }
        const record = facts as FactRecord;

        // One check per record: pin it, then ask whether ANY display entry's
        // encoded predicate disagrees with the engine. `unsat` = all agree.
        const disagrees = encoding.entries.map((e) => {
          const expr = encodePredicate(axesByKey, e.when);
          return predicateMatches(e.when, record) ? `(not ${expr})` : expr;
        });
        const answer = await check([
          ...pinRecord(realAxes, record),
          `(assert (or ${disagrees.join(' ')}))`,
        ]);
        expect(
          answer,
          `the encoding disagrees with predicateMatches on ${JSON.stringify(record)}`,
        ).toBe('unsat');
      }
    });
  }, 120_000);

  // Every CONFLICT query is a question about `shall:`, and nothing else in
  // `npm test` reads it: a SHALL that is too weak makes those queries unsat
  // and agrees with three of the five expectations by accident. So, one
  // entry per modality on a record it applies to, and `shall:` must be sat
  // exactly when resolveModality says 'shall'.
  it('defines `shall:` as evaluate.ts resolves the modality, for every modality', async () => {
    const base = JSON.parse(readFileSync(finding('FIND-01'), 'utf8')).facts as Record<
      string,
      FactValue
    >;
    const sail = {
      'fact:propulsion': 'propulsion:sail',
      'fact:position': 'position:underway',
      'fact:activity': 'activity:none',
      'fact:length_m': 6,
    };
    const cases: [string, FactRecord][] = [
      ['30a', base as FactRecord], // shall
      ['25d1', { ...base, ...sail } as FactRecord], // shall-if-practicable
      ['30c', { ...base, 'fact:length_m': 120 } as FactRecord], // conditional, shall branch
      ['30c', { ...base, 'fact:length_m': 20 } as FactRecord], // conditional, may branch
      ['30b', { ...base, 'fact:length_m': 20 } as FactRecord], // may
    ];
    const modalities = new Set(cases.map(([id]) => byId.get(id)!.modality));
    expect([...modalities].sort()).toEqual(['conditional', 'may', 'shall', 'shall-if-practicable']);

    await withSolver(async (check) => {
      for (const [id, record] of cases) {
        expect(appliedEntries(data, record), `${id} must apply to its record`).toContain(id);
        const pins = pinRecord(realAxes, record);
        expect(await check([...pins, `(assert ${APPLIES(id)})`])).toBe('sat');
        const engineSaysShall = resolveModality(byId.get(id) as Entry, record) === 'shall';
        expect(
          await check([...pins, `(assert ${SHALL(id)})`]),
          `${id} on ${JSON.stringify(record)}`,
        ).toBe(engineSaysShall ? 'sat' : 'unsat');
      }
    });
  }, 60_000);

  // Positive controls: an expectation that points at a finding must be
  // witnessed by that finding's own representative record, so a definition
  // that silently weakened fails here rather than agreeing by accident.
  it('is satisfied by the representative record of every finding it expects', async () => {
    const expectations = loadExpectations();
    const queries = buildQueries(data, expectations);
    const pointed = Object.entries(expectations.queries).filter(([, r]) => r.finding);
    expect(pointed.length).toBeGreaterThan(0);

    await withSolver(async (check) => {
      for (const [id, recorded] of pointed) {
        const q = queries.find((x) => x.id === id);
        expect(q, `expectations.json names ${id}; buildQueries did not produce it`).toBeDefined();
        expect(recorded.expect, `${id}: a finding is a witness, so it can only back a sat`).toBe('sat');
        const record = JSON.parse(readFileSync(finding(recorded.finding!), 'utf8')).facts as FactRecord;
        const answer = await check([
          ...pinRecord(realAxes, record),
          ...q!.asserts.map((a) => `(assert ${a})`),
        ]);
        expect(answer, `${id}: ${recorded.finding}'s record is not a witness`).toBe('sat');
      }
    });
  }, 60_000);
});
