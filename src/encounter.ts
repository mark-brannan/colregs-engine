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
 * @alpha
 */
export function appliedEncounterEntries(
  situation: Situation,
  opts: EvaluateOptions = {},
): RuleId[] {
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
  const roles: { own: SubjectRole[]; other: SubjectRole[] } = { own: [], other: [] };
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
      case 'category:precedence':
        for (const subject of ['own', 'other'] as const) {
          // colregs' data field is `self`/`other` (ADR 0016); `own` is this
          // engine's own subject vocabulary.
          const dataKey = subject === 'own' ? 'self' : 'other';
          const role = effect?.[dataKey] as SubjectRole['role'] | undefined;
          if (role !== undefined && role !== 'role:none') roles[subject].push({ role, by: e.id });
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
