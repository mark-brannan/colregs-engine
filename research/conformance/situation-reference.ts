// An INDEPENDENT reference read of colregs' two-subject entries, following
// colregs ADR 0016: the situation and its swap are both matched, the
// precedence entries applying in either frame form one pool, `rel:overrides`
// is resolved over that pool, and a vessel's roles are what survives.
// Written from the ADR and colregs' "Predicate semantics", importing nothing
// from src/encounter.ts or src/situation.ts, which are what it is a second
// opinion on. It shares reference.ts's constraint matcher: the predicate
// language is one language, read once.
//
// `fact:rule18_class` is derived, so this file also owns the decode --
// facts.json's `derived` block is its definition -- and the witness builder
// the enumerator needs to realise a rank as a fact record.

import factsJson from 'colregs/data/facts.json' with { type: 'json' };

import type {
  ApplicabilityData,
  Entry,
  FactRecord,
  Modality,
  Predicate,
  RuleCategory,
  Situation,
  Subject,
} from '../../src/types.js';

import { referenceWhenMatches } from './reference.js';

/** The categories a two-subject read matches (colregs ADR 0011 §1). */
export const ENCOUNTER_CATEGORIES: readonly RuleCategory[] = [
  'category:scope',
  'category:classification',
  'category:precedence',
];

/** The modalities that let an entry's `rel:overrides` fire. Wider than
 * display's: 9(b) is written `shall-not-impede` and overrides 18(a)(iv). */
const OBLIGATIONS: ReadonlySet<Modality> = new Set<Modality>([
  'modality:shall',
  'modality:shall-if-practicable',
  'modality:shall-not',
  'modality:shall-not-impede',
]);

/** 13(d) says a latched overtaking is never reclassified and 14(c) errs
 * toward head-on, so a classification that reads history outranks one that
 * does not. A value colregs adds later ranks below every value named here. */
const ENCOUNTER_RANK: Record<string, number> = {
  'encounter:overtaking': 3,
  'encounter:head-on': 2,
  'encounter:crossing': 1,
  'encounter:none': 0,
};

function rankOf(value: string): number {
  return Object.prototype.hasOwnProperty.call(ENCOUNTER_RANK, value) ? ENCOUNTER_RANK[value] : -1;
}

// ---------------------------------------------------------------------
// The derived Rule 18 rank
// ---------------------------------------------------------------------
interface DecodeRow {
  when: Predicate;
  value: string;
}

/** facts.json's decode table for `fact:rule18_class`, checked for shape at
 * import so a colregs release that moves it fails by name. */
const DECODE: DecodeRow[] = (() => {
  const derived = (factsJson as { derived?: Record<string, { decode?: unknown }> }).derived;
  const rows = derived?.['fact:rule18_class']?.decode;
  const wellFormed =
    Array.isArray(rows) &&
    rows.every(
      (r) =>
        typeof r === 'object' && r !== null && typeof r.value === 'string' && typeof r.when === 'object',
    );
  if (!wellFormed) {
    throw new Error(
      "colregs facts.json: expected derived['fact:rule18_class'].decode to be a list of { when, value } rows",
    );
  }
  return rows as DecodeRow[];
})();

/** Every rank the decode table can produce, in declaration order. */
export const RULE18_CLASSES: readonly string[] = [...new Set(DECODE.map((r) => r.value))];

/** A vessel's rank under Rule 18: first matching decode row wins, and no
 * row matching means the fact is absent (a vessel under oars). */
export function referenceRule18Class(fact: FactRecord): string | undefined {
  for (const row of DECODE) {
    if (referenceWhenMatches(row.when, fact)) return row.value;
  }
  return undefined;
}

/** One constraint made concrete: a list or an `any_of` takes its first
 * disjunct, anything else is already a value. */
function concreteValue(constraint: unknown): unknown {
  if (Array.isArray(constraint)) return concreteValue(constraint[0]);
  if (constraint !== null && typeof constraint === 'object') {
    const anyOf = (constraint as { any_of?: unknown[] }).any_of;
    if (Array.isArray(anyOf)) return concreteValue(anyOf[0]);
  }
  return constraint;
}

/**
 * `base` extended into a fact record that decodes to `rank`, from the decode
 * row that defines it. Undefined when `base` contradicts that row — a
 * sailing vessel can never rank `rule18_class:power` — or when an earlier
 * row wins anyway, which is the realisability test the enumerator needs.
 */
export function rule18Witness(base: FactRecord, rank: string): FactRecord | undefined {
  const row = DECODE.find((r) => r.value === rank);
  if (row === undefined) return undefined;
  const out: Record<string, unknown> = {
    'fact:activity': 'activity:none',
    'fact:wig': false,
    'fact:wig_near_surface': false,
    'fact:tow_restricts_deviation': false,
    ...base,
  };
  for (const [key, constraint] of Object.entries(row.when)) {
    const value = concreteValue(constraint);
    if (key in base && (base as Record<string, unknown>)[key] !== value) return undefined;
    out[key] = value;
  }
  const fact = out as FactRecord;
  return referenceRule18Class(fact) === rank ? fact : undefined;
}

// ---------------------------------------------------------------------
// Flattening
// ---------------------------------------------------------------------
/** A situation in predicate form: `<subject>:<class>:<key>`, self's keys
 * also bare so every one-subject predicate stays valid. */
export type FlatSituation = Record<string, unknown>;

const SUBJECT_CLASSES = ['fact', 'kin', 'geo', 'hist'] as const;

function flattenSubject(out: FlatSituation, prefix: string, subject: Subject, bare: boolean): void {
  for (const cls of SUBJECT_CLASSES) {
    const record = subject[cls] as Record<string, unknown> | undefined;
    if (record === undefined) continue;
    for (const [key, value] of Object.entries(record)) {
      out[`${prefix}:${key}`] = value;
      if (bare) out[key] = value;
    }
  }
  const rank = referenceRule18Class(subject.fact);
  if (rank !== undefined) {
    out[`${prefix}:fact:rule18_class`] = rank;
    if (bare) out['fact:rule18_class'] = rank;
  }
}

export function referenceFlatten(situation: Situation): FlatSituation {
  const out: FlatSituation = {};
  flattenSubject(out, 'self', situation.self, true);
  if (situation.other) flattenSubject(out, 'other', situation.other, false);
  for (const cls of ['geo', 'env'] as const) {
    const record = situation.pair?.[cls] as Record<string, unknown> | undefined;
    if (record === undefined) continue;
    for (const [key, value] of Object.entries(record)) out[`pair:${key}`] = value;
  }
  return out;
}

/** The situation with its two vessels exchanged; `pair` is symmetric and
 * stays as given (ADR 0016 §1). */
export function swapFrame(situation: Situation): Situation {
  return {
    self: situation.other ?? { fact: {} },
    other: situation.self,
    pair: situation.pair,
  };
}

// ---------------------------------------------------------------------
// The read
// ---------------------------------------------------------------------
export interface ReferenceRole {
  role: string;
  by: string;
}

export interface ReferenceEncounter {
  /** Self-frame, in data order (ADR 0016 §4). */
  applied: string[];
  scope: string[];
  encounter?: string;
  risk: { asserted: boolean; by: string[] };
  roles: { self: ReferenceRole[]; other: ReferenceRole[] };
  /** Self-frame modalities, over the same key set as `applied`. */
  modalities: Record<string, Modality>;
}

function entryCategory(e: Entry): RuleCategory {
  return e.category ?? 'category:display';
}

/** First matching `modality_by` branch, else the entry's own modality. */
function resolveModality(entry: Entry, flat: FlatSituation): Modality {
  if (entry.modality !== 'modality:conditional') return entry.modality;
  for (const branch of entry.modality_by ?? []) {
    if (referenceWhenMatches(branch.when, flat as FactRecord)) return branch.modality;
  }
  return 'modality:conditional';
}

function appliedIn(data: ApplicabilityData, flat: FlatSituation): Entry[] {
  return data.entries.filter(
    (e) => ENCOUNTER_CATEGORIES.includes(entryCategory(e)) && referenceWhenMatches(e.when, flat as FactRecord),
  );
}

/** One precedence entry that fired, and the frame it fired in. */
interface PoolItem {
  entry: Entry;
  modality: Modality;
  /** The vessel that was the frame's `self`. */
  selfIs: 'self' | 'other';
}

/**
 * The two-frame, pooled read. `applied`, `scope`, `encounter`,
 * `risk_of_collision` and `modalities` are the self frame's; `roles` are the
 * pool's, after `rel:overrides` is resolved across both frames.
 */
export function referenceEvaluateEncounter(
  data: ApplicabilityData,
  situation: Situation,
): ReferenceEncounter {
  const selfFlat = referenceFlatten(situation);
  const swapFlat = referenceFlatten(swapFrame(situation));
  const selfApplied = appliedIn(data, selfFlat);
  const swapApplied = appliedIn(data, swapFlat);

  const modalities: Record<string, Modality> = {};
  for (const e of selfApplied) modalities[e.id] = resolveModality(e, selfFlat);

  const pool: PoolItem[] = [];
  for (const [applied, flat, selfIs] of [
    [selfApplied, selfFlat, 'self'],
    [swapApplied, swapFlat, 'other'],
  ] as const) {
    for (const e of applied) {
      if (entryCategory(e) !== 'category:precedence') continue;
      pool.push({ entry: e, modality: resolveModality(e, flat), selfIs });
    }
  }

  // rel:overrides over the pool, so an override reaches an entry that fired
  // in the other frame (ADR 0016 §2). A displaced entry's own overrides
  // don't fire, which is what the recursion is for.
  const verdict = new Map<number, boolean>();
  function isOverridden(i: number): boolean {
    const cached = verdict.get(i);
    if (cached !== undefined) return cached;
    verdict.set(i, false); // placeholder: makes the recursion terminate
    let result = false;
    for (let j = 0; j < pool.length; j++) {
      if (j === i) continue;
      const source = pool[j];
      if (!OBLIGATIONS.has(source.modality)) continue;
      if (!(source.entry['rel:overrides'] ?? []).includes(pool[i].entry.id)) continue;
      if (isOverridden(j)) continue;
      result = true;
      break;
    }
    verdict.set(i, result);
    return result;
  }

  const roles: { self: ReferenceRole[]; other: ReferenceRole[] } = { self: [], other: [] };
  const seen = new Set<string>();
  for (let i = 0; i < pool.length; i++) {
    const item = pool[i];
    if (!OBLIGATIONS.has(item.modality) || isOverridden(i)) continue;
    const effect = item.entry.effect as Record<string, unknown> | undefined;
    const otherIs = item.selfIs === 'self' ? 'other' : 'self';
    for (const [seat, vessel] of [
      ['self', item.selfIs],
      ['other', otherIs],
    ] as const) {
      const role = effect?.[seat];
      if (typeof role !== 'string' || role === 'role:none') continue;
      const key = `${vessel}|${role}|${item.entry.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      roles[vessel].push({ role, by: item.entry.id });
    }
  }

  // A scope or classification entry is never an override target in the data,
  // so the self frame's surviving set for them is its applied set.
  const overriddenSelf = new Set<string>();
  for (let i = 0; i < pool.length; i++) {
    if (pool[i].selfIs === 'self' && isOverridden(i)) overriddenSelf.add(pool[i].entry.id);
  }

  const scope: string[] = [];
  const riskBy: string[] = [];
  let encounter: string | undefined;
  for (const e of selfApplied) {
    if (overriddenSelf.has(e.id)) continue;
    const effect = e.effect as Record<string, unknown> | undefined;
    if (entryCategory(e) === 'category:scope') scope.push(e.id);
    if (entryCategory(e) !== 'category:classification') continue;
    if (effect?.risk_of_collision === true) riskBy.push(e.id);
    const value = effect?.encounter;
    if (typeof value === 'string' && (encounter === undefined || rankOf(value) > rankOf(encounter))) {
      encounter = value;
    }
  }

  // Rule 7(a) makes risk a judgement on all available means; a caller who
  // states it has made that judgement, and 7(d)(i) can only add a ground.
  const stated = situation.pair?.geo?.['geo:risk_of_collision'] === true;

  return {
    applied: selfApplied.map((e) => e.id),
    scope,
    encounter,
    risk: { asserted: stated || riskBy.length > 0, by: riskBy },
    roles,
    modalities,
  };
}
