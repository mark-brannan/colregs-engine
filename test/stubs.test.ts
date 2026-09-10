// The named-but-unbuilt verbs: exported, and throwing rather than answering.

import { describe, expect, it } from 'vitest';
import {
  NotImplementedError,
  appliedConductEntries,
  appliedEncounterEntries,
  evaluateConduct,
  evaluateEncounter,
  evaluateRule2Departure,
} from '../src/index';
import type { Rule2DepartureModel, Situation, Trace } from '../src/index';

const situation = { own: { fact: {} } } as unknown as Situation;
const trace = { samples: [{ t_s: 0, situation }] } as Trace;
const model = {
  version: 'test-grid',
  colregs_version: '0.0.0',
  dynamics: [],
  horizon_s: 60,
  cadence_s: 1,
  separation_m: 100,
  information: 'full',
  adversary: 'compliant',
} as Rule2DepartureModel;

const calls: [string, () => unknown][] = [
  ['evaluateEncounter', () => evaluateEncounter(situation)],
  ['appliedEncounterEntries', () => appliedEncounterEntries(situation)],
  ['evaluateConduct', () => evaluateConduct(trace)],
  ['appliedConductEntries', () => appliedConductEntries(trace)],
  ['evaluateRule2Departure', () => evaluateRule2Departure(situation, model)],
];

describe('an unbuilt verb', () => {
  it.each(calls)('%s throws instead of returning an envelope', (verb, call) => {
    expect(call).toThrow(NotImplementedError);
    try {
      call();
    } catch (error) {
      expect((error as NotImplementedError).verb).toBe(verb);
      // The shape is fixed somewhere reviewable; a caller who hits this
      // should be able to read what was promised.
      expect((error as NotImplementedError).shapeFixedBy).toMatch(/^ADR \d{4} §/u);
    }
  });

  it('throws a subclass of Error, so a catch-all handler still sees it', () => {
    expect(new NotImplementedError('x', 'ADR 0011 §1')).toBeInstanceOf(Error);
  });
});
