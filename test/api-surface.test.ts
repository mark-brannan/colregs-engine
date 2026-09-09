// The public entry points: data resolution and the version stamp's `source`.

import { describe, expect, it } from 'vitest';
import applicabilityJson from 'colregs/data/applicability.json';
import colregsPackage from 'colregs/package.json';
import {
  appliedDisplayEntries,
  evaluateDisplay,
} from '../src/evaluate';
import type { ApplicabilityData, FactRecord } from '../src/types';

const applicability = applicabilityJson as unknown as ApplicabilityData;

const sloop12: FactRecord = {
  'fact:propulsion': 'propulsion:sail',
  'fact:activity': 'activity:none',
  'fact:position': 'position:underway',
  'fact:length_m': 12,
};

describe('data resolution', () => {
  it('evaluates without being handed applicability data', () => {
    expect(evaluateDisplay(sloop12).applied).toEqual(['25a', '25b', '25c']);
    expect(appliedDisplayEntries(sloop12)).toEqual(['25a', '25b', '25c']);
  });

  it('reports resolved data as its own, and caller-supplied data as theirs', () => {
    expect(evaluateDisplay(sloop12).colregs).toEqual({
      version: colregsPackage.version,
      source: 'resolved',
    });
    expect(evaluateDisplay(sloop12, { data: applicability }).colregs).toEqual({
      version: colregsPackage.version,
      source: 'caller',
    });
  });

  it('evaluates against opts.data instead of the resolved release', () => {
    const oneEntry: ApplicabilityData = { ...applicability, entries: [applicability.entries[0]] };
    const result = evaluateDisplay(sloop12, { data: oneEntry });
    expect(result.applied.length).toBeLessThanOrEqual(1);
  });
});

describe('camelCase field aliases', () => {
  it('carry what the snake_case fields carry', () => {
    const result = evaluateDisplay(sloop12);
    expect(result.optionalAdditions).toEqual(result.optional_additions);
    const lights = result.displays.flatMap((d) => d.lights);
    expect(lights.length).toBeGreaterThan(0);
    for (const light of lights) expect(light.sourceEntry).toBe(light.source_entry);
  });
});
