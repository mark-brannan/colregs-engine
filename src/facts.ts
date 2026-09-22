// Runtime validation of a fact record — and, per ADR 0011 §3, a situation's
// six generated classes — against colregs' vocabulary.
//
// The types in src/generated/fact-record.ts and src/generated/situation.ts
// make a bad key or value a compile error, but the engine is also reached
// from JavaScript, from JSON off the wire, and through the `as` casts
// consumers write when they parse config. Without this, a misspelt key
// matched nothing and evaluate() returned an empty display set — the same
// answer it gives for a vessel that lawfully shows nothing. Two very
// different situations must not look alike.

import { FACT_SPEC, type FactRecord } from './generated/fact-record.js';
import {
  ACT_SPEC,
  ENV_SPEC,
  GEO_OWN_SPEC,
  GEO_PAIR_SPEC,
  HIST_SPEC,
  KIN_SPEC,
} from './generated/situation.js';
import type { Situation, Subject, Trace } from './types.js';

/** Every generated spec, widened for lookup by an arbitrary runtime key. */
type Spec =
  | { kind: 'enum'; values: readonly string[]; nullable?: boolean }
  | { kind: 'number'; nullable?: boolean }
  | { kind: 'boolean'; nullable?: boolean }
  | { kind: 'string'; nullable?: boolean }
  | { kind: 'position'; nullable?: boolean };

const SPEC: Record<string, Spec | undefined> = FACT_SPEC;
const KEYS = Object.keys(FACT_SPEC);
const KIN: Record<string, Spec | undefined> = KIN_SPEC;
const KIN_KEYS = Object.keys(KIN_SPEC);
const HIST: Record<string, Spec | undefined> = HIST_SPEC;
const HIST_KEYS = Object.keys(HIST_SPEC);
const GEO_OWN: Record<string, Spec | undefined> = GEO_OWN_SPEC;
const GEO_OWN_KEYS = Object.keys(GEO_OWN_SPEC);
const GEO_PAIR: Record<string, Spec | undefined> = GEO_PAIR_SPEC;
const GEO_PAIR_KEYS = Object.keys(GEO_PAIR_SPEC);
const ACT: Record<string, Spec | undefined> = ACT_SPEC;
const ACT_KEYS = Object.keys(ACT_SPEC);
const ENV: Record<string, Spec | undefined> = ENV_SPEC;
const ENV_KEYS = Object.keys(ENV_SPEC);

/** `'propulsion'` -> `'fact:propulsion'`: the mistake worth naming. */
function suggestKey(
  key: string,
  prefix: string,
  keys: readonly string[],
): string | undefined {
  const namespaced = `${prefix}:${key}`;
  return keys.includes(namespaced) ? namespaced : undefined;
}

/** `'sail'` -> `'propulsion:sail'`, for an enumerated key's values. */
function suggestValue(
  values: readonly string[],
  value: unknown,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  return values.find((v) => v.slice(v.indexOf(':') + 1) === value);
}

/**
 * Throws unless every key of `record` is one `spec` declares and every value
 * is one that key accepts. The message names the offending key, and the
 * value too when the key itself was valid. Shared by validateFacts() and
 * validateSituation() so a mistyped `kin:` or `geo:` key is rejected on the
 * same terms as a mistyped `fact:` one — same hint, same "did you mean".
 */
function checkRecord(
  record: object,
  spec: Record<string, Spec | undefined>,
  keys: readonly string[],
  noun: string,
): void {
  const nounCap = noun[0].toUpperCase() + noun.slice(1);
  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    throw new Error(
      `${nounCap} record must be an object, got ${JSON.stringify(record)}.`,
    );
  }
  for (const [key, value] of Object.entries(record) as [string, unknown][]) {
    const s = spec[key];
    if (s === undefined) {
      const hint = suggestKey(key, noun, keys);
      throw new Error(
        `unknown ${noun} key '${key}'${hint ? `; did you mean '${hint}'?` : ''} ` +
          `${nounCap} keys are namespaced and defined by colregs data/facts.json: ` +
          `${keys.join(', ')}.`,
      );
    }
    // An explicitly-undefined key asserts nothing, exactly like an absent one.
    if (value === undefined) continue;
    if (value === null) {
      if (s.nullable) continue;
      throw new Error(`${noun} key '${key}' does not accept null.`);
    }

    if (s.kind === 'enum') {
      if (typeof value !== 'string' || !s.values.includes(value)) {
        const hint = suggestValue(s.values, value);
        throw new Error(
          `${noun} key '${key}' does not accept ${JSON.stringify(value)}` +
            `${hint ? `; did you mean '${hint}'?` : ''} ` +
            `Accepted values: ${s.values.join(', ')}.`,
        );
      }
      continue;
    }
    if (s.kind === 'position') {
      const v = value as Record<string, unknown>;
      if (
        typeof value !== 'object' ||
        typeof v.latitude !== 'number' ||
        typeof v.longitude !== 'number'
      ) {
        throw new Error(
          `${noun} key '${key}' expects { latitude, longitude }, got ` +
            `${JSON.stringify(value)}.`,
        );
      }
      continue;
    }
    if (typeof value !== s.kind) {
      throw new Error(
        `${noun} key '${key}' expects a ${s.kind}, got ` +
          `${typeof value} (${JSON.stringify(value)}).`,
      );
    }
  }
}

/**
 * Throws unless every key of `facts` is a colregs fact key and every value is
 * one that key accepts. The message names the offending key, and the value
 * too when the key itself was valid.
 */
export function validateFacts(facts: FactRecord): void {
  checkRecord(facts, SPEC, KEYS, 'fact');
}

function validateSubject(which: 'self' | 'other', subject: Subject): void {
  if (typeof subject !== 'object' || subject === null) {
    throw new Error(
      `situation.${which} is required and must be an object, got ${JSON.stringify(subject)}.`,
    );
  }
  if (typeof subject.fact !== 'object' || subject.fact === null) {
    throw new Error(
      `situation.${which}.fact is required and must be an object, got ` +
        `${JSON.stringify(subject.fact)}.`,
    );
  }
  validateFacts(subject.fact);
  if (subject.kin !== undefined) checkRecord(subject.kin, KIN, KIN_KEYS, 'kin');
  if (subject.geo !== undefined) {
    checkRecord(subject.geo, GEO_OWN, GEO_OWN_KEYS, 'geo');
  }
  if (subject.hist !== undefined) {
    checkRecord(subject.hist, HIST, HIST_KEYS, 'hist');
  }
  if (subject.act !== undefined) {
    checkRecord(subject.act, ACT, ACT_KEYS, 'act');
  }
}

/**
 * Throws on the same terms as validateFacts(), extended to a situation's
 * `kin`/`geo`/`hist`/`act`/`env` classes (ADR 0011 §3): an unknown key or a value
 * outside its accepted set is rejected with a "did you mean" hint, for both
 * subjects and the pair. `self`/`self.fact` are ADR 0011 §3's two required
 * fields, so a missing one is named directly rather than surfacing as
 * whatever TypeError reading a property of `undefined` happens to throw.
 */
export function validateSituation(situation: Situation): void {
  validateSubject('self', situation.self);
  if (situation.other !== undefined) validateSubject('other', situation.other);
  if (situation.pair !== undefined) {
    if (typeof situation.pair !== 'object' || situation.pair === null) {
      throw new Error(
        `situation.pair must be an object, got ${JSON.stringify(situation.pair)}.`,
      );
    }
    if (situation.pair.geo !== undefined) {
      checkRecord(situation.pair.geo, GEO_PAIR, GEO_PAIR_KEYS, 'geo');
    }
    if (situation.pair.env !== undefined) {
      checkRecord(situation.pair.env, ENV, ENV_KEYS, 'env');
    }
  }
}

/**
 * Throws on what a trace's validator can see (ADR 0012 §2): a non-array or
 * empty `samples`, a `t_s` that is not a finite number or does not strictly
 * increase, a sample whose situation fails validateSituation(), or `other`
 * present in some samples and not others. Pair identity is the caller's.
 */
export function validateTrace(trace: Trace): void {
  if (typeof trace !== 'object' || trace === null || !Array.isArray(trace.samples)) {
    throw new Error(`trace.samples must be an array, got ${JSON.stringify(trace)}.`);
  }
  if (trace.samples.length === 0) throw new Error('trace.samples must not be empty.');
  let hasOther: boolean | undefined;
  trace.samples.forEach((sample, i) => {
    if (typeof sample !== 'object' || sample === null) {
      throw new Error(`trace.samples[${i}] must be an object, got ${JSON.stringify(sample)}.`);
    }
    if (typeof sample.t_s !== 'number' || !Number.isFinite(sample.t_s)) {
      throw new Error(`trace.samples[${i}].t_s must be a finite number, got ${JSON.stringify(sample.t_s)}.`);
    }
    if (i > 0 && !(sample.t_s > trace.samples[i - 1].t_s)) {
      throw new Error(
        `trace.samples[${i}].t_s (${sample.t_s}) must be greater than samples[${i - 1}].t_s (${trace.samples[i - 1].t_s}).`,
      );
    }
    if (typeof sample.situation !== 'object' || sample.situation === null) {
      throw new Error(`trace.samples[${i}].situation is required and must be an object.`);
    }
    validateSituation(sample.situation);
    const other = sample.situation.other !== undefined;
    if (hasOther === undefined) hasOther = other;
    else if (hasOther !== other) {
      throw new Error(`trace.samples[${i}] ${other ? 'has' : 'lacks'} \`other\` while earlier samples do not; the same two vessels must run through the window.`);
    }
  });
}
