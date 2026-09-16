/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs@0.3.1 schema/encounter-evaluation.schema.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

export type RuleIds = string[];
export type SubjectRoles = SubjectRole[];
export type ByEntryList = ByEntry[];

/**
 * The result of evaluateEncounter: two vessels at one instant -- scope, encounter class, risk of collision with its grounds, roles as a set per subject, overrides and modalities (ADR 0011 §4, ADR 0014). Structure only.
 */
export interface EncounterEvaluationSchema {
  colregs: Colregs;
  applied: RuleIds;
  scope: RuleIds;
  encounter?: 'head-on' | 'crossing' | 'overtaking' | 'none';
  risk_of_collision: {
    asserted: boolean;
    by: RuleIds;
  };
  roles: {
    own: SubjectRoles;
    other: SubjectRoles;
  };
  overridden: ByEntryList;
  modalities: Modalities;
  categories: Categories;
  provenance: Provenance;
}
export interface Colregs {
  version: string;
  source: 'resolved' | 'caller';
}
export interface SubjectRole {
  role: 'give-way' | 'stand-on' | 'shall-not-impede' | 'keep-clear' | 'none';
  by: string;
}
export interface ByEntry {
  id: string;
  by: string;
}
export interface Modalities {
  /**
   * This interface was referenced by `Modalities`'s JSON-Schema definition
   * via the `patternProperty` "^rule:[0-9]+[a-z]?(_[ivx]+)*(:[a-z][a-z0-9_]*)?$".
   */
  [k: string]: 'shall' | 'may' | 'shall-if-practicable' | 'conditional' | 'exempt' | 'shall-not' | 'shall-not-impede';
}
export interface Categories {
  /**
   * This interface was referenced by `Categories`'s JSON-Schema definition
   * via the `patternProperty` "^rule:[0-9]+[a-z]?(_[ivx]+)*(:[a-z][a-z0-9_]*)?$".
   */
  [k: string]:
    'definition' | 'standard' | 'scope' | 'display' | 'classification' | 'precedence' | 'conduct' | 'care' | 'meta';
}
export interface Provenance {
  /**
   * Items: This interface was referenced by `Categories`'s JSON-Schema definition
   * via the `patternProperty` "^rule:[0-9]+[a-z]?(_[ivx]+)*(:[a-z][a-z0-9_]*)?$".
   */
  evaluated_categories: (
    'definition' | 'standard' | 'scope' | 'display' | 'classification' | 'precedence' | 'conduct' | 'care' | 'meta'
  )[];
  jurisdictions: string[];
  represented: RepresentedParagraph[];
}
export interface RepresentedParagraph {
  id: string;
  jurisdiction: string;
  cite: string;
  category: 'care' | 'meta';
}
