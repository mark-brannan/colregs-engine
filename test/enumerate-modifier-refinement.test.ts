// fact:making_way is a modifier that refines fact:position=position:underway
// (colregs facts.json). The enumerator used to treat it as a free boolean
// axis, producing incoherent records like position:moored + making_way:
// true (FIND-03's witness record). These tests pin the fix: a modifier
// fact is present only where its refinement holds, elsewhere absent, and
// no record is ever emitted twice.

import { describe, expect, it } from 'vitest';
import applicabilityJson from 'colregs/data/applicability.json' with { type: 'json' };
import { extractAxes, enumerateRecords, type Axis, type BooleanAxis } from '../research/conformance/enumerate';
import type { ApplicabilityData } from '../src/types';

const data = applicabilityJson as unknown as ApplicabilityData;

// A tiny, hand-built axis pair standing in for the real fact:position /
// fact:making_way relationship, so the enumeration logic can be checked
// exhaustively rather than by sampling the full 3.7M-record space.
const positionAxis: Axis = {
  kind: 'enum',
  key: 'fact:position' as never,
  values: ['position:underway', 'position:anchored', 'position:aground', 'position:moored'],
};
const makingWayAxis: BooleanAxis = {
  kind: 'boolean',
  key: 'fact:making_way' as never,
  values: [true, false],
  refines: { key: 'fact:position' as never, value: 'position:underway' },
};

describe('enumerateRecords: modifier refinement, small hand-built axes', () => {
  const records = [...enumerateRecords([positionAxis, makingWayAxis])];

  it('emits one record per non-underway position and two for underway (3*1 + 1*2)', () => {
    expect(records).toHaveLength(5);
  });

  it('never carries fact:making_way unless fact:position is position:underway', () => {
    for (const r of records) {
      if ('fact:making_way' in r) {
        expect(r['fact:position']).toBe('position:underway');
      }
    }
  });

  it('leaves fact:making_way absent (not false) off the refined value', () => {
    const moored = records.find((r) => r['fact:position'] === 'position:moored')!;
    expect('fact:making_way' in moored).toBe(false);
  });

  it('every record is unique', () => {
    const seen = new Set(records.map((r) => JSON.stringify(r)));
    expect(seen.size).toBe(records.length);
  });
});

describe('extractAxes: reads the modifier refinement declared in facts.json', () => {
  it("fact:making_way's axis refines fact:position=position:underway", () => {
    const { axes } = extractAxes(data);
    const axis = axes.find((a) => a.key === 'fact:making_way') as BooleanAxis | undefined;
    expect(axis?.kind).toBe('boolean');
    expect(axis?.refines).toEqual({ key: 'fact:position', value: 'position:underway' });
  });
});

describe('the real fact space: no incoherent or duplicate records', () => {
  const { axes } = extractAxes(data);

  it(
    'no record carries fact:making_way off position:underway, across the whole space',
    () => {
      // A plain loop, one expect at the end: this walks the full ~3.7M-record
      // space, and a per-record `expect` there is what makes that slow.
      let n = 0;
      let incoherent = 0;
      for (const r of enumerateRecords(axes)) {
        n++;
        if ('fact:making_way' in r && r['fact:position'] !== 'position:underway') {
          incoherent++;
        }
      }
      expect(incoherent).toBe(0);
      // Regression pin: a duplicate-emitting or over-restrictive refinement
      // bug changes this count. Was 5,930,496 when making_way was still a
      // free boolean axis (research/conformance/README.md's old table); was
      // 3,706,560 before colregs@0.2.2 added fact:on_mooring_buoy as a
      // second modifier (refining position:moored, same shape as
      // making_way refining position:underway) — that split moored's one
      // slot into two, same as underway's, raising the product.
      expect(n).toBe(4447872);
    },
    20_000,
  );
});
