// evaluate(circumstances): the unified variant's readings, each against the
// operation it delegates to, and the validation that runs before any reading.

import { describe, expect, it } from 'vitest';
import situationFixturesJson from 'colregs/fixtures/situation-fixtures.json';
import applicabilityJson from 'colregs/data/applicability.json';
import {
  DataVersionMismatchError,
  Evaluation,
  evaluate,
  evaluateCircumstances,
  evaluateSignals,
} from '../src/index';
import type { Circumstances, CircumstancesVessel, Situation } from '../src/index';
import type { ApplicabilityData } from '../src/types';

const fixtures = situationFixturesJson as unknown as {
  cases: { name: string; situation: Situation }[];
};
const fixture = (prefix: string): Situation => {
  const c = fixtures.cases.find((x) => x.name.startsWith(prefix));
  if (!c) throw new Error(`no fixture case starts with ${prefix}`);
  return c.situation;
};

/** A two-vessel fixture as circumstances: the other's bearing moves from
 * self's own frame to her, the pair's range to her too, and in_sight to a
 * detection inline on her. */
function circumstancesOf(s: Situation): Circumstances {
  const { 'geo:in_sight': inSight, 'geo:range_m': rangeM, ...rest } = s.pair?.geo ?? {};
  const { 'geo:rel_bearing_deg': bearing, ...selfGeo } = s.self.geo ?? {};
  const other: CircumstancesVessel = {
    detected: inSight === false ? { radar: true } : { visual: true },
    fact: s.other!.fact,
    geo: { ...s.other!.geo, ...rest },
  };
  if (bearing !== undefined) other.bearing_deg = bearing;
  if (rangeM !== undefined) other.range_nm = rangeM / 1852;
  if (s.other!.kin) other.kin = s.other!.kin;
  if (s.other!.hist) other.hist = s.other!.hist;
  const self = { ...s.self, geo: Object.keys(selfGeo).length ? selfGeo : undefined };
  if (self.geo === undefined) delete self.geo;
  return { self, others: [other], conditions: s.pair?.env };
}

const sloop = {
  'fact:propulsion': 'propulsion:sail',
  'fact:activity': 'activity:none',
  'fact:position': 'position:underway',
  'fact:length_m': 12,
} as const;

const crossing = fixture('crossing: self power-driven');
const wig = fixture('18(f)(i) overrides 18(a)(iv)');

describe('appraisal', () => {
  it('per other, rests on the asserted fact and reads what evaluateCircumstances reads', () => {
    const { appraisal } = evaluate(circumstancesOf(crossing));
    expect(appraisal?.others).toHaveLength(1);
    expect(appraisal?.others[0].restedOn).toBe('asserted');
    expect(appraisal?.others[0].evaluation).toEqual(evaluateCircumstances(crossing));
    expect(appraisal?.self.applied).toEqual(evaluateCircumstances({ self: crossing.self }).applied);
  });

  it('N others: each appraised against self alone, in order', () => {
    const a = circumstancesOf(crossing);
    const b = circumstancesOf(wig);
    const { appraisal } = evaluate({ ...a, others: [...a.others!, ...b.others!] });
    expect(appraisal?.others.map((o) => o.evaluation?.situation)).toEqual([
      'situation:crossing',
      undefined,
    ]);
    expect(appraisal?.others[1].evaluation?.roles.self).toEqual(
      evaluateCircumstances({ ...wig, self: crossing.self }).roles.self,
    );
  });

  it('an other known only by a radar note rests on nothing and points at the indication', () => {
    const { appraisal } = evaluate({
      self: { id: 'self', fact: sloop, observed: [{ means: 'radar', of: 'A' }] },
      others: [{ id: 'A' }],
    });
    expect(appraisal?.others[0]).toEqual({
      restedOn: 'nothing',
      because: 'other vessel not asserted; see indicated[0]',
    });
  });
});

describe('detections', () => {
  const inline = circumstancesOf(crossing);
  const { detected: selfOfHer, ...her } = inline.others![0];
  const keyed: Circumstances = {
    ...inline,
    self: { ...inline.self, id: 'self', detected: { A: selfOfHer as never } },
    others: [{ ...her, id: 'A', detected: { self: { visual: true, radar: true } } }],
  };

  it("self's map keyed by her id reads as the same set inline on her", () => {
    expect(evaluate(keyed).appraisal).toEqual(evaluate(inline).appraisal);
  });

  it("her own detections of self are accepted and leave self's appraisal alone", () => {
    const { appraisal } = evaluate(keyed);
    expect(appraisal?.others[0].evaluation).toEqual(evaluateCircumstances(crossing));
  });

  it.each<[string, CircumstancesVessel['detected'], boolean]>([
    ['visual', { visual: true }, true],
    ['radar alone', { radar: true }, false],
    ['sound alone', { sound: true }, false],
    ['visual said no', { visual: false, radar: true }, false],
  ])('in sight follows visual: %s', (_name, detected, inSight) => {
    const c = circumstancesOf(crossing);
    const { appraisal } = evaluate({ ...c, others: [{ ...c.others![0], detected }] });
    const expected = evaluateCircumstances({
      ...crossing,
      pair: { ...crossing.pair, geo: { ...crossing.pair?.geo, 'geo:in_sight': inSight } },
    });
    expect(appraisal?.others[0].evaluation).toEqual(expected);
  });
});

describe('signals', () => {
  it('reads what evaluateSignals reads for self', () => {
    const { signals } = evaluate({ self: { fact: sloop } });
    expect(signals).toEqual(evaluateSignals(sloop));
  });
});

describe('indicated', () => {
  it('with no notes of her, nothing is known of what she is', () => {
    const { indicated } = evaluate({ others: [{ detected: { visual: true }, fact: sloop }] });
    expect(indicated).toEqual([{ inSight: true, couldBe: [] }]);
  });

  const blast: Circumstances = {
    self: { id: 'self', fact: sloop },
    others: [{ id: 'A', detected: { sound: true } }],
  };
  const heard = (data: ApplicabilityData) =>
    evaluate(
      {
        ...blast,
        self: {
          ...blast.self,
          observed: [{ means: 'sound', of: 'A', signal: [{ element: 'sound:prolonged_blast' }] }],
        },
      } as Circumstances,
      { data },
    ).indicated[0].couldBe;

  it('reads visibility both ways: an entry that needs good visibility can be borne out', () => {
    const data = structuredClone(applicabilityJson) as unknown as ApplicabilityData;
    const e = data.entries.find((x) => x.id === 'rule:35a')!;
    (e.when as Record<string, unknown>)['fact:visibility'] = 'visibility:good';
    const couldBe = heard(data);
    expect(couldBe.some((c) => c.by.includes('rule:35a'))).toBe(true);
    expect(couldBe.find((c) => c.by.includes('rule:35a'))?.fact).toMatchObject({
      'fact:visibility': 'visibility:good',
    });
  });

  it('resolves an entry id among those in force: a suppressed intl entry is not read', () => {
    const data = structuredClone(applicabilityJson) as unknown as ApplicabilityData;
    data.suppressions = [
      ...(data.suppressions ?? []),
      { jurisdiction: 'us/inland', suppresses: 'rule:35a', cite: '35', why: 'test' },
    ] as ApplicabilityData['suppressions'];
    const couldBe = evaluate(
      {
        self: {
          id: 'self',
          fact: sloop,
          observed: [{ means: 'sound', of: 'A', signal: [{ element: 'sound:prolonged_blast' }] }],
        },
        others: [{ id: 'A', detected: { sound: true } }],
      } as Circumstances,
      { data, jurisdiction: 'us/inland' },
    ).indicated[0].couldBe;
    expect(couldBe.some((c) => c.by.includes('rule:35a'))).toBe(false);
  });
});

describe('compliance', () => {
  it('stub: throws, an instant has none', () => {
    const e = evaluate({ self: { fact: sloop } });
    expect(() => e.compliance).toThrow(/over a track/);
  });
});

describe('the evaluation', () => {
  it('computes a reading once and keeps it', () => {
    const e = evaluate(circumstancesOf(crossing));
    expect(e.appraisal).toBe(e.appraisal);
    expect(e.signals).toBe(e.signals);
    expect(e.indicated).toBe(e.indicated);
  });

  it('without self: appraisal and signals read undefined, indicated reads', () => {
    const e = evaluate({ others: [{ detected: { sound: true }, fact: sloop }] });
    expect(e.appraisal).toBeUndefined();
    expect(e.signals).toBeUndefined();
    expect(e.indicated).toHaveLength(1);
  });

  it('serialises its readings, which a spread of getters would not', () => {
    const e = evaluate({ self: { fact: sloop } });
    expect(e).toBeInstanceOf(Evaluation);
    expect({ ...e }).toEqual({});
    expect(Object.keys(JSON.parse(JSON.stringify(e)))).toEqual([
      'appraisal',
      'signals',
      'indicated',
    ]);
  });

  it('hands opts to the delegates and checks the data stamp up front', () => {
    const data = applicabilityJson as unknown as ApplicabilityData;
    expect(evaluate({ self: { fact: sloop } }, { data }).signals?.colregs.source).toBe('caller');
    expect(() => evaluate({ self: { fact: sloop } }, { data, dataVersion: '0.0.1' })).toThrow(
      DataVersionMismatchError,
    );
  });
});

describe('validation, in evaluate() before any reading', () => {
  const other: CircumstancesVessel = { detected: { visual: true }, fact: sloop };
  const self = { id: 'self', fact: sloop };

  it.each<[string, () => unknown, RegExp]>([
    [
      'an other detected by no means',
      () => evaluate({ others: [{ fact: sloop }] }),
      /detected by no means/,
    ],
    [
      'an other whose only detected is her own, of a vessel with no id',
      () =>
        evaluate({
          self: { fact: sloop },
          others: [
            { id: 'A', fact: sloop, detected: { B: { visual: true } } },
            { id: 'B', fact: sloop, detected: { radar: true } },
          ],
        }),
      /detected by no means/,
    ],
    [
      'an unknown means',
      () => evaluate({ others: [{ ...other, detected: { sight: true } as never }] }),
      /unknown means 'sight'/,
    ],
    [
      'a detection that is not yes or no',
      () =>
        evaluate({
          self: { ...self, detected: { A: { visual: 'yes' } as never } },
          others: [{ id: 'A', fact: sloop }],
        }),
      /is yes or no/,
    ],
    [
      'a map key that names no vessel',
      () =>
        evaluate({
          self: { ...self, detected: { B: { visual: true } } },
          others: [{ id: 'A', fact: sloop }],
        }),
      /names 'B'/,
    ],
    [
      "an other's own map that names no vessel",
      () =>
        evaluate({
          self,
          others: [{ ...other, id: 'A', detected: { Z: { visual: true } } as never }],
        }),
      /names 'Z'/,
    ],
    [
      'an empty detected on an other, which is an empty map',
      () => evaluate({ self, others: [{ id: 'A', fact: sloop, detected: {} }] }),
      /detected by no means/,
    ],
    [
      "self's detections of her given twice",
      () =>
        evaluate({
          self: { ...self, detected: { A: { visual: true } } },
          others: [{ ...other, id: 'A' }],
        }),
      /given twice/,
    ],
    [
      'two vessels with one id',
      () => evaluate({ self, others: [{ ...other, id: 'self' }] }),
      /another vessel's too/,
    ],
    [
      'a bearing on self, which is said from self',
      () => evaluate({ self: { ...self, bearing_deg: 10 } }),
      /said from self/,
    ],
    [
      'an inline set on self',
      () => evaluate({ self: { ...self, detected: { visual: true } } }),
      /map keyed by each other vessel's id/,
    ],
    ['self without a fact', () => evaluate({ self: { id: 'self' } }), /self.fact is required/],
    [
      'neither fact nor a note of her',
      () => evaluate({ others: [{ detected: { visual: true } }] }),
      /needs a fact, a note of her/,
    ],
    [
      'lights on a note heard',
      () =>
        evaluate({
          self: { ...self, observed: [{ means: 'sound', lights: ['light:masthead'] }] },
        }),
      /made out by visual only/,
    ],
    [
      'a signal on a note seen',
      () =>
        evaluate({
          self: {
            ...self,
            observed: [{ means: 'visual', signal: [{ element: 'sound:prolonged_blast' }] }],
          },
        }),
      /heard by sound only/,
    ],
    [
      'a light colregs does not name',
      () =>
        evaluate({
          self: { ...self, observed: [{ means: 'visual', lights: ['green-sidelight'] }] },
        }),
      /lights.json ids/,
    ],
    [
      'a note of a vessel not in the record',
      () => evaluate({ self: { ...self, observed: [{ means: 'radar', of: 'B' }] } }),
      /names 'B'/,
    ],
    [
      'a note inferred to be nobody',
      () => evaluate({ self: { ...self, observed: [{ means: 'sound', inferred: true }] } }),
      /needs an of/,
    ],
    [
      'a note by a means detections do not have',
      () => evaluate({ self: { ...self, observed: [{ means: 'assumed' as never }] } }),
      /means is one of/,
    ],
    [
      'a note that says a means the written detections say no to',
      () =>
        evaluate({
          self: {
            ...self,
            detected: { A: { visual: false } },
            observed: [{ means: 'visual', of: 'A' }],
          },
          others: [{ id: 'A', fact: sloop }],
        }),
      /visual is no, but self\.observed\[0\] says visual/,
    ],
    [
      'a note key observing does not read',
      () =>
        evaluate({
          self: { ...self, observed: [{ means: 'radar', trend: 'closing' } as never] },
        }),
      /unknown circumstances\.self\.observed\[0\] key 'trend'/,
    ],
    [
      'in_sight on geo, which detected already says',
      () => evaluate({ others: [{ ...other, geo: { 'geo:in_sight': true } as never }] }),
      /say it with detected/,
    ],
    [
      "a mistyped fact key on an other, on the operations' terms",
      () =>
        evaluate({
          others: [{ detected: { visual: true }, fact: { propulsion: 'sail' } as never }],
        }),
      /did you mean 'fact:propulsion'/,
    ],
    [
      'a mistyped condition',
      () => evaluate({ self: { fact: sloop }, conditions: { narrow_channel: true } as never }),
      /did you mean 'env:narrow_channel'/,
    ],
    ['others not a list', () => evaluate({ others: other as never }), /must be a list/],
    [
      'geo not an object',
      () => evaluate({ others: [{ ...other, geo: 'x' as never }] }),
      /geo must be an object/,
    ],
    [
      'a mistyped geo key, which is never dropped',
      () => evaluate({ others: [{ ...other, geo: { cpa_m: 3 } as never }] }),
      /did you mean 'geo:cpa_m'/,
    ],
  ])('%s throws', (_name, call, message) => {
    expect(call).toThrow(message);
  });

  it('a fact and a note of her may coexist', () => {
    expect(() =>
      evaluate({
        self: { ...self, observed: [{ means: 'visual', of: 'A', lights: ['light:masthead'] }] },
        others: [{ id: 'A', fact: sloop }],
      }),
    ).not.toThrow();
  });

  it('an other whose only detection is her own of self is in sight, by Rule 3(k)', () => {
    const { indicated } = evaluate({
      self,
      others: [{ id: 'A', fact: sloop, detected: { self: { visual: true } } }],
    });
    expect(indicated[0].inSight).toBe(true);
  });
});
