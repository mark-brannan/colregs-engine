// Rule 20(c) modality shift mechanism (colregs ADR 0021, colregs-engine#125)
// -- scaffolded ahead of mark-brannan/colregs#184, which is what actually
// ships `data/applicability.json`'s `modality_shifts` array and the
// fact:time/fact:visibility a shift's `when` reads. Neither exists in any
// colregs release this package resolves yet, so these tests exercise the
// mechanism directly against synthetic entries and a hand-built shift
// record (the exact shape #184's PR body and issue #125 give for
// `shift:20c`), rather than through evaluateDisplay()'s public API -- that
// entry point validates facts against this package's own resolved
// data/facts.json, which would reject fact:time/fact:visibility today.
//
// Once #184 releases and issue #125 step 5 bumps the pin, replace this file
// with the real replay of fixtures/applicability-fixtures.json's three new
// cases against RESOLVED_DATA, per issue #125 step 4.

import { describe, expect, it } from 'vitest';
import {
  entrySignalKinds,
  resolveModalityWithShifts,
} from '../src/evaluate';
import type { Entry, FactRecord, ModalityShift } from '../src/types';

// The exact shift:20c record from colregs ADR 0021 / issue #125.
const shift20c: ModalityShift = {
  id: 'shift:20c',
  jurisdiction: 'intl',
  cite: '20(c)',
  applies_to: 'lights',
  when: { 'fact:time': 'time:day', 'fact:visibility': 'visibility:good' },
  map: { 'modality:shall': 'modality:may', 'modality:shall-if-practicable': 'modality:may' },
};

const dayGoodVis: FactRecord = { 'fact:time': 'time:day', 'fact:visibility': 'visibility:good' };
const dayRestrictedVis: FactRecord = {
  'fact:time': 'time:day',
  'fact:visibility': 'visibility:restricted',
};
const goodVisNoTime: FactRecord = { 'fact:visibility': 'visibility:good' };

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
    lights: [{ light: 'shape:cone' }],
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

// 20(d)'s shape from issue #125's point 2: an entry whose own lights are
// mixed with a shape (day shape) never qualifies for the lights-only shift.
function mixedLightsAndShapeEntry(): Entry {
  return {
    id: 'rule:mixed_entry',
    jurisdiction: 'intl',
    cite: 'test mixed lights+shape entry',
    when: {},
    lights: [{ light: 'light:masthead' }, { light: 'shape:cone' }],
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
});

describe('resolveModalityWithShifts: the three colregs-engine#125 fixtures', () => {
  it('day + restricted visibility: unaffected (shift:20c needs good visibility)', () => {
    const byId = byIdOf(lightsOnlyEntry(), shapesOnlyEntry());
    expect(
      resolveModalityWithShifts(
        lightsOnlyEntry(),
        'rule:lights_entry',
        dayRestrictedVis,
        'intl',
        [shift20c],
        byId,
      ),
    ).toBe('modality:shall');
    expect(
      resolveModalityWithShifts(
        shapesOnlyEntry(),
        'rule:shapes_entry',
        dayRestrictedVis,
        'intl',
        [shift20c],
        byId,
      ),
    ).toBe('modality:shall');
  });

  it('day + good visibility: lights shift to may, cones stay shall', () => {
    const byId = byIdOf(lightsOnlyEntry(), shapesOnlyEntry());
    expect(
      resolveModalityWithShifts(
        lightsOnlyEntry(),
        'rule:lights_entry',
        dayGoodVis,
        'intl',
        [shift20c],
        byId,
      ),
    ).toBe('modality:may');
    expect(
      resolveModalityWithShifts(
        shapesOnlyEntry(),
        'rule:shapes_entry',
        dayGoodVis,
        'intl',
        [shift20c],
        byId,
      ),
    ).toBe('modality:shall');
  });

  it('good visibility, no time stated: unaffected (when needs both facts)', () => {
    const byId = byIdOf(lightsOnlyEntry());
    expect(
      resolveModalityWithShifts(
        lightsOnlyEntry(),
        'rule:lights_entry',
        goodVisNoTime,
        'intl',
        [shift20c],
        byId,
      ),
    ).toBe('modality:shall');
  });

  it('a mixed lights+shape entry is never reached, even under day + good visibility', () => {
    const byId = byIdOf(mixedLightsAndShapeEntry());
    expect(
      resolveModalityWithShifts(
        mixedLightsAndShapeEntry(),
        'rule:mixed_entry',
        dayGoodVis,
        'intl',
        [shift20c],
        byId,
      ),
    ).toBe('modality:shall');
  });

  it('reaches an entry through what it imports, not just its own lights', () => {
    const byId = byIdOf(carrierWithImportedLights(), lightsOnlyEntry());
    expect(
      resolveModalityWithShifts(
        carrierWithImportedLights(),
        'rule:carrier',
        dayGoodVis,
        'intl',
        [shift20c],
        byId,
      ),
    ).toBe('modality:may');
  });
});
