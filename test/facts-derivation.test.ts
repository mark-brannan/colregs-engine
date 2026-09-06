// AXIS_FACTS and REFINEMENTS in ../src/evaluate.ts must not silently drift
// from colregs' facts.json. AXIS_FACTS is derived mechanically (axes keys
// union modifiers keys); REFINEMENTS is not derivable from any structured
// field in facts.json (see the comment above it in evaluate.ts) and is
// hand-maintained instead. Both are pinned here against today's data so a
// future colregs release that adds an axis, a modifier, or a new
// prose-documented refinement shows up as a failing test.

import { describe, expect, it } from 'vitest';
import factsJson from 'colregs/data/facts.json';
import { AXIS_FACTS, REFINEMENTS } from '../src/evaluate';

describe('AXIS_FACTS derivation from facts.json', () => {
  it('equals the union of axes keys and modifiers keys', () => {
    const expected = new Set([
      ...Object.keys(factsJson.axes),
      ...Object.keys(factsJson.modifiers ?? {}),
    ]);
    expect(AXIS_FACTS).toEqual(expected);
  });

  it("matches today's known set (regression against silent drift)", () => {
    expect(AXIS_FACTS).toEqual(
      new Set([
        'fact:propulsion',
        'fact:activity',
        'fact:position',
        'fact:making_way',
      ]),
    );
  });
});

describe('REFINEMENTS (hand-maintained: not mechanically derivable)', () => {
  it("matches today's known map (regression against silent drift)", () => {
    expect(REFINEMENTS).toEqual({
      'activity:ram_underwater': 'activity:ram',
    });
  });

  it('every refinement key and value is still a value of fact:activity', () => {
    const activityValues = new Set(factsJson.axes['fact:activity'].values);
    for (const [child, parent] of Object.entries(REFINEMENTS)) {
      expect(activityValues.has(child)).toBe(true);
      expect(activityValues.has(parent)).toBe(true);
    }
  });

  it("facts.json's activity note still documents ram_underwater as a refinement of ram", () => {
    // A canary, not proof: if colregs stops describing this relationship in
    // prose, that is a signal to re-check REFINEMENTS by hand.
    const note = factsJson.axes['fact:activity'].note ?? '';
    expect(note).toContain('ram_underwater');
    expect(note).toContain('refinement');
  });
});
