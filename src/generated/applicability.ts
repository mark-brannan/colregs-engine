/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs@0.1.2 schema/applicability.schema.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

export type EntryId = string;
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
export type Modality =
  'shall' | 'may' | 'shall-if-practicable' | 'conditional' | 'exempt' | 'shall-not' | 'shall-not-impede';
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
  /**
   * @minItems 1
   */
  entries: {
    id: EntryId;
    jurisdiction: string;
    cite: string;
    when: When;
    lights: LightRef[];
    modality: Modality;
    modality_by?: ModalityBy;
    /**
     * @minItems 1
     */
    images?: string[];
    notes?: string;
    'rel:includes'?: EntryIdList;
    /**
     * @minItems 1
     */
    'rel:conditional_includes'?: ConditionalInclude[];
    'rel:in_lieu_of'?: EntryIdList;
    'rel:excludes'?: EntryIdList;
    'rel:exempts'?: EntryIdList;
  }[];
}
export interface When {
  [k: string]: PredicateValue;
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
