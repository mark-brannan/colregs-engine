import { describe, expect, it } from 'vitest';
import { evaluateScene, reduceTraffic } from '../src/index.js';
import { flattenSituation } from '../src/situation.js';
import type { Situation } from '../src/types.js';

const own = { fact: {} } as Situation['self'];

describe('Situation.traffic', () => {
  it('flattens to traffic:<sector>:<key>', () => {
    const flat = flattenSituation({
      self: own,
      traffic: { ahead: { foreclosed: true }, starboard: { count: 2, nearest_nm: 1.2 } },
    });
    expect(flat['traffic:ahead:foreclosed']).toBe(true);
    expect(flat['traffic:starboard:count']).toBe(2);
    expect(flat['traffic:starboard:nearest_nm']).toBe(1.2);
  });

  it('reduceTraffic and evaluateScene are stubs that throw', () => {
    expect(() => reduceTraffic(own, [])).toThrow(/stub/);
    expect(() => evaluateScene({ self: own, others: [] })).toThrow(/stub/);
  });
});
