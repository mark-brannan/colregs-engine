// The Part B reference read against the engine, on colregs' own situation
// fixtures: 84 cases the data itself binds. A disagreement here is either a
// reference bug or an engine bug, and the conformance harness cannot tell the
// two apart on a fixture it has never checked.

import { describe, expect, it } from 'vitest';
import applicabilityJson from 'colregs/data/applicability.json';
import situationFixturesJson from 'colregs/fixtures/situation-fixtures.json';

import type { ApplicabilityData, FixtureExpectation, Situation } from '../src/types';
import { evaluateEncounter } from '../src/index';
import { appliedEncounterEntries } from '../src/encounter';
import { rule18Class } from '../src/situation';
import {
  RULE18_CLASS_VALUES,
  referenceEncounter,
  referenceRule18Class,
  swapFrame,
} from '../research/conformance/reference-encounter';

const data = applicabilityJson as unknown as ApplicabilityData;

interface FixtureCase {
  name: string;
  status: 'illustrative' | 'binding';
  expect: FixtureExpectation[];
  situation: Situation;
  roles?: { self: { role: string; by: string }[]; other: { role: string; by: string }[] };
}

const fixtures = situationFixturesJson as unknown as { cases: FixtureCase[] };

describe('the reference Rule 18 class decode', () => {
  it('reads the same table the engine reads', () => {
    for (const c of fixtures.cases) {
      for (const subject of [c.situation.self, c.situation.other]) {
        if (!subject) continue;
        expect(referenceRule18Class(subject.fact)).toBe(rule18Class(subject.fact));
      }
    }
  });

  it('yields only values facts.json declares', () => {
    for (const c of fixtures.cases) {
      for (const subject of [c.situation.self, c.situation.other]) {
        if (!subject) continue;
        const rank = referenceRule18Class(subject.fact);
        if (rank !== undefined) expect(RULE18_CLASS_VALUES).toContain(rank);
      }
    }
  });
});

describe('the reference encounter read against the engine', () => {
  for (const c of fixtures.cases) {
    it(`${c.name}: applied entries agree`, () => {
      const reference = referenceEncounter(data, c.situation);
      expect([...reference.applied].sort()).toEqual([...appliedEncounterEntries(c.situation)].sort());
    });

    it(`${c.name}: the whole envelope agrees`, () => {
      const reference = referenceEncounter(data, c.situation);
      const engine = evaluateEncounter(c.situation);
      expect(reference.scope).toEqual(engine.scope);
      expect(reference.encounter).toEqual(engine.encounter);
      expect(reference.risk_of_collision).toEqual(engine.risk_of_collision);
      expect(reference.modalities).toEqual(engine.modalities);
      expect(reference.categories).toEqual(engine.categories);
      expect(reference.roles).toEqual(engine.roles);
      expect([...reference.overridden].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
        [...engine.overridden].sort((a, b) => a.id.localeCompare(b.id)),
      );
    });

    if (!c.roles) continue;
    it(`${c.name}: pooled roles match the fixture (ADR 0016)`, () => {
      expect(referenceEncounter(data, c.situation).roles).toEqual(c.roles);
    });
  }
});

describe('the swapped frame', () => {
  it('exchanges the subjects and leaves the pair alone', () => {
    const withOther = fixtures.cases.find((c) => c.situation.other !== undefined)!;
    const swapped = swapFrame(withOther.situation)!;
    expect(swapped.self).toBe(withOther.situation.other);
    expect(swapped.other).toBe(withOther.situation.self);
    expect(swapped.pair).toBe(withOther.situation.pair);
  });

  it('is undefined for a one-vessel situation', () => {
    const oneVessel = fixtures.cases.find((c) => c.situation.other === undefined);
    if (!oneVessel) return;
    expect(swapFrame(oneVessel.situation)).toBeUndefined();
  });

  it('gives a vessel her own roles back when she is read from the other seat', () => {
    const crossing = fixtures.cases.find((c) => c.roles !== undefined)!;
    const direct = referenceEncounter(data, crossing.situation);
    const swapped = referenceEncounter(data, swapFrame(crossing.situation)!);
    expect(swapped.roles.other).toEqual(direct.roles.self);
    expect(swapped.roles.self).toEqual(direct.roles.other);
  });
});
