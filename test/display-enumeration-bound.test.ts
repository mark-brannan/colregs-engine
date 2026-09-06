// #9 / CodeRabbit on #13: `1 << binaryCount` and `combo >> binaryCount` in
// evaluate()'s display-enumeration loop coerce to signed 32-bit.
// binaryCount alone isn't the bound -- a one_of group multiplies the total
// further, so 30 binaries plus a three-option group (totalCombos = 3 *
// 2**30) crosses 2**31 well within the "binaryCount <= 30" guard that
// looked sufficient at first. Both fixtures below are cheap: the guard
// throws before the enumeration loop runs, so this never actually
// iterates billions of combos.

import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/evaluate';
import type { ApplicabilityData, Entry, FactRecord } from '../src/types';

const facts: FactRecord = {};

function relationalMayPair(i: number): Entry[] {
  // A 'may' entry whose own rel:excludes names a sibling applied node is
  // classified as a binary (chosen or not), per evaluate()'s node
  // classification. Both always apply (`when: {}`).
  return [
    {
      id: `may${i}`,
      jurisdiction: 'intl',
      cite: `test ${i}a`,
      when: {},
      lights: [],
      modality: 'may',
      'rel:excludes': [`peer${i}`],
    },
    {
      id: `peer${i}`,
      jurisdiction: 'intl',
      cite: `test ${i}b`,
      when: {},
      lights: [],
      modality: 'may',
    },
  ];
}

function threeOptionGroup(): Entry[] {
  return [
    {
      id: 'carrier',
      jurisdiction: 'intl',
      cite: 'test carrier',
      when: {},
      lights: [],
      modality: 'shall',
      'rel:conditional_includes': [{ one_of: ['opt1', 'opt2', 'opt3'] }],
    },
    ...['opt1', 'opt2', 'opt3'].map(
      (id): Entry => ({
        id,
        jurisdiction: 'intl',
        cite: `test ${id}`,
        when: {},
        lights: [],
        modality: 'shall',
      }),
    ),
  ];
}

function dataWithBinaries(count: number, withGroup: boolean): ApplicabilityData {
  const entries = Array.from({ length: count }, (_, i) => relationalMayPair(i)).flat();
  if (withGroup) entries.push(...threeOptionGroup());
  return { known_omissions: [], entries };
}

describe('display enumeration: signed 32-bit bound (#9)', () => {
  it('throws rather than silently truncating once totalCombos exceeds 2**31 (30 binaries * 3-option group)', () => {
    const data = dataWithBinaries(30, true);
    expect(() => evaluate(data, facts)).toThrow(/exceeds the signed 32-bit bound/);
  });

  it('does not throw for an ordinary-sized combination space', () => {
    const data = dataWithBinaries(4, true);
    expect(() => evaluate(data, facts)).not.toThrow();
  });
});
