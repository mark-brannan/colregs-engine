// An INDEPENDENT reference implementation of the two-subject verb: what
// `scope`, `classification` and `precedence` entries say about one situation.
// Written from colregs ADR 0005 (the situation record and its namespace),
// ADR 0016 (two frames, pooled, resolved, then roles), ADR 0019 point 1
// (how far rel:overrides reaches) and docs/engine-notes.md items 8-12 — not
// from src/encounter.ts, and not importing it. Its only job is to be a
// second opinion for the Part B conformance check; src/encounter.ts is the
// engine under test.
//
// It reuses reference.ts for constraint semantics alone: the predicate
// language is the same one Part A already reads independently, and the keys
// it walks are the only thing that differs. The flattening, the derived Rule
// 18 class, the override resolution and the pooling are written here.

import factsData from 'colregs/data/facts.json' with { type: 'json' };

import type {
  ApplicabilityData,
  Entry,
  FactRecord,
  Modality,
  Predicate,
  RuleCategory,
  Situation,
  Subject,
  SubjectRole,
} from '../../src/types.js';

import { referenceWhenMatches } from './reference.js';

/** The categories a situation selects from (colregs ADR 0011 §1). */
export const ENCOUNTER_CATEGORIES: readonly RuleCategory[] = [
  'category:scope',
  'category:classification',
  'category:precedence',
];

/** Any obligation's rel:overrides fires; a `may` overrider is inert
 * (engine-notes item 9, colregs ADR 0019 point 1). */
const OBLIGATIONS: ReadonlySet<Modality> = new Set<Modality>([
  'modality:shall',
  'modality:shall-if-practicable',
  'modality:shall-not',
  'modality:shall-not-impede',
]);

/** Competing classifications resolve overtaking, head-on, crossing, in that
 * order (engine-notes item 11: 13(d) forbids reclassifying a latch, 14(c)
 * errs head-on). A value this release does not name ranks below all of them:
 * reported when nothing known fired, never displacing something known. */
const ENCOUNTER_ORDER: readonly string[] = [
  'encounter:none',
  'encounter:crossing',
  'encounter:head-on',
  'encounter:overtaking',
];

function encounterRank(value: string): number {
  return ENCOUNTER_ORDER.indexOf(value);
}

// ---------------------------------------------------------------------
// The derived Rule 18 class
// ---------------------------------------------------------------------
interface DecodeRow {
  when: Predicate;
  value: string;
}

/** facts.json's decode table for `fact:rule18_class`, read here rather than
 * through src/situation.ts: the table is the fact's definition, and a
 * reference read that borrowed the engine's decode would not be one. */
function loadDecode(): DecodeRow[] {
  const derived = (factsData as { derived?: Record<string, unknown> }).derived;
  const spec = derived?.['fact:rule18_class'] as { decode?: unknown } | undefined;
  const rows = spec?.decode;
  if (!Array.isArray(rows)) {
    throw new Error("colregs facts.json: derived['fact:rule18_class'].decode is not a list");
  }
  return rows as DecodeRow[];
}

const DECODE: DecodeRow[] = loadDecode();

/** The values the decode table can yield, in table order. */
export const RULE18_CLASS_VALUES: readonly string[] = [...new Set(DECODE.map((r) => r.value))];

/** Every fact key the decode table reads: the enumerator needs these to
 * build a vessel of a given rank. */
export const RULE18_DECODE_KEYS: readonly string[] = [
  ...new Set(DECODE.flatMap((r) => Object.keys(r.when))),
];

/** First matching row wins; no row matching means the rank is absent, which
 * is not the same as `power` (a vessel under oars has no rank). */
export function referenceRule18Class(fact: FactRecord): string | undefined {
  for (const row of DECODE) {
    if (referenceWhenMatches(row.when, fact)) return row.value;
  }
  return undefined;
}

/** The decode rows that yield one rank, in table order. */
export function decodeRowsFor(value: string): readonly Predicate[] {
  return DECODE.filter((r) => r.value === value).map((r) => r.when);
}

// ---------------------------------------------------------------------
// Flattening (colregs ADR 0005 'Two subjects', engine-notes item 8)
// ---------------------------------------------------------------------
/** A situation in the `<subject>:<class>:<key>` predicate namespace. Self's
 * keys also appear bare, so every one-subject predicate stays valid. */
export type ReferenceFlat = Record<string, unknown>;

const SUBJECT_CLASSES = ['fact', 'kin', 'geo', 'hist'] as const;

function flattenSubject(out: ReferenceFlat, prefix: string, subject: Subject, bare: boolean): void {
  for (const cls of SUBJECT_CLASSES) {
    const record = subject[cls] as Record<string, unknown> | undefined;
    if (!record) continue;
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

export function referenceFlatten(situation: Situation): ReferenceFlat {
  const out: ReferenceFlat = {};
  flattenSubject(out, 'self', situation.self, true);
  if (situation.other) flattenSubject(out, 'other', situation.other, false);
  for (const cls of ['geo', 'env'] as const) {
    const record = situation.pair?.[cls] as Record<string, unknown> | undefined;
    if (!record) continue;
    for (const [key, value] of Object.entries(record)) out[`pair:${key}`] = value;
  }
  for (const [sector, facts] of Object.entries(situation.traffic ?? {})) {
    for (const [key, value] of Object.entries(facts ?? {})) {
      out[`traffic:${sector}:${key}`] = value;
    }
  }
  return out;
}

/** The swap of ADR 0016 decision 1: self and other exchanged, `pair`
 * unchanged. Derived facts are computed per frame, which flattening the
 * swapped situation rather than renaming flat keys gets for free. */
export function swapFrame(situation: Situation): Situation | undefined {
  if (!situation.other) return undefined;
  return { ...situation, self: situation.other, other: situation.self };
}

function matches(when: Predicate, flat: ReferenceFlat): boolean {
  return referenceWhenMatches(when, flat as unknown as FactRecord);
}

function categoryOf(e: Entry): RuleCategory {
  return (e.category ?? 'category:display') as RuleCategory;
}

/** First matching modality_by branch, else the entry's own modality. */
export function referenceEncounterModality(entry: Entry, flat: ReferenceFlat): Modality {
  if (entry.modality !== 'modality:conditional') return entry.modality;
  for (const branch of entry.modality_by ?? []) {
    if (matches(branch.when, flat)) return branch.modality;
  }
  return 'modality:conditional';
}

/** The ids of the entries in the three encounter categories whose predicate
 * holds — the situation-fixture contract's `expect`, in data order. */
export function referenceEncounterApplied(data: ApplicabilityData, flat: ReferenceFlat): string[] {
  return data.entries
    .filter((e) => ENCOUNTER_CATEGORIES.includes(categoryOf(e)) && matches(e.when, flat))
    .map((e) => e.id);
}

// ---------------------------------------------------------------------
// rel:overrides over a set of entries in force
// ---------------------------------------------------------------------
/**
 * An entry is displaced when some entry in the same set, itself an
 * obligation and itself not displaced, names it in `rel:overrides`
 * (ADR 0019 point 1). Cycles terminate by treating an id under
 * consideration as standing.
 */
export function referenceOverridden(
  inForce: readonly Entry[],
  modalities: Readonly<Record<string, Modality>>,
): { overridden: { id: string; by: string }[]; overriddenIds: Set<string> } {
  const present = new Set(inForce.map((e) => e.id));
  const verdict = new Map<string, string | undefined>();

  function overriderOf(id: string): string | undefined {
    if (verdict.has(id)) return verdict.get(id);
    verdict.set(id, undefined); // standing while its own overriders are read
    let by: string | undefined;
    if (present.has(id)) {
      for (const e of inForce) {
        if (!OBLIGATIONS.has(modalities[e.id])) continue;
        if (!(e['rel:overrides'] ?? []).includes(id)) continue;
        if (overriderOf(e.id) !== undefined) continue;
        by = e.id;
        break;
      }
    }
    verdict.set(id, by);
    return by;
  }

  // Reported in the overrider's data order, then its own rel:overrides order.
  const overridden: { id: string; by: string }[] = [];
  for (const e of inForce) {
    if (!OBLIGATIONS.has(modalities[e.id])) continue;
    if (overriderOf(e.id) !== undefined) continue;
    for (const ref of e['rel:overrides'] ?? []) {
      if (overriderOf(ref) === e.id) overridden.push({ id: ref, by: e.id });
    }
  }
  return { overridden, overriddenIds: new Set(overridden.map((o) => o.id)) };
}

// ---------------------------------------------------------------------
// The pooled role read (ADR 0016 decisions 2 and 3)
// ---------------------------------------------------------------------
type Frame = 'self' | 'swap';

export interface ReferenceRoles {
  roles: { self: SubjectRole[]; other: SubjectRole[] };
  overridden: { id: string; by: string }[];
  /** Which frame each pooled precedence entry was read in. */
  frames: Record<string, Frame>;
}

export function referencePooledRoles(
  data: ApplicabilityData,
  situation: Situation,
): ReferenceRoles {
  const frames: Record<string, Frame> = {};
  const pooled = new Map<string, Entry>();
  const modalities: Record<string, Modality> = {};

  // Swapped frame first, own frame second: an entry that matched both keeps
  // one reading, and which one is not left to array order.
  const byFrame: [Frame, Situation | undefined][] = [
    ['swap', swapFrame(situation)],
    ['self', situation],
  ];
  for (const [frame, framed] of byFrame) {
    if (!framed) continue;
    const flat = referenceFlatten(framed);
    for (const e of data.entries) {
      if (categoryOf(e) !== 'category:precedence') continue;
      if (!matches(e.when, flat)) continue;
      frames[e.id] = frame;
      pooled.set(e.id, e);
      modalities[e.id] = referenceEncounterModality(e, flat);
    }
  }

  const inForce = [...pooled.values()];
  const { overridden, overriddenIds } = referenceOverridden(inForce, modalities);

  const roles: { self: SubjectRole[]; other: SubjectRole[] } = { self: [], other: [] };
  for (const e of inForce) {
    if (overriddenIds.has(e.id)) continue;
    const effect = e.effect as Record<string, unknown> | undefined;
    const onFrameSelf = effect?.self as SubjectRole['role'] | undefined;
    const onFrameOther = effect?.other as SubjectRole['role'] | undefined;
    // In the swapped frame the entry's `self` is the situation's `other`.
    const [toSelf, toOther] =
      frames[e.id] === 'self' ? [onFrameSelf, onFrameOther] : [onFrameOther, onFrameSelf];
    // A `none` effect confers no role (engine-notes item 10).
    if (toSelf !== undefined && toSelf !== 'role:none') roles.self.push({ role: toSelf, by: e.id });
    if (toOther !== undefined && toOther !== 'role:none') roles.other.push({ role: toOther, by: e.id });
  }
  return { roles, overridden, frames };
}

// ---------------------------------------------------------------------
// The whole answer
// ---------------------------------------------------------------------
/** What the reference read says about one situation: the self-frame entry
 * layer of ADR 0016 decision 4, plus the pooled roles of decision 3. */
export interface ReferenceEncounter {
  applied: string[];
  scope: string[];
  encounter?: string;
  risk_of_collision: { asserted: boolean; by: string[] };
  roles: { self: SubjectRole[]; other: SubjectRole[] };
  overridden: { id: string; by: string }[];
  modalities: Record<string, Modality>;
  categories: Record<string, RuleCategory>;
}

export function referenceEncounter(
  data: ApplicabilityData,
  situation: Situation,
): ReferenceEncounter {
  const flat = referenceFlatten(situation);
  const byId = new Map(data.entries.map((e) => [e.id, e]));
  const applied = referenceEncounterApplied(data, flat);

  const modalities: Record<string, Modality> = {};
  const categories: Record<string, RuleCategory> = {};
  for (const id of applied) {
    const e = byId.get(id)!;
    modalities[id] = referenceEncounterModality(e, flat);
    categories[id] = categoryOf(e);
  }

  const appliedEntries = applied.map((id) => byId.get(id)!);
  const { overridden, overriddenIds } = referenceOverridden(appliedEntries, modalities);
  const standing = appliedEntries.filter((e) => !overriddenIds.has(e.id));

  const scope: string[] = [];
  const riskBy: string[] = [];
  let encounter: string | undefined;
  for (const e of standing) {
    const effect = e.effect as Record<string, unknown> | undefined;
    if (categoryOf(e) === 'category:scope') scope.push(e.id);
    if (categoryOf(e) !== 'category:classification') continue;
    if (effect?.risk_of_collision === true) riskBy.push(e.id);
    if (typeof effect?.encounter === 'string') {
      const value = effect.encounter;
      if (encounter === undefined || encounterRank(value) > encounterRank(encounter)) {
        encounter = value;
      }
    }
  }

  const pooled = referencePooledRoles(data, situation);
  const selfFrameIds = new Set(overridden.map((o) => o.id));
  for (const pair of pooled.overridden) {
    if (!selfFrameIds.has(pair.id)) overridden.push(pair);
  }

  // Rule 7(a) makes risk a judgement on all available means: a caller who
  // states it has made that judgement, and 7(d)(i) only adds a ground
  // (engine-notes item 12).
  const stated = situation.pair?.geo?.['geo:risk_of_collision'] === true;

  return {
    applied,
    scope,
    encounter,
    risk_of_collision: { asserted: stated || riskBy.length > 0, by: riskBy },
    roles: pooled.roles,
    overridden,
    modalities,
    categories,
  };
}
