// evaluate(circumstances): the unified form of the API, a second variant
// beside the three operations, not a replacement for them. One evaluation
// over self, the other vessels and the conditions; its readings are memoized
// getters, so `const { appraisal } = evaluate(c)` computes the appraisal and
// nothing else. The appraisal and the signals delegate to
// evaluateCircumstances and evaluateSignals over a Situation built per other
// vessel; the indication and compliance are stubs with their shapes typed.
// Self and every other are one shape; self's detections of each other are
// read from self's map under her id, or from one set inline on her.
// Validation runs in evaluate() itself: assertions that contradict each
// other throw before any reading is pulled. Every `open:` line below marks a
// question the design leaves undecided and the one place the code would
// change to go the other way.

import { checkDataVersion, evaluateSignals, type EvaluateOptions } from './evaluate.js';
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
  DisplayEvaluation,
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

/** What self sees or hears of her: never what she exhibits, which is hers. */
export interface Observed {
  lights?: string[];
  shapes?: string[];
  sounds?: string[];
}

/** Pairwise geometry about one other, carried on her rather than on a pair.
 * `in_sight` is said by `detected` and `range_m` by `range_nm`, so neither
 * is a key here. */
export type OtherGeometry = DirectionalGeometry &
  Omit<PairGeometry, 'geo:in_sight' | 'geo:range_m'>;

/** One shape for self and every other vessel; which one is self is only
 * where she sits in the record. */
export interface CircumstancesVessel {
  /** What the others' `detected` maps key her by. */
  id?: string;
  fact?: FactRecord;
  kin?: Kinematics;
  geo?: OtherGeometry;
  act?: Acts;
  hist?: History;
  /** Her detections of the others, keyed by each one's id. On an other it
   * may instead be one set, inline: self's detections of her, read as
   * self's `detected` under her id. */
  detected?: Record<string, Detected> | Detected;
  /** open: self's perception of her still rides on her, so these three are
   * refused on self; moving them under self, keyed by her id, changes
   * situationFor and the checks, nothing else. Bearing is relative to self's
   * heading; range is from self. */
  bearing_deg?: number;
  range_nm?: number;
  observed?: Observed;
}

/** The input: self, the other vessels, the conditions of the water. */
export interface Circumstances {
  /** open: optional, so the inverse question (observed lights, no self)
   * reads through the same call; the appraisal and signals then read
   * `undefined`. Requiring it is one line in validateCircumstances. */
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
   * appraisal rested on nothing. */
  evaluation?: CircumstancesEvaluation;
  because?: string;
}

/** Part B: what binds self regardless of the others, then per other. */
export interface Appraisal {
  self: CircumstancesEvaluation;
  others: AppraisalOfOther[];
}

/** Parts C and D read backwards: what one other's observed signals say she
 * could be, by which entries; `consistent` compares that with her asserted
 * fact when both are given. */
export interface Indication {
  couldBe: { fact: FactRecord; by: RuleId[] }[];
  consistent?: boolean;
}

const MEANS: readonly (keyof Detected)[] = ['visual', 'sound', 'radar', 'ais', 'vhf', 'assumed'];
const FROM_SELF = ['bearing_deg', 'range_nm', 'observed'] as const;
const OBSERVED_KEYS = ['lights', 'shapes', 'sounds'] as const;
const NM_IN_M = 1852;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkObserved(observed: unknown, where: string): void {
  if (!isRecord(observed)) {
    throw new Error(`${where}.observed must be an object, got ${JSON.stringify(observed)}.`);
  }
  for (const key of Object.keys(observed)) {
    if (!(OBSERVED_KEYS as readonly string[]).includes(key)) {
      throw new Error(`unknown ${where}.observed key '${key}'; keys: ${OBSERVED_KEYS.join(', ')}.`);
    }
    const list = observed[key];
    if (list !== undefined && !(Array.isArray(list) && list.every((x) => typeof x === 'string'))) {
      throw new Error(`${where}.observed.${key} must be a list of strings.`);
    }
  }
}

function seen(observed: Observed | undefined): boolean {
  return (observed?.lights?.length ?? 0) > 0 || (observed?.shapes?.length ?? 0) > 0;
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

/** A map of detections, keyed by the id of a vessel in the record other than
 * the one carrying it. */
function checkKeyed(
  detected: Record<string, unknown>,
  where: string,
  ids: ReadonlySet<string>,
  own: unknown,
): void {
  for (const [id, set] of Object.entries(detected)) {
    if (!ids.has(id) || id === own) {
      throw new Error(
        `${where} names '${id}', which is no other vessel's id in the circumstances.`,
      );
    }
    checkDetected(set, `${where}.${id}`);
  }
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

/** Self's detections of one other: under her id in self's map, or inline on
 * her; the engine reads one set either way. */
function detectionsOf(c: Circumstances, other: CircumstancesVessel): Detected | undefined {
  const map = c.self?.detected as Record<string, Detected> | undefined;
  if (other.id !== undefined && map !== undefined && Object.hasOwn(map, other.id)) {
    return map[other.id];
  }
  return isRecord(other.detected) && isInline(other.detected) ? other.detected : undefined;
}

function vesselOf(v: CircumstancesVessel, geo: DirectionalGeometry | undefined): Vessel {
  const vessel: Vessel = { fact: v.fact as FactRecord };
  if (v.kin !== undefined) vessel.kin = v.kin;
  if (v.act !== undefined) vessel.act = v.act;
  if (v.hist !== undefined) vessel.hist = v.hist;
  if (geo !== undefined) vessel.geo = geo;
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
  const vessel = other as CircumstancesVessel;
  const inline = isRecord(other.detected) && isInline(other.detected);
  const keyed =
    vessel.id !== undefined &&
    isRecord(c.self?.detected) &&
    Object.hasOwn(c.self.detected, vessel.id);
  if (inline && keyed) {
    throw new Error(
      `${where}: self's detections of her are given twice, in circumstances.self.detected['${vessel.id}'] and inline; give one.`,
    );
  }
  const detected = detectionsOf(c, vessel);
  if (detected === undefined) {
    throw new Error(
      `${where} is detected by no means: give self's detections of her in circumstances.self.detected under her id, or inline in her detected.`,
    );
  }
  if (other.fact === undefined && other.observed === undefined) {
    throw new Error(`${where} needs a fact, an observed, or both.`);
  }
  if (other.observed !== undefined) checkObserved(other.observed, where);
  // open: a fact and an observed on one other are allowed to coexist; a
  // disagreement between them is the indication's finding, not an error.
  // Forbidding it is one throw here.
  const observed = other.observed as Observed | undefined;
  if (detected.visual !== true && seen(observed)) {
    throw new Error(
      `${where}: lights or shapes observed need detected.visual true; Rule 11 reads in sight only.`,
    );
  }
  for (const key of ['bearing_deg', 'range_nm'] as const) {
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
  validateSituation(situationFor(NO_SELF, vessel, detected, c.conditions));
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

function pairGeo(other: CircumstancesVessel, detected: Detected): PairGeometry {
  const geo: PairGeometry = { 'geo:in_sight': detected.visual === true };
  if (other.range_nm !== undefined) geo['geo:range_m'] = other.range_nm * NM_IN_M;
  // Every key not in her own frame is the pair's, unknown ones included, so
  // validateSituation names them instead of this dropping them.
  for (const [key, value] of Object.entries(other.geo ?? {})) {
    if (!(key in OWN_GEO)) (geo as Record<string, unknown>)[key] = value;
  }
  return geo;
}

function ownGeo(other: CircumstancesVessel): DirectionalGeometry | undefined {
  const own: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(other.geo ?? {})) if (key in OWN_GEO) own[key] = value;
  return Object.keys(own).length > 0 ? (own as DirectionalGeometry) : undefined;
}

/** Today's two-vessel Situation over self and one other: her bearing lands
 * in self's own frame, her range and whether self has her in sight in the
 * pair's. Ids and detection maps stay out of it. */
export function situationFor(
  self: CircumstancesVessel,
  other: CircumstancesVessel,
  detected: Detected,
  conditions?: Environment,
): Situation {
  const ownSelf = self.geo as DirectionalGeometry | undefined;
  const selfGeo: DirectionalGeometry | undefined =
    other.bearing_deg === undefined
      ? ownSelf
      : { ...ownSelf, 'geo:rel_bearing_deg': other.bearing_deg };
  const s: Situation = { self: vesselOf(self, selfGeo) };
  s.other = vesselOf({ ...other, fact: other.fact ?? {} }, ownGeo(other));
  s.pair = { geo: pairGeo(other, detected) };
  if (conditions !== undefined) s.pair.env = conditions;
  return s;
}

/** The fact one other's appraisal rests on. The indication is a thunk so an
 * asserted fact never computes it. open: when no fact is asserted the
 * appraisal rests on nothing and points at the indication; resting it on
 * the indication instead (one candidate, or the duty every candidate
 * shares) plugs in here and nowhere else. */
function restingFact(
  other: CircumstancesVessel,
  _indication: () => Indication,
): { fact?: FactRecord; restedOn: RestedOn } {
  if (other.fact !== undefined) return { fact: other.fact, restedOn: 'asserted' };
  return { restedOn: 'nothing' };
}

/** Stub: Parts C and D are not yet read backwards, so every other indicates
 * nothing, and `consistent` is unknown even when a fact is asserted. */
function readIndication(_other: CircumstancesVessel): Indication {
  return { couldBe: [] };
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

  /** Part B, Rule 2: what binds self regardless, then per other vessel. */
  get appraisal(): Appraisal | undefined {
    return this.#once('appraisal', () => {
      const self = this.#c.self;
      if (self === undefined) return undefined;
      const others = (this.#c.others ?? []).map((other, i): AppraisalOfOther => {
        const { fact, restedOn } = restingFact(other, () => this.indicated[i]);
        if (fact === undefined) {
          return { restedOn, because: `other vessel not asserted; see indicated[${i}]` };
        }
        // Validation guarantees a set per other, so the fallback never runs.
        const detected = detectionsOf(this.#c, other) ?? {};
        const situation = situationFor(self, { ...other, fact }, detected, this.#c.conditions);
        return { restedOn, evaluation: evaluateCircumstances(situation, this.#opts) };
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

  /** Per other vessel, what her observed signals tell self. */
  get indicated(): Indication[] {
    return this.#once('indicated', () => (this.#c.others ?? []).map(readIndication));
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
