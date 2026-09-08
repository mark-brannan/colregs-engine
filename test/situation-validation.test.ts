// validateSituation() extends validateFacts()'s "did you mean" checking to a
// situation's kin/geo/hist/env classes (ADR 0001 §3) — same failure mode,
// same fix: an un-namespaced or misspelt key must not silently match nothing.

import { describe, expect, it } from 'vitest';
import { validateSituation } from '../src/facts';
import type { Situation } from '../src/index';

const baseFacts = {
  'fact:propulsion': 'propulsion:power',
  'fact:activity': 'activity:none',
  'fact:position': 'position:underway',
  'fact:making_way': true,
} as const;

describe('validateSituation', () => {
  it('accepts a minimal valid situation', () => {
    const situation: Situation = { own: { fact: { ...baseFacts } } };
    expect(() => validateSituation(situation)).not.toThrow();
  });

  it('validates own.fact on the same terms as validateFacts', () => {
    const situation = {
      own: { fact: { propulsion: 'power' } },
    } as unknown as Situation;
    expect(() => validateSituation(situation)).toThrow(
      /unknown fact key 'propulsion'.*did you mean 'fact:propulsion'/s,
    );
  });

  it('an un-namespaced kin key throws, naming the key', () => {
    const situation = {
      own: { fact: { ...baseFacts }, kin: { heading_deg: 90 } },
    } as unknown as Situation;
    expect(() => validateSituation(situation)).toThrow(
      /unknown kin key 'heading_deg'; did you mean 'kin:heading_deg'\?/,
    );
  });

  it('a kin enum value outside its set suggests the namespaced value', () => {
    const situation: Situation = {
      own: {
        fact: { ...baseFacts },
        kin: { 'kin:dynamics': 'yacht' } as never,
      },
    };
    expect(() => validateSituation(situation)).toThrow(
      /did you mean 'dynamics:yacht'\?/,
    );
  });

  it('hist:latched_at_s accepts null', () => {
    const situation: Situation = {
      own: {
        fact: { ...baseFacts },
        hist: { 'hist:was_overtaking': false, 'hist:latched_at_s': null },
      },
    };
    expect(() => validateSituation(situation)).not.toThrow();
  });

  it('a non-nullable field rejects null', () => {
    const situation = {
      own: { fact: { ...baseFacts }, hist: { 'hist:was_overtaking': null } },
    } as unknown as Situation;
    expect(() => validateSituation(situation)).toThrow(
      /hist key 'hist:was_overtaking' does not accept null/,
    );
  });

  it('validates other and pair, naming the class', () => {
    const situation = {
      own: { fact: { ...baseFacts } },
      other: { fact: { ...baseFacts }, geo: { rel_bearing_deg: 10 } },
    } as unknown as Situation;
    expect(() => validateSituation(situation)).toThrow(
      /unknown geo key 'rel_bearing_deg'/,
    );
  });

  it('an unknown pair.env key throws', () => {
    const situation = {
      own: { fact: { ...baseFacts } },
      pair: { env: { narrow_channel: true } },
    } as unknown as Situation;
    expect(() => validateSituation(situation)).toThrow(
      /unknown env key 'narrow_channel'; did you mean 'env:narrow_channel'\?/,
    );
  });

  it('a missing own throws a named error, not a raw TypeError', () => {
    const situation = {} as unknown as Situation;
    expect(() => validateSituation(situation)).toThrow(
      /situation\.own is required and must be an object, got undefined/,
    );
  });

  it('a missing own.fact throws a named error, not a raw TypeError', () => {
    const situation = { own: {} } as unknown as Situation;
    expect(() => validateSituation(situation)).toThrow(
      /situation\.own\.fact is required and must be an object, got undefined/,
    );
  });

  it('a missing other.fact throws a named error naming "other"', () => {
    const situation = {
      own: { fact: { ...baseFacts } },
      other: {},
    } as unknown as Situation;
    expect(() => validateSituation(situation)).toThrow(
      /situation\.other\.fact is required and must be an object/,
    );
  });

  it('a non-object pair is rejected rather than silently skipped', () => {
    const situation = {
      own: { fact: { ...baseFacts } },
      pair: 'not an object',
    } as unknown as Situation;
    expect(() => validateSituation(situation)).toThrow(
      /situation\.pair must be an object, got "not an object"/,
    );
  });

  it('null pair.geo is rejected rather than silently skipped', () => {
    const situation = {
      own: { fact: { ...baseFacts } },
      pair: { geo: null },
    } as unknown as Situation;
    expect(() => validateSituation(situation)).toThrow(
      /Geo record must be an object, got null/,
    );
  });

  it('an array kin container is rejected, not iterated as if it were a record', () => {
    const situation = {
      own: { fact: { ...baseFacts }, kin: ['kin:heading_deg'] },
    } as unknown as Situation;
    expect(() => validateSituation(situation)).toThrow(
      /Kin record must be an object, got \["kin:heading_deg"\]/,
    );
  });

  it('kin:position rejects a value missing latitude/longitude', () => {
    const situation = {
      own: { fact: { ...baseFacts }, kin: { 'kin:position': { lat: 1 } } },
    } as unknown as Situation;
    expect(() => validateSituation(situation)).toThrow(
      /kin key 'kin:position' expects \{ latitude, longitude \}/,
    );
  });
});
