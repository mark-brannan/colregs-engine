// Generates src/generated/fact-record.ts from node_modules/colregs/data/facts.json.
//
// facts.json is the input vocabulary: which fact keys exist and, for the
// enumerated ones, which values they may take. `FactRecord` used to be
// `Record<string, string | number | boolean>`, so a mistyped key was not an
// error — it simply matched nothing, and the caller got an empty result
// indistinguishable from "this vessel lawfully shows nothing".
//
// The emitted FACT_SPEC is the single source for both halves of the fix: the
// key and value unions are derived from it at the type level, and
// validateFacts() reads the same object at runtime, so the compile-time and
// run-time answers cannot diverge.
//
// The schema (which keys are *allowed to exist*) is generated separately by
// generate-schema-types.ts; this reads the data (which keys *do* exist).
//
// Run: npm run generate

import { readFileSync, writeFileSync } from 'node:fs';

interface EnumFact {
  values: string[];
}
interface TypedFact {
  type: 'boolean' | 'number' | 'string';
}
interface FactsJson {
  axes: Record<string, EnumFact>;
  modifiers?: Record<string, TypedFact>;
  numerics?: Record<string, unknown>;
  booleans?: Record<string, unknown>;
  enums?: Record<string, EnumFact>;
}

const facts = JSON.parse(
  readFileSync('node_modules/colregs/data/facts.json', 'utf8'),
) as FactsJson;
const colregsVersion: string = JSON.parse(
  readFileSync('node_modules/colregs/package.json', 'utf8'),
).version;

type Entry = { key: string; body: string };
const entries: Entry[] = [];

const enumBody = (f: EnumFact): string =>
  `{ kind: 'enum', values: [${f.values.map((v) => `'${v}'`).join(', ')}] }`;

// Section order is facts.json's own; within a section, the data's key order.
for (const [key, f] of Object.entries(facts.axes)) {
  entries.push({ key, body: enumBody(f) });
}
for (const [key, f] of Object.entries(facts.modifiers ?? {})) {
  entries.push({ key, body: `{ kind: '${f.type}' }` });
}
for (const key of Object.keys(facts.numerics ?? {})) {
  entries.push({ key, body: `{ kind: 'number' }` });
}
for (const key of Object.keys(facts.booleans ?? {})) {
  entries.push({ key, body: `{ kind: 'boolean' }` });
}
for (const [key, f] of Object.entries(facts.enums ?? {})) {
  entries.push({ key, body: enumBody(f) });
}

const duplicates = entries
  .map((e) => e.key)
  .filter((k, i, all) => all.indexOf(k) !== i);
if (duplicates.length > 0) {
  throw new Error(
    `facts.json declares these keys in more than one section: ${duplicates.join(', ')}`,
  );
}

const out = `/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs@${colregsVersion} data/facts.json
 * Regenerate with \`npm run generate\`; \`npm run generate:check\` fails the
 * build if this file and the pinned data disagree.
 */

/**
 * Every fact key colregs defines, with the values it accepts. The type-level
 * unions below and the runtime check in src/facts.ts both read this, so a
 * record that typechecks is a record validateFacts() accepts.
 */
export const FACT_SPEC = {
${entries.map((e) => `  '${e.key}': ${e.body},`).join('\n')}
} as const;

/** Every fact key colregs defines. */
export type FactKey = keyof typeof FACT_SPEC;

type ValueOfSpec<S> = S extends { kind: 'enum'; values: readonly (infer V)[] }
  ? V
  : S extends { kind: 'number' }
    ? number
    : S extends { kind: 'boolean' }
      ? boolean
      : S extends { kind: 'string' }
        ? string
        : never;

/** The value type of each fact key. */
export type FactValues = {
  [K in FactKey]: ValueOfSpec<(typeof FACT_SPEC)[K]>;
};

/**
 * What the user has asserted about one vessel at one moment. Every key is
 * optional — a record asserts a subset — but no key outside colregs'
 * vocabulary is assignable, and an enumerated key takes only its own values.
 */
export type FactRecord = {
  [K in FactKey]?: FactValues[K];
};
`;

writeFileSync('src/generated/fact-record.ts', out);
console.log(
  `generated ${entries.length} fact keys from colregs@${colregsVersion}`,
);
