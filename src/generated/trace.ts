/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs schema/trace.schema.json
 * Version: declared in package.json, resolved in package-lock.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

/**
 * The situation over time: the window evaluateConduct reads (ADR 0012 §2, ADR 0014). A conforming implementation rejects an empty samples list, a `t_s` that does not strictly increase, and `other` present in some samples and absent in others; `t_s` is seconds on the caller's clock, read as differences only, and the pair's identity is the caller's, since a Situation names no vessel. Structure only.
 */
export interface TraceSchema {
  /**
   * @minItems 1
   */
  samples: {
    t_s: number;
    situation: Situation;
  }[];
}
/**
 * Two vessels and the encounter at one instant: the input evaluateEncounter reads, nested by subject and class (ADR 0005 §2, ADR 0011 §3, ADR 0014). Structure only -- every kin:/geo:/hist:/env: key must be declared in data/facts.json §situation, checked in the tests.
 */
export interface Situation {
  self: Subject;
  other?: Subject;
  pair?: {
    geo?: GeoRecord;
    env?: EnvRecord;
  };
}
export interface Subject {
  fact: FactRecord;
  kin?: KinRecord;
  geo?: GeoRecord;
  hist?: HistRecord;
}
/**
 * What a consumer asserts about one vessel at one moment: the input evaluateDisplay reads (ADR 0011 §2, ADR 0014). Structure only -- which fact keys exist and which values each takes is data/facts.json's, checked in the tests; see docs/adr/0006-json-schema-and-identifier-diff.md.
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
