// Threshold extractor + partitioned enumerator (ladder step 1, issue #6).
//
// Walks every entry's `when` clause (plus modality_by[].when and any `when`
// nested under rel:conditional_includes), collects the fact axes those
// predicates read, and builds a representative fact record for every point
// in the cartesian product of those axes' representative values. Facts no
// predicate reads are left absent — the evaluator never looks at them, so
// they can't affect conformance.
//
// Which axes exist, and what values each takes, comes from FACT_SPEC in
// src/generated/fact-record.ts: generated from the pinned colregs
// facts.json, and the same table validateFacts() enforces at the engine's
// door. Reading it here rather than facts.json directly means the harness
// enumerates exactly the vocabulary the engine accepts, and a record it
// yields is one evaluate() will not reject.
//
// This is deliberately a second reading of the data from src/evaluate.ts:
// it only needs to know which axes exist and what shape their constraints
// take, not how predicates are matched (that's reference.ts's job).

import { FACT_SPEC, type FactKey, type FactRecord } from '../../src/generated/fact-record.js';
import type { ApplicabilityData, Entry, FactValue, Predicate } from '../../src/types.js';

export type AxisKind = 'enum' | 'boolean' | 'numeric';

export interface EnumAxis {
  kind: 'enum';
  key: FactKey;
  values: readonly string[];
}

export interface BooleanAxis {
  kind: 'boolean';
  key: FactKey;
  values: readonly [true, false];
  /** Set when facts.json declares this a modifier that `refines` another
   * axis (e.g. `fact:making_way` refines `fact:position=position:underway`).
   * The record only carries this key when the refined axis holds that
   * value; elsewhere the fact is absent, not `false` — see
   * `enumerateRecords`. */
  refines?: { key: FactKey; value: string };
}

export interface NumericAxis {
  kind: 'numeric';
  key: FactKey;
  /** The comparison constants read by some predicate over this axis. */
  constants: number[];
  /** 2k+1 representatives: each constant, plus one point in each open interval. */
  values: number[];
}

export type Axis = EnumAxis | BooleanAxis | NumericAxis;

/** The generated spec, widened for lookup by a key read from the data. */
type FactSpec =
  | { kind: 'enum'; values: readonly string[] }
  | { kind: 'number' }
  | { kind: 'boolean'; refines?: { key: string; value: string } }
  | { kind: 'string' };

const SPEC: Record<string, FactSpec | undefined> = FACT_SPEC;

/** Every `when` clause an entry can gate on. */
function collectWhens(e: Entry): Predicate[] {
  const whens: Predicate[] = [e.when];
  for (const branch of e.modality_by ?? []) whens.push(branch.when);
  for (const ci of e['rel:conditional_includes'] ?? []) {
    if (ci.when) whens.push(ci.when);
  }
  return whens;
}

/**
 * Recursively walk one constraint value, calling `visitNumeric` for every
 * {gte,gt,lte,lt} object found — including inside `not` and `any_of`
 * wrappers, both live in colregs' schema since 0.2.0 and exercised by real
 * entries in data/applicability.json.
 */
function walkConstraint(c: unknown, visitNumeric: (n: Record<string, number>) => void): void {
  if (c === null || typeof c !== 'object') return; // scalar equality
  if (Array.isArray(c)) return; // membership list of scalars
  const obj = c as Record<string, unknown>;
  if ('gte' in obj || 'gt' in obj || 'lte' in obj || 'lt' in obj) {
    visitNumeric(obj as Record<string, number>);
    return;
  }
  if ('not' in obj) {
    walkConstraint(obj.not, visitNumeric);
    return;
  }
  if ('any_of' in obj && Array.isArray(obj.any_of)) {
    for (const sub of obj.any_of) walkConstraint(sub, visitNumeric);
  }
}

/** Walk a `when`, including its own `any_of` sub-predicates, calling
 * `visit(key, constraint)` for every fact:-keyed constraint found. */
function walkWhen(when: Predicate, visit: (key: string, constraint: unknown) => void): void {
  for (const [key, constraint] of Object.entries(when)) {
    if (key === 'any_of') {
      if (Array.isArray(constraint)) {
        for (const sub of constraint) walkWhen(sub as unknown as Predicate, visit);
      }
      continue;
    }
    visit(key, constraint);
  }
}

function numericRepresentatives(constants: number[]): number[] {
  const sorted = [...new Set(constants)].sort((a, b) => a - b);
  const reps: number[] = [];
  // below the first constant
  reps.push(sorted[0] - 1);
  for (let i = 0; i < sorted.length; i++) {
    reps.push(sorted[i]);
    if (i + 1 < sorted.length) {
      reps.push((sorted[i] + sorted[i + 1]) / 2);
    }
  }
  // above the last constant
  reps.push(sorted[sorted.length - 1] + 1);
  return reps;
}

export interface ExtractResult {
  axes: Axis[];
  /** Enum values referenced by predicates but not declared in FACT_SPEC — should be empty. */
  undeclaredEnumValues: { axis: string; value: string }[];
}

export function extractAxes(data: ApplicabilityData): ExtractResult {
  const referencedKeys = new Set<string>();
  const enumValuesReferenced = new Map<string, Set<string>>();
  const numericConstants = new Map<string, Set<number>>();

  for (const e of data.entries) {
    for (const when of collectWhens(e)) {
      walkWhen(when, (key, constraint) => {
        if (!key.startsWith('fact:')) return;
        referencedKeys.add(key);
        walkConstraint(constraint, (n) => {
          const set = numericConstants.get(key) ?? new Set<number>();
          for (const v of Object.values(n)) set.add(v);
          numericConstants.set(key, set);
        });
        // record scalar/list enum values for the cross-check
        const collectStrings = (c: unknown) => {
          if (typeof c === 'string') {
            const set = enumValuesReferenced.get(key) ?? new Set<string>();
            set.add(c);
            enumValuesReferenced.set(key, set);
          } else if (Array.isArray(c)) {
            for (const v of c) collectStrings(v);
          } else if (c !== null && typeof c === 'object') {
            const obj = c as Record<string, unknown>;
            if ('not' in obj) collectStrings(obj.not);
            if ('any_of' in obj && Array.isArray(obj.any_of)) {
              for (const v of obj.any_of) collectStrings(v);
            }
          }
        };
        collectStrings(constraint);
      });
    }
  }

  const axes: Axis[] = [];
  const undeclaredEnumValues: { axis: string; value: string }[] = [];

  for (const key of [...referencedKeys].sort()) {
    const spec = SPEC[key];
    if (spec === undefined) {
      throw new Error(
        `fact axis ${key} is referenced by a predicate but not declared in colregs facts.json (FACT_SPEC)`,
      );
    }
    // The lookup above is what establishes this; FACT_SPEC's keys are FactKey.
    const factKey = key as FactKey;
    switch (spec.kind) {
      case 'enum': {
        const referenced = enumValuesReferenced.get(key) ?? new Set();
        for (const v of referenced) {
          if (!spec.values.includes(v)) undeclaredEnumValues.push({ axis: key, value: v });
        }
        axes.push({ kind: 'enum', key: factKey, values: spec.values });
        break;
      }
      case 'boolean': {
        const refines = spec.refines
          ? { key: spec.refines.key as FactKey, value: spec.refines.value }
          : undefined;
        axes.push({ kind: 'boolean', key: factKey, values: [true, false], refines });
        break;
      }
      case 'number': {
        const constants = [...(numericConstants.get(key) ?? new Set<number>())];
        axes.push({
          kind: 'numeric',
          key: factKey,
          constants: constants.sort((a, b) => a - b),
          values: numericRepresentatives(constants),
        });
        break;
      }
      case 'string':
        throw new Error(
          `fact axis ${key} is a free-text fact; it has no finite set of representatives to enumerate`,
        );
    }
  }

  return { axes, undeclaredEnumValues };
}

/**
 * An upper bound on the enumeration, not the exact count: a refining
 * modifier axis (`BooleanAxis.refines`) contributes its full 2 values here,
 * but `enumerateRecords` below only emits both when the refined axis holds
 * the refining value — one record, not two, everywhere else. The true count
 * is `n` in run.ts's pass, which counts what was actually yielded.
 */
export function totalRecords(axes: Axis[]): number {
  return axes.reduce((acc, a) => acc * a.values.length, 1);
}

/** A boolean axis whose refinement is declared: narrows `refines` from
 * optional to present, so callers don't re-check it. */
type ModifierAxis = BooleanAxis & { refines: NonNullable<BooleanAxis['refines']> };

function isModifierAxis(a: Axis): a is ModifierAxis {
  return a.kind === 'boolean' && a.refines !== undefined;
}

/** `axes`, split into the cartesian-product axes and the modifier axes that
 * ride along with them (present only where their refinement holds). A
 * modifier axis is never itself a base axis: iterating it unconditionally
 * is exactly the bug this split avoids. */
function splitAxes(axes: Axis[]): { baseAxes: Axis[]; modifierAxes: ModifierAxis[] } {
  const modifierAxes = axes.filter(isModifierAxis);
  const modifierKeys = new Set<FactKey>(modifierAxes.map((a) => a.key));
  const baseAxes = axes.filter((a) => !modifierKeys.has(a.key));
  return { baseAxes, modifierAxes };
}

/** Expands one base record over the modifier axes: a record gets a
 * modifier's key at all only where the refined axis already holds that
 * modifier's refining value, and then one record per modifier value there
 * (not one per modifier value everywhere, which would duplicate every
 * record the refinement doesn't apply to). */
function* expandModifiers(
  base: Partial<Record<FactKey, FactValue>>,
  modifierAxes: ModifierAxis[],
  i: number,
): Generator<FactRecord> {
  if (i === modifierAxes.length) {
    yield { ...base } as FactRecord;
    return;
  }
  const axis = modifierAxes[i];
  if (base[axis.refines.key] === axis.refines.value) {
    for (const v of axis.values) {
      yield* expandModifiers({ ...base, [axis.key]: v }, modifierAxes, i + 1);
    }
  } else {
    yield* expandModifiers(base, modifierAxes, i + 1);
  }
}

/**
 * Streams one FactRecord per point in the cartesian product of the base
 * axes, in mixed-radix order, each expanded over the modifier axes it
 * refines (see `expandModifiers`). Facts for axes not in the list, and a
 * modifier fact wherever its refinement doesn't hold, are simply absent —
 * never `false`. O(1) memory beyond the current record and one stack frame
 * per modifier axis.
 */
export function* enumerateRecords(axes: Axis[]): Generator<FactRecord> {
  const { baseAxes, modifierAxes } = splitAxes(axes);
  const sizes = baseAxes.map((a) => a.values.length);
  const total = sizes.reduce((acc, s) => acc * s, 1);
  for (let idx = 0; idx < total; idx++) {
    let rem = idx;
    // Built homogeneously, then narrowed. FactRecord is a mapped type whose
    // value type depends on the key, so a key chosen at runtime can't index
    // it for assignment; every value here comes from FACT_SPEC, which is
    // what makes the narrowing honest (and evaluate() re-checks it anyway).
    const base: Partial<Record<FactKey, FactValue>> = {};
    for (let i = 0; i < baseAxes.length; i++) {
      const size = sizes[i];
      const digit = rem % size;
      rem = Math.floor(rem / size);
      base[baseAxes[i].key] = baseAxes[i].values[digit] as FactValue;
    }
    yield* expandModifiers(base, modifierAxes, 0);
  }
}

export function formatAxisTable(axes: Axis[]): string {
  const lines = ['axis                          kind      representatives'];
  for (const a of axes) {
    lines.push(`${a.key.padEnd(30)}${a.kind.padEnd(10)}${a.values.length}`);
  }
  return lines.join('\n');
}
