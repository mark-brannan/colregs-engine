/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs schema/applicability-fixtures.schema.json
 * Version: declared in package.json, resolved in package-lock.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

export type RuleId = string;

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
    jurisdiction?: string;
    facts: FactRecord;
    expect: RuleId[];
  }[];
}
/**
 * What a consumer asserts about one vessel at one moment: the input evaluateDisplay reads (ADR 0011 §2, ADR 0014). Structure only -- which fact keys exist and which values each takes is data/facts.json's, checked in the tests; see docs/adr/0006-json-schema-and-identifier-diff.md.
 */
export interface FactRecord {
  /**
   * This interface was referenced by `FactRecord`'s JSON-Schema definition
   * via the `patternProperty` "^fact:[a-z0-9_]+$".
   */
  [k: string]: string | number | boolean;
}
