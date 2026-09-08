/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs@0.2.2 data/facts.json (situation)
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned data disagree.
 */

/** The value type of one situation field, given its spec entry. */
type ValueOfSituationSpec<S> =
  | (S extends { kind: 'enum'; values: readonly (infer V)[] }
      ? V
      : S extends { kind: 'number' }
        ? number
        : S extends { kind: 'boolean' }
          ? boolean
          : S extends { kind: 'position' }
            ? { latitude: number; longitude: number }
            : never)
  | (S extends { nullable: true } ? null : never);

/** Absolute kinematic state of one vessel, in the world frame (own/other only). */
export const KIN_SPEC = {
  'kin:position': { kind: 'position' },
  'kin:heading_deg': { kind: 'number' },
  'kin:sog_kn': { kind: 'number' },
  'kin:rot_deg_min': { kind: 'number' },
  'kin:dynamics': { kind: 'enum', values: ['dynamics:tanker', 'dynamics:cargo', 'dynamics:ferry', 'dynamics:fishing', 'dynamics:yacht', 'dynamics:rib', 'dynamics:unknown'] },
  'kin:wind_side': { kind: 'enum', values: ['wind_side:port', 'wind_side:starboard', 'wind_side:unknown'] },
} as const;
export type KinKey = keyof typeof KIN_SPEC;
export type KinValues = {
  [K in KinKey]: ValueOfSituationSpec<(typeof KIN_SPEC)[K]>;
};
export type Kinematics = {
  [K in KinKey]?: KinValues[K];
};

/** What has already been true of this encounter and latches (own/other only). */
export const HIST_SPEC = {
  'hist:was_overtaking': { kind: 'boolean' },
  'hist:latched_at_s': { kind: 'number', nullable: true },
} as const;
export type HistKey = keyof typeof HIST_SPEC;
export type HistValues = {
  [K in HistKey]: ValueOfSituationSpec<(typeof HIST_SPEC)[K]>;
};
export type History = {
  [K in HistKey]?: HistValues[K];
};

/** Relative geometry measured from one subject's own frame (own/other only). */
export const GEO_OWN_SPEC = {
  'geo:rel_bearing_deg': { kind: 'number' },
  'geo:windward': { kind: 'boolean' },
} as const;
export type DirectionalGeometryKey = keyof typeof GEO_OWN_SPEC;
export type DirectionalGeometryValues = {
  [K in DirectionalGeometryKey]: ValueOfSituationSpec<(typeof GEO_OWN_SPEC)[K]>;
};
export type DirectionalGeometry = {
  [K in DirectionalGeometryKey]?: DirectionalGeometryValues[K];
};

/** Relative geometry symmetric between the two vessels (pair only). */
export const GEO_PAIR_SPEC = {
  'geo:range_m': { kind: 'number' },
  'geo:bearing_change_deg_min': { kind: 'number' },
  'geo:cpa_m': { kind: 'number' },
  'geo:tcpa_s': { kind: 'number' },
  'geo:in_sight': { kind: 'boolean' },
  'geo:risk_of_collision': { kind: 'boolean' },
} as const;
export type PairGeometryKey = keyof typeof GEO_PAIR_SPEC;
export type PairGeometryValues = {
  [K in PairGeometryKey]: ValueOfSituationSpec<(typeof GEO_PAIR_SPEC)[K]>;
};
export type PairGeometry = {
  [K in PairGeometryKey]?: PairGeometryValues[K];
};

/** Where the encounter is happening — a property of the water, not of either vessel (pair only). */
export const ENV_SPEC = {
  'env:narrow_channel': { kind: 'boolean' },
  'env:traffic_lane': { kind: 'boolean' },
} as const;
export type EnvironmentKey = keyof typeof ENV_SPEC;
export type EnvironmentValues = {
  [K in EnvironmentKey]: ValueOfSituationSpec<(typeof ENV_SPEC)[K]>;
};
export type Environment = {
  [K in EnvironmentKey]?: EnvironmentValues[K];
};
