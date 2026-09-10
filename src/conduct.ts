// evaluateConduct — what a vessel did over a window. Stub; ADR 0012 §2-§3
// fix Trace and ConductEvaluation. STL monitors are the verdict function;
// the phase machine is programme phase 4's TLA+/UPPAAL model.

import type { EvaluateOptions } from './evaluate.js';
import type { ConductEvaluation, EntryId, Trace } from './types.js';
import { NotImplementedError } from './errors.js';

/**
 * One verdict per applied conduct entry per subject it attached to, plus
 * the Rule 13(d)/17 phase changes, over the window `trace` covers.
 *
 * @alpha Not built: throws {@link NotImplementedError}.
 */
export function evaluateConduct(
  _trace: Trace,
  _opts?: EvaluateOptions,
): ConductEvaluation {
  throw new NotImplementedError('evaluateConduct', 'ADR 0012 §3');
}

/**
 * The ids of the conduct entries that attached anywhere in the window,
 * without judging them — the trace-fixture contract.
 *
 * @alpha Not built: throws {@link NotImplementedError}.
 */
export function appliedConductEntries(
  _trace: Trace,
  _opts?: EvaluateOptions,
): EntryId[] {
  throw new NotImplementedError('appliedConductEntries', 'ADR 0012 §3');
}
