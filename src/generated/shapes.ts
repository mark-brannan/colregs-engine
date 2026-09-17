/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs schema/shapes.schema.json
 * Version: declared in package.json, resolved in package-lock.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

/**
 * The day shapes (Rule 20(d), Annex I 6) an applicability entry names by id, with their dimensions and a reference SVG. Structure only -- see docs/adr/0006-json-schema-and-identifier-diff.md.
 */
export interface ShapesData {
  jurisdiction: string;
  note?: string;
  shapes: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^shape:[a-z_]+$".
     */
    [k: string]: {
      term: string;
      cite: string;
      color: string;
      min_diameter_m?: number;
      min_base_diameter_m?: number;
      min_height_m?: number;
      height_equals_diameter?: boolean;
      height_multiple_of_diameter?: number;
      composition?: string;
      /**
       * @minItems 2
       */
      components?: string[];
      same_dimensions_as?: string;
      projection: string;
      svg: string;
      annex1: boolean;
      note?: string;
    };
  };
}
