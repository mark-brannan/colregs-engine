/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs@0.2.0 schema/applicability.schema.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

export type EntryId = string;
/**
 * This interface was referenced by `SituationWhen`'s JSON-Schema definition
 * via the `patternProperty` "^fact:[a-z0-9_]+$".
 *
 * This interface was referenced by `SituationWhen`'s JSON-Schema definition
 * via the `patternProperty` "^(own|other):(fact|kin|geo|hist):[a-z0-9_]+$".
 *
 * This interface was referenced by `SituationWhen`'s JSON-Schema definition
 * via the `patternProperty` "^pair:(geo|env):[a-z0-9_]+$".
 *
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
  | string[]
  | {
      not: PredicateValue;
    }
  | {
      /**
       * @minItems 1
       */
      any_of: PredicateValue[];
    };
export type Modality =
  'shall' | 'may' | 'shall-if-practicable' | 'conditional' | 'exempt' | 'shall-not' | 'shall-not-impede';
export type Effect =
  | {
      part: string;
      section: string;
      /**
       * @minItems 1
       */
      applies_rules: string[];
    }
  | {
      own: EffectRole;
      other: EffectRole;
    }
  | {
      encounter: 'head-on' | 'crossing' | 'overtaking' | 'none';
    }
  | {
      risk_of_collision: true;
    };
export type EffectRole = 'give-way' | 'stand-on' | 'shall-not-impede' | 'keep-clear' | 'none';
/**
 * @minItems 1
 */
export type ModalityBy = {
  when: When;
  modality: Modality;
}[];
/**
 * @minItems 1
 */
export type EntryIdList = EntryId[];

/**
 * predicate -> lights, per entry, with modality, citation and jurisdiction. Structure only -- see docs/adr/0006-json-schema-and-identifier-diff.md.
 */
export interface ApplicabilityData {
  conditions?: string;
  relations?: {
    'rel:includes': string;
    'rel:conditional_includes': string;
    'rel:in_lieu_of': string;
    'rel:excludes': string;
    'rel:exempts': string;
    'rel:overrides': string;
  };
  modalities?: {
    shall: string;
    may: string;
    'shall-if-practicable': string;
    conditional: string;
    exempt: string;
    'shall-not': string;
    'shall-not-impede': string;
  };
  categories?: {
    definition: string;
    standard: string;
    scope: string;
    display: string;
    classification: string;
    precedence: string;
    conduct: string;
    care: string;
    meta: string;
  };
  effects?: {
    note?: string;
    roles: {
      'give-way': string;
      'stand-on': string;
      'shall-not-impede': string;
      'keep-clear': string;
      none: string;
    };
    encounters?: {
      'head-on': string;
      crossing: string;
      overtaking: string;
      none: string;
    };
    classification_shape?: string;
  };
  known_omissions?: {
    cite: string;
    what: string;
    why: string;
  }[];
  represented_paragraphs?: {
    id: EntryId;
    jurisdiction: string;
    cite: string;
    category: 'care' | 'meta';
    note: string;
  }[];
  retired_entry_ids?: {
    note?: string;
    ids: {
      [k: string]: string;
    };
  };
  /**
   * @minItems 1
   */
  entries: {
    id: EntryId;
    jurisdiction: string;
    cite: string;
    category?:
      'definition' | 'standard' | 'scope' | 'display' | 'classification' | 'precedence' | 'conduct' | 'care' | 'meta';
    subjects?: 2;
    when: SituationWhen;
    lights?: LightRef[];
    effect?: Effect;
    modality: Modality;
    modality_by?: ModalityBy;
    /**
     * @minItems 1
     */
    images?: string[];
    notes?: string;
    note?: string;
    gap?: string;
    no_gate_note?: string;
    'rel:includes'?: EntryIdList;
    /**
     * @minItems 1
     */
    'rel:conditional_includes'?: ConditionalInclude[];
    'rel:in_lieu_of'?: EntryIdList;
    'rel:excludes'?: EntryIdList;
    'rel:exempts'?: EntryIdList;
    'rel:overrides'?: EntryIdList;
  }[];
}
export interface SituationWhen {
  /**
   * @minItems 1
   */
  any_of?: SituationWhen[];
  [k: string]: PredicateValue | SituationWhen[] | undefined;
}
export interface LightRef {
  light: string;
  position?: string;
  count?: number;
  color?: string;
  character?: string;
  intensity?: string;
  arrangement?: 'vertical';
  combined?: boolean;
  note?: string;
  modality?: Modality;
}
export interface When {
  /**
   * @minItems 1
   */
  any_of?: When[];
  [k: string]: PredicateValue | When[] | undefined;
}
export interface ConditionalInclude {
  when?: When;
  /**
   * @minItems 2
   */
  one_of?: EntryId[];
  /**
   * @minItems 1
   */
  'rel:includes'?: EntryId[];
  cite?: string;
}
