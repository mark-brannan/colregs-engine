/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs@0.3.0 schema/corpora.schema.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

/**
 * Index of the text corpora under data/text/: which exist, where each lives, and how many paragraphs it covers. Derived from the corpus files and checked against them by test/data.test.mjs; a consumer that cannot list a directory reads this instead. See docs/adr/0013-corpus-files-with-editions.md.
 */
export interface CorporaData {
  note?: string;
  corpora: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^[a-z]+(/[a-z]+)*@[a-z0-9-]+\.[A-Za-z0-9-]+\.[a-z0-9]+$".
     */
    [k: string]: {
      file: string;
      edition: string;
      edition_status: 'verified' | 'claimed' | 'unknown';
      language: string;
      source_id: string;
      tier: 'authentic' | 'official' | 'national' | 'community';
      paragraphs: number;
    };
  };
}
