// The colregs evaluator: predicates -> applied entries -> relations ->
// complete lawful displays. colregs is data-only by design; this module is
// the consumer-side implementation its README describes. Predicate
// semantics follow colregs README "Predicate semantics" exactly; the
// fixture suite replays fixtures/applicability-fixtures.json verbatim.
//
// Where the data leaves composition semantics to the consumer, the choices
// made here are documented in docs/engine-notes.md (items 2-5 point at
// colregs ADR 0019, which owns them) and tested in
// displays.test.ts. The engine never selects a display: every lawful
// alternative is returned (REQ-MODEL-8 / REQ-CONS-3).

import type {
  AnyOfConstraint,
  ApplicabilityData,
  Constraint,
  Display,
  DisplayLight,
  DisplayShape,
  DisplayEvaluation,
  Entry,
  EvaluationProvenance,
  FactRecord,
  FactValue,
  Modality,
  ModalityShift,
  NotConstraint,
  NumericConstraint,
  Predicate,
  RuleCategory,
} from './types';
import { validateFacts } from './facts.js';
import { DataVersionMismatchError } from './errors.js';
// Read at import time, from the colregs release actually resolved here.
// An evaluation carries it so "the answer changed" can be read as "the data
// changed" without re-deriving which data was in play.
import colregsPackage from 'colregs/package.json' with { type: 'json' };
import factsData from 'colregs/data/facts.json' with { type: 'json' };
import applicabilityData from 'colregs/data/applicability.json' with { type: 'json' };

export const COLREGS_VERSION: string = colregsPackage.version;

// The applicability data this package resolves. Loading it here rather than
// taking it as a required argument is what makes COLREGS_VERSION mean
// something: a caller who passed data from a different release used to get a
// stamp that quietly described the wrong thing. `opts.data` still overrides
// it -- the conformance harness injects synthetic tables, and other
// jurisdictions will arrive as separate files -- but an override is recorded
// as `source: 'caller'` instead of being invisible.
export const RESOLVED_DATA = applicabilityData as unknown as ApplicabilityData;

/** Options common to every evaluation entry point. */
export interface EvaluateOptions {
  /** Applicability data to evaluate against, instead of this package's own
   * resolved colregs release. */
  data?: ApplicabilityData;
  /**
   * The version stamp that shipped alongside `data` — colregs 0.2.4's
   * `data/version.json` (ADR 0009), one stamp for all of `data/` and
   * `fixtures/`. Checked against this package's resolved colregs version
   * only when both `data` and `dataVersion` are given; a mismatch throws
   * {@link DataVersionMismatchError} rather than silently stamping the
   * result with the wrong version (colregs-engine#77). Omit it — because
   * the caller's own `data` predates issue #76's version stamp, or by
   * deliberate choice — to skip the check entirely, same as before this
   * option existed.
   */
  dataVersion?: string;
  /**
   * The jurisdiction to resolve entries for (colregs ADR 0018): `intl`
   * unless stated. Entries are the RFC 7396 merge patch of the named
   * jurisdiction's own entries over `intl` — an inherited entry the
   * jurisdiction's `suppressions` tombstone drops out, and a jurisdiction's
   * own entries are added, id by id. `intl` needs no patch: it is the base.
   */
  jurisdiction?: string;
}

/** The jurisdiction resolved when a caller names none. */
export const DEFAULT_JURISDICTION = 'intl';

/**
 * Guards every entry point that reads `opts.data`: when the caller also
 * supplies `dataVersion`, it must match the colregs release this package
 * itself resolves (`COLREGS_VERSION`) — the release `data` and `dataVersion`
 * describe is presumed to be the same one, so this compares against the
 * resolved version, not against the shape of `data` itself. No `data`, or
 * no `dataVersion`, is not an error: the check is opt-in, because plenty of
 * callers (including this package's own conformance harness) pass
 * synthetic data with no version stamp at all.
 */
export function checkDataVersion(opts: EvaluateOptions): void {
  if (opts.data === undefined || opts.dataVersion === undefined) return;
  if (opts.dataVersion !== COLREGS_VERSION) {
    throw new DataVersionMismatchError(COLREGS_VERSION, opts.dataVersion);
  }
}

// AXIS_FACTS: facts.json's mechanical signal for "situational classification
// key" is structural, not prose. Every key under `axes` is a
// mutually-exclusive-choice enum (fact:propulsion, fact:activity,
// fact:position today); every key under `modifiers` is a boolean that
// refines one of those axes (fact:making_way refines
// fact:position=position:underway) and is treated the same way by
// importAvailable below — both are the situation the carrier's redirect
// has already placed the vessel in (ADR 0019 point 3), unlike a scalar or
// a plain (non-axis) boolean, which binds.
// Deriving this from facts.json at import time means a new axis or modifier
// colregs adds is picked up automatically instead of needing a matching
// hand-edit here.
export const AXIS_FACTS = new Set<string>([
  ...Object.keys(factsData.axes),
  ...Object.keys(factsData.modifiers ?? {}),
]);

// REFINEMENTS: facts.json does NOT encode value-level refinement (e.g.
// 'activity:ram_underwater' refining 'activity:ram') in any structured
// field -- only in prose, in the `axes["fact:activity"].note` string, in
// colregs' README ("Predicate semantics"), and in docs/identifiers.md. The
// schema's only structured `refines` field lives under `modifiers` and
// encodes a different relation (a modifier refining one axis *value*, not
// one enum value refining a peer value in the same axis). There is no
// naming convention safe to key off either -- a shared prefix or suffix
// between two enum values in the same axis is not evidence one refines the
// other, and nothing in facts.json rules that reading out for a future pair.
// So this table is deliberately still hand-maintained; the accompanying
// test pins it (and AXIS_FACTS) against facts.json so a future refinement
// colregs adds shows up as a failing test rather than a silent gap.
export const REFINEMENTS: Record<string, string> = {
  'activity:ram_underwater': 'activity:ram',
};

function isNumericConstraint(c: Constraint): c is NumericConstraint {
  return (
    typeof c === 'object' &&
    c !== null &&
    !Array.isArray(c) &&
    ('gte' in c || 'gt' in c || 'lte' in c || 'lt' in c)
  );
}

function isNotConstraint(c: Constraint): c is NotConstraint {
  return typeof c === 'object' && c !== null && !Array.isArray(c) && 'not' in c;
}

function isAnyOfConstraint(c: Constraint): c is AnyOfConstraint {
  return (
    typeof c === 'object' &&
    c !== null &&
    !Array.isArray(c) &&
    'any_of' in c &&
    Array.isArray((c as AnyOfConstraint).any_of)
  );
}

function valueMatches(value: unknown, constraint: Constraint): boolean {
  if (value === undefined) return false; // an absent fact never satisfies, `not` included
  if (isNotConstraint(constraint)) return !valueMatches(value, constraint.not);
  if (isAnyOfConstraint(constraint)) {
    return constraint.any_of.some((c) => valueMatches(value, c));
  }
  if (isNumericConstraint(constraint)) {
    if (typeof value !== 'number') return false;
    if (constraint.gte !== undefined && !(value >= constraint.gte)) return false;
    if (constraint.gt !== undefined && !(value > constraint.gt)) return false;
    if (constraint.lte !== undefined && !(value <= constraint.lte)) return false;
    if (constraint.lt !== undefined && !(value < constraint.lt)) return false;
    return true;
  }
  if (Array.isArray(constraint)) {
    return constraint.some((c) => valueMatches(value, c));
  }
  if (value === constraint) return true;
  // refinement: a value matches a constraint naming its parent
  return (
    typeof value === 'string' && REFINEMENTS[value] === constraint
  );
}

/** A predicate names its keys as data, so they are read as data too. */
function factValue(facts: FactRecord, key: string): FactValue | undefined {
  return (facts as Record<string, FactValue | undefined>)[key];
}

/** `"any_of": [W, ...]` as a key of `when` is predicate-level disjunction,
 * not a fact constraint -- its value is a Predicate[], not a Constraint, so
 * it's routed to predicateMatches recursively instead of valueMatches. */
export function predicateMatches(when: Predicate, facts: FactRecord): boolean {
  return Object.entries(when).every(([key, constraint]) => {
    if (key === 'any_of') {
      return (constraint as Predicate[]).some((w) => predicateMatches(w, facts));
    }
    return valueMatches(factValue(facts, key), constraint as Constraint);
  });
}

export function resolveModality(entry: Entry, facts: FactRecord): Modality {
  if (entry.modality !== 'modality:conditional') return entry.modality;
  for (const branch of entry.modality_by ?? []) {
    if (predicateMatches(branch.when, facts)) return branch.modality;
  }
  return 'modality:conditional';
}

// --- Rule 20(c) modality shifts (colregs ADR 0021, colregs-engine#125) ---
// Applied right after an entry's own modality resolves (resolveModality):
// a shift maps a resolved modality to another when its jurisdiction is in
// force, its `when` holds against the fact record, and it *reaches* the
// entry.

/** A LightRef's signal kind, read off its `light` id's namespace prefix —
 * the same convention every other colregs vocabulary uses (`modality:`,
 * `category:`, `rel:`...). `light:*` is `'lights'`; day shapes are never a
 * `LightRef` (confirmed against colregs' real `data/applicability.json` on
 * `#184` landing) — they carry their own `shapes: ShapeRef[]` field on the
 * entry, handled separately in {@link entrySignalKinds}. */
function signalKindOf(ref: { light: string }): string {
  const prefix = ref.light.slice(0, ref.light.indexOf(':'));
  if (prefix === 'light') return 'lights';
  return `${prefix}s`;
}

/** Every signal kind an entry carries: its own `lights`, plus everything it
 * structurally pulls in — `rel:includes`, `rel:conditional_includes` only
 * through a branch whose `when` currently holds against `facts` (an inactive
 * branch's imports don't count — the fix CodeRabbit asked for on #184's own
 * `test/data.test.mjs` thread), and only a reference `importAvailable` under
 * `facts`, matching the filter the display-building path itself applies
 * before importing a ref (CodeRabbit, PR #128). A ref missing from `byId`
 * throws, the same as `importRef`'s and the `one_of` loop's own unknown-ref
 * checks elsewhere in this module — silently dropping it here would let a
 * dangling ref's absent signal kind pass an entry as "pure" that isn't
 * (claude-review, PR #128). Cycle-guarded; colregs' own CI keeps
 * `rel:includes` acyclic (REQ-CAT-3), so `visiting` never actually re-enters
 * in real data. */
export function entrySignalKinds(
  id: string,
  facts: FactRecord,
  byId: ReadonlyMap<string, Entry>,
  visiting: Set<string> = new Set(),
  via: string = id,
): Set<string> {
  if (visiting.has(id)) return new Set();
  visiting.add(id);
  const entry = byId.get(id);
  if (!entry) throw new Error(`unknown entry ref ${id} via ${via}`);
  const kinds = new Set<string>();
  for (const ref of entry.lights ?? []) kinds.add(signalKindOf(ref));
  if (entry.shapes?.length) kinds.add('shapes');
  const pull = (refId: string) => {
    const ref = byId.get(refId);
    if (!ref) throw new Error(`unknown entry ref ${refId} via ${id}`);
    if (!importAvailable(ref, facts)) return;
    for (const k of entrySignalKinds(refId, facts, byId, visiting, id)) kinds.add(k);
  };
  for (const refId of entry['rel:includes'] ?? []) pull(refId);
  for (const ci of entry['rel:conditional_includes'] ?? []) {
    if (ci.when && !predicateMatches(ci.when, facts)) continue;
    for (const refId of ci['rel:includes'] ?? []) pull(refId);
    for (const refId of ci.one_of ?? []) pull(refId);
  }
  return kinds;
}

/** Whether `shift` reaches entry `id`: it carries at least one signal, and
 * every signal it carries (own + structurally imported, per
 * `entrySignalKinds`) is of `shift.applies_to`'s kind — a mixed entry (a day
 * shape alongside a light) never qualifies. */
function shiftReaches(
  id: string,
  shift: ModalityShift,
  facts: FactRecord,
  byId: ReadonlyMap<string, Entry>,
): boolean {
  const kinds = entrySignalKinds(id, facts, byId);
  return kinds.size > 0 && [...kinds].every((k) => k === shift.applies_to);
}

/** A shift's jurisdiction, resolved the same way an entry's is (ADR 0018):
 * `intl` is always in force, a named jurisdiction only for itself. Whether a
 * jurisdiction can suppress a shift the way `suppressions` tombstones an
 * entry is unspecified — #184 carries one `intl` shift, nothing to test
 * that against yet. */
function shiftInForce(shift: ModalityShift, jurisdiction: string): boolean {
  return shift.jurisdiction === 'intl' || shift.jurisdiction === jurisdiction;
}

/** Every reaching, in-force, `when`-satisfied shift in data order, applied
 * to `modality`. A modality not among a shift's `map` keys is left alone
 * (keeps `modality:may`/`modality:exempt` out of it, per colregs-engine#125
 * step 1). `entry` is the entry the reach test runs against — the same
 * entry whether `modality` is its own resolved value or one of its
 * `LightRef`s' per-light override (colregs-engine#125 step 3: "the per-light
 * modality already exists in the display envelope ... both carry the
 * shifted value"; claude-review, PR #128). Takes `entry` rather than an id —
 * every caller already has the whole entry to hand, and `Entry.id` is
 * required, so a separate id parameter could only ever drift out of sync
 * with it (claude-review, PR #128). */
function applyShifts(
  modality: Modality,
  entry: Entry,
  facts: FactRecord,
  jurisdiction: string,
  shifts: readonly ModalityShift[],
  byId: ReadonlyMap<string, Entry>,
): Modality {
  let m = modality;
  for (const shift of shifts) {
    if (!shiftInForce(shift, jurisdiction)) continue;
    if (!predicateMatches(shift.when, facts)) continue;
    const mapped = shift.map[m];
    if (mapped === undefined) continue;
    if (!shiftReaches(entry.id, shift, facts, byId)) continue;
    m = mapped;
  }
  return m;
}

/** `resolveModality`, then {@link applyShifts}. */
export function resolveModalityWithShifts(
  entry: Entry,
  facts: FactRecord,
  jurisdiction: string,
  shifts: readonly ModalityShift[],
  byId: ReadonlyMap<string, Entry>,
): Modality {
  return applyShifts(resolveModality(entry, facts), entry, facts, jurisdiction, shifts, byId);
}

/**
 * Availability of an imported entry — a `rel:includes`, the `rel:includes`
 * of a `rel:conditional_includes` branch, or a `one_of` option (colregs
 * ADR 0019 point 3). The carrier's redirect has already placed the vessel
 * in the referenced entry's situation (30(d): "the lights prescribed in
 * paragraph (a) or (b)"), so keys declared under facts.json's `axes` and
 * `modifiers` are satisfied by the redirect; every other key is a fact the
 * redirect does not alter, and the referenced entry's constraint on it
 * binds (30(b)'s "less than 50 metres" binds a vessel aground).
 */
function whenAvailable(when: Predicate, facts: FactRecord): boolean {
  return Object.entries(when).every(([key, constraint]) => {
    if (key === 'any_of') {
      // Same predicate-level disjunction as predicateMatches -- axis facts
      // named inside a disjunct are still overridden, so this recurses
      // through whenAvailable's own AXIS_FACTS carve-out, not
      // predicateMatches's.
      return (constraint as Predicate[]).some((w) => whenAvailable(w, facts));
    }
    if (AXIS_FACTS.has(key)) return true;
    return valueMatches(factValue(facts, key), constraint as Constraint);
  });
}

/** The one availability test for every import (ADR 0019 point 3): a
 * carrier that needs a gate its source does not carry writes it on its own
 * branch `when`, as 27(f) and 29(a) do; nothing is inferred from a source's
 * axes in either direction. */
function importAvailable(ref: Entry, facts: FactRecord): boolean {
  return whenAvailable(ref.when, facts);
}

interface Node {
  id: string;
  entry: Entry;
  via?: string;
  modality: Modality;
  imported: boolean;
}

interface OneOfGroup {
  carrier: string;
  /** may-carrier: the group choice replaces the carrier's own lights */
  optional: boolean;
  options: string[]; // node ids
}

function displayLights(
  node: Node,
  facts: FactRecord,
  jurisdiction: string,
  shifts: readonly ModalityShift[],
  byId: ReadonlyMap<string, Entry>,
): DisplayLight[] {
  // colregs 0.2.0 made `lights` optional on an entry (conduct-only entries
  // such as precedence/scope carry none); absent is equivalent to the
  // empty array this always effectively was for such entries.
  return (node.entry.lights ?? []).map((spec) => ({
    spec,
    source_entry: node.id,
    sourceEntry: node.id,
    via: node.via,
    modality: specModality(spec, node, facts, jurisdiction, shifts, byId),
  }));
}

/** A signal's resolved modality. A spec's own modality override bypasses
 * node.modality (already shifted) entirely, so it needs the same shifts
 * applied to it directly -- otherwise a shift silently misses any entry
 * whose lights carry a per-light override (claude-review, PR #128). Shared
 * by lights and shapes so the shift path has one home. */
function specModality(
  spec: { modality?: string },
  node: Node,
  facts: FactRecord,
  jurisdiction: string,
  shifts: readonly ModalityShift[],
  byId: ReadonlyMap<string, Entry>,
): Modality {
  const own = spec.modality as Modality | undefined;
  return own !== undefined
    ? applyShifts(own, node.entry, facts, jurisdiction, shifts, byId)
    : node.modality;
}

/** {@link displayLights} for the entry's `shapes` clause. Shapes are never
 * a `LightRef` (see {@link signalKindOf}), so this is the one place they
 * are read out; a shift declaring `applies_to: 'shapes'` reaches them
 * through {@link specModality}, the same path a per-light override takes. */
function displayShapes(
  node: Node,
  facts: FactRecord,
  jurisdiction: string,
  shifts: readonly ModalityShift[],
  byId: ReadonlyMap<string, Entry>,
): DisplayShape[] {
  return (node.entry.shapes ?? []).map((spec) => ({
    spec,
    source_entry: node.id,
    via: node.via,
    modality: specModality(spec, node, facts, jurisdiction, shifts, byId),
  }));
}

// colregs 0.2.0 (REQ-CAT-1) gave every entry a `category`, defaulting to
// 'category:display' when absent, and added scope/precedence/etc. entries that read
// a situation rather than a fact record -- Rule 4's `when` is empty because
// "any condition of visibility" is the absence of a condition, so an
// unfiltered match would select it for every fact record. colregs' own
// reference filters to isDisplay before matching (test/data.test.mjs); this
// mirrors that exactly so `applied` keeps meaning "what does this vessel
// show", not "every paragraph whose predicate is satisfied".
function isDisplay(e: Entry): boolean {
  return entryCategory(e) === 'category:display';
}

/** An entry's category, with colregs' default applied: absent is `display`.
 * The default lives here, not at each reading site, so the envelope's
 * `categories` and the `isDisplay` filter can never disagree about it. */
export function entryCategory(e: Entry): RuleCategory {
  return e.category ?? 'category:display';
}

// The categories `evaluateDisplay` matches. A one-element list rather than a
// bare string because the field it feeds is a list on every verb: ADR 0001's
// evaluateEncounter reads scope, classification and precedence in one
// predicate pass.
const DISPLAY_CATEGORIES: readonly RuleCategory[] = ['category:display'];

/** What the evaluation was allowed to match, read off the data it matched
 * against. `jurisdictions` describes what was offered, not a filter that ran:
 * the engine has no jurisdiction parameter (see the note above). */
export function provenanceOf(
  data: ApplicabilityData,
  categories: readonly RuleCategory[] = DISPLAY_CATEGORIES,
): EvaluationProvenance {
  const eligible = data.entries.filter((e) => categories.includes(entryCategory(e)));
  return {
    evaluated_categories: [...categories],
    jurisdictions: [...new Set(eligible.map((e) => e.jurisdiction))],
    represented: (data.represented_paragraphs ?? []).map(
      ({ id, jurisdiction, cite, category }) => ({
        id,
        jurisdiction,
        cite,
        category,
      }),
    ),
  };
}

/** The modalities that let a display entry's rel:overrides fire. */
const DISPLAY_OBLIGATIONS: ReadonlySet<Modality> = new Set<Modality>([
  'modality:shall',
  'modality:shall-if-practicable',
]);

/**
 * rel:overrides — directional displacement between two entries that both
 * apply: X overrides Y means Y is displaced while X applies. An override
 * fires only from an entry whose resolved modality is in `obligations`
 * (never from a `may`), never from or onto an exempted entry, and only
 * reaches other applied entries — never a one_of import option or a
 * rel:includes import, which are not applied. A displaced entry's own
 * overrides do not fire, so a chain stops at the first displacement;
 * colregs' own CI (REQ-CAT-3) keeps the data acyclic, so the memo alone
 * terminates. Shared by evaluateDisplay and evaluateEncounter so the two
 * verbs cannot drift on it.
 */
export function resolveOverrides(
  applied: readonly Entry[],
  modalities: Readonly<Record<string, Modality>>,
  obligations: ReadonlySet<Modality>,
  exemptedIds: ReadonlySet<string> = new Set(),
): { overridden: { id: string; by: string }[]; overriddenIds: Set<string> } {
  const appliedIds = new Set(applied.map((e) => e.id));
  const overriddenCache = new Map<string, boolean>();
  const overriddenBy = new Map<string, string>();
  function isOverridden(id: string): boolean {
    if (overriddenCache.has(id)) return overriddenCache.get(id)!;
    overriddenCache.set(id, false); // placeholder: makes recursion terminate
    let result = false;
    if (appliedIds.has(id) && !exemptedIds.has(id)) {
      for (const e of applied) {
        if (!obligations.has(modalities[e.id])) continue;
        if (exemptedIds.has(e.id)) continue;
        if (!(e['rel:overrides'] ?? []).includes(id)) continue;
        if (isOverridden(e.id)) continue; // a displaced entry's overrides don't fire
        result = true;
        overriddenBy.set(id, e.id);
        break;
      }
    }
    overriddenCache.set(id, result);
    return result;
  }
  // Reported in data order of the overrider, then the overrider's own
  // rel:overrides order (not the target's data order).
  const overridden: { id: string; by: string }[] = [];
  for (const e of applied) {
    if (!obligations.has(modalities[e.id])) continue;
    if (exemptedIds.has(e.id)) continue;
    if (isOverridden(e.id)) continue;
    for (const ref of e['rel:overrides'] ?? []) {
      if (!appliedIds.has(ref) || exemptedIds.has(ref)) continue;
      if (isOverridden(ref) && overriddenBy.get(ref) === e.id) {
        overridden.push({ id: ref, by: e.id });
      }
    }
  }
  return { overridden, overriddenIds: new Set(overridden.map((x) => x.id)) };
}

/** Entries in force under `jurisdiction` (colregs ADR 0018): every `intl`
 * entry not named by one of the jurisdiction's own `suppressions`, plus the
 * jurisdiction's own entries. `intl` itself needs no suppression lookup —
 * it is the base the patch applies over, never patched itself. */
function jurisdictionEntries(data: ApplicabilityData, jurisdiction: string): Entry[] {
  if (jurisdiction === 'intl') {
    return data.entries.filter((e) => e.jurisdiction === 'intl');
  }
  const suppressed = new Set(
    (data.suppressions ?? [])
      .filter((s) => s.jurisdiction === jurisdiction)
      .map((s) => s.suppresses),
  );
  return data.entries.filter(
    (e) =>
      (e.jurisdiction === 'intl' && !suppressed.has(e.id)) ||
      e.jurisdiction === jurisdiction,
  );
}

/** The predicate layer alone: entries whose `when` matches, without the
 * relation/display composition that follows. Factored out of `evaluate` so
 * a caller can inspect just this layer's result. */
function appliedEntryList(
  data: ApplicabilityData,
  facts: FactRecord,
  jurisdiction: string,
): Entry[] {
  return jurisdictionEntries(data, jurisdiction).filter(
    (e) => isDisplay(e) && predicateMatches(e.when, facts),
  );
}

/** Ids of the entries whose predicate matches `facts` — the same set
 * `evaluateDisplay(...).applied` returns, without running display
 * composition. Validates `facts` on the same terms evaluateDisplay() does. */
export function appliedDisplayEntries(
  facts: FactRecord,
  opts: EvaluateOptions = {},
): string[] {
  checkDataVersion(opts);
  validateFacts(facts);
  return appliedEntryList(
    opts.data ?? RESOLVED_DATA,
    facts,
    opts.jurisdiction ?? DEFAULT_JURISDICTION,
  ).map((e) => e.id);
}

/**
 * Evaluates one vessel's `facts`, returning every lawful display.
 *
 * `display` is colregs' own category (ADR 0005) for the one-vessel
 * lights-and-shapes case: one fact record in, signals and modality out. The
 * two-subject categories — `classification` and `precedence` — read a
 * situation, not a fact record, so they will be separate entry points rather
 * than a wider result here.
 *
 * Evaluates against this package's own colregs release unless `opts.data`
 * says otherwise. Throws if `facts` carries a key or value outside colregs'
 * vocabulary: an empty result must mean "this vessel shows nothing", never
 * "you misspelt something".
 */
export function evaluateDisplay(
  facts: FactRecord,
  opts: EvaluateOptions = {},
): DisplayEvaluation {
  checkDataVersion(opts);
  const data = opts.data ?? RESOLVED_DATA;
  const source: 'resolved' | 'caller' = opts.data ? 'caller' : 'resolved';
  validateFacts(facts);

  const jurisdiction = opts.jurisdiction ?? DEFAULT_JURISDICTION;
  const byId = new Map(jurisdictionEntries(data, jurisdiction).map((e) => [e.id, e]));
  const applied = appliedEntryList(data, facts, jurisdiction);
  const appliedIds = new Set(applied.map((e) => e.id));
  const shifts = data.modality_shifts ?? [];

  const modalities: Record<string, Modality> = {};
  for (const e of applied) {
    modalities[e.id] = resolveModalityWithShifts(e, facts, jurisdiction, shifts, byId);
  }

  // rel:exempts and rel:overrides interact: an exempt entry that is itself
  // displaced by an override must not exempt its own targets (CodeRabbit,
  // PR #36 review). Neither relation's result is knowable without the
  // other, so this resolves in two passes: first overriddenIds ignoring
  // exemption (an exempting source can't itself be exempted-away at this
  // point, so the omission is safe), then the real exemptedIds using that,
  // then the real overriddenIds using the real exemptedIds. colregs' own
  // CI (REQ-CAT-3) keeps rel:overrides acyclic, so each pass terminates.
  function computeExempted(overriddenIds: ReadonlySet<string>) {
    const exempted: { id: string; by: string }[] = [];
    for (const e of applied) {
      if (modalities[e.id] !== 'modality:exempt') continue;
      if (overriddenIds.has(e.id)) continue; // a displaced entry's exemptions don't fire
      for (const ref of e['rel:exempts'] ?? []) {
        if (appliedIds.has(ref)) exempted.push({ id: ref, by: e.id });
      }
    }
    return { exempted, exemptedIds: new Set(exempted.map((x) => x.id)) };
  }

  const computeOverridden = (exemptedIds: ReadonlySet<string>) =>
    resolveOverrides(applied, modalities, DISPLAY_OBLIGATIONS, exemptedIds);

  const preliminaryOverridden = computeOverridden(new Set());
  const { exempted, exemptedIds } = computeExempted(
    preliminaryOverridden.overriddenIds,
  );
  const { overridden, overriddenIds } = computeOverridden(exemptedIds);

  // Build the component node set: applied entries, minus exempted and
  // displaced, plus imported components.
  const nodes = new Map<string, Node>();
  const groups: OneOfGroup[] = [];

  const active = applied.filter(
    (e) =>
      modalities[e.id] !== 'modality:exempt' &&
      !exemptedIds.has(e.id) &&
      !overriddenIds.has(e.id),
  );

  for (const e of active) {
    nodes.set(e.id, {
      id: e.id,
      entry: e,
      modality: modalities[e.id],
      imported: false,
    });
  }

  const importRef = (refId: string, via: string) => {
    if (nodes.has(refId)) return;
    const ref = byId.get(refId);
    if (!ref) throw new Error(`unknown entry ref ${refId} via ${via}`);
    if (!importAvailable(ref, facts)) return;
    const m = resolveModalityWithShifts(ref, facts, jurisdiction, shifts, byId);
    modalities[refId] = m;
    nodes.set(refId, { id: refId, entry: ref, via, modality: m, imported: true });
  };

  for (const e of active) {
    for (const refId of e['rel:includes'] ?? []) importRef(refId, e.id);
    for (const ci of e['rel:conditional_includes'] ?? []) {
      if (ci.when && !predicateMatches(ci.when, facts)) continue;
      for (const refId of ci['rel:includes'] ?? []) importRef(refId, e.id);
      if (ci.one_of) {
        // If any alternative already fired on its own facts, the group's
        // obligation is met by the applied entries' own dynamics.
        if (ci.one_of.some((r) => appliedIds.has(r))) continue;
        const options: string[] = [];
        for (const refId of ci.one_of) {
          const ref = byId.get(refId);
          if (!ref) throw new Error(`unknown one_of ref ${refId} via ${e.id}`);
          if (!importAvailable(ref, facts)) continue;
          const m = resolveModalityWithShifts(ref, facts, jurisdiction, shifts, byId);
          const gid = refId;
          modalities[gid] = m;
          if (!nodes.has(gid)) {
            nodes.set(gid, {
              id: gid,
              entry: ref,
              via: e.id,
              modality: m,
              imported: true,
            });
          }
          options.push(gid);
        }
        if (options.length > 0) {
          groups.push({
            carrier: e.id,
            optional: modalities[e.id] === 'modality:may',
            options,
          });
        }
      }
    }
  }

  const groupOptionIds = new Set(groups.flatMap((g) => g.options));

  // Classify nodes into required / alternatives / relational-may /
  // optional additions. Group options are handled by their group.
  const required: Node[] = [];
  const binaries: Node[] = []; // alternatives + relational may
  const additions: Node[] = [];

  const nodeList = [...nodes.values()];
  const nodeIds = new Set(nodes.keys());
  const isExcludedBySomeNode = (id: string) =>
    nodeList.some((n) => (n.entry['rel:excludes'] ?? []).includes(id));

  const groupCarriers = new Set(groups.map((g) => g.carrier));

  for (const n of nodeList) {
    if (groupOptionIds.has(n.id)) continue;
    if (groupCarriers.has(n.id)) {
      // A one_of carrier's own lights are the display's base (or the
      // fallback a may-choice replaces); it composes, never an addition.
      required.push(n);
      continue;
    }
    const inLieuOfActive = (n.entry['rel:in_lieu_of'] ?? []).filter((r) =>
      nodeIds.has(r),
    );
    if (inLieuOfActive.length > 0) {
      binaries.push(n);
      continue;
    }
    if (n.modality === 'modality:may') {
      const relational =
        (n.entry['rel:excludes'] ?? []).some((r) => nodeIds.has(r)) ||
        (n.entry['rel:includes'] ?? []).some((r) => appliedIds.has(r)) ||
        isExcludedBySomeNode(n.id);
      if (relational) binaries.push(n);
      else additions.push(n);
      continue;
    }
    required.push(n);
  }

  // Enumerate lawful displays: product over binary choices and one_of
  // groups, validated against in_lieu_of and excludes.
  const displays: Display[] = [];
  const seen = new Set<string>();

  const binaryCount = binaries.length;
  const groupChoiceCounts = groups.map((g) =>
    g.optional ? g.options.length + 1 : g.options.length,
  );

  // #9: the decode loop below reads bits via `c & 1` / `c >>= 1` and takes
  // the group index via `combo >> binaryCount` -- all coerce to signed
  // 32-bit. binaryCount alone isn't the bound: group choices multiply the
  // total further, so `combo >> binaryCount` goes negative once `combo`
  // reaches 2**31, which a 30-binary case with any group reaches before
  // totalCombos (3 * 2**30) does. Compute totalCombos with real-number
  // exponentiation (not `1 << binaryCount`, itself unsafe past 31) and
  // fail loudly past the signed 32-bit bound rather than silently
  // returning fewer displays than exist (REQ-MODEL-8).
  const totalCombos =
    2 ** binaryCount * groupChoiceCounts.reduce((a, b) => a * b, 1);
  if (totalCombos > 2 ** 31) {
    throw new Error(`display enumeration: ${totalCombos} combinations exceeds the signed 32-bit bound`);
  }

  for (let combo = 0; combo < totalCombos; combo++) {
    let c = combo;
    const chosenBinaries: Node[] = [];
    for (let i = 0; i < binaryCount; i++) {
      if (c & 1) chosenBinaries.push(binaries[i]);
      c >>= 1;
    }
    c = combo >> binaryCount;
    const chosenGroupOptions: { node: Node; carrier: string }[] = [];
    let carrierLightsDropped = new Set<string>();
    let valid = true;
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      const count = groupChoiceCounts[gi];
      const pick = c % count;
      c = Math.floor(c / count);
      if (g.optional && pick === g.options.length) continue; // none chosen
      const node = nodes.get(g.options[pick])!;
      chosenGroupOptions.push({ node, carrier: g.carrier });
      // A may-carrier's own lights are the fallback the choice replaces
      // (25(d)(ii): sailing lights, or failing that the torch).
      if (g.optional) carrierLightsDropped.add(g.carrier);
    }

    // Two chosen alternatives with overlapping in_lieu_of targets are
    // alternatives to each other; the combination is not a display.
    for (let i = 0; i < chosenBinaries.length && valid; i++) {
      for (let j = i + 1; j < chosenBinaries.length && valid; j++) {
        const a = chosenBinaries[i].entry['rel:in_lieu_of'] ?? [];
        const b = new Set(chosenBinaries[j].entry['rel:in_lieu_of'] ?? []);
        if (a.some((x) => b.has(x))) valid = false;
      }
    }
    if (!valid) continue;

    const members = new Map<string, Node>();
    for (const n of required) members.set(n.id, n);
    for (const g of chosenGroupOptions) members.set(g.node.id, g.node);
    for (const n of chosenBinaries) {
      for (const r of n.entry['rel:in_lieu_of'] ?? []) members.delete(r);
      members.set(n.id, n);
    }

    // Validate: excludes; in_lieu_of coexistence; relational includes.
    for (const n of members.values()) {
      for (const r of n.entry['rel:excludes'] ?? []) {
        if (members.has(r)) valid = false;
      }
      for (const r of n.entry['rel:in_lieu_of'] ?? []) {
        if (members.has(r)) valid = false;
      }
      // 25(c) is "in addition to" 25(a): a chosen may-node whose
      // rel:includes names an applied entry needs that entry present.
      if (n.modality === 'modality:may' && !n.imported) {
        for (const r of n.entry['rel:includes'] ?? []) {
          if (appliedIds.has(r) && !members.has(r)) valid = false;
        }
      }
    }
    if (!valid) continue;

    // Every required node must be present or replaced.
    for (const n of required) {
      if (members.has(n.id)) continue;
      const replaced = [...members.values()].some((m) =>
        (m.entry['rel:in_lieu_of'] ?? []).includes(n.id),
      );
      if (!replaced) valid = false;
    }
    if (!valid) continue;

    const lights: DisplayLight[] = [];
    const shapes: DisplayShape[] = [];
    for (const n of members.values()) {
      if (carrierLightsDropped.has(n.id)) continue;
      lights.push(...displayLights(n, facts, jurisdiction, shifts, byId));
      shapes.push(...displayShapes(n, facts, jurisdiction, shifts, byId));
    }

    const entryIds = [...members.keys()].sort();
    const fingerprint = JSON.stringify([
      entryIds,
      lights
        .map((l) => JSON.stringify(l.spec))
        .sort(),
      shapes
        .map((s) => JSON.stringify(s.spec))
        .sort(),
    ]);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    displays.push({
      entries: entryIds,
      lights,
      shapes,
      chosen: [
        ...chosenBinaries.map((n) => n.id),
        ...chosenGroupOptions.map((g) => g.node.id),
      ],
    });
  }

  const optionalAdditions = additions.map((n) => ({
    id: n.id,
    via: n.via,
    lights: displayLights(n, facts, jurisdiction, shifts, byId),
    shapes: displayShapes(n, facts, jurisdiction, shifts, byId),
    cite: n.entry.cite,
  }));

  // Same key set as `modalities`, filled once at the end rather than beside
  // each write to it: a category is a property of the entry, not of how it
  // entered the display.
  const categories: Record<string, RuleCategory> = {};
  for (const id of Object.keys(modalities)) {
    const entry = byId.get(id);
    if (entry) categories[id] = entryCategory(entry);
  }

  return {
    colregs: { version: COLREGS_VERSION, source },
    applied: applied.map((e) => e.id),
    exempted,
    overridden,
    displays,
    optional_additions: optionalAdditions,
    optionalAdditions,
    modalities,
    categories,
    provenance: provenanceOf(data),
  };
}
