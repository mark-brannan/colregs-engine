/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs@0.3.1 schema/applicability.schema.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

export type RuleId = string;
export type RuleCategory =
  'definition' | 'standard' | 'scope' | 'display' | 'classification' | 'precedence' | 'conduct' | 'care' | 'meta';
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
export type RuleIdList = RuleId[];

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
    id: RuleId;
    jurisdiction: string;
    cite: string;
    category: 'care' | 'meta';
    note: string;
  }[];
  /**
   * @minItems 1
   */
  entries: {
    id: RuleId;
    jurisdiction: string;
    cite: string;
    category?: RuleCategory;
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
    'rel:includes'?: RuleIdList;
    /**
     * @minItems 1
     */
    'rel:conditional_includes'?: ConditionalInclude[];
    'rel:in_lieu_of'?: RuleIdList;
    'rel:excludes'?: RuleIdList;
    'rel:exempts'?: RuleIdList;
    'rel:overrides'?: RuleIdList;
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
  one_of?: RuleId[];
  /**
   * @minItems 1
   */
  'rel:includes'?: RuleId[];
  cite?: string;
}
