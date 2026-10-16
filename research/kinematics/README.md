# Rule 17(b) last-moment envelope

✎ **Pencil.** Items P3.1 and P3.2 of the
[research programme](../../docs/research-programme.md). Every number in the
table below is illustrative until a source or a ruling fixes it.

```
npm run kinematics                      # the full grid, seconds
npm run kinematics -- --coarse          # a sample of it
npm run kinematics -- --model m.json    # solver parameters from a departure model
npm run kinematics -- --write-fixtures  # rewrite fixtures.json from the full grid
```

## What is computed

Rule 17(b) binds the stand-on vessel when she is "so close that collision
cannot be avoided by the action of the give-way vessel alone". Here that is a
reachability set.

- The stand-on vessel holds course and speed.
- For each relative bearing, range and speed ratio on the grid, the give-way
  vessel starts on a collision course: constant bearing, closing. Where two
  headings qualify, the one with the higher closing speed.
- It tries every manoeuvre in a discretised set: a course alteration taken at
  the maximum rate of turn, with a deceleration held until it stops.
- A geometry is **inside** the envelope when no manoeuvre keeps the pair at
  least `separation_m` apart at every `cadence_s` tick of `horizon_s`.
- The boundary on a ray (one bearing, one speed ratio) is the largest range
  inside, bisected to the metre.

Bearings sample the open interior of the Part B sectors where self stands on
in a collision-course encounter: overtaking and crossing-port, with edges read
from `situation.constants` in colregs `data/facts.json`. In the others self is
give-way or neither, so 17(b) does not name her.

## Parameters

One table; `PENCIL` and `PENCIL_SOLVER` in `sweep.ts` hold the same values.
The first four are the departure model's `SolverParameters`.

| name | value | meaning |
|---|---|---|
| `dynamics` | `['unicycle']` | the only model implemented |
| `horizon_s` | 600 | how long the pair is watched; "ample time" |
| `cadence_s` | 1 | the tick at which separation is checked |
| `separation_m` | 100 | the distance that counts as collision |
| `stand_on_sog_kn` | 10 | the stand-on speed; give-way speed is a ratio of it |
| `max_turn_rate_deg_s` | 1 | the bound on rate of turn |
| `max_decel_mps2` | 0.05 | the bound on deceleration |
| `alterations_deg` | -180 to 180, 17 values | course changes tried; "substantial" |
| `decel_fractions` | 0, 0.5, 1 | shares of `max_decel_mps2` tried |
| `onset_s` | 0 | delay before the give-way vessel acts |
| `min_range_factor` | 1.2 | nearest range on the grid, times `separation_m` |
| `max_range_m` | 5000 | farthest range on the grid |

Pencil throughout: no data carries a canonical value for any row. Horizon,
cadence and separation match `test/departure.test.ts`; `--model` replaces them.

## What is claimed

- **Outside** is witnessed at the ticks and within the horizon: some manoeuvre
  in the set keeps the pair apart at every tick, not necessarily between them
  or after `horizon_s`.
- **Inside** means no manoeuvre in the set does. A manoeuvre outside the set
  could, so the reported envelope contains the true one.

Not claimed: what a mariner should do, that any stand-on action resolves an
inside geometry, Rule 19, a third vessel, wind or current, or a proof (item
P3.3).

## Output

`out/boundary.tsv` (gitignored) and `fixtures.json`; `run.ts` lists the
columns. The fixtures are pairs of points one metre apart straddling the
boundary on three rays, citing 17(a)(ii) and 17(b).
