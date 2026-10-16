/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs schema/others-facts.schema.json
 * Version: declared in package.json, resolved in package-lock.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

/**
 * Other vessels reduced to facts about self's options, per sector around self: the `others` class of a Situation (colregs-engine#82). Not vessels: a Situation stays two-vessel, and these flatten to `others:<sector>:<key>` in the predicate namespace. Every field is pencil until the reduction is written. Structure only.
 */
export interface OthersFactsSchema {
  ahead?: Sector;
  starboard?: Sector;
  astern?: Sector;
  port?: Sector;
}
export interface Sector {
  count?: number;
  nearest_nm?: number;
  foreclosed?: boolean;
}
