// Generates src/generated/fact-record.ts and src/generated/situation.ts from
// node_modules/colregs/data/facts.json.
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
// run-time answers cannot diverge. §situation's five classes (kin/hist/geo
// own+pair/env, ADR 0001 §3) get the same treatment, in the same run, from
// the same source file.
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
  /** `"fact:key=value"`: this modifier is only meaningful when that other
   * fact holds that value — e.g. `fact:making_way` refines `fact:position`
   * at `position:underway`. */
  refines?: string;
}
interface SituationField {
  type: 'number' | 'boolean' | 'enum' | 'position';
  values?: string[];
  note?: string;
}
interface FactsJson {
  axes: Record<string, EnumFact>;
  modifiers?: Record<string, TypedFact>;
  numerics?: Record<string, unknown>;
  booleans?: Record<string, unknown>;
  enums?: Record<string, EnumFact>;
  situation: {
    kinematics: Record<string, SituationField | string>;
    history: Record<string, SituationField | string>;
    geometry: {
      directional: Record<string, SituationField>;
      symmetric: Record<string, SituationField>;
    };
    environment: Record<string, SituationField | string>;
  };
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

/** `"fact:position=position:underway"` -> `{ key: 'fact:position', value: 'position:underway' }`. */
function parseRefines(refines: string): { key: string; value: string } {
  const eq = refines.indexOf('=');
  if (eq === -1) {
    throw new Error(`modifier refines '${refines}' is not of the form 'key=value'`);
  }
  return { key: refines.slice(0, eq), value: refines.slice(eq + 1) };
}

// Section order is facts.json's own; within a section, the data's key order.
for (const [key, f] of Object.entries(facts.axes)) {
  entries.push({ key, body: enumBody(f) });
}
for (const [key, f] of Object.entries(facts.modifiers ?? {})) {
  if (f.refines) {
    const { key: rk, value: rv } = parseRefines(f.refines);
    entries.push({ key, body: `{ kind: '${f.type}', refines: { key: '${rk}', value: '${rv}' } }` });
  } else {
    entries.push({ key, body: `{ kind: '${f.type}' }` });
  }
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

// §situation's five classes. Same source, same key/value-union derivation as
// FACT_SPEC above; the one addition is `nullable`, because hist:latched_at_s
// is documented (not schema-typed — facts.json states its type as plain
// `number`) as null until Rule 13(d) latches. Detecting that from the note's
// prose is the only signal facts.json gives; a future field with the same
// shape picks up `nullable` the same way, with no generator change.
const fieldBody = (f: SituationField): string => {
  const nullable = (f.note ?? '').toLowerCase().includes('null');
  const suffix = nullable ? ', nullable: true' : '';
  if (f.type === 'enum') {
    return `{ kind: 'enum', values: [${f.values!.map((v) => `'${v}'`).join(', ')}]${suffix} }`;
  }
  return `{ kind: '${f.type}'${suffix} }`;
};

const sectionEntries = (
  section: Record<string, SituationField | string>,
): Entry[] =>
  Object.entries(section)
    .filter((pair): pair is [string, SituationField] => pair[0] !== 'note')
    .map(([key, f]) => ({ key, body: fieldBody(f) }));

interface SituationClass {
  specName: string;
  typeName: string;
  keyName: string;
  valuesName: string;
  doc: string;
  entries: Entry[];
}

const classes: SituationClass[] = [
  {
    specName: 'KIN_SPEC',
    typeName: 'Kinematics',
    keyName: 'KinKey',
    valuesName: 'KinValues',
    doc: 'Absolute kinematic state of one vessel, in the world frame (own/other only).',
    entries: sectionEntries(facts.situation.kinematics),
  },
  {
    specName: 'HIST_SPEC',
    typeName: 'History',
    keyName: 'HistKey',
    valuesName: 'HistValues',
    doc: 'What has already been true of this encounter and latches (own/other only).',
    entries: sectionEntries(facts.situation.history),
  },
  {
    specName: 'GEO_OWN_SPEC',
    typeName: 'DirectionalGeometry',
    keyName: 'DirectionalGeometryKey',
    valuesName: 'DirectionalGeometryValues',
    doc: "Relative geometry measured from one subject's own frame (own/other only).",
    entries: sectionEntries(facts.situation.geometry.directional),
  },
  {
    specName: 'GEO_PAIR_SPEC',
    typeName: 'PairGeometry',
    keyName: 'PairGeometryKey',
    valuesName: 'PairGeometryValues',
    doc: 'Relative geometry symmetric between the two vessels (pair only).',
    entries: sectionEntries(facts.situation.geometry.symmetric),
  },
  {
    specName: 'ENV_SPEC',
    typeName: 'Environment',
    keyName: 'EnvironmentKey',
    valuesName: 'EnvironmentValues',
    doc: 'Where the encounter is happening — a property of the water, not of either vessel (pair only).',
    entries: sectionEntries(facts.situation.environment),
  },
];

const situationOut = `/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs@${colregsVersion} data/facts.json (situation)
 * Regenerate with \`npm run generate\`; \`npm run generate:check\` fails the
 * build if this file and the pinned data disagree.
 */

/** The value type of one situation field, given its spec entry. */
type ValueOfSituationSpec<S> =
  | (S extends { kind: 'enum'; values: readonly (infer V)[] }
      ? V
      : S extends { kind: 'number' }
        ? number
        : S extends { kind: 'boolean' }
          ? boolean
          : S extends { kind: 'position' }
            ? { latitude: number; longitude: number }
            : never)
  | (S extends { nullable: true } ? null : never);

${classes
  .map(
    (c) => `/** ${c.doc} */
export const ${c.specName} = {
${c.entries.map((e) => `  '${e.key}': ${e.body},`).join('\n')}
} as const;
export type ${c.keyName} = keyof typeof ${c.specName};
export type ${c.valuesName} = {
  [K in ${c.keyName}]: ValueOfSituationSpec<(typeof ${c.specName})[K]>;
};
export type ${c.typeName} = {
  [K in ${c.keyName}]?: ${c.valuesName}[K];
};`,
  )
  .join('\n\n')}
`;

writeFileSync('src/generated/situation.ts', situationOut);
console.log(
  `generated ${classes.reduce((n, c) => n + c.entries.length, 0)} situation keys across ${classes.length} classes from colregs@${colregsVersion}`,
);
