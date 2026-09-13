// evaluateEncounter — two vessels at one instant (ADR 0011 §4). One
// predicate pass over the scope, classification and precedence entries
// against the flattened situation, then rel:overrides resolved between the
// applied entries exactly as evaluateDisplay resolves it. Composition calls
// the data leaves open are recorded in docs/engine-notes.md.

import {
  COLREGS_VERSION,
  RESOLVED_DATA,
  entryCategory,
  provenanceOf,
  resolveModality,
  type EvaluateOptions,
} from './evaluate.js';
import { validateSituation } from './facts.js';
import { flattenSituation, situationMatches, type FlatSituation } from './situation.js';
import type {
  ApplicabilityData,
  EncounterEvaluation,
  Entry,
  EntryId,
  FactRecord,
  Modality,
  RuleCategory,
  Situation,
  SubjectRole,
} from './types.js';

/** The categories an encounter reads, in one pass (ADR 0011 §1). */
export const ENCOUNTER_CATEGORIES: readonly RuleCategory[] = [
  'scope',
  'classification',
  'precedence',
];

/** A modality that carries an obligation, and so lets an entry's
 * rel:overrides fire; a `may` overrider is inert, as in display. */
const OBLIGATIONS: ReadonlySet<Modality> = new Set<Modality>([
  'shall',
  'shall-if-practicable',
  'shall-not',
  'shall-not-impede',
]);

/** When two classification entries assert different encounters at once,
 * the one that reads history wins: 13(d) says a latched overtaking is never
 * reclassified, and 14(c) errs toward head-on over crossing. */
const ENCOUNTER_RANK: Record<string, number> = {
  overtaking: 3,
  'head-on': 2,
  crossing: 1,
  none: 0,
};

function appliedEntries(data: ApplicabilityData, flat: FlatSituation): Entry[] {
  return data.entries.filter(
    (e) => ENCOUNTER_CATEGORIES.includes(entryCategory(e)) && situationMatches(e.when, flat),
  );
}

/**
 * The ids of the entries whose predicate holds, without resolving relations
 * — the situation-fixture contract, as `appliedDisplayEntries` is the
 * applicability-fixture one. Validates `situation` on the same terms.
 *
 * @beta
 */
export function appliedEncounterEntries(
  situation: Situation,
  opts: EvaluateOptions = {},
): EntryId[] {
  validateSituation(situation);
  return appliedEntries(opts.data ?? RESOLVED_DATA, flattenSituation(situation)).map((e) => e.id);
}

/** rel:overrides between applied entries: fires only from an un-displaced
 * obligation, reaches only applied entries, and a displaced entry's own
 * overrides do not fire. The data is acyclic, so the memo terminates. */
function resolveOverrides(
  applied: Entry[],
  modalities: Record<EntryId, Modality>,
): { id: EntryId; by: EntryId }[] {
  const appliedIds = new Set(applied.map((e) => e.id));
  const cache = new Map<EntryId, boolean>();
  const by = new Map<EntryId, EntryId>();
  function isOverridden(id: EntryId): boolean {
    if (cache.has(id)) return cache.get(id)!;
    cache.set(id, false);
    let result = false;
    for (const e of applied) {
      if (!OBLIGATIONS.has(modalities[e.id])) continue;
      if (!(e['rel:overrides'] ?? []).includes(id)) continue;
      if (isOverridden(e.id)) continue;
      result = true;
      by.set(id, e.id);
      break;
    }
    cache.set(id, result);
    return result;
  }
  const overridden: { id: EntryId; by: EntryId }[] = [];
  for (const e of applied) {
    if (!OBLIGATIONS.has(modalities[e.id]) || isOverridden(e.id)) continue;
    for (const ref of e['rel:overrides'] ?? []) {
      if (appliedIds.has(ref) && isOverridden(ref) && by.get(ref) === e.id) {
        overridden.push({ id: ref, by: e.id });
      }
    }
  }
  return overridden;
}

/**
 * Every `scope`, `classification` and `precedence` entry whose predicate
 * holds for `situation`, with roles, risk-of-collision grounds and
 * `rel:overrides` resolved in one pass. `fact:rule18_class` is derived per
 * subject before matching, as colregs specifies.
 *
 * @beta
 */
export function evaluateEncounter(
  situation: Situation,
  opts: EvaluateOptions = {},
): EncounterEvaluation {
  const data = opts.data ?? RESOLVED_DATA;
  const source: 'resolved' | 'caller' = opts.data ? 'caller' : 'resolved';
  validateSituation(situation);
  const flat = flattenSituation(situation);
  const applied = appliedEntries(data, flat);

  const modalities: Record<EntryId, Modality> = {};
  const categories: Record<EntryId, RuleCategory> = {};
  for (const e of applied) {
    modalities[e.id] = resolveModality(e, flat as unknown as FactRecord);
    categories[e.id] = entryCategory(e);
  }

  const overridden = resolveOverrides(applied, modalities);
  const displaced = new Set(overridden.map((o) => o.id));
  const standing = applied.filter((e) => !displaced.has(e.id));

  const scope: EntryId[] = [];
  const riskBy: EntryId[] = [];
  const roles: { own: SubjectRole[]; other: SubjectRole[] } = { own: [], other: [] };
  let encounter: EncounterEvaluation['encounter'];

  for (const e of standing) {
    const effect = e.effect as Record<string, unknown> | undefined;
    switch (entryCategory(e)) {
      case 'scope':
        scope.push(e.id);
        break;
      case 'classification':
        if (effect?.risk_of_collision === true) riskBy.push(e.id);
        if (typeof effect?.encounter === 'string') {
          const value = effect.encounter as NonNullable<EncounterEvaluation['encounter']>;
          if (encounter === undefined || ENCOUNTER_RANK[value] > ENCOUNTER_RANK[encounter]) {
            encounter = value;
          }
        }
        break;
      case 'precedence':
        for (const subject of ['own', 'other'] as const) {
          const role = effect?.[subject] as SubjectRole['role'] | undefined;
          if (role !== undefined && role !== 'none') roles[subject].push({ role, by: e.id });
        }
        break;
      default:
        break;
    }
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
