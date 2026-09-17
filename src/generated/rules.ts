/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs schema/rules.schema.json
 * Version: declared in package.json, resolved in package-lock.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

/**
 * The language-neutral skeleton: paragraph paths, rule numbers, jurisdictions and figures. No text -- the words live in data/text/ corpora (schema/corpus.schema.json); the edition each jurisdiction consolidates is declared in data/editions.json. Structure only -- see docs/adr/0006-json-schema-and-identifier-diff.md, docs/adr/0003-language-as-a-dimension.md and docs/adr/0013-corpus-files-with-editions.md.
 */
export interface RulesData {
  note?: string;
  paragraphs: Paragraphs;
  /**
   * Per-jurisdiction skeleton deltas over `paragraphs` (ADR 0020): own paragraphs by path, suppressed paths, everything else inherited.
   */
  deltas?: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^[a-z]+(/[a-z]+)+$".
     */
    [k: string]: {
      note?: string;
      paragraphs: Paragraphs;
      suppressions: {
        path: string;
        why: string;
      }[];
    };
  };
}
export interface Paragraphs {
  /**
   * This interface was referenced by `Paragraphs`'s JSON-Schema definition
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
}
