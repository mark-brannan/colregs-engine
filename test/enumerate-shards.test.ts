// Sharding the conformance walk (research/conformance/enumerate.ts,
// walk.ts): the shards of the fact space partition it, their ordinals order
// it, and merging shard tallies gives the tally one pass would have.

import applicabilityJson from 'colregs/data/applicability.json' with { type: 'json' };
import { describe, expect, it } from 'vitest';
import {
  enumerateIndexed,
  enumerateRecords,
  extractAxes,
  subShard,
  totalRecords,
  type Axis,
  type BooleanAxis,
} from '../research/conformance/enumerate';
import { emptyTally, mergeTallies, recordFinding, walkShard, type Tally } from '../research/conformance/walk';
import type { ApplicabilityData } from '../src/types';

const positionAxis: Axis = {
  kind: 'enum',
  key: 'fact:position' as never,
  values: ['position:underway', 'position:anchored', 'position:aground', 'position:moored'],
};
const lengthAxis: Axis = { kind: 'numeric', key: 'fact:length_m' as never, constants: [12], values: [11, 12, 13] };
const makingWayAxis: BooleanAxis = {
  kind: 'boolean',
  key: 'fact:making_way' as never,
  values: [true, false],
  refines: { key: 'fact:position' as never, value: 'position:underway' },
};
const axes = [positionAxis, lengthAxis, makingWayAxis];
const whole = [...enumerateIndexed(axes)];

describe('enumerateIndexed: shards partition the space', () => {
  it.each([1, 2, 3, 5, 12, 13])('%i shards cover every record exactly once', (of) => {
    const seen = new Map<string, number>();
    for (let index = 0; index < of; index++) {
      for (const { facts } of enumerateIndexed(axes, { index, of })) {
        const k = JSON.stringify(facts);
        seen.set(k, (seen.get(k) ?? 0) + 1);
      }
    }
    expect(seen.size).toBe(whole.length);
    expect([...seen.values()].every((c) => c === 1)).toBe(true);
  });

  it('a shard of one is the unsharded walk, in order', () => {
    expect([...enumerateRecords(axes, { index: 0, of: 1 })]).toEqual(whole.map((r) => r.facts));
  });

  it('ordinals are unique and increase along the unsharded walk', () => {
    const ordinals = whole.map((r) => r.ordinal);
    expect(new Set(ordinals).size).toBe(ordinals.length);
    for (let i = 1; i < ordinals.length; i++) expect(ordinals[i]).toBeGreaterThan(ordinals[i - 1]);
  });

  it('a record keeps its ordinal whichever shard yields it', () => {
    const byFacts = new Map(whole.map((r) => [JSON.stringify(r.facts), r.ordinal]));
    for (let index = 0; index < 3; index++) {
      for (const { facts, ordinal } of enumerateIndexed(axes, { index, of: 3 })) {
        expect(ordinal).toBe(byFacts.get(JSON.stringify(facts)));
      }
    }
  });

  it('every expansion of a base record lands in the same shard', () => {
    for (let index = 0; index < 3; index++) {
      const underway = [...enumerateRecords(axes, { index, of: 3 })].filter(
        (r) => r['fact:position'] === 'position:underway',
      );
      // Each underway base record expands to making_way true and false.
      expect(underway.length % 2).toBe(0);
    }
  });

  it('rejects a shard index outside [0, of)', () => {
    expect(() => [...enumerateIndexed(axes, { index: 2, of: 2 })]).toThrow(/shard index/);
    expect(() => [...enumerateIndexed(axes, { index: 0, of: 0 })]).toThrow(/shard index/);
  });
});

describe('mergeTallies', () => {
  function tallyWith(n: number, findings: [string, number, string][]): Tally {
    const t = emptyTally();
    t.n = n;
    t.conformanceFailures = n;
    t.noObligationPositions = { 'position:underway': n };
    for (const [id, ordinal, witness] of findings) {
      recordFinding(t, 'check', id, `desc ${id}`, [id], { 'fact:position': witness } as never, ordinal);
    }
    return t;
  }

  it('sums counts and unions sets', () => {
    const a = tallyWith(3, [['x', 10, 'a']]);
    a.everApplied = ['e1'];
    a.modalityByBranchTaken = { m: [0] };
    const b = tallyWith(4, [['x', 20, 'b'], ['y', 5, 'b']]);
    b.everApplied = ['e2'];
    b.modalityByBranchTaken = { m: [1] };
    const m = mergeTallies([a, b]);
    expect(m.n).toBe(7);
    expect(m.conformanceFailures).toBe(7);
    expect(m.noObligationPositions).toEqual({ 'position:underway': 7 });
    expect(m.findings['check::x'].count).toBe(2);
    expect(m.findings['check::y'].count).toBe(1);
    expect(m.everApplied).toEqual(['e1', 'e2']);
    expect(m.modalityByBranchTaken).toEqual({ m: [0, 1] });
  });

  it('keeps the lowest-ordinal witness regardless of shard order', () => {
    const a = tallyWith(1, [['x', 20, 'late']]);
    const b = tallyWith(1, [['x', 10, 'early']]);
    for (const order of [[a, b], [b, a]]) {
      const f = mergeTallies(order).findings['check::x'];
      expect(f.witnessOrdinal).toBe(10);
      expect(f.sampleFacts).toEqual({ 'fact:position': 'early' });
    }
  });

  it('is associative: merging in two steps equals merging at once', () => {
    const parts = [tallyWith(1, [['x', 7, 'c']]), tallyWith(2, [['x', 3, 'a']]), tallyWith(3, [['z', 9, 'z']])];
    expect(mergeTallies([mergeTallies(parts.slice(0, 2)), parts[2]])).toEqual(mergeTallies(parts));
  });

  it('merging one tally leaves it unchanged', () => {
    const t = tallyWith(2, [['x', 1, 'a']]);
    t.everApplied = ['e'];
    expect(mergeTallies([t])).toEqual(t);
  });
});

describe('--full pieces and the CI legs', () => {
  // The real axes, each cut to its first two representatives: the same
  // data and checks, a space small enough to walk in pieces in a test.
  const realAxes = extractAxes(applicabilityJson as unknown as ApplicabilityData).axes;
  const axes = realAxes.map((a, i) => ({ ...a, values: a.values.slice(0, i < 12 ? 2 : 1) })) as Axis[];
  // What a tally file holds once wall time, the one nondeterministic field, is set aside.
  const canonical = (t: Tally) =>
    JSON.stringify({ ...t, wallMs: 0, findings: Object.fromEntries(Object.entries(t.findings).sort()) });
  const roundTrip = (t: Tally) => JSON.parse(JSON.stringify(t)) as Tally;

  it('merging all 1024 pieces equals the 16-leg CI merge, byte for byte', () => {
    expect(totalRecords(axes)).toBeGreaterThan(1024);
    const whole = { index: 0, of: 1 };
    const pieces = Array.from({ length: 1024 }, (_, k) => roundTrip(walkShard(axes, { shard: subShard(whole, k, 1024) })));
    // A leg is --shard=i/16 split over a 4-core runner's processes; the
    // merge job reads tally-0.json, tally-1.json, tally-10.json, ... in glob order.
    const legs = Array.from({ length: 16 }, (_, i) =>
      roundTrip(mergeTallies(Array.from({ length: 4 }, (_, k) => walkShard(axes, { shard: subShard({ index: i, of: 16 }, k, 4) })))),
    );
    const globOrder = legs.map((t, i) => [`tally-${i}.json`, t] as const).sort(([a], [b]) => a.localeCompare(b));
    const ci = mergeTallies(globOrder.map(([, t]) => t));
    expect(Object.keys(ci.findings).length).toBeGreaterThan(0);
    expect(canonical(mergeTallies(pieces))).toBe(canonical(ci));
    expect(canonical(ci)).toBe(canonical(walkShard(axes)));
  });
});
