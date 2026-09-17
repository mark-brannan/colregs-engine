/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: colregs schema/conduct-evaluation.schema.json (version pinned in package.json)
 * Regenerate with `npm run generate`; `npm run generate:check` fails the
 * build if this file and the pinned schema disagree.
 */

export type RuleIds = string[];
export type Subject = 'self' | 'other';

/**
 * The result of evaluateConduct: one verdict per applied conduct entry per subject over the window the caller handed over, and the Rule 13(d)/17 phase changes seen (ADR 0012 §3, ADR 0014). Structure only.
 */
export interface ConductEvaluationSchema {
  colregs: Colregs;
  window: {
    from_s: number;
    to_s: number;
    samples: number;
  };
  applied: RuleIds;
  verdicts: Verdict[];
  phases: PhaseChange[];
}
export interface Colregs {
  version: string;
  source: 'resolved' | 'caller';
}
export interface Verdict {
  id: string;
  subject: Subject;
  verdict: 'kept' | 'breached' | 'pending';
  attached_at_s?: number;
  decided_at_s?: number;
  robustness?: {
    value: number;
    unit: string;
  };
}
export interface PhaseChange {
  subject: Subject;
  phase: string;
  at_s: number;
}
