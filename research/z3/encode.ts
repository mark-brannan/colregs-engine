// SMT-LIB generator for the colregs applicability table (issue #1 Phase 2,
// P2.1). Reads colregs' `applicability.json` through the same package the
// engine depends on and emits a first-order theory in which:
//
//   * each fact axis a predicate reads is one SMT constant --- Bool for a
//     boolean fact, Real for a numeric one, Int (an index into the axis's
//     declared values, with a range assertion) for an enum;
//   * each entry is `(define-fun |applies:<id>| () Bool <when>)`;
//   * each entry also gets `|shall:<id>|` --- applies AND resolves to the
//     modality `shall` --- and, for conditional entries, one
//     `|branch:<id>:<i>|` per modality_by branch (that branch is the FIRST
//     match) plus `|unresolved:<id>|` (applies, no branch matched).
//
// The properties of P1.3 are then solver queries over those definitions
// rather than a loop over 5.9M records; queries.ts builds them and run.ts
// runs them.
//
// Three things this encoding does deliberately, each of which the README
// spells out:
//
//   1. Numeric axes are Real, not a finite set of representatives. Where
//      the enumeration proves a property over one point per threshold
//      interval and leans on an unproved partition lemma, an `unsat` here
//      is over every real value. The Z3 result is therefore strictly
//      stronger, and a `sat` whose model lands off the representative grid
//      would be evidence AGAINST the lemma --- run.ts checks for exactly
//      that.
//   2. Every declared axis is total: there is no "absent" value. That
//      matches the enumerated fact space (which assigns every axis a
//      predicate reads) and it matches the engine's semantics for the axes
//      that are declared, because `valueMatches(undefined, ...)` is false
//      for every constraint shape --- an absent fact can only ever make an
//      entry apply less often. So an `unsat` under totality still implies
//      `unsat` with absences allowed.
//   3. The translation follows src/evaluate.ts's `valueMatches` dispatch
//      order exactly (not, then any_of, then numeric, then list, then
//      scalar-with-refinement), including the type mismatches: a numeric
//      constraint on an enum axis is `false`, and `{not: {gte: 5}}` on that
//      axis is therefore `true`.
//
// `not` and both `any_of` forms are implemented here even though the pinned
// colregs (0.1.2) uses neither --- the same stance reference.ts takes, and
// tested in test/z3-encoding.test.ts with literal predicates.
//
//   4. Only `category: 'display'` entries are encoded (REQ-CAT-1, colregs
//      0.2.0). The scope/precedence/classification categories 0.2.0 added
//      read a *pair* of vessels -- own:/other:/pair:-prefixed keys such as
//      pair:geo:in_sight, own:kin:wind_side, other:geo:rel_bearing_deg --
//      which FACT_SPEC (colregs facts.json) does not declare at all: it is
//      a single-vessel vocabulary, and extractAxes (research/conformance/
//      enumerate.ts) only ever turns `fact:`-prefixed keys into axes. That
//      is not an oversight here: src/evaluate.ts's `applied`/`displays`
//      never contain a non-display entry either (its own isDisplay filter),
//      and research/conformance/reference.ts + run.ts apply the identical
//      filter for the same reason -- this encoding's only job is to agree
//      with what the enumeration already checks, and the enumeration has
//      never covered two-vessel entries. Excluded entries are counted in
//      Encoding.excludedNonDisplay so a run reports the narrowed scope
//      explicitly rather than silently. Teaching extractAxes to emit
//      pair-scoped axes was rejected: it would need new two-vessel
//      modeling with no enumeration counterpart to check it against, for
//      properties (conflicting-shall, entry-fires, ...) that were never
//      about these entries to begin with.

import { REFINEMENTS } from '../../src/evaluate.js';
import type { ApplicabilityData, Constraint, Entry, Predicate } from '../../src/types.js';
import { extractAxes, type Axis } from '../conformance/enumerate.js';

/** Constraint value -> the enum values that also satisfy it, because they
 * refine it. The reverse of src/evaluate.ts's REFINEMENTS, read from that
 * module so the two cannot drift. */
const REFINED_BY = new Map<string, string[]>();
for (const [child, parent] of Object.entries(REFINEMENTS)) {
  REFINED_BY.set(parent, [...(REFINED_BY.get(parent) ?? []), child]);
}

/** An SMT-LIB quoted symbol. Fact keys and colregs identifiers carry `:`,
 * which is not a legal simple-symbol character, so everything is quoted. */
export function sym(name: string): string {
  if (name.includes('|') || name.includes('\\')) {
    throw new Error(`identifier ${name} cannot be an SMT-LIB quoted symbol`);
  }
  return `|${name}|`;
}

/** A JS number as an SMT-LIB Real literal. Representatives include halves
 * (the midpoint of two thresholds), so this has to survive non-integers,
 * and SMT-LIB has no unary minus in a numeral. */
function real(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`non-finite constant ${n} in a predicate`);
  const body = Number.isInteger(Math.abs(n)) ? `${Math.abs(n)}.0` : `${Math.abs(n)}`;
  return n < 0 ? `(- ${body})` : body;
}

function and(parts: string[]): string {
  if (parts.length === 0) return 'true';
  if (parts.length === 1) return parts[0];
  return `(and ${parts.join(' ')})`;
}

function or(parts: string[]): string {
  if (parts.length === 0) return 'false';
  if (parts.length === 1) return parts[0];
  return `(or ${parts.join(' ')})`;
}

// --- constraint shape tests, mirroring src/evaluate.ts ------------------

function isNot(c: unknown): c is { not: Constraint } {
  return typeof c === 'object' && c !== null && !Array.isArray(c) && 'not' in c;
}

function isAnyOf(c: unknown): c is { any_of: Constraint[] } {
  return (
    typeof c === 'object' &&
    c !== null &&
    !Array.isArray(c) &&
    'any_of' in c &&
    Array.isArray((c as { any_of: unknown }).any_of)
  );
}

function isNumeric(c: unknown): c is Record<'gte' | 'gt' | 'lte' | 'lt', number | undefined> {
  return (
    typeof c === 'object' &&
    c !== null &&
    !Array.isArray(c) &&
    ('gte' in c || 'gt' in c || 'lte' in c || 'lt' in c)
  );
}

export class EncodingError extends Error {}

/** colregs 0.2.0 (REQ-CAT-1) gave every entry a `category`, defaulting to
 * 'display' when absent. src/evaluate.ts, research/conformance/reference.ts
 * and research/conformance/run.ts all filter to this before matching or
 * enumerating; this encoding has to as well, or it tries to declare SMT
 * axes for the own:/other:/pair:-scoped facts those other categories read,
 * which FACT_SPEC does not know about (see the file header, point 4). */
export function isDisplay(e: Entry): boolean {
  return (e.category ?? 'display') === 'display';
}

export interface Encoding {
  /** The axes the encoding declares, in the order enumerate.ts found them. */
  axes: Axis[];
  /** enum axis key -> value -> its Int index. */
  enumIndex: Map<string, Map<string, number>>;
  /** The declarations + per-entry definitions, as SMT-LIB text. */
  base: string;
  /** Entries actually encoded: category 'display' only. */
  entries: Entry[];
  /** Entries `data.entries` carried but this encoding deliberately does not
   * define `applies:`/`shall:` for, with the category that excluded them. */
  excludedNonDisplay: { id: string; category: string }[];
}

/**
 * Translates one fact constraint against one axis into an SMT-LIB Bool
 * expression, following src/evaluate.ts's `valueMatches` dispatch exactly.
 */
export function encodeConstraint(axis: Axis, constraint: Constraint): string {
  const v = sym(axis.key);

  if (isNot(constraint)) return `(not ${encodeConstraint(axis, constraint.not)})`;
  if (isAnyOf(constraint)) return or(constraint.any_of.map((c) => encodeConstraint(axis, c)));

  if (isNumeric(constraint)) {
    // A numeric constraint against a non-numeric fact value is false in the
    // engine (`typeof value !== 'number'` returns early), not a type error.
    if (axis.kind !== 'numeric') return 'false';
    const parts: string[] = [];
    const c = constraint as Record<string, number | undefined>;
    if (c.gte !== undefined) parts.push(`(>= ${v} ${real(c.gte)})`);
    if (c.gt !== undefined) parts.push(`(> ${v} ${real(c.gt)})`);
    if (c.lte !== undefined) parts.push(`(<= ${v} ${real(c.lte)})`);
    if (c.lt !== undefined) parts.push(`(< ${v} ${real(c.lt)})`);
    return and(parts);
  }

  if (Array.isArray(constraint)) {
    return or(constraint.map((c) => encodeConstraint(axis, c as Constraint)));
  }

  // Scalar equality, plus the refinement rule (a value matches a constraint
  // naming its parent term).
  return encodeScalar(axis, constraint);
}

function encodeScalar(axis: Axis, value: unknown): string {
  const v = sym(axis.key);
  switch (axis.kind) {
    case 'boolean':
      if (value === true) return v;
      if (value === false) return `(not ${v})`;
      return 'false'; // `===` against a non-boolean is false
    case 'numeric':
      if (typeof value === 'number') return `(= ${v} ${real(value)})`;
      return 'false';
    case 'enum': {
      if (typeof value !== 'string') return 'false';
      const matching = [value, ...(REFINED_BY.get(value) ?? [])].filter((x) =>
        axis.values.includes(x),
      );
      if (matching.length === 0) {
        // The predicate names an enum value facts.json does not declare.
        // enumerate.ts reports this as `undeclaredEnumValues`; the engine
        // would simply never match it, so `false` is the faithful reading.
        return 'false';
      }
      return or(matching.map((x) => `(= ${v} ${sym(x)})`));
    }
  }
}

/** Translates a `when` --- a conjunction of fact constraints, with the
 * reserved `any_of` key as predicate-level disjunction. */
export function encodePredicate(axesByKey: Map<string, Axis>, when: Predicate): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(when)) {
    if (key === 'any_of') {
      const subs = value as Predicate[];
      parts.push(or(subs.map((w) => encodePredicate(axesByKey, w))));
      continue;
    }
    const axis = axesByKey.get(key);
    if (axis === undefined) {
      // extractAxes walks the same clauses, so this is unreachable unless
      // the two walks disagree --- which is exactly what should be loud.
      throw new EncodingError(
        `predicate reads ${key}, which the axis extractor did not find; encode.ts and enumerate.ts disagree`,
      );
    }
    parts.push(encodeConstraint(axis, value as Constraint));
  }
  return and(parts);
}

export const APPLIES = (id: string) => sym(`applies:${id}`);
export const SHALL = (id: string) => sym(`shall:${id}`);
export const BRANCH = (id: string, i: number) => sym(`branch:${id}:${i}`);
export const UNRESOLVED = (id: string) => sym(`unresolved:${id}`);

/**
 * Builds the whole base theory: axis declarations, enum value constants and
 * range assertions, and one block of definitions per entry.
 */
export function buildEncoding(data: ApplicabilityData): Encoding {
  const { axes, undeclaredEnumValues } = extractAxes(data);
  const axesByKey = new Map(axes.map((a) => [a.key as string, a]));
  const enumIndex = new Map<string, Map<string, number>>();

  const displayEntries = data.entries.filter(isDisplay);
  const excludedNonDisplay = data.entries
    .filter((e) => !isDisplay(e))
    .map((e) => ({ id: e.id, category: e.category ?? 'display' }));

  const lines: string[] = [];
  lines.push(';; GENERATED by research/z3/encode.ts --- do not edit.');
  lines.push(';;');
  lines.push(`;; Source: colregs applicability.json, ${data.entries.length} entries total,`);
  lines.push(
    `;; ${displayEntries.length} category: 'display' (encoded below), ${excludedNonDisplay.length} excluded`,
  );
  lines.push(';; (scope/precedence/classification categories read a pair of vessels;');
  lines.push(';; see encode.ts\'s file header, point 4).');
  lines.push(';; Written to research/z3/out/ by `npm run z3` (gitignored: it is');
  lines.push(';; a function of the pinned colregs, not a source file). Hand it to');
  lines.push(';; any SMT-LIB 2 solver as-is.');
  lines.push(';;');
  lines.push(';; Numeric facts are Real: an `unsat` below holds for every real');
  lines.push(';; value, not only for the enumeration\'s representatives.');
  lines.push('');
  lines.push('(set-logic QF_LIRA)');
  lines.push('(set-option :produce-models true)');
  lines.push('');
  lines.push(';; ---------------------------------------------------------------');
  lines.push(';; Fact axes');
  lines.push(';; ---------------------------------------------------------------');

  for (const axis of axes) {
    const v = sym(axis.key);
    switch (axis.kind) {
      case 'boolean':
        lines.push(`(declare-const ${v} Bool)`);
        break;
      case 'numeric':
        lines.push(
          `(declare-const ${v} Real)   ; thresholds: ${axis.constants.join(', ') || '(none)'}`,
        );
        break;
      case 'enum': {
        const idx = new Map<string, number>();
        lines.push(`(declare-const ${v} Int)`);
        axis.values.forEach((value, i) => {
          idx.set(value, i);
          lines.push(`(define-fun ${sym(value)} () Int ${i})`);
        });
        lines.push(`(assert (and (>= ${v} 0) (<= ${v} ${axis.values.length - 1})))`);
        enumIndex.set(axis.key, idx);
        break;
      }
    }
    lines.push('');
  }

  if (undeclaredEnumValues.length > 0) {
    lines.push(
      `;; WARNING: predicates name enum values facts.json does not declare: ${JSON.stringify(undeclaredEnumValues)}`,
    );
    lines.push('');
  }

  if (excludedNonDisplay.length > 0) {
    lines.push(
      `;; Excluded (not category: 'display', so not encoded): ${JSON.stringify(excludedNonDisplay)}`,
    );
    lines.push('');
  }

  lines.push(';; ---------------------------------------------------------------');
  lines.push(';; Entries');
  lines.push(';; ---------------------------------------------------------------');

  for (const e of displayEntries) {
    lines.push('');
    lines.push(`;; ${e.id} --- ${e.cite}${e.notes ? ` --- ${e.notes.split('\n')[0]}` : ''}`);
    lines.push(`(define-fun ${APPLIES(e.id)} () Bool`);
    lines.push(`  ${encodePredicate(axesByKey, e.when)})`);

    if (e.modality === 'conditional' && e.modality_by && e.modality_by.length > 0) {
      // modality_by is first-match-wins: branch i decides iff it matches and
      // no earlier branch does.
      const earlier: string[] = [];
      const shallBranches: string[] = [];
      e.modality_by.forEach((b, i) => {
        const own = encodePredicate(axesByKey, b.when);
        const first = and([...earlier.map((p) => `(not ${p})`), own]);
        lines.push(`(define-fun ${BRANCH(e.id, i)} () Bool`);
        lines.push(`  (and ${APPLIES(e.id)} ${first}))   ; -> ${b.modality}`);
        if (b.modality === 'shall') shallBranches.push(BRANCH(e.id, i));
        earlier.push(own);
      });
      lines.push(`(define-fun ${UNRESOLVED(e.id)} () Bool`);
      lines.push(
        `  (and ${APPLIES(e.id)} ${and(earlier.map((p) => `(not ${p})`))}))   ; applied, no branch matched`,
      );
      lines.push(`(define-fun ${SHALL(e.id)} () Bool ${or(shallBranches)})`);
    } else if (e.modality === 'conditional') {
      // conditional with no branches: never resolves.
      lines.push(`(define-fun ${UNRESOLVED(e.id)} () Bool ${APPLIES(e.id)})`);
      lines.push(`(define-fun ${SHALL(e.id)} () Bool false)`);
    } else {
      lines.push(
        `(define-fun ${SHALL(e.id)} () Bool ${e.modality === 'shall' ? APPLIES(e.id) : 'false'})   ; modality: ${e.modality}`,
      );
    }
  }

  return {
    axes,
    enumIndex,
    base: lines.join('\n') + '\n',
    entries: displayEntries,
    excludedNonDisplay,
  };
}
