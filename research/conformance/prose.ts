// Renders a fact record as a short vessel description, for the findings
// register — the fixture files carry both the raw facts and this prose so
// a human triaging a finding doesn't have to decode axis keys.

import type { FactRecord } from '../../src/types';

function strip(prefixedValue: unknown): string {
  const s = String(prefixedValue);
  const i = s.indexOf(':');
  return i === -1 ? s : s.slice(i + 1);
}

export function describeVessel(facts: FactRecord): string {
  const parts: string[] = [];

  const length = facts['fact:length_m'];
  const propulsion = facts['fact:propulsion'] as string | undefined;
  const position = facts['fact:position'] as string | undefined;
  const activity = facts['fact:activity'] as string | undefined;

  let head = 'a vessel';
  if (typeof length === 'number') head = `a ${length} m vessel`;
  if (propulsion) {
    const p = strip(propulsion);
    const adj = p === 'power' ? 'power-driven' : p === 'sail' ? 'sailing' : 'oar-propelled';
    head = head.replace('a vessel', `a ${adj} vessel`);
  }
  parts.push(head);

  if (position) {
    const p = strip(position);
    const posPhrase =
      p === 'underway'
        ? facts['fact:making_way'] === false
          ? 'underway but not making way'
          : 'underway'
        : p; // anchored / aground / moored
    parts.push(posPhrase);
  }

  if (activity && activity !== 'activity:none') {
    parts.push(`engaged in ${strip(activity).replace(/_/g, ' ')}`);
  }

  const extras: string[] = [];
  const boolFacts: [string, string][] = [
    ['fact:composite_unit', 'a composite unit'],
    ['fact:non_displacement', 'operating in non-displacement mode'],
    ['fact:wig', 'a wing-in-ground craft'],
    ['fact:wig_near_surface', 'near the surface'],
    ['fact:near_channel', 'near a narrow channel'],
    ['fact:obstruction_exists', 'with an obstruction to the passage of another vessel'],
  ];
  for (const [key, phrase] of boolFacts) {
    if (facts[key] === true) extras.push(phrase);
  }
  for (const [key, unit] of [
    ['fact:max_speed_kn', 'kn max speed'],
    ['fact:tow_length_m', 'm tow'],
    ['fact:gear_extent_m', 'm gear extent'],
  ] as const) {
    if (typeof facts[key] === 'number') extras.push(`${facts[key]} ${unit}`);
  }

  let sentence = parts.join(', ');
  if (extras.length > 0) sentence += ` (${extras.join(', ')})`;
  return sentence + '.';
}
