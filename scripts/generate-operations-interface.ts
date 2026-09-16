// Generates src/generated/operations.ts's `interface ColregsEngine` from
// node_modules/colregs/data/operations.json (ADR 0014): colregs now owns the
// engine's own interface shape, one operation per verb, so this file is the
// consumer half of that contract — a colregs schema stem this generator
// cannot map to one of this package's own exports is a hard error, same as
// generate-schema-types.ts's ROOT_NAMES.
//
// Run: npm run generate

import { readFileSync, writeFileSync } from 'node:fs';

interface OperationInput {
  name: string;
  schema: string;
}
interface OperationCompanion {
  verb: string;
  output: string;
}
interface Operation {
  adr: string;
  inputs: OperationInput[];
  output: string;
  companion?: OperationCompanion;
  fixtures: unknown[];
}
interface OperationsJson {
  note?: string;
  operations: Record<string, Operation>;
}

const operations = (
  JSON.parse(
    readFileSync('node_modules/colregs/data/operations.json', 'utf8'),
  ) as OperationsJson
).operations;
const colregsVersion: string = JSON.parse(
  readFileSync('node_modules/colregs/package.json', 'utf8'),
).version;

/**
 * schema/*.schema.json stem (and, for the companion output, its JSON
 * pointer) -> the TS type this package already exports for that shape.
 * `evaluation.schema.json#/$defs/ruleIds` is every companion's output --
 * colregs' own entry-id list, this package's `RuleId[]`. An operation whose
 * input or output names a stem missing here is a hard error: either a new
 * colregs operation this generator has not been taught about, or a genuine
 * drift between the manifest and this package's exports.
 */
const TYPE_BY_SCHEMA_REF: Record<string, string> = {
  'schema/fact-record.schema.json': 'FactRecord',
  'schema/situation.schema.json': 'Situation',
  'schema/trace.schema.json': 'Trace',
  'schema/rule2-departure-model.schema.json': 'Rule2DepartureModel',
  'schema/display-evaluation.schema.json': 'DisplayEvaluation',
  'schema/encounter-evaluation.schema.json': 'EncounterEvaluation',
  'schema/conduct-evaluation.schema.json': 'ConductEvaluation',
  'schema/rule2-departure-finding.schema.json': 'Rule2DepartureFinding',
  'schema/evaluation.schema.json#/$defs/ruleIds': 'RuleId[]',
};

function typeFor(ref: string): string {
  const t = TYPE_BY_SCHEMA_REF[ref];
  if (!t) {
    throw new Error(
      `operations.json references ${ref}, which has no entry in TYPE_BY_SCHEMA_REF: add one in scripts/generate-operations-interface.ts`,
    );
  }
  return t;
}

const lines: string[] = [];
for (const [verb, op] of Object.entries(operations)) {
  const params = op.inputs.map((i) => `${i.name}: ${typeFor(i.schema)}`).join(', ');
  lines.push(`  ${verb}(${params}): ${typeFor(op.output)};`);
  if (op.companion) {
    lines.push(`  ${op.companion.verb}(${params}): ${typeFor(op.companion.output)};`);
  }
}

const out = `/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs@${colregsVersion} data/operations.json
 * Regenerate with \`npm run generate\`; \`npm run generate:check\` fails the
 * build if this file and the pinned data disagree.
 */

import type {
  ConductEvaluation,
  DisplayEvaluation,
  EncounterEvaluation,
  RuleId,
  FactRecord,
  Rule2DepartureFinding,
  Rule2DepartureModel,
  Situation,
  Trace,
} from '../types.js';

/**
 * The engine interface colregs owns (ADR 0014): every verb ADR 0011 and ADR
 * 0012 name, positional inputs in the manifest's own order, and each verb's
 * entry-id companion. Trailing \`opts\` is this binding's own -- an options
 * bag colregs' manifest does not name -- so every export in src/index.ts
 * takes one more (optional) parameter than the signatures below.
 */
export interface ColregsEngine {
${lines.join('\n')}
}
`;

writeFileSync('src/generated/colregs-engine.ts', out);
console.log(
  `generated ColregsEngine (${Object.keys(operations).length} operations) from colregs@${colregsVersion}`,
);
