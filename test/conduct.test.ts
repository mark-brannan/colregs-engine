// evaluateConduct over a window: validation, the window it saw, conduct
// entries attaching, and the Rule 13(d)/17 phases read off role transitions.

import { describe, expect, it } from 'vitest';
import situationFixturesJson from 'colregs/fixtures/situation-fixtures.json';
import applicabilityJson from 'colregs/data/applicability.json';
import { appliedConductEntries, evaluateConduct } from '../src/index';
import type { Situation, Trace } from '../src/index';
import type { ApplicabilityData, Entry } from '../src/types';

const applicability = applicabilityJson as unknown as ApplicabilityData;
const fixtures = situationFixturesJson as unknown as {
  cases: { name: string; situation: Situation }[];
};
const crossing = fixtures.cases.find((c) => c.name.startsWith('crossing: own power-driven'))!
  .situation;

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

describe('evaluateConduct', () => {
  it('reports the window it saw and no conduct entries, since colregs has none yet', () => {
    const trace: Trace = {
      samples: [
        { t_s: 0, situation: crossing },
        { t_s: 30, situation: crossing },
      ],
    };
    const r = evaluateConduct(trace);
    expect(r.window).toEqual({ from_s: 0, to_s: 30, samples: 2 });
    expect(r.applied).toEqual([]);
    expect(r.verdicts).toEqual([]);
    expect(appliedConductEntries(trace)).toEqual([]);
  });

  it('phases: the give-way vessel enters Rule 16, the stand-on vessel 17(a)(i)', () => {
    const r = evaluateConduct({ samples: [{ t_s: 10, situation: crossing }] });
    expect(r.phases).toEqual([
      { subject: 'own', phase: '16', at_s: 10 },
      { subject: 'other', phase: '17(a)(i)', at_s: 10 },
    ]);
  });

  it('a stand-on vessel that alters course passes to 17(a)(ii)', () => {
    const turning = clone(crossing);
    turning.other!.kin!['kin:rot_deg_min'] = 5;
    const r = evaluateConduct({
      samples: [
        { t_s: 0, situation: crossing },
        { t_s: 60, situation: turning },
      ],
    });
    expect(r.phases).toContainEqual({ subject: 'other', phase: '17(a)(ii)', at_s: 60 });
    expect(r.phases.filter((p) => p.subject === 'own')).toHaveLength(1);
  });

  it('a latched overtaking vessel is in the 13(d) phase', () => {
    const latch = fixtures.cases.find((c) => c.name.startsWith('13(d) latch'))!.situation;
    const r = evaluateConduct({ samples: [{ t_s: 0, situation: latch }] });
    expect(r.phases).toContainEqual({ subject: 'own', phase: '13(d)', at_s: 0 });
  });

  it('a conduct entry in caller data attaches with a pending verdict', () => {
    const rule16: Entry = {
      id: '16',
      jurisdiction: 'intl',
      cite: '16',
      category: 'conduct',
      when: { 'pair:geo:risk_of_collision': true },
      modality: 'shall',
      effect: { own: 'give-way', other: 'none' },
    } as unknown as Entry;
    const data = { ...applicability, entries: [...applicability.entries, rule16] };
    const r = evaluateConduct(
      { samples: [{ t_s: 5, situation: crossing }, { t_s: 8, situation: crossing }] },
      { data },
    );
    expect(r.applied).toEqual(['16']);
    expect(r.verdicts).toEqual([{ id: '16', subject: 'own', verdict: 'pending', attached_at_s: 5 }]);
    expect(r.colregs.source).toBe('caller');
  });

  it('rejects an empty trace', () => {
    expect(() => evaluateConduct({ samples: [] })).toThrow(/must not be empty/);
  });

  it('rejects a non-increasing clock', () => {
    const trace: Trace = { samples: [{ t_s: 1, situation: crossing }, { t_s: 1, situation: crossing }] };
    expect(() => evaluateConduct(trace)).toThrow(/must be greater than/);
  });

  it('rejects `other` appearing and vanishing across the window', () => {
    const own = { own: crossing.own };
    const trace: Trace = { samples: [{ t_s: 0, situation: crossing }, { t_s: 1, situation: own }] };
    expect(() => evaluateConduct(trace)).toThrow(/same two vessels/);
  });

  it('rejects a malformed sample situation', () => {
    const trace = { samples: [{ t_s: 0, situation: { own: { fact: { propulsion: 'sail' } } } }] };
    expect(() => appliedConductEntries(trace as unknown as Trace)).toThrow(/fact:propulsion/);
  });
});
