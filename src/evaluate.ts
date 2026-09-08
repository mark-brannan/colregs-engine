// The colregs evaluator: predicates -> applied entries -> relations ->
// complete lawful displays. colregs is data-only by design; this module is
// the consumer-side implementation its README describes. Predicate
// semantics follow colregs README "Predicate semantics" exactly; the
// fixture suite replays fixtures/applicability-fixtures.json verbatim.
//
// Where the data leaves composition semantics to the consumer, the choices
// made here are documented in docs/engine-notes.md and tested in
// displays.test.ts. The engine never selects a display: every lawful
// alternative is returned (REQ-MODEL-8 / REQ-CONS-3).

import type {
  AnyOfConstraint,
  ApplicabilityData,
  Constraint,
  Display,
  DisplayLight,
  DisplayEvaluation,
  Entry,
  FactRecord,
  FactValue,
  Modality,
  NotConstraint,
  NumericConstraint,
  Predicate,
} from './types';
import { validateFacts } from './facts.js';
// Read at import time, from the colregs release actually resolved here.
// An evaluation carries it so "the answer changed" can be read as "the data
// changed" without re-deriving which data was in play.
import colregsPackage from 'colregs/package.json' with { type: 'json' };
import factsData from 'colregs/data/facts.json' with { type: 'json' };
import applicabilityData from 'colregs/data/applicability.json' with { type: 'json' };

const COLREGS_VERSION: string = colregsPackage.version;

// The applicability data this package resolves. Loading it here rather than
// taking it as a required argument is what makes COLREGS_VERSION mean
// something: a caller who passed data from a different release used to get a
// stamp that quietly described the wrong thing. `opts.data` still overrides
// it -- the conformance harness injects synthetic tables, and other
// jurisdictions will arrive as separate files -- but an override is recorded
// as `source: 'caller'` instead of being invisible.
const RESOLVED_DATA = applicabilityData as unknown as ApplicabilityData;

/** Options common to every evaluation entry point. */
export interface EvaluateOptions {
  /** Applicability data to evaluate against, instead of this package's own
   * resolved colregs release. */
  data?: ApplicabilityData;
}

// AXIS_FACTS: facts.json's mechanical signal for "situational classification
// key" is structural, not prose. Every key under `axes` is a
// mutually-exclusive-choice enum (fact:propulsion, fact:activity,
// fact:position today); every key under `modifiers` is a boolean that
// refines one of those axes (fact:making_way refines
// fact:position=position:underway) and is treated the same way by
// oneOfAvailable below — both are the situation a `one_of` alternative's own
// axes get to override, unlike a scalar or a plain (non-axis) boolean.
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
  if (entry.modality !== 'conditional') return entry.modality;
  for (const branch of entry.modality_by ?? []) {
    if (predicateMatches(branch.when, facts)) return branch.modality;
  }
  return 'conditional';
}

/**
 * Availability of a referenced-but-not-applied entry inside a one_of
 * alternative set: the carrier redirects the vessel to the referenced
 * lights (30(d): "the lights prescribed in paragraph (a) or (b)"), so the
 * referenced entry's situation axes are deliberately overridden — but its
 * scalar gates (30(b)'s "less than 50 meters") still describe this vessel
 * and are honored.
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

function oneOfAvailable(ref: Entry, facts: FactRecord): boolean {
  return whenAvailable(ref.when, facts);
}

/**
 * rel:includes imports lights only, never the predicate — but an import
 * whose source names a contradicting fact:position is skipped: 27(f)'s
 * include of the Rule 23 running lights reads "as appropriate", and a
 * mine-clearance vessel at anchor shows Rule 30 lights, not mastheads.
 */
function includeApplies(ref: Entry, facts: FactRecord): boolean {
  const pos = ref.when['fact:position'] as Constraint | undefined;
  if (pos === undefined) return true;
  if (facts['fact:position'] === undefined) return true;
  return valueMatches(facts['fact:position'], pos);
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

function displayLights(node: Node): DisplayLight[] {
  // colregs 0.2.0 made `lights` optional on an entry (conduct-only entries
  // such as precedence/scope carry none); absent is equivalent to the
  // empty array this always effectively was for such entries.
  return (node.entry.lights ?? []).map((spec) => ({
    spec,
    source_entry: node.id,
    sourceEntry: node.id,
    via: node.via,
    modality: (spec.modality as Modality) ?? node.modality,
  }));
}

// colregs 0.2.0 (REQ-CAT-1) gave every entry a `category`, defaulting to
// 'display' when absent, and added scope/precedence/etc. entries that read
// a situation rather than a fact record -- Rule 4's `when` is empty because
// "any condition of visibility" is the absence of a condition, so an
// unfiltered match would select it for every fact record. colregs' own
// reference filters to isDisplay before matching (test/data.test.mjs); this
// mirrors that exactly so `applied` keeps meaning "what does this vessel
// show", not "every paragraph whose predicate is satisfied".
function isDisplay(e: Entry): boolean {
  return (e.category ?? 'display') === 'display';
}

// NOTE (colregs@0.2.2, ADR 0008): every entry now also carries a required
// `jurisdiction` field (`intl` throughout, `us/inland` for the new
// mooring-buoy delta, 30a-buoy/30b-buoy). This package has no jurisdiction
// parameter or filter of any kind yet -- adding one is real API-design work
// (an ADR, like ADR 0001's own scoping), not something to freelance under a
// dependency bump -- and research/conformance/reference.ts, the ground
// truth this engine is diffed against, doesn't filter by it either. So
// `jurisdiction` is deliberately left unread here for now: a caller whose
// facts happen to match 30a-buoy/30b-buoy's predicate gets those lights
// regardless of jurisdiction, same as before this field existed. No
// jurisdiction parameter exists yet -- open gap, not a decision.
/** The predicate layer alone: entries whose `when` matches, without the
 * relation/display composition that follows. Factored out of `evaluate` so
 * a caller can inspect just this layer's result. */
function appliedEntryList(data: ApplicabilityData, facts: FactRecord): Entry[] {
  return data.entries.filter((e) => isDisplay(e) && predicateMatches(e.when, facts));
}

/** Ids of the entries whose predicate matches `facts` — the same set
 * `evaluateDisplay(...).applied` returns, without running display
 * composition. Validates `facts` on the same terms evaluateDisplay() does. */
export function appliedDisplayEntries(
  facts: FactRecord,
  opts: EvaluateOptions = {},
): string[] {
  validateFacts(facts);
  return appliedEntryList(opts.data ?? RESOLVED_DATA, facts).map((e) => e.id);
}

/** @deprecated Renamed to {@link appliedDisplayEntries}, which resolves the
 * applicability data itself and takes it as `opts.data` instead of a
 * positional argument. Removed in a later 0.x. */
export function appliedEntries(
  data: ApplicabilityData,
  facts: FactRecord,
): string[] {
  return appliedDisplayEntries(facts, { data });
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
  const data = opts.data ?? RESOLVED_DATA;
  const source: 'resolved' | 'caller' = opts.data ? 'caller' : 'resolved';
  validateFacts(facts);

  const byId = new Map(data.entries.map((e) => [e.id, e]));
  const applied = appliedEntryList(data, facts);
  const appliedIds = new Set(applied.map((e) => e.id));

  const modalities: Record<string, Modality> = {};
  for (const e of applied) modalities[e.id] = resolveModality(e, facts);

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
      if (modalities[e.id] !== 'exempt') continue;
      if (overriddenIds.has(e.id)) continue; // a displaced entry's exemptions don't fire
      for (const ref of e['rel:exempts'] ?? []) {
        if (appliedIds.has(ref)) exempted.push({ id: ref, by: e.id });
      }
    }
    return { exempted, exemptedIds: new Set(exempted.map((x) => x.id)) };
  }

  // rel:overrides — directional displacement between two entries that both
  // apply: X overrides Y means Y's lights are displaced while X applies.
  // Unlike rel:excludes below, an override fires only from an obligation
  // (shall / shall-if-practicable), never from a `may`, and only reaches
  // other applied entries — never a one_of import option or a rel:includes
  // import, which are not applied. isOverridden is recursive (an
  // overridden entry's own rel:overrides do not fire, so a chain stops at
  // the first displacement) and memoised; colregs' own CI (REQ-CAT-3) keeps
  // this data acyclic, so the memo cache alone is enough to terminate.
  function computeOverridden(exemptedIds: ReadonlySet<string>) {
    const overriddenCache = new Map<string, boolean>();
    const overriddenBy = new Map<string, string>();
    function isOverridden(id: string): boolean {
      if (overriddenCache.has(id)) return overriddenCache.get(id)!;
      overriddenCache.set(id, false); // placeholder: makes recursion terminate
      let result = false;
      if (appliedIds.has(id) && !exemptedIds.has(id)) {
        for (const e of applied) {
          const m = modalities[e.id];
          if (m !== 'shall' && m !== 'shall-if-practicable') continue;
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
      const m = modalities[e.id];
      if (m !== 'shall' && m !== 'shall-if-practicable') continue;
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

  const preliminaryOverridden = computeOverridden(new Set());
  const { exempted, exemptedIds } = computeExempted(
    preliminaryOverridden.overriddenIds,
  );
  const { overridden, overriddenIds } = computeOverridden(exemptedIds);

  // A required (non-alternative) entry's rel:excludes suppresses the
  // referenced applied entries outright: 26(a) "shall exhibit only the
  // lights prescribed in this Rule" removes the Rule 30 anchor lights.
  const excluded: { id: string; by: string }[] = [];
  // ids a required (non-alternative) entry excludes — these are barred
  // both as applied entries and as one_of import options.
  const requiredExcludes = new Map<string, string>();
  for (const e of applied) {
    if (overriddenIds.has(e.id)) continue; // a displaced entry's excludes don't fire either
    const m = modalities[e.id];
    if (m !== 'shall' && m !== 'shall-if-practicable') continue;
    const replacesApplied = (e['rel:in_lieu_of'] ?? []).some((r) =>
      appliedIds.has(r),
    );
    if (replacesApplied) continue;
    for (const ref of e['rel:excludes'] ?? []) {
      requiredExcludes.set(ref, e.id);
      if (appliedIds.has(ref) && !exemptedIds.has(ref)) {
        excluded.push({ id: ref, by: e.id });
      }
    }
  }
  const excludedIds = new Set(excluded.map((x) => x.id));

  // Build the component node set: applied entries, minus exempted and
  // suppressed, plus imported components.
  const nodes = new Map<string, Node>();
  const groups: OneOfGroup[] = [];

  const active = applied.filter(
    (e) =>
      modalities[e.id] !== 'exempt' &&
      !exemptedIds.has(e.id) &&
      !excludedIds.has(e.id) &&
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
    if (!includeApplies(ref, facts)) return;
    const m = resolveModality(ref, facts);
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
          if (!oneOfAvailable(ref, facts)) continue;
          const excludedBy = requiredExcludes.get(refId);
          if (excludedBy !== undefined) {
            if (!excluded.some((x) => x.id === refId)) {
              excluded.push({ id: refId, by: excludedBy });
            }
            continue;
          }
          const m = resolveModality(ref, facts);
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
            optional: modalities[e.id] === 'may',
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
    if (n.modality === 'may') {
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
      if (n.modality === 'may' && !n.imported) {
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
    for (const n of members.values()) {
      if (carrierLightsDropped.has(n.id)) continue;
      lights.push(...displayLights(n));
    }

    const entryIds = [...members.keys()].sort();
    const fingerprint = JSON.stringify([
      entryIds,
      lights
        .map((l) => JSON.stringify(l.spec))
        .sort(),
    ]);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);

    displays.push({
      entries: entryIds,
      lights,
      chosen: [
        ...chosenBinaries.map((n) => n.id),
        ...chosenGroupOptions.map((g) => g.node.id),
      ],
    });
  }

  const optionalAdditions = additions.map((n) => ({
    id: n.id,
    via: n.via,
    lights: displayLights(n),
    cite: n.entry.cite,
  }));

  return {
    colregs: { version: COLREGS_VERSION, source },
    applied: applied.map((e) => e.id),
    exempted,
    excluded,
    overridden,
    displays,
    optional_additions: optionalAdditions,
    optionalAdditions,
    modalities,
  };
}

/** @deprecated Renamed to {@link evaluateDisplay}, which resolves the
 * applicability data itself and takes it as `opts.data` instead of a
 * positional argument. Removed in a later 0.x. */
export function evaluate(
  data: ApplicabilityData,
  facts: FactRecord,
): DisplayEvaluation {
  return evaluateDisplay(facts, { data });
}
