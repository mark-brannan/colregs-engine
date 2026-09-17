// Threshold extractor + pruned enumerator for the two-subject situation
// space, the sibling of enumerate.ts's one-subject fact space.
//
// Walks every non-`display` entry's `when`, collects the
// `<subject>:<class>:<key>` axes those predicates read, and enumerates a
// representative Situation for every point in the product. Vocabulary and
// value domains come from the generated situation.ts and fact-record.ts
// specs, so the space is exactly what validateSituation accepts. Numeric
// axes take enumerate.ts's own representatives.
//
// Two things keep the product finite. Representatives that satisfy the same
// set of constraints are interchangeable in every predicate, so one of each
// signature is kept -- a coarsening of enumerate.ts's partition, never a
// widening. And an axis is enumerated only where some entry still able to
// match reads it; elsewhere it is absent, which no live entry can tell from
// any value it might have taken.
//
// `fact:rule18_class` is derived, not supplied, so it is realised through
// situation-reference.ts's witness builder: the pair (propulsion, rank) that
// no fact record can hold yields no situation.

import {
  FACT_SPEC,
  type FactRecord,
} from '../../src/generated/fact-record.js';
import {
  ENV_SPEC,
  GEO_OWN_SPEC,
  GEO_PAIR_SPEC,
  HIST_SPEC,
  KIN_SPEC,
} from '../../src/generated/situation.js';
import type { ApplicabilityData, Entry, Predicate, Situation, Subject } from '../../src/types.js';

import { numericRepresentatives } from './enumerate.js';
import { factSatisfies } from './reference.js';
import { RULE18_CLASSES, rule18Witness } from './situation-reference.js';

export type AxisValue = string | number | boolean;

export interface SituationAxis {
  /** The flat predicate key, e.g. `other:geo:rel_bearing_deg`. */
  key: string;
  kind: 'enum' | 'boolean' | 'numeric';
  /** Comparison constants, for a numeric axis. */
  constants: number[];
  /** Representatives, one per constraint signature. */
  values: AxisValue[];
  /** Entries whose predicate reads this key. */
  readers: number;
}

export interface SituationSpace {
  axes: SituationAxis[];
  /** The non-`display` entries the axes were read from. */
  entries: Entry[];
}

const DERIVED_CLASS = 'fact:rule18_class';

type Spec = { kind: string; values?: readonly string[] };

/** The spec for one flat key, from the generated vocabularies. A bare key
 * (no subject prefix) is self's, as the walker reads it. */
function specFor(key: string): Spec {
  const parts = key.split(':');
  const subject = parts.length > 2 ? parts[0] : 'self';
  const rest = parts.length > 2 ? parts.slice(1) : parts;
  const cls = rest[0];
  const name = rest.join(':');
  if (cls === 'fact' && name === DERIVED_CLASS) return { kind: 'enum', values: RULE18_CLASSES };
  const table: Record<string, Record<string, Spec> | undefined> = {
    fact: FACT_SPEC as unknown as Record<string, Spec>,
    kin: KIN_SPEC as unknown as Record<string, Spec>,
    hist: HIST_SPEC as unknown as Record<string, Spec>,
    env: ENV_SPEC as unknown as Record<string, Spec>,
    geo: (subject === 'pair' ? GEO_PAIR_SPEC : GEO_OWN_SPEC) as unknown as Record<string, Spec>,
  };
  const spec = table[cls]?.[name];
  if (spec === undefined) {
    throw new Error(
      `situation axis ${key} is referenced by a predicate but not declared in colregs facts.json`,
    );
  }
  return spec;
}

/** Walk a `when`, including its own `any_of` sub-predicates. */
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

function collectWhens(e: Entry): Predicate[] {
  const whens: Predicate[] = [e.when];
  for (const branch of e.modality_by ?? []) whens.push(branch.when);
  for (const ci of e['rel:conditional_includes'] ?? []) {
    if (ci.when) whens.push(ci.when);
  }
  return whens;
}

/** Every numeric comparison constant inside one constraint, `not` and
 * `any_of` wrappers included. */
function collectConstants(c: unknown, into: Set<number>): void {
  if (c === null || typeof c !== 'object' || Array.isArray(c)) return;
  const obj = c as Record<string, unknown>;
  for (const op of ['gte', 'gt', 'lte', 'lt'] as const) {
    if (typeof obj[op] === 'number') into.add(obj[op] as number);
  }
  if ('not' in obj) collectConstants(obj.not, into);
  if (Array.isArray(obj.any_of)) for (const sub of obj.any_of) collectConstants(sub, into);
}

/** Does `value` satisfy `constraint` at `key`? The reference matcher reads a
 * one-key predicate against a one-key record, so the constraint language is
 * read once, here as everywhere. */
function satisfies(key: string, value: AxisValue, constraint: unknown): boolean {
  return factSatisfies({ [key]: value } as FactRecord, key, constraint);
}

/** One representative per constraint signature, in declaration order. Two
 * values satisfying the same constraints are indistinguishable to every
 * predicate in the data, so the second is a record the first already made. */
function quotient(key: string, values: AxisValue[], constraints: unknown[]): AxisValue[] {
  const kept = new Map<string, AxisValue>();
  for (const value of values) {
    const signature = constraints.map((c) => (satisfies(key, value, c) ? '1' : '0')).join('');
    if (!kept.has(signature)) kept.set(signature, value);
  }
  return [...kept.values()];
}

export function extractSituationAxes(data: ApplicabilityData): SituationSpace {
  const entries = data.entries.filter((e) => (e.category ?? 'category:display') !== 'category:display');
  const constraintsByKey = new Map<string, unknown[]>();
  const seenConstraint = new Map<string, Set<string>>();
  const readersByKey = new Map<string, Set<string>>();

  for (const e of entries) {
    for (const when of collectWhens(e)) {
      walkWhen(when, (key, constraint) => {
        const list = constraintsByKey.get(key) ?? [];
        const seen = seenConstraint.get(key) ?? new Set<string>();
        const tag = JSON.stringify(constraint);
        if (!seen.has(tag)) {
          seen.add(tag);
          list.push(constraint);
        }
        constraintsByKey.set(key, list);
        seenConstraint.set(key, seen);
        const readers = readersByKey.get(key) ?? new Set<string>();
        readers.add(e.id);
        readersByKey.set(key, readers);
      });
    }
  }

  const axes: SituationAxis[] = [];
  for (const [key, constraints] of constraintsByKey) {
    const spec = specFor(key);
    let kind: SituationAxis['kind'];
    let candidates: AxisValue[];
    let constants: number[] = [];
    switch (spec.kind) {
      case 'enum':
        kind = 'enum';
        candidates = [...(spec.values ?? [])];
        break;
      case 'boolean':
        kind = 'boolean';
        candidates = [true, false];
        break;
      case 'number': {
        kind = 'numeric';
        const set = new Set<number>();
        for (const c of constraints) collectConstants(c, set);
        constants = [...set].sort((a, b) => a - b);
        candidates = numericRepresentatives(constants);
        break;
      }
      default:
        throw new Error(
          `situation axis ${key} is a ${spec.kind} axis; it has no finite set of representatives to enumerate`,
        );
    }
    axes.push({
      key,
      kind,
      constants,
      values: quotient(key, candidates, constraints),
      readers: readersByKey.get(key)!.size,
    });
  }

  // Most-read axis first: a gate that kills an entry early is a subtree of
  // its axes never walked.
  axes.sort((a, b) => b.readers - a.readers || a.key.localeCompare(b.key));
  return { axes, entries };
}

/** An upper bound on the enumeration: the product of the representative
 * counts, before realisability and pruning take their share. The run's own
 * count is what was actually yielded. */
export function totalSituations(axes: SituationAxis[]): number {
  return axes.reduce((acc, a) => acc * a.values.length, 1);
}

export function formatSituationAxisTable(axes: SituationAxis[]): string {
  const lines = ['axis                                kind      representatives'];
  for (const a of axes) {
    lines.push(`${a.key.padEnd(36)}${a.kind.padEnd(10)}${a.values.length}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------
// Enumeration
// ---------------------------------------------------------------------
type Flat = Record<string, AxisValue>;

/** Could this `when` still match once the unassigned keys are filled? A key
 * already assigned decides; a key not yet assigned is left open. */
function stillLive(when: Predicate, flat: Flat): boolean {
  for (const [key, constraint] of Object.entries(when)) {
    if (key === 'any_of') {
      const options = constraint as unknown as Predicate[];
      if (!options.some((w) => stillLive(w, flat))) return false;
      continue;
    }
    if (!(key in flat)) continue;
    if (!factSatisfies(flat as FactRecord, key, constraint)) return false;
  }
  return true;
}

interface SubjectDraft {
  fact: Record<string, unknown>;
  kin: Record<string, unknown>;
  geo: Record<string, unknown>;
  hist: Record<string, unknown>;
}

function draft(): SubjectDraft {
  return { fact: {}, kin: {}, geo: {}, hist: {} };
}

function finish(d: SubjectDraft): Subject {
  const out: Record<string, unknown> = { fact: d.fact };
  for (const cls of ['kin', 'geo', 'hist'] as const) {
    if (Object.keys(d[cls]).length > 0) out[cls] = d[cls];
  }
  return out as unknown as Subject;
}

/** The flat record as a nested Situation, or undefined when no fact record
 * can hold the Rule 18 rank it asks of a vessel. */
function materialize(flat: Flat): Situation | undefined {
  const subjects = { self: draft(), other: draft() };
  const pair: { geo: Record<string, unknown>; env: Record<string, unknown> } = { geo: {}, env: {} };
  const rank: { self?: string; other?: string } = {};

  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split(':');
    const subject = parts.length > 2 ? parts[0] : 'self';
    const rest = parts.length > 2 ? parts.slice(1) : parts;
    const cls = rest[0];
    const name = rest.join(':');
    if (subject === 'pair') {
      (cls === 'env' ? pair.env : pair.geo)[name] = value;
      continue;
    }
    const seat = subject === 'other' ? 'other' : 'self';
    if (name === DERIVED_CLASS) {
      rank[seat] = value as string;
      continue;
    }
    subjects[seat][cls as 'fact' | 'kin' | 'geo' | 'hist'][name] = value;
  }

  for (const seat of ['self', 'other'] as const) {
    const wanted = rank[seat];
    if (wanted === undefined) continue;
    const fact = rule18Witness(subjects[seat].fact as FactRecord, wanted);
    if (fact === undefined) return undefined;
    subjects[seat].fact = fact as Record<string, unknown>;
  }

  const situation: Situation = { self: finish(subjects.self), other: finish(subjects.other) };
  const geo = Object.keys(pair.geo).length > 0 ? pair.geo : undefined;
  const env = Object.keys(pair.env).length > 0 ? pair.env : undefined;
  if (geo || env) situation.pair = { ...(geo ? { geo } : {}), ...(env ? { env } : {}) } as Situation['pair'];
  return situation;
}

/**
 * Streams one Situation per surviving point of the product. An axis no live
 * entry reads is skipped, so the record leaves that key absent rather than
 * walking values no entry can tell apart; a point whose Rule 18 rank no fact
 * record can hold yields nothing. O(1) memory beyond the current record and
 * one stack frame per axis.
 */
export function* enumerateSituations(space: SituationSpace): Generator<Situation> {
  const { axes, entries } = space;
  const readKeys = new Map<string, Set<string>>();
  for (const e of entries) {
    const keys = new Set<string>();
    for (const when of collectWhens(e)) walkWhen(when, (key) => keys.add(key));
    readKeys.set(e.id, keys);
  }
  const flat: Flat = {};

  function* walk(i: number, live: Entry[]): Generator<Situation> {
    if (i === axes.length) {
      const situation = materialize(flat);
      if (situation !== undefined) yield situation;
      return;
    }
    const axis = axes[i];
    if (!live.some((e) => readKeys.get(e.id)!.has(axis.key))) {
      yield* walk(i + 1, live);
      return;
    }
    for (const value of axis.values) {
      flat[axis.key] = value;
      yield* walk(i + 1, live.filter((e) => stillLive(e.when, flat)));
    }
    delete flat[axis.key];
  }

  yield* walk(0, entries);
}
