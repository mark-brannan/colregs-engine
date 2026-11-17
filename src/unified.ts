// evaluate(circumstances): the unified form of the API, a second variant
// beside the three operations, not a replacement for them. One evaluation
// over self, the other vessels and the conditions; its readings are memoized
// getters, so `const { appraisal } = evaluate(c)` computes the appraisal and
// nothing else. Observing runs first and stays internal: it reads each
// vessel's `observed` notes into her detections, her bearings and, read
// backwards through evaluateSignals, the candidates for what she could be.
// The appraisal and the signals delegate to evaluateCircumstances and
// evaluateSignals over a Situation built per other vessel; where the
// candidates differ, the appraisal returns each and names what decides.
// Validation runs in evaluate() itself: assertions that contradict each
// other throw before any reading is pulled. Every `open:` line below marks a
// question the design leaves undecided and the one place the code would
// change to go the other way.

import lightsJson from 'colregs/data/lights.json' with { type: 'json' };
import {
  DEFAULT_JURISDICTION,
  RESOLVED_DATA,
  checkDataVersion,
  evaluateSignals,
  jurisdictionEntries,
  type EvaluateOptions,
} from './evaluate.js';
import { evaluateCircumstances } from './circumstances.js';
import { validateSituation } from './facts.js';
import type {
  Acts,
  DirectionalGeometry,
  Environment,
  History,
  Kinematics,
  PairGeometry,
} from './generated/situation.js';
import type {
  CircumstancesEvaluation,
  Display,
  DisplayEvaluation,
  Entry,
  FactRecord,
  RuleId,
  Situation,
  Vessel,
} from './types.js';

/** One vessel's detections of another: a set of means, each yes or no, and
 * nothing yet of what each means showed. Rule 3(k) in sight is `visual`;
 * Rule 19(d) is `radar` without it. */
export interface Detected {
  visual?: boolean;
  sound?: boolean;
  radar?: boolean;
  ais?: boolean;
  vhf?: boolean;
  assumed?: boolean;
}

/** An arc relative to the observer's heading, in colregs lights.json's
 * convention: clockwise from right ahead, wrapping through 0 when
 * `from_deg` exceeds `to_deg`. */
interface Arc {
  from_deg: number;
  to_deg: number;
}

/** One thing the vessel carrying it saw, heard or held: by what means, where
 * it lay, what it showed, and whose it was if she knows. */
export interface Observed {
  means: Exclude<keyof Detected, 'assumed'>;
  /** The id of the vessel it was; absent when nobody knows. */
  of?: string;
  /** `of` is only inferred and may be wrong: observing reads it both ways. */
  inferred?: boolean;
  /** A bearing, or an arc when it is only roughly known (a sound heard
   * forward of the beam is `{ from_deg: 270, to_deg: 90 }`). */
  bearing_rel_deg?: number | Arc;
  range_nm?: number;
  /** `visual` only: the lights made out, by colregs lights.json id. */
  lights?: string[];
  /** `sound` only: the signal heard, in the elements colregs' entries use. */
  signal?: { element: string; count?: number }[];
}

/** Pairwise geometry about one other, carried on her rather than on a pair.
 * `in_sight` is said by detections and `range_m` by `range_nm`, so neither
 * is a key here. */
export type OtherGeometry = DirectionalGeometry &
  Omit<PairGeometry, 'geo:in_sight' | 'geo:range_m'>;

/** One shape for self and every other vessel; which one is self is only
 * where she sits in the record. */
export interface CircumstancesVessel {
  /** What the others' `detected` maps and `observed` notes name her by. */
  id?: string;
  fact?: FactRecord;
  kin?: Kinematics;
  geo?: OtherGeometry;
  act?: Acts;
  hist?: History;
  /** Her detections of the others, keyed by each one's id. On an other it
   * may instead be one set, inline: self's detections of her, read as
   * self's `detected` under her id. Her `observed` notes fill it too. */
  detected?: Record<string, Detected> | Detected;
  /** Her notes: each thing she saw, heard or held. */
  observed?: Observed[];
  /** open: self's bearing and range of her still ride on her, so these two
   * are refused on self; self's notes of her say the same and are read when
   * these are absent. Bearing is relative to self's heading. */
  bearing_deg?: number;
  range_nm?: number;
}

/** The input: self, the other vessels, the conditions of the water. */
export interface Circumstances {
  /** open: optional, so a record with no observer reads through the same
   * call; the appraisal and signals then read `undefined`. Requiring it is
   * one line in validateCircumstances. */
  self?: CircumstancesVessel;
  others?: CircumstancesVessel[];
  conditions?: Environment;
}

/** What one other's appraisal rested on: a fact the caller asserted, a fact
 * her signals indicated, or nothing. */
export type RestedOn = 'asserted' | 'indicated' | 'nothing';

export interface AppraisalOfOther {
  restedOn: RestedOn;
  /** Today's two-vessel envelope over self and this other; absent when the
   * appraisal rested on nothing or the candidates part. */
  evaluation?: CircumstancesEvaluation;
  /** Where what she could be parts the answer: one envelope per candidate. */
  candidates?: { fact: FactRecord; evaluation: CircumstancesEvaluation }[];
  /** With `candidates`: paths into the circumstances to what decides. */
  decides?: string[];
  because?: string;
}

/** Part B: what binds self regardless of the others, then per other. */
export interface Appraisal {
  self: CircumstancesEvaluation;
  others: AppraisalOfOther[];
}

/** What self's notes of one other say she could be: each candidate with the
 * entries that say so and the means that bear it out, empty when nothing is
 * known. Where they differ, `decides` holds paths into the circumstances to
 * the facts or the notes that would settle it; `consistent` compares the
 * candidates with her asserted fact when both are given. */
export interface Indication {
  inSight: boolean;
  couldBe: { fact: FactRecord; by: RuleId[]; means: Observed['means'][] }[];
  decides?: string[];
  consistent?: boolean;
}

const MEANS: readonly (keyof Detected)[] = ['visual', 'sound', 'radar', 'ais', 'vhf', 'assumed'];
const NOTE_MEANS: readonly string[] = MEANS.filter((m) => m !== 'assumed');
const NOTE_KEYS = ['means', 'of', 'inferred', 'bearing_rel_deg', 'range_nm', 'lights', 'signal'];
const FROM_SELF = ['bearing_deg', 'range_nm'] as const;
const NM_IN_M = 1852;

type LightDef = { arc?: Arc; components?: string[] };
const LIGHTS = (lightsJson as unknown as { lights: Record<string, LightDef> }).lights;
/** The signal elements the data's entries sound. */
const ELEMENTS: ReadonlySet<string> = new Set(
  RESOLVED_DATA.entries
    .flatMap((e) => e.signal ?? [])
    .flatMap((s) => s.sequence.map((el) => el.element)),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The validation self's absence does not reach: an empty fact record is a
 * lawful Vessel, so every other and the conditions still pass through
 * validateSituation whether or not self was given. */
const NO_SELF: Vessel = { fact: {} };

/** An inline set has yes-or-no values; a map keyed by id has sets. */
function isInline(detected: Record<string, unknown>): boolean {
  const values = Object.values(detected);
  return values.length > 0 && values.every((v) => typeof v === 'boolean');
}

function checkDetected(set: unknown, where: string): void {
  if (!isRecord(set)) throw new Error(`${where} must be an object, got ${JSON.stringify(set)}.`);
  for (const [means, value] of Object.entries(set)) {
    if (!(MEANS as readonly string[]).includes(means)) {
      throw new Error(`unknown means '${means}' in ${where}; means: ${MEANS.join(', ')}.`);
    }
    if (typeof value !== 'boolean') {
      throw new Error(`${where}.${means} is yes or no, got ${JSON.stringify(value)}.`);
    }
  }
}

function checkNamed(id: string, where: string, ids: ReadonlySet<string>, own: unknown): void {
  if (!ids.has(id) || id === own) {
    throw new Error(`${where} names '${id}', which is no other vessel's id in the circumstances.`);
  }
}

/** A map of detections, keyed by the id of a vessel in the record other than
 * the one carrying it. */
function checkKeyed(
  detected: Record<string, unknown>,
  where: string,
  ids: ReadonlySet<string>,
  own: unknown,
): void {
  for (const [id, set] of Object.entries(detected)) {
    checkNamed(id, where, ids, own);
    checkDetected(set, `${where}.${id}`);
  }
}

function isArc(value: unknown): value is Arc {
  return isRecord(value) && typeof value.from_deg === 'number' && typeof value.to_deg === 'number';
}

function checkNote(note: unknown, where: string, ids: ReadonlySet<string>, own: unknown): void {
  if (!isRecord(note)) throw new Error(`${where} must be an object, got ${JSON.stringify(note)}.`);
  for (const key of Object.keys(note)) {
    if (!NOTE_KEYS.includes(key)) {
      throw new Error(`unknown ${where} key '${key}'; keys: ${NOTE_KEYS.join(', ')}.`);
    }
  }
  if (!NOTE_MEANS.includes(note.means as string)) {
    throw new Error(
      `${where}.means is one of ${NOTE_MEANS.join(', ')}, got ${JSON.stringify(note.means)}.`,
    );
  }
  if (note.of !== undefined) {
    if (typeof note.of !== 'string') throw new Error(`${where}.of expects a vessel's id.`);
    checkNamed(note.of, `${where}.of`, ids, own);
  }
  if (note.inferred !== undefined && typeof note.inferred !== 'boolean') {
    throw new Error(`${where}.inferred is yes or no.`);
  }
  if (note.inferred === true && note.of === undefined) {
    throw new Error(`${where}.inferred says whose it is taken for, so it needs an of.`);
  }
  const b = note.bearing_rel_deg;
  if (b !== undefined && typeof b !== 'number' && !isArc(b)) {
    throw new Error(`${where}.bearing_rel_deg is a number or { from_deg, to_deg }.`);
  }
  if (note.range_nm !== undefined && typeof note.range_nm !== 'number') {
    throw new Error(`${where}.range_nm expects a number.`);
  }
  if (note.lights !== undefined) {
    if (note.means !== 'visual') throw new Error(`${where}.lights are made out by visual only.`);
    if (!Array.isArray(note.lights) || note.lights.some((l) => !(l in LIGHTS))) {
      throw new Error(
        `${where}.lights is a list of lights.json ids: ${Object.keys(LIGHTS).join(', ')}.`,
      );
    }
  }
  if (note.signal !== undefined) {
    if (note.means !== 'sound') throw new Error(`${where}.signal is heard by sound only.`);
    const ok =
      Array.isArray(note.signal) &&
      note.signal.length > 0 &&
      note.signal.every(
        (s) =>
          isRecord(s) &&
          typeof s.element === 'string' &&
          (s.count === undefined || typeof s.count === 'number'),
      );
    if (!ok) throw new Error(`${where}.signal is a list of { element, count }.`);
    if ((note.signal as { element: string }[]).some((s) => !ELEMENTS.has(s.element))) {
      throw new Error(`${where}.signal elements are the data's: ${[...ELEMENTS].join(', ')}.`);
    }
  }
}

function checkNotes(v: Record<string, unknown>, where: string, ids: ReadonlySet<string>): void {
  if (v.observed === undefined) return;
  if (!Array.isArray(v.observed)) throw new Error(`${where}.observed must be a list.`);
  v.observed.forEach((n, j) => checkNote(n, `${where}.observed[${j}]`, ids, v.id));
}

/** Every id in the record: strings, and no two vessels alike. */
function idsOf(c: Circumstances): Set<string> {
  const ids = new Set<string>();
  const vessels: [string, unknown][] = [['circumstances.self', c.self]];
  (c.others ?? []).forEach((o, i) => vessels.push([`circumstances.others[${i}]`, o]));
  for (const [where, v] of vessels) {
    if (!isRecord(v) || v.id === undefined) continue;
    if (typeof v.id !== 'string') {
      throw new Error(`${where}.id expects a string, got ${JSON.stringify(v.id)}.`);
    }
    if (ids.has(v.id)) throw new Error(`${where}.id '${v.id}' is another vessel's too.`);
    ids.add(v.id);
  }
  return ids;
}

/** One of a vessel's notes of another, with its path in the circumstances. */
interface Note {
  entry: Observed;
  path: string;
}

function notesOf(
  by: CircumstancesVessel | undefined,
  path: string,
  of: string | undefined,
): Note[] {
  if (by === undefined || of === undefined) return [];
  return (by.observed ?? []).flatMap((entry, j) =>
    entry.of === of ? [{ entry, path: `${path}.observed[${j}]` }] : [],
  );
}

/** Written detections, filled from the notes that name a vessel surely; a
 * note and a written no for the same means throw. */
function filled(written: Detected | undefined, notes: Note[], where: string): Detected | undefined {
  const set: Detected = { ...written };
  let any = written !== undefined;
  for (const { entry, path } of notes) {
    if (entry.inferred === true) continue;
    if (set[entry.means] === false) {
      throw new Error(`${where}.${entry.means} is no, but ${path} says ${entry.means}.`);
    }
    set[entry.means] = true;
    any = true;
  }
  return any ? set : undefined;
}

function mod360(x: number): number {
  return ((x % 360) + 360) % 360;
}

function firstBearing(notes: Note[]): number | undefined {
  const n = notes.find(
    (x) => x.entry.inferred !== true && typeof x.entry.bearing_rel_deg === 'number',
  );
  return n?.entry.bearing_rel_deg as number | undefined;
}

function firstRange(notes: Note[]): number | undefined {
  return notes.find((x) => x.entry.inferred !== true && x.entry.range_nm !== undefined)?.entry
    .range_nm;
}

/** What observing reads of one pair, self and the other at index i. */
interface View {
  /** Rule 3(k): either vessel observes the other visually. */
  inSight: boolean;
  /** Self's bearing of her, and hers of self, each in its own frame. */
  selfBearing?: number;
  herBearing?: number;
  range_nm?: number;
  /** Self's notes of her. */
  notes: Note[];
}

function viewOf(c: Circumstances, i: number): View {
  const other = (c.others ?? [])[i];
  const where = `circumstances.others[${i}]`;
  const self = c.self;
  const map = self?.detected as Record<string, Detected> | undefined;
  const keyed =
    other.id !== undefined && map !== undefined && Object.hasOwn(map, other.id)
      ? map[other.id]
      : undefined;
  const inline =
    isRecord(other.detected) && isInline(other.detected) ? (other.detected as Detected) : undefined;
  if (inline && keyed) {
    throw new Error(
      `${where}: self's detections of her are given twice, in circumstances.self.detected['${other.id}'] and inline; give one.`,
    );
  }
  const herMap = inline ? undefined : (other.detected as Record<string, Detected> | undefined);
  const herWritten =
    self?.id !== undefined && herMap !== undefined && Object.hasOwn(herMap, self.id)
      ? herMap[self.id]
      : undefined;
  const notes = notesOf(self, 'self', other.id);
  const herNotes = notesOf(other, `others[${i}]`, self?.id);
  const detected = filled(keyed ?? inline, notes, `${where}: self's detections of her`);
  const hers = filled(herWritten, herNotes, `${where}: her detections of self`);
  if (detected === undefined && hers === undefined) {
    throw new Error(
      `${where} is detected by no means: give self's detections of her in circumstances.self.detected under her id, inline in her detected, or as a note in either vessel's observed.`,
    );
  }
  // open: in sight when either vessel observes the other (3(k)'s "one can be
  // observed visually from the other"); requiring both is an `&&` here.
  const inSight = detected?.visual === true || hers?.visual === true;
  const selfHeading = self?.kin?.['kin:heading_deg'];
  const herHeading = other.kin?.['kin:heading_deg'];
  const across = (b: number | undefined, from: number | undefined, to: number | undefined) =>
    b === undefined || from === undefined || to === undefined
      ? undefined
      : mod360(from + b + 180 - to);
  const wrap = (b: number | undefined) => (b === undefined ? undefined : mod360(b));
  const said = {
    self: wrap(other.bearing_deg ?? firstBearing(notes)),
    her: wrap(other.geo?.['geo:rel_bearing_deg'] ?? firstBearing(herNotes)),
  };
  return {
    inSight,
    selfBearing: said.self ?? across(said.her, herHeading, selfHeading),
    herBearing: said.her ?? across(said.self, selfHeading, herHeading),
    range_nm: other.range_nm ?? firstRange(notes) ?? firstRange(herNotes),
    notes,
  };
}

function vesselOf(v: CircumstancesVessel, geo: DirectionalGeometry | undefined): Vessel {
  const vessel: Vessel = { fact: v.fact as FactRecord };
  if (v.kin !== undefined) vessel.kin = v.kin;
  if (v.act !== undefined) vessel.act = v.act;
  if (v.hist !== undefined) vessel.hist = v.hist;
  if (geo !== undefined && Object.keys(geo).length > 0) vessel.geo = geo;
  return vessel;
}

function checkSelf(self: unknown, c: Circumstances, ids: ReadonlySet<string>): void {
  const where = 'circumstances.self';
  if (!isRecord(self)) throw new Error(`${where} must be an object, got ${JSON.stringify(self)}.`);
  if (!isRecord(self.fact)) {
    throw new Error(
      `${where}.fact is required and must be an object, got ${JSON.stringify(self.fact)}.`,
    );
  }
  for (const key of FROM_SELF) {
    if (self[key] !== undefined)
      throw new Error(`${where}.${key} is said from self, so only an other carries it.`);
  }
  if (self.detected !== undefined) {
    if (!isRecord(self.detected) || isInline(self.detected)) {
      throw new Error(`${where}.detected is a map keyed by each other vessel's id.`);
    }
    checkKeyed(self.detected, `${where}.detected`, ids, self.id);
  }
  checkNotes(self, where, ids);
  const vessel = self as CircumstancesVessel;
  validateSituation({
    self: vesselOf(vessel, vessel.geo as DirectionalGeometry | undefined),
    pair: { env: c.conditions },
  });
}

function checkOther(other: unknown, i: number, c: Circumstances, ids: ReadonlySet<string>): void {
  const where = `circumstances.others[${i}]`;
  if (!isRecord(other))
    throw new Error(`${where} must be an object, got ${JSON.stringify(other)}.`);
  if (other.detected !== undefined) {
    if (!isRecord(other.detected)) {
      throw new Error(
        `${where}.detected must be an object, got ${JSON.stringify(other.detected)}.`,
      );
    }
    if (isInline(other.detected)) checkDetected(other.detected, `${where}.detected`);
    else checkKeyed(other.detected, `${where}.detected`, ids, other.id);
  }
  checkNotes(other, where, ids);
  if (
    other.fact === undefined &&
    notesOf(c.self, 'self', other.id as string | undefined).length === 0
  ) {
    throw new Error(`${where} needs a fact, a note of her in self's observed, or both.`);
  }
  for (const key of FROM_SELF) {
    if (other[key] !== undefined && typeof other[key] !== 'number') {
      throw new Error(`${where}.${key} expects a number, got ${JSON.stringify(other[key])}.`);
    }
  }
  if (other.geo !== undefined) {
    if (!isRecord(other.geo)) {
      throw new Error(`${where}.geo must be an object, got ${JSON.stringify(other.geo)}.`);
    }
    for (const key of ['geo:in_sight', 'geo:range_m'] as const) {
      if (key in other.geo) {
        throw new Error(
          `${where}.geo must not carry '${key}'; say it with ${key === 'geo:in_sight' ? 'detected' : 'range_nm'}.`,
        );
      }
    }
  }
  const view = viewOf(c, i);
  validateSituation(situationFor(NO_SELF, other as CircumstancesVessel, view, c.conditions));
}

/** Throws unless the record is well formed and its assertions agree with
 * each other. Shape and vocabulary errors come from validateSituation, on
 * the same terms as the three operations. */
export function validateCircumstances(c: Circumstances): Circumstances {
  if (typeof c !== 'object' || c === null || Array.isArray(c)) {
    throw new Error(`circumstances must be an object, got ${JSON.stringify(c)}.`);
  }
  if (c.others !== undefined && !Array.isArray(c.others)) {
    throw new Error('circumstances.others must be a list.');
  }
  const ids = idsOf(c);
  if (c.self !== undefined) checkSelf(c.self, c, ids);
  else if (c.conditions !== undefined)
    validateSituation({ self: NO_SELF, pair: { env: c.conditions } });
  (c.others ?? []).forEach((o, i) => checkOther(o, i, c, ids));
  return c;
}

/** Own-frame geometry keys stay on the other; the rest of her `geo` is the
 * pair's. */
const OWN_GEO: Record<keyof DirectionalGeometry, true> = {
  'geo:rel_bearing_deg': true,
  'geo:windward': true,
};

function pairGeo(other: CircumstancesVessel, view: View): PairGeometry {
  const geo: PairGeometry = { 'geo:in_sight': view.inSight };
  if (view.range_nm !== undefined) geo['geo:range_m'] = view.range_nm * NM_IN_M;
  // Every key not in her own frame is the pair's, unknown ones included, so
  // validateSituation names them instead of this dropping them.
  for (const [key, value] of Object.entries(other.geo ?? {})) {
    if (!(key in OWN_GEO)) (geo as Record<string, unknown>)[key] = value;
  }
  return geo;
}

function ownGeo(other: CircumstancesVessel, bearing: number | undefined): DirectionalGeometry {
  const own: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(other.geo ?? {})) if (key in OWN_GEO) own[key] = value;
  if (bearing !== undefined) own['geo:rel_bearing_deg'] = bearing;
  return own as DirectionalGeometry;
}

/** Today's two-vessel Situation over self and one other: each bearing lands
 * in its vessel's own frame, the range and whether they are in sight in the
 * pair's. Ids, detection maps and notes stay out of it. */
function situationFor(
  self: CircumstancesVessel | Vessel,
  other: CircumstancesVessel,
  view: View,
  conditions?: Environment,
): Situation {
  const selfGeo: DirectionalGeometry = { ...(self.geo as DirectionalGeometry | undefined) };
  if (view.selfBearing !== undefined) selfGeo['geo:rel_bearing_deg'] = view.selfBearing;
  const s: Situation = { self: vesselOf(self as CircumstancesVessel, selfGeo) };
  s.other = vesselOf({ ...other, fact: other.fact ?? {} }, ownGeo(other, view.herBearing));
  s.pair = { geo: pairGeo(other, view) };
  if (conditions !== undefined) s.pair.env = conditions;
  return s;
}

// Observing, read backwards: which fact records would show what was made
// out. open: the hypotheses are a power-driven and a sailing vessel underway
// with no activity, in good visibility and in restricted; letting in the
// vessels Rules 24, 26 and 27 light is widening this list, nothing else.
const HYPOTHESES: FactRecord[] = (['propulsion:power', 'propulsion:sail'] as const).flatMap((p) =>
  (['visibility:good', 'visibility:restricted'] as const).flatMap((vis) =>
    [true, false].map((mw) => ({
      'fact:propulsion': p,
      'fact:activity': 'activity:none',
      'fact:position': 'position:underway',
      'fact:making_way': mw,
      'fact:visibility': vis,
    })),
  ),
);

/** Quarter-degree points off every boundary, where an arc reads one way. */
const AROUND = Array.from({ length: 720 }, (_, k) => k * 0.5 + 0.25);

function inArc(x: number, arc: Arc | null | undefined): boolean {
  if (arc == null) return true;
  return arc.from_deg <= arc.to_deg
    ? x >= arc.from_deg && x <= arc.to_deg
    : x >= arc.from_deg || x <= arc.to_deg;
}

function expand(light: string): string[] {
  return LIGHTS[light]?.components ?? [light];
}

/** An entry by id among those in force, the set `evaluateSignals` displays
 * from: the jurisdiction's own over an `intl` one of the same id, suppressed
 * `intl` entries absent. */
function entryOf(id: string, opts: EvaluateOptions): Entry | undefined {
  const inForce = jurisdictionEntries(
    opts.data ?? RESOLVED_DATA,
    opts.jurisdiction ?? DEFAULT_JURISDICTION,
  );
  return (
    inForce.find((e) => e.id === id && e.jurisdiction !== 'intl') ??
    inForce.find((e) => e.id === id)
  );
}

function sameSignal(heard: NonNullable<Observed['signal']>, entry: Entry | undefined): boolean {
  return (entry?.signal ?? []).some(
    (ref) =>
      ref.sequence.length === heard.length &&
      ref.sequence.every((el, k) => {
        const want = el.count ?? 1;
        const got = heard[k].count ?? 1;
        return el.element === heard[k].element && (el.at_least ? got >= want : got === want);
      }),
  );
}

/** The fact keys an entry's `when` reads, at any depth. */
function factKeys(when: unknown, into: Set<string>): Set<string> {
  if (Array.isArray(when)) when.forEach((w) => factKeys(w, into));
  else if (isRecord(when)) {
    for (const [key, value] of Object.entries(when)) {
      if (key.startsWith('fact:')) into.add(key);
      factKeys(value, into);
    }
  }
  return into;
}

type Candidate = Indication['couldBe'][number];

/** Whether one display shows what was made out from where self lies, and if
 * so the entries it rests on and the means that bear it out: every light it
 * must show toward self made out, every signal heard its own. */
function fits(
  d: Display,
  notes: Observed[],
  herBearing: number | undefined,
  opts: EvaluateOptions,
): { by: Set<string>; means: Set<Observed['means']> } | undefined {
  const by = new Set<string>();
  const means = new Set<Observed['means']>();
  const seen = new Set(notes.flatMap((n) => n.lights ?? []).flatMap(expand));
  if (seen.size > 0) {
    const shown = d.lights.flatMap((l) =>
      expand(l.spec.light).map((id) => ({
        id,
        entry: l.source_entry,
        must: l.modality === 'modality:shall',
      })),
    );
    for (const id of seen) {
      const hits = shown.filter((s) => s.id === id);
      if (hits.length === 0) return undefined;
      hits.forEach((h) => by.add(h.entry));
    }
    const sector = (herBearing !== undefined ? [herBearing] : AROUND).filter((x) =>
      [...seen].every((id) => inArc(x, LIGHTS[id]?.arc)),
    );
    if (sector.length === 0) return undefined;
    let missed = false;
    for (const s of shown) {
      if (!s.must || seen.has(s.id) || !sector.every((x) => inArc(x, LIGHTS[s.id]?.arc))) continue;
      missed = true;
      by.add(s.entry);
    }
    if (!missed) means.add('visual');
  }
  for (const n of notes) {
    if (n.signal === undefined) continue;
    const id = d.entries.find((e) => sameSignal(n.signal!, entryOf(e, opts)));
    if (id === undefined) return undefined;
    by.add(id);
    means.add('sound');
  }
  return { by, means };
}

function valueOf(fact: FactRecord, key: string): unknown {
  return (fact as Record<string, unknown>)[key];
}

function factId(fact: FactRecord): string {
  return JSON.stringify(Object.entries(fact).sort(([a], [b]) => a.localeCompare(b)));
}

/** Candidates for one world, a set of notes all held to be hers. A world
 * with nothing to read back has the one empty candidate. */
function readWorld(
  world: Observed[],
  herBearing: number | undefined,
  read: (fact: FactRecord) => DisplayEvaluation,
  opts: EvaluateOptions,
): Candidate[] {
  const readable = world.filter((n) => (n.lights?.length ?? 0) > 0 || n.signal !== undefined);
  if (readable.length === 0) {
    return [{ fact: {}, by: [], means: [...new Set(world.map((n) => n.means))] }];
  }
  const found = new Map<string, Candidate>();
  for (const h of HYPOTHESES) {
    for (const d of read(h).displays) {
      const fit = fits(d, readable, herBearing, opts);
      if (fit === undefined) continue;
      const keys = new Set<string>();
      for (const id of fit.by) factKeys(entryOf(id, opts)?.when, keys);
      const fact = Object.fromEntries(Object.entries(h).filter(([k]) => keys.has(k)));
      merge(found, [{ fact, by: [...fit.by], means: [...fit.means] }]);
    }
  }
  return [...found.values()];
}

function merge(into: Map<string, Candidate>, from: Candidate[]): void {
  for (const c of from) {
    const key = factId(c.fact);
    const had = into.get(key);
    into.set(key, {
      fact: c.fact,
      by: [...new Set([...(had?.by ?? []), ...c.by])],
      means: [...new Set([...(had?.means ?? []), ...c.means])],
    });
  }
}

/** Self's notes of one other read backwards. A note whose owner is only
 * inferred is read both ways, as hers and as not; the candidates of every
 * way are returned together. */
function readIndication(
  other: CircumstancesVessel,
  i: number,
  view: View,
  read: (fact: FactRecord) => DisplayEvaluation,
  opts: EvaluateOptions,
): Indication {
  const sure = view.notes.filter((n) => n.entry.inferred !== true).map((n) => n.entry);
  const doubt = view.notes.filter((n) => n.entry.inferred === true);
  const worlds: { mask: number; cands: Candidate[] }[] = [];
  // Notes with no lights and no signal read as nothing, so worlds differing
  // only in them read alike: each distinct set of readable notes is read once.
  const readable = (n: Observed) => (n.lights?.length ?? 0) > 0 || n.signal !== undefined;
  const readOnce = new Map<string, Candidate[]>();
  for (let mask = 0; mask < 1 << doubt.length; mask++) {
    const held = doubt.filter((_, k) => mask & (1 << k));
    const world = [...sure, ...held.map((n) => n.entry)];
    const means = [...new Set(held.map((n) => n.entry.means))].sort();
    const key = `${held
      .filter((n) => readable(n.entry))
      .map((n) => n.path)
      .join('|')}#${means.join(',')}`;
    if (!readOnce.has(key)) readOnce.set(key, readWorld(world, view.herBearing, read, opts));
    worlds.push({ mask, cands: readOnce.get(key)! });
  }
  const all = new Map<string, Candidate>();
  worlds.forEach((w) => merge(all, w.cands));
  const couldBe = [...all.values()].every((c) => Object.keys(c.fact).length === 0)
    ? []
    : [...all.values()];
  const indication: Indication = { inSight: view.inSight, couldBe };
  if (couldBe.length > 1) {
    const ids = (on: boolean, k: number) =>
      [
        ...new Set(
          worlds
            .filter((w) => Boolean(w.mask & (1 << k)) === on)
            .flatMap((w) => w.cands.map((c) => factId(c.fact))),
        ),
      ]
        .sort()
        .join('|');
    const decides = doubt.flatMap((n, k) =>
      ids(true, k) === ids(false, k) ? [] : [`${n.path}.of`],
    );
    const keys = new Set(couldBe.flatMap((c) => Object.keys(c.fact)));
    for (const key of keys) {
      const values = new Set(couldBe.filter((c) => key in c.fact).map((c) => valueOf(c.fact, key)));
      if (values.size > 1) decides.push(`others[${i}].fact.${key}`);
    }
    indication.decides = decides;
  }
  const asserted = other.fact ?? {};
  if (Object.keys(asserted).length > 0 && couldBe.length > 0) {
    indication.consistent = couldBe.some((c) =>
      Object.entries(c.fact).every(([k, v]) => !(k in asserted) || valueOf(asserted, k) === v),
    );
  }
  return indication;
}

/** One evaluation of the circumstances. Each reading is computed on first
 * access and kept; a getter on a prototype is invisible to a spread and to
 * JSON.stringify, which is what toJSON is for. */
export class Evaluation {
  readonly #c: Circumstances;
  readonly #opts: EvaluateOptions;
  readonly #memo = new Map<string, unknown>();

  constructor(circumstances: Circumstances, opts: EvaluateOptions) {
    this.#c = circumstances;
    this.#opts = opts;
  }

  #once<T>(key: string, compute: () => T): T {
    if (!this.#memo.has(key)) this.#memo.set(key, compute());
    return this.#memo.get(key) as T;
  }

  /** Observing: what each pair's notes and detections say, before any
   * appraisal. Internal; no reading of its own. */
  #views(): View[] {
    return this.#once('views', () => (this.#c.others ?? []).map((_, i) => viewOf(this.#c, i)));
  }

  #signalsOf = (fact: FactRecord): DisplayEvaluation => {
    const memo = this.#once('hypotheses', () => new Map<FactRecord, DisplayEvaluation>());
    if (!memo.has(fact)) memo.set(fact, evaluateSignals(fact, this.#opts));
    return memo.get(fact)!;
  };

  #envelope(other: CircumstancesVessel, i: number, fact: FactRecord): CircumstancesEvaluation {
    const situation = situationFor(
      this.#c.self!,
      { ...other, fact },
      this.#views()[i],
      this.#c.conditions,
    );
    return evaluateCircumstances(situation, this.#opts);
  }

  /** Part B, Rule 2: what binds self regardless, then per other vessel. An
   * asserted fact is rested on as given; with none, the indication's
   * candidates are, each in turn when their envelopes differ. */
  get appraisal(): Appraisal | undefined {
    return this.#once('appraisal', () => {
      const self = this.#c.self;
      if (self === undefined) return undefined;
      const others = (this.#c.others ?? []).map((other, i): AppraisalOfOther => {
        const asserted = other.fact;
        const { couldBe, decides } =
          asserted !== undefined && Object.keys(asserted).length > 0
            ? { couldBe: [], decides: undefined }
            : this.indicated[i];
        if (couldBe.length === 0) {
          if (asserted === undefined) {
            return {
              restedOn: 'nothing',
              because: `other vessel not asserted; see indicated[${i}]`,
            };
          }
          return { restedOn: 'asserted', evaluation: this.#envelope(other, i, asserted) };
        }
        const candidates = couldBe.map((c) => ({
          fact: c.fact,
          evaluation: this.#envelope(other, i, c.fact),
        }));
        const one = JSON.stringify(candidates[0].evaluation);
        if (candidates.every((c) => JSON.stringify(c.evaluation) === one)) {
          return { restedOn: 'indicated', evaluation: candidates[0].evaluation };
        }
        return { restedOn: 'indicated', candidates, decides: decides ?? [] };
      });
      const alone = vesselOf(self, self.geo as DirectionalGeometry | undefined);
      return {
        self: evaluateCircumstances({ self: alone, pair: { env: this.#c.conditions } }, this.#opts),
        others,
      };
    });
  }

  /** Parts C and D for self: every lawful display, as evaluateSignals reads
   * it. Sound signals are not read here yet. */
  get signals(): DisplayEvaluation | undefined {
    return this.#once('signals', () =>
      this.#c.self === undefined
        ? undefined
        : evaluateSignals(this.#c.self.fact as FactRecord, this.#opts),
    );
  }

  /** Per other vessel, what self's notes of her say she could be. */
  get indicated(): Indication[] {
    return this.#once('indicated', () =>
      (this.#c.others ?? []).map((other, i) =>
        readIndication(other, i, this.#views()[i], this.#signalsOf, this.#opts),
      ),
    );
  }

  /** Over time only: an instant has no compliance to read. */
  get compliance(): never {
    throw new Error(
      'compliance reads over a track, not an instant; evaluate(track) is not built yet, use evaluateCompliance(trace)',
    );
  }

  toJSON(): { appraisal?: Appraisal; signals?: DisplayEvaluation; indicated: Indication[] } {
    return { appraisal: this.appraisal, signals: this.signals, indicated: this.indicated };
  }
}

/**
 * Validates `circumstances` and returns an {@link Evaluation} whose readings
 * compute on first access. `opts` is the three operations' own options bag,
 * handed to each delegate unchanged.
 *
 * @alpha
 */
export function evaluate(circumstances: Circumstances, opts: EvaluateOptions = {}): Evaluation {
  checkDataVersion(opts);
  return new Evaluation(validateCircumstances(circumstances), opts);
}
