// Threshold extractor + partitioned enumerator over the *situation* record,
// the two-subject counterpart of enumerate.ts. Walks every non-display
// entry's `when` (plus modality_by[].when), collects the axes those
// predicates read in the `<subject>:<class>:<key>` namespace, and streams one
// Situation per point of the partition.
//
// Which axes exist and what each takes comes from the generated specs
// (FACT_SPEC plus KIN/HIST/GEO_OWN/GEO_PAIR/ENV_SPEC), so a yielded situation
// is one validateSituation() accepts. Three things differ from Part A:
//
//   - `fact:rule18_class` is derived, not supplied. It is an axis over the
//     decode table's values plus absent, each realised by a witness record
//     the decode actually yields.
//   - An enum axis is partitioned by the values some predicate names, plus
//     one representative for every value none names — the enum analogue of
//     partitioning a numeric axis at its comparison constants.
//   - An axis no entry can read, given the values already chosen, is pinned
//     to one representative rather than enumerated. Entries are read in both
//     frames (colregs ADR 0016), so a pin holds for the swapped read too.
//
// Predicates are matched by reference-encounter.ts; this module only needs to
// know which axes exist and what shape their constraints take.

import { FACT_SPEC, type FactRecord } from '../../src/generated/fact-record.js';
import {
  ENV_SPEC,
  GEO_OWN_SPEC,
  GEO_PAIR_SPEC,
  HIST_SPEC,
  KIN_SPEC,
} from '../../src/generated/situation.js';
import type {
  ApplicabilityData,
  Entry,
  Predicate,
  RuleCategory,
  Situation,
  Subject,
} from '../../src/types.js';

import { numericRepresentatives } from './enumerate.js';
import { ENUM_REFINEMENTS, referenceWhenMatches } from './reference.js';
import {
  ENCOUNTER_CATEGORIES,
  RULE18_CLASS_VALUES,
  decodeRowsFor,
  referenceRule18Class,
} from './reference-encounter.js';

/** A representative value, or `undefined` for "the fact is absent". */
export type AxisValue = string | number | boolean | undefined;

export interface SituationAxis {
  /** Flat predicate key, e.g. `self:fact:position`. */
  key: string;
  kind: 'enum' | 'boolean' | 'numeric' | 'derived';
  values: readonly AxisValue[];
  /** The value used where no entry can read this axis. */
  pinned: AxisValue;
  /** Comparison constants, numeric axes only. */
  constants?: number[];
  /** Whether the axis may be pinned at all. A derived axis may not: its value
   * is a consequence of the record rather than a free choice, so pinning it
   * would drop the points its witness cannot realise. */
  prunable: boolean;
}

const SUBJECTS = ['self', 'other', 'pair'] as const;
type SubjectSlot = (typeof SUBJECTS)[number];

type Spec =
  | { kind: 'enum'; values: readonly string[] }
  | { kind: 'number' }
  | { kind: 'boolean' }
  | { kind: 'position' }
  | { kind: 'string' };

/** Self's keys also appear bare in the flat namespace, so a bare key reads
 * self (engine-notes item 8). Normalising first makes the frame swap below a
 * rename of two prefixes and nothing else. */
function normaliseKey(key: string): string {
  const head = key.slice(0, key.indexOf(':'));
  return (SUBJECTS as readonly string[]).includes(head) ? key : `self:${key}`;
}

function splitKey(key: string): { subject: SubjectSlot; cls: string; name: string } {
  const [subject, cls, ...rest] = key.split(':');
  return { subject: subject as SubjectSlot, cls, name: rest.join(':') };
}

/** The generated spec for one flat key, or undefined where the fact is
 * derived and no spec declares it. */
function specFor(key: string): Spec | undefined {
  const { subject, cls } = splitKey(key);
  const unprefixed = key.slice(subject.length + 1);
  const table: Record<string, Record<string, Spec> | undefined> =
    subject === 'pair'
      ? {
          geo: GEO_PAIR_SPEC as unknown as Record<string, Spec>,
          env: ENV_SPEC as unknown as Record<string, Spec>,
        }
      : {
          fact: FACT_SPEC as unknown as Record<string, Spec>,
          kin: KIN_SPEC as unknown as Record<string, Spec>,
          geo: GEO_OWN_SPEC as unknown as Record<string, Spec>,
          hist: HIST_SPEC as unknown as Record<string, Spec>,
        };
  const forClass = table[cls];
  if (forClass === undefined) {
    throw new Error(`situation axis ${key}: no class '${cls}' under subject '${subject}'`);
  }
  return forClass[unprefixed];
}

/** Coarse gates first, wide axes last: pinning an axis pays only once the
 * values that make it unreadable have been chosen. Ranked by the whole key
 * for a `pair` fact and by the unprefixed key otherwise, so self and other
 * rank together. */
const AXIS_ORDER: readonly string[] = [
  'pair:geo:in_sight',
  'pair:geo:risk_of_collision',
  'pair:env:narrow_channel',
  'pair:env:traffic_lane',
  'fact:propulsion',
  'fact:rule18_class',
  'fact:position',
  'fact:length_m',
  'fact:confined_to_channel',
  'fact:following_traffic_lane',
  'hist:was_overtaking',
  'pair:geo:tcpa_s',
  'pair:geo:bearing_change_deg_min',
  'kin:wind_side',
  'geo:windward',
  'geo:rel_bearing_deg',
];

function axisRank(key: string): number {
  const whole = AXIS_ORDER.indexOf(key);
  if (whole !== -1) return whole;
  const { subject } = splitKey(key);
  const unprefixed = AXIS_ORDER.indexOf(key.slice(subject.length + 1));
  return unprefixed === -1 ? AXIS_ORDER.length : unprefixed;
}

// ---------------------------------------------------------------------
// Walking the predicates
// ---------------------------------------------------------------------
function walkWhen(when: Predicate, visit: (key: string, constraint: unknown) => void): void {
  for (const [key, constraint] of Object.entries(when)) {
    if (key === 'any_of') {
      for (const sub of (constraint as unknown as Predicate[]) ?? []) walkWhen(sub, visit);
      continue;
    }
    visit(normaliseKey(key), constraint);
  }
}

function collectWhens(e: Entry): Predicate[] {
  return [e.when, ...(e.modality_by ?? []).map((b) => b.when)];
}

function isNumericConstraint(c: Record<string, unknown>): boolean {
  return 'gte' in c || 'gt' in c || 'lte' in c || 'lt' in c;
}

function walkNumeric(c: unknown, visit: (n: number) => void): void {
  if (c === null || typeof c !== 'object' || Array.isArray(c)) return;
  const obj = c as Record<string, unknown>;
  if (isNumericConstraint(obj)) {
    for (const k of ['gte', 'gt', 'lte', 'lt']) {
      if (typeof obj[k] === 'number') visit(obj[k] as number);
    }
    return;
  }
  if ('not' in obj) {
    walkNumeric(obj.not, visit);
    return;
  }
  if (Array.isArray(obj.any_of)) for (const sub of obj.any_of) walkNumeric(sub, visit);
}

function walkStrings(c: unknown, visit: (s: string) => void): void {
  if (typeof c === 'string') {
    visit(c);
    return;
  }
  if (Array.isArray(c)) {
    for (const v of c) walkStrings(v, visit);
    return;
  }
  if (c === null || typeof c !== 'object') return;
  const obj = c as Record<string, unknown>;
  if ('not' in obj) walkStrings(obj.not, visit);
  if (Array.isArray(obj.any_of)) for (const sub of obj.any_of) walkStrings(sub, visit);
}

/** The entries this partition is for: the three categories the encounter
 * verb reads, not every non-display entry. `category:conduct` reads a trace
 * and `category:departure` a solver, and an axis only they name would widen
 * the space without any encounter entry ever reading it. */
function readsSituation(e: Entry): boolean {
  return ENCOUNTER_CATEGORIES.includes((e.category ?? 'category:display') as RuleCategory);
}

// ---------------------------------------------------------------------
// Axis extraction
// ---------------------------------------------------------------------
export interface SituationExtract {
  axes: SituationAxis[];
  /** Enum values a predicate names that the generated spec does not declare. */
  undeclaredEnumValues: { axis: string; value: string }[];
}

/**
 * An enum axis's partition: every value some predicate names, plus one
 * representative for the values none names. Values none names are
 * interchangeable under equality, membership and negation alike — unless one
 * refines another, and then the axis keeps its whole declared range.
 */
function enumPartition(declared: readonly string[], referenced: ReadonlySet<string>): string[] {
  if (declared.some((v) => ENUM_REFINEMENTS[v] !== undefined)) return [...declared];
  const named = declared.filter((v) => referenced.has(v));
  const unnamed = declared.find((v) => !referenced.has(v));
  return unnamed === undefined ? named : [...named, unnamed];
}

export function extractSituationAxes(data: ApplicabilityData): SituationExtract {
  const keys = new Set<string>();
  const constants = new Map<string, Set<number>>();
  // Both keyed by the unprefixed key, so self and other share one partition:
  // the swapped frame reads self's value against an `other:` constraint.
  const strings = new Map<string, Set<string>>();

  for (const e of data.entries) {
    if (!readsSituation(e)) continue;
    for (const when of collectWhens(e)) {
      walkWhen(when, (key, constraint) => {
        const { subject } = splitKey(key);
        if (!(SUBJECTS as readonly string[]).includes(subject)) {
          throw new Error(`situation axis ${key}: '${subject}' is not a subject`);
        }
        keys.add(key);
        const unprefixed = key.slice(subject.length + 1);
        walkNumeric(constraint, (n) => {
          const set = constants.get(unprefixed) ?? new Set<number>();
          set.add(n);
          constants.set(unprefixed, set);
        });
        walkStrings(constraint, (s) => {
          const set = strings.get(unprefixed) ?? new Set<string>();
          set.add(s);
          strings.set(unprefixed, set);
        });
      });
    }
  }

  const axes: SituationAxis[] = [];
  const undeclaredEnumValues: { axis: string; value: string }[] = [];

  for (const key of [...keys].sort()) {
    const { subject } = splitKey(key);
    const unprefixed = key.slice(subject.length + 1);
    const referenced = strings.get(unprefixed) ?? new Set<string>();
    const spec = specFor(key);

    if (spec === undefined) {
      if (unprefixed !== 'fact:rule18_class') {
        throw new Error(
          `situation axis ${key} is read by a predicate but declared by no generated spec`,
        );
      }
      for (const v of referenced) {
        if (!RULE18_CLASS_VALUES.includes(v)) undeclaredEnumValues.push({ axis: key, value: v });
      }
      axes.push({
        key,
        kind: 'derived',
        values: [...enumPartition(RULE18_CLASS_VALUES, referenced), undefined],
        pinned: RULE18_CLASS_VALUES[0],
        prunable: false,
      });
      continue;
    }

    switch (spec.kind) {
      case 'enum': {
        for (const v of referenced) {
          if (!spec.values.includes(v)) undeclaredEnumValues.push({ axis: key, value: v });
        }
        const values = enumPartition(spec.values, referenced);
        axes.push({ key, kind: 'enum', values, pinned: values[0], prunable: true });
        break;
      }
      case 'boolean':
        axes.push({ key, kind: 'boolean', values: [true, false], pinned: true, prunable: true });
        break;
      case 'number': {
        const read = [...(constants.get(unprefixed) ?? new Set<number>())].sort((a, b) => a - b);
        if (read.length === 0) {
          throw new Error(`situation axis ${key} is numeric but no predicate compares it`);
        }
        const values = numericRepresentatives(read);
        axes.push({
          key,
          kind: 'numeric',
          values,
          // The median representative: a pinned numeric then reads as an
          // ordinary value rather than as the interval below the first
          // constant, which for an angle is a negative bearing.
          pinned: values[Math.floor(values.length / 2)],
          constants: read,
          prunable: true,
        });
        break;
      }
      default:
        throw new Error(`situation axis ${key}: a ${spec.kind} axis has no finite partition`);
    }
  }

  axes.sort((a, b) => axisRank(a.key) - axisRank(b.key) || a.key.localeCompare(b.key));
  return { axes, undeclaredEnumValues };
}

/** An upper bound on the enumeration, not its size: a pinned axis
 * contributes one value rather than all of them, and a rank no witness
 * realises drops the point. `enumerateSituations` counts what it yields. */
export function situationUpperBound(axes: readonly SituationAxis[]): number {
  return axes.reduce((acc, a) => acc * a.values.length, 1);
}

// ---------------------------------------------------------------------
// Which axes an entry can still read
// ---------------------------------------------------------------------
/** One predicate in one frame, reduced to what pinning needs: the keys it
 * reads anywhere, and the constraints it states at the top level. */
interface FramedWhen {
  reads: Set<string>;
  top: [string, unknown][];
}

function swapKeys(when: Predicate): Predicate {
  const out: Record<string, unknown> = {};
  for (const [rawKey, constraint] of Object.entries(when)) {
    if (rawKey === 'any_of') {
      out.any_of = ((constraint as unknown as Predicate[]) ?? []).map(swapKeys);
      continue;
    }
    const key = normaliseKey(rawKey);
    const { subject } = splitKey(key);
    const rest = key.slice(subject.length + 1);
    out[subject === 'self' ? `other:${rest}` : subject === 'other' ? `self:${rest}` : key] =
      constraint;
  }
  return out as unknown as Predicate;
}

function framed(when: Predicate): FramedWhen {
  const reads = new Set<string>();
  walkWhen(when, (key) => reads.add(key));
  const top: [string, unknown][] = [];
  for (const [rawKey, constraint] of Object.entries(when)) {
    if (rawKey === 'any_of') continue;
    top.push([normaliseKey(rawKey), constraint]);
  }
  return { reads, top };
}

function framedWhens(data: ApplicabilityData): FramedWhen[] {
  const out: FramedWhen[] = [];
  for (const e of data.entries) {
    if (!readsSituation(e)) continue;
    for (const when of collectWhens(e)) {
      out.push(framed(when));
      out.push(framed(swapKeys(when)));
    }
  }
  return out;
}

type Assignment = Map<string, AxisValue>;

function satisfiesOne(key: string, value: AxisValue, constraint: unknown): boolean {
  if (value === undefined) return false; // an absent fact satisfies nothing
  return referenceWhenMatches({ [key]: constraint } as unknown as Predicate, {
    [key]: value,
  } as unknown as FactRecord);
}

/**
 * Whether some entry that reads this axis is still compatible with the axes
 * already chosen. When none is, the axis cannot change which entries apply,
 * in either frame, so one representative stands for all of them.
 *
 * Only a `when`'s top-level constraints are consulted: a constraint inside an
 * `any_of` can fail without the entry failing, so reading one would prune a
 * point an entry does reach.
 */
function liveness(data: ApplicabilityData, axes: readonly SituationAxis[]) {
  const whens = framedWhens(data);
  const readersOf = new Map<string, FramedWhen[]>();
  const guardsOf = new Map<string, string[]>();
  for (let i = 0; i < axes.length; i++) {
    const key = axes[i].key;
    const readers = whens.filter((w) => w.reads.has(key));
    readersOf.set(key, readers);
    const earlier = new Set(axes.slice(0, i).map((a) => a.key));
    const guards = new Set<string>();
    for (const w of readers) {
      for (const [k] of w.top) if (earlier.has(k)) guards.add(k);
    }
    guardsOf.set(key, [...guards]);
  }

  const cache = new Map<string, boolean>();
  return function isLive(axis: SituationAxis, assignment: Assignment): boolean {
    const guards = guardsOf.get(axis.key)!;
    const cacheKey = `${axis.key}|${guards.map((k) => String(assignment.get(k))).join('|')}`;
    const hit = cache.get(cacheKey);
    if (hit !== undefined) return hit;
    let live = false;
    for (const w of readersOf.get(axis.key)!) {
      let compatible = true;
      for (const [k, c] of w.top) {
        if (!assignment.has(k)) continue;
        if (!satisfiesOne(k, assignment.get(k), c)) {
          compatible = false;
          break;
        }
      }
      if (compatible) {
        live = true;
        break;
      }
    }
    cache.set(cacheKey, live);
    return live;
  };
}

// ---------------------------------------------------------------------
// Realising one point as a Situation
// ---------------------------------------------------------------------
/** One value satisfying a decode row's constraint: the scalar, the first
 * member of a list, or the first `any_of` disjunct. */
function witnessValue(constraint: unknown): AxisValue {
  if (typeof constraint === 'string' || typeof constraint === 'boolean') return constraint;
  if (typeof constraint === 'number') return constraint;
  if (Array.isArray(constraint)) return witnessValue(constraint[0]);
  if (constraint !== null && typeof constraint === 'object') {
    const obj = constraint as Record<string, unknown>;
    if (Array.isArray(obj.any_of)) return witnessValue(obj.any_of[0]);
  }
  throw new Error(`no witness value for decode constraint ${JSON.stringify(constraint)}`);
}

/**
 * A fact record of the given Rule 18 rank, built on the fact axes already
 * chosen. Undefined when the rank and those axes cannot hold at once — a
 * sailing vessel is never `rule18_class:power` — so the point is dropped
 * rather than silently realised as some other rank.
 */
export function rankWitness(rank: string | undefined, chosen: FactRecord): FactRecord | undefined {
  if (rank === undefined) {
    return referenceRule18Class(chosen) === undefined ? chosen : undefined;
  }
  for (const row of decodeRowsFor(rank)) {
    const candidate: Record<string, unknown> = { ...chosen };
    for (const [key, constraint] of Object.entries(row)) {
      if (key in candidate) continue; // an enumerated axis is never overwritten
      candidate[key] = witnessValue(constraint);
    }
    const facts = candidate as FactRecord;
    if (referenceRule18Class(facts) === rank) return facts;
  }
  return undefined;
}

/** The two vessels' fact records for one point, or undefined where a rank
 * and the fact axes chosen with it cannot hold at once. Split out of
 * `buildSituation` so counting the partition uses the same realisability
 * test the enumeration does rather than a second copy of it. */
function witnessedFacts(
  axes: readonly SituationAxis[],
  assignment: Assignment,
): Record<string, FactRecord> | undefined {
  const factsOf: Record<string, Record<string, unknown>> = { self: {}, other: {} };
  const rank: Record<string, string | undefined> = {};
  const ranked = new Set<string>();
  for (const axis of axes) {
    const { subject, cls, name } = splitKey(axis.key);
    if (axis.kind === 'derived') {
      rank[subject] = assignment.get(axis.key) as string | undefined;
      ranked.add(subject);
      continue;
    }
    if (cls !== 'fact') continue;
    const value = assignment.get(axis.key);
    if (value === undefined) continue;
    factsOf[subject][`${cls}:${name}`] = value;
  }
  const out: Record<string, FactRecord> = {};
  for (const slot of ['self', 'other'] as const) {
    const fact = factsOf[slot] as FactRecord;
    if (!ranked.has(slot)) {
      out[slot] = fact;
      continue;
    }
    const witnessed = rankWitness(rank[slot], fact);
    if (witnessed === undefined) return undefined;
    out[slot] = witnessed;
  }
  return out;
}

/** The point as a Situation, or undefined when no vessel realises it. */
export function buildSituation(
  axes: readonly SituationAxis[],
  assignment: Assignment,
): Situation | undefined {
  const facts = witnessedFacts(axes, assignment);
  if (facts === undefined) return undefined;

  const classOf: Record<string, Record<string, unknown>> = {};
  for (const axis of axes) {
    const { subject, cls, name } = splitKey(axis.key);
    if (axis.kind === 'derived' || cls === 'fact') continue;
    const value = assignment.get(axis.key);
    if (value === undefined) continue;
    (classOf[`${subject}:${cls}`] ??= {})[`${cls}:${name}`] = value;
  }

  const subjects: Record<string, Subject> = {};
  for (const slot of ['self', 'other'] as const) {
    subjects[slot] = {
      fact: facts[slot],
      ...(classOf[`${slot}:kin`] ? { kin: classOf[`${slot}:kin`] } : {}),
      ...(classOf[`${slot}:geo`] ? { geo: classOf[`${slot}:geo`] } : {}),
      ...(classOf[`${slot}:hist`] ? { hist: classOf[`${slot}:hist`] } : {}),
    } as Subject;
  }

  return {
    self: subjects.self,
    other: subjects.other,
    pair: {
      ...(classOf['pair:geo'] ? { geo: classOf['pair:geo'] } : {}),
      ...(classOf['pair:env'] ? { env: classOf['pair:env'] } : {}),
    },
  } as Situation;
}

/**
 * Streams one Situation per point of the partition, in mixed-radix order over
 * `axes`, skipping the points no vessel realises. Both subjects are always
 * present: every two-subject entry but Rule 4 reads `other:` keys, and Rule 4
 * reads nothing at all.
 */
export function* enumerateSituations(
  data: ApplicabilityData,
  axes: readonly SituationAxis[],
): Generator<Situation> {
  const isLive = liveness(data, axes);
  const assignment: Assignment = new Map();

  function* walk(i: number): Generator<Situation> {
    if (i === axes.length) {
      const situation = buildSituation(axes, assignment);
      if (situation) yield situation;
      return;
    }
    const axis = axes[i];
    const values = axis.prunable && !isLive(axis, assignment) ? [axis.pinned] : axis.values;
    for (const value of values) {
      assignment.set(axis.key, value);
      yield* walk(i + 1);
    }
    assignment.delete(axis.key);
  }

  yield* walk(0);
}

export function formatSituationAxisTable(axes: readonly SituationAxis[]): string {
  const lines = ['axis                                  kind       representatives'];
  for (const a of axes) {
    lines.push(`${a.key.padEnd(38)}${a.kind.padEnd(11)}${a.values.length}`);
  }
  return lines.join('\n');
}

/**
 * How many points the partition yields, without materialising any of them:
 * the same walk as `enumerateSituations`, the same pins and the same
 * realisability test, counting leaves. Much faster than counting the
 * generator, because it allocates no Situation.
 */
export function countSituations(data: ApplicabilityData, axes: readonly SituationAxis[]): number {
  const isLive = liveness(data, axes);
  const assignment: Assignment = new Map();
  let total = 0;

  function walk(i: number): void {
    if (i === axes.length) {
      if (witnessedFacts(axes, assignment) !== undefined) total++;
      return;
    }
    const axis = axes[i];
    const values = axis.prunable && !isLive(axis, assignment) ? [axis.pinned] : axis.values;
    for (const value of values) {
      assignment.set(axis.key, value);
      walk(i + 1);
    }
    assignment.delete(axis.key);
  }

  walk(0);
  return total;
}
