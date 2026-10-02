// Stable FIND-nn allocation (research/conformance/ids.ts): a finding's id is
// fixed by its check::groupKey and a retired number is never reused.

import { describe, expect, it } from 'vitest';
import { allocateIds, parseIdMap, serializeIdMap, type IdMap } from '../research/conformance/ids';
import { findingKey, type FindingGroup } from '../research/conformance/walk';

const group = (check: string, groupKey: string): FindingGroup => ({
  check,
  groupKey,
  count: 1,
  description: `${check} ${groupKey}`,
  cites: [],
  sampleFacts: {} as FindingGroup['sampleFacts'],
  witnessOrdinal: 0,
});

const a = group('a-check', 'x');
const b = group('b-check', 'y');
const c = group('c-check', 'z');

describe('allocateIds', () => {
  it('bootstraps from an absent map in sorted order', () => {
    const { findings, map } = allocateIds([c, a, b], null);
    expect(findings.map((f) => [f.check, f.id])).toEqual([
      ['a-check', 'FIND-01'],
      ['b-check', 'FIND-02'],
      ['c-check', 'FIND-03'],
    ]);
    expect(map.next).toBe(4);
  });

  it('keeps the id of a key already in the map', () => {
    const prev: IdMap = { next: 3, ids: { [findingKey(b)]: 'FIND-01', [findingKey(a)]: 'FIND-02' } };
    const { findings } = allocateIds([a, b], prev);
    expect(findings.map((f) => [f.check, f.id])).toEqual([
      ['b-check', 'FIND-01'],
      ['a-check', 'FIND-02'],
    ]);
  });

  it('gives a new key `next` and increments it', () => {
    const prev: IdMap = { next: 5, ids: { [findingKey(a)]: 'FIND-01' } };
    const { findings, map } = allocateIds([a, c], prev);
    expect(findings.find((f) => f.check === 'c-check')!.id).toBe('FIND-05');
    expect(map.next).toBe(6);
  });

  it('never reuses the number of a finding that went away', () => {
    const first = allocateIds([a, b], null);
    const gone = allocateIds([a], first.map);
    expect(gone.map.ids[findingKey(b)]).toBe('FIND-02');
    const later = allocateIds([a, c], gone.map);
    expect(later.findings.find((f) => f.check === 'c-check')!.id).toBe('FIND-03');
    const back = allocateIds([a, b, c], later.map);
    expect(back.findings.find((f) => f.check === 'b-check')!.id).toBe('FIND-02');
  });

  it('sorts rows by id, not by key', () => {
    const prev: IdMap = { next: 3, ids: { [findingKey(c)]: 'FIND-01', [findingKey(a)]: 'FIND-02' } };
    expect(allocateIds([a, c], prev).findings.map((f) => f.id)).toEqual(['FIND-01', 'FIND-02']);
  });

  it('is a fixed point: a second run over the same findings changes nothing', () => {
    const first = allocateIds([a, b, c], null);
    const second = allocateIds([a, b, c], first.map);
    expect(serializeIdMap(second.map)).toBe(serializeIdMap(first.map));
  });
});

describe('parseIdMap', () => {
  const text = (map: unknown) => JSON.stringify(map);

  it('round-trips a serialized map', () => {
    const { map } = allocateIds([a, b, c], null);
    expect(parseIdMap(serializeIdMap(map))).toEqual(map);
  });

  it('refuses an id that is not FIND-<n>', () => {
    expect(() => parseIdMap(text({ next: 2, ids: { k: 'F-1' } }))).toThrow(/not FIND-<n>/);
  });

  it('refuses one number held by two keys', () => {
    expect(() => parseIdMap(text({ next: 3, ids: { k: 'FIND-01', j: 'FIND-1' } }))).toThrow(/held by both/);
  });

  it('refuses a next at or below an allocated number', () => {
    expect(() => parseIdMap(text({ next: 2, ids: { k: 'FIND-02' } }))).toThrow(/already allocated/);
  });
});
