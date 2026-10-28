// Reduces the other vessels to the facts a grid predicate can read: per
// sector, how many, how near, and whether a helm action that way is
// foreclosed. The departure verb asks whether a compliant manoeuvre exists,
// and that question is quantified over all other vessels, not one pair
// (issue #82). Roles stay pairwise; this never touches them. The one
// operation colregs ADR 0023 names that evaluates nothing: it derives an
// input class. Not in the manifest yet.
import type { EvaluateOptions } from './evaluate.js';
import type { Vessel, OthersFacts } from './types.js';

/**
 * Stub. The reduction — sectoring by relative bearing, nearest range, and
 * the foreclosure test — is not yet written; the shape it returns is fixed
 * in `OthersFacts` so grids and callers can build against it now. `opts`
 * is where the sector boundaries will be read from, as every verb reads
 * its data.
 */
export function reduceOthers(
  _self: Vessel,
  _others: Vessel[],
  _opts: EvaluateOptions = {},
): OthersFacts {
  throw new Error(
    'reduceOthers is a stub: the reduction of the other vessels is not yet written (issue #82)',
  );
}
