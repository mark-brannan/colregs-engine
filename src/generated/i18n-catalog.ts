/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs schema/i18n-catalog.schema.json
 * Version: declared in package.json, resolved in package-lock.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

export type Label = string;

/**
 * Display catalog for one BCP 47 language: UI strings for identifier vocabularies (light names, fact-axis labels, modality labels, image captions), not legal text -- see docs/adr/0003-language-as-a-dimension.md 'Display catalogs'.
 */
export interface I18NCatalogData {
  /**
   * BCP 47 tag, e.g. en, fi. Must equal the filename stem; test/data.test.mjs checks.
   */
  language: string;
  provenance: {
    /**
     * @minItems 1
     */
    contributors: string[];
    /**
     * Named human reviewers. Empty means unreviewed: the strings are on file but not yet vouched for.
     */
    reviewed_by: string[];
    review_date: string;
    /**
     * Optional until the data licence question (Q-9) is ruled; absent means the package licence applies.
     */
    licence?: string;
  };
  /**
   * One section per vocabulary. Every section is keyed by the identifier itself, as documented in docs/identifiers.md -- light identifiers (light:) and closed-vocabulary identifiers (modality:, and any of role:/encounter:/category: that gain a catalog section) alike, as stored in data/applicability.json. Values are static strings: no interpolation, no plurals -- the consumer's i18n system owns composition.
   */
  strings: {
    light?: {
      [k: string]: Label;
    };
    modality?: {
      [k: string]: Label;
    };
  };
}
