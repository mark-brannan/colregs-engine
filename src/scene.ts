// The n-vessel combinator deferred by issue #82: every pair through
// evaluateEncounter unchanged, the rest reduced to TrafficFacts, and a
// report of where pairwise duties conflict. Depends on reduceTraffic.
import type { EvaluateOptions } from './evaluate.js';
import type { Scene, SceneEvaluation } from './types.js';

/** Stub. Shape fixed in `SceneEvaluation`; body deferred until the traffic
 * reduction exists and a grid reads it. */
export function evaluateScene(_scene: Scene, _opts: EvaluateOptions = {}): SceneEvaluation {
  throw new Error('evaluateScene is a stub: deferred on reduceTraffic (issue #82)');
}
