// The traffic reduction: `Situation.traffic`'s flattening, the sector
// boundaries read out of the entries' own relative-bearing constraints, and
// the reduction reduceTraffic returns for each of them.

import { describe, expect, it } from 'vitest';
import { reduceTraffic } from '../src/index.js';
import { RESOLVED_DATA } from '../src/evaluate.js';
import { locate, sectorBounds, sectorOf } from '../src/traffic.js';
import { flattenSituation } from '../src/situation.js';
import type { ApplicabilityData, Situation, Subject, SolverParameters } from '../src/types.js';

const own = { fact: {} } as Situation['self'];

const power = {
  'fact:propulsion': 'propulsion:power',
  'fact:activity': 'activity:none',
  'fact:position': 'position:underway',
  'fact:making_way': true,
  'fact:length_m': 20,
} as Subject['fact'];

const model = { separation_m: 500 } as SolverParameters;

/** Own at 50N 000E, heading 000. */
const helm: Subject = {
  fact: power,
  kin: { 'kin:position': { latitude: 50, longitude: 0 }, 'kin:heading_deg': 0 },
};

/** A vessel `range_m` away on relative bearing `bearing`, placed by flat
 * arithmetic on the degree -- an independent road to the same geometry. */
function at(bearing: number, range_m: number): Subject {
  const nm = range_m / 1852;
  const latitude = 50 + (nm / 60) * Math.cos((bearing * Math.PI) / 180);
  const longitude =
    (nm / 60) * Math.sin((bearing * Math.PI) / 180) / Math.cos((50 * Math.PI) / 180);
  return { fact: power, kin: { 'kin:position': { latitude, longitude }, 'kin:heading_deg': 0 } };
}

/** The same vessel seen the other way about: no position, only the bearing
 * own bears from her. */
function bearing(relBearingDeg: number): Subject {
  return {
    fact: power,
    kin: { 'kin:heading_deg': 0 },
    geo: { 'geo:rel_bearing_deg': (relBearingDeg + 180) % 360 },
  };
}

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
});

describe('sector boundaries', () => {
  it('are the arcs the resolved entries cut', () => {
    expect(sectorBounds(RESOLVED_DATA)).toEqual({ ahead_deg: 11.25, astern_deg: 112.5 });
  });

  it('move with the data rather than with this file', () => {
    const moved = {
      entries: [
        { when: { 'self:geo:rel_bearing_deg': { any_of: [{ lte: 20 }, { gte: 340 }] } } },
        { when: { 'other:geo:rel_bearing_deg': { not: { gt: 100, lt: 260 } } } },
      ],
    } as unknown as ApplicabilityData;
    expect(sectorBounds(moved)).toEqual({ ahead_deg: 20, astern_deg: 100 });
  });

  it('rejects data that states no symmetric arc', () => {
    const flat = { entries: [{ when: { 'self:geo:rel_bearing_deg': { gt: 40 } } }] };
    expect(() => sectorBounds(flat as unknown as ApplicabilityData)).toThrow(
      /symmetric about the fore-and-aft line/,
    );
  });

  it('put every bearing in exactly one sector, on the entries own edges', () => {
    expect(sectorOf(0)).toBe('ahead');
    expect(sectorOf(11.25)).toBe('ahead');
    expect(sectorOf(11.26)).toBe('starboard');
    expect(sectorOf(112.5)).toBe('starboard');
    expect(sectorOf(112.6)).toBe('astern');
    expect(sectorOf(247.4)).toBe('astern');
    expect(sectorOf(247.5)).toBe('port');
    expect(sectorOf(348.74)).toBe('port');
    expect(sectorOf(348.75)).toBe('ahead');
    expect(sectorOf(-5)).toBe('ahead');
    expect(sectorOf(380)).toBe('starboard');
  });
});

describe('locate', () => {
  it('reads the same bearing from two positions as from the reciprocal', () => {
    const fromPosition = locate(helm, at(40, 5556));
    const fromReciprocal = locate(helm, bearing(40));
    expect(fromPosition?.rel_bearing_deg).toBeCloseTo(40, 1);
    expect(fromReciprocal?.rel_bearing_deg).toBeCloseTo(40, 6);
    expect(fromPosition?.range_m).toBeCloseTo(5556, -1);
    expect(fromReciprocal?.range_m).toBeUndefined();
  });

  it('places nothing without own heading', () => {
    expect(locate({ fact: power }, at(40, 1000))).toBeUndefined();
  });
});

describe('reduceTraffic', () => {
  it('names every sector, and counts nothing into the empty ones', () => {
    const facts = reduceTraffic(helm, [at(40, 1000)], { model });
    expect(Object.keys(facts).sort()).toEqual(['ahead', 'astern', 'port', 'starboard']);
    expect(facts.starboard?.count).toBe(1);
    expect(facts.starboard?.nearest_nm).toBeCloseTo(1000 / 1852, 2);
    expect(facts.starboard?.foreclosed).toBe(false);
    expect(facts.port).toEqual({ count: 0, foreclosed: false });
  });

  it('keeps the nearest range in each sector', () => {
    const facts = reduceTraffic(helm, [at(40, 3000), at(90, 800), at(200, 1500)], { model });
    expect(facts.starboard?.count).toBe(2);
    expect(facts.starboard?.nearest_nm).toBeCloseTo(800 / 1852, 3);
    expect(facts.astern?.count).toBe(1);
  });

  it('forecloses a sector holding a vessel inside the model separation', () => {
    expect(reduceTraffic(helm, [at(40, 400)], { model }).starboard?.foreclosed).toBe(true);
    expect(reduceTraffic(helm, [at(40, 600)], { model }).starboard?.foreclosed).toBe(false);
    // The bound is inclusive: a vessel exactly that far is a vessel there.
    const nearest = reduceTraffic(helm, [at(40, 400)], { model }).starboard?.nearest_nm as number;
    const exact = { separation_m: nearest * 1852 } as SolverParameters;
    expect(reduceTraffic(helm, [at(40, 400)], { model: exact }).starboard?.foreclosed).toBe(true);
  });

  it('leaves foreclosure unstated without a model to state it against', () => {
    const facts = reduceTraffic(helm, [at(40, 400)]);
    expect(facts.starboard?.foreclosed).toBeUndefined();
    expect(facts.ahead?.foreclosed).toBe(false);
  });

  it('leaves foreclosure unstated while a vessel there has no range', () => {
    const unmeasured = reduceTraffic(helm, [at(40, 900), bearing(60)], { model });
    expect(unmeasured.starboard?.count).toBe(2);
    expect(unmeasured.starboard?.foreclosed).toBeUndefined();
    const measured = reduceTraffic(helm, [at(40, 100), bearing(60)], { model });
    expect(measured.starboard?.foreclosed).toBe(true);
  });

  it('counts a vessel it cannot place into no sector', () => {
    const facts = reduceTraffic(helm, [{ fact: power }], { model });
    expect(Object.values(facts).map((s) => s.count)).toEqual([0, 0, 0, 0]);
  });

  it('validates every vessel it is handed', () => {
    const bad = { fact: { 'fact:propulsion': 'sail' } } as unknown as Subject;
    expect(() => reduceTraffic(helm, [bad])).toThrow(/did you mean 'propulsion:sail'/);
    expect(() => reduceTraffic(bad, [])).toThrow(/did you mean 'propulsion:sail'/);
  });
});
