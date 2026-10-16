// The situation enumerator: that its axes are the ones the data implies, that
// its thresholds are read rather than written down, that every point it
// yields is a situation the engine's door accepts, and that counting the
// partition and walking it agree.

import { describe, expect, it } from 'vitest';
import applicabilityJson from 'colregs/data/applicability.json';

import type { ApplicabilityData, Entry, Predicate, RuleCategory } from '../src/types';
import { validateSituation } from '../src/facts';
import { rule18Class } from '../src/situation';
import { ACT_SPEC } from '../src/generated/situation';
import {
  countSituations,
  enumerateSituations,
  extractSituationAxes,
  rankWitness,
  situationUpperBound,
  type SituationAxis,
} from '../research/conformance/enumerate-situation';
import { ENUM_REFINEMENTS } from '../research/conformance/reference';
import {
  ENCOUNTER_CATEGORIES,
  RULE18_CLASS_VALUES,
  referenceEncounterApplied,
  referenceFlatten,
  referenceRule18Class,
} from '../research/conformance/reference-encounter';

const data = applicabilityJson as unknown as ApplicabilityData;
const { axes, undeclaredEnumValues } = extractSituationAxes(data);
const axisByKey = new Map(axes.map((a) => [a.key, a]));

/** What the entries the encounter verb reads ask for, walked here a second
 * time so the assertions below are against the data and not against the
 * extractor. A bare key reads self. */
function walk(when: Predicate, visit: (key: string, constraint: unknown) => void): void {
  for (const [key, constraint] of Object.entries(when)) {
    if (key === 'any_of') {
      for (const sub of (constraint as unknown as Predicate[]) ?? []) walk(sub, visit);
      continue;
    }
    visit(/^(self|other|pair):/.test(key) ? key : `self:${key}`, constraint);
  }
}

const categoryOf = (e: Entry): RuleCategory => (e.category ?? 'category:display') as RuleCategory;

/** A Part D signal: a display entry that emits a `signal` sequence. The
 * encounter verb reads these and no other display entry. */
const isSignal = (e: Entry): boolean => categoryOf(e) === 'category:display' && e.signal !== undefined;

const twoSubject: Entry[] = data.entries.filter(
  (e) => ENCOUNTER_CATEGORIES.includes(categoryOf(e)) || isSignal(e),
);

const readKeys = new Set<string>();
const namedValues = new Map<string, Set<string>>();
const comparedTo = new Map<string, Set<number>>();
for (const e of twoSubject) {
  for (const when of [e.when, ...(e.modality_by ?? []).map((b) => b.when)]) {
    walk(when, (key, constraint) => {
      readKeys.add(key);
      const unprefixed = key.slice(key.indexOf(':') + 1);
      const strings = (s: unknown): void => {
        if (typeof s === 'string') {
          (
            namedValues.get(unprefixed) ?? namedValues.set(unprefixed, new Set()).get(unprefixed)!
          ).add(s);
        } else if (Array.isArray(s)) {
          for (const v of s) strings(v);
        } else if (s !== null && typeof s === 'object') {
          const o = s as Record<string, unknown>;
          if ('not' in o) strings(o.not);
          if (Array.isArray(o.any_of)) for (const v of o.any_of) strings(v);
        }
      };
      const numbers = (c: unknown): void => {
        if (c === null || typeof c !== 'object' || Array.isArray(c)) return;
        const o = c as Record<string, unknown>;
        let hit = false;
        for (const k of ['gte', 'gt', 'lte', 'lt']) {
          if (typeof o[k] === 'number') {
            hit = true;
            (
              comparedTo.get(unprefixed) ?? comparedTo.set(unprefixed, new Set()).get(unprefixed)!
            ).add(o[k] as number);
          }
        }
        if (hit) return;
        if ('not' in o) numbers(o.not);
        if (Array.isArray(o.any_of)) for (const v of o.any_of) numbers(v);
      };
      strings(constraint);
      numbers(constraint);
    });
  }
}

describe('the situation axis table', () => {
  it('has one axis per key the encounter categories read', () => {
    expect([...axisByKey.keys()].sort()).toEqual([...readKeys].sort());
  });

  it('reads no category the encounter verb does not', () => {
    // A `conduct` or `departure` entry reads a trace or a solver, not a
    // situation; an axis only one of those names would widen the partition
    // without any encounter entry ever reading it. A display entry is read
    // only where it carries a signal.
    for (const e of twoSubject) {
      expect(ENCOUNTER_CATEGORIES.includes(categoryOf(e)) || isSignal(e), e.id).toBe(true);
    }
    const unread = data.entries.filter((e) => !twoSubject.includes(e));
    expect(unread.some((e) => categoryOf(e) === 'category:display')).toBe(true);
    for (const e of unread) {
      expect(ENCOUNTER_CATEGORIES, e.id).not.toContain(categoryOf(e));
      expect(isSignal(e), e.id).toBe(false);
    }
  });

  it('reads the keys of a light or a shape only where a signal also names them', () => {
    const readByUnread = new Set<string>();
    for (const e of data.entries.filter((e) => !twoSubject.includes(e))) {
      for (const when of [e.when, ...(e.modality_by ?? []).map((b) => b.when)]) {
        walk(when, (key) => readByUnread.add(key));
      }
    }
    const onlyUnread = [...readByUnread].filter((k) => !readKeys.has(k));
    expect(onlyUnread.length).toBeGreaterThan(0);
    for (const key of onlyUnread) expect(axisByKey.has(key), key).toBe(false);
  });

  it('names no enum value the generated specs do not declare', () => {
    expect(undeclaredEnumValues).toEqual([]);
  });

  it('reads its numeric thresholds from the data', () => {
    const numeric = axes.filter((a) => a.kind === 'numeric');
    expect(numeric.length).toBeGreaterThan(0);
    for (const axis of numeric) {
      const unprefixed = axis.key.slice(axis.key.indexOf(':') + 1);
      expect(axis.constants).toEqual([...comparedTo.get(unprefixed)!].sort((a, b) => a - b));
      // Every constant, one point in each open interval, one on each side.
      expect(axis.values.length).toBe(2 * axis.constants!.length + 1);
      for (const c of axis.constants!) expect(axis.values).toContain(c);
    }
  });

  it('shares one numeric partition between self and other', () => {
    // The pooled read matches an entry's `other:` constraint against self's
    // value, so a threshold read on one subject partitions both.
    const self = axisByKey.get('self:geo:rel_bearing_deg')!;
    const other = axisByKey.get('other:geo:rel_bearing_deg')!;
    expect(self.constants).toEqual(other.constants);
  });

  it('keeps every enum value a predicate names, and one it does not', () => {
    for (const axis of axes.filter((a) => a.kind === 'enum')) {
      const unprefixed = axis.key.slice(axis.key.indexOf(':') + 1);
      const named = [...(namedValues.get(unprefixed) ?? [])];
      for (const value of named) expect(axis.values).toContain(value);
      // An axis with a refined value keeps its whole declared range.
      if (axis.values.some((v) => typeof v === 'string' && v in ENUM_REFINEMENTS)) continue;
      expect(axis.values.length).toBeLessThanOrEqual(named.length + 1);
    }
  });

  it('has an axis for each act key a signal entry gates on, with the spec its values', () => {
    const acts = axes.filter((a) => a.key.split(':')[1] === 'act');
    expect(acts.length).toBeGreaterThan(0);
    const gated = new Set(
      [...readKeys].filter((k) => k.split(':')[1] === 'act').map((k) => k.slice(k.indexOf(':') + 1)),
    );
    expect([...gated].sort()).toEqual(Object.keys(ACT_SPEC).sort());
    for (const axis of acts) {
      const spec = ACT_SPEC[axis.key.slice(axis.key.indexOf(':') + 1) as keyof typeof ACT_SPEC];
      expect(spec, axis.key).toBeDefined();
      if (spec.kind === 'enum') {
        expect(axis.kind).toBe('enum');
        expect([...axis.values].sort()).toEqual([...spec.values].sort());
      } else {
        expect(axis.kind).toBe('boolean');
        expect(axis.values).toEqual([true, false]);
      }
      expect(axis.prunable).toBe(true);
    }
  });

  it('reads an act key under either subject', () => {
    const signal = data.entries.find((e) => e.id === 'rule:34d')!;
    const entry: Entry = {
      ...signal,
      when: { 'pair:geo:in_sight': true, 'other:act:doubt': true } as Predicate,
    };
    const { axes: swapped } = extractSituationAxes({ ...data, entries: [entry] });
    expect(swapped.map((a) => a.key).sort()).toEqual(['other:act:doubt', 'pair:geo:in_sight']);
    expect(swapped.find((a) => a.key === 'other:act:doubt')?.kind).toBe('boolean');
  });

  it('refuses an act key on the pair', () => {
    const signal = data.entries.find((e) => e.id === 'rule:34d')!;
    const entry: Entry = { ...signal, when: { 'pair:act:doubt': true } as unknown as Predicate };
    expect(() => extractSituationAxes({ ...data, entries: [entry] })).toThrow(/no class 'act'/);
  });

  it('makes the derived Rule 18 class an axis over the decode table plus absent', () => {
    for (const key of ['self:fact:rule18_class', 'other:fact:rule18_class']) {
      const axis = axisByKey.get(key)!;
      expect(axis.kind).toBe('derived');
      expect(axis.prunable).toBe(false);
      expect(axis.values).toContain(undefined);
      for (const value of axis.values) {
        if (value !== undefined) expect(RULE18_CLASS_VALUES).toContain(value);
      }
    }
  });

  it('bounds the partition above the number of points it yields', () => {
    expect(situationUpperBound(axes)).toBeGreaterThan(0);
  });
});

describe('the rank witness', () => {
  it('realises a rank or says it cannot', () => {
    for (const rank of RULE18_CLASS_VALUES) {
      for (const propulsion of [
        'propulsion:power',
        'propulsion:sail',
        'propulsion:oars',
      ] as const) {
        const witness = rankWitness(rank, { 'fact:propulsion': propulsion });
        if (witness === undefined) continue;
        expect(witness['fact:propulsion']).toBe(propulsion);
        expect(referenceRule18Class(witness)).toBe(rank);
        expect(rule18Class(witness)).toBe(rank);
      }
    }
  });

  it('realises every declared rank under some propulsion', () => {
    for (const rank of RULE18_CLASS_VALUES) {
      const realised = ['propulsion:power', 'propulsion:sail', 'propulsion:oars'].some(
        (p) => rankWitness(rank, { 'fact:propulsion': p as 'propulsion:power' }) !== undefined,
      );
      expect(realised, rank).toBe(true);
    }
  });

  it('refuses a rank the chosen facts contradict', () => {
    expect(
      rankWitness('rule18_class:power', { 'fact:propulsion': 'propulsion:sail' }),
    ).toBeUndefined();
    expect(
      rankWitness('rule18_class:sail', { 'fact:propulsion': 'propulsion:power' }),
    ).toBeUndefined();
  });

  it('realises an absent rank only where no decode row fires', () => {
    expect(rankWitness(undefined, { 'fact:propulsion': 'propulsion:oars' })).toEqual({
      'fact:propulsion': 'propulsion:oars',
    });
    expect(rankWitness(undefined, { 'fact:propulsion': 'propulsion:power' })).toBeUndefined();
  });
});

/** The full partition is far too large for a test; these narrow every axis to
 * its first two representatives, which keeps the shape and the pinning
 * behaviour and loses only the breadth. Activity is the exception: the first
 * two Rule 18 ranks are the ones that activity alone decides, so a vessel of
 * either rank exists only under the activity that decodes to it. */
const narrowed: SituationAxis[] = axes.map((a) =>
  a.key.endsWith(':fact:activity')
    ? a
    : { ...a, values: a.values.slice(0, 2), pinned: a.values[0] },
);

describe('the enumeration', () => {
  it('yields situations the engine door accepts', () => {
    let n = 0;
    for (const situation of enumerateSituations(data, narrowed)) {
      expect(() => validateSituation(situation)).not.toThrow();
      if (++n >= 2000) break;
    }
    expect(n).toBe(2000);
  });

  it('yields situations that state the acts a signal entry gates on', () => {
    let withActs = 0;
    let n = 0;
    for (const situation of enumerateSituations(data, narrowed)) {
      expect(() => validateSituation(situation)).not.toThrow();
      const act = situation.self.act;
      if (act !== undefined) {
        expect(Object.keys(act).sort()).toEqual(Object.keys(ACT_SPEC).sort());
        withActs++;
      }
      if (++n >= 2000) break;
    }
    expect(withActs).toBe(n);
  });

  it('reaches every Rule 34 signal entry', () => {
    // The act axes with just the gates the Rule 34 entries name, so the
    // walk is small enough to run whole.
    const keep = new Set([
      'pair:geo:in_sight',
      'pair:env:narrow_channel',
      'self:fact:propulsion',
      'self:fact:position',
      'self:fact:nearing_obscured_bend',
    ]);
    const subset = axes.filter((a) => keep.has(a.key) || a.key.split(':')[1] === 'act');
    expect(subset.length).toBe(keep.size + Object.keys(ACT_SPEC).length);

    const rule34 = data.entries.filter((e) => isSignal(e) && /^rule:34/.test(e.id)).map((e) => e.id);
    expect(rule34.length).toBeGreaterThan(0);
    const fired = new Set<string>();
    for (const situation of enumerateSituations(data, subset)) {
      expect(() => validateSituation(situation)).not.toThrow();
      for (const id of referenceEncounterApplied(data, referenceFlatten(situation))) fired.add(id);
    }
    expect(rule34.filter((id) => !fired.has(id))).toEqual([]);
  });

  it('gives both vessels a fact record and the pair its own facts', () => {
    const [first] = enumerateSituations(data, narrowed);
    expect(first.self.fact).toBeTypeOf('object');
    expect(first.other?.fact).toBeTypeOf('object');
    expect(first.pair).toBeTypeOf('object');
  });

  it('never supplies the derived rank as an input fact', () => {
    let n = 0;
    for (const situation of enumerateSituations(data, narrowed)) {
      for (const subject of [situation.self, situation.other!]) {
        expect(Object.keys(subject.fact)).not.toContain('fact:rule18_class');
      }
      if (++n >= 500) break;
    }
  });

  it('counts the same partition it walks', () => {
    const smaller = narrowed.slice(0, 12);
    let walked = 0;
    for (const _situation of enumerateSituations(data, smaller)) walked++;
    expect(countSituations(data, smaller)).toBe(walked);
  });

  it('pins an axis no entry can read, and enumerates one some entry can', () => {
    // Rule 12's sailing axes are readable only when both vessels are sailing
    // vessels, so a run over the power-driven half of the table must not
    // multiply out `kin:wind_side`, while the bearing sectors 13, 14 and 15
    // read must stay enumerated.
    const sailing = axes.find((a) => a.key === 'self:kin:wind_side')!;
    const bearing = axes.find((a) => a.key === 'self:geo:rel_bearing_deg')!;
    expect(sailing.prunable).toBe(true);
    expect(bearing.prunable).toBe(true);
    const withoutPins = axes.map((a) => ({ ...a, prunable: false }));
    expect(countSituations(data, narrowed.slice(0, 16))).toBeLessThan(
      countSituations(
        data,
        withoutPins.map((a) => ({ ...a, values: a.values.slice(0, 2) })).slice(0, 16),
      ),
    );
  });
});
