/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs schema/situation-fixtures.schema.json
 * Version: declared in package.json, resolved in package-lock.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

export type RuleId = string;
export type Modality =
  | 'modality:shall'
  | 'modality:may'
  | 'modality:shall-if-practicable'
  | 'modality:conditional'
  | 'modality:exempt'
  | 'modality:shall-not'
  | 'modality:shall-not-impede';
export type ExpectItem =
  | RuleId
  | {
      entry: RuleId;
      modality: Modality;
    };

/**
 * Two-subject situation fixtures (ADR 0005, REQ-CAT-5). Structure only -- see docs/adr/0006-json-schema-and-identifier-diff.md. A case's situation is schema/situation.schema.json; namespace resolution (every kin:/geo:/hist: key declared in facts.json) stays in the tests.
 */
export interface SituationFixtures {
  note?: string;
  schema: 'situation/1';
  status?: 'ink' | 'pencil' | 'open';
  adr?: string;
  requirements?: string[];
  jurisdiction: string;
  override_note?: string;
  expect_scope?: string;
  expect_form?: {
    note?: string;
    bare?: RuleId;
    with_modality?: {
      entry: RuleId;
      modality: Modality;
    };
  };
  case_status: {
    note?: string;
    /**
     * @minItems 1
     */
    values: ('illustrative' | 'binding')[];
  };
  /**
   * @minItems 1
   */
  cases: {
    name: string;
    status: 'illustrative' | 'binding';
    narrative?: string;
    gap?: string;
    expect_when_modelled?: string[];
    expect: ExpectItem[];
    situation: Situation;
    roles?: {
      self: SubjectRole[];
      other: SubjectRole[];
    };
  }[];
  collapse_note?: string;
  geometry_note?: string;
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
export interface SubjectRole {
  role: 'role:give-way' | 'role:stand-on' | 'role:shall-not-impede' | 'role:keep-clear' | 'role:none';
  by: RuleId;
}
