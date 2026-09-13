// Replays fixtures/situation-fixtures.json verbatim: every binding case's
// `situation` must be assignable to `Situation` unedited (ADR 0011 §3), and
// the entries it `expect`s must be exactly the ones appliedEncounterEntries
// returns, with the modality each `{entry, modality}` element names. An
// illustrative case fixes shape only; its expect is empty and not asserted.

import { describe, expect, it } from 'vitest';
import situationFixturesJson from 'colregs/fixtures/situation-fixtures.json';
import type { Situation } from '../src/index';
import { appliedEncounterEntries, evaluateEncounter } from '../src/index';
import { validateSituation } from '../src/facts';

type Expectation = string | { entry: string; modality: string };

interface SituationFixtureCase {
  name: string;
  status: 'illustrative' | 'binding';
  expect: Expectation[];
  situation: Situation;
}

const fixtures = situationFixturesJson as unknown as {
  cases: SituationFixtureCase[];
};

const idOf = (e: Expectation) => (typeof e === 'string' ? e : e.entry);

describe('colregs situation fixtures (verbatim replay)', () => {
  it('has the full fixture set', () => {
    expect(fixtures.cases.length).toBe(80);
  });

  for (const c of fixtures.cases) {
    it(`${c.name}: situation is assignable and validates`, () => {
      const situation: Situation = c.situation;
      expect(() => validateSituation(situation)).not.toThrow();
    });

    if (c.status !== 'binding') continue;

    it(`${c.name}: applied entries match`, () => {
      expect([...appliedEncounterEntries(c.situation)].sort()).toEqual(
        c.expect.map(idOf).sort(),
      );
    });

    const withModality = c.expect.filter((e) => typeof e !== 'string');
    if (withModality.length === 0) continue;
    it(`${c.name}: expected modalities match`, () => {
      const result = evaluateEncounter(c.situation);
      for (const e of withModality) {
        expect(result.modalities[idOf(e)]).toBe((e as { modality: string }).modality);
      }
    });
  }
});
