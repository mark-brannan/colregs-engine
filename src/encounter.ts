// evaluateEncounter — two vessels at one instant. Stub; ADR 0001 §4 fixes
// the signature and EncounterEvaluation, and the body comes after Situation
// validation and the situation-fixture replay.

import type { EvaluateOptions } from './evaluate.js';
import type { EncounterEvaluation, EntryId, Situation } from './types.js';
import { NotImplementedError } from './errors.js';

/**
 * Every `scope`, `classification` and `precedence` entry whose predicate
 * holds for `situation`, with roles, risk-of-collision grounds and
 * `rel:overrides` resolved in one pass.
 *
 * @alpha Not built: throws {@link NotImplementedError}.
 */
export function evaluateEncounter(
  _situation: Situation,
  _opts?: EvaluateOptions,
): EncounterEvaluation {
  throw new NotImplementedError('evaluateEncounter', 'ADR 0001 §4');
}

/**
 * The ids of the entries whose predicate holds, without resolving relations
 * — the situation-fixture contract, as `appliedDisplayEntries` is the
 * applicability-fixture one.
 *
 * @alpha Not built: throws {@link NotImplementedError}.
 */
export function appliedEncounterEntries(
  _situation: Situation,
  _opts?: EvaluateOptions,
): EntryId[] {
  throw new NotImplementedError('appliedEncounterEntries', 'ADR 0001 §1');
}
