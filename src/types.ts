// The engine's own output vocabulary — Display, DisplayLight, DisplayEvaluation.
//
// These mirror nothing in colregs. They are this implementation's answers,
// and they are what `colregs-engine` promises to keep stable.
//
// The colregs data shapes are not written here either: they are generated
// from colregs' JSON Schema and live behind `colregs-engine/schema`
// (src/schema.ts). This module re-exports them for internal use and for the
// tests, which read applicability.json directly.

import type { EffectRole, EntryId, Modality } from './generated/applicability.js';
import type { LightSpec, RepresentedParagraph, RuleCategory } from './schema.js';
import type { FactRecord } from './generated/fact-record.js';
import type {
  DirectionalGeometry,
  Environment,
  History,
  Kinematics,
  PairGeometry,
} from './generated/situation.js';

export * from './schema.js';

import type {
  ApplicabilityData as SchemaApplicabilityData,
  ConditionalInclude as SchemaConditionalInclude,
  Constraint as SchemaConstraint,
  Entry as SchemaEntry,
} from './schema.js';

// colregs@0.2.0's own schema (schema/applicability.schema.json's
// predicateValue) now defines `not` and `any_of` natively on
// SchemaConstraint (colregs-engine#9 / #13 anticipated this ahead of the
// schema revision that added it). NotConstraint/AnyOfConstraint below are
// now redundant with what SchemaConstraint already carries -- kept as an
// explicit union member rather than folded away, so this file's own
// documentation of the not/any_of shapes stays next to their behavior
// (see evaluate.ts's isNotConstraint/isAnyOfConstraint) instead of being
// implicit in a schema import.

/** `{ not: C }` on a fact's constraint: the fact is present and does not
 * satisfy C. An absent fact never satisfies `not` either. */
export interface NotConstraint {
  not: Constraint;
}

/** `{ any_of: [C, ...] }` on a fact's constraint: the fact satisfies at
 * least one C. */
export interface AnyOfConstraint {
  any_of: Constraint[];
}

/** A fact's constraint: colregs' own predicateValue shapes, plus the
 * not/any_of forms above. */
export type Constraint = SchemaConstraint | NotConstraint | AnyOfConstraint;

/** A predicate: fact keys hold Constraints, plus one special key --
 * `any_of: [W, ...]` (predicate-level disjunction: at least one sub-`when`
 * W must hold) -- whose value is a Predicate[], not a Constraint. The index
 * signature covers both so an object literal's `any_of: [...]` typechecks
 * without a cast at the definition site; predicateMatches still narrows
 * with `as` when reading a value back out by key. */
export interface Predicate {
  [key: string]: Constraint | Predicate[];
}

export interface ModalityBy {
  when: Predicate;
  modality: Modality;
}

export interface ConditionalInclude extends Omit<SchemaConditionalInclude, 'when'> {
  when?: Predicate;
}

export interface Entry
  extends Omit<SchemaEntry, 'when' | 'modality_by' | 'rel:conditional_includes'> {
  when: Predicate;
  modality_by?: ModalityBy[];
  'rel:conditional_includes'?: ConditionalInclude[];
}

export interface ApplicabilityData extends Omit<SchemaApplicabilityData, 'entries'> {
  entries: Entry[];
}

/**
 * What an evaluation read, and therefore what its answer does not cover.
 * Provenance, not hedging: an evaluation that silently narrows the data it
 * matches against leaves a consumer unable to tell a rule that did not fire
 * from a rule that was never offered.
 */
export interface EvaluationProvenance {
  /**
   * Entry categories this verb evaluated. Entries of every other category
   * were filtered out before matching, so `applied` is "what this vessel
   * shows", not "every entry whose predicate holds".
   */
  evaluated_categories: RuleCategory[];
  /**
   * Jurisdictions of the entries that were eligible to match, in data order.
   * The engine has no jurisdiction parameter: every jurisdiction present in
   * the data was eligible, and a caller who needs one must narrow
   * `opts.data` itself. Descriptive of what was offered — never a claim that
   * a filter ran.
   */
  jurisdictions: string[];
  /**
   * Paragraphs the data represents but no verb evaluates — Rule 2(a) `care`,
   * Rule 2(b) `meta`. Carried so a reader sees they exist and were not
   * computed; a represented paragraph never becomes a status or a finding.
   */
  represented: RepresentedParagraph[];
}

/** One light as it appears in a resolved display, with its provenance. */
export interface DisplayLight {
  spec: LightSpec;
  /** Entry whose lights clause prescribes this light. */
  source_entry: string;
  /** @deprecated Renamed to {@link DisplayLight.source_entry} — field names
   * are snake_case with unit suffixes across this API and colregs' own keys
   * (ADR 0011 §4). Carries the same value; removed in a later 0.x. */
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

export interface DisplayEvaluation {
  /**
   * The colregs release resolved by this package, read at import time, and
   * where the data actually came from. An applicability answer is a function
   * of the data as much as of the facts; without this, "the answer changed"
   * cannot be told apart from "the data changed".
   *
   * `source: 'resolved'` means the data is this package's own colregs
   * dependency and `version` describes it exactly. `source: 'caller'` means
   * the caller supplied `opts.data`, and `version` then names only the
   * release this package resolved — colregs' schema carries no version
   * field, so nothing here can tell whether the two agree. The field says
   * which of those two claims it is making rather than leaving them
   * indistinguishable.
   */
  colregs: { version: string; source: 'resolved' | 'caller' };
  /** Entries whose predicate matched, in data order (the fixture contract). */
  applied: string[];
  /** Applied entries relieved by a rel:exempts entry, with the exempting id. */
  exempted: { id: string; by: string }[];
  /** Applied entries suppressed by a required entry's rel:excludes. */
  excluded: { id: string; by: string }[];
  /** Applied entries displaced by another applied obligation's
   * rel:overrides, with the overriding id — mirrors the same-named field
   * ADR 0011 §4 defines on `EncounterEvaluation`. */
  overridden: { id: string; by: string }[];
  /** Every complete lawful display (alternatives unresolved, REQ-MODEL-8). */
  displays: Display[];
  /**
   * Applied or imported 'may' components that carry no alternative
   * relations: lawful additions that don't multiply the display set
   * (second masthead below 50 m, deck lights below 100 m, …).
   */
  optional_additions: {
    id: string;
    via?: string;
    lights: DisplayLight[];
    cite: string;
  }[];
  /** @deprecated Renamed to {@link DisplayEvaluation.optional_additions} —
   * see ADR 0011 §4. Carries the same array; removed in a later 0.x. */
  optionalAdditions: DisplayEvaluation['optional_additions'];
  /** Resolved modality per applied/imported entry id. */
  modalities: Record<string, Modality>;
  /**
   * Category per applied/imported entry id, over the same key set as
   * {@link DisplayEvaluation.modalities}. Every value here is `display`
   * while `evaluateDisplay` is the only verb; it is stated rather than
   * assumed because colregs leaves `category` absent on a display entry, and
   * a consumer reading `applied` against the data has no other way to learn
   * which default was applied.
   */
  categories: Record<string, RuleCategory>;
  /** What this evaluation read, and what it therefore does not answer. */
  provenance: EvaluationProvenance;
}

/**
 * The input a two-subject rule reads (ADR 0011 §3, mirroring colregs' ADR
 * 0005). Nested by subject and class, not flat by predicate namespace, so a
 * fixture's `situation` object is assignable here unedited — the flat
 * `own:fact:activity` form stays internal to the walker.
 */
export interface Subject {
  fact: FactRecord;
  kin?: Kinematics;
  geo?: DirectionalGeometry;
  hist?: History;
}

/** Facts of the encounter itself, symmetric between the two vessels. */
export interface Pair {
  geo?: PairGeometry;
  env?: Environment;
}

export interface Situation {
  own: Subject;
  other?: Subject;
  pair?: Pair;
}

// ---------------------------------------------------------------------------
// The three verbs ADR 0011 §4 and ADR 0012 name but do not build. Their
// shapes live here, exported and compiler-checked, from the day they are
// named; the verbs themselves are stubs in encounter.ts, conduct.ts and
// rule2.ts. Every field below is pencil until the verb that fills it is
// written — see each ADR's register for what would settle it.
// ---------------------------------------------------------------------------

/** A Rules paragraph cite: `'17(c)'`. `EntryId` is the other vocabulary a
 * string field can hold; which one a field means is fixed by its type
 * (ADR 0011 §4), not by the compiler. */
export type ParagraphCite = string;

/** One role a subject holds in an encounter, citing the entry that assigned
 * it. Roles are a set per subject: a sailing vessel meeting a
 * constrained-by-draught vessel holds `stand-on` and `shall-not-impede` at
 * once (colregs Q-36). */
export interface SubjectRole {
  role: EffectRole;
  by: EntryId;
}

/** The result of `evaluateEncounter`: two vessels at one instant
 * (ADR 0011 §4). */
export interface EncounterEvaluation {
  colregs: { version: string; source: 'resolved' | 'caller' };
  /** Entries whose predicate matched, in data order. */
  applied: EntryId[];
  /** Applied `scope` entries — what put the rest in play. */
  scope: EntryId[];
  /** Absent when no classification entry fired: "cannot say", not "none"
   * (colregs Q-43). */
  encounter?: 'head-on' | 'crossing' | 'overtaking' | 'none';
  /** Rule 7(a) lets an entry add a ground and never deny one, so the
   * grounds ride with the assertion. */
  risk_of_collision: { asserted: boolean; by: EntryId[] };
  roles: { own: SubjectRole[]; other: SubjectRole[] };
  /** Applied entries displaced by another applied obligation's
   * `rel:overrides`. */
  overridden: { id: EntryId; by: EntryId }[];
  modalities: Record<EntryId, Modality>;
}

/** One instant of a trace. `t_s` is seconds on the caller's clock; the
 * engine reads differences only. */
export interface TraceSample {
  t_s: number;
  situation: Situation;
}

/** The input `conduct` reads: a window over the situation, not a session.
 * Non-empty, strictly increasing `t_s`, the same two vessels throughout —
 * the last of which the engine cannot check, because a `Situation` names no
 * vessel (ADR 0012 §2). */
export interface Trace {
  samples: TraceSample[];
}

/** One conduct entry's verdict for one subject over the window. `pending`
 * means the window ended before the duty could be judged; an entry that
 * never attached is absent, not `pending`. */
export interface ConductVerdict {
  id: EntryId;
  subject: 'own' | 'other';
  verdict: 'kept' | 'breached' | 'pending';
  /** When the entry attached the role being judged. */
  attached_at_s?: number;
  /** When a breach began, or when the duty was met. */
  decided_at_s?: number;
  /** The STL margin the monitor computed, so a near miss and a wide pass do
   * not look alike. */
  robustness?: { value: number; unit: string };
}

/** A transition of the Rule 13(d)/17 protocol state machine. `phase` is a
 * paragraph cite, never an entry id: several phases have no entry. */
export interface ConductPhaseChange {
  subject: 'own' | 'other';
  phase: ParagraphCite;
  at_s: number;
}

/** The result of `evaluateConduct`: verdicts over the window the caller
 * handed over (ADR 0012 §3). */
export interface ConductEvaluation {
  colregs: { version: string; source: 'resolved' | 'caller' };
  /** What window this result saw. */
  window: { from_s: number; to_s: number; samples: number };
  applied: EntryId[];
  verdicts: ConductVerdict[];
  phases: ConductPhaseChange[];
}

/** The axes the Rule 2 sensitivity matrix varies. The field set is a claim
 * about what that matrix is (colregs Q-17 to Q-22). */
export interface SolverParameters {
  dynamics: string[];
  horizon_s: number;
  cadence_s: number;
  separation_m: number;
  information: 'full' | 'partial';
  adversary: 'compliant' | 'physics';
}

/** One solved region grid, named immutably by `version`. Required and
 * positional on `evaluateRule2Departure`: a grid has no default. Any field
 * beyond these is the artefact's own, not API. */
export interface Rule2DepartureModel extends SolverParameters {
  version: string;
  /** The colregs release the grid was solved against. A mismatch with
   * `rules.colregs.version` is reported, not refused. */
  colregs_version: string;
}

/** What the model knows, as a closed alphabet colregs' ADR 0005 §5 owns and
 * this package may not rename. `not-flagged` means "not flagged by this
 * model", never "the rules suffice". */
export type Rule2DepartureStatus =
  | 'not-flagged'
  | 'model-rule-conflict'
  | 'no-robust-policy-in-model'
  | 'inconclusive-in-model';

/** One escape the grid holds. Information, not a prescription. */
export interface Rule2DepartureAdvisory {
  action: { alter_deg?: number; sog_kn?: number };
  margin_m: number;
  /** The paragraphs this action breaks. Cites, never entry ids. */
  breaches: ParagraphCite[];
  envelope: { holds_until_s: number };
}

/** The result of `evaluateRule2Departure` (ADR 0012 §4). The rule-derived
 * obligations sit in `rules` unchanged, so a reader sees what the Rules
 * said; advisories are ranked best margin first, and are empty under
 * `no-robust-policy-in-model`. */
export interface Rule2DepartureFinding {
  status: Rule2DepartureStatus;
  rules: EncounterEvaluation;
  advisories: Rule2DepartureAdvisory[];
  model: {
    version: string;
    colregs_version: string;
    parameters: SolverParameters;
    /** Display text, never matched on. */
    assumptions_violated: string[];
  };
}
