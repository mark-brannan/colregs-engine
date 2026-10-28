// The public entry points: data resolution and the version stamp's `source`.

import { describe, expect, it } from 'vitest';
import applicabilityJson from 'colregs/data/applicability.json';
import colregsPackage from 'colregs/package.json';
import versionJson from 'colregs/data/version.json';
import { appliedSignalsEntries, evaluateSignals } from '../src/evaluate';
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
    expect(evaluateSignals(sloop12).applied).toEqual(['rule:25a', 'rule:25b', 'rule:25c']);
    expect(appliedSignalsEntries(sloop12)).toEqual(['rule:25a', 'rule:25b', 'rule:25c']);
  });

  it('reports resolved data as its own, and caller-supplied data as theirs', () => {
    expect(evaluateSignals(sloop12).colregs).toEqual({
      version: colregsPackage.version,
      source: 'resolved',
    });
    expect(evaluateSignals(sloop12, { data: applicability }).colregs).toEqual({
      version: colregsPackage.version,
      source: 'caller',
    });
  });

  it('evaluates against opts.data instead of the resolved release', () => {
    const oneEntry: ApplicabilityData = { ...applicability, entries: [applicability.entries[0]] };
    const result = evaluateSignals(sloop12, { data: oneEntry });
    expect(result.applied.length).toBeLessThanOrEqual(1);
  });
});

describe('data version check (ADR 0009)', () => {
  it('evaluates when the caller-supplied data.version.json stamp matches', () => {
    expect(() =>
      evaluateSignals(sloop12, { data: applicability, dataVersion: versionJson.version }),
    ).not.toThrow();
    expect(
      evaluateSignals(sloop12, { data: applicability, dataVersion: versionJson.version }).colregs,
    ).toEqual({ version: colregsPackage.version, source: 'caller' });
  });

  it('throws DataVersionMismatchError when the stamp disagrees with the resolved release', () => {
    expect(() => evaluateSignals(sloop12, { data: applicability, dataVersion: '0.0.1' })).toThrow(
      DataVersionMismatchError,
    );
    expect(() =>
      appliedSignalsEntries(sloop12, { data: applicability, dataVersion: '0.0.1' }),
    ).toThrow(DataVersionMismatchError);
  });

  it('never checks when the caller passes no data at all', () => {
    // dataVersion alone, without data, is meaningless -- there is nothing
    // caller-supplied to have been stamped -- so it is silently ignored.
    expect(() => evaluateSignals(sloop12, { dataVersion: '0.0.1' })).not.toThrow();
  });

  it('never checks when data is supplied without dataVersion', () => {
    // The pre-#76 shape: opts.data with no version stamp available. Must
    // keep working exactly as before this feature existed.
    expect(() => evaluateSignals(sloop12, { data: applicability })).not.toThrow();
  });
});

describe('camelCase field aliases', () => {
  it('carry what the snake_case fields carry', () => {
    const result = evaluateSignals(sloop12);
    expect(result.optionalAdditions).toEqual(result.optional_additions);
    const lights = result.displays.flatMap((d) => d.lights);
    expect(lights.length).toBeGreaterThan(0);
    for (const light of lights) expect(light.sourceEntry).toBe(light.source_entry);
  });
});
