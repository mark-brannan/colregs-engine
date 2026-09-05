// Types over the colregs data files. The package is data-only (no runtime,
// no types), so the shapes are declared here, against the published schema.

export type FactValue = string | number | boolean;

/** A fact record: what the user has asserted about one vessel at one moment. */
export type FactRecord = Record<string, FactValue>;

export interface NumericConstraint {
  gte?: number;
  gt?: number;
  lte?: number;
  lt?: number;
}

export type Constraint = FactValue | FactValue[] | NumericConstraint;

export type Predicate = Record<string, Constraint>;

export type Modality =
  | 'shall'
  | 'may'
  | 'shall-if-practicable'
  | 'conditional'
  | 'exempt';

export interface LightSpec {
  light: string;
  color?: string;
  character?: string;
  count?: number;
  arrangement?: string;
  position?: string;
  combined?: boolean;
  intensity?: string;
  modality?: string;
  note?: string;
}

export interface ModalityBy {
  when: Predicate;
  modality: Modality;
}

export interface ConditionalInclude {
  when?: Predicate;
  one_of?: string[];
  'rel:includes'?: string[];
  cite?: string;
}

export interface Entry {
  id: string;
  jurisdiction: string;
  cite: string;
  when: Predicate;
  lights: LightSpec[];
  modality: Modality;
  modality_by?: ModalityBy[];
  'rel:includes'?: string[];
  'rel:conditional_includes'?: ConditionalInclude[];
  'rel:in_lieu_of'?: string[];
  'rel:excludes'?: string[];
  'rel:exempts'?: string[];
  images?: string[];
  notes?: string;
}

export interface ApplicabilityData {
  known_omissions: { cite: string; what: string; why: string }[];
  entries: Entry[];
}

export interface Arc {
  from_deg: number;
  to_deg: number;
}

export interface LightDef {
  name: string;
  cite: string;
  color: string | null;
  character: string;
  arc_deg: number | null;
  arc: Arc | null;
  composite?: boolean;
  components?: string[];
  side?: string;
  rule21: boolean;
  note?: string;
}

export interface LightsData {
  lights: Record<string, LightDef>;
  visibility: {
    cite: string;
    bands: {
      cite: string;
      when: Predicate;
      ranges_nm?: Record<string, number>;
      overrides_nm?: Record<string, number>;
      refines?: string;
    }[];
  };
}

export interface Paragraph {
  path: string;
  rule: string;
  rule_title: string;
  jurisdiction: string;
  text: string;
}

export interface RulesData {
  source: string;
  source_url: string;
  retrieved: string;
  gaps: { path: string; reason: string }[];
  paragraphs: Record<string, Paragraph>;
}

/** One light as it appears in a resolved display, with its provenance. */
export interface DisplayLight {
  spec: LightSpec;
  /** Entry whose lights clause prescribes this light. */
  sourceEntry: string;
  /** Entry that pulled it in, when different (rel:includes / one_of import). */
  via?: string;
  /** Resolved modality of the component carrying this light. */
  modality: Modality;
}

/** One complete lawful display. */
export interface Display {
  /** Entry ids whose lights this display shows (applied + imported). */
  entries: string[];
  lights: DisplayLight[];
  /** Choice labels that distinguish this display from its siblings. */
  chosen: string[];
}

export interface Evaluation {
  /** Entries whose predicate matched, in data order (the fixture contract). */
  applied: string[];
  /** Applied entries relieved by a rel:exempts entry, with the exempting id. */
  exempted: { id: string; by: string }[];
  /** Applied entries suppressed by a required entry's rel:excludes. */
  excluded: { id: string; by: string }[];
  /** Every complete lawful display (alternatives unresolved, REQ-MODEL-8). */
  displays: Display[];
  /**
   * Applied or imported 'may' components that carry no alternative
   * relations: lawful additions that don't multiply the display set
   * (second masthead below 50 m, deck lights below 100 m, …).
   */
  optionalAdditions: {
    id: string;
    via?: string;
    lights: DisplayLight[];
    cite: string;
  }[];
  /** Resolved modality per applied/imported entry id. */
  modalities: Record<string, Modality>;
}
