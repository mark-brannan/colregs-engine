// Runtime validation of a fact record against colregs' vocabulary.
//
// The types in src/generated/fact-record.ts make a bad key or value a compile
// error, but the engine is also reached from JavaScript, from JSON off the
// wire, and through the `as` casts consumers write when they parse config.
// Without this, a misspelt key matched nothing and evaluate() returned an
// empty display set — the same answer it gives for a vessel that lawfully
// shows nothing. Two very different situations must not look alike.

import { FACT_SPEC, type FactRecord } from './generated/fact-record.js';

/** The generated spec, widened for lookup by an arbitrary runtime key. */
type FactSpec =
  | { kind: 'enum'; values: readonly string[] }
  | { kind: 'number' }
  | { kind: 'boolean' }
  | { kind: 'string' };

const SPEC: Record<string, FactSpec | undefined> = FACT_SPEC;
const KEYS = Object.keys(FACT_SPEC);

/** `'propulsion'` -> `'fact:propulsion'`: the mistake worth naming. */
function suggestKey(key: string): string | undefined {
  const namespaced = `fact:${key}`;
  return KEYS.includes(namespaced) ? namespaced : undefined;
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
 * Throws unless every key of `facts` is a colregs fact key and every value is
 * one that key accepts. The message names the offending key, and the value
 * too when the key itself was valid.
 */
export function validateFacts(facts: FactRecord): void {
  for (const [key, value] of Object.entries(facts)) {
    const spec = SPEC[key];
    if (spec === undefined) {
      const hint = suggestKey(key);
      throw new Error(
        `unknown fact key '${key}'${hint ? `; did you mean '${hint}'?` : ''} ` +
          `Fact keys are namespaced and defined by colregs data/facts.json: ` +
          `${KEYS.join(', ')}.`,
      );
    }
    // An explicitly-undefined key asserts nothing, exactly like an absent one.
    if (value === undefined) continue;

    if (spec.kind === 'enum') {
      if (typeof value !== 'string' || !spec.values.includes(value)) {
        const hint = suggestValue(spec.values, value);
        throw new Error(
          `fact key '${key}' does not accept ${JSON.stringify(value)}` +
            `${hint ? `; did you mean '${hint}'?` : ''} ` +
            `Accepted values: ${spec.values.join(', ')}.`,
        );
      }
      continue;
    }
    if (typeof value !== spec.kind) {
      throw new Error(
        `fact key '${key}' expects a ${spec.kind}, got ` +
          `${typeof value} (${JSON.stringify(value)}).`,
      );
    }
  }
}
