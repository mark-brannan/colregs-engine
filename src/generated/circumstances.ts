/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs schema/circumstances.schema.json
 * Version: declared in package.json, resolved in package-lock.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

export type Known = 'in-sight' | 'radar-alone' | 'heard';

/**
 * The input evaluate reads, the unified form beside the three operations: self, the other vessels as self knows each of them, and the conditions of the water, at one instant. Straw man: the shape may change. Structure only -- every fact, kin:, geo:, hist:, act: and env: key is declared in data/facts.json, checked in the tests.
 */
export interface CircumstancesSchema {
  self?: Vessel;
  others?: Other[];
  conditions?: EnvRecord;
}
export interface Vessel {
  fact: FactRecord;
  kin?: KinRecord;
  geo?: GeoRecord;
  hist?: HistRecord;
  act?: ActRecord;
}
/**
 * What a consumer asserts about one vessel at one moment: the input evaluateSignals reads (ADR 0011 §2, ADR 0014). Structure only -- which fact keys exist and which values each takes is data/facts.json's, checked in the tests; see docs/adr/0006-json-schema-and-identifier-diff.md.
 */
export interface FactRecord {
  /**
   * This interface was referenced by `FactRecord`'s JSON-Schema definition
   * via the `patternProperty` "^fact:[a-z0-9_]+$".
   */
  [k: string]: string | number | boolean;
}
export interface KinRecord {
  /**
   * This interface was referenced by `KinRecord`'s JSON-Schema definition
   * via the `patternProperty` "^kin:[a-z0-9_]+$".
   *
   * This interface was referenced by `GeoRecord`'s JSON-Schema definition
   * via the `patternProperty` "^geo:[a-z0-9_]+$".
   *
   * This interface was referenced by `HistRecord`'s JSON-Schema definition
   * via the `patternProperty` "^hist:[a-z0-9_]+$".
   *
   * This interface was referenced by `ActRecord`'s JSON-Schema definition
   * via the `patternProperty` "^act:[a-z0-9_]+$".
   *
   * This interface was referenced by `EnvRecord`'s JSON-Schema definition
   * via the `patternProperty` "^env:[a-z0-9_]+$".
   */
  [k: string]:
    | string
    | number
    | boolean
    | null
    | {
        latitude: number;
        longitude: number;
      };
}
export interface GeoRecord {
  /**
   * This interface was referenced by `KinRecord`'s JSON-Schema definition
   * via the `patternProperty` "^kin:[a-z0-9_]+$".
   *
   * This interface was referenced by `GeoRecord`'s JSON-Schema definition
   * via the `patternProperty` "^geo:[a-z0-9_]+$".
   *
   * This interface was referenced by `HistRecord`'s JSON-Schema definition
   * via the `patternProperty` "^hist:[a-z0-9_]+$".
   *
   * This interface was referenced by `ActRecord`'s JSON-Schema definition
   * via the `patternProperty` "^act:[a-z0-9_]+$".
   *
   * This interface was referenced by `EnvRecord`'s JSON-Schema definition
   * via the `patternProperty` "^env:[a-z0-9_]+$".
   */
  [k: string]:
    | string
    | number
    | boolean
    | null
    | {
        latitude: number;
        longitude: number;
      };
}
export interface HistRecord {
  /**
   * This interface was referenced by `KinRecord`'s JSON-Schema definition
   * via the `patternProperty` "^kin:[a-z0-9_]+$".
   *
   * This interface was referenced by `GeoRecord`'s JSON-Schema definition
   * via the `patternProperty` "^geo:[a-z0-9_]+$".
   *
   * This interface was referenced by `HistRecord`'s JSON-Schema definition
   * via the `patternProperty` "^hist:[a-z0-9_]+$".
   *
   * This interface was referenced by `ActRecord`'s JSON-Schema definition
   * via the `patternProperty` "^act:[a-z0-9_]+$".
   *
   * This interface was referenced by `EnvRecord`'s JSON-Schema definition
   * via the `patternProperty` "^env:[a-z0-9_]+$".
   */
  [k: string]:
    | string
    | number
    | boolean
    | null
    | {
        latitude: number;
        longitude: number;
      };
}
export interface ActRecord {
  /**
   * This interface was referenced by `KinRecord`'s JSON-Schema definition
   * via the `patternProperty` "^kin:[a-z0-9_]+$".
   *
   * This interface was referenced by `GeoRecord`'s JSON-Schema definition
   * via the `patternProperty` "^geo:[a-z0-9_]+$".
   *
   * This interface was referenced by `HistRecord`'s JSON-Schema definition
   * via the `patternProperty` "^hist:[a-z0-9_]+$".
   *
   * This interface was referenced by `ActRecord`'s JSON-Schema definition
   * via the `patternProperty` "^act:[a-z0-9_]+$".
   *
   * This interface was referenced by `EnvRecord`'s JSON-Schema definition
   * via the `patternProperty` "^env:[a-z0-9_]+$".
   */
  [k: string]:
    | string
    | number
    | boolean
    | null
    | {
        latitude: number;
        longitude: number;
      };
}
export interface Other {
  known: Known;
  bearing_deg?: number;
  range_nm?: number;
  fact?: FactRecord;
  observed?: Observed;
  kin?: KinRecord;
  geo?: GeoRecord;
  act?: ActRecord;
  hist?: HistRecord;
}
export interface Observed {
  lights?: string[];
  shapes?: string[];
  sounds?: string[];
}
export interface EnvRecord {
  /**
   * This interface was referenced by `KinRecord`'s JSON-Schema definition
   * via the `patternProperty` "^kin:[a-z0-9_]+$".
   *
   * This interface was referenced by `GeoRecord`'s JSON-Schema definition
   * via the `patternProperty` "^geo:[a-z0-9_]+$".
   *
   * This interface was referenced by `HistRecord`'s JSON-Schema definition
   * via the `patternProperty` "^hist:[a-z0-9_]+$".
   *
   * This interface was referenced by `ActRecord`'s JSON-Schema definition
   * via the `patternProperty` "^act:[a-z0-9_]+$".
   *
   * This interface was referenced by `EnvRecord`'s JSON-Schema definition
   * via the `patternProperty` "^env:[a-z0-9_]+$".
   */
  [k: string]:
    | string
    | number
    | boolean
    | null
    | {
        latitude: number;
        longitude: number;
      };
}
