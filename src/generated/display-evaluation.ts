/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs schema/display-evaluation.schema.json (version pinned in package.json)
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

export type RuleIds = string[];
export type ByEntryList = ByEntry[];

/**
 * The result of evaluateDisplay: every complete lawful display for one vessel, alternatives unresolved (REQ-MODEL-8), with the data it was read against (ADR 0011 §1, ADR 0014). Structure only; the $defs shared with the other envelopes live in schema/evaluation.schema.json.
 */
export interface DisplayEvaluationSchema {
  colregs: Colregs;
  applied: RuleIds;
  exempted: ByEntryList;
  excluded: ByEntryList;
  overridden: ByEntryList;
  displays: Display[];
  optional_additions: Items[];
  /**
   * @deprecated
   */
  optionalAdditions?: Items[];
  modalities: Modalities;
  categories: Categories;
  provenance: Provenance;
}
export interface Colregs {
  version: string;
  source: 'resolved' | 'caller';
}
export interface ByEntry {
  id: string;
  by: string;
}
export interface Display {
  entries: RuleIds;
  lights: DisplayLight[];
  chosen: string[];
}
export interface DisplayLight {
  spec: LightRef;
  source_entry: string;
  /**
   * @deprecated
   */
  sourceEntry?: string;
  via?: string;
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
export interface Items {
  id: string;
  via?: string;
  lights: DisplayLight[];
  cite: string;
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
  category: 'category:care' | 'category:meta';
}
