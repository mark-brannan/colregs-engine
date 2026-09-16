// ADR 0010's invariant, engine half: nothing in evaluation reads `text`.
// colregs/test/text-withheld.test.mjs asserts the data side (fixtures,
// integrity checks and its own reference evaluator survive a fully
// text-stripped corpus). This asserts the same for colregs-engine.
//
// Where the words live (colregs >= 0.3, ADR 0003 / ADR 0013): `data/rules.json`
// is a language-neutral skeleton with no text at all; the text sits in the
// corpus files under `data/text/`, one per edition x language x source, indexed
// by `data/corpora.json`. So the specifiers the engine must never load are the
// skeleton, the index and every corpus the index lists -- TEXT_SPECIFIERS
// below, derived from the index so a new corpus is covered the day it ships.
//
// Two directions, catching different failures:
//
//   - statically, that no file under `src/` so much as names one of those
//     specifiers or the generated rules type; and
//   - dynamically, that a full replay of every fixture completes with every
//     text-bearing specifier made *unloadable* -- any import of one, direct
//     or transitive, throws. Neither alone is sufficient and both are load-
//     bearing: a grep cannot see an import assembled at runtime, and the
//     poisoned modules intercept only *dynamic* imports -- a static `import`
//     of one, with or without an import attribute, loads the real file
//     untouched (verified by mutation against src/encounter.ts), as does a
//     `readFileSync` of the path. Each mutation the other misses is caught by
//     its partner, so keep both.
//
// Mocking a module with text-stripped *data* would prove nothing: the
// evaluator never loads it, so the payload is never read and the replay would
// pass against any payload at all, including an empty one. The mock has to
// fail loudly on load to have any teeth.

import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import applicabilityJson from 'colregs/data/applicability.json';
import corporaJson from 'colregs/data/corpora.json';
import fixturesJson from 'colregs/fixtures/applicability-fixtures.json';
import situationFixturesJson from 'colregs/fixtures/situation-fixtures.json';
import { evaluateDisplay } from '../src/evaluate';
import { evaluateEncounter } from '../src/encounter';
import type { CorporaData } from '../src/generated/corpora';
import type { ApplicabilityData, DisplayEvaluation, FactRecord } from '../src/types';
import type { Situation } from '../src/index';

const applicability = applicabilityJson as unknown as ApplicabilityData;
const corpora = corporaJson as unknown as CorporaData;
const colregsData = dirname(createRequire(import.meta.url).resolve('colregs/data/corpora.json'));

// Every specifier that carries, or indexes, a jurisdiction's words.
const TEXT_SPECIFIERS = [
  'colregs/data/rules.json',
  'colregs/data/corpora.json',
  ...Object.values(corpora.corpora).map((c) => `colregs/data/${c.file}`),
];

// What the engine's output must never contain: every paragraph's text from
// every corpus, unfiltered. Read from disk rather than imported so the
// reference copy never goes through the module graph the poison below guards.
// Some corpus fragments are short (`sidelights;`, `a sternlight.`); none
// currently collides with the vocabulary the envelope legitimately carries.
// If a release changes that, these tests fail loudly and the exclusion gets
// added then, by name, with evidence.
interface Corpus {
  paragraphs: Record<string, { text?: string }>;
}
const originalTexts = Object.values(corpora.corpora).flatMap((c) => {
  const corpus = JSON.parse(readFileSync(join(colregsData, c.file), 'utf8')) as Corpus;
  return Object.values(corpus.paragraphs)
    .map((p) => p.text)
    .filter((t): t is string => typeof t === 'string');
});

// Loading any text-bearing specifier at all is the failure this is looking
// for, so the mocks throw instead of returning stripped data. vitest wraps a
// throwing factory in its own error and keeps ours as `cause`.
const POISON = 'ADR 0010: colregs-engine loaded a text-bearing colregs data file';
const poisonText = () => {
  vi.resetModules();
  for (const spec of TEXT_SPECIFIERS) {
    vi.doMock(spec, () => {
      throw new Error(POISON);
    });
  }
};
const unpoison = () => {
  for (const spec of TEXT_SPECIFIERS) vi.doUnmock(spec);
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
  it('the corpus index lists text to guard against', () => {
    // A guard over an empty corpus set would pass every assertion below it.
    expect(TEXT_SPECIFIERS.length).toBeGreaterThan(2);
    expect(originalTexts.length).toBeGreaterThan(0);
  });

  it('no source file imports a text-bearing colregs data file or the generated rules type', () => {
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
      expect(content).not.toMatch(/colregs\/data\/corpora\.json/);
      expect(content).not.toMatch(/colregs\/data\/text\//);
      expect(content).not.toMatch(/generated\/rules(\.js)?['"]/);
    }
  });

  it('replays applicability fixtures identically with every text-bearing file unloadable', async () => {
    expect(displayCases.length).toBeGreaterThan(0);
    poisonText();
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

  it('replays situation fixtures identically with every text-bearing file unloadable', async () => {
    expect(bindingCases.length).toBeGreaterThan(0);
    poisonText();
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

  it('the poison is armed -- loading any text-bearing file under it throws', async () => {
    // Without this, the two replays above would still pass if `vi.doMock`
    // silently stopped resolving a specifier: they would be asserting
    // nothing but that the fixtures replay, which fixtures.test.ts and
    // situation.test.ts already cover.
    poisonText();
    try {
      for (const spec of TEXT_SPECIFIERS) {
        await expect(import(spec)).rejects.toHaveProperty('cause.message', POISON);
      }
    } finally {
      unpoison();
    }
  });

  it('the display envelope carries none of the corpus text', () => {
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

  it('the encounter envelope carries none of the corpus text', () => {
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
