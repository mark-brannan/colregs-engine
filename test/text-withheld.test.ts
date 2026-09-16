// ADR 0010's invariant, engine half: nothing in evaluation reads `text`.
// colregs/test/text-withheld.test.mjs asserts the data side (fixtures,
// integrity checks and its own reference evaluator survive a fully
// text-stripped corpus). This asserts the same for colregs-engine: the
// evaluator never imports colregs' rules.json in the first place, so
// stripping every paragraph's text and replaying every fixture through it
// must change nothing, and the output envelope must never carry `text` or a
// jurisdiction's own words for a withheld paragraph.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import applicabilityJson from 'colregs/data/applicability.json';
import fixturesJson from 'colregs/fixtures/applicability-fixtures.json';
import situationFixturesJson from 'colregs/fixtures/situation-fixtures.json';
import rulesJson from 'colregs/data/rules.json';
import { evaluateDisplay } from '../src/evaluate';
import type { ApplicabilityData, DisplayEvaluation, FactRecord } from '../src/types';
import type { Situation } from '../src/index';

const applicability = applicabilityJson as unknown as ApplicabilityData;

interface RuleParagraph {
  path: string;
  rule: string;
  rule_title: string;
  jurisdiction: string;
  text?: string;
  text_status?: 'verbatim' | 'withheld';
  withheld_reason?: string;
  mirrors?: string;
}

interface RulesData {
  paragraphs: Record<string, RuleParagraph>;
}

const rules = rulesJson as unknown as RulesData;

// Every paragraph's `text` removed, `text_status` flipped to `withheld` and
// a reason recorded -- the same shape colregs' own test strips to. This
// engine never reads `rules.json` (see the structural check above), so a
// `mirrors` field on these paragraphs would be dead setup: nothing here
// consults it, and there is no mirror-resolution path in evaluate.ts or
// encounter.ts to exercise.
const withheldRules: RulesData = {
  ...rules,
  paragraphs: Object.fromEntries(
    Object.entries(rules.paragraphs).map(([path, p]) => {
      const { text, ...structure } = p;
      return [
        path,
        {
          ...structure,
          text_status: 'withheld' as const,
          withheld_reason: 'stripped for the ADR 0010 invariant',
        },
      ];
    }),
  ),
};

const originalTexts = Object.values(rules.paragraphs)
  .map((p) => p.text)
  .filter((t): t is string => typeof t === 'string' && t.length > 12);

interface FixtureCase {
  name: string;
  facts: FactRecord;
  expect: string[];
  jurisdiction?: string;
}

const fixtures = fixturesJson as unknown as { jurisdiction: string; cases: FixtureCase[] };

interface SituationFixtureCase {
  name: string;
  status: 'illustrative' | 'binding';
  expect: (string | { entry: string; modality: string })[];
  situation: Situation;
}

const situationFixtures = situationFixturesJson as unknown as { cases: SituationFixtureCase[] };

describe('ADR 0010 (engine half): nothing in colregs-engine reads rule text', () => {
  it('no source file imports colregs rules.json or its generated type', () => {
    // The invariant is structural, not incidental: the evaluator has no path
    // to `text` at all. Asserted directly against the source tree so a
    // future import is caught here rather than only by the behavioural
    // checks below.
    const srcDir = join(__dirname, '..', 'src');
    const srcFiles = readdirSync(srcDir, { recursive: true, withFileTypes: true })
      .filter((f) => f.isFile() && f.name.endsWith('.ts'))
      .map((f) => join(f.parentPath ?? srcDir, f.name));
    for (const file of srcFiles) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/colregs\/data\/rules\.json/);
      expect(content).not.toMatch(/generated\/rules(\.js)?['"]/);
    }
  });

  it('replays applicability fixtures identically with rules.json text stripped', async () => {
    vi.resetModules();
    vi.doMock('colregs/data/rules.json', () => ({ default: withheldRules }));
    const { evaluateDisplay } = await import('../src/evaluate');
    try {
      for (const c of fixtures.cases) {
        if ('fact:on_mooring_buoy' in c.facts) continue; // unsupported jurisdiction path, same skip as fixtures.test.ts
        const result = evaluateDisplay(c.facts, { data: applicability });
        expect([...result.applied].sort()).toEqual([...c.expect].sort());
      }
    } finally {
      vi.doUnmock('colregs/data/rules.json');
      vi.resetModules();
    }
  });

  it('replays situation fixtures identically with rules.json text stripped', async () => {
    vi.resetModules();
    vi.doMock('colregs/data/rules.json', () => ({ default: withheldRules }));
    const { appliedEncounterEntries } = await import('../src/encounter');
    try {
      const idOf = (e: SituationFixtureCase['expect'][number]) =>
        typeof e === 'string' ? e : e.entry;
      for (const c of situationFixtures.cases) {
        if (c.status !== 'binding') continue;
        expect([...appliedEncounterEntries(c.situation)].sort()).toEqual(
          c.expect.map(idOf).sort(),
        );
      }
    } finally {
      vi.doUnmock('colregs/data/rules.json');
      vi.resetModules();
    }
  });

  it('the output envelope carries none of the withheld text', () => {
    const results: DisplayEvaluation[] = fixtures.cases
      .filter((c) => !('fact:on_mooring_buoy' in c.facts))
      .map((c) => evaluateDisplay(c.facts, { data: applicability }));
    const serialized = JSON.stringify(results);
    for (const text of originalTexts) {
      expect(serialized).not.toContain(text);
    }
    expect(serialized).not.toContain('"text"');
    expect(serialized).not.toContain('rule_title');
  });

  it('provenance.represented carries only id/jurisdiction/cite/category, never text or rule_title', () => {
    const result = evaluateDisplay(fixtures.cases[0].facts, { data: applicability });
    for (const p of result.provenance.represented) {
      expect(Object.keys(p).sort()).toEqual(['category', 'cite', 'id', 'jurisdiction'].sort());
    }
  });
});
