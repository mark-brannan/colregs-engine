import { describe, expect, it } from 'vitest';
import { evaluateScene } from '../src/scene.js';
import { reduceTraffic } from '../src/traffic.js';
import { flattenSituation } from '../src/situation.js';
import type { Situation } from '../src/types.js';

const own = { fact: {} } as Situation['self'];

describe('Situation.others', () => {
  it('flattens to others:<sector>:<key>', () => {
    const flat = flattenSituation({
      self: own,
      others: { ahead: { foreclosed: true }, starboard: { count: 2, nearest_nm: 1.2 } },
    });
    expect(flat['others:ahead:foreclosed']).toBe(true);
    expect(flat['others:starboard:count']).toBe(2);
    expect(flat['others:starboard:nearest_nm']).toBe(1.2);
  });

  it('reduceTraffic and evaluateScene are stubs that throw', () => {
    expect(() => reduceTraffic(own, [])).toThrow(/stub/);
    expect(() => evaluateScene({ self: own, others: [] })).toThrow(/stub/);
  });
});
