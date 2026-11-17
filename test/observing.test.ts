// evaluate(circumstances) observing before the appraisal: three situations,
// each vessel with her own facts and her own notes, read through to what she
// could be and what binds self.

import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/index';
import type { CircumstancesVessel, Observed } from '../src/index';

const power = {
  'fact:propulsion': 'propulsion:power',
  'fact:activity': 'activity:none',
  'fact:position': 'position:underway',
} as const;

const notOvertaking = { 'hist:was_overtaking': false } as const;
const roleOf = (roles: { role: string; by: string }[] | undefined) =>
  roles?.map((r) => [r.role, r.by]);

describe('the fog: radar holds A, one prolonged blast is heard forward of the beam', () => {
  const blast: Observed = {
    means: 'sound',
    signal: [{ element: 'sound:prolonged_blast', count: 1 }],
    bearing_rel_deg: { from_deg: 270, to_deg: 90 },
  };
  const selfWith = (heard: Partial<Observed>): CircumstancesVessel => ({
    id: 'self',
    fact: { ...power, 'fact:making_way': true, 'fact:visibility': 'visibility:restricted' },
    kin: { 'kin:heading_deg': 90 },
    observed: [
      { means: 'radar', of: 'A', bearing_rel_deg: 40, range_nm: 3 },
      { ...blast, ...heard },
    ],
  });
  const fog = (heard: Partial<Observed>) =>
    evaluate({ self: selfWith(heard), others: [{ id: 'A', fact: {} }] });

  const unowned = fog({});
  const inferred = fog({ of: 'A', inferred: true });
  const sure = fog({ of: 'A' });

  it('a blast nobody owns validates and adds no vessel', () => {
    expect(unowned.indicated).toHaveLength(1);
    expect(unowned.appraisal?.others).toHaveLength(1);
  });

  it('with no radar contact and no other vessel, the blast alone still validates', () => {
    const self = selfWith({});
    const e = evaluate({ self: { ...self, observed: [blast] }, others: [] });
    expect(e.indicated).toEqual([]);
    expect(e.appraisal?.others).toEqual([]);
    expect(e.appraisal?.self).toEqual(unowned.appraisal?.self);
  });

  it('blast unowned: A is not in sight and nothing is known of what she is', () => {
    expect(unowned.indicated[0]).toEqual({ inSight: false, couldBe: [] });
    expect(unowned.appraisal?.others[0].evaluation?.scope).toContain('rule:19a');
  });

  it("blast taken for A's: both ways, and whose the blast is decides", () => {
    const { couldBe, decides } = inferred.indicated[0];
    expect(couldBe).toHaveLength(2);
    expect(couldBe).toContainEqual({ fact: {}, by: [], means: ['radar'] });
    expect(couldBe).toContainEqual({
      fact: expect.objectContaining({
        'fact:propulsion': 'propulsion:power',
        'fact:making_way': true,
      }),
      by: ['rule:35a'],
      means: ['sound'],
    });
    expect(decides).toEqual(['self.observed[1].of']);
  });

  it("blast sure to be A's: the one candidate", () => {
    const { couldBe, decides } = sure.indicated[0];
    expect(couldBe).toHaveLength(1);
    expect(couldBe[0]).toMatchObject({
      fact: { 'fact:propulsion': 'propulsion:power', 'fact:making_way': true },
      by: ['rule:35a'],
      means: ['sound'],
    });
    expect(decides).toBeUndefined();
  });

  it("self's duties come out the same whatever is known of the blast", () => {
    const duties = [unowned, inferred, sure].map((e) => ({
      self: e.appraisal?.self.roles.self,
      toA: e.appraisal?.others[0].evaluation?.roles.self,
    }));
    expect(duties[1]).toEqual(duties[0]);
    expect(duties[2]).toEqual(duties[0]);
    expect(inferred.appraisal?.others[0].candidates).toBeUndefined();
  });

  it.skip('skipped, unreachable: colregs has no entry for Rule 19(b) to (e), so 19(d) and 19(e) cannot be cited', () => {
    expect(unowned.appraisal?.self.applied).toEqual(
      expect.arrayContaining(['rule:19d', 'rule:19e']),
    );
  });
});

describe('the green light: a green sidelight on the port bow, no masthead light made out', () => {
  const self: CircumstancesVessel = {
    id: 'self',
    fact: { ...power, 'fact:visibility': 'visibility:good', 'fact:time': 'time:night' },
    kin: { 'kin:heading_deg': 90 },
    hist: notOvertaking,
    observed: [
      { means: 'visual', of: 'A', lights: ['light:sidelight_starboard'], bearing_rel_deg: 330 },
    ],
  };
  // Her green light puts self in her starboard sector; the bearing in it and
  // the risk of collision are the caller's.
  const A: CircumstancesVessel = {
    id: 'A',
    fact: {},
    geo: { 'geo:rel_bearing_deg': 60, 'geo:risk_of_collision': true },
    hist: notOvertaking,
  };
  const e = evaluate({ self, others: [A] });

  it('a visual note puts her in sight, and Section II applies', () => {
    expect(e.indicated[0].inSight).toBe(true);
    expect(e.appraisal?.others[0].candidates?.[0].evaluation.scope).toContain('rule:11');
  });

  it('she could be power-driven or sailing, each tagged by what bears it out', () => {
    const { couldBe } = e.indicated[0];
    expect(couldBe).toContainEqual({
      fact: { ...power, 'fact:propulsion': 'propulsion:sail' },
      by: ['rule:25a'],
      means: ['visual'],
    });
    const asPower = couldBe.find((c) => c.fact['fact:propulsion'] === 'propulsion:power');
    expect(asPower?.fact).toEqual(power);
    expect(asPower?.by).toContain('rule:23a_i');
    expect(asPower?.means).toEqual([]);
  });

  it('the appraisal returns each: power-driven, 15(a), self stands on; sailing, 18(a)(iv), self gives way', () => {
    const others = e.appraisal?.others[0];
    expect(others?.restedOn).toBe('indicated');
    const byPropulsion = Object.fromEntries(
      (others?.candidates ?? []).map((c) => [
        c.fact['fact:propulsion'],
        roleOf(c.evaluation.roles.self),
      ]),
    );
    expect(byPropulsion).toEqual({
      'propulsion:power': [['role:stand-on', 'rule:15a:keep_out_of_the_way']],
      'propulsion:sail': [['role:give-way', 'rule:18a_iv']],
    });
  });

  it('her propulsion decides', () => {
    expect(e.indicated[0].decides).toEqual(['others[0].fact.fact:propulsion']);
    expect(e.appraisal?.others[0].decides).toEqual(['others[0].fact.fact:propulsion']);
  });

  it('her propulsion asserted: one answer, rested on what was asserted', () => {
    const sailing = { ...power, 'fact:propulsion': 'propulsion:sail' } as const;
    const asserted = evaluate({ self, others: [{ ...A, fact: sailing }] });
    const others = asserted.appraisal?.others[0];
    expect(others?.restedOn).toBe('asserted');
    expect(others?.candidates).toBeUndefined();
    expect(roleOf(others?.evaluation?.roles.self)).toEqual([['role:give-way', 'rule:18a_iv']]);
    expect(asserted.indicated[0].consistent).toBe(true);
  });
});

describe('the harbour at night: self in dense rain makes out H; H in clear air has made out nothing', () => {
  const night = { 'fact:time': 'time:night', 'fact:making_way': true } as const;
  const self: CircumstancesVessel = {
    id: 'self',
    fact: { ...power, ...night, 'fact:visibility': 'visibility:restricted' },
    kin: { 'kin:heading_deg': 270 },
    hist: notOvertaking,
    observed: [
      {
        means: 'visual',
        of: 'H',
        lights: ['light:masthead', 'light:sidelight_port'],
        bearing_rel_deg: 30,
      },
    ],
  };
  const H: CircumstancesVessel = {
    id: 'H',
    fact: { ...power, ...night, 'fact:visibility': 'visibility:good' },
    kin: { 'kin:heading_deg': 180 },
    hist: notOvertaking,
    observed: [],
  };
  const pair = { 'geo:risk_of_collision': true } as const;
  const fromSelf = evaluate({ self, others: [{ ...H, geo: pair }] });
  const fromH = evaluate({ self: H, others: [{ ...self, geo: pair }] });

  it("each vessel's visibility is her own, and both validate", () => {
    expect(self.fact?.['fact:visibility']).not.toEqual(H.fact?.['fact:visibility']);
    expect(fromSelf.appraisal).toBeDefined();
    expect(fromH.appraisal).toBeDefined();
  });

  it("in sight from self's note alone, with H's notes empty", () => {
    expect(fromSelf.indicated[0]).toEqual({
      inSight: true,
      couldBe: [
        {
          fact: power,
          by: ['rule:23a_i', 'rule:23a_ii', 'rule:23a_iii_iv'],
          means: ['visual'],
        },
      ],
      consistent: true,
    });
  });

  it('15(a): self has H on her own starboard side and keeps out of the way', () => {
    const { evaluation } = fromSelf.appraisal!.others[0];
    expect(evaluation?.situation).toBe('situation:crossing');
    expect(roleOf(evaluation?.roles.self)).toEqual([
      ['role:give-way', 'rule:15a:keep_out_of_the_way'],
    ]);
  });

  it('asked from H: still in sight, H stands on, nothing indicated of self', () => {
    expect(fromH.indicated[0]).toEqual({ inSight: true, couldBe: [] });
    expect(roleOf(fromH.appraisal?.others[0].evaluation?.roles.self)).toEqual([
      ['role:stand-on', 'rule:15a:keep_out_of_the_way'],
    ]);
  });

  it("self's signals carry 35(a), H's do not", () => {
    const entries = (e: typeof fromSelf) => e.signals?.displays.flatMap((d) => d.entries);
    expect(entries(fromSelf)).toContain('rule:35a');
    expect(entries(fromH)).not.toContain('rule:35a');
  });
});
