// Reduces other traffic to the facts a grid predicate can read: per sector,
// how many, how near, and whether a helm action that way is foreclosed. The
// departure verb asks whether a compliant manoeuvre exists, and that question
// is quantified over all traffic, not one pair (issue #82). Roles stay
// pairwise; this never touches them. The one operation in colregs' manifest
// that evaluates nothing: it derives an input class (colregs ADR 0023).
import type { EvaluateOptions } from './evaluate.js';
import type { Subject, TrafficFacts } from './types.js';

/**
 * Stub. The reduction — sectoring by relative bearing, nearest range, and
 * the foreclosure test — is not yet written; the shape it returns is fixed
 * in `TrafficFacts` so grids and callers can build against it now. `opts`
 * is where the sector boundaries will be read from, as every verb reads
 * its data.
 */
export function reduceTraffic(
  _self: Subject,
  _others: Subject[],
  _opts: EvaluateOptions = {},
): TrafficFacts {
  throw new Error('reduceTraffic is a stub: the traffic reduction is not yet written (issue #82)');
}
