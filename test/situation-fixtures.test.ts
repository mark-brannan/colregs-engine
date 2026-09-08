// Replays fixtures/situation-fixtures.json verbatim, as a type check: every
// case's `situation` object must be assignable to `Situation` unedited (ADR
// 0001 §3) — the nested form the fixtures use, not the flat predicate one.

import { describe, expect, it } from 'vitest';
import situationFixturesJson from 'colregs/fixtures/situation-fixtures.json';
import type { Situation } from '../src/index';
import { validateSituation } from '../src/facts';

interface SituationFixtureCase {
  name: string;
  situation: Situation;
}

const fixtures = situationFixturesJson as unknown as {
  cases: SituationFixtureCase[];
};

describe('colregs situation fixtures (verbatim assignability)', () => {
  it('has the full fixture set', () => {
    expect(fixtures.cases.length).toBe(80);
  });

  for (const c of fixtures.cases) {
    it(`${c.name}: situation is assignable and validates`, () => {
      const situation: Situation = c.situation;
      expect(() => validateSituation(situation)).not.toThrow();
    });
  }
});
