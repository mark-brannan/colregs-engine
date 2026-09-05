/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs@0.1.2 data/facts.json
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned data disagree.
 */

/**
 * Every fact key colregs defines, with the values it accepts. The type-level
 * unions below and the runtime check in src/facts.ts both read this, so a
 * record that typechecks is a record validateFacts() accepts.
 */
export const FACT_SPEC = {
  'fact:propulsion': { kind: 'enum', values: ['propulsion:power', 'propulsion:sail', 'propulsion:oars'] },
  'fact:activity': { kind: 'enum', values: ['activity:none', 'activity:fishing', 'activity:trawling', 'activity:towing', 'activity:pushing', 'activity:being_towed', 'activity:nuc', 'activity:ram', 'activity:ram_underwater', 'activity:cbd', 'activity:mine', 'activity:pilot', 'activity:diving'] },
  'fact:position': { kind: 'enum', values: ['position:underway', 'position:anchored', 'position:aground', 'position:moored'] },
  'fact:making_way': { kind: 'boolean' },
  'fact:length_m': { kind: 'number' },
  'fact:tow_length_m': { kind: 'number' },
  'fact:max_speed_kn': { kind: 'number' },
  'fact:gear_extent_m': { kind: 'number' },
  'fact:beam_m': { kind: 'number' },
  'fact:composite_unit': { kind: 'boolean' },
  'fact:non_displacement': { kind: 'boolean' },
  'fact:wig': { kind: 'boolean' },
  'fact:wig_near_surface': { kind: 'boolean' },
  'fact:near_channel': { kind: 'boolean' },
  'fact:inconspicuous_partly_submerged_tow': { kind: 'boolean' },
  'fact:towed_alongside': { kind: 'boolean' },
  'fact:obstruction_exists': { kind: 'boolean' },
  'fact:obstruction_side': { kind: 'enum', values: ['obstruction_side:port', 'obstruction_side:starboard'] },
} as const;

/** Every fact key colregs defines. */
export type FactKey = keyof typeof FACT_SPEC;

type ValueOfSpec<S> = S extends { kind: 'enum'; values: readonly (infer V)[] }
  ? V
  : S extends { kind: 'number' }
    ? number
    : S extends { kind: 'boolean' }
      ? boolean
      : S extends { kind: 'string' }
        ? string
        : never;

/** The value type of each fact key. */
export type FactValues = {
  [K in FactKey]: ValueOfSpec<(typeof FACT_SPEC)[K]>;
};

/**
 * What the user has asserted about one vessel at one moment. Every key is
 * optional — a record asserts a subset — but no key outside colregs'
 * vocabulary is assignable, and an enumerated key takes only its own values.
 */
export type FactRecord = {
  [K in FactKey]?: FactValues[K];
};
