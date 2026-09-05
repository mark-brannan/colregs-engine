// `not` and `any_of` (both the per-fact constraint form and the `when`-key
// disjunction form) exercised at the predicate layer only, via
// predicateMatches(). Inputs are `when` clauses copied verbatim from real
// `subjects: 2` Part B entries (colregs data/applicability.json) -- the
// engine's own lights entries don't use either shape yet, so this is the
// only real-data source for them. Not run through evaluate(): Part B
// entries have no `lights`, so display composition doesn't apply to them.

import { describe, expect, it } from 'vitest';
import { predicateMatches } from '../src/evaluate';
import type { FactRecord, Predicate } from '../src/types';

// 18(a)(i)/18(a)(ii): own is power-driven and not ranked by Rule 18 --
// `not` over a list constraint.
const rule18aWhen: Predicate = {
  'own:fact:propulsion': 'propulsion:power',
  'own:fact:rule18_class': {
    not: ['rule18_class:nuc', 'rule18_class:ram', 'rule18_class:fishing'],
  },
  'own:fact:position': 'position:underway',
  'other:fact:rule18_class': 'rule18_class:nuc',
  'other:fact:position': 'position:underway',
  'pair:geo:in_sight': true,
};

// 13(a): "any vessel overtaking any other" -- any_of as a `when` key
// (predicate-level disjunction) over two sub-`when`s. any_of's value here
// is a Predicate[], not a Constraint, so the whole literal is cast through
// `unknown` the way predicateMatches itself does at that key.
const rule13aWhen = {
  'pair:geo:in_sight': true,
  any_of: [
    {
      'other:geo:rel_bearing_deg': { gt: 112.5, lt: 247.5 },
      'pair:geo:tcpa_s': { gt: 0 },
    },
    { 'own:hist:was_overtaking': true },
  ],
  'other:fact:position': 'position:underway',
} as unknown as Predicate;

// 14(a) (head-on): relative bearing near dead ahead wraps through 0/360 --
// `any_of` as a fact's own constraint value (per-fact disjunction), on
// both vessels' bearings at once.
const rule14aWhen: Predicate = {
  'pair:geo:in_sight': true,
  'pair:geo:risk_of_collision': true,
  'own:fact:propulsion': 'propulsion:power',
  'other:fact:propulsion': 'propulsion:power',
  'own:fact:position': 'position:underway',
  'other:fact:position': 'position:underway',
  'own:hist:was_overtaking': false,
  'other:hist:was_overtaking': false,
  'own:geo:rel_bearing_deg': { any_of: [{ lte: 11.25 }, { gte: 348.75 }] },
  'other:geo:rel_bearing_deg': { any_of: [{ lte: 11.25 }, { gte: 348.75 }] },
};

const rule18aBase: FactRecord = {
  'own:fact:propulsion': 'propulsion:power',
  'own:fact:position': 'position:underway',
  'other:fact:rule18_class': 'rule18_class:nuc',
  'other:fact:position': 'position:underway',
  'pair:geo:in_sight': true,
};

describe('predicateMatches: `not` on a fact constraint (18a1/18a2)', () => {
  it('matches when own is unranked by Rule 18', () => {
    const facts: FactRecord = { ...rule18aBase, 'own:fact:rule18_class': 'rule18_class:power' };
    expect(predicateMatches(rule18aWhen, facts)).toBe(true);
  });

  it('does not match when own is herself a NUC (the negated list)', () => {
    const facts: FactRecord = { ...rule18aBase, 'own:fact:rule18_class': 'rule18_class:nuc' };
    expect(predicateMatches(rule18aWhen, facts)).toBe(false);
  });

  it('does not match when the negated fact is absent (absence never satisfies, `not` included)', () => {
    const { 'own:fact:rule18_class': _drop, ...facts } = rule18aBase as Record<string, unknown>;
    expect(predicateMatches(rule18aWhen, facts as FactRecord)).toBe(false);
  });
});

describe('predicateMatches: `any_of` as a `when` key (13a, predicate-level disjunction)', () => {
  const base: FactRecord = {
    'pair:geo:in_sight': true,
    'other:fact:position': 'position:underway',
  };

  it('matches via the bearing/tcpa disjunct alone', () => {
    const facts: FactRecord = {
      ...base,
      'other:geo:rel_bearing_deg': 180,
      'pair:geo:tcpa_s': 30,
    };
    expect(predicateMatches(rule13aWhen, facts)).toBe(true);
  });

  it('matches via the was_overtaking disjunct alone', () => {
    const facts: FactRecord = { ...base, 'own:hist:was_overtaking': true };
    expect(predicateMatches(rule13aWhen, facts)).toBe(true);
  });

  it('does not match when neither disjunct holds', () => {
    expect(predicateMatches(rule13aWhen, base)).toBe(false);
  });
});

describe('predicateMatches: `any_of` on a fact constraint (14a, per-fact disjunction)', () => {
  const base: FactRecord = {
    'pair:geo:in_sight': true,
    'pair:geo:risk_of_collision': true,
    'own:fact:propulsion': 'propulsion:power',
    'other:fact:propulsion': 'propulsion:power',
    'own:fact:position': 'position:underway',
    'other:fact:position': 'position:underway',
    'own:hist:was_overtaking': false,
    'other:hist:was_overtaking': false,
  };

  it('matches when both bearings sit in the wraparound band (359 vs 5)', () => {
    const facts: FactRecord = {
      ...base,
      'own:geo:rel_bearing_deg': 359,
      'other:geo:rel_bearing_deg': 5,
    };
    expect(predicateMatches(rule14aWhen, facts)).toBe(true);
  });

  it('matches exactly at each disjunct boundary (11.25 / 348.75)', () => {
    const facts: FactRecord = {
      ...base,
      'own:geo:rel_bearing_deg': 11.25,
      'other:geo:rel_bearing_deg': 348.75,
    };
    expect(predicateMatches(rule14aWhen, facts)).toBe(true);
  });

  it('does not match a beam bearing outside both disjuncts', () => {
    const facts: FactRecord = {
      ...base,
      'own:geo:rel_bearing_deg': 90,
      'other:geo:rel_bearing_deg': 5,
    };
    expect(predicateMatches(rule14aWhen, facts)).toBe(false);
  });
});
