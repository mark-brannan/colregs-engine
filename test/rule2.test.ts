// evaluateRule2Departure: a lookup in whatever regions the model carries,
// `inconclusive-in-model` when it carries none, every finding naming its grid.

import { describe, expect, it } from 'vitest';
import colregsPackage from 'colregs/package.json';
import { evaluateRule2Departure } from '../src/index';
import type { Rule2DepartureModel, Situation } from '../src/index';

const situation: Situation = {
  own: {
    fact: {
      'fact:propulsion': 'propulsion:power',
      'fact:activity': 'activity:none',
      'fact:position': 'position:underway',
    },
  },
  other: {
    fact: {
      'fact:propulsion': 'propulsion:power',
      'fact:activity': 'activity:none',
      'fact:position': 'position:underway',
    },
  },
  pair: { geo: { 'geo:in_sight': true, 'geo:risk_of_collision': true, 'geo:cpa_m': 20 } },
};

const model: Rule2DepartureModel = {
  version: 'test-grid',
  colregs_version: colregsPackage.version,
  dynamics: ['dynamics:yacht'],
  horizon_s: 600,
  cadence_s: 1,
  separation_m: 100,
  information: 'full',
  adversary: 'compliant',
};

describe('evaluateRule2Departure', () => {
  it('a grid without regions is inconclusive, and says so', () => {
    const f = evaluateRule2Departure(situation, model);
    expect(f.status).toBe('inconclusive-in-model');
    expect(f.advisories).toEqual([]);
    expect(f.model.version).toBe('test-grid');
    expect(f.model.parameters).toEqual({
      dynamics: ['dynamics:yacht'],
      horizon_s: 600,
      cadence_s: 1,
      separation_m: 100,
      information: 'full',
      adversary: 'compliant',
    });
    expect(f.model.assumptions_violated).toEqual([
      expect.stringMatching(/carries no regions/),
    ]);
    expect(f.rules.applied).toContain('rule:8f_iii');
  });

  it('a matching region gives its status, advisories best margin first', () => {
    const f = evaluateRule2Departure(situation, {
      ...model,
      regions: [
        { when: { 'pair:geo:cpa_m': { gt: 500 } }, status: 'not-flagged' },
        {
          when: { 'pair:geo:cpa_m': { lt: 50 } },
          status: 'model-rule-conflict',
          advisories: [
            { action: { alter_deg: 30 }, margin_m: 80, breaches: ['17(a)(i)'], envelope: { holds_until_s: 120 } },
            { action: { sog_kn: 0 }, margin_m: 150, breaches: ['17(a)(i)'], envelope: { holds_until_s: 90 } },
          ],
        },
      ],
    });
    expect(f.status).toBe('model-rule-conflict');
    expect(f.advisories.map((a) => a.margin_m)).toEqual([150, 80]);
    expect(f.model.assumptions_violated).toEqual([]);
  });

  it('no robust policy carries no advisories, whatever the region lists', () => {
    const f = evaluateRule2Departure(situation, {
      ...model,
      regions: [
        {
          when: {},
          status: 'no-robust-policy-in-model',
          advisories: [{ action: {}, margin_m: 1, breaches: [], envelope: { holds_until_s: 1 } }],
        },
      ],
    });
    expect(f.status).toBe('no-robust-policy-in-model');
    expect(f.advisories).toEqual([]);
  });

  it('an uncovered situation is inconclusive and names the grid', () => {
    const f = evaluateRule2Departure(situation, {
      ...model,
      regions: [{ when: { 'pair:geo:cpa_m': { gt: 500 } }, status: 'not-flagged' }],
    });
    expect(f.status).toBe('inconclusive-in-model');
    expect(f.model.assumptions_violated).toEqual([expect.stringMatching(/no region of grid test-grid/)]);
  });

  it('a colregs release mismatch is reported, not refused', () => {
    const f = evaluateRule2Departure(situation, { ...model, colregs_version: '0.0.1', regions: [] });
    expect(f.model.assumptions_violated[0]).toMatch(/solved against colregs 0\.0\.1/);
  });

  it('rejects a model with no version', () => {
    expect(() =>
      evaluateRule2Departure(situation, { ...model, version: '' }),
    ).toThrow(/version must be a non-empty string/);
  });
});
