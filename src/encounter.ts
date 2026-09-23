// evaluateEncounter — two vessels at one instant (ADR 0011 §4). One
// predicate pass over the scope, classification and precedence entries
// against the flattened situation, then rel:overrides resolved between the
// applied entries exactly as evaluateDisplay resolves it. Composition calls
// the data leaves open are recorded in docs/engine-notes.md.

import {
  checkDataVersion,
  COLREGS_VERSION,
  RESOLVED_DATA,
  entryCategory,
  provenanceOf,
  resolveModality,
  resolveOverrides,
  type EvaluateOptions,
} from './evaluate.js';
import { validateSituation } from './facts.js';
import { flattenSituation, situationMatches, type FlatSituation } from './situation.js';
import type {
  ApplicabilityData,
  EncounterEvaluation,
  Entry,
  RuleId,
  FactRecord,
  Modality,
  RuleCategory,
  Situation,
  SubjectRole,
} from './types.js';

/** colregs' entries are written from one seat, so `roles` alone reads a
 * second, swapped frame (self and other exchanged, `pair`/`traffic`
 * unchanged) per ADR 0016: an override whose source sits in one vessel's
 * seat and target in the other's is invisible to a one-seat reader. */
function swappedSituation(situation: Situation): Situation | undefined {
  if (!situation.other) return undefined;
  return { ...situation, self: situation.other, other: situation.self };
}

/** The categories an encounter reads, in one pass (ADR 0011 §1). */
export const ENCOUNTER_CATEGORIES: readonly RuleCategory[] = [
  'category:scope',
  'category:classification',
  'category:precedence',
];

/** The modalities that let an encounter entry's rel:overrides fire: wider
 * than display's, because 9(b) is written `shall-not-impede` and overrides
 * 18(a)(iv). A `may` overrider is inert, as in display. */
const OBLIGATIONS: ReadonlySet<Modality> = new Set<Modality>([
  'modality:shall',
  'modality:shall-if-practicable',
  'modality:shall-not',
  'modality:shall-not-impede',
]);

/** When two classification entries assert different encounters at once,
 * the one that reads history wins: 13(d) says a latched overtaking is never
 * reclassified, and 14(c) errs toward head-on over crossing. */
const ENCOUNTER_RANK: Record<string, number> = {
  'encounter:overtaking': 3,
  'encounter:head-on': 2,
  'encounter:crossing': 1,
  'encounter:none': 0,
};

/** A value colregs adds after this release ranks below every value named
 * here, so it is still reported when nothing known applies but never
 * displaces a known classification — and the answer stops depending on
 * where in `entries` the new rule happens to sit. Own keys only: without
 * that, `constructor` reads a function off the prototype. */
function encounterRank(value: string): number {
  return Object.prototype.hasOwnProperty.call(ENCOUNTER_RANK, value)
    ? ENCOUNTER_RANK[value]
    : -1;
}

/** A Part D sound/light signal entry: `category:display` like a light or a
 * shape, but carrying a `signal` sequence rather than a `lights`/`shapes`
 * spec. Rule 34's signals are acts of the encounter — "I am altering my
 * course to starboard" is addressed to the other vessel and most of them
 * gate on `pair:geo:in_sight` — so the encounter verb reads them, where it
 * reads no other display entry. The marker is the field, not the category:
 * colregs files them under display because they are things a vessel emits,
 * and widening ENCOUNTER_CATEGORIES to `category:display` would pull in
 * every light and shape with them. */
function isSignal(e: Entry): boolean {
  return entryCategory(e) === 'category:display' && e.signal !== undefined;
}

/** The entries an encounter reads: the three categories above, plus the
 * Part D signal entries. */
function readsEncounter(e: Entry): boolean {
  return ENCOUNTER_CATEGORIES.includes(entryCategory(e)) || isSignal(e);
}

function appliedEntries(data: ApplicabilityData, flat: FlatSituation): Entry[] {
  return data.entries.filter((e) => readsEncounter(e) && situationMatches(e.when, flat));
}

function precedenceEntries(data: ApplicabilityData, flat: FlatSituation): Entry[] {
  return data.entries.filter(
    (e) => entryCategory(e) === 'category:precedence' && situationMatches(e.when, flat),
  );
}

/** ADR 0016: precedence entries pool across the self and swapped frames,
 * keyed by which actual vessel each fired for; `rel:overrides` resolves over
 * the pool, and only the survivors' `effect.self`/`effect.other` become
 * roles. `applied`/`scope`/`encounter`/`modalities`/`categories` stay
 * self-frame (§4) and are computed elsewhere from `flat` alone.
 *
 * Deduplicated by entry id, self-frame preferred: no precedence entry in
 * colregs' table can match both frames at once today (every one gates on an
 * asymmetric self/other predicate, e.g. opposite bearing sectors), but a
 * future entry that did would otherwise emit two roles for one rule firing
 * once, so the pool keeps exactly one frame's reading per id rather than
 * relying on that holding forever. */
function pooledRoles(
  data: ApplicabilityData,
  flat: FlatSituation,
  situation: Situation,
): { roles: { self: SubjectRole[]; other: SubjectRole[] }; overridden: { id: string; by: string }[] } {
  const swapped = swappedSituation(situation);
  const flatSwap = swapped ? flattenSituation(swapped) : undefined;

  const frameOf = new Map<string, 'self' | 'swap'>();
  const pooledById = new Map<string, Entry>();
  const pooledModalities: Record<string, Modality> = {};
  // Swap first, self second, so an entry matching both frames at once keeps
  // a deterministic, self-frame-preferred reading rather than depending on
  // array order.
  for (const entry of flatSwap ? precedenceEntries(data, flatSwap) : []) {
    frameOf.set(entry.id, 'swap');
    pooledById.set(entry.id, entry);
    pooledModalities[entry.id] = resolveModality(entry, flatSwap as unknown as FactRecord);
  }
  for (const entry of precedenceEntries(data, flat)) {
    frameOf.set(entry.id, 'self');
    pooledById.set(entry.id, entry);
    pooledModalities[entry.id] = resolveModality(entry, flat as unknown as FactRecord);
  }

  const pooled = [...pooledById.values()];
  const { overridden, overriddenIds } = resolveOverrides(pooled, pooledModalities, OBLIGATIONS);

  const roles: { self: SubjectRole[]; other: SubjectRole[] } = { self: [], other: [] };
  for (const entry of pooled) {
    if (overriddenIds.has(entry.id)) continue;
    const effect = entry.effect as Record<string, unknown> | undefined;
    const selfEffect = effect?.self as SubjectRole['role'] | undefined;
    const otherEffect = effect?.other as SubjectRole['role'] | undefined;
    const frame = frameOf.get(entry.id);
    const [toSelf, toOther] = frame === 'self' ? [selfEffect, otherEffect] : [otherEffect, selfEffect];
    if (toSelf !== undefined && toSelf !== 'role:none') roles.self.push({ role: toSelf, by: entry.id });
    if (toOther !== undefined && toOther !== 'role:none') roles.other.push({ role: toOther, by: entry.id });
  }
  return { roles, overridden };
}

/**
 * The ids of the entries whose predicate holds, without resolving relations
 * — the situation-fixture contract, as `appliedDisplayEntries` is the
 * applicability-fixture one. Validates `situation` on the same terms.
 *
 * @alpha
 */
export function appliedEncounterEntries(
  situation: Situation,
  opts: EvaluateOptions = {},
): RuleId[] {
  checkDataVersion(opts);
  validateSituation(situation);
  return appliedEntries(opts.data ?? RESOLVED_DATA, flattenSituation(situation)).map((e) => e.id);
}

/**
 * Every `scope`, `classification` and `precedence` entry whose predicate
 * holds for `situation`, with roles, risk-of-collision grounds and
 * `rel:overrides` resolved in one pass. `fact:rule18_class` is derived per
 * subject before matching, as colregs specifies.
 *
 * @alpha
 */
export function evaluateEncounter(
  situation: Situation,
  opts: EvaluateOptions = {},
): EncounterEvaluation {
  checkDataVersion(opts);
  const data = opts.data ?? RESOLVED_DATA;
  const source: 'resolved' | 'caller' = opts.data ? 'caller' : 'resolved';
  validateSituation(situation);
  const flat = flattenSituation(situation);
  const applied = appliedEntries(data, flat);

  const modalities: Record<RuleId, Modality> = {};
  const categories: Record<RuleId, RuleCategory> = {};
  for (const e of applied) {
    modalities[e.id] = resolveModality(e, flat as unknown as FactRecord);
    categories[e.id] = entryCategory(e);
  }

  const { overridden, overriddenIds } = resolveOverrides(applied, modalities, OBLIGATIONS);
  const standing = applied.filter((e) => !overriddenIds.has(e.id));

  const scope: RuleId[] = [];
  const riskBy: RuleId[] = [];
  let encounter: EncounterEvaluation['encounter'];

  for (const e of standing) {
    const effect = e.effect as Record<string, unknown> | undefined;
    switch (entryCategory(e)) {
      case 'category:scope':
        scope.push(e.id);
        break;
      case 'category:classification':
        if (effect?.risk_of_collision === true) riskBy.push(e.id);
        if (typeof effect?.encounter === 'string') {
          const value = effect.encounter as NonNullable<EncounterEvaluation['encounter']>;
          if (encounter === undefined || encounterRank(value) > encounterRank(encounter)) {
            encounter = value;
          }
        }
        break;
      default:
        break;
    }
  }

  const { roles, overridden: pooledOverridden } = pooledRoles(data, flat, situation);
  // `overridden`'s self-frame entries win on a ties (they're already visible
  // in `applied`); a pooled pair only adds an id resolveOverrides' self-frame
  // call could never see -- exactly the cross-frame case ADR 0016 exists for.
  const selfFrameOverriddenIds = new Set(overridden.map((o) => o.id));
  for (const pair of pooledOverridden) {
    if (!selfFrameOverriddenIds.has(pair.id)) overridden.push(pair);
  }

  // Rule 7(a) makes risk a judgement on all available means; a caller who
  // states it has made that judgement, and 7(d)(i) can only add a ground.
  const stated = situation.pair?.geo?.['geo:risk_of_collision'] === true;

  return {
    colregs: { version: COLREGS_VERSION, source },
    applied: applied.map((e) => e.id),
    scope,
    encounter,
    risk_of_collision: { asserted: stated || riskBy.length > 0, by: riskBy },
    roles,
    overridden,
    modalities,
    categories,
    provenance: provenanceOf(data, ENCOUNTER_CATEGORIES),
  };
}
