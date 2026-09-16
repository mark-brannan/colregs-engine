// evaluateConduct over a window: validation, the window it saw, conduct
// entries attaching, and the Rule 13(d)/17 phases read off role transitions.

import { describe, expect, it } from 'vitest';
import situationFixturesJson from 'colregs/fixtures/situation-fixtures.json';
import applicabilityJson from 'colregs/data/applicability.json';
import { appliedConductEntries, evaluateConduct, evaluateEncounter } from '../src/index';
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

  it('a subject holding give-way and shall-not-impede at once is phased by give-way', () => {
    // A fishing vessel overtaking in a narrow channel: 13(a) gives her
    // give-way, 9(c) shall-not-impede, and neither overrides the other.
    // colregs 0.2.4 gated 13(a)'s sector arm on the other vessel not holding
    // the 13(d) latch (Q-47), so the situation has to say she does not.
    const situation: Situation = {
      own: {
        fact: {
          'fact:propulsion': 'propulsion:power',
          'fact:activity': 'activity:fishing',
          'fact:position': 'position:underway',
        },
        hist: { 'hist:was_overtaking': false },
      },
      other: {
        fact: {
          'fact:propulsion': 'propulsion:power',
          'fact:activity': 'activity:none',
          'fact:position': 'position:underway',
        },
        geo: { 'geo:rel_bearing_deg': 200 },
        hist: { 'hist:was_overtaking': false },
      },
      pair: { geo: { 'geo:in_sight': true, 'geo:tcpa_s': 300 }, env: { 'env:narrow_channel': true } },
    };
    const r = evaluateConduct({ samples: [{ t_s: 0, situation }] });
    expect(r.phases).toContainEqual({ subject: 'own', phase: '16', at_s: 0 });
    expect(r.phases.filter((p) => p.subject === 'own')).toHaveLength(1);
  });

  it('a latched overtaking vessel is in the 13(d) phase', () => {
    const latch = fixtures.cases.find((c) => c.name.startsWith('13(d) latch'))!.situation;
    const r = evaluateConduct({ samples: [{ t_s: 0, situation: latch }] });
    expect(r.phases).toContainEqual({ subject: 'own', phase: '13(d)', at_s: 0 });
  });

  it('a latched overtaking vessel is in 13(d) even when the table names her stand-on', () => {
    // A RAM vessel overtaking a 28 m power-driven vessel from dead astern,
    // holding the 13(d) latch. 18(a)(ii) names her stand-on from own's
    // frame; Rule 13 applies notwithstanding Rule 18, so her phase is 13(d),
    // and altering course inside it is not a 17(a)(ii) transition. Reading
    // the role ahead of the latch dropped the latch for `other`.
    const vessel = (activity: 'activity:none' | 'activity:ram', length: number) => ({
      'fact:propulsion': 'propulsion:power' as const,
      'fact:activity': activity,
      'fact:position': 'position:underway' as const,
      'fact:making_way': true,
      'fact:length_m': length,
    });
    const situation: Situation = {
      own: {
        fact: vessel('activity:none', 28),
        kin: { 'kin:heading_deg': 0, 'kin:rot_deg_min': 0 },
        geo: { 'geo:rel_bearing_deg': 180 },
        hist: { 'hist:was_overtaking': false },
      },
      other: {
        fact: vessel('activity:ram', 40),
        kin: { 'kin:heading_deg': 0, 'kin:rot_deg_min': 0 },
        geo: { 'geo:rel_bearing_deg': 0 },
        hist: { 'hist:was_overtaking': true },
      },
      pair: { geo: { 'geo:in_sight': true, 'geo:tcpa_s': 300, 'geo:risk_of_collision': true } },
    };
    expect(evaluateEncounter(situation).roles.other).toContainEqual(
      expect.objectContaining({ role: 'stand-on', by: '18a2' }),
    );
    const turning = clone(situation);
    turning.other!.kin!['kin:rot_deg_min'] = 5;
    const r = evaluateConduct({
      samples: [
        { t_s: 0, situation },
        { t_s: 60, situation: turning },
      ],
    });
    expect(r.phases.filter((p) => p.subject === 'other')).toEqual([
      { subject: 'other', phase: '13(d)', at_s: 0 },
    ]);
    // Own is the overtaken vessel (13b-overtaken applies to her) yet phases
    // 16 by 18a2, because the 18a* entries carry no other-latch gate. Wrong,
    // pinned so the expectation moves when the data does.
    expect(r.phases.filter((p) => p.subject === 'own')).toEqual([{ subject: 'own', phase: '16', at_s: 0 }]);
  });

  it('a latched vessel out of sight is not in 13(d): Rule 13 is Section II', () => {
    // Same pair in restricted visibility: 13d does not fire (its gate keeps
    // `pair:geo:in_sight`, Q-49), the evaluation classifies nothing, and the
    // latch alone must not name an overtaking phase.
    const latch = fixtures.cases.find((c) => c.name.startsWith('13(d) latch'))!.situation;
    const fog = clone(latch);
    fog.pair!.geo!['geo:in_sight'] = false;
    expect(evaluateEncounter(fog).encounter).toBeUndefined();
    const r = evaluateConduct({ samples: [{ t_s: 0, situation: fog }] });
    expect(r.phases).toEqual([]);
  });

  it('the table is one-sided: own is never stand-on, other never burdened', () => {
    // `phaseAt` reads the latch ahead of the role because `roles.other` can
    // only ever say stand-on -- the counterparty's correlative, never her own
    // duties. If this fails the data has grown reciprocal entries and "swap
    // the subjects and evaluate again" is once more a candidate reading of
    // the other vessel's phase.
    const burdened = ['give-way', 'keep-clear', 'shall-not-impede'];
    for (const e of applicability.entries) {
      const effect = (e as { effect?: { own?: string; other?: string } }).effect;
      if (!effect) continue;
      expect(effect.own, `${e.id}: effect.own`).not.toBe('stand-on');
      expect(burdened, `${e.id}: effect.other`).not.toContain(effect.other);
    }
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
