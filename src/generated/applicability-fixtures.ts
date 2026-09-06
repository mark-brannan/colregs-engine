/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs@0.2.0 schema/applicability-fixtures.schema.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^fact:[a-z0-9_]+$".
 */
export type FactValue = string | number | boolean;
export type EntryId = string;

/**
 * The cross-implementation contract: fact record -> expected entry ids. Structure only -- see docs/adr/0006-json-schema-and-identifier-diff.md.
 */
export interface ApplicabilityFixtures {
  note?: string;
  jurisdiction: string;
  /**
   * @minItems 1
   */
  cases: {
    name: string;
    facts: {
      [k: string]: FactValue;
    };
    expect: EntryId[];
  }[];
}
