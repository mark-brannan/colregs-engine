// The situation walker's input: a nested Situation flattened into the
// `<subject>:<class>:<key>` predicate namespace colregs' two-subject entries
// read, with the derived `fact:rule18_class` decoded per subject from
// facts.json before matching (colregs' `derived` block is the definition).
// A bare key means `own:`, so every one-subject predicate stays valid.

import factsData from 'colregs/data/facts.json' with { type: 'json' };
import { predicateMatches } from './evaluate.js';
import type { FactRecord, Predicate, Situation, Subject } from './types.js';

/** A situation in predicate form. Values are whatever the classes carry;
 * the walker compares them exactly as it compares a fact record's. */
export type FlatSituation = Record<string, unknown>;

interface DecodeRow {
  when: Predicate;
  value: string;
}

/** facts.json's decode table for the derived Rule 18 class, checked for
 * shape at import so a colregs release that moves it fails by name. */
function loadRule18Decode(): DecodeRow[] {
  const derived = (factsData as { derived?: Record<string, unknown> }).derived;
  const spec = derived?.['fact:rule18_class'] as { decode?: unknown } | undefined;
  const rows = spec?.decode;
  const wellFormed =
    Array.isArray(rows) &&
    rows.every(
      (r) => typeof r === 'object' && r !== null && typeof r.value === 'string' && typeof r.when === 'object',
    );
  if (!wellFormed) {
    throw new Error(
      "colregs facts.json: expected derived['fact:rule18_class'].decode to be a list of { when, value } rows",
    );
  }
  return rows as DecodeRow[];
}

const RULE18_DECODE: DecodeRow[] = loadRule18Decode();

/** A vessel's rank under Rule 18, or undefined when no decode row matches
 * (a vessel under oars, a record with no propulsion): absent is absent. */
export function rule18Class(fact: FactRecord): string | undefined {
  for (const row of RULE18_DECODE) {
    if (predicateMatches(row.when, fact)) return row.value;
  }
  return undefined;
}

const SUBJECT_CLASSES = ['fact', 'kin', 'geo', 'hist'] as const;

function flattenSubject(out: FlatSituation, prefix: string, subject: Subject, bare: boolean) {
  for (const cls of SUBJECT_CLASSES) {
    const record = subject[cls] as Record<string, unknown> | undefined;
    if (!record) continue;
    for (const [key, value] of Object.entries(record)) {
      out[`${prefix}:${key}`] = value;
      if (bare) out[key] = value;
    }
  }
  const rank = rule18Class(subject.fact);
  if (rank !== undefined) {
    out[`${prefix}:fact:rule18_class`] = rank;
    if (bare) out['fact:rule18_class'] = rank;
  }
}

/** The flat predicate namespace of `situation`, own's keys also present
 * bare. Assumes the situation has already passed validateSituation. */
export function flattenSituation(situation: Situation): FlatSituation {
  const out: FlatSituation = {};
  flattenSubject(out, 'own', situation.own, true);
  if (situation.other) flattenSubject(out, 'other', situation.other, false);
  if (situation.pair) {
    for (const cls of ['geo', 'env'] as const) {
      const record = situation.pair[cls] as Record<string, unknown> | undefined;
      if (!record) continue;
      for (const [key, value] of Object.entries(record)) out[`pair:${key}`] = value;
    }
  }
  return out;
}

/** The walker reads a flat situation through the fact-record predicate
 * evaluator: the keys differ, the constraint semantics do not. */
export function situationMatches(when: Predicate, flat: FlatSituation): boolean {
  return predicateMatches(when, flat as unknown as FactRecord);
}
