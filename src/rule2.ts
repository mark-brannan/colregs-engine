// evaluateRule2Departure — a lookup in a solved region grid. Stub; ADR 0012
// §4 fixes the model and the finding. The solver itself never moves into
// src/: what moves is its output, a certified grid, as a Rule2DepartureModel.

import type { EvaluateOptions } from './evaluate.js';
import type {
  Rule2DepartureFinding,
  Rule2DepartureModel,
  Situation,
} from './types.js';
import { NotImplementedError } from './errors.js';

/**
 * Region membership for `situation` under `model`, with whatever escapes
 * the grid holds. The model is required and positional: `opts.data` has a
 * default and a grid does not, and every finding names the grid it came
 * from rather than the Rules.
 *
 * @alpha Not built: throws {@link NotImplementedError}. No grid exists yet.
 */
export function evaluateRule2Departure(
  _situation: Situation,
  _model: Rule2DepartureModel,
  _opts?: EvaluateOptions,
): Rule2DepartureFinding {
  throw new NotImplementedError('evaluateRule2Departure', 'ADR 0012 §4');
}
