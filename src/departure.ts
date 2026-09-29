// evaluateDeparture — a lookup in a solved region grid (ADR 0012 §4).
// The solver never moves into src/: what moves is its output. Until a grid
// carries `regions` this package can read, every finding is
// `inconclusive-in-model`, and the finding says so in
// `assumptions_violated` rather than throwing.

import type { EvaluateOptions } from './evaluate.js';
import { evaluateEncounter } from './encounter.js';
import { flattenSituation, situationMatches } from './situation.js';
import type {
  DepartureAdvisory,
  DepartureFinding,
  DepartureModel,
  DepartureRegion,
  Situation,
  SolverParameters,
} from './types.js';

function validateModel(model: DepartureModel): void {
  if (typeof model !== 'object' || model === null) {
    throw new Error(`DepartureModel must be an object, got ${JSON.stringify(model)}`);
  }
  for (const key of ['version', 'colregs_version'] as const) {
    if (typeof model[key] !== 'string' || model[key] === '') {
      throw new Error(`DepartureModel.${key} must be a non-empty string`);
    }
  }
  if (model.regions !== undefined && !Array.isArray(model.regions)) {
    throw new Error('DepartureModel.regions must be an array when present');
  }
}

function parametersOf(model: DepartureModel): SolverParameters {
  return {
    dynamics: [...(model.dynamics ?? [])],
    horizon_s: model.horizon_s,
    cadence_s: model.cadence_s,
    separation_m: model.separation_m,
    information: model.information,
    adversary: model.adversary,
  };
}

/** Best margin first; the grid's own order breaks ties. */
function rankAdvisories(advisories: DepartureAdvisory[]): DepartureAdvisory[] {
  return advisories
    .map((a, i) => ({ a, i }))
    .sort((x, y) => y.a.margin_m - x.a.margin_m || x.i - y.i)
    .map(({ a }) => a);
}

/**
 * Region membership for `situation` under `model`, with whatever escapes
 * the grid holds. The model is required and positional: `opts.data` has a
 * default and a grid does not, and every finding names the grid it came
 * from rather than the Rules.
 *
 * @alpha A grid without `regions` yields `inconclusive-in-model` for every
 * situation; no certified grid ships with this package.
 */
export function evaluateDeparture(
  situation: Situation,
  model: DepartureModel,
  opts?: EvaluateOptions,
): DepartureFinding {
  validateModel(model);
  const rules = evaluateEncounter(situation, opts);
  const flat = flattenSituation(situation);

  const assumptionsViolated: string[] = [];
  if (model.colregs_version !== rules.colregs.version) {
    assumptionsViolated.push(
      `grid ${model.version} was solved against colregs ${model.colregs_version}; ` +
        `the rules were evaluated against colregs ${rules.colregs.version}`,
    );
  }

  let region: DepartureRegion | undefined;
  if (model.regions === undefined) {
    assumptionsViolated.push(
      `grid ${model.version} carries no regions this package can read; every situation is inconclusive-in-model`,
    );
  } else {
    region = model.regions.find((r) => situationMatches(r.when, flat));
    if (region === undefined) {
      assumptionsViolated.push(`no region of grid ${model.version} covers this situation`);
    }
  }

  const status = region?.status ?? 'inconclusive-in-model';
  const advisories =
    status === 'no-robust-policy-in-model' ? [] : rankAdvisories(region?.advisories ?? []);
  assumptionsViolated.push(...(region?.assumptions_violated ?? []));

  return {
    status,
    rules,
    advisories,
    model: {
      version: model.version,
      colregs_version: model.colregs_version,
      parameters: parametersOf(model),
      assumptions_violated: assumptionsViolated,
    },
  };
}
