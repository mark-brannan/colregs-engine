// Display composition: the consumer-side semantics documented in
// docs/engine-notes.md, tested against the scenarios the product design
// names as its acceptance bar.

import { describe, expect, it } from 'vitest';
import applicabilityJson from 'colregs/data/applicability.json';
import { evaluate } from '../src/evaluate';
import type { ApplicabilityData, FactRecord } from '../src/types';

const applicability = applicabilityJson as unknown as ApplicabilityData;

const sloop12: FactRecord = {
  'fact:propulsion': 'propulsion:sail',
  'fact:activity': 'activity:none',
  'fact:position': 'position:underway',
  'fact:length_m': 12,
};

function displayEntrySets(facts: FactRecord): string[][] {
  return evaluate(applicability, facts)
    .displays.map((d) => d.entries)
    .sort((a, b) => a.join().localeCompare(b.join()));
}

describe('lawful display composition', () => {
  it('12 m sloop under sail: exactly three lawful displays', () => {
    expect(displayEntrySets(sloop12)).toEqual([
      ['25a'],
      ['25a', '25c'],
      ['25b'],
    ]);
  });

  it('tricolor and red-over-green never co-occur (rel:excludes)', () => {
    for (const d of evaluate(applicability, sloop12).displays) {
      expect(d.entries.includes('25b') && d.entries.includes('25c')).toBe(
        false,
      );
    }
  });

  it('second masthead is an optional addition below 50 m, required at 50 m', () => {
    const below = evaluate(applicability, {
      'fact:propulsion': 'propulsion:power',
      'fact:activity': 'activity:none',
      'fact:position': 'position:underway',
      'fact:length_m': 49,
    });
    expect(below.optionalAdditions.map((a) => a.id)).toContain('23a2');
    expect(below.modalities['23a2']).toBe('may');

    const above = evaluate(applicability, {
      'fact:propulsion': 'propulsion:power',
      'fact:activity': 'activity:none',
      'fact:position': 'position:underway',
      'fact:length_m': 55,
    });
    expect(above.modalities['23a2']).toBe('shall');
    for (const d of above.displays) {
      expect(d.entries).toContain('23a2');
    }
  });

  it('drifting trawler keeps identity lights, drops sidelights/sternlight', () => {
    const base: FactRecord = {
      'fact:propulsion': 'propulsion:power',
      'fact:activity': 'activity:trawling',
      'fact:position': 'position:underway',
      'fact:length_m': 30,
    };
    const making = evaluate(applicability, { ...base, 'fact:making_way': true });
    const drifting = evaluate(applicability, {
      ...base,
      'fact:making_way': false,
    });

    const lightsOf = (e: ReturnType<typeof evaluate>) =>
      e.displays[0].lights.map((l) => l.spec.light);

    expect(making.displays).toHaveLength(1);
    expect(lightsOf(making)).toContain('light:sidelights');
    expect(lightsOf(making)).toContain('light:sternlight');
    expect(lightsOf(drifting)).not.toContain('light:sidelights');
    expect(lightsOf(drifting)).not.toContain('light:sternlight');
    // identity lights (green over white all-rounds) persist
    expect(lightsOf(drifting)).toContain('light:all_round');
  });

  it('small power boat: all-round white alternative replaces masthead scheme', () => {
    const e = evaluate(applicability, {
      'fact:propulsion': 'propulsion:power',
      'fact:activity': 'activity:none',
      'fact:position': 'position:underway',
      'fact:length_m': 11,
    });
    const sets = e.displays.map((d) => d.entries.join(','));
    expect(sets).toContain('23a1,23a34');
    expect(sets).toContain('23d1');
    expect(e.displays).toHaveLength(2);
  });

  it('vessel under oars: torch, or sailing lights, or tricolor', () => {
    const e = evaluate(applicability, {
      'fact:propulsion': 'propulsion:oars',
      'fact:activity': 'activity:none',
      'fact:position': 'position:underway',
      'fact:length_m': 10,
    });
    expect(e.displays).toHaveLength(3);
    const torchOnly = e.displays.find((d) => d.chosen.length === 0)!;
    expect(torchOnly.lights.map((l) => l.spec.light)).toEqual(['light:torch']);
    const viaA = e.displays.find((d) => d.chosen.includes('25a'))!;
    expect(viaA.lights.map((l) => l.spec.light)).not.toContain('light:torch');
  });

  it('aground 15 m: anchor lights via 30(a) or 30(b), plus two reds', () => {
    const e = evaluate(applicability, {
      'fact:propulsion': 'propulsion:power',
      'fact:activity': 'activity:none',
      'fact:position': 'position:aground',
      'fact:length_m': 15,
    });
    expect(e.displays).toHaveLength(2);
    for (const d of e.displays) {
      expect(d.entries).toContain('30d-red');
      expect(
        d.entries.includes('30a') !== d.entries.includes('30b'),
      ).toBe(true);
    }
  });

  it('aground 60 m: 30(b) single anchor light unavailable at that length', () => {
    const e = evaluate(applicability, {
      'fact:propulsion': 'propulsion:power',
      'fact:activity': 'activity:none',
      'fact:position': 'position:aground',
      'fact:length_m': 60,
    });
    expect(e.displays).toHaveLength(1);
    expect(e.displays[0].entries).toContain('30a');
  });

  it('trawler at anchor: Rule 30 anchor lights suppressed by 26(a)', () => {
    const e = evaluate(applicability, {
      'fact:propulsion': 'propulsion:power',
      'fact:activity': 'activity:trawling',
      'fact:position': 'position:anchored',
      'fact:length_m': 30,
    });
    expect(e.excluded.map((x) => x.id).sort()).toEqual(['30a', '30b']);
    for (const d of e.displays) {
      expect(d.entries).not.toContain('30a');
      expect(d.entries).not.toContain('30b');
    }
  });

  it('anchored 6 m clear of a channel: exempted, nothing required', () => {
    const e = evaluate(applicability, {
      'fact:propulsion': 'propulsion:power',
      'fact:activity': 'activity:none',
      'fact:position': 'position:anchored',
      'fact:length_m': 6,
      'fact:near_channel': false,
    });
    expect(e.exempted.map((x) => x.id).sort()).toEqual(['30a', '30b']);
    expect(e.displays).toHaveLength(1);
    expect(e.displays[0].lights).toHaveLength(0);
  });

  it('mine clearance at anchor: Rule 30 lights, no imported running lights', () => {
    const e = evaluate(applicability, {
      'fact:propulsion': 'propulsion:power',
      'fact:activity': 'activity:mine',
      'fact:position': 'position:anchored',
      'fact:length_m': 60,
    });
    for (const d of e.displays) {
      expect(d.entries).not.toContain('23a1');
      expect(d.entries).not.toContain('23a34');
      expect(d.entries).toContain('27f');
      expect(d.entries).toContain('30a');
    }
  });

  it('pilot vessel underway: white-over-red with sidelights/sternlight, no masthead', () => {
    const e = evaluate(applicability, {
      'fact:propulsion': 'propulsion:power',
      'fact:activity': 'activity:pilot',
      'fact:position': 'position:underway',
      'fact:length_m': 20,
    });
    expect(e.displays).toHaveLength(1);
    const ids = e.displays[0].entries;
    expect(ids).toContain('29a');
    expect(ids).toContain('23a34');
    expect(ids).not.toContain('23a1');
  });

  it('constrained by draught: Rule 23 lights required, three reds optional', () => {
    const e = evaluate(applicability, {
      'fact:propulsion': 'propulsion:power',
      'fact:activity': 'activity:cbd',
      'fact:position': 'position:underway',
      'fact:length_m': 200,
    });
    expect(e.displays.some((d) => d.entries.includes('23a1'))).toBe(true);
    expect(e.optionalAdditions.map((a) => a.id)).toContain('28');
    // at 200 m the second masthead import resolves to shall
    for (const d of e.displays) expect(d.entries).toContain('23a2');
  });

  it('towing, tow 300 m: three mastheads in lieu, towing light over stern', () => {
    const e = evaluate(applicability, {
      'fact:propulsion': 'propulsion:power',
      'fact:activity': 'activity:towing',
      'fact:position': 'position:underway',
      'fact:length_m': 40,
      'fact:tow_length_m': 300,
    });
    expect(e.displays).toHaveLength(1);
    const lights = e.displays[0].lights;
    const masthead = lights.find((l) => l.spec.light === 'light:masthead')!;
    expect(masthead.spec.count).toBe(3);
    expect(lights.some((l) => l.spec.light === 'light:towing')).toBe(true);
  });

  it('every evaluation terminates with at least one display', () => {
    // sweep the axis product at representative lengths
    const propulsions = ['propulsion:power', 'propulsion:sail', 'propulsion:oars'];
    const activities = [
      'activity:none',
      'activity:fishing',
      'activity:trawling',
      'activity:towing',
      'activity:pushing',
      'activity:being_towed',
      'activity:nuc',
      'activity:ram',
      'activity:ram_underwater',
      'activity:cbd',
      'activity:mine',
      'activity:pilot',
      'activity:diving',
    ];
    const positions = [
      'position:underway',
      'position:anchored',
      'position:aground',
      'position:moored',
    ];
    for (const p of propulsions)
      for (const a of activities)
        for (const pos of positions)
          for (const len of [5, 15, 60])
            for (const mw of [true, false]) {
              const e = evaluate(applicability, {
                'fact:propulsion': p,
                'fact:activity': a,
                'fact:position': pos,
                'fact:making_way': mw,
                'fact:length_m': len,
                'fact:tow_length_m': 150,
                'fact:composite_unit': false,
              });
              expect(e.displays.length).toBeGreaterThan(0);
            }
  });
});
