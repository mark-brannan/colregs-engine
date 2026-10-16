// The unicycle vessel behind the Rule 17(b) envelope (the kinematics rows of
// docs/research-programme.md): a point with a heading and a speed, a bounded
// rate of turn and a bounded deceleration.
//
// Horizon, cadence and separation come from the departure model's
// SolverParameters (src/types.ts), never from a constant of this file; the
// rate-of-turn and deceleration bounds are not part of that record and arrive
// as `Limits`. Nothing here enters src/.
//
// Frame: x east, y north, heading in degrees clockwise from north.

import type { SolverParameters } from '../../src/types.js';

export const KN_TO_MPS = 1852 / 3600;

/** The part of SolverParameters this model reads. */
export type KinematicSolverParameters = Pick<
  SolverParameters,
  'dynamics' | 'horizon_s' | 'cadence_s' | 'separation_m'
>;

export interface Limits {
  max_turn_rate_deg_s: number;
  max_decel_mps2: number;
}

export interface Vessel {
  x_m: number;
  y_m: number;
  heading_deg: number;
  speed_mps: number;
}

/** What the helm asks for; `advance` clamps it to the limits. */
export interface Command {
  turn_rate_deg_s: number;
  decel_mps2: number;
}

/** A course alteration (signed, starboard positive) taken at the maximum
 * rate of turn, with a deceleration held until the vessel stops. Both begin
 * at `onset_s`. */
export interface Manoeuvre {
  alter_deg: number;
  decel_mps2: number;
  onset_s: number;
}

/** Accepts a record that asks for the unicycle and names a positive horizon,
 * cadence and separation; anything else is a model this sweep cannot read. */
export function checkSolverParameters(p: Partial<KinematicSolverParameters>): KinematicSolverParameters {
  if (!p.dynamics?.includes('unicycle')) {
    throw new Error(`dynamics ${JSON.stringify(p.dynamics)} does not include 'unicycle', the only model implemented`);
  }
  for (const key of ['horizon_s', 'cadence_s', 'separation_m'] as const) {
    const value = p[key];
    if (typeof value !== 'number' || !(value > 0)) throw new Error(`${key} must be a positive number, got ${value}`);
  }
  return { dynamics: p.dynamics, horizon_s: p.horizon_s!, cadence_s: p.cadence_s!, separation_m: p.separation_m! };
}

const RAD = Math.PI / 180;

/** One step of `dt` seconds. Exact for a constant speed on a constant turn
 * (a circular arc); second-order accurate while the speed ramps down. A
 * vessel that stops mid-step travels only to where it stopped. */
export function advance(v: Vessel, command: Command, dt: number, limits: Limits): Vessel {
  const rate = Math.max(-limits.max_turn_rate_deg_s, Math.min(limits.max_turn_rate_deg_s, command.turn_rate_deg_s));
  const decel = Math.max(0, Math.min(limits.max_decel_mps2, command.decel_mps2));

  let moving_s = dt;
  let distance: number;
  let speed = v.speed_mps;
  if (decel > 0 && speed - decel * dt <= 0) {
    moving_s = speed / decel;
    distance = (speed * speed) / (2 * decel);
    speed = 0;
  } else {
    const next = speed - decel * dt;
    distance = ((speed + next) / 2) * dt;
    speed = next;
  }

  const half_turn = (rate * moving_s * RAD) / 2;
  const chord = half_turn === 0 ? distance : (distance * Math.sin(half_turn)) / half_turn;
  const mid_heading = (v.heading_deg + (rate * moving_s) / 2) * RAD;
  return {
    x_m: v.x_m + chord * Math.sin(mid_heading),
    y_m: v.y_m + chord * Math.cos(mid_heading),
    heading_deg: v.heading_deg + rate * dt,
    speed_mps: speed,
  };
}

/** Runs `m` from `start` for the horizon at the cadence, calling `visit` with
 * the time and the vessel after each tick until it returns false. */
export function execute(
  start: Vessel,
  m: Manoeuvre,
  p: KinematicSolverParameters,
  limits: Limits,
  visit: (t_s: number, v: Vessel) => boolean,
): void {
  const dt = p.cadence_s;
  const ticks = Math.floor(p.horizon_s / dt);
  const sign = Math.sign(m.alter_deg);
  let remaining_deg = Math.abs(m.alter_deg);
  let v = start;
  for (let k = 1; k <= ticks; k++) {
    const live = (k - 1) * dt >= m.onset_s;
    let turn_rate = 0;
    if (live && remaining_deg > 1e-9) {
      turn_rate = Math.min(limits.max_turn_rate_deg_s, remaining_deg / dt);
      remaining_deg = Math.max(0, remaining_deg - turn_rate * dt);
    }
    v = advance(v, { turn_rate_deg_s: sign * turn_rate, decel_mps2: live ? m.decel_mps2 : 0 }, dt, limits);
    if (!visit(k * dt, v)) return;
  }
}
