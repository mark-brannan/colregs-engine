// The unicycle model against two trajectories worked by hand, the 17(b)
// sweep against a collision worked by hand, the committed fixtures against
// the model, and a monotonicity check on the sweep's boundary.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import rulesJson from 'colregs/data/rules.json' with { type: 'json' };
import { describe, expect, it } from 'vitest';

import {
  KN_TO_MPS,
  advance,
  checkSolverParameters,
  execute,
  type Limits,
  type Vessel,
} from '../research/kinematics/model.js';
import {
  COARSE_GRID,
  PENCIL,
  PENCIL_SOLVER,
  buildSetup,
  collisionCourse,
  firstBreach,
  fixtureEncounter,
  inEnvelope,
  monotonicityViolations,
  partBSectors,
  sweep,
  type FixturePoint,
  type Ray,
} from '../research/kinematics/sweep.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const KINEMATICS = join(HERE, '../research/kinematics');
const limits: Limits = { max_turn_rate_deg_s: 9, max_decel_mps2: 0.05 };
const setup = buildSetup(PENCIL_SOLVER, COARSE_GRID);

function fly(
  start: Vessel,
  turn_rate_deg_s: number,
  decel_mps2: number,
  dt: number,
  seconds: number,
  lim = limits,
): Vessel {
  let v = start;
  for (let t = 0; t < seconds - 1e-9; t += dt)
    v = advance(v, { turn_rate_deg_s, decel_mps2 }, dt, lim);
  return v;
}

describe('unicycle model, hand-computed', () => {
  it('a quarter circle: 10 m/s at 9 deg/s for 10 s is radius 200/pi, ending abeam to starboard', () => {
    // r = u / omega = 10 / (pi/20) = 63.662 m; after 90 deg of turn the
    // vessel is r east and r north of where it began, heading east.
    const r = 200 / Math.PI;
    for (const dt of [1, 2.5, 10]) {
      const v = fly({ x_m: 0, y_m: 0, heading_deg: 0, speed_mps: 10 }, 9, 0, dt, 10);
      expect(v.x_m).toBeCloseTo(r, 9);
      expect(v.y_m).toBeCloseTo(r, 9);
      expect(v.heading_deg).toBeCloseTo(90, 9);
      expect(v.speed_mps).toBe(10);
    }
  });

  it('a stop: 5 m/s at 0.05 m/s^2 is 210 m and 2 m/s at 60 s, 250 m and rest by 100 s', () => {
    // s(60) = 5*60 - 0.05*60^2/2 = 210; stops at 5/0.05 = 100 s, 5^2/(2*0.05) = 250 m.
    const east = { x_m: 0, y_m: 0, heading_deg: 90, speed_mps: 5 };
    const at60 = fly(east, 0, 0.05, 1, 60);
    expect(at60.x_m).toBeCloseTo(210, 9);
    expect(at60.speed_mps).toBeCloseTo(2, 9);
    // A cadence of 3 s steps over the moment of stopping (t = 100 s).
    const at120 = fly(east, 0, 0.05, 3, 120);
    expect(at120.x_m).toBeCloseTo(250, 9);
    expect(at120.speed_mps).toBe(0);
    expect(at120.y_m).toBeCloseTo(0, 9);
  });

  it('clamps a command to the limits', () => {
    const v = fly({ x_m: 0, y_m: 0, heading_deg: 0, speed_mps: 5 }, 90, 1, 1, 10, {
      max_turn_rate_deg_s: 1,
      max_decel_mps2: 0.05,
    });
    expect(v.heading_deg).toBeCloseTo(10, 9);
    expect(v.speed_mps).toBeCloseTo(4.5, 9);
  });

  it('a manoeuvre turns at the bound, then holds the new heading', () => {
    const lim = { max_turn_rate_deg_s: 2, max_decel_mps2: 0.05 };
    const headings: number[] = [];
    execute(
      { x_m: 0, y_m: 0, heading_deg: 0, speed_mps: 5 },
      { alter_deg: -30, decel_mps2: 0, onset_s: 3 },
      { ...PENCIL_SOLVER, horizon_s: 25 },
      lim,
      (_t, v) => {
        headings.push(v.heading_deg);
        return true;
      },
    );
    // Idle for ticks 1-3 (onset 3 s), 2 deg/s to port for 15 s, then steady.
    expect(headings.slice(0, 3)).toEqual([0, 0, 0]);
    expect(headings[3]).toBeCloseTo(-2, 9);
    expect(headings[17]).toBeCloseTo(-30, 9);
    expect(headings[24]).toBeCloseTo(-30, 9);
  });
});

describe('solver parameters', () => {
  it('reads the departure model record and refuses what it cannot model', () => {
    expect(checkSolverParameters(PENCIL_SOLVER)).toEqual(PENCIL_SOLVER);
    expect(() => checkSolverParameters({ ...PENCIL_SOLVER, dynamics: ['dynamics:yacht'] })).toThrow(
      /unicycle/,
    );
    expect(() => checkSolverParameters({ ...PENCIL_SOLVER, horizon_s: undefined })).toThrow(
      /horizon_s/,
    );
    expect(() => checkSolverParameters({ ...PENCIL_SOLVER, separation_m: 0 })).toThrow(
      /separation_m/,
    );
  });
});

describe('Part B sectors', () => {
  it('tile the circle, read from the facts data', () => {
    const sectors = partBSectors();
    expect(sectors.map((s) => s.name)).toEqual([
      'head-on',
      'crossing-starboard',
      'overtaking',
      'crossing-port',
    ]);
    for (let i = 1; i < sectors.length; i++)
      expect(sectors[i].from_deg).toBe(sectors[i - 1].to_deg);
    expect(sectors[3].to_deg - sectors[0].from_deg).toBe(360);
  });
});

describe('17(b) sweep, hand-computed', () => {
  it('equal speeds, give-way vessel at 315 deg: the collision course is due east', () => {
    // Stand-on goes north at u, give-way at (-d, d) goes east at u: both reach
    // (0, d) together. Closing speed is u*sqrt(2).
    const c = collisionCourse(315, 1)!;
    expect(c.heading_deg).toBeCloseTo(90, 9);
    expect(c.closing).toBeCloseTo(Math.SQRT2, 9);
    expect(collisionCourse(270, 1)).toBeNull();
    expect(collisionCourse(180, 1)).toBeNull();
  });

  it('holding course and speed from 1000*sqrt(2) m, the pair is inside 100 m at the 181 s tick', () => {
    // Range falls at u*sqrt(2) = 10 kn * sqrt(2) = 7.2754 m/s:
    // 1414.2136 - 7.2754*180 = 104.6 m (apart), - 7.2754*181 = 97.4 m (inside).
    const hold = { alter_deg: 0, decel_mps2: 0, onset_s: 0 };
    const u = PENCIL.stand_on_sog_kn * KN_TO_MPS;
    const e = {
      rel_bearing_deg: 315,
      range_m: 1000 * Math.SQRT2,
      give_way_heading_deg: 90,
      give_way_speed_mps: u,
    };
    expect(firstBreach(e, hold, setup)).toBe(181);
    expect(firstBreach({ ...e, range_m: 6000 }, hold, setup)).toBeNull();
  });

  it('a pair already inside the separation is inside the envelope', () => {
    const e = {
      rel_bearing_deg: 315,
      range_m: 50,
      give_way_heading_deg: 90,
      give_way_speed_mps: 5,
    };
    expect(inEnvelope(e, setup)).toBe(true);
  });
});

describe('fixtures', () => {
  const fixtures = JSON.parse(readFileSync(join(KINEMATICS, 'fixtures.json'), 'utf8')) as {
    solver: typeof PENCIL_SOLVER;
    points: FixturePoint[];
  };

  it('record the parameters the model reads', () => {
    expect(fixtures.solver).toEqual(PENCIL_SOLVER);
    for (const p of fixtures.points) expect(p.stand_on.sog_kn).toBe(PENCIL.stand_on_sog_kn);
  });

  it('classify as recorded, each on a collision course, each citing 17(a)(ii) and 17(b)', () => {
    for (const p of fixtures.points) {
      expect(inEnvelope(fixtureEncounter(p), setup), p.id).toBe(p.expect === 'inside');
      const course = collisionCourse(
        p.give_way.rel_bearing_deg,
        p.give_way.sog_kn / p.stand_on.sog_kn,
      )!;
      expect(p.give_way.heading_deg, p.id).toBeCloseTo(course.heading_deg, 1);
      expect(p.cites, p.id).toEqual(['17(a)(ii)', '17(b)']);
      for (const cite of p.cites) expect(Object.keys(rulesJson.paragraphs), p.id).toContain(cite);
    }
  });

  it('come in pairs one metre apart: inside, then outside', () => {
    expect(fixtures.points.length % 2).toBe(0);
    for (let i = 0; i < fixtures.points.length; i += 2) {
      const [inside, outside] = [fixtures.points[i], fixtures.points[i + 1]];
      expect([inside.expect, outside.expect]).toEqual(['inside', 'outside']);
      expect(outside.give_way.range_m - inside.give_way.range_m).toBe(1);
      expect(outside.give_way.rel_bearing_deg).toBe(inside.give_way.rel_bearing_deg);
    }
  });
});

describe('monotonicity', () => {
  it('on the coarse grid, a closer point is never outside the envelope when a farther one is inside', () => {
    const rays = sweep(setup, COARSE_GRID);
    expect(rays.some((r) => r.status === 'closing')).toBe(true);
    expect(monotonicityViolations(rays, setup.ranges_m)).toEqual([]);
  });

  it('reports a ray that breaks it', () => {
    const ranges = [100, 200, 300];
    const broken = {
      sector: 'crossing-port',
      rel_bearing_deg: 300,
      speed_ratio: 1,
      inside: [true, false, true],
      monotone: false,
    } as Ray;
    expect(monotonicityViolations([broken], ranges)).toEqual([
      { ray: broken, outside_at_m: 200, inside_at_m: 300 },
    ]);
  });
});

describe('README', () => {
  it('lists every pencil parameter in its one table', () => {
    const readme = readFileSync(join(KINEMATICS, 'README.md'), 'utf8');
    for (const name of Object.keys(PENCIL)) expect(readme, name).toContain(`\`${name}\``);
  });
});
