// Public API of the colregs-engine package: the operations colregs'
// manifest names (data/operations.json, ADR 0014, ADR 0023), one per thing
// evaluated, the one error a verb throws about the caller's data, and the
// types their inputs and answers are written in. Beside them, `evaluate`:
// the unified form (src/unified.ts), a second variant workshopped against
// the same cases until one of the two is preferred.
//
// Deliberately narrow. Everything here is API-tier: it must stay stable
// across colregs data releases, so it is the engine's own vocabulary and
// nothing else. The mirrored colregs data shapes — Entry, Predicate,
// LightSpec, ApplicabilityData and the rest — are `colregs-engine/schema`,
// because they move when the data moves and a consumer should choose that
// exposure rather than inherit it.
//
// Not here, by ADR 0023: no companion (`applied*Entries` was the envelope's
// `applied`, from the same call), no validator (every verb validates its
// input and throws), no error class nothing throws, no predicate internals.

import { evaluateSignals } from './evaluate.js';
import { evaluateCircumstances } from './circumstances.js';
import { evaluateCompliance } from './compliance.js';
import { evaluateDeparture } from './departure.js';
// evaluateVessels (vessels.ts) and reduceOthers (others.ts) stay in the code,
// unexported, until colregs' manifest names them again.
export { evaluateSignals, evaluateCircumstances, evaluateCompliance, evaluateDeparture };
import { evaluate } from './unified.js';
export { evaluate, Evaluation } from './unified.js';
export { DataVersionMismatchError } from './errors.js';
export type { EvaluateOptions } from './evaluate.js';

// The engine interface colregs owns (ADR 0014): checked here, once, against
// the exports above, rather than left to a consumer to discover a drift at
// the call site. `satisfies` verifies structurally and changes no runtime
// behaviour; the object is not exported. The pinned manifest still names
// the companions and the departure verb by its old name; the bump to the
// ADR 0023 manifest collapses this object to the exports.
import { appliedSignalsEntries } from './evaluate.js';
import { appliedCircumstancesEntries } from './circumstances.js';
import { appliedComplianceEntries } from './compliance.js';
import type { ColregsEngine } from './generated/colregs-engine.js';
({
  evaluateSignals,
  appliedSignalsEntries,
  evaluateCircumstances,
  appliedCircumstancesEntries,
  evaluateCompliance,
  appliedComplianceEntries,
  evaluateRule2Departure: evaluateDeparture,
  evaluate,
}) satisfies ColregsEngine;

// Inputs.
export type { FactRecord } from './generated/fact-record.js';
export type { Circumstances, Known, Observed, Other, OtherGeometry } from './unified.js';
export type {
  DepartureModel,
  DepartureRegion,
  Pair,
  Situation,
  SolverParameters,
  Vessel,
  Trace,
  TraceSample,
} from './types.js';

// Answers.
export type { Appraisal, AppraisalOfOther, Indication, RestedOn } from './unified.js';
export type {
  ComplianceEvaluation,
  CompliancePhaseChange,
  ComplianceVerdict,
  DepartureAdvisory,
  DepartureFinding,
  DepartureStatus,
  Display,
  DisplayEvaluation,
  DisplayLight,
  DisplayShape,
  CircumstancesEvaluation,
  EvaluationProvenance,
  VesselRole,
  OthersFacts,
  OthersSector,
  OthersSectorFacts,
} from './types.js';

// The vocabularies the answers are typed in — colregs' own, re-exported
// because the envelopes carry them, not a widening of `colregs-engine/schema`.
export type { ParagraphCite } from './types.js';
export type { EffectRole, Modality, RuleId } from './generated/applicability.js';
export type { KnownOmission, RepresentedParagraph, RuleCategory } from './schema.js';
