/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs@0.3.2 data/operations.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned data disagree.
 */

import type {
  ConductEvaluation,
  DisplayEvaluation,
  EncounterEvaluation,
  RuleId,
  FactRecord,
  Rule2DepartureFinding,
  Rule2DepartureModel,
  Situation,
  Trace,
} from '../types.js';

/**
 * The engine interface colregs owns (ADR 0014): every verb ADR 0011 and ADR
 * 0012 name, positional inputs in the manifest's own order, and each verb's
 * entry-id companion. Trailing `opts` is this binding's own -- an options
 * bag colregs' manifest does not name -- so every export in src/index.ts
 * takes one more (optional) parameter than the signatures below.
 */
export interface ColregsEngine {
  evaluateDisplay(facts: FactRecord): DisplayEvaluation;
  appliedDisplayEntries(facts: FactRecord): RuleId[];
  evaluateEncounter(situation: Situation): EncounterEvaluation;
  appliedEncounterEntries(situation: Situation): RuleId[];
  evaluateConduct(trace: Trace): ConductEvaluation;
  appliedConductEntries(trace: Trace): RuleId[];
  evaluateRule2Departure(situation: Situation, model: Rule2DepartureModel): Rule2DepartureFinding;
}
