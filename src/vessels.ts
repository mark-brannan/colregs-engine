// The n-vessel combinator deferred by issue #82: every pair through
// evaluateCircumstances unchanged, the rest reduced to OthersFacts, and a
// report of where pairwise duties conflict. Depends on reduceOthers.
import type { EvaluateOptions } from './evaluate.js';
import type { Vessels, VesselsEvaluation } from './types.js';

/** Stub. Shape fixed in `VesselsEvaluation`; body deferred until the
 * reduction of the other vessels exists and a grid reads it. */
export function evaluateVessels(_vessels: Vessels, _opts: EvaluateOptions = {}): VesselsEvaluation {
  throw new Error('evaluateVessels is a stub: deferred on reduceOthers (issue #82)');
}
