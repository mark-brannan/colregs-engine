// An INDEPENDENT reference implementation of "does this entry's `when` hold
// for this fact record", written from colregs' README "Predicate semantics"
// section and docs/requirements.md — not from src/evaluate.ts, and not
// importing it. Its only job is to be a second opinion for run.ts's
// conformance check; src/evaluate.ts is the engine under test.
//
// Semantics implemented (colregs README, "Predicate semantics"):
//   - An entry applies when every constraint in `when` is satisfied.
//   - An absent fact never satisfies a constraint (including `not`).
//   - Numeric constraints: {gte, gt, lte, lt}.
//   - A list constraint is membership.
//   - Any other constraint value is scalar equality.
//   - `{"not": C}` on a fact's constraint: the fact is present and does NOT
//     satisfy C.
//   - `{"any_of": [C, ...]}` on a fact's constraint: the fact satisfies at
//     least one C.
//   - `"any_of": [W, ...]` as a *key* of a `when`: at least one sub-`when`
//     W holds (predicate-level disjunction).
//   - The ram / ram_underwater refinement applies to equality, list
//     membership and any_of disjuncts alike.
//   - modality_by: first matching branch wins; otherwise the entry's own
//     (non-conditional) modality, or 'conditional' if none matches.
//
// `not` and both `any_of` forms are in colregs' schema since 0.2.0 and
// exercised by real entries in data/applicability.json.

import type { ApplicabilityData, Entry, FactRecord, FactValue, Modality, Predicate } from '../../src/types.js';

/**
 * Refinements: a fact value that also satisfies a constraint naming its
 * "parent" term. colregs' facts.json documents `activity:ram_underwater`
 * as a refinement of `activity:ram` only in prose (the axis's `note`
 * field) — there is no machine-readable `refines` list for enum values
 * the way `fact:making_way`'s modifier entry has one for axis modifiers.
 * So this is hardcoded, exactly as issue #6's spec anticipates, and
 * declared here rather than silently assumed.
 */
const ENUM_REFINEMENTS: Record<string, string> = {
  'activity:ram_underwater': 'activity:ram',
};

function isNumericConstraint(c: unknown): c is Record<string, number> {
  return (
    typeof c === 'object' &&
    c !== null &&
    !Array.isArray(c) &&
    ('gte' in c || 'gt' in c || 'lte' in c || 'lt' in c) &&
    !('not' in c) &&
    !('any_of' in c)
  );
}

function isNotConstraint(c: unknown): c is { not: unknown } {
  return typeof c === 'object' && c !== null && !Array.isArray(c) && 'not' in c;
}

function isAnyOfConstraint(c: unknown): c is { any_of: unknown[] } {
  return (
    typeof c === 'object' &&
    c !== null &&
    !Array.isArray(c) &&
    'any_of' in c &&
    Array.isArray((c as { any_of: unknown }).any_of)
  );
}

function scalarSatisfies(value: FactValue, constraintValue: unknown): boolean {
  if (value === constraintValue) return true;
  return typeof value === 'string' && ENUM_REFINEMENTS[value] === constraintValue;
}

/** Does `value` satisfy one non-numeric, non-any_of, non-not constraint
 * shape: a scalar (equality) or a list (membership)? */
function baseSatisfies(value: FactValue, constraint: unknown): boolean {
  if (Array.isArray(constraint)) {
    return constraint.some((c) => scalarSatisfies(value, c));
  }
  return scalarSatisfies(value, constraint);
}

/** A predicate names its keys as data, so the record is read as data too:
 * FactRecord is keyed by colregs' vocabulary, and a key from a `when` is a
 * string until a predicate is matched against it. */
function factValue(facts: FactRecord, key: string): FactValue | undefined {
  return (facts as Record<string, FactValue | undefined>)[key];
}

/** Does the fact value at `key` satisfy one constraint (any shape)? An
 * absent fact never satisfies anything, `not` included. */
function factSatisfies(facts: FactRecord, key: string, constraint: unknown): boolean {
  const value = factValue(facts, key);
  if (value === undefined) return false;

  if (isNumericConstraint(constraint)) {
    if (typeof value !== 'number') return false;
    const c = constraint;
    if (c.gte !== undefined && !(value >= c.gte)) return false;
    if (c.gt !== undefined && !(value > c.gt)) return false;
    if (c.lte !== undefined && !(value <= c.lte)) return false;
    if (c.lt !== undefined && !(value < c.lt)) return false;
    return true;
  }

  if (isNotConstraint(constraint)) {
    // "the fact is present and does not satisfy C" — presence already
    // established above.
    return !factSatisfies(facts, key, constraint.not);
  }

  if (isAnyOfConstraint(constraint)) {
    return constraint.any_of.some((c) => factSatisfies(facts, key, c));
  }

  return baseSatisfies(value, constraint);
}

/** Does a `when` (a conjunction, with an optional `any_of` disjunction key)
 * hold for this fact record? */
export function referenceWhenMatches(when: Predicate, facts: FactRecord): boolean {
  for (const [key, constraint] of Object.entries(when)) {
    if (key === 'any_of') {
      const options = constraint as unknown as Predicate[];
      if (!options.some((w) => referenceWhenMatches(w, facts))) return false;
      continue;
    }
    if (!factSatisfies(facts, key, constraint)) return false;
  }
  return true;
}

// colregs 0.2.0 (REQ-CAT-1) gave every entry a `category`, defaulting to
// 'display' when absent, and added scope/precedence/etc. entries that read
// a situation rather than a fact record -- Rule 4's `when` is empty ("any
// condition of visibility" is the absence of a condition), so an unfiltered
// match selects it for every fact record. colregs' own reference filters to
// isDisplay before matching (test/data.test.mjs); src/evaluate.ts mirrors
// that, and this independent reading has to as well or every record is a
// manufactured conformance mismatch rather than a real one.
function isDisplay(e: Entry): boolean {
  return (e.category ?? 'display') === 'display';
}

/** Ids of the entries whose `when` holds for this fact record — the
 * reference-implementation counterpart to src/evaluate.ts's
 * appliedEntries(). */
export function referenceAppliedEntries(data: ApplicabilityData, facts: FactRecord): string[] {
  return data.entries
    .filter((e) => isDisplay(e) && referenceWhenMatches(e.when, facts))
    .map((e) => e.id);
}

/** Resolved modality for one entry: first matching modality_by branch,
 * else the entry's own modality. */
export function referenceResolveModality(entry: Entry, facts: FactRecord): Modality {
  if (entry.modality !== 'conditional') return entry.modality;
  for (const branch of entry.modality_by ?? []) {
    if (referenceWhenMatches(branch.when, facts)) return branch.modality;
  }
  return 'conditional';
}

/** Resolved modality for every applied entry in a record, keyed by id. */
export function referenceModalities(
  data: ApplicabilityData,
  facts: FactRecord,
): Record<string, Modality> {
  const out: Record<string, Modality> = {};
  for (const e of data.entries) {
    if (isDisplay(e) && referenceWhenMatches(e.when, facts)) {
      out[e.id] = referenceResolveModality(e, facts);
    }
  }
  return out;
}
