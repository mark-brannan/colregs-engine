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

import { appliedDisplayEntries, evaluateDisplay } from './evaluate.js';
export { appliedDisplayEntries, evaluateDisplay };
export type { EvaluateOptions } from './evaluate.js';
export { DataVersionMismatchError } from './errors.js';

// The three verbs ADR 0011 §4 and ADR 0012 name, built partially: each
// answers an envelope from the data it has, and says in the envelope what it
// could not decide. NotImplementedError stays exported for consumers that
// catch it; no verb throws it any more.
import { appliedEncounterEntries, evaluateEncounter } from './encounter.js';
export { appliedEncounterEntries, evaluateEncounter };
import { appliedConductEntries, evaluateConduct } from './conduct.js';
export { appliedConductEntries, evaluateConduct };
import { evaluateRule2Departure } from './rule2.js';
export { evaluateRule2Departure };
export { reduceTraffic } from './traffic.js';
export { evaluateScene } from './scene.js';
export { NotImplementedError } from './errors.js';
export { validateSituation, validateTrace } from './facts.js';

// The engine interface colregs owns (ADR 0014, data/operations.json):
// checked here, once, against the exports above, rather than left to a
// consumer to discover a drift at the call site. `satisfies` verifies
// structurally and changes no runtime behavior; the object is not exported.
import type { ColregsEngine } from './generated/colregs-engine.js';
({
  evaluateDisplay,
  appliedDisplayEntries,
  evaluateEncounter,
  appliedEncounterEntries,
  evaluateConduct,
  appliedConductEntries,
  evaluateRule2Departure,
}) satisfies ColregsEngine;

export type {
  ConductEvaluation,
  ConductPhaseChange,
  ConductVerdict,
  Display,
  DisplayEvaluation,
  DisplayLight,
  EncounterEvaluation,
  EvaluationProvenance,
  ParagraphCite,
  Rule2DepartureAdvisory,
  Rule2DepartureFinding,
  Rule2DepartureModel,
  Rule2DepartureRegion,
  Rule2DepartureStatus,
  SolverParameters,
  SubjectRole,
  Trace,
  TraceSample,
  Situation,
  Subject,
  Pair,
  Scene,
  SceneConflict,
  SceneEvaluation,
  TrafficFacts,
  TrafficSector,
  TrafficSectorFacts,
} from './types.js';
export type { EffectRole } from './generated/applicability.js';
export type { RuleId as EntryId } from './generated/applicability.js';
export type { FactRecord } from './generated/fact-record.js';
export type { Modality } from './generated/applicability.js';
// colregs' own vocabulary, re-exported here because the envelope's
// `categories` and `provenance.represented` are typed in it — the same
// reason Modality is above, and not a widening of `colregs-engine/schema`.
export type { RepresentedParagraph, RuleCategory } from './schema.js';
