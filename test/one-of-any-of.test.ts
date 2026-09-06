// claude-code-review on #13: oneOfAvailable() routed every `ref.when` key,
// `any_of` included, through valueMatches(facts['any_of'], ...) -- which
// always reads undefined and fails, so a one_of option gated by a
// predicate-level `any_of` was silently always unavailable, the same
// failure shape #9 fixed for the bitmask. No generated lights entry uses
// `any_of` in a one_of option today, so this is dormant, but it's a real
// gap the `not`/`any_of` work introduced the possibility of.

import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/evaluate';
import type { ApplicabilityData, Entry } from '../src/types';

function carrierWithOneOf(): Entry {
  return {
    id: 'carrier',
    jurisdiction: 'intl',
    cite: 'test carrier',
    when: {},
    lights: [],
    modality: 'shall',
    'rel:conditional_includes': [{ one_of: ['powerOrSailOpt', 'oarsOpt'] }],
  };
}

// Available for either of two propulsion values -- a genuine
// predicate-level disjunction, not reducible to a single-key list
// constraint the way `{'fact:propulsion': [a, b]}` already was.
const powerOrSailOpt: Entry = {
  id: 'powerOrSailOpt',
  jurisdiction: 'intl',
  cite: 'test power-or-sail',
  when: { any_of: [{ 'fact:propulsion': 'propulsion:power' }, { 'fact:propulsion': 'propulsion:sail' }] },
  lights: [{ light: 'test-light-power-or-sail' }],
  modality: 'shall',
};

const oarsOpt: Entry = {
  id: 'oarsOpt',
  jurisdiction: 'intl',
  cite: 'test oars',
  when: { any_of: [{ 'fact:propulsion': 'propulsion:oars' }] },
  lights: [{ light: 'test-light-oars' }],
  modality: 'shall',
};

const data: ApplicabilityData = {
  known_omissions: [],
  entries: [carrierWithOneOf(), powerOrSailOpt, oarsOpt],
};

describe("oneOfAvailable: `any_of` inside a one_of option's `when`", () => {
  it('the power-or-sail option is available on the first any_of disjunct', () => {
    const entryIds = evaluate(data, { 'fact:propulsion': 'propulsion:power' }).displays.flatMap(
      (d) => d.entries,
    );
    expect(entryIds).toContain('powerOrSailOpt');
    expect(entryIds).not.toContain('oarsOpt');
  });

  it('the power-or-sail option is available on the second any_of disjunct', () => {
    const entryIds = evaluate(data, { 'fact:propulsion': 'propulsion:sail' }).displays.flatMap(
      (d) => d.entries,
    );
    expect(entryIds).toContain('powerOrSailOpt');
    expect(entryIds).not.toContain('oarsOpt');
  });

  it("a fact matching only the other option's any_of leaves this one unavailable", () => {
    const entryIds = evaluate(data, { 'fact:propulsion': 'propulsion:oars' }).displays.flatMap(
      (d) => d.entries,
    );
    expect(entryIds).toContain('oarsOpt');
    expect(entryIds).not.toContain('powerOrSailOpt');
  });
});
