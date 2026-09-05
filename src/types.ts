// The engine's types.
//
// The colregs data shapes are NOT written here. They are generated from
// colregs' published JSON Schema into src/generated/ (`npm run generate`)
// and re-exported below under the names the engine and its consumers use.
// Hand-transcribing them is how `Entry` came to omit relations the data
// already carried; a schema change must break this build, not a consumer.
//
// What is written here is the engine's own output vocabulary — Display,
// DisplayLight, Evaluation. Those are not mirrors of anything in colregs;
// they are this implementation's answers, and they belong to it.

import type {
  ApplicabilityData,
  LightsData,
  RulesData,
} from './generated/index.js';
import type {
  LightRef,
  Modality,
  PredicateValue,
  When,
} from './generated/applicability.js';
import type { FactValue } from './generated/applicability-fixtures.js';

/** A value a fact record may carry. */
export type { FactValue } from './generated/applicability-fixtures.js';

export type {
  ApplicabilityData,
  ApplicabilityFixtures,
  DeprecatedIdentifiers,
  FactsData,
  GeometryData,
  ImagesData,
  LightsData,
  RulesData,
  SituationFixtures,
} from './generated/index.js';

export type {
  ConditionalInclude,
  EntryId,
  EntryIdList,
  Modality,
  ModalityBy,
} from './generated/applicability.js';

/** One entry of data/applicability.json: predicate -> lights, with modality. */
export type Entry = ApplicabilityData['entries'][number];

/** A predicate: fact key -> constraint. Every key must match (AND). */
export type Predicate = When;

/** One constraint within a predicate. */
export type Constraint = PredicateValue;

/** The numeric-gate arm of a constraint (`{ gte: 50 }`, `{ lt: 7 }`, …). */
export type NumericConstraint = Exclude<
  PredicateValue,
  string | boolean | string[]
>;

/** One light as an entry's `lights` clause references it. */
export type LightSpec = LightRef;

/** One light definition from data/lights.json. */
export type LightDef = LightsData['lights'][string];

/** A light's horizontal arc of visibility. */
export type Arc = NonNullable<LightDef['arc']>;

/** One rule paragraph from data/rules.json. */
export type Paragraph = RulesData['paragraphs'][string];

/** A fact record: what the user has asserted about one vessel at one moment. */
export type FactRecord = Record<string, FactValue>;

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
