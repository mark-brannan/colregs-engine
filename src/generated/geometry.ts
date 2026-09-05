/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs@0.1.2 schema/geometry.schema.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

/**
 * This interface was referenced by `When`'s JSON-Schema definition
 * via the `patternProperty` "^fact:[a-z0-9_]+$".
 */
export type PredicateValue =
  | {
      gte?: number;
      gt?: number;
      lte?: number;
      lt?: number;
    }
  | string
  | boolean
  | string[];

/**
 * Annex I positioning, shapes, colour and intensity. Structure only -- see docs/adr/0006-json-schema-and-identifier-diff.md.
 */
export interface GeometryData {
  jurisdiction: string;
  source?: string;
  note?: string;
  /**
   * @minItems 1
   */
  vertical_positioning: PositioningEntry[];
  /**
   * @minItems 1
   */
  horizontal_positioning: PositioningEntry[];
  direction_indicating?: {
    cite: string;
    /**
     * @minItems 1
     */
    applies_to_entries?: string[];
    horizontal_from_identity_lights_m?: Range;
    horizontal_from_ram_lights_m?: Range;
    vertical?: string;
    text: string;
  }[];
  shapes: {
    cite: string;
    color: string;
    ball?: {
      min_diameter_m?: number;
      cite?: string;
    };
    cone?: {
      min_base_diameter_m?: number;
      height_equals_diameter?: boolean;
      cite?: string;
    };
    cylinder?: {
      min_diameter_m?: number;
      height_multiple_of_diameter?: number;
      cite?: string;
    };
    diamond?: {
      composition?: string;
      cite?: string;
    };
    vertical_spacing_min_m?: number;
    small_vessel_relief?: {
      when?: When;
      text?: string;
    };
  };
  colors: {
    cite: string;
    standard: string;
    chromaticity_corners: {
      [k: string]: {
        /**
         * @minItems 3
         */
        x: number[];
        /**
         * @minItems 3
         */
        y: number[];
      };
    };
  };
  intensity: {
    cite: string;
    formula: string;
    terms: {
      [k: string]: string;
    };
    table_cd_by_range_nm: {
      [k: string]: number;
    };
  };
  sectors?: {
    cite?: string;
    horizontal?: {
      [k: string]: string;
    };
  };
}
export interface PositioningEntry {
  cite: string;
  light?: string;
  which?: string;
  when?: When;
  datum?: string;
  datum_secondary?: string;
  constraint?: string;
  combined?: boolean;
  equal_spacing?: boolean;
  min_m?: number | null;
  max_m?: number;
  min_above_sidelights_m?: number;
  min_below_m?: number;
  min_spacing_m?: number;
  min_multiple_of_pair_spacing?: number;
  max_fraction_of_masthead_height?: number;
  min_fraction_of_length?: number;
  need_not_exceed_m?: number;
  forward_light_max_fraction_of_length_from_stem?: number;
  min_offset_from_centerline_m?: number;
  also?:
    | string
    | {
        when?: When;
        datum?: string;
        min_m?: number;
      };
  lowest_light?: {
    datum?: string;
    min_m?: number;
    except?: string;
  };
  /**
   * @minItems 1
   */
  applies_to_entries?: string[];
  text: string;
}
export interface When {
  [k: string]: PredicateValue;
}
export interface Range {
  min?: number;
  max?: number;
}
