// The Rule 17(b) envelope by forward simulation (the kinematics rows of
// docs/research-programme.md).
//
// The stand-on vessel holds course and speed. The give-way vessel starts on a
// collision course (constant bearing, closing) from a given relative bearing,
// range and speed ratio, and tries every manoeuvre in a discretised set. A
// geometry is inside the envelope when none of them keeps the pair at least
// `separation_m` apart at every cadence tick of the horizon: collision cannot
// be avoided by the give-way vessel alone.
//
// Pure functions; run.ts does the I/O. The sectors are read out of the colregs
// facts data, never written here. Every constant in PENCIL is an illustrative
// value from the README's parameter table.

import factsJson from 'colregs/data/facts.json' with { type: 'json' };

import {
  KN_TO_MPS,
  execute,
  type KinematicSolverParameters,
  type Limits,
  type Manoeuvre,
  type Vessel,
} from './model.js';

/** Stand-in for a departure model's solver record: the values
 * test/departure.test.ts uses. */
export const PENCIL_SOLVER: KinematicSolverParameters = {
  dynamics: ['unicycle'],
  horizon_s: 600,
  cadence_s: 1,
  separation_m: 100,
};

export const PENCIL = {
  stand_on_sog_kn: 10,
  max_turn_rate_deg_s: 1,
  max_decel_mps2: 0.05,
  alterations_deg: [-180, -135, -90, -60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60, 90, 135, 180],
  decel_fractions: [0, 0.5, 1],
  onset_s: 0,
  min_range_factor: 1.2,
  max_range_m: 5000,
} as const;

export interface Grid {
  bearings_per_sector: number;
  range_count: number;
  speed_ratios: number[];
}

export const FULL_GRID: Grid = { bearings_per_sector: 12, range_count: 32, speed_ratios: [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] };
export const COARSE_GRID: Grid = { bearings_per_sector: 3, range_count: 12, speed_ratios: [1, 1.5, 2] };

export interface Setup {
  solver: KinematicSolverParameters;
  limits: Limits;
  manoeuvres: Manoeuvre[];
  ranges_m: number[];
  stand_on_speed_mps: number;
}

export function buildSetup(solver: KinematicSolverParameters, grid: Grid): Setup {
  const limits: Limits = { max_turn_rate_deg_s: PENCIL.max_turn_rate_deg_s, max_decel_mps2: PENCIL.max_decel_mps2 };
  const manoeuvres: Manoeuvre[] = [];
  for (const alter_deg of PENCIL.alterations_deg) {
    for (const fraction of PENCIL.decel_fractions) {
      manoeuvres.push({ alter_deg, decel_mps2: fraction * limits.max_decel_mps2, onset_s: PENCIL.onset_s });
    }
  }
  const lo = Math.ceil(PENCIL.min_range_factor * solver.separation_m);
  const ranges_m = Array.from({ length: grid.range_count }, (_, i) =>
    Math.round(lo * (PENCIL.max_range_m / lo) ** (i / (grid.range_count - 1))),
  );
  return { solver, limits, manoeuvres, ranges_m, stand_on_speed_mps: PENCIL.stand_on_sog_kn * KN_TO_MPS };
}

// --- The Part B sector partition ------------------------------------------

export interface Sector {
  name: 'head-on' | 'crossing-starboard' | 'overtaking' | 'crossing-port';
  /** Relative bearing of the other vessel off self's bow, open interval. */
  from_deg: number;
  to_deg: number;
  /** Whether self is the stand-on vessel in a collision-course encounter
   * with the other vessel in this sector (Rules 13(b), 15, 17). */
  stand_on: boolean;
}

interface FactsData {
  situation: {
    constants: Record<'head_on_half_angle_deg' | 'overtaking_sector_from_deg' | 'overtaking_sector_to_deg', { value: number }>;
  };
}

export function partBSectors(facts: FactsData = factsJson as unknown as FactsData): Sector[] {
  const head_on = facts.situation.constants.head_on_half_angle_deg.value;
  const from = facts.situation.constants.overtaking_sector_from_deg.value;
  const to = facts.situation.constants.overtaking_sector_to_deg.value;
  return [
    { name: 'head-on', from_deg: -head_on, to_deg: head_on, stand_on: false },
    { name: 'crossing-starboard', from_deg: head_on, to_deg: from, stand_on: false },
    { name: 'overtaking', from_deg: from, to_deg: to, stand_on: true },
    { name: 'crossing-port', from_deg: to, to_deg: 360 - head_on, stand_on: true },
  ];
}

/** `n` bearings inside the open sector, at the midpoints of n equal parts. */
export function sectorBearings(sector: Sector, n: number): number[] {
  return Array.from({ length: n }, (_, i) =>
    round2((sector.from_deg + ((i + 0.5) / n) * (sector.to_deg - sector.from_deg) + 360) % 360),
  );
}

// --- Geometry --------------------------------------------------------------

const RAD = Math.PI / 180;

/** One encounter: the stand-on vessel at the origin heading north, the
 * give-way vessel placed by relative bearing and range. */
export interface Encounter {
  rel_bearing_deg: number;
  range_m: number;
  give_way_heading_deg: number;
  give_way_speed_mps: number;
}

/** The give-way heading that puts the pair on a collision course, for a
 * stand-on speed of 1 and a give-way speed of `speed_ratio`; null when no
 * heading does. When two do, the one with the higher closing speed, the
 * shorter time to go. `closing` is the closing speed in units of the
 * stand-on speed. */
export function collisionCourse(rel_bearing_deg: number, speed_ratio: number): { heading_deg: number; closing: number } | null {
  const b = Math.cos(rel_bearing_deg * RAD);
  const disc = b * b - (1 - speed_ratio * speed_ratio);
  if (disc < 0) return null;
  const closing = b + Math.sqrt(disc);
  if (closing <= 1e-9) return null;
  const vx = -closing * Math.sin(rel_bearing_deg * RAD);
  const vy = 1 - closing * b;
  return { heading_deg: (Math.atan2(vx, vy) / RAD + 360) % 360, closing };
}

function start(e: Encounter): Vessel {
  return {
    x_m: e.range_m * Math.sin(e.rel_bearing_deg * RAD),
    y_m: e.range_m * Math.cos(e.rel_bearing_deg * RAD),
    heading_deg: e.give_way_heading_deg,
    speed_mps: e.give_way_speed_mps,
  };
}

/** The first tick, in seconds, at which the pair is closer than the
 * separation while the give-way vessel flies `m`; null if it never is. */
export function firstBreach(e: Encounter, m: Manoeuvre, setup: Setup): number | null {
  const sep2 = setup.solver.separation_m ** 2;
  if (e.range_m ** 2 < sep2) return 0;
  let breach: number | null = null;
  execute(start(e), m, setup.solver, setup.limits, (t, g) => {
    const dy = g.y_m - setup.stand_on_speed_mps * t;
    if (g.x_m * g.x_m + dy * dy < sep2) {
      breach = t;
      return false;
    }
    return true;
  });
  return breach;
}

/** True when no manoeuvre in the set keeps the pair apart: 17(b) binds. */
export function inEnvelope(e: Encounter, setup: Setup): boolean {
  return setup.manoeuvres.every((m) => firstBreach(e, m, setup) !== null);
}

// --- Rays and the boundary -------------------------------------------------

export interface Ray {
  sector: Sector['name'];
  rel_bearing_deg: number;
  speed_ratio: number;
  status: 'closing' | 'no-collision-course';
  give_way_heading_deg: number | null;
  closing_mps: number | null;
  /** Inside the envelope at each grid range, ascending. */
  inside: boolean[];
  /** The largest range inside the envelope, to the metre; null if none. */
  inside_up_to_m: number | null;
  /** The smallest range outside it beyond that; null if none. */
  clear_from_m: number | null;
  monotone: boolean;
}

export function encounterOn(ray: Pick<Ray, 'rel_bearing_deg' | 'give_way_heading_deg'>, speed_ratio: number, range_m: number, setup: Setup): Encounter {
  return {
    rel_bearing_deg: ray.rel_bearing_deg,
    range_m,
    give_way_heading_deg: ray.give_way_heading_deg!,
    give_way_speed_mps: speed_ratio * setup.stand_on_speed_mps,
  };
}

/** One committed fixture point: two vessels, read as the rules read them. */
export interface FixturePoint {
  id: string;
  expect: 'inside' | 'outside';
  cites: string[];
  stand_on: { heading_deg: number; sog_kn: number };
  give_way: { rel_bearing_deg: number; range_m: number; heading_deg: number; sog_kn: number };
  reading: string;
}

export function fixtureEncounter(p: FixturePoint): Encounter {
  return {
    rel_bearing_deg: p.give_way.rel_bearing_deg,
    range_m: p.give_way.range_m,
    give_way_heading_deg: p.give_way.heading_deg,
    give_way_speed_mps: p.give_way.sog_kn * KN_TO_MPS,
  };
}

export function sweepRay(sector: Sector['name'], rel_bearing_deg: number, speed_ratio: number, setup: Setup): Ray {
  const course = collisionCourse(rel_bearing_deg, speed_ratio);
  const ray: Ray = {
    sector,
    rel_bearing_deg,
    speed_ratio,
    status: course ? 'closing' : 'no-collision-course',
    give_way_heading_deg: course ? course.heading_deg : null,
    closing_mps: course ? course.closing * setup.stand_on_speed_mps : null,
    inside: [],
    inside_up_to_m: null,
    clear_from_m: null,
    monotone: true,
  };
  if (!course) return ray;

  const at = (range_m: number) => inEnvelope(encounterOn(ray, speed_ratio, range_m, setup), setup);
  ray.inside = setup.ranges_m.map(at);
  ray.monotone = isPrefix(ray.inside);

  const last = ray.inside.lastIndexOf(true);
  if (last < 0) {
    ray.clear_from_m = setup.ranges_m[0];
    return ray;
  }
  let lo = setup.ranges_m[last];
  ray.inside_up_to_m = lo;
  if (last + 1 < ray.inside.length) {
    let hi = setup.ranges_m[last + 1];
    // Bisect to the metre. On a ray that is not monotone this finds some
    // boundary between the two, which is all the table claims for it.
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (at(mid)) lo = mid;
      else hi = mid;
    }
    ray.inside_up_to_m = lo;
    ray.clear_from_m = hi;
  }
  return ray;
}

/** True when the flags run true…true, false…false: nearer is never outside
 * when farther is inside. */
function isPrefix(flags: boolean[]): boolean {
  const first_false = flags.indexOf(false);
  return first_false < 0 || flags.indexOf(true, first_false) < 0;
}

export interface Violation {
  ray: Pick<Ray, 'sector' | 'rel_bearing_deg' | 'speed_ratio'>;
  outside_at_m: number;
  inside_at_m: number;
}

/** Every ray on which a nearer grid range is outside the envelope while a
 * farther one is inside. */
export function monotonicityViolations(rays: Ray[], ranges_m: number[]): Violation[] {
  const found: Violation[] = [];
  for (const ray of rays) {
    if (ray.monotone) continue;
    const near = ray.inside.indexOf(false);
    const far = ray.inside.lastIndexOf(true);
    found.push({ ray, outside_at_m: ranges_m[near], inside_at_m: ranges_m[far] });
  }
  return found;
}

export function sweep(setup: Setup, grid: Grid): Ray[] {
  const rays: Ray[] = [];
  for (const sector of partBSectors().filter((s) => s.stand_on)) {
    for (const bearing of sectorBearings(sector, grid.bearings_per_sector)) {
      for (const ratio of grid.speed_ratios) rays.push(sweepRay(sector.name, bearing, ratio, setup));
    }
  }
  return rays;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
