// ADR 0010's invariant, engine half: nothing in evaluation reads `text`.
// colregs/test/text-withheld.test.mjs asserts the data side (fixtures,
// integrity checks and its own reference evaluator survive a fully
// text-stripped corpus). This asserts the same for colregs-engine, from two
// directions that catch different failures:
//
//   - statically, that no file under `src/` so much as names
//     `colregs/data/rules.json` or the generated rules type; and
//   - dynamically, that a full replay of every fixture completes with
//     `colregs/data/rules.json` made *unloadable* -- any import of it, direct
//     or transitive, throws. Neither alone is sufficient and both are load-
//     bearing: a grep cannot see an import assembled at runtime, and a poisoned
//     module does not intercept a `readFileSync` of the path or a static JSON
//     import attribute the bundler inlines. Each mutation the other misses is
//     caught by its partner, so keep both.
//
// Mocking the module with text-stripped *data* would prove nothing: the
// evaluator never loads it, so the payload is never read and the replay would
// pass against any payload at all, including an empty one. The mock has to
// fail loudly on load to have any teeth.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import applicabilityJson from 'colregs/data/applicability.json';
import fixturesJson from 'colregs/fixtures/applicability-fixtures.json';
import situationFixturesJson from 'colregs/fixtures/situation-fixtures.json';
import rulesJson from 'colregs/data/rules.json';
import { evaluateDisplay } from '../src/evaluate';
import { evaluateEncounter } from '../src/encounter';
import type { ApplicabilityData, DisplayEvaluation, FactRecord } from '../src/types';
import type { Situation } from '../src/index';

const applicability = applicabilityJson as unknown as ApplicabilityData;

interface RuleParagraph {
  path: string;
  rule: string;
  rule_title: string;
  jurisdiction: string;
  text?: string;
}

const rules = rulesJson as unknown as { paragraphs: Record<string, RuleParagraph> };

// What the engine's output must never contain. One paragraph's text is the
// single fragment `sidelights;`, which is also an ordinary term in the lights
// vocabulary the envelope legitimately carries -- searching for it would flag
// a match that is not a leak. Everything longer is a jurisdiction's own
// sentence and has no business in an output envelope.
const VOCABULARY_COLLISIONS = new Set(['sidelights;']);
const originalTexts = Object.values(rules.paragraphs)
  .map((p) => p.text)
  .filter((t): t is string => typeof t === 'string' && !VOCABULARY_COLLISIONS.has(t));

// Loading `colregs/data/rules.json` at all is the failure this is looking for,
// so the mock throws instead of returning stripped data.
const POISON = 'ADR 0010: colregs-engine loaded colregs/data/rules.json';
const poisonRules = () => {
  vi.resetModules();
  vi.doMock('colregs/data/rules.json', () => {
    throw new Error(POISON);
  });
};
const unpoison = () => {
  vi.doUnmock('colregs/data/rules.json');
  vi.resetModules();
};

interface FixtureCase {
  name: string;
  facts: FactRecord;
  expect: string[];
  jurisdiction?: string;
}

const fixtures = fixturesJson as unknown as { jurisdiction: string; cases: FixtureCase[] };

// Same skip as fixtures.test.ts: an unsupported jurisdiction path.
const displayCases = fixtures.cases.filter((c) => !('fact:on_mooring_buoy' in c.facts));

interface SituationFixtureCase {
  name: string;
  status: 'illustrative' | 'binding';
  expect: (string | { entry: string; modality: string })[];
  situation: Situation;
}

const situationFixtures = situationFixturesJson as unknown as { cases: SituationFixtureCase[] };
const bindingCases = situationFixtures.cases.filter((c) => c.status === 'binding');

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
    // A walk that silently found nothing would pass every assertion below it.
    expect(srcFiles.length).toBeGreaterThan(10);
    for (const file of srcFiles) {
      const content = readFileSync(file, 'utf8');
      expect(content).not.toMatch(/colregs\/data\/rules\.json/);
      expect(content).not.toMatch(/generated\/rules(\.js)?['"]/);
    }
  });

  it('replays applicability fixtures identically with rules.json unloadable', async () => {
    expect(displayCases.length).toBeGreaterThan(0);
    poisonRules();
    try {
      const { evaluateDisplay } = await import('../src/evaluate');
      for (const c of displayCases) {
        const result = evaluateDisplay(c.facts, { data: applicability });
        expect([...result.applied].sort()).toEqual([...c.expect].sort());
      }
    } finally {
      unpoison();
    }
  });

  it('replays situation fixtures identically with rules.json unloadable', async () => {
    expect(bindingCases.length).toBeGreaterThan(0);
    poisonRules();
    try {
      const { appliedEncounterEntries } = await import('../src/encounter');
      const idOf = (e: SituationFixtureCase['expect'][number]) =>
        typeof e === 'string' ? e : e.entry;
      for (const c of bindingCases) {
        expect([...appliedEncounterEntries(c.situation)].sort()).toEqual(
          c.expect.map(idOf).sort(),
        );
      }
    } finally {
      unpoison();
    }
  });

  it('the poison mock is armed -- loading rules.json under it throws', async () => {
    // Without this, the two replays above would still pass if `vi.doMock`
    // silently stopped resolving the specifier: they would be asserting
    // nothing but that the fixtures replay, which fixtures.test.ts and
    // situation.test.ts already cover.
    poisonRules();
    try {
      await expect(import('colregs/data/rules.json')).rejects.toThrow();
    } finally {
      unpoison();
    }
  });

  it('the display envelope carries none of the withheld text', () => {
    const results: DisplayEvaluation[] = displayCases.map((c) =>
      evaluateDisplay(c.facts, { data: applicability }),
    );
    const serialized = JSON.stringify(results);
    for (const text of originalTexts) {
      expect(serialized).not.toContain(text);
    }
    expect(serialized).not.toContain('"text"');
    expect(serialized).not.toContain('rule_title');
  });

  it('the encounter envelope carries none of the withheld text', () => {
    // The richer of the two envelopes, and the one a consumer actually ships:
    // scope, roles, overridden, modalities, categories and provenance.
    const serialized = JSON.stringify(bindingCases.map((c) => evaluateEncounter(c.situation)));
    for (const text of originalTexts) {
      expect(serialized).not.toContain(text);
    }
    expect(serialized).not.toContain('"text"');
    expect(serialized).not.toContain('rule_title');
  });

  it('provenance.represented carries only id/jurisdiction/cite/category, never text or rule_title', () => {
    let seen = 0;
    for (const c of displayCases) {
      for (const p of evaluateDisplay(c.facts, { data: applicability }).provenance.represented) {
        expect(Object.keys(p).sort()).toEqual(['category', 'cite', 'id', 'jurisdiction']);
        seen += 1;
      }
    }
    for (const c of bindingCases) {
      for (const p of evaluateEncounter(c.situation).provenance.represented) {
        expect(Object.keys(p).sort()).toEqual(['category', 'cite', 'id', 'jurisdiction']);
        seen += 1;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
