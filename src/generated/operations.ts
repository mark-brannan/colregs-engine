/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs schema/operations.schema.json
 * Version: declared in package.json, resolved in package-lock.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

export type Adr = string;
export type SchemaRef = string;
export type Verb = string;

/**
 * The engine interface colregs owns (ADR 0014): one operation per verb ADR 0011 and ADR 0012 name, each binding its positional inputs and its result to a schema under schema/, its entry-id companion, and the fixture cases that exercise it. Structure only -- that every schema reference resolves and every fixture file is bound is checked in the tests.
 */
export interface OperationsManifest {
  note?: string;
  operations: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^[a-z][A-Za-z0-9]*$".
     */
    [k: string]: {
      adr: Adr;
      /**
       * @minItems 1
       */
      inputs: {
        name: string;
        schema: SchemaRef;
      }[];
      output: SchemaRef;
      companion?: {
        verb: Verb;
        output: SchemaRef;
      };
      fixtures: {
        file: string;
        /**
         * @minItems 1
         */
        case_inputs: string[];
        expect?: SchemaRef;
      }[];
    };
  };
}
