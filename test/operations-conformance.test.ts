// Round-trip conformance (ADR 0014, colregs-engine#86): for every fixture
// case, this package's real output validates against colregs' own result
// schema — the manifest's `output` for each operation. Not a replay of the
// fixture's `expect` (fixtures.test.ts and situation-fixtures.test.ts do
// that); this checks the shape of what evaluateDisplay/evaluateEncounter
// actually return, against the schema colregs ships for it, so a field this
// package adds, drops or mistypes fails here even when every entry id still
// matches.

import Ajv2020 from 'ajv/dist/2020.js';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import operationsJson from 'colregs/data/operations.json';
import applicabilityFixturesJson from 'colregs/fixtures/applicability-fixtures.json';
import situationFixturesJson from 'colregs/fixtures/situation-fixtures.json';
import { evaluateEncounter, evaluateDisplay } from '../src/index';
import type { FactRecord, Situation } from '../src/index';

const SCHEMA_DIR = 'node_modules/colregs/schema';

const ajv = new Ajv2020({ strict: false });
for (const file of readdirSync(SCHEMA_DIR)) {
  if (!file.endsWith('.schema.json')) continue;
  ajv.addSchema(JSON.parse(readFileSync(join(SCHEMA_DIR, file), 'utf8')));
}

interface Operation {
  output: string;
}
const operations = (operationsJson as { operations: Record<string, Operation> })
  .operations;

/** `"schema/display-evaluation.schema.json"` -> the Ajv-compiled validator
 * for that schema's `$id`, resolved the same way operations.json's own
 * `schema/...` paths resolve: relative to the package's schema/ directory. */
function validatorFor(schemaRef: string) {
  const stem = schemaRef.replace(/^schema\//, '').replace(/\.schema\.json$/, '');
  const schema = JSON.parse(
    readFileSync(join(SCHEMA_DIR, `${stem}.schema.json`), 'utf8'),
  ) as { $id: string };
  const validate = ajv.getSchema(schema.$id);
  if (!validate) {
    throw new Error(`no compiled schema for ${schemaRef} ($id ${schema.$id})`);
  }
  return validate;
}

const displayFixtures = applicabilityFixturesJson as unknown as {
  cases: { name: string; facts: FactRecord }[];
};
const situationFixtures = situationFixturesJson as unknown as {
  cases: { name: string; situation: Situation }[];
};

describe('round-trip conformance against colregs result schemas (ADR 0014)', () => {
  it('every operation in data/operations.json this package implements has a compilable output schema', () => {
    for (const verb of ['evaluateDisplay', 'evaluateEncounter']) {
      expect(() => validatorFor(operations[verb].output)).not.toThrow();
    }
  });

  const validateDisplay = validatorFor(operations.evaluateDisplay.output);
  for (const c of displayFixtures.cases) {
    it(`evaluateDisplay("${c.name}") satisfies schema/display-evaluation.schema.json`, () => {
      const result = evaluateDisplay(c.facts);
      const valid = validateDisplay(result);
      expect(valid, JSON.stringify(validateDisplay.errors)).toBe(true);
    });
  }

  const validateEncounter = validatorFor(operations.evaluateEncounter.output);
  for (const c of situationFixtures.cases) {
    it(`evaluateEncounter("${c.name}") satisfies schema/encounter-evaluation.schema.json`, () => {
      const result = evaluateEncounter(c.situation);
      const valid = validateEncounter(result);
      expect(valid, JSON.stringify(validateEncounter.errors)).toBe(true);
    });
  }
});
