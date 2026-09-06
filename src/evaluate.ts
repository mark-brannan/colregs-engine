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
  ApplicabilityData,
  Constraint,
  Display,
  DisplayLight,
  Entry,
  Evaluation,
  FactRecord,
  FactValue,
  Modality,
  NumericConstraint,
  Predicate,
} from './types';
import { validateFacts } from './facts.js';
// Read at import time, from the colregs release actually resolved here.
// An evaluation carries it so "the answer changed" can be read as "the data
// changed" without re-deriving which data was in play.
import colregsPackage from 'colregs/package.json' with { type: 'json' };
import factsData from 'colregs/data/facts.json' with { type: 'json' };

const COLREGS_VERSION: string = colregsPackage.version;

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
// naming convention safe to key off either -- 'activity:trawling' is not a
// refinement of 'activity:fishing' despite the same "compound name" shape.
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

function valueMatches(value: unknown, constraint: Constraint): boolean {
  if (value === undefined) return false; // an absent fact never satisfies
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

export function predicateMatches(when: Predicate, facts: FactRecord): boolean {
  return Object.entries(when).every(([key, constraint]) =>
    valueMatches(factValue(facts, key), constraint),
  );
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
function oneOfAvailable(ref: Entry, facts: FactRecord): boolean {
  return Object.entries(ref.when).every(([key, constraint]) => {
    if (AXIS_FACTS.has(key)) return true;
    return valueMatches(factValue(facts, key), constraint);
  });
}

/**
 * rel:includes imports lights only, never the predicate — but an import
 * whose source names a contradicting fact:position is skipped: 27(f)'s
 * include of the Rule 23 running lights reads "as appropriate", and a
 * mine-clearance vessel at anchor shows Rule 30 lights, not mastheads.
 */
function includeApplies(ref: Entry, facts: FactRecord): boolean {
  const pos = ref.when['fact:position'];
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
  return node.entry.lights.map((spec) => ({
    spec,
    sourceEntry: node.id,
    via: node.via,
    modality: (spec.modality as Modality) ?? node.modality,
  }));
}

/** The predicate layer alone: entries whose `when` matches, without the
 * relation/display composition that follows. Factored out of `evaluate` so
 * a caller can inspect just this layer's result. */
function appliedEntryList(data: ApplicabilityData, facts: FactRecord): Entry[] {
  return data.entries.filter((e) => predicateMatches(e.when, facts));
}

/** Ids of the entries whose predicate matches `facts` — the same set
 * `evaluate(...).applied` returns, without running display composition.
 * Validates `facts` on the same terms evaluate() does. */
export function appliedEntries(
  data: ApplicabilityData,
  facts: FactRecord,
): string[] {
  validateFacts(facts);
  return appliedEntryList(data, facts).map((e) => e.id);
}

/**
 * Evaluates `facts` against `data`, returning every lawful display.
 *
 * Throws if `facts` carries a key or value outside colregs' vocabulary: an
 * empty result must mean "this vessel shows nothing", never "you misspelt
 * something".
 */
export function evaluate(
  data: ApplicabilityData,
  facts: FactRecord,
): Evaluation {
  validateFacts(facts);

  const byId = new Map(data.entries.map((e) => [e.id, e]));
  const applied = appliedEntryList(data, facts);
  const appliedIds = new Set(applied.map((e) => e.id));

  const modalities: Record<string, Modality> = {};
  for (const e of applied) modalities[e.id] = resolveModality(e, facts);

  // rel:exempts — the referenced requirement does not apply (30(e)).
  const exempted: { id: string; by: string }[] = [];
  for (const e of applied) {
    if (modalities[e.id] !== 'exempt') continue;
    for (const ref of e['rel:exempts'] ?? []) {
      if (appliedIds.has(ref)) exempted.push({ id: ref, by: e.id });
    }
  }
  const exemptedIds = new Set(exempted.map((x) => x.id));

  // A required (non-alternative) entry's rel:excludes suppresses the
  // referenced applied entries outright: 26(a) "shall exhibit only the
  // lights prescribed in this Rule" removes the Rule 30 anchor lights.
  const excluded: { id: string; by: string }[] = [];
  // ids a required (non-alternative) entry excludes — these are barred
  // both as applied entries and as one_of import options.
  const requiredExcludes = new Map<string, string>();
  for (const e of applied) {
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
      !excludedIds.has(e.id),
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

  const totalCombos =
    (1 << binaryCount) * groupChoiceCounts.reduce((a, b) => a * b, 1);

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

  return {
    colregs: { version: COLREGS_VERSION },
    applied: applied.map((e) => e.id),
    exempted,
    excluded,
    displays,
    optionalAdditions: additions.map((n) => ({
      id: n.id,
      via: n.via,
      lights: displayLights(n),
      cite: n.entry.cite,
    })),
    modalities,
  };
}
