/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs schema/encounter-evaluation.schema.json
 * Version: declared in package.json, resolved in package-lock.json
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
  encounter?: 'encounter:head-on' | 'encounter:crossing' | 'encounter:overtaking' | 'encounter:none';
  risk_of_collision: {
    asserted: boolean;
    by: RuleIds;
  };
  roles: {
    self: SubjectRoles;
    other: SubjectRoles;
  };
  overridden: ByEntryList;
  modalities: Modalities;
  categories: Categories;
  provenance: Provenance;
  signals?: EncounterSignal[];
}
export interface Colregs {
  version: string;
  source: 'resolved' | 'caller';
}
export interface SubjectRole {
  role: 'role:give-way' | 'role:stand-on' | 'role:shall-not-impede' | 'role:keep-clear' | 'role:none';
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
  [k: string]:
    | 'modality:shall'
    | 'modality:may'
    | 'modality:shall-if-practicable'
    | 'modality:conditional'
    | 'modality:exempt'
    | 'modality:shall-not'
    | 'modality:shall-not-impede';
}
export interface Categories {
  /**
   * This interface was referenced by `Categories`'s JSON-Schema definition
   * via the `patternProperty` "^rule:[0-9]+[a-z]?(_[ivx]+)*(:[a-z][a-z0-9_]*)?$".
   */
  [k: string]:
    | 'category:definition'
    | 'category:standard'
    | 'category:scope'
    | 'category:display'
    | 'category:classification'
    | 'category:precedence'
    | 'category:conduct'
    | 'category:care'
    | 'category:meta';
}
export interface Provenance {
  /**
   * Items: This interface was referenced by `Categories`'s JSON-Schema definition
   * via the `patternProperty` "^rule:[0-9]+[a-z]?(_[ivx]+)*(:[a-z][a-z0-9_]*)?$".
   */
  evaluated_categories: (
    | 'category:definition'
    | 'category:standard'
    | 'category:scope'
    | 'category:display'
    | 'category:classification'
    | 'category:precedence'
    | 'category:conduct'
    | 'category:care'
    | 'category:meta'
  )[];
  jurisdictions: string[];
  represented: RepresentedParagraph[];
}
export interface RepresentedParagraph {
  id: string;
  jurisdiction: string;
  cite: string;
  category:
    | 'category:care'
    | 'category:meta'
    | 'category:scope'
    | 'category:definition'
    | 'category:standard'
    | 'category:display';
}
export interface EncounterSignal {
  spec: SignalRef;
  source_entry: string;
  cite?: string;
  /**
   * This interface was referenced by `Modalities`'s JSON-Schema definition
   * via the `patternProperty` "^rule:[0-9]+[a-z]?(_[ivx]+)*(:[a-z][a-z0-9_]*)?$".
   */
  modality:
    | 'modality:shall'
    | 'modality:may'
    | 'modality:shall-if-practicable'
    | 'modality:conditional'
    | 'modality:exempt'
    | 'modality:shall-not'
    | 'modality:shall-not-impede';
}
export interface SignalRef {
  /**
   * @minItems 1
   */
  sequence: SignalElement[];
  repeat?: {
    max_interval_s?: number;
    min_interval_s?: number;
  };
  gap_s?: number;
  rapid?: boolean;
  note?: string;
  /**
   * This interface was referenced by `Modalities`'s JSON-Schema definition
   * via the `patternProperty` "^rule:[0-9]+[a-z]?(_[ivx]+)*(:[a-z][a-z0-9_]*)?$".
   */
  modality?:
    | 'modality:shall'
    | 'modality:may'
    | 'modality:shall-if-practicable'
    | 'modality:conditional'
    | 'modality:exempt'
    | 'modality:shall-not'
    | 'modality:shall-not-impede';
}
export interface SignalElement {
  element: string;
  count?: number;
  at_least?: boolean;
  duration_s?: number;
  gap_s?: number;
  placement?: string;
  note?: string;
}
