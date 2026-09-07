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
  // Deprecated aliases of the two above, kept for one release so searoom can
  // migrate on its own schedule.
  appliedEntries,
  evaluate,
} from './evaluate.js';
export type { EvaluateOptions } from './evaluate.js';

export type {
  Display,
  DisplayEvaluation,
  DisplayLight,
  /** @deprecated Renamed to DisplayEvaluation. */
  Evaluation,
} from './types.js';
export type { FactRecord } from './generated/fact-record.js';
export type { Modality } from './generated/applicability.js';
