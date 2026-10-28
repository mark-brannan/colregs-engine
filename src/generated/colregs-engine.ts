/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs data/operations.json
 * Version: declared in package.json, resolved in package-lock.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned data disagree.
 */

import type {
  Circumstances,
  CircumstancesEvaluation,
  ComplianceEvaluation,
  DepartureFinding,
  DepartureModel,
  DisplayEvaluation,
  FactRecord,
  RuleId,
  Situation,
  Trace,
  UnifiedEvaluation,
} from '../types.js';

/**
 * The engine interface colregs owns (ADR 0014): every operation the manifest
 * names, positional inputs in the manifest's own order. Trailing `opts` is
 * this binding's own -- an options bag colregs' manifest does not name -- so
 * every export in src/index.ts takes one more (optional) parameter than the
 * signatures below.
 */
export interface ColregsEngine {
  evaluateSignals(facts: FactRecord): DisplayEvaluation;
  appliedSignalsEntries(facts: FactRecord): RuleId[];
  evaluateCircumstances(situation: Situation): CircumstancesEvaluation;
  appliedCircumstancesEntries(situation: Situation): RuleId[];
  evaluateCompliance(trace: Trace): ComplianceEvaluation;
  appliedComplianceEntries(trace: Trace): RuleId[];
  evaluateRule2Departure(situation: Situation, model: DepartureModel): DepartureFinding;
  evaluate(circumstances: Circumstances): UnifiedEvaluation;
}
