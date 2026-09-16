/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs@0.3.2 schema/corpus.schema.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

/**
 * One rule-text corpus: the words of one edition of one jurisdiction's rules, in one language, from one source, keyed by paragraph path into data/rules.json. Verbatim unless withheld under a licence bar. See docs/adr/0003-language-as-a-dimension.md, docs/adr/0010-text-withheld-jurisdictions.md and docs/adr/0013-corpus-files-with-editions.md.
 */
export type CorpusData = {
  id: string;
  edition: string;
  edition_status: 'verified' | 'claimed' | 'unknown';
  language: string;
  source_id: string;
  tier: 'authentic' | 'official' | 'national' | 'community';
  normalization: 'NFC' | 'NFD' | 'NFKC' | 'NFKD';
  translation_of?: string;
  source: {
    publisher: string;
    title: string;
    edition?: string;
    published?: Date;
    effective?: Date;
    url: string;
    retrieved: null | Date;
  };
  rights: {
    source_text: string;
    redistribution_basis: string;
    attribution?: string;
    package_licence: string;
    /**
     * @minItems 1
     */
    contributors?: string[];
    /**
     * @minItems 1
     */
    reviewers?: string[];
  };
  note?: string;
  gaps?: {
    path: Path;
    reason: string;
  }[];
  paragraphs: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^[0-9]+(\([a-z]\))?(\([ivx]+\))?$".
     */
    [k: string]: {
      rule_title: string;
      text?: string;
      text_status?: 'verbatim' | 'withheld';
      withheld_reason?: string;
      /**
       * @minItems 1
       */
      text_slug?: string[];
      text_digest?: string;
      mirrors?: string;
    };
  };
};
export type Date = string;
export type Path = string;
