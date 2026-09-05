/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs@0.1.2 schema/deprecated-identifiers.schema.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

/**
 * REQ-MODEL-11's deprecation registry: every retired identifier, what it denoted, the version that deprecated it, and its replacement where one exists. Keys are the same prefixed forms the identifier diff compares (test/data.test.mjs's extractIdentifiers) -- e.g. 'entry:25d2', 'paragraph:27(a)(i)', 'light:masthead', 'fact-key:activity', 'fact-value:activity:nuc', 'rel:includes'. Structure only -- see docs/adr/0006-json-schema-and-identifier-diff.md.
 */
export interface DeprecatedIdentifiers {
  [k: string]: {
    /**
     * What the identifier meant, so a consumer pinned to an old version can resolve a stale reference without the identifier itself.
     */
    denoted: string;
    /**
     * The released version that deprecated this identifier (REQ-MODEL-10).
     */
    deprecated_in: string;
    /**
     * The identifier that replaces this one, in the same prefixed form, or null where nothing replaces it.
     */
    replacement?: string | null;
  };
}
