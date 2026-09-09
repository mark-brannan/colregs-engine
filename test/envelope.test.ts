// The output envelope's category, status-alphabet and provenance fields,
// and the pre-existing fields they were added beside.

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import applicabilityJson from 'colregs/data/applicability.json';
import { evaluateDisplay } from '../src/evaluate';
import type {
  ApplicabilityData,
  FactRecord,
  RuleCategory,
  Rule2DepartureStatus,
} from '../src/types';

const applicability = applicabilityJson as unknown as ApplicabilityData;

const sloop12: FactRecord = {
  'fact:propulsion': 'propulsion:sail',
  'fact:activity': 'activity:none',
  'fact:position': 'position:underway',
  'fact:length_m': 12,
};

// A record that pulls entries in by relation as well as by predicate, so the
// key sets below cover imported entries and not only applied ones.
const trawler30: FactRecord = {
  'fact:propulsion': 'propulsion:power',
  'fact:activity': 'activity:fishing',
  'fact:position': 'position:underway',
  'fact:making_way': true,
  'fact:length_m': 30,
};

// The union's members, written out so a rename in colregs' schema is a
// compile error here and a change to its `categories` block is the failure
// below rather than a silent gap.
const CATEGORIES: RuleCategory[] = [
  'definition',
  'standard',
  'scope',
  'display',
  'classification',
  'precedence',
  'conduct',
  'care',
  'meta',
];

const STATUSES: Rule2DepartureStatus[] = [
  'not-flagged',
  'model-rule-conflict',
  'no-robust-policy-in-model',
  'inconclusive-in-model',
];

describe('the category vocabulary', () => {
  it('is the one colregs declares', () => {
    expect(Object.keys(applicability.categories ?? {}).sort()).toEqual(
      [...CATEGORIES].sort(),
    );
  });

  it('is reported per applied and imported entry, over modalities key set', () => {
    for (const facts of [sloop12, trawler30]) {
      const result = evaluateDisplay(facts);
      expect(Object.keys(result.categories)).toEqual(
        Object.keys(result.modalities),
      );
      expect(Object.keys(result.categories).length).toBeGreaterThan(0);
    }
  });

  it("applies colregs' absent-means-display default", () => {
    const result = evaluateDisplay(trawler30);
    const byId = new Map(applicability.entries.map((e) => [e.id, e]));
    for (const [id, category] of Object.entries(result.categories)) {
      expect(category).toBe('display');
      // The default is the point: these entries carry no `category` at all.
      expect(byId.get(id)?.category ?? 'display').toBe(category);
    }
  });

  it('never reports an entry the display verb did not evaluate', () => {
    const nonDisplay = new Set(
      applicability.entries
        .filter((e) => (e.category ?? 'display') !== 'display')
        .map((e) => e.id),
    );
    expect(nonDisplay.size).toBeGreaterThan(0);
    const result = evaluateDisplay(trawler30);
    for (const id of Object.keys(result.categories)) {
      expect(nonDisplay.has(id)).toBe(false);
    }
  });
});

describe('the status alphabet', () => {
  it("is the four labels colregs' ADR 0005 §5 fixes", () => {
    const require_ = createRequire(import.meta.url);
    const root = dirname(require_.resolve('colregs/package.json'));
    const adr = readFileSync(
      join(root, 'docs/adr/0005-rule-categories-and-the-situation-record.md'),
      'utf8',
    );
    for (const status of STATUSES) expect(adr).toContain(status);
    expect(new Set(STATUSES).size).toBe(4);
  });

  it('is a type only: a display evaluation carries no status field', () => {
    const result = evaluateDisplay(sloop12) as unknown as Record<
      string,
      unknown
    >;
    expect('status' in result).toBe(false);
    const values = new Set<unknown>(Object.values(result.provenance as object));
    for (const status of STATUSES) expect(values.has(status)).toBe(false);
  });
});

describe('provenance', () => {
  it('names the categories the verb evaluated', () => {
    expect(evaluateDisplay(sloop12).provenance.evaluated_categories).toEqual([
      'display',
    ]);
  });

  it('names every jurisdiction whose entries were eligible to match', () => {
    const expected = [
      ...new Set(
        applicability.entries
          .filter((e) => (e.category ?? 'display') === 'display')
          .map((e) => e.jurisdiction),
      ),
    ];
    expect(evaluateDisplay(sloop12).provenance.jurisdictions).toEqual(expected);
    // The engine has no jurisdiction parameter, so more than one is offered.
    // A single-jurisdiction result here would mean the gap had quietly closed.
    expect(expected.length).toBeGreaterThan(1);
  });

  it('carries the represented paragraphs, identity only, never the prose', () => {
    const { represented } = evaluateDisplay(sloop12).provenance;
    expect(represented.map((p) => p.id)).toEqual(['2a', '2b']);
    expect(represented.map((p) => p.category)).toEqual(['care', 'meta']);
    expect(represented.map((p) => p.cite)).toEqual(['2(a)', '2(b)']);
    for (const p of represented) {
      expect(Object.keys(p).sort()).toEqual([
        'category',
        'cite',
        'id',
        'jurisdiction',
      ]);
    }
  });

  it('never reports a represented paragraph as applied', () => {
    const result = evaluateDisplay(sloop12);
    for (const p of result.provenance.represented) {
      expect(result.applied).not.toContain(p.id);
      expect(result.categories[p.id]).toBeUndefined();
    }
  });

  it('describes the caller-supplied data, not the resolved release', () => {
    const oneJurisdiction: ApplicabilityData = {
      ...applicability,
      entries: applicability.entries.filter((e) => e.jurisdiction === 'intl'),
      represented_paragraphs: [],
    };
    const result = evaluateDisplay(sloop12, { data: oneJurisdiction });
    expect(result.provenance.jurisdictions).toEqual(['intl']);
    expect(result.provenance.represented).toEqual([]);
    expect(result.colregs.source).toBe('caller');
  });

  it('survives data with no represented_paragraphs at all', () => {
    const stripped = { ...applicability } as ApplicabilityData;
    delete stripped.represented_paragraphs;
    expect(
      evaluateDisplay(sloop12, { data: stripped }).provenance.represented,
    ).toEqual([]);
  });
});

describe('the fields a consumer already reads', () => {
  // searoom renders applied/displays/exempted/excluded/modalities; colregs-mcp
  // serialises the whole envelope. The additions are additive: nothing here
  // is renamed, re-typed or reordered.
  it('are all still present, and the additions are the only new keys', () => {
    const result = evaluateDisplay(trawler30);
    expect(Object.keys(result).sort()).toEqual([
      'applied',
      'categories',
      'colregs',
      'displays',
      'excluded',
      'exempted',
      'modalities',
      'optionalAdditions',
      'optional_additions',
      'overridden',
      'provenance',
    ]);
  });

  it('carry what they carried: the fixture contract is untouched', () => {
    const result = evaluateDisplay(sloop12);
    expect(result.applied).toEqual(['25a', '25b', '25c']);
    expect(result.displays.length).toBe(3);
    expect(result.exempted).toEqual([]);
    expect(result.excluded).toEqual([]);
    expect(result.overridden).toEqual([]);
    expect(result.modalities['25a']).toBe('shall');
    expect(result.colregs.source).toBe('resolved');
  });

  it('serialise: the envelope is still JSON round-trippable', () => {
    const result = evaluateDisplay(trawler30);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
});
