/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs schema/sounds.schema.json
 * Version: declared in package.json, resolved in package-lock.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

export type Appliance = 'appliance:whistle' | 'appliance:bell' | 'appliance:gong' | 'appliance:light';
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
  | boolean;

/**
 * The Part D signal elements and Rule 33's carriage thresholds. Structure only -- see docs/adr/0006-json-schema-and-identifier-diff.md.
 */
export interface SoundsData {
  jurisdiction: string;
  note?: string;
  elements: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^(sound|flash):[a-z_]+$".
     */
    [k: string]: {
      term: string;
      cite: string;
      appliance: Appliance;
      duration_s?: Duration;
      gap_s?: Duration;
      light?: string;
      color?: string;
      arc_deg?: number;
      range_nm?: number;
      note?: string;
    };
  };
  appliances?: {
    note?: string;
    cite: string;
    /**
     * @minItems 1
     */
    carriage: {
      appliance: Appliance;
      cite: string;
      when: When;
      alternative?: string;
      note?: string;
    }[];
    fallback?: {
      cite: string;
      when: When;
      requirement: string;
    };
  };
  colregs_vocabulary?: string[];
}
export interface Duration {
  about?: number;
  min?: number;
  max?: number;
}
export interface When {
  [k: string]: PredicateValue;
}
