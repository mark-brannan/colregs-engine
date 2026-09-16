// evaluateEncounter's envelope: roles, encounter type, risk grounds,
// rel:overrides between the applied entries, and the derived Rule 18 class.

import { describe, expect, it } from 'vitest';
import situationFixturesJson from 'colregs/fixtures/situation-fixtures.json';
import applicabilityJson from 'colregs/data/applicability.json';
import { appliedEncounterEntries, evaluateEncounter } from '../src/index';
import type { Situation } from '../src/index';
import type { ApplicabilityData } from '../src/types';

const applicability = applicabilityJson as unknown as ApplicabilityData;
const fixtures = situationFixturesJson as unknown as {
  cases: { name: string; situation: Situation }[];
};
const fixture = (prefix: string): Situation => {
  const c = fixtures.cases.find((x) => x.name.startsWith(prefix));
  if (!c) throw new Error(`no fixture case starts with ${prefix}`);
  return c.situation;
};

const power = {
  'fact:propulsion': 'propulsion:power',
  'fact:activity': 'activity:none',
  'fact:position': 'position:underway',
} as const;

describe('evaluateEncounter', () => {
  it('a crossing: give-way and stand-on, risk grounded in 7(d)(i)', () => {
    const r = evaluateEncounter(fixture('crossing: self power-driven'));
    expect(r.encounter).toBe('encounter:crossing');
    expect(r.scope).toEqual(['rule:4', 'rule:11']);
    expect(r.roles.self).toEqual([{ role: 'role:give-way', by: 'rule:15a:keep_out_of_the_way' }]);
    expect(r.roles.other).toEqual([{ role: 'role:stand-on', by: 'rule:15a:keep_out_of_the_way' }]);
    expect(r.risk_of_collision).toEqual({ asserted: true, by: ['rule:7d_i'] });
    expect(r.overridden).toEqual([]);
    expect(r.applied).toContain('rule:8f_iii');
    expect(r.categories['rule:15a:keep_out_of_the_way']).toBe('category:precedence');
    expect(r.categories['rule:11']).toBe('category:scope');
    expect(r.provenance.evaluated_categories).toEqual(['category:scope', 'category:classification', 'category:precedence']);
  });

  it('18(f)(i) displaces 18(a)(iv) and takes the sailing vessel\'s stand-on with it', () => {
    const r = evaluateEncounter(fixture('18(f)(i) overrides 18(a)(iv)'));
    expect(r.applied).toContain('rule:18a_iv');
    expect(r.overridden).toEqual([{ id: 'rule:18a_iv', by: 'rule:18f_i' }]);
    expect(r.roles.self).toEqual([{ role: 'role:keep-clear', by: 'rule:18f_i' }]);
    expect(r.roles.other).toEqual([]);
  });

  it('a latched overtaking stays an overtaking', () => {
    const r = evaluateEncounter(fixture('13(a) overrides 18(a)(iv)'));
    expect(r.encounter).toBe('encounter:overtaking');
    expect(r.roles.self).toEqual([{ role: 'role:give-way', by: 'rule:13a' }]);
  });

  it('a stated risk of collision is asserted even when no entry grounds it', () => {
    const r = evaluateEncounter(fixture('7(d)(i) does not apply'));
    expect(r.risk_of_collision).toEqual({ asserted: true, by: [] });
  });

  it('own alone: Part B Section I applies and nothing else can be said', () => {
    const r = evaluateEncounter({ self: { fact: { ...power } } });
    expect(r.applied).toEqual(['rule:4']);
    expect(r.encounter).toBeUndefined();
    expect(r.roles).toEqual({ self: [], other: [] });
    expect(r.risk_of_collision).toEqual({ asserted: false, by: [] });
  });

  it('derives fact:rule18_class per subject: a severely restricted tow ranks as RAM', () => {
    const r = evaluateEncounter({
      self: { fact: { ...power } },
      other: {
        fact: { ...power, 'fact:activity': 'activity:towing', 'fact:tow_restricts_deviation': true },
      },
      pair: { geo: { 'geo:in_sight': true } },
    });
    expect(r.applied).toContain('rule:18a_ii');
    expect(r.modalities['rule:18a_ii']).toBe('modality:shall');
  });

  it('a `none` effect confers no role but the entry still applies', () => {
    const r = evaluateEncounter({
      self: { fact: { ...power } },
      other: { fact: { ...power } },
      pair: { geo: { 'geo:risk_of_collision': true } },
    });
    expect(r.applied).toContain('rule:8f_iii');
    expect(r.roles).toEqual({ self: [], other: [] });
  });

  it('stamps caller data as the caller\'s', () => {
    const r = evaluateEncounter({ self: { fact: { ...power } } }, { data: applicability });
    expect(r.colregs.source).toBe('caller');
    expect(evaluateEncounter({ self: { fact: { ...power } } }).colregs.source).toBe('resolved');
  });

  it('reports an encounter value colregs adds later, without letting it displace a known one', () => {
    const novel = {
      id: '13x-demo',
      cite: '13(x)',
      jurisdiction: 'intl',
      category: 'category:classification',
      modality: 'modality:shall',
      when: { 'pair:geo:in_sight': true },
      effect: { encounter: 'overtaking-in-narrow-channel' },
    } as unknown as ApplicabilityData['entries'][number];
    const overtaking = fixture('13(d) latch');
    const first: ApplicabilityData = { ...applicability, entries: [novel, ...applicability.entries] };
    const last: ApplicabilityData = { ...applicability, entries: [...applicability.entries, novel] };
    // The known classification wins from either position in the data.
    expect(evaluateEncounter(overtaking, { data: first }).encounter).toBe('encounter:overtaking');
    expect(evaluateEncounter(overtaking, { data: last }).encounter).toBe('encounter:overtaking');
    // With nothing known applying, the new value is still reported, not dropped.
    const onlyNovel: ApplicabilityData = {
      ...applicability,
      entries: [novel, ...applicability.entries.filter((e) => e.category !== 'category:classification')],
    };
    expect(evaluateEncounter(overtaking, { data: onlyNovel }).encounter).toBe(
      'overtaking-in-narrow-channel',
    );
  });

  it('rejects a malformed situation rather than answering', () => {
    const bad = { self: { fact: { propulsion: 'power' } } } as unknown as Situation;
    expect(() => evaluateEncounter(bad)).toThrow(/did you mean 'fact:propulsion'/);
    expect(() => appliedEncounterEntries(bad)).toThrow(/did you mean 'fact:propulsion'/);
  });
});
