/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs@0.3.2 schema/rules.schema.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

/**
 * The language-neutral skeleton: paragraph paths, rule numbers, jurisdictions and figures. No text -- the words live in data/text/ corpora (schema/corpus.schema.json); the edition each jurisdiction consolidates is declared in data/editions.json. Structure only -- see docs/adr/0006-json-schema-and-identifier-diff.md, docs/adr/0003-language-as-a-dimension.md and docs/adr/0013-corpus-files-with-editions.md.
 */
export interface RulesData {
  note?: string;
  paragraphs: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^[0-9]+(\([a-z]\))?(\([ivx]+\))?$".
     */
    [k: string]: {
      path: string;
      rule: string;
      jurisdiction: string;
      /**
       * @minItems 1
       */
      images?: string[];
    };
  };
}
