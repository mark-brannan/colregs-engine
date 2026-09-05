// `colregs-engine/schema` — the colregs data shapes, as types.
//
// These are mirrors of colregs' data files, generated from its published
// JSON Schema (src/generated/, `npm run generate`). They move at the speed
// of the data, which is not the speed a package's public API is allowed to
// move at, so they live behind their own entry point: a consumer that only
// evaluates facts imports `colregs-engine` and is unaffected when colregs
// adds a relation; a consumer that reads applicability.json itself opts in
// here and accepts that exposure knowingly.
//
// Nothing here is hand-written. The named aliases below exist so the engine
// and its consumers can say `Entry` rather than
// `ApplicabilityData['entries'][number]`; each one resolves to a generated
// type, so a schema change still lands as a compile error.

import type {
  ApplicabilityData,
  LightsData,
  RulesData,
} from './generated/index.js';
import type {
  LightRef,
  PredicateValue,
  When,
} from './generated/applicability.js';

/** Root type of each colregs data and fixture file. */
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

/**
 * Per-schema namespaces, for the shapes with no alias below. Several schemas
 * define their own `When` and `PredicateValue`, so these cannot be flattened.
 */
export type {
  applicability,
  applicabilityFixtures,
  deprecatedIdentifiers,
  facts,
  geometry,
  images,
  lights,
  rules,
  situationFixtures,
} from './generated/index.js';

export type {
  ConditionalInclude,
  EntryId,
  EntryIdList,
  Modality,
  ModalityBy,
} from './generated/applicability.js';

/** A value a fact record may carry. */
export type { FactValue } from './generated/applicability-fixtures.js';

/** colregs' fact vocabulary, as types. */
export type {
  FactKey,
  FactRecord,
  FactValues,
} from './generated/fact-record.js';

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
