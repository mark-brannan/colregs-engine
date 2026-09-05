/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs@0.1.2 schema/facts.schema.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

export type FactValue = string;
export type FactKey = string;

/**
 * The input vocabulary a fact record is evaluated against. Structure only -- see docs/adr/0006-json-schema-and-identifier-diff.md.
 */
export interface FactsData {
  note?: string;
  axes: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^fact:[a-z0-9_]+$".
     */
    [k: string]: {
      /**
       * @minItems 1
       */
      values: FactValue[];
      cites?: {
        [k: string]: string;
      };
      note?: string;
    };
  };
  modifiers?: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^fact:[a-z0-9_]+$".
     */
    [k: string]: {
      type: 'boolean' | 'number' | 'string';
      refines?: string;
      note?: string;
      actuable?: boolean;
    };
  };
  numerics?: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^fact:[a-z0-9_]+$".
     */
    [k: string]: {
      type: 'number';
      unit?: string;
      cite: string;
      note?: string;
      actuable?: boolean;
      signalk?: string | null;
    };
  };
  booleans?: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^fact:[a-z0-9_]+$".
     */
    [k: string]: {
      cite: string;
      actuable: boolean;
      note?: string;
    };
  };
  enums?: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^fact:[a-z0-9_]+$".
     */
    [k: string]: {
      /**
       * @minItems 1
       */
      values: FactValue[];
      cite: string;
      actuable?: boolean;
    };
  };
  actuable_subset?: {
    note?: string;
    fields?: FactKey[];
  };
  signalk_navigation_state?: {
    source?: string;
    verified?: string;
    decode?: {
      [k: string]: {
        'fact:propulsion'?: FactValue;
        'fact:activity'?: FactValue;
        'fact:position'?: FactValue;
        'fact:tow_length_m'?: NumericGate;
        also_activity?: FactValue;
        annex_ii_signal?: string;
      };
    };
    undecodable?: string[];
    lossy?: {
      what: string;
      why: string;
      cite?: string;
    }[];
  };
  situation?: {
    note?: string;
    status?: 'ink' | 'pencil' | 'open';
    adr?: string;
    requirements?: string[];
    pencil?: string;
    namespace: {
      form: string;
      doc?: string;
      subjects: {
        own: string;
        other: string;
        pair: string;
      };
      classes: {
        fact: string;
        kin: string;
        geo: string;
        hist: string;
      };
      bare_key?: string;
      directional_note?: string;
    };
    kinematics: {
      note?: string;
      [k: string]: SituationFact | string | undefined;
    };
    geometry: {
      note?: string;
      directional: {
        note?: string;
        [k: string]: SituationFact | string | undefined;
      };
      symmetric: {
        note?: string;
        [k: string]: SituationFact | string | undefined;
      };
    };
    history: {
      note?: string;
      [k: string]: SituationFact | string | undefined;
    };
    record: {
      note?: string;
      shape: {
        own: {
          fact?: string;
          kin?: string;
          geo?: string;
          hist?: string;
        };
        other: {
          fact?: string;
          kin?: string;
          geo?: string;
          hist?: string;
        };
        pair: {
          geo?: string;
        };
      };
    };
  };
}
export interface NumericGate {
  gte?: number;
  gt?: number;
  lte?: number;
  lt?: number;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^kin:[a-z0-9_]+$".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^geo:[a-z0-9_]+$".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^geo:[a-z0-9_]+$".
 *
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` "^hist:[a-z0-9_]+$".
 */
export interface SituationFact {
  type: 'number' | 'boolean' | 'enum' | 'position';
  unit?: string;
  /**
   * @minItems 1
   */
  values?: FactValue[];
  cite: string | null;
  cite_pending: string | null;
  note?: string;
  actuable: boolean;
  signalk?: string | null;
}
