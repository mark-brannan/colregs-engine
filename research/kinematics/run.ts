// Runs the Rule 17(b) reachability sweep and writes the boundary table (the
// kinematics rows of docs/research-programme.md).
//
//   npm run kinematics                        # the full grid
//   npm run kinematics -- --coarse            # a sample of it
//   npm run kinematics -- --model model.json  # solver parameters from a
//                                             # departure model file
//   npm run kinematics -- --write-fixtures    # rewrite fixtures.json (not
//                                             # with --model: exits 2)
//
// The table goes to research/kinematics/out/boundary.tsv (gitignored: it is a
// function of the pinned colregs and the README's parameter table). Exits
// non-zero when a ray is not monotone in range. Not part of `npm test`; the
// model, sweep and fixtures are covered by test/kinematics.test.ts.
//
// boundary.tsv has one row per ray: the give-way heading, the closing speed,
// inside_up_to_m, clear_from_m and whether the ray is monotone in range (a
// closer point is never outside when a farther one on the ray is inside). A
// ray with no collision course has empty cells.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checkSolverParameters, type KinematicSolverParameters } from './model.js';
import {
  COARSE_GRID,
  FULL_GRID,
  PENCIL,
  PENCIL_SOLVER,
  buildSetup,
  fixtureEncounter,
  inEnvelope,
  monotonicityViolations,
  sweep,
  sweepRay,
  type FixturePoint,
  type Ray,
  type Setup,
} from './sweep.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, 'out');
const FIXTURES = join(HERE, 'fixtures.json');

/** The rays whose boundary becomes fixtures: where, and at what speed ratio. */
const FIXTURE_RAYS = [
  { sector: 'crossing-port', rel_bearing_deg: 315, speed_ratio: 1 },
  { sector: 'crossing-port', rel_bearing_deg: 300, speed_ratio: 1.5 },
  { sector: 'overtaking', rel_bearing_deg: 180, speed_ratio: 2 },
] as const;

const args = process.argv.slice(2);
const known = new Set(['--coarse', '--model', '--write-fixtures', '--help']);
const modelAt = args.indexOf('--model');
const unknown = args.filter((a, i) => !known.has(a) && i !== modelAt + 1);
const missingModel = modelAt >= 0 && !args[modelAt + 1];
const modelAndFixtures = modelAt >= 0 && args.includes('--write-fixtures');
if (args.includes('--help') || unknown.length > 0 || missingModel || modelAndFixtures) {
  console.error('usage: npm run kinematics -- [--coarse] [--model <file.json> | --write-fixtures]');
  process.exit(unknown.length > 0 || missingModel || modelAndFixtures ? 2 : 0);
}

const solver: KinematicSolverParameters =
  modelAt >= 0
    ? checkSolverParameters(JSON.parse(readFileSync(args[modelAt + 1], 'utf8')))
    : PENCIL_SOLVER;
const grid = args.includes('--coarse') ? COARSE_GRID : FULL_GRID;
const setup = buildSetup(solver, grid);

if (args.includes('--write-fixtures')) {
  writeFixtures(buildSetup(solver, FULL_GRID));
}

const started = performance.now();
const rays = sweep(setup, grid);
const seconds = (performance.now() - started) / 1000;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'boundary.tsv'), boundaryTable(rays));

const violations = monotonicityViolations(rays, setup.ranges_m);
console.log(
  `parameters: ${modelAt >= 0 ? args[modelAt + 1] : 'pencil record'}: horizon ${solver.horizon_s} s, ` +
    `cadence ${solver.cadence_s} s, separation ${solver.separation_m} m`,
);
console.log(
  `sweep: ${rays.length} rays, ${setup.ranges_m.length} ranges, ${setup.manoeuvres.length} manoeuvres, ` +
    `${seconds.toFixed(1)} s`,
);
for (const name of [...new Set(rays.map((r) => r.sector))]) {
  const closing = rays.filter((r) => r.sector === name && r.status === 'closing');
  const reach = closing.map((r) => r.inside_up_to_m ?? 0);
  console.log(
    `  ${name}: ${closing.length}/${rays.filter((r) => r.sector === name).length} rays on a collision course, ` +
      `envelope out to ${Math.min(...reach)}-${Math.max(...reach)} m`,
  );
}
console.log(`monotonicity: ${violations.length} violation(s)`);
for (const v of violations) {
  const { sector, rel_bearing_deg, speed_ratio } = v.ray;
  console.error(
    `  ${sector} ${rel_bearing_deg} deg x${speed_ratio}: outside at ${v.outside_at_m} m, inside at ${v.inside_at_m} m`,
  );
}
console.log(`wrote ${join(OUT_DIR, 'boundary.tsv')}`);
process.exit(violations.length > 0 ? 1 : 0);

function boundaryTable(all: Ray[]): string {
  const header = [
    'sector',
    'rel_bearing_deg',
    'speed_ratio',
    'status',
    'give_way_heading_deg',
    'closing_mps',
    'inside_up_to_m',
    'clear_from_m',
    'monotone',
  ];
  const cell = (x: number | string | boolean | null) =>
    x === null ? '' : typeof x === 'number' ? String(Math.round(x * 100) / 100) : String(x);
  const rows = all.map((r) =>
    [
      r.sector,
      r.rel_bearing_deg,
      r.speed_ratio,
      r.status,
      r.give_way_heading_deg,
      r.closing_mps,
      r.inside_up_to_m,
      r.clear_from_m,
      r.monotone,
    ]
      .map(cell)
      .join('\t'),
  );
  return [header.join('\t'), ...rows].join('\n') + '\n';
}

function writeFixtures(full: Setup): void {
  const points: FixturePoint[] = [];
  for (const pick of FIXTURE_RAYS) {
    const ray = sweepRay(pick.sector, pick.rel_bearing_deg, pick.speed_ratio, full);
    if (ray.status !== 'closing' || ray.inside_up_to_m === null || ray.clear_from_m === null) {
      throw new Error(
        `${pick.sector} ${pick.rel_bearing_deg} x${pick.speed_ratio} has no boundary to fixture`,
      );
    }
    const heading = Math.round(ray.give_way_heading_deg! * 100) / 100;
    const sog = Math.round(pick.speed_ratio * PENCIL.stand_on_sog_kn * 100) / 100;
    for (const [expect, range] of [
      ['inside', ray.inside_up_to_m],
      ['outside', ray.clear_from_m],
    ] as const) {
      const point: FixturePoint = {
        id: `${pick.sector}-${pick.rel_bearing_deg}-x${pick.speed_ratio}-${expect}`,
        expect,
        cites: ['17(a)(ii)', '17(b)'],
        stand_on: { heading_deg: 0, sog_kn: PENCIL.stand_on_sog_kn },
        give_way: {
          rel_bearing_deg: pick.rel_bearing_deg,
          range_m: range,
          heading_deg: heading,
          sog_kn: sog,
        },
        reading: reading(expect, range, heading, sog, pick.rel_bearing_deg, full),
      };
      if (inEnvelope(fixtureEncounter(point), full) !== (expect === 'inside')) {
        throw new Error(`${point.id} does not hold once its numbers are rounded`);
      }
      points.push(point);
    }
  }
  const body = {
    note: 'Illustrative parameters, labelled pencil in the README. Each pair straddles the envelope on one bearing, one metre apart.',
    solver: full.solver,
    points,
  };
  writeFileSync(FIXTURES, JSON.stringify(body, null, 2) + '\n');
  console.log(`wrote ${FIXTURES}`);
}

function reading(
  expect: 'inside' | 'outside',
  range: number,
  heading: number,
  sog: number,
  bearing: number,
  s: Setup,
): string {
  const head = `Stand-on vessel making ${PENCIL.stand_on_sog_kn} kn on 000. The give-way vessel bears ${bearing} at ${range} m, ${sog} kn on ${heading.toFixed(2).padStart(6, '0')}: a collision course.`;
  const n = s.manoeuvres.length;
  return expect === 'inside'
    ? `${head} None of ${n} manoeuvres keeps ${s.solver.separation_m} m clear for ${s.solver.horizon_s} s: collision cannot be avoided by the give-way vessel alone.`
    : `${head} At least one of ${n} manoeuvres keeps ${s.solver.separation_m} m clear for ${s.solver.horizon_s} s: the give-way vessel alone can still avoid collision.`;
}
