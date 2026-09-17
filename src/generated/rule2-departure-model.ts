/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs schema/rule2-departure-model.schema.json (version pinned in package.json)
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

/**
 * One solved region grid, named immutably by `version`, the positional second input of evaluateRule2Departure (ADR 0012 §4, ADR 0014). Only `version`, `colregs_version`, the solver parameters and the `regions` encoding are API; any other field is the artefact's own, so additional properties are allowed. Structure only.
 */
export type Rule2DepartureModelSchema = SolverParameters & {
  version: string;
  colregs_version: string;
  regions?: Region[];
};
/**
 * This interface was referenced by `SituationWhen`'s JSON-Schema definition
 * via the `patternProperty` "^fact:[a-z0-9_]+$".
 *
 * This interface was referenced by `SituationWhen`'s JSON-Schema definition
 * via the `patternProperty` "^(self|other):(fact|kin|geo|hist):[a-z0-9_]+$".
 *
 * This interface was referenced by `SituationWhen`'s JSON-Schema definition
 * via the `patternProperty` "^pair:(geo|env):[a-z0-9_]+$".
 */
export type PredicateValue =
  | {
      gte?: number;
      gt?: number;
      lte?: number;
      lt?: number;
    }
  | string
  | boolean
  | string[]
  | {
      not: PredicateValue;
    }
  | {
      /**
       * @minItems 1
       */
      any_of: PredicateValue[];
    };
export type Status = 'not-flagged' | 'model-rule-conflict' | 'no-robust-policy-in-model' | 'inconclusive-in-model';

export interface SolverParameters {
  dynamics?: string[];
  horizon_s?: number;
  cadence_s?: number;
  separation_m?: number;
  information?: 'full' | 'partial';
  adversary?: 'compliant' | 'physics';
}
export interface Region {
  when: SituationWhen;
  status: Status;
  advisories?: Advisory[];
  assumptions_violated?: string[];
}
export interface SituationWhen {
  /**
   * @minItems 1
   */
  any_of?: SituationWhen[];
  /**
   * This interface was referenced by `SituationWhen`'s JSON-Schema definition
   * via the `patternProperty` "^fact:[a-z0-9_]+$".
   *
   * This interface was referenced by `SituationWhen`'s JSON-Schema definition
   * via the `patternProperty` "^(self|other):(fact|kin|geo|hist):[a-z0-9_]+$".
   *
   * This interface was referenced by `SituationWhen`'s JSON-Schema definition
   * via the `patternProperty` "^pair:(geo|env):[a-z0-9_]+$".
   *
   * This interface was referenced by `SituationWhen`'s JSON-Schema definition
   * via the `patternProperty` "^fact:[a-z0-9_]+$".
   *
   * This interface was referenced by `SituationWhen`'s JSON-Schema definition
   * via the `patternProperty` "^(self|other):(fact|kin|geo|hist):[a-z0-9_]+$".
   *
   * This interface was referenced by `SituationWhen`'s JSON-Schema definition
   * via the `patternProperty` "^pair:(geo|env):[a-z0-9_]+$".
   *
   * This interface was referenced by `SituationWhen`'s JSON-Schema definition
   * via the `patternProperty` "^fact:[a-z0-9_]+$".
   *
   * This interface was referenced by `SituationWhen`'s JSON-Schema definition
   * via the `patternProperty` "^(self|other):(fact|kin|geo|hist):[a-z0-9_]+$".
   *
   * This interface was referenced by `SituationWhen`'s JSON-Schema definition
   * via the `patternProperty` "^pair:(geo|env):[a-z0-9_]+$".
   */
  [k: string]: PredicateValue | SituationWhen[] | undefined;
}
export interface Advisory {
  action: {
    alter_deg?: number;
    sog_kn?: number;
  };
  margin_m: number;
  breaches: string[];
  envelope: {
    holds_until_s: number;
  };
}
