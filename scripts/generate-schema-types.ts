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
  'conduct-evaluation': 'ConductEvaluationSchema',
  corpora: 'CorporaData',
  corpus: 'CorpusData',
  'display-evaluation': 'DisplayEvaluationSchema',
  editions: 'EditionsData',
  'encounter-evaluation': 'EncounterEvaluationSchema',
  evaluation: 'EvaluationSchema',
  facts: 'FactsData',
  geometry: 'GeometryData',
  'i18n-catalog': 'I18NCatalogData',
  images: 'ImagesData',
  lights: 'LightsData',
  operations: 'OperationsManifest',
  rules: 'RulesData',
  'rule2-departure-finding': 'Rule2DepartureFindingSchema',
  'rule2-departure-model': 'Rule2DepartureModelSchema',
  shapes: 'ShapesData',
  'situation-fixtures': 'SituationFixtures',
  sounds: 'SoundsData',
  trace: 'TraceSchema',
  version: 'VersionData',
};

/**
 * Stems ADR 0014 ships under schema/ but that this generator does not
 * compile: `generate-fact-record.ts` already derives FactRecord and Situation
 * (plus Kinematics/History/DirectionalGeometry/PairGeometry/Environment) from
 * data/facts.json as keyed unions with runtime validation — strictly more
 * precise than what json-schema-to-typescript would produce from these two
 * files' loose `patternProperties` mirrors of the same shapes. Compiling them
 * here would silently overwrite that richer output with a weaker one. The
 * schema files themselves stay available for Ajv (round-trip conformance
 * reads them directly from node_modules, not from src/generated).
 */
const OWNED_BY_FACT_RECORD_GENERATOR = new Set(['fact-record', 'situation']);

const BANNER = `/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs schema/%FILE%
 * Version: declared in package.json, resolved in package-lock.json
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
const KEEP = new Set([
  'fact-record.ts',
  'situation.ts',
  'index.ts',
  // generate-operations-interface.ts's own output (ColregsEngine, from
  // data/operations.json, not schema/) -- not one of this loop's stems.
  'colregs-engine.ts',
]);
for (const existing of readdirSync(OUT_DIR)) {
  if (!existing.endsWith('.ts') || KEEP.has(existing)) continue;
  if (!currentStems.has(basename(existing, '.ts'))) {
    unlinkSync(join(OUT_DIR, existing));
  }
}

const modules: { module: string; root: string }[] = [];

for (const file of files) {
  const stem = basename(file, '.schema.json');
  if (OWNED_BY_FACT_RECORD_GENERATOR.has(stem)) continue;
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
    cwd: SCHEMA_DIR,
    declareExternallyReferenced: true,
    // Upstream uses minItems as a non-emptiness constraint, not as a tuple
    // arity; without this every `minItems: 1` array becomes a tuple type.
    ignoreMinAndMaxItems: true,
    style: { singleQuote: true },
  });

  const banner = BANNER.replace('%FILE%', file);
  writeFileSync(join(OUT_DIR, `${stem}.ts`), `${banner}\n\n${body}`);
  modules.push({ module: stem, root });
}

// Barrel. Each schema gets a type-only namespace (several schemas define
// their own `When` / `PredicateValue`, so a flat re-export would collide;
// `export type *` keeps the emitted JS empty), and every root type is
// re-exported by name.
const barrel = [
  BANNER.replace('schema/%FILE%', 'schema/*.schema.json'),
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
