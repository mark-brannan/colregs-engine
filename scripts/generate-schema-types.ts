// Generates src/generated/*.ts from node_modules/colregs/schema/*.schema.json.
//
// The colregs package is data-only: it ships JSON Schema 2020-12 for every
// data file and no types. Hand-transcribing those shapes here is how the
// engine silently drifted from the data it evaluates. Generating them means
// a colregs schema change breaks this build instead of a consumer.
//
// The output is checked in, and CI regenerates and diffs it (see
// `npm run generate:check`): the generated file and the pinned schema cannot
// disagree without failing the build.
//
// Run: npm run generate

import { readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { compile, type JSONSchema } from 'json-schema-to-typescript';

const SCHEMA_DIR = 'node_modules/colregs/schema';
const OUT_DIR = 'src/generated';

/**
 * Root type name per schema file. json-schema-to-typescript names the root
 * interface from the schema's `title` ("data/applicability.json"), so the
 * title is replaced with the name we want before compiling. Every schema
 * under schema/ must appear here — an unlisted one is a hard error rather
 * than a silently skipped file, because a new colregs data file is exactly
 * the kind of change this generator exists to surface.
 */
const ROOT_NAMES: Record<string, string> = {
  applicability: 'ApplicabilityData',
  'applicability-fixtures': 'ApplicabilityFixtures',
  'deprecated-identifiers': 'DeprecatedIdentifiers',
  facts: 'FactsData',
  geometry: 'GeometryData',
  images: 'ImagesData',
  lights: 'LightsData',
  rules: 'RulesData',
  'situation-fixtures': 'SituationFixtures',
};

const BANNER = `/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs@%VERSION% schema/%FILE%
 * Regenerate with \`npm run generate\`; \`npm run generate:check\` fails the
 * build if this file and the pinned schema disagree.
 */`;

const colregsVersion: string = JSON.parse(
  readFileSync('node_modules/colregs/package.json', 'utf8'),
).version;

const files = readdirSync(SCHEMA_DIR)
  .filter((f) => f.endsWith('.schema.json'))
  .sort();

// A schema colregs removes must take its generated module with it, or
// generate:check passes with a stale file the barrel no longer references —
// an exact mirror only if nothing is left behind. fact-record.ts is a
// separate generator's output (generate-fact-record.ts, from facts.json,
// not schema/) and index.ts is rewritten below either way.
const currentStems = new Set(
  files.map((f) => basename(f, '.schema.json')),
);
const KEEP = new Set(['fact-record.ts', 'index.ts']);
for (const existing of readdirSync(OUT_DIR)) {
  if (!existing.endsWith('.ts') || KEEP.has(existing)) continue;
  if (!currentStems.has(basename(existing, '.ts'))) {
    unlinkSync(join(OUT_DIR, existing));
  }
}

const modules: { module: string; root: string }[] = [];

for (const file of files) {
  const stem = basename(file, '.schema.json');
  const root = ROOT_NAMES[stem];
  if (!root) {
    throw new Error(
      `${file} has no entry in ROOT_NAMES: add one in scripts/generate-schema-types.ts`,
    );
  }

  const schema = JSON.parse(
    readFileSync(join(SCHEMA_DIR, file), 'utf8'),
  ) as JSONSchema;
  // The root interface is named from `title`, which upstream sets to the data
  // file's path. Everything else about the schema is compiled untouched.
  schema.title = root;

  const body = await compile(schema, root, {
    additionalProperties: false,
    bannerComment: '',
    declareExternallyReferenced: true,
    // Upstream uses minItems as a non-emptiness constraint, not as a tuple
    // arity; without this every `minItems: 1` array becomes a tuple type.
    ignoreMinAndMaxItems: true,
    style: { singleQuote: true },
  });

  const banner = BANNER.replace('%VERSION%', colregsVersion).replace(
    '%FILE%',
    file,
  );
  writeFileSync(join(OUT_DIR, `${stem}.ts`), `${banner}\n\n${body}`);
  modules.push({ module: stem, root });
}

// Barrel. Each schema gets a type-only namespace (several schemas define
// their own `When` / `PredicateValue`, so a flat re-export would collide;
// `export type *` keeps the emitted JS empty), and every root type is
// re-exported by name.
const barrel = [
  BANNER.replace('%VERSION%', colregsVersion).replace(
    ' schema/%FILE%',
    ' schema/*.schema.json',
  ),
  '',
  ...modules.map(
    ({ module }) =>
      `export type * as ${camel(module)} from './${module}.js';`,
  ),
  '',
  ...modules.map(
    ({ module, root }) => `export type { ${root} } from './${module}.js';`,
  ),
  '',
].join('\n');
writeFileSync(join(OUT_DIR, 'index.ts'), barrel);

function camel(s: string): string {
  return s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

console.log(
  `generated ${modules.length} schema modules from colregs@${colregsVersion}`,
);
