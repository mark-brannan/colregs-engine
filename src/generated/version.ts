/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs schema/version.schema.json
 * Version: declared in package.json, resolved in package-lock.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

/**
 * The single version stamp for all of data/ and fixtures/, mirroring package.json's version at release time. One source of truth -- see docs/adr/0009-data-version-stamp.md (release-please's extra-files generic JSON updater keeps this in sync; never hand-edit). Structure only -- see docs/adr/0006-json-schema-and-identifier-diff.md.
 */
export interface VersionData {
  /**
   * Matches package.json's version at release time (REQ-VERIFY; docs/adr/0009-data-version-stamp.md). Not hand-edited -- release-please's extra-files JSON updater stamps it on every release.
   */
  version: string;
}
