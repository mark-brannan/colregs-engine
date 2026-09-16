// evaluateConduct — what a vessel did over a window (ADR 0012 §2-§3). The
// trace is validated and windowed, each sample is evaluated as an encounter,
// conduct-category entries are matched at every sample, and the Rule 13(d)/17
// protocol phases are read off the role transitions. The STL monitors that
// would decide `kept` and `breached` are not written: a verdict here is
// `pending`, and says when the duty attached.

import {
  COLREGS_VERSION,
  RESOLVED_DATA,
  entryCategory,
  type EvaluateOptions,
} from './evaluate.js';
import { evaluateEncounter } from './encounter.js';
import { validateTrace } from './facts.js';
import { flattenSituation, situationMatches } from './situation.js';
import type {
  ConductEvaluation,
  ConductPhaseChange,
  ConductVerdict,
  EncounterEvaluation,
  Entry,
  EntryId,
  ParagraphCite,
  Trace,
  TraceSample,
} from './types.js';

type SubjectKey = 'own' | 'other';
const SUBJECTS: readonly SubjectKey[] = ['own', 'other'];

/** The paragraph a role puts its holder under. `keep-clear` is 18(f)(i)'s
 * and 18(e)'s duty and takes the first; 8(f) governs shall-not-impede. */
const ROLE_PHASE: Record<string, ParagraphCite> = {
  'give-way': '16',
  'stand-on': '17(a)(i)',
  'shall-not-impede': '8(f)(i)',
  'keep-clear': '18(f)(i)',
};

/** Rank when a subject holds several roles at once: the phase named is the
 * strongest duty, so give-way outranks a mere shall-not-impede. */
const ROLE_RANK: readonly string[] = ['give-way', 'keep-clear', 'stand-on', 'shall-not-impede'];

function strongestRole(roles: { role: string }[]): string | undefined {
  return ROLE_RANK.find((r) => roles.some((x) => x.role === r));
}

/** A stand-on vessel that is turning or has changed heading since the last
 * sample has moved from 17(a)(i) (keep course and speed) to 17(a)(ii) (may
 * take action). Only what the samples state is read. */
function isManoeuvring(prev: TraceSample | undefined, cur: TraceSample, subject: SubjectKey): boolean {
  const kin = cur.situation[subject]?.kin;
  const rot = kin?.['kin:rot_deg_min'];
  if (typeof rot === 'number' && rot !== 0) return true;
  const heading = kin?.['kin:heading_deg'];
  const before = prev?.situation[subject]?.kin?.['kin:heading_deg'];
  return typeof heading === 'number' && typeof before === 'number' && heading !== before;
}

/** The paragraph a subject is under at this sample. Latch first, role
 * second: the 13(d) latch names the encounter, not a role. Rule 13 opens
 * "notwithstanding anything contained in the Rules of Part B Sections I and
 * II", so a subject who was the overtaking vessel is in 13(d) whatever role
 * the table conferred on her, including the stand-on 18(a) hands a RAM
 * vessel overtaking a power-driven one. The table is one-sided: every entry
 * writes `effect.own` from {give-way, keep-clear, shall-not-impede, none}
 * and `effect.other` from {stand-on, none} (test/conduct.test.ts pins
 * this), so for `other` only the stand-on branch is live and reading the
 * role first threw her latch away. This check is the invariant; a data gate
 * that keeps 18(a)'s entries from naming a latched other stand-on is the
 * mechanism, and the two are not redundant. The latch alone does not name
 * an overtaking: `13d` is gated on the vessels being in sight (Q-49), and
 * the classification it produces is what makes the phase 13(d). */
function phaseAt(
  prev: TraceSample | undefined,
  cur: TraceSample,
  evaluation: EncounterEvaluation,
  subject: SubjectKey,
): ParagraphCite | undefined {
  const latched = cur.situation[subject]?.hist?.['hist:was_overtaking'] === true;
  if (latched && evaluation.encounter === 'overtaking') return '13(d)';
  const role = strongestRole(evaluation.roles[subject]);
  if (role === undefined) return undefined;
  if (role === 'stand-on' && isManoeuvring(prev, cur, subject)) return '17(a)(ii)';
  return ROLE_PHASE[role];
}

function conductEntries(entries: Entry[]): Entry[] {
  return entries.filter((e) => entryCategory(e) === 'conduct');
}

/** The subjects a conduct entry's effect addresses; an effect shape colregs
 * has not fixed yet defaults to own, the subject every one-subject entry
 * addresses. */
function subjectsOf(entry: Entry): SubjectKey[] {
  const effect = entry.effect as Record<string, unknown> | undefined;
  const named = SUBJECTS.filter((s) => effect?.[s] !== undefined && effect?.[s] !== 'none');
  return named.length > 0 ? named : ['own'];
}

/**
 * The ids of the conduct entries that attached anywhere in the window,
 * without judging them — the trace-fixture contract.
 *
 * @alpha
 */
export function appliedConductEntries(trace: Trace, opts: EvaluateOptions = {}): EntryId[] {
  validateTrace(trace);
  const candidates = conductEntries((opts.data ?? RESOLVED_DATA).entries);
  const flats = trace.samples.map((s) => flattenSituation(s.situation));
  return candidates
    .filter((e) => flats.some((flat) => situationMatches(e.when, flat)))
    .map((e) => e.id);
}

/**
 * One verdict per applied conduct entry per subject it attached to, plus
 * the Rule 13(d)/17 phase changes, over the window `trace` covers.
 *
 * @alpha Verdicts are `pending`: the monitors that decide `kept` and
 * `breached` are not built. Phases and attachment times are computed.
 */
export function evaluateConduct(trace: Trace, opts: EvaluateOptions = {}): ConductEvaluation {
  validateTrace(trace);
  const data = opts.data ?? RESOLVED_DATA;
  const source: 'resolved' | 'caller' = opts.data ? 'caller' : 'resolved';
  const samples = trace.samples;

  const evaluations = samples.map((s) => evaluateEncounter(s.situation, opts));
  const flats = samples.map((s) => flattenSituation(s.situation));

  const verdicts: ConductVerdict[] = [];
  const applied: EntryId[] = [];
  for (const e of conductEntries(data.entries)) {
    const at = flats.findIndex((flat) => situationMatches(e.when, flat));
    if (at < 0) continue;
    applied.push(e.id);
    for (const subject of subjectsOf(e)) {
      verdicts.push({ id: e.id, subject, verdict: 'pending', attached_at_s: samples[at].t_s });
    }
  }

  const phases: ConductPhaseChange[] = [];
  const current: Record<SubjectKey, ParagraphCite | undefined> = { own: undefined, other: undefined };
  samples.forEach((sample, i) => {
    for (const subject of SUBJECTS) {
      if (subject === 'other' && sample.situation.other === undefined) continue;
      const phase = phaseAt(samples[i - 1], sample, evaluations[i], subject);
      if (phase !== undefined && phase !== current[subject]) {
        phases.push({ subject, phase, at_s: sample.t_s });
      }
      current[subject] = phase;
    }
  });

  return {
    colregs: { version: COLREGS_VERSION, source },
    window: { from_s: samples[0].t_s, to_s: samples[samples.length - 1].t_s, samples: samples.length },
    applied,
    verdicts,
    phases,
  };
}
