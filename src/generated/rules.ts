/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs@0.2.0 schema/rules.schema.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

/**
 * Verbatim rule text keyed by paragraph path. Structure only -- see docs/adr/0006-json-schema-and-identifier-diff.md.
 */
export interface RulesData {
  source: string;
  source_url?: string;
  retrieved?: string;
  note?: string;
  gaps?: {
    path: string;
    reason: string;
  }[];
  paragraphs: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^[0-9]+(\([a-z]\))?(\([ivx]+\))?$".
     */
    [k: string]: {
      path: string;
      rule: string;
      rule_title: string;
      jurisdiction: string;
      text: string;
      /**
       * @minItems 1
       */
      images?: string[];
    };
  };
}
