// encodeConstraint / encodePredicate against literal predicates, including
// `not` and both `any_of` forms -- neither of which appears in the pinned
// colregs (0.1.2), so nothing else in the repo exercises them.
//
// Plus a differential check: for random fact records, the encoding's truth
// value under Z3 must equal src/evaluate.ts's `predicateMatches`. String
// assertions pin the shape; the differential check pins the meaning.

import { describe, expect, it } from 'vitest';
import applicabilityJson from 'colregs/data/applicability.json' with { type: 'json' };
import { init } from 'z3-solver';

import { predicateMatches } from '../src/evaluate.js';
import type { ApplicabilityData, Constraint, FactRecord, FactValue, Predicate } from '../src/types.js';
import { extractAxes, type Axis } from '../research/conformance/enumerate.js';
import { buildEncoding, encodeConstraint, encodePredicate, sym, EncodingError } from '../research/z3/encode.js';
import { parseNumeral, snapToGrid } from '../research/z3/decode.js';

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

  it('encodes an empty any_of as false and an empty numeric object as true', () => {
    expect(enc(enumAxis, { any_of: [] })).toBe('false');
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
// Differential: the encoding's truth value must equal the engine's, for
// every entry of the real data, on random records.
// ---------------------------------------------------------------------

describe('encoding agrees with src/evaluate.ts on random records', () => {
  it('matches predicateMatches for every entry on 500 random records', async () => {
    const data = applicabilityJson as unknown as ApplicabilityData;
    const { axes: realAxes } = extractAxes(data);
    const encoding = buildEncoding(data);
    const axesByKey = new Map(realAxes.map((a) => [a.key as string, a]));

    const { Context, em } = await init();
    try {
      const Z3 = Context('diff');
      const solver = new Z3.Solver();
      solver.fromString(encoding.base);

      // A deterministic PRNG, so a failure is reproducible from the seed.
      let seed = 20260906;
      const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

      for (let n = 0; n < 500; n++) {
        const facts: Record<string, FactValue> = {};
        const pins: string[] = [];
        for (const a of realAxes) {
          switch (a.kind) {
            case 'boolean': {
              const v = rnd() < 0.5;
              facts[a.key] = v;
              pins.push(`(assert (= ${sym(a.key)} ${v}))`);
              break;
            }
            case 'numeric': {
              // Deliberately off the representative grid as often as on it.
              const v = Math.round(rnd() * 220 * 2) / 2;
              facts[a.key] = v;
              pins.push(`(assert (= ${sym(a.key)} ${Number.isInteger(v) ? `${v}.0` : v}))`);
              break;
            }
            case 'enum': {
              const i = Math.floor(rnd() * a.values.length);
              facts[a.key] = a.values[i];
              pins.push(`(assert (= ${sym(a.key)} ${i}))`);
              break;
            }
          }
        }
        const record = facts as FactRecord;

        // One check per record rather than one per entry: assert the record,
        // then ask whether ANY entry's encoded predicate disagrees with the
        // engine. `unsat` means all forty agree. encoding.entries is already
        // filtered to category: 'display' -- the other 30 (colregs 0.2.0's
        // scope/precedence/classification entries) read own:/other:/pair:
        // facts this encoding is deliberately out of scope for (encode.ts's
        // file header, point 4), and predicateMatches would disagree with
        // them for a reason that has nothing to do with this differential
        // check: `record` never carries those keys at all.
        const disagrees = encoding.entries.map((e) => {
          const expr = encodePredicate(axesByKey, e.when);
          return predicateMatches(e.when, record) ? `(not ${expr})` : expr;
        });
        solver.push();
        solver.fromString(`${pins.join('\n')}\n(assert (or ${disagrees.join(' ')}))`);
        const answer = await solver.check();
        solver.pop();
        expect(
          answer,
          `the encoding disagrees with predicateMatches on ${JSON.stringify(record)}`,
        ).toBe('unsat');
      }
    } finally {
      em.PThread.terminateAllThreads();
    }
  }, 120_000);
});
