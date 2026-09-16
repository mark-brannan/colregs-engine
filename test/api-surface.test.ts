// The public entry points: data resolution and the version stamp's `source`.

import { describe, expect, it } from 'vitest';
import applicabilityJson from 'colregs/data/applicability.json';
import colregsPackage from 'colregs/package.json';
import versionJson from 'colregs/data/version.json';
import {
  appliedDisplayEntries,
  evaluateDisplay,
} from '../src/evaluate';
import { DataVersionMismatchError } from '../src/errors';
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

describe('data version check (ADR 0009)', () => {
  it('evaluates when the caller-supplied data.version.json stamp matches', () => {
    expect(() =>
      evaluateDisplay(sloop12, { data: applicability, dataVersion: versionJson.version }),
    ).not.toThrow();
    expect(
      evaluateDisplay(sloop12, { data: applicability, dataVersion: versionJson.version }).colregs,
    ).toEqual({ version: colregsPackage.version, source: 'caller' });
  });

  it('throws DataVersionMismatchError when the stamp disagrees with the resolved release', () => {
    expect(() =>
      evaluateDisplay(sloop12, { data: applicability, dataVersion: '0.0.1' }),
    ).toThrow(DataVersionMismatchError);
    expect(() => appliedDisplayEntries(sloop12, { data: applicability, dataVersion: '0.0.1' })).toThrow(
      DataVersionMismatchError,
    );
  });

  it('never checks when the caller passes no data at all', () => {
    // dataVersion alone, without data, is meaningless -- there is nothing
    // caller-supplied to have been stamped -- so it is silently ignored.
    expect(() => evaluateDisplay(sloop12, { dataVersion: '0.0.1' })).not.toThrow();
  });

  it('never checks when data is supplied without dataVersion', () => {
    // The pre-#76 shape: opts.data with no version stamp available. Must
    // keep working exactly as before this feature existed.
    expect(() => evaluateDisplay(sloop12, { data: applicability })).not.toThrow();
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
