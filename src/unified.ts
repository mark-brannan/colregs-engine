// evaluate(circumstances): the unified form of the API, a second variant
// beside the three operations, not a replacement for them. One evaluation
// over self, the other vessels and the conditions; its readings are memoized
// getters, so `const { appraisal } = evaluate(c)` computes the appraisal and
// nothing else. The appraisal and the signals delegate to
// evaluateCircumstances and evaluateDisplay over a Situation built per other
// vessel; the indication and compliance are stubs with their shapes typed.
// Validation runs in evaluate() itself: assertions that contradict each
// other throw before any reading is pulled. Every `open:` line below marks a
// question the design leaves undecided and the one place the code would
// change to go the other way.

import { checkDataVersion, evaluateDisplay, type EvaluateOptions } from './evaluate.js';
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

/** The Rules' three ways self can know of another vessel: Rule 11, Rule
 * 19(d), Rule 19(e). Required on every other; there is no neutral way. */
export type Known = 'in-sight' | 'radar-alone' | 'heard';

/** What self sees or hears of her: never what she exhibits, which is hers. */
export interface Observed {
  lights?: string[];
  shapes?: string[];
  sounds?: string[];
}

/** Pairwise geometry about one other, carried on her rather than on a pair.
 * `in_sight` is said by `known` and `range_m` by `range_nm`, so neither is
 * a key here. */
export type OtherGeometry = DirectionalGeometry &
  Omit<PairGeometry, 'geo:in_sight' | 'geo:range_m'>;

/** One other vessel, as self knows her: asserted (`fact`), observed, or
 * both. */
export interface Other {
  known: Known;
  /** Her bearing relative to self's heading, and her range, from self. */
  bearing_deg?: number;
  range_nm?: number;
  fact?: FactRecord;
  observed?: Observed;
  kin?: Kinematics;
  geo?: OtherGeometry;
  act?: Acts;
  hist?: History;
}

/** The input: self, the other vessels, the conditions of the water. */
export interface Circumstances {
  /** open: optional, so the inverse question (observed lights, no self)
   * reads through the same call; the appraisal and signals then read
   * `undefined`. Requiring it is one line in validateCircumstances. */
  self?: Vessel;
  others?: Other[];
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

const KNOWN: readonly Known[] = ['in-sight', 'radar-alone', 'heard'];
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

function checkOther(other: unknown, i: number, conditions: Environment | undefined): void {
  const where = `circumstances.others[${i}]`;
  if (!isRecord(other))
    throw new Error(`${where} must be an object, got ${JSON.stringify(other)}.`);
  if (!(KNOWN as readonly unknown[]).includes(other.known)) {
    throw new Error(`${where}.known is required and must be one of ${KNOWN.join(', ')}.`);
  }
  if (other.fact === undefined && other.observed === undefined) {
    throw new Error(`${where} needs a fact, an observed, or both.`);
  }
  if (other.observed !== undefined) checkObserved(other.observed, where);
  // open: a fact and an observed on one other are allowed to coexist; a
  // disagreement between them is the indication's finding, not an error.
  // Forbidding it is one throw here.
  const observed = other.observed as Observed | undefined;
  if (other.known !== 'in-sight' && seen(observed)) {
    throw new Error(
      `${where}: lights or shapes observed on a vessel known '${other.known}' contradict it; Rule 11 reads in sight only.`,
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
          `${where}.geo must not carry '${key}'; say it with ${key === 'geo:in_sight' ? 'known' : 'range_nm'}.`,
        );
      }
    }
  }
  validateSituation(situationFor(NO_SELF, other as unknown as Other, conditions));
}

/** Throws unless the record is well formed and its assertions agree with
 * each other. Shape and vocabulary errors come from validateSituation, on
 * the same terms as the three operations. */
export function validateCircumstances(c: Circumstances): Circumstances {
  if (typeof c !== 'object' || c === null || Array.isArray(c)) {
    throw new Error(`circumstances must be an object, got ${JSON.stringify(c)}.`);
  }
  if (c.self !== undefined) validateSituation({ self: c.self, pair: { env: c.conditions } });
  else if (c.conditions !== undefined)
    validateSituation({ self: NO_SELF, pair: { env: c.conditions } });
  if (c.others !== undefined) {
    if (!Array.isArray(c.others)) throw new Error('circumstances.others must be a list.');
    c.others.forEach((o, i) => checkOther(o, i, c.conditions));
  }
  return c;
}

/** Own-frame geometry keys stay on the other; the rest of her `geo` is the
 * pair's. */
const OWN_GEO: Record<keyof DirectionalGeometry, true> = {
  'geo:rel_bearing_deg': true,
  'geo:windward': true,
};

function pairGeo(other: Other): PairGeometry {
  const geo: PairGeometry = { 'geo:in_sight': other.known === 'in-sight' };
  if (other.range_nm !== undefined) geo['geo:range_m'] = other.range_nm * NM_IN_M;
  // Every key not in her own frame is the pair's, unknown ones included, so
  // validateSituation names them instead of this dropping them.
  for (const [key, value] of Object.entries(other.geo ?? {})) {
    if (!(key in OWN_GEO)) (geo as Record<string, unknown>)[key] = value;
  }
  return geo;
}

function ownGeo(other: Other): DirectionalGeometry | undefined {
  const own: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(other.geo ?? {})) if (key in OWN_GEO) own[key] = value;
  return Object.keys(own).length > 0 ? (own as DirectionalGeometry) : undefined;
}

/** Today's two-vessel Situation over self and one other: her bearing lands
 * in self's own frame, her range and how she is known in the pair's. */
export function situationFor(self: Vessel, other: Other, conditions?: Environment): Situation {
  const selfGeo: DirectionalGeometry | undefined =
    other.bearing_deg === undefined
      ? self.geo
      : { ...self.geo, 'geo:rel_bearing_deg': other.bearing_deg };
  const otherVessel: Vessel = { fact: other.fact ?? {} };
  if (other.kin !== undefined) otherVessel.kin = other.kin;
  if (other.act !== undefined) otherVessel.act = other.act;
  if (other.hist !== undefined) otherVessel.hist = other.hist;
  const own = ownGeo(other);
  if (own !== undefined) otherVessel.geo = own;
  const s: Situation = { self: selfGeo === undefined ? self : { ...self, geo: selfGeo } };
  s.other = otherVessel;
  s.pair = { geo: pairGeo(other) };
  if (conditions !== undefined) s.pair.env = conditions;
  return s;
}

/** The fact one other's appraisal rests on. The indication is a thunk so an
 * asserted fact never computes it. open: when no fact is asserted the
 * appraisal rests on nothing and points at the indication; resting it on
 * the indication instead (one candidate, or the duty every candidate
 * shares) plugs in here and nowhere else. */
function restingFact(
  other: Other,
  _indication: () => Indication,
): { fact?: FactRecord; restedOn: RestedOn } {
  if (other.fact !== undefined) return { fact: other.fact, restedOn: 'asserted' };
  return { restedOn: 'nothing' };
}

/** Stub: Parts C and D are not yet read backwards, so every other indicates
 * nothing, and `consistent` is unknown even when a fact is asserted. */
function readIndication(_other: Other): Indication {
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
        const situation = situationFor(self, { ...other, fact }, this.#c.conditions);
        return { restedOn, evaluation: evaluateCircumstances(situation, this.#opts) };
      });
      return {
        self: evaluateCircumstances({ self, pair: { env: this.#c.conditions } }, this.#opts),
        others,
      };
    });
  }

  /** Parts C and D for self: every lawful display, as evaluateDisplay reads
   * it. Sound signals are not read here yet. */
  get signals(): DisplayEvaluation | undefined {
    return this.#once('signals', () =>
      this.#c.self === undefined ? undefined : evaluateDisplay(this.#c.self.fact, this.#opts),
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
