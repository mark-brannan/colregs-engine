// The Part B phase of the conformance run: the same three Phase 0 checks the
// display pass makes, over the two-subject situation space.
//
// conformance compares src/encounter.ts against situation-reference.ts, the
// independent ADR 0016 read. The engine half of ADR 0016 is its own item, so
// a disagreement here is a finding for a person to triage and never a failed
// build -- only a harness error (a situation the enumerator built that the
// engine will not accept) fails.
//
// consistency asks whether the data can leave two vessels both give-way,
// both stand-on, or an encounter classified with risk asserted and nobody
// bound. coverage asks whether every non-display entry fires somewhere.

import { evaluateEncounter } from '../../src/encounter.js';
import type { ApplicabilityData, Entry, Situation } from '../../src/types.js';

import {
  enumerateSituations,
  extractSituationAxes,
  formatSituationAxisTable,
  totalSituations,
} from './situation-enumerate.js';
import { referenceEvaluateEncounter, type ReferenceRole } from './situation-reference.js';

/** How run.ts takes a finding from this phase. */
export type RecordSituationFinding = (
  check: string,
  groupKey: string,
  description: string,
  cites: string[],
  situation: Situation,
) => void;

export interface PartBStats {
  axisTable: string;
  bound: number;
  records: number;
  wallMs: number;
  appliedMismatches: number;
  modalityMismatches: number;
  classificationMismatches: number;
  riskMismatches: number;
  roleMismatches: number;
  bothGiveWay: number;
  bothStandOn: number;
  unresolved: number;
  neverFired: string[];
  harnessErrors: number;
}

function sortedIds(ids: readonly string[]): string {
  return [...ids].sort().join(',');
}

function roleKeys(roles: readonly ReferenceRole[]): string[] {
  return roles.map((r) => `${r.role}@${r.by}`).sort();
}

function holds(roles: readonly ReferenceRole[], role: string): string | undefined {
  return roles.find((r) => r.role === role)?.by;
}

/** The `role@entry` pairs one seat's role set holds and the other's does
 * not, reduced to the entry ids: the divergence grouped by its cause rather
 * than by which vessel happened to be `self`. */
function onlyIn(a: readonly ReferenceRole[], b: readonly ReferenceRole[], into: Set<string>): void {
  const held = new Set(roleKeys(b));
  for (const key of roleKeys(a)) {
    if (!held.has(key)) into.add(key.split('@')[1]);
  }
}

export function runPartB(
  data: ApplicabilityData,
  record: RecordSituationFinding,
  sampleSize?: number,
): PartBStats {
  const space = extractSituationAxes(data);
  const byId = new Map<string, Entry>(space.entries.map((e) => [e.id, e]));
  const citeOf = (ids: readonly string[]): string[] => ids.map((id) => byId.get(id)?.cite ?? id);

  const stats: PartBStats = {
    axisTable: formatSituationAxisTable(space.axes),
    bound: totalSituations(space.axes),
    records: 0,
    wallMs: 0,
    appliedMismatches: 0,
    modalityMismatches: 0,
    classificationMismatches: 0,
    riskMismatches: 0,
    roleMismatches: 0,
    bothGiveWay: 0,
    bothStandOn: 0,
    unresolved: 0,
    neverFired: [],
    harnessErrors: 0,
  };

  const everApplied = new Set<string>();
  const t0 = Date.now();

  for (const situation of enumerateSituations(space)) {
    if (sampleSize !== undefined && stats.records >= sampleSize) break;
    stats.records++;

    const reference = referenceEvaluateEncounter(data, situation);
    for (const id of reference.applied) everApplied.add(id);

    let engine;
    try {
      engine = evaluateEncounter(situation, { data });
    } catch (err) {
      stats.harnessErrors++;
      record(
        'harness-encounter-error',
        String((err as Error).message).slice(0, 120),
        `the enumerator built a situation evaluateEncounter rejects: ${(err as Error).message}`,
        [],
        situation,
      );
      continue;
    }

    const engineApplied = sortedIds(engine.applied);
    const referenceApplied = sortedIds(reference.applied);
    if (engineApplied !== referenceApplied) {
      stats.appliedMismatches++;
      const engineSet = new Set(engine.applied);
      const missing = reference.applied.filter((id) => !engineSet.has(id));
      const referenceSet = new Set(reference.applied);
      const extra = engine.applied.filter((id) => !referenceSet.has(id));
      record(
        'conformance-encounter-applied',
        `missing:${sortedIds(missing)}|extra:${sortedIds(extra)}`,
        `engine and reference disagree on applied entries: engine is missing ${JSON.stringify(missing)}, has extra ${JSON.stringify(extra)}`,
        citeOf([...missing, ...extra]),
        situation,
      );
    } else {
      for (const id of reference.applied) {
        if (engine.modalities[id] === reference.modalities[id]) continue;
        stats.modalityMismatches++;
        record(
          'conformance-encounter-modality',
          `${id}:${engine.modalities[id]}!=${reference.modalities[id]}`,
          `entry ${id} resolves to modality '${engine.modalities[id]}' in the engine but '${reference.modalities[id]}' in the reference`,
          citeOf([id]),
          situation,
        );
      }
    }

    if (engine.encounter !== reference.encounter) {
      stats.classificationMismatches++;
      record(
        'conformance-encounter-classification',
        `${engine.encounter ?? '(none)'}!=${reference.encounter ?? '(none)'}`,
        `engine classifies the encounter as '${engine.encounter ?? '(absent)'}' and the reference as '${reference.encounter ?? '(absent)'}'`,
        [],
        situation,
      );
    }

    if (engine.risk_of_collision.asserted !== reference.risk.asserted) {
      stats.riskMismatches++;
      record(
        'conformance-encounter-risk',
        `${engine.risk_of_collision.asserted}!=${reference.risk.asserted}`,
        `engine asserts risk of collision = ${engine.risk_of_collision.asserted}, the reference ${reference.risk.asserted}`,
        [],
        situation,
      );
    }

    // ADR 0016 §3: a vessel's roles are the pool's, so a one-frame engine
    // disagrees here until its own half of that ADR lands.
    const addedSet = new Set<string>();
    const droppedSet = new Set<string>();
    onlyIn(reference.roles.self, engine.roles.self, addedSet);
    onlyIn(reference.roles.other, engine.roles.other, addedSet);
    onlyIn(engine.roles.self, reference.roles.self, droppedSet);
    onlyIn(engine.roles.other, reference.roles.other, droppedSet);
    if (addedSet.size > 0 || droppedSet.size > 0) {
      stats.roleMismatches++;
      // Keyed by what the pooled read reaches that the engine cannot, which
      // is the cause: every role the engine holds and the pool does not is
      // one of these entries' own `rel:overrides` firing across the frames.
      const added = [...addedSet].sort();
      const dropped = [...droppedSet].sort();
      record(
        'conformance-encounter-roles',
        added.length > 0 ? `added:${added.join(',')}` : `dropped:${dropped.join(',')}`,
        added.length > 0
          ? `the engine reads one frame and never sees ${JSON.stringify(added)} fire for the other vessel, so pooling both adds the roles those entries lay and displaces what they override`
          : `pooling displaces ${JSON.stringify(dropped)}, which the engine's one-frame read still holds`,
        citeOf(added.length > 0 ? added : dropped),
        situation,
      );
    }

    const selfGiveWay = holds(reference.roles.self, 'role:give-way');
    const otherGiveWay = holds(reference.roles.other, 'role:give-way');
    if (selfGiveWay !== undefined && otherGiveWay !== undefined) {
      stats.bothGiveWay++;
      record(
        'consistency-both-give-way',
        `${selfGiveWay},${otherGiveWay}`,
        `both vessels are give-way at once: self by ${selfGiveWay}, the other by ${otherGiveWay}, neither overridden`,
        citeOf([selfGiveWay, otherGiveWay]),
        situation,
      );
    }

    const selfStandOn = holds(reference.roles.self, 'role:stand-on');
    const otherStandOn = holds(reference.roles.other, 'role:stand-on');
    if (
      selfStandOn !== undefined &&
      otherStandOn !== undefined &&
      selfGiveWay === undefined &&
      otherGiveWay === undefined
    ) {
      stats.bothStandOn++;
      record(
        'consistency-both-stand-on',
        `${selfStandOn},${otherStandOn}`,
        `both vessels stand on and neither gives way: self by ${selfStandOn}, the other by ${otherStandOn}`,
        citeOf([selfStandOn, otherStandOn]),
        situation,
      );
    }

    const classified = reference.encounter !== undefined && reference.encounter !== 'encounter:none';
    if (
      classified &&
      reference.risk.asserted &&
      reference.roles.self.length === 0 &&
      reference.roles.other.length === 0
    ) {
      stats.unresolved++;
      record(
        'consistency-encounter-unresolved',
        String(reference.encounter),
        `the encounter is classified ${reference.encounter} with risk of collision asserted, but no precedence entry lays a role on either vessel`,
        [],
        situation,
      );
    }
  }

  stats.wallMs = Date.now() - t0;
  stats.neverFired = space.entries.filter((e) => !everApplied.has(e.id)).map((e) => e.id);
  for (const id of stats.neverFired) {
    record(
      'coverage-encounter-entry-never-fires',
      id,
      `entry ${id} never applies across the enumerated situation space`,
      citeOf([id]),
      { self: { fact: {} } },
    );
  }
  return stats;
}
