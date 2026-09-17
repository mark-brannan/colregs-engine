/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs schema/editions.schema.json
 * Version: declared in package.json, resolved in package-lock.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

/**
 * Registry of instruments and their editions, per jurisdiction: the layer GATE-2 asked for. The skeleton names the edition it consolidates; every corpus names the edition its text reflects; two editions of one jurisdiction may be registered at once. See docs/adr/0013-corpus-files-with-editions.md.
 */
export interface EditionsData {
  note?: string;
  jurisdictions: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^[a-z]+(/[a-z]+)*$".
     */
    [k: string]: {
      instrument: string;
      skeleton: null | string;
      editions: {
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^[a-z]+(/[a-z]+)*@[a-z0-9-]+$".
         */
        [k: string]: {
          amended_through: string;
          in_force: string;
          superseded_by?: string;
          note?: string;
        };
      };
    };
  };
}
