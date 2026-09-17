/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs schema/applicability.schema.json
 * Version: declared in package.json, resolved in package-lock.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

export type RuleId = string;
export type RuleCategory =
  | 'category:definition'
  | 'category:standard'
  | 'category:scope'
  | 'category:display'
  | 'category:classification'
  | 'category:precedence'
  | 'category:conduct'
  | 'category:care'
  | 'category:meta';
/**
 * This interface was referenced by `SituationWhen`'s JSON-Schema definition
 * via the `patternProperty` "^fact:[a-z0-9_]+$".
 *
 * This interface was referenced by `SituationWhen`'s JSON-Schema definition
 * via the `patternProperty` "^(self|other):(fact|kin|geo|hist):[a-z0-9_]+$".
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
  | 'modality:shall'
  | 'modality:may'
  | 'modality:shall-if-practicable'
  | 'modality:conditional'
  | 'modality:exempt'
  | 'modality:shall-not'
  | 'modality:shall-not-impede';
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
      self: EffectRole;
      other: EffectRole;
    }
  | {
      encounter: 'encounter:head-on' | 'encounter:crossing' | 'encounter:overtaking' | 'encounter:none';
    }
  | {
      risk_of_collision: true;
    };
export type EffectRole = 'role:give-way' | 'role:stand-on' | 'role:shall-not-impede' | 'role:keep-clear' | 'role:none';
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
    'modality:shall': string;
    'modality:may': string;
    'modality:shall-if-practicable': string;
    'modality:conditional': string;
    'modality:exempt': string;
    'modality:shall-not': string;
    'modality:shall-not-impede': string;
  };
  categories?: {
    'category:definition': string;
    'category:standard': string;
    'category:scope': string;
    'category:display': string;
    'category:classification': string;
    'category:precedence': string;
    'category:conduct': string;
    'category:care': string;
    'category:meta': string;
  };
  effects?: {
    note?: string;
    roles: {
      'role:give-way': string;
      'role:stand-on': string;
      'role:shall-not-impede': string;
      'role:keep-clear': string;
      'role:none': string;
    };
    encounters?: {
      'encounter:head-on': string;
      'encounter:crossing': string;
      'encounter:overtaking': string;
      'encounter:none': string;
    };
    classification_shape?: string;
  };
  suppressions?: {
    jurisdiction: string;
    suppresses: RuleId;
    cite: string;
    why: string;
  }[];
  known_omissions?: {
    cite: string;
    what: string;
    why: string;
  }[];
  represented_paragraphs?: {
    id: RuleId;
    jurisdiction: string;
    cite: string;
    category: 'category:care' | 'category:meta';
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
