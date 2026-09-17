// Reduces other traffic to the facts a grid predicate can read: per sector,
// how many, how near, and whether a helm action that way is foreclosed. The
// Rule 2 verb asks whether a compliant manoeuvre exists, and that question
// is quantified over all traffic, not one pair (issue #82). Roles stay
// pairwise; this never touches them.
//
// The sector boundaries are the arcs the Part B entries already cut, read
// out of their own `geo:rel_bearing_deg` constraints: a colregs release that
// moves an arc moves these sectors with it. Foreclosure is the solver's
// `separation_m` and nothing else -- a vessel that near, that way, is a
// vessel the helm cannot turn through.

import { RESOLVED_DATA } from './evaluate.js';
import { validateSituation } from './facts.js';
import type { EvaluateOptions } from './evaluate.js';
import type {
  ApplicabilityData,
  SolverParameters,
  Subject,
  TrafficFacts,
  TrafficSector,
  TrafficSectorFacts,
} from './types.js';

/** Options every traffic reduction reads, on top of `opts.data`: the
 * sectors are cut by whichever applicability data the reduction reads. */
export interface TrafficOptions extends EvaluateOptions {
  /** The solved grid, or bare parameters carrying the same
   * `separation_m`: without one, foreclosure is unknown and unreported. */
  model?: SolverParameters;
}

export const TRAFFIC_SECTORS: readonly TrafficSector[] = [
  'ahead',
  'starboard',
  'astern',
  'port',
];

const REL_BEARING_KEY = 'geo:rel_bearing_deg';
const BOUND_OPS = ['gt', 'gte', 'lt', 'lte'];
const METRES_PER_NM = 1852;
/** IUGG mean radius: the sphere the range is measured on. */
const EARTH_RADIUS_M = 6371008.8;

const rad = (deg: number): number => (deg * Math.PI) / 180;
const deg = (r: number): number => (r * 180) / Math.PI;
const norm360 = (b: number): number => ((b % 360) + 360) % 360;

/** Every numeric bound any entry puts on a relative bearing, wherever the
 * predicate language nests it (`not`, `any_of`, per-modality `when`). */
function bearingBounds(node: unknown, underBearing: boolean, out: Set<number>): void {
  if (Array.isArray(node)) {
    for (const item of node) bearingBounds(item, underBearing, out);
    return;
  }
  if (typeof node !== 'object' || node === null) return;
  for (const [key, value] of Object.entries(node)) {
    const bearing = underBearing || key.endsWith(REL_BEARING_KEY);
    if (bearing && typeof value === 'number' && BOUND_OPS.includes(key)) out.add(value);
    else bearingBounds(value, bearing, out);
  }
}

/** The two half-angles the arcs are symmetric about: the head-on arc's,
 * nearest dead ahead, and the overtaking arc's, nearest dead astern. Both
 * are stated in the data as a pair `t` and `360 - t`. */
export interface SectorBounds {
  ahead_deg: number;
  astern_deg: number;
}

export function sectorBounds(data: ApplicabilityData): SectorBounds {
  const bounds = new Set<number>();
  bearingBounds(data.entries, false, bounds);
  const symmetric = [...bounds]
    .filter((v) => v > 0 && v < 180 && bounds.has(360 - v))
    .sort((a, b) => a - b);
  if (symmetric.length < 2) {
    throw new Error(
      `applicability data: expected at least two arcs symmetric about the ` +
        `fore-and-aft line in the ${REL_BEARING_KEY} constraints, found ` +
        `${symmetric.length === 0 ? 'none' : symmetric.join(', ')}.`,
    );
  }
  return { ahead_deg: symmetric[0], astern_deg: symmetric[symmetric.length - 1] };
}

const RESOLVED_BOUNDS: SectorBounds = sectorBounds(RESOLVED_DATA);
const CALLER_BOUNDS = new WeakMap<ApplicabilityData, SectorBounds>();

/** The arcs `data` cuts, solved once per body of data handed in. */
export function boundsOf(data?: ApplicabilityData): SectorBounds {
  if (data === undefined || data === RESOLVED_DATA) return RESOLVED_BOUNDS;
  let bounds = CALLER_BOUNDS.get(data);
  if (bounds === undefined) {
    bounds = sectorBounds(data);
    CALLER_BOUNDS.set(data, bounds);
  }
  return bounds;
}

/**
 * The sector a vessel bearing `rel_bearing_deg` from own lies in. The
 * inclusive edges are the entries': the head-on arc is `lte`/`gte` its
 * bound, the overtaking arc strictly inside its own, so every bearing lands
 * in exactly one sector.
 */
export function sectorOf(
  relBearingDeg: number,
  bounds: SectorBounds = RESOLVED_BOUNDS,
): TrafficSector {
  const b = norm360(relBearingDeg);
  if (b <= bounds.ahead_deg || b >= 360 - bounds.ahead_deg) return 'ahead';
  if (b <= bounds.astern_deg) return 'starboard';
  if (b < 360 - bounds.astern_deg) return 'astern';
  return 'port';
}

/** Where one other vessel is, in own's frame. `range_m` is absent when the
 * two positions are not both known. */
export interface TrafficBearing {
  sector: TrafficSector;
  rel_bearing_deg: number;
  range_m?: number;
}

/**
 * Own's frame, from whatever the two subjects carry: positions when both
 * have one, else the reciprocal of the other vessel's own relative bearing.
 * `undefined` when neither road is open -- a vessel own cannot place is in
 * no sector, and is counted in none.
 */
export function locate(
  own: Subject,
  other: Subject,
  bounds: SectorBounds = RESOLVED_BOUNDS,
): TrafficBearing | undefined {
  const heading = own.kin?.['kin:heading_deg'];
  if (heading === undefined) return undefined;
  const from = own.kin?.['kin:position'];
  const to = other.kin?.['kin:position'];
  if (from && to) {
    const phi1 = rad(from.latitude);
    const phi2 = rad(to.latitude);
    const dLambda = rad(to.longitude - from.longitude);
    const dPhi = phi2 - phi1;
    const h =
      Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
    const range_m = 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
    const trueBearing = deg(
      Math.atan2(
        Math.sin(dLambda) * Math.cos(phi2),
        Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda),
      ),
    );
    const rel = norm360(trueBearing - heading);
    return { sector: sectorOf(rel, bounds), rel_bearing_deg: rel, range_m };
  }
  // The other vessel's `geo:rel_bearing_deg` is where own bears from her:
  // reversed and read against own's heading, it is where she bears from own.
  const otherHeading = other.kin?.['kin:heading_deg'];
  const ownFromOther = other.geo?.[REL_BEARING_KEY];
  if (otherHeading === undefined || ownFromOther === undefined) return undefined;
  const rel = norm360(otherHeading + ownFromOther + 180 - heading);
  return { sector: sectorOf(rel, bounds), rel_bearing_deg: rel };
}

/**
 * `own`'s traffic picture: every sector named, `count` 0 where nothing is
 * there, `nearest_nm` only where a range is known, and `foreclosed` only
 * where the answer is not a guess -- false with the sector empty, and
 * otherwise a range against the model's `separation_m`. A vessel `locate`
 * cannot place appears in no sector.
 */
export function reduceTraffic(
  own: Subject,
  others: Subject[],
  opts: TrafficOptions = {},
): TrafficFacts {
  for (const other of others) validateSituation({ self: own, other });
  if (others.length === 0) validateSituation({ self: own });

  const separation = opts.model?.separation_m;
  const bounds = boundsOf(opts.data);
  const facts: TrafficFacts = {};
  const unmeasured: Record<string, boolean> = {};
  for (const sector of TRAFFIC_SECTORS) facts[sector] = { count: 0 };

  for (const other of others) {
    const at = locate(own, other, bounds);
    if (at === undefined) continue;
    const sector = facts[at.sector] as TrafficSectorFacts;
    sector.count = (sector.count ?? 0) + 1;
    if (at.range_m === undefined) {
      unmeasured[at.sector] = true;
      continue;
    }
    const nm = at.range_m / METRES_PER_NM;
    if (sector.nearest_nm === undefined || nm < sector.nearest_nm) sector.nearest_nm = nm;
  }

  for (const name of TRAFFIC_SECTORS) {
    const sector = facts[name] as TrafficSectorFacts;
    if (sector.count === 0) {
      sector.foreclosed = false;
      continue;
    }
    if (typeof separation !== 'number') continue;
    const inside =
      sector.nearest_nm !== undefined && sector.nearest_nm * METRES_PER_NM <= separation;
    // A vessel whose range is unknown may be inside it: only "yes" is safe
    // to state, and "no" waits until every vessel there has been measured.
    if (inside || !unmeasured[name]) sector.foreclosed = inside;
  }
  return facts;
}
