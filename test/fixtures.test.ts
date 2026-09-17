// Replays fixtures/applicability-fixtures.json verbatim — all cases, no
// edits, no skips. This is colregs' cross-implementation contract
// (REQ-VERIFY-1), exercised here by its second real implementation.

import { describe, expect, it } from 'vitest';
import fixturesJson from 'colregs/fixtures/applicability-fixtures.json';
import applicabilityJson from 'colregs/data/applicability.json';
import colregsPackage from 'colregs/package.json';
import { evaluateDisplay } from '../src/evaluate';
import type { ApplicabilityData, DisplayEvaluation, FactRecord } from '../src/types';

const applicability = applicabilityJson as unknown as ApplicabilityData;

function evaluate(
  data: ApplicabilityData,
  facts: FactRecord,
  jurisdiction: string,
): DisplayEvaluation {
  return evaluateDisplay(facts, { data, jurisdiction });
}

/** A plain entry id, or (ADR 0021) an `{entry, modality}` pair asserting the
 * resolved modality after any shift — e.g. Rule 20(c) in force. */
type FixtureExpectation = string | { entry: string; modality: string };

interface FixtureCase {
  name: string;
  facts: FactRecord;
  expect: FixtureExpectation[];
  /** colregs 0.2.2 (ADR 0008): a case may declare a jurisdiction other than
   * the file's default, for a national delta (e.g. the mooring-buoy case). */
  jurisdiction?: string;
}

const fixtures = fixturesJson as unknown as {
  jurisdiction: string;
  cases: FixtureCase[];
};

describe('colregs applicability fixtures (verbatim replay)', () => {
  it('has the full fixture set', () => {
    expect(fixtures.cases.length).toBe(114);
  });

  // The fixtures are colregs' contract, so an evaluation of one must say
  // which colregs release it replayed. A mismatch here means the engine
  // answered against data other than the pinned package.
  it('reports the colregs version it evaluated against', () => {
    const result = evaluate(applicability, fixtures.cases[0].facts, fixtures.jurisdiction);
    expect(result.colregs.version).toBe(colregsPackage.version);
    expect(result.colregs.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  for (const c of fixtures.cases) {
    it(c.name, () => {
      const jurisdiction = c.jurisdiction ?? fixtures.jurisdiction;
      const result = evaluate(applicability, c.facts, jurisdiction);
      const expectedIds = c.expect.map((e) => (typeof e === 'string' ? e : e.entry));
      expect([...result.applied].sort()).toEqual([...expectedIds].sort());

      for (const e of c.expect) {
        if (typeof e === 'string') continue;
        expect(result.modalities[e.entry]).toBe(e.modality);
      }
    });
  }
});
