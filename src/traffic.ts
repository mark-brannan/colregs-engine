// Reduces other traffic to the facts a grid predicate can read: per sector,
// how many, how near, and whether a helm action that way is foreclosed. The
// Rule 2 verb asks whether a compliant manoeuvre exists, and that question
// is quantified over all traffic, not one pair (issue #82). Roles stay
// pairwise; this never touches them.
import type { Subject, TrafficFacts } from './types.js';

/**
 * Stub. The reduction — sectoring by relative bearing, nearest range, and
 * the foreclosure test — is not yet written; the shape it returns is fixed
 * in `TrafficFacts` so grids and callers can build against it now.
 */
export function reduceTraffic(_own: Subject, _others: Subject[]): TrafficFacts {
  throw new Error('reduceTraffic is a stub: the traffic reduction is not yet written (issue #82)');
}
