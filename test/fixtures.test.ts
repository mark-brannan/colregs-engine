// Replays fixtures/applicability-fixtures.json verbatim — all cases, no
// edits, no skips. This is colregs' cross-implementation contract
// (REQ-VERIFY-1), exercised here by its second real implementation.

import { describe, expect, it } from 'vitest';
import fixturesJson from 'colregs/fixtures/applicability-fixtures.json';
import applicabilityJson from 'colregs/data/applicability.json';
import { evaluate } from '../src/evaluate';
import type { ApplicabilityData, FactRecord } from '../src/types';

const applicability = applicabilityJson as unknown as ApplicabilityData;

interface FixtureCase {
  name: string;
  facts: FactRecord;
  expect: string[];
}

const fixtures = fixturesJson as unknown as {
  jurisdiction: string;
  cases: FixtureCase[];
};

describe('colregs applicability fixtures (verbatim replay)', () => {
  it('has the full fixture set', () => {
    expect(fixtures.cases.length).toBe(53);
  });

  for (const c of fixtures.cases) {
    it(c.name, () => {
      const result = evaluate(applicability, c.facts);
      expect([...result.applied].sort()).toEqual([...c.expect].sort());
    });
  }
});
