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
 * Display catalog for one BCP 47 language: UI strings for the closed vocabularies the package emits (lights, shapes, modalities, roles, encounters, jurisdictions, closed-list fact values), not legal text -- see docs/adr/0003-language-as-a-dimension.md 'Display catalogs' and REQ-LANG-6.
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
   * One section per vocabulary (REQ-LANG-6, REQ-LANG-9's ruling docs/adr/0017). Every section is keyed by the identifier itself, as documented in docs/identifiers.md -- light, modality, role and encounter identifiers carry a type prefix; jurisdiction and closed-list fact values are keyed by their own bare or fact-prefixed form. Values are static strings: no interpolation, no plurals -- the consumer's i18n system owns composition.
   */
  strings: {
    lights?: {
      [k: string]: Label;
    };
    shapes?: {
      [k: string]: Label;
    };
    modalities?: {
      [k: string]: Label;
    };
    roles?: {
      [k: string]: Label;
    };
    encounters?: {
      [k: string]: Label;
    };
    jurisdictions?: {
      [k: string]: Label;
    };
    /**
     * Closed-list fact-value labels only (Tier A): propulsion, activity, position, rule18_class, dynamics, obstruction_side, wind_side. Field names (fact:length_m, geo:tcpa_s, ...) have no closed list behind them and are never catalogued here -- form-label text and unit/number formatting are the consumer's.
     */
    facts?: {
      [k: string]: Label;
    };
  };
}
