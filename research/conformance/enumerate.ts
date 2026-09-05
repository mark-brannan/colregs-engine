// Threshold extractor + partitioned enumerator (ladder step 1, issue #6).
//
// Walks every lights entry's `when` clause (plus modality_by[].when and any
// `when` nested under rel:conditional_includes / one_of options), collects
// the fact axes those predicates read, and builds a representative fact
// record for every point in the cartesian product of those axes'
// representative values. Facts no lights predicate reads are left absent —
// the evaluator never looks at them, so they can't affect conformance.
//
// This is deliberately a second reading of the data from src/evaluate.ts:
// it only needs to know which axes exist and what shape their constraints
// take, not how predicates are matched (that's reference.ts's job).

import type { ApplicabilityData, Entry, Predicate } from '../../src/types';

export type AxisKind = 'enum' | 'boolean' | 'numeric';

export interface EnumAxis {
  kind: 'enum';
  key: string;
  values: string[];
}

export interface BooleanAxis {
  kind: 'boolean';
  key: string;
  values: [true, false];
}

export interface NumericAxis {
  kind: 'numeric';
  key: string;
  /** The comparison constants read by some predicate over this axis. */
  constants: number[];
  /** 2k+1 representatives: each constant, plus one point in each open interval. */
  values: number[];
}

export type Axis = EnumAxis | BooleanAxis | NumericAxis;

function isLightsEntry(e: Entry): boolean {
  return e.subjects !== 2;
}

/** Every `when` clause a lights entry can gate on. */
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
 * wrappers, which the schema allows even though no lights entry uses them
 * today (colregs schema/applicability.schema.json `predicateValue`).
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

interface FactsDeclared {
  axes?: Record<string, { values: string[] }>;
  booleans?: Record<string, unknown>;
  modifiers?: Record<string, unknown>;
  numerics?: Record<string, unknown>;
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
  /** Enum values referenced by predicates but not declared in facts.json — should be empty. */
  undeclaredEnumValues: { axis: string; value: string }[];
}

export function extractAxes(
  data: ApplicabilityData,
  facts: FactsDeclared,
): ExtractResult {
  const lights = data.entries.filter(isLightsEntry);

  const referencedKeys = new Set<string>();
  const enumValuesReferenced = new Map<string, Set<string>>();
  const numericConstants = new Map<string, Set<number>>();

  for (const e of lights) {
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

  const declaredEnumAxes = facts.axes ?? {};
  const declaredBooleanKeys = new Set([
    ...Object.keys(facts.booleans ?? {}),
    ...Object.keys(facts.modifiers ?? {}),
  ]);
  const declaredNumericKeys = new Set(Object.keys(facts.numerics ?? {}));

  const axes: Axis[] = [];
  const undeclaredEnumValues: { axis: string; value: string }[] = [];

  for (const key of [...referencedKeys].sort()) {
    if (key in declaredEnumAxes) {
      const declaredValues = declaredEnumAxes[key].values;
      const referenced = enumValuesReferenced.get(key) ?? new Set();
      for (const v of referenced) {
        if (!declaredValues.includes(v)) undeclaredEnumValues.push({ axis: key, value: v });
      }
      axes.push({ kind: 'enum', key, values: declaredValues });
    } else if (declaredBooleanKeys.has(key)) {
      axes.push({ kind: 'boolean', key, values: [true, false] });
    } else if (declaredNumericKeys.has(key)) {
      const constants = [...(numericConstants.get(key) ?? new Set())];
      axes.push({
        kind: 'numeric',
        key,
        constants: constants.sort((a, b) => a - b),
        values: numericRepresentatives(constants),
      });
    } else {
      throw new Error(
        `fact axis ${key} is referenced by a lights predicate but not declared in facts.json`,
      );
    }
  }

  return { axes, undeclaredEnumValues };
}

export function totalRecords(axes: Axis[]): number {
  return axes.reduce((acc, a) => acc * a.values.length, 1);
}

/**
 * Streams one FactRecord per point in the cartesian product, in mixed-radix
 * order over `axes`. Facts for axes not in the list are simply absent.
 * O(1) memory beyond the current record.
 */
export function* enumerateRecords(
  axes: Axis[],
): Generator<Record<string, string | number | boolean>> {
  const total = totalRecords(axes);
  const sizes = axes.map((a) => a.values.length);
  for (let idx = 0; idx < total; idx++) {
    let rem = idx;
    const record: Record<string, string | number | boolean> = {};
    for (let i = 0; i < axes.length; i++) {
      const size = sizes[i];
      const digit = rem % size;
      rem = Math.floor(rem / size);
      record[axes[i].key] = axes[i].values[digit] as string | number | boolean;
    }
    yield record;
  }
}

export function formatAxisTable(axes: Axis[]): string {
  const lines = ['axis                          kind      representatives'];
  for (const a of axes) {
    lines.push(
      `${a.key.padEnd(30)}${a.kind.padEnd(10)}${a.values.length}`,
    );
  }
  return lines.join('\n');
}
