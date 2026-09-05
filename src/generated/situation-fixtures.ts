/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs@0.1.2 schema/situation-fixtures.schema.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

export type EntryId = string;
export type Modality = 'shall' | 'may' | 'shall-if-practicable' | 'conditional' | 'exempt';
export type ExpectItem =
  | EntryId
  | {
      entry: EntryId;
      modality: Modality;
    };
/**
 * This interface was referenced by `FactRecord`'s JSON-Schema definition
 * via the `patternProperty` "^fact:[a-z0-9_]+$".
 *
 * This interface was referenced by `KinRecord`'s JSON-Schema definition
 * via the `patternProperty` "^kin:[a-z0-9_]+$".
 *
 * This interface was referenced by `GeoRecord`'s JSON-Schema definition
 * via the `patternProperty` "^geo:[a-z0-9_]+$".
 *
 * This interface was referenced by `HistRecord`'s JSON-Schema definition
 * via the `patternProperty` "^hist:[a-z0-9_]+$".
 */
export type Scalar =
  | string
  | number
  | boolean
  | null
  | {
      latitude: number;
      longitude: number;
    };

/**
 * Two-subject situation fixtures (ADR 0005, REQ-CAT-5). Structure only -- see docs/adr/0006-json-schema-and-identifier-diff.md. Namespace resolution (every kin:/geo:/hist: key declared in facts.json) stays in the tests.
 */
export interface SituationFixtures {
  note?: string;
  schema: 'situation/1';
  status?: 'ink' | 'pencil' | 'open';
  adr?: string;
  requirements?: string[];
  jurisdiction: string;
  expect_form?: {
    note?: string;
    bare?: EntryId;
    with_modality?: {
      entry: EntryId;
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
    situation: {
      own: Vessel;
      other?: Vessel;
      pair?: {
        geo?: GeoRecord;
      };
    };
  }[];
}
export interface Vessel {
  fact: FactRecord;
  kin?: KinRecord;
  geo?: GeoRecord;
  hist?: HistRecord;
}
export interface FactRecord {
  [k: string]: Scalar;
}
export interface KinRecord {
  [k: string]: Scalar;
}
export interface GeoRecord {
  [k: string]: Scalar;
}
export interface HistRecord {
  [k: string]: Scalar;
}
