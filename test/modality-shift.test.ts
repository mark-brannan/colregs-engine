// Rule 20(c) modality shift mechanism (colregs ADR 0021, colregs-engine#125)
// -- unit coverage for entrySignalKinds and the per-light override path that
// the real fixture replay (test/fixtures.test.ts, fixtures/
// applicability-fixtures.json's three shift:20c cases) doesn't reach on its
// own: a dangling rel:includes ref, an unavailable ref's signal kind not
// counting, and a LightRef-level modality override picking up a shift too.

import { describe, expect, it } from 'vitest';
import { entrySignalKinds, evaluateDisplay } from '../src/evaluate';
import type { ApplicabilityData, Entry, FactRecord, ModalityShift } from '../src/types';

const dayGoodVis = {
  'fact:time': 'time:day',
  'fact:visibility': 'visibility:good',
} as unknown as FactRecord;

function lightsOnlyEntry(): Entry {
  return {
    id: 'rule:lights_entry',
    jurisdiction: 'intl',
    cite: 'test lights entry',
    when: {},
    lights: [{ light: 'light:masthead' }],
    modality: 'modality:shall',
  };
}

function shapesOnlyEntry(): Entry {
  return {
    id: 'rule:shapes_entry',
    jurisdiction: 'intl',
    cite: 'test shapes entry (cones)',
    when: {},
    shapes: [{ shape: 'shape:cone_down' }],
    modality: 'modality:shall',
  };
}

// rule:26b_iii's shape from issue #125's point 2: no lights of its own, all
// its signals come from what it imports.
function carrierWithImportedLights(): Entry {
  return {
    id: 'rule:carrier',
    jurisdiction: 'intl',
    cite: 'test carrier importing lights',
    when: {},
    lights: [],
    modality: 'modality:shall',
    'rel:includes': ['rule:lights_entry'],
  };
}

// 20(d)'s shape from issue #125's point 2: an entry whose own light is
// mixed with a day shape never qualifies for the lights-only shift.
function mixedLightsAndShapeEntry(): Entry {
  return {
    id: 'rule:mixed_entry',
    jurisdiction: 'intl',
    cite: 'test mixed lights+shape entry',
    when: {},
    lights: [{ light: 'light:masthead' }],
    shapes: [{ shape: 'shape:cone_down' }],
    modality: 'modality:shall',
  };
}

function byIdOf(...entries: Entry[]): Map<string, Entry> {
  return new Map(entries.map((e) => [e.id, e]));
}

describe('entrySignalKinds', () => {
  it('is the entry\'s own kind when it carries lights directly', () => {
    const byId = byIdOf(lightsOnlyEntry());
    expect(entrySignalKinds('rule:lights_entry', dayGoodVis, byId)).toEqual(new Set(['lights']));
  });

  it('is the entry\'s own kind when it carries shapes directly', () => {
    const byId = byIdOf(shapesOnlyEntry());
    expect(entrySignalKinds('rule:shapes_entry', dayGoodVis, byId)).toEqual(new Set(['shapes']));
  });

  it('reaches through rel:includes for an entry with no lights of its own', () => {
    const byId = byIdOf(carrierWithImportedLights(), lightsOnlyEntry());
    expect(entrySignalKinds('rule:carrier', dayGoodVis, byId)).toEqual(new Set(['lights']));
  });

  it('is mixed when an entry carries both a light and a shape', () => {
    const byId = byIdOf(mixedLightsAndShapeEntry());
    expect(entrySignalKinds('rule:mixed_entry', dayGoodVis, byId)).toEqual(
      new Set(['lights', 'shapes']),
    );
  });

  it('throws on a dangling rel:includes ref, matching importRef elsewhere', () => {
    const byId = byIdOf(carrierWithImportedLights()); // imports 'rule:lights_entry', absent here
    expect(() => entrySignalKinds('rule:carrier', dayGoodVis, byId)).toThrow(
      /unknown entry ref rule:lights_entry via rule:carrier/,
    );
  });

  it('skips an unavailable rel:includes ref instead of counting its signal kind', () => {
    // The imported entry's own `when` gates on a plain (non-axis) fact this
    // case's facts don't satisfy, so it's never actually available
    // (importAvailable) -- its shape kind must not count toward the
    // carrier's reach, matching the filter evaluateDisplay's own
    // import-resolution loop applies. fact:length_m isn't one of
    // facts.json's axes/modifiers (AXIS_FACTS), so whenAvailable doesn't
    // wave it through the way it would an axis fact.
    const gated: Entry = {
      ...shapesOnlyEntry(),
      id: 'rule:gated_shape',
      when: { 'fact:length_m': { gte: 50 } },
    };
    const carrier: Entry = { ...carrierWithImportedLights(), 'rel:includes': ['rule:gated_shape'] };
    const byId = byIdOf(carrier, gated);
    const facts = { ...dayGoodVis, 'fact:length_m': 12 } as FactRecord;
    expect(entrySignalKinds('rule:carrier', facts, byId)).toEqual(new Set());
  });
});

describe('a light\'s own modality override', () => {
  // claude-review, PR #128: displayLights builds a light's displayed
  // modality as `spec.modality ?? node.modality` -- a LightRef that carries
  // its own `modality` bypasses the (already-shifted) node.modality
  // entirely and, unfixed, never saw a shift. Issue #125 step 3 says both
  // the per-entry and per-light modality "carry the shifted value", so this
  // goes through evaluateDisplay()'s public API end-to-end (a shift with an
  // always-true `when`, so it needs no unreleased fact vocabulary).
  const alwaysShiftsLights: ModalityShift = {
    id: 'shift:test',
    jurisdiction: 'intl',
    cite: 'test',
    applies_to: 'lights',
    when: {},
    map: { 'modality:shall': 'modality:may' },
  };

  it('shifts too, not just the entry-level default', () => {
    const data: ApplicabilityData = {
      entries: [
        {
          id: 'rule:per_light',
          jurisdiction: 'intl',
          cite: 'test per-light override',
          when: {},
          lights: [
            { light: 'light:masthead' },
            { light: 'light:sternlight', modality: 'modality:shall' },
          ],
          modality: 'modality:shall',
        },
      ],
      modality_shifts: [alwaysShiftsLights],
    };
    const result = evaluateDisplay({}, { data });
    // The shift turns the entry's own modality shall -> may too, so it
    // lands among optional_additions (unconditional, unlike displays,
    // which enumerate the may/shall alternatives) -- same place any other
    // 'may' entry with no alternative relations lands (see displays.test.ts
    // "second masthead is an optional addition").
    const lights = result.optional_additions[0].lights;
    expect(lights.find((l) => l.spec.light === 'light:masthead')?.modality).toBe('modality:may');
    expect(lights.find((l) => l.spec.light === 'light:sternlight')?.modality).toBe(
      'modality:may',
    );
  });
});
