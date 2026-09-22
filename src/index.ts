// Public API of the colregs-engine package: exactly the operations colregs'
// manifest names (data/operations.json, ADR 0014, ADR 0023), one per thing
// evaluated, the one error a verb throws about the caller's data, and the
// types their inputs and answers are written in.
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

import { evaluateDisplay } from './evaluate.js';
import { evaluateEncounter } from './encounter.js';
import { evaluateConduct } from './conduct.js';
import { evaluateDeparture } from './departure.js';
import { evaluateScene } from './scene.js';
import { reduceTraffic } from './traffic.js';
export {
  evaluateDisplay,
  evaluateEncounter,
  evaluateConduct,
  evaluateDeparture,
  evaluateScene,
  reduceTraffic,
};
export { DataVersionMismatchError } from './errors.js';
export type { EvaluateOptions } from './evaluate.js';

// The engine interface colregs owns (ADR 0014): checked here, once, against
// the exports above, rather than left to a consumer to discover a drift at
// the call site. `satisfies` verifies structurally and changes no runtime
// behaviour; the object is not exported. The pinned manifest still names
// the three companions and the departure verb's old name; the bump to the
// ADR 0023 manifest collapses this object to the six exports.
import { appliedDisplayEntries } from './evaluate.js';
import { appliedEncounterEntries } from './encounter.js';
import { appliedConductEntries } from './conduct.js';
import type { ColregsEngine } from './generated/colregs-engine.js';
({
  evaluateDisplay,
  appliedDisplayEntries,
  evaluateEncounter,
  appliedEncounterEntries,
  evaluateConduct,
  appliedConductEntries,
  evaluateRule2Departure: evaluateDeparture,
}) satisfies ColregsEngine;

// Inputs.
export type { FactRecord } from './generated/fact-record.js';
export type {
  DepartureModel,
  DepartureRegion,
  Pair,
  Scene,
  Situation,
  SolverParameters,
  Subject,
  Trace,
  TraceSample,
} from './types.js';

// Answers.
export type {
  ConductEvaluation,
  ConductPhaseChange,
  ConductVerdict,
  DepartureAdvisory,
  DepartureFinding,
  DepartureStatus,
  Display,
  DisplayEvaluation,
  DisplayLight,
  DisplayShape,
  EncounterEvaluation,
  EvaluationProvenance,
  SceneConflict,
  SceneEvaluation,
  SubjectRole,
  TrafficFacts,
  TrafficSector,
  TrafficSectorFacts,
} from './types.js';

// The vocabularies the answers are typed in — colregs' own, re-exported
// because the envelopes carry them, not a widening of `colregs-engine/schema`.
export type { ParagraphCite } from './types.js';
export type { EffectRole, Modality, RuleId } from './generated/applicability.js';
export type { RepresentedParagraph, RuleCategory } from './schema.js';
