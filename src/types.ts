// The engine's own output vocabulary — Display, DisplayLight, Evaluation.
//
// These mirror nothing in colregs. They are this implementation's answers,
// and they are what `colregs-engine` promises to keep stable.
//
// The colregs data shapes are not written here either: they are generated
// from colregs' JSON Schema and live behind `colregs-engine/schema`
// (src/schema.ts). This module re-exports them for internal use and for the
// tests, which read applicability.json directly.

import type { Modality } from './generated/applicability.js';
import type { LightSpec } from './schema.js';

export * from './schema.js';

import type {
  ApplicabilityData as SchemaApplicabilityData,
  ConditionalInclude as SchemaConditionalInclude,
  Constraint as SchemaConstraint,
  Entry as SchemaEntry,
} from './schema.js';

// colregs' own schema (schema/applicability.schema.json's predicateValue)
// doesn't define `not` or `any_of` yet -- these anticipate a colregs schema
// revision colregs-engine#9 / #13 got ahead of. No lights entry uses either
// shape today; the test suite exercises them with literal `when` data
// copied from real Part B entries rather than through generated fixtures.
// The overrides below layer these forms onto the generated shapes, the
// same way this file already layers Display/Evaluation on top of them.

/** `{ not: C }` on a fact's constraint: the fact is present and does not
 * satisfy C. An absent fact never satisfies `not` either. */
export interface NotConstraint {
  not: Constraint;
}

/** `{ any_of: [C, ...] }` on a fact's constraint: the fact satisfies at
 * least one C. */
export interface AnyOfConstraint {
  any_of: Constraint[];
}

/** A fact's constraint: colregs' own predicateValue shapes, plus the
 * not/any_of forms above. */
export type Constraint = SchemaConstraint | NotConstraint | AnyOfConstraint;

/** `"any_of": [W, ...]` as a *key* of a `when` (not a fact's constraint):
 * predicate-level disjunction -- at least one sub-`when` W must hold. Its
 * value is structurally a Predicate[], not a Constraint, so callers cast
 * through `unknown` at that one key the way predicateMatches does. */
export type Predicate = Record<string, Constraint>;

export interface ModalityBy {
  when: Predicate;
  modality: Modality;
}

export interface ConditionalInclude extends Omit<SchemaConditionalInclude, 'when'> {
  when?: Predicate;
}

export interface Entry
  extends Omit<SchemaEntry, 'when' | 'modality_by' | 'rel:conditional_includes'> {
  when: Predicate;
  modality_by?: ModalityBy[];
  'rel:conditional_includes'?: ConditionalInclude[];
}

export interface ApplicabilityData extends Omit<SchemaApplicabilityData, 'entries'> {
  entries: Entry[];
}

/** One light as it appears in a resolved display, with its provenance. */
export interface DisplayLight {
  spec: LightSpec;
  /** Entry whose lights clause prescribes this light. */
  sourceEntry: string;
  /** Entry that pulled it in, when different (rel:includes / one_of import). */
  via?: string;
  /** Resolved modality of the component carrying this light. */
  modality: Modality;
}

/** One complete lawful display. */
export interface Display {
  /** Entry ids whose lights this display shows (applied + imported). */
  entries: string[];
  lights: DisplayLight[];
  /** Choice labels that distinguish this display from its siblings. */
  chosen: string[];
}

export interface Evaluation {
  /**
   * The colregs release resolved by this package, read at import time. An
   * applicability answer is a function of the data as much as of the facts;
   * without this, "the answer changed" cannot be told apart from "the data
   * changed". Names the engine's own dependency, not a stamp on the `data`
   * argument — colregs' schema carries no version field, so a caller who
   * evaluates against applicability data from some other release goes
   * undetected.
   */
  colregs: { version: string };
  /** Entries whose predicate matched, in data order (the fixture contract). */
  applied: string[];
  /** Applied entries relieved by a rel:exempts entry, with the exempting id. */
  exempted: { id: string; by: string }[];
  /** Applied entries suppressed by a required entry's rel:excludes. */
  excluded: { id: string; by: string }[];
  /** Every complete lawful display (alternatives unresolved, REQ-MODEL-8). */
  displays: Display[];
  /**
   * Applied or imported 'may' components that carry no alternative
   * relations: lawful additions that don't multiply the display set
   * (second masthead below 50 m, deck lights below 100 m, …).
   */
  optionalAdditions: {
    id: string;
    via?: string;
    lights: DisplayLight[];
    cite: string;
  }[];
  /** Resolved modality per applied/imported entry id. */
  modalities: Record<string, Modality>;
}
