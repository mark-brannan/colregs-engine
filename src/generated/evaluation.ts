/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs schema/evaluation.schema.json
 * Version: declared in package.json, resolved in package-lock.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

/**
 * The $defs every result envelope shares (ADR 0014): the colregs provenance stamp, what an evaluation read, entry-id and paragraph-cite vocabularies. No instance validates against the root; the envelopes under schema/*-evaluation.schema.json and the operations manifest $ref into $defs here.
 */
export interface EvaluationSchema {
  [k: string]: unknown;
}
