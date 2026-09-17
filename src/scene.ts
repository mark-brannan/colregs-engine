// The n-vessel combinator deferred by issue #82: every pair through
// evaluateEncounter unchanged, the rest reduced to TrafficFacts, and a
// report of where pairwise duties conflict. Depends on reduceTraffic.
//
// Each pair is evaluated on the subjects the caller gave, untouched: own's
// `geo` is read for every pair as it stands, so a scene whose vessels need
// different own-frame bearings is the pooled-frame read issue #97 owns, not
// this verb's to settle.

import type { EvaluateOptions } from './evaluate.js';
import { evaluateEncounter } from './encounter.js';
import { boundsOf, locate, reduceTraffic, type TrafficOptions } from './traffic.js';
import type { EffectRole } from './generated/applicability.js';
import type {
  Scene,
  SceneConflict,
  SceneEvaluation,
  Subject,
  TrafficSector,
} from './types.js';

/** Options `evaluateScene` reads: the data every verb reads, and the model
 * whose `separation_m` decides foreclosure. */
export interface SceneOptions extends EvaluateOptions, TrafficOptions {}

/** The roles that ask own to manoeuvre. A stand-on vessel is asked for
 * course and speed, which no other vessel can foreclose. */
const MANOEUVRE_DUTIES: ReadonlySet<EffectRole> = new Set<EffectRole>([
  'role:give-way',
  'role:keep-clear',
  'role:shall-not-impede',
]);

/** The one helm action the Rules name for a vessel keeping out of the way:
 * an alteration to starboard, large enough to be seen -- 8(a), 14(a),
 * 15(a)'s bar on crossing ahead, 17(c)'s on turning to port. */
const MANOEUVRE_SECTOR: TrafficSector = 'starboard';

function validateScene(scene: Scene): void {
  if (typeof scene !== 'object' || scene === null) {
    throw new Error(`scene must be an object, got ${JSON.stringify(scene)}.`);
  }
  if (!Array.isArray(scene.others)) {
    throw new Error(`scene.others must be an array, got ${JSON.stringify(scene.others)}.`);
  }
  if (scene.pairs !== undefined && !Array.isArray(scene.pairs)) {
    throw new Error(`scene.pairs must be an array when present, got ${JSON.stringify(scene.pairs)}.`);
  }
}

/** The vessels in `sector` within the model's `separation_m` of own: the
 * ones a foreclosed sector is foreclosed by. */
function foreclosingVessels(
  own: Subject,
  others: Subject[],
  except: number,
  sector: TrafficSector,
  opts: SceneOptions,
): number[] {
  const separation = opts.model?.separation_m;
  if (typeof separation !== 'number') return [];
  const bounds = boundsOf(opts.data);
  return others
    .map((other, index) => ({ index, at: locate(own, other, bounds) }))
    .filter(
      ({ index, at }) =>
        index !== except &&
        at?.sector === sector &&
        at.range_m !== undefined &&
        at.range_m <= separation,
    )
    .map(({ index }) => index);
}

/**
 * Every `(own, other)` pair evaluated as its own encounter, own's traffic
 * picture reduced over all of `others`, and one conflict per duty whose
 * helm action another vessel has foreclosed. Each pair's own situation
 * carries the traffic reduced over every vessel but that pair's, which is
 * what `Situation.traffic` means.
 */
export function evaluateScene(scene: Scene, opts: SceneOptions = {}): SceneEvaluation {
  validateScene(scene);
  const { model, ...evaluateOpts } = opts;
  const conflicts: SceneConflict[] = [];

  const pairs = scene.others.map((other, index) => {
    const rest = scene.others.filter((_, j) => j !== index);
    const traffic = reduceTraffic(scene.own, rest, opts);
    const evaluation = evaluateEncounter(
      { self: scene.own, other, pair: scene.pairs?.[index], traffic },
      evaluateOpts,
    );
    if (traffic[MANOEUVRE_SECTOR]?.foreclosed === true) {
      const blocked_by = foreclosingVessels(scene.own, scene.others, index, MANOEUVRE_SECTOR, opts);
      for (const role of evaluation.roles.self) {
        if (MANOEUVRE_DUTIES.has(role.role) && blocked_by.length > 0) {
          conflicts.push({ duty: role.by, to: index, blocked_by });
        }
      }
    }
    return evaluation;
  });

  return {
    pairs,
    traffic: reduceTraffic(scene.own, scene.others, opts),
    conflicts,
  };
}
