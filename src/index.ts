// Public API of the colregs-engine package.
//
// Deliberately narrow. Everything here is API-tier: it must stay stable
// across colregs data releases, so it is the engine's own vocabulary and
// nothing else. The mirrored colregs data shapes — Entry, Predicate,
// LightSpec, ApplicabilityData and the rest — are `colregs-engine/schema`,
// because they move when the data moves and a consumer should choose that
// exposure rather than inherit it.
//
// predicateMatches and resolveModality are not exported: they are predicate
// internals, not answers, and nothing outside src/evaluate.ts uses them.

export {
  appliedDisplayEntries,
  evaluateDisplay,
} from './evaluate.js';
export type { EvaluateOptions } from './evaluate.js';

// The three verbs ADR 0011 §4 and ADR 0012 name. Exported from the day they
// are named so their shapes are compiler-checked and a consumer can build
// against them; every one throws NotImplementedError until its body lands.
export { appliedEncounterEntries, evaluateEncounter } from './encounter.js';
export { appliedConductEntries, evaluateConduct } from './conduct.js';
export { evaluateRule2Departure } from './rule2.js';
export { NotImplementedError } from './errors.js';

export type {
  ConductEvaluation,
  ConductPhaseChange,
  ConductVerdict,
  Display,
  DisplayEvaluation,
  DisplayLight,
  EncounterEvaluation,
  ParagraphCite,
  Rule2DepartureAdvisory,
  Rule2DepartureFinding,
  Rule2DepartureModel,
  Rule2DepartureStatus,
  SolverParameters,
  SubjectRole,
  Trace,
  TraceSample,
  Situation,
  Subject,
  Pair,
} from './types.js';
export type { EffectRole, EntryId } from './generated/applicability.js';
export type { FactRecord } from './generated/fact-record.js';
export type { Modality } from './generated/applicability.js';
