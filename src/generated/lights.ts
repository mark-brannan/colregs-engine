/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs@0.2.0 schema/lights.schema.json
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
 * The Rule 21 lights and Rule 22 visibility ranges. Structure only -- see docs/adr/0006-json-schema-and-identifier-diff.md.
 */
export interface LightsData {
  jurisdiction: string;
  bearing_convention?: {
    zero?: string;
    direction?: string;
    units?: string;
    wrap?: string;
  };
  lights: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^light:[a-z_]+$".
     */
    [k: string]: {
      name: string;
      colregs_term: string;
      cite: string;
      color?: string | null;
      color_note?: string;
      character: string;
      arc_deg?: number | null;
      arc?: {
        from_deg: number;
        to_deg: number;
      } | null;
      placement?: string;
      side?: 'port' | 'starboard';
      composite?: boolean;
      /**
       * @minItems 1
       */
      components?: string[];
      combined_lantern_max_length_m?: number;
      same_characteristics_as?: string;
      flashes_per_minute_min?: number;
      note?: string;
      rule21: boolean;
    };
  };
  visibility?: {
    cite?: string;
    note?: string;
    bands?: {
      cite: string;
      when?: When;
      refines?: string;
      ranges_nm?: {
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^light:[a-z_]+$".
         */
        [k: string]: number;
      };
      overrides_nm?: {
        /**
         * This interface was referenced by `undefined`'s JSON-Schema definition
         * via the `patternProperty` "^light:[a-z_]+$".
         */
        [k: string]: number;
      };
    }[];
  };
  colregs_vocabulary?: string[];
}
export interface When {
  [k: string]: PredicateValue;
}
