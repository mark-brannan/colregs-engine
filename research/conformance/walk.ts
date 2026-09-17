// The per-record pass of the conformance harness, over one shard of the
// fact space, and the merge that puts shards back together. A `Tally` is
// plain JSON: a shard process writes one, the reducing run reads them all
// and only then judges coverage and writes the register (run.ts). Every
// field here is a union, a sum, or a min over ordinals, so merging is
// associative and the merged tally of N shards is the tally of one pass.

import applicabilityJson from 'colregs/data/applicability.json' with { type: 'json' };

import { evaluateDisplay, predicateMatches } from '../../src/evaluate.js';
import type { ApplicabilityData, Entry, FactRecord } from '../../src/types.js';

import { type Axis, enumerateIndexed, type Shard, totalRecords, WHOLE_SPACE } from './enumerate.js';
import { referenceAppliedEntries, referenceResolveModality } from './reference.js';

const data = applicabilityJson as unknown as ApplicabilityData;

export const entries: Entry[] = data.entries;
export const byId = new Map<string, Entry>(entries.map((e) => [e.id, e]));

// colregs 0.2.0 (REQ-CAT-1) added two-subject scope/precedence/etc. entries
// that read a situation, not a fact record -- src/evaluate.ts's `applied`
// never contains them (isDisplay filter there and in reference.ts), so any
// coverage bookkeeping keyed off "was this ever in an applied set" has to
// look at the same subset here, or every one of them reports as
// never-fired by construction rather than by any real gap in the fact
// space.
export function isDisplay(e: Entry): boolean {
  return (e.category ?? 'category:display') === 'category:display';
}
export const displayEntries = entries.filter(isDisplay);

// Every jurisdiction the data offers (colregs ADR 0018): each is its own
// merge patch over `intl`, so an entry's applicability set differs by
// jurisdiction on the same fact record. Coverage, consistency and the
// engine/reference conformance check all run once per jurisdiction, or a
// jurisdiction's own entries (rule:23d, rule:24c:towing_lights, the
// mooring-buoy pair) would never be exercised at all.
export const jurisdictions = [...new Set(displayEntries.map((e) => e.jurisdiction))];

/** Ordered pairs of entries where one `rel:excludes` the other. The
 * consistency (i) check only has to look at these, not at every pair of
 * applied `shall` entries -- millions of records times a quadratic scan is
 * the difference between a minutes-long run and an hour-long one. */
const excludingPairs: [string, string][] = [];
for (let i = 0; i < entries.length; i++) {
  for (let j = i + 1; j < entries.length; j++) {
    const a = entries[i];
    const b = entries[j];
    if ((a['rel:excludes'] ?? []).includes(b.id) || (b['rel:excludes'] ?? []).includes(a.id)) {
      excludingPairs.push([a.id, b.id]);
    }
  }
}

// Positions where zero applied entries is the ruled-correct answer, not a
// data gap, so consistency-no-obligation stays quiet for them: Rule 3(i)'s
// made-fast-to-the-shore case ("moored") is prescribed no lights at all.
// Still tallied in noObligationPositions, so the summary line reports
// them; only the finding is skipped.
const EXPECTED_EMPTY_POSITIONS = new Set<string>(['position:moored']);

export interface FindingGroup {
  check: string;
  groupKey: string;
  count: number;
  description: string;
  cites: string[];
  /** The earliest record (by `witnessOrdinal`) that produced this finding.
   * Coverage findings, raised after the walk, carry `{}` and -1. */
  sampleFacts: FactRecord;
  witnessOrdinal: number;
}

export interface Tally {
  /** Records walked. */
  n: number;
  wallMs: number;
  conformanceFailures: number;
  modalityMismatches: number;
  noObligationCount: number;
  noObligationPositions: Record<string, number>;
  conflictingObligationCount: number;
  orphanShallCount: number;
  unresolvedConditionalCount: number;
  /** Keyed `${check}::${groupKey}`. */
  findings: Record<string, FindingGroup>;
  everApplied: string[];
  /** entry id -> modality_by branch indices ever the first match. */
  modalityByBranchTaken: Record<string, number[]>;
  oneOfEverChosen: string[];
}

export function emptyTally(): Tally {
  return {
    n: 0,
    wallMs: 0,
    conformanceFailures: 0,
    modalityMismatches: 0,
    noObligationCount: 0,
    noObligationPositions: {},
    conflictingObligationCount: 0,
    orphanShallCount: 0,
    unresolvedConditionalCount: 0,
    findings: {},
    everApplied: [],
    modalityByBranchTaken: {},
    oneOfEverChosen: [],
  };
}

export function findingKey(f: Pick<FindingGroup, 'check' | 'groupKey'>): string {
  return `${f.check}::${f.groupKey}`;
}

/** Adds a finding occurrence to `t`, keeping the lowest-ordinal witness. */
export function recordFinding(
  t: Tally,
  check: string,
  groupKey: string,
  description: string,
  cites: string[],
  facts: FactRecord,
  witnessOrdinal: number,
): void {
  const key = findingKey({ check, groupKey });
  const existing = t.findings[key];
  if (existing) {
    existing.count++;
    if (witnessOrdinal < existing.witnessOrdinal) {
      existing.witnessOrdinal = witnessOrdinal;
      existing.sampleFacts = facts;
    }
    return;
  }
  t.findings[key] = { check, groupKey, count: 1, description, cites, sampleFacts: facts, witnessOrdinal };
}

export interface WalkOptions {
  shard?: Shard;
  /** Walk only the first `sample` records of each jurisdiction. */
  sample?: number;
}

/** One streaming pass over `shard`, every jurisdiction, into a fresh Tally. */
export function walkShard(axes: Axis[], opts: WalkOptions = {}): Tally {
  const shard = opts.shard ?? WHOLE_SPACE;
  const t = emptyTally();
  const everApplied = new Set<string>();
  const branchTaken = new Map<string, Set<number>>();
  const oneOfChosen = new Set<string>();
  const noObligationPositions = new Map<string, number>();
  for (const e of displayEntries) {
    if (e.modality === 'modality:conditional' && e.modality_by) branchTaken.set(e.id, new Set());
  }

  // Coverage bookkeeping only (not the conformance verdict, which compares
  // against reference.ts), so reusing the engine's own matcher is fine.
  function trackModalityByBranch(e: Entry, facts: FactRecord) {
    if (e.modality !== 'modality:conditional' || !e.modality_by) return;
    const taken = branchTaken.get(e.id)!;
    if (taken.size === e.modality_by.length) return; // already saturated
    for (let i = 0; i < e.modality_by.length; i++) {
      if (predicateMatches(e.modality_by[i].when, facts)) {
        taken.add(i);
        return;
      }
    }
  }

  // Ordinals are per jurisdiction in the enumerator and bounded by
  // totalRecords(); offsetting by that makes the whole walk one total order.
  const ordinalsPerJurisdiction = totalRecords(axes);
  const t0 = Date.now();
  for (let j = 0; j < jurisdictions.length; j++) {
    const jurisdiction = jurisdictions[j];
    const jurisdictionOffset = j * ordinalsPerJurisdiction;
    let jn = 0;
    for (const { facts, ordinal: local } of enumerateIndexed(axes, shard)) {
      if (opts.sample !== undefined && jn >= opts.sample) break;
      jn++;
      t.n++;
      const ordinal = jurisdictionOffset + local;

      const evalResult = evaluateDisplay(facts, { data, jurisdiction });
      const engineApplied = evalResult.applied;
      const refApplied = referenceAppliedEntries(data, facts, jurisdiction);

      const engineSet = new Set(engineApplied);
      const refSet = new Set(refApplied);
      const sameSet = engineSet.size === refSet.size && [...engineSet].every((id) => refSet.has(id));

      if (!sameSet) {
        t.conformanceFailures++;
        const missing = refApplied.filter((id) => !engineSet.has(id));
        const extra = engineApplied.filter((id) => !refSet.has(id));
        recordFinding(
          t,
          'conformance-applied',
          `missing:${missing.sort().join(',')}|extra:${extra.sort().join(',')}`,
          `engine and reference disagree on applied entries: engine is missing ${JSON.stringify(missing)}, has extra ${JSON.stringify(extra)}`,
          [...missing, ...extra].map((id) => byId.get(id)?.cite ?? id),
          facts,
          ordinal,
        );
      }
      // Order mismatches are structurally unreachable: both engineApplied and
      // refApplied are built by filtering data.entries in the same fixed
      // order, so whenever their sets match, their orders match too.

      if (sameSet) {
        for (const id of engineApplied) {
          const engineM = evalResult.modalities[id];
          const refM = referenceResolveModality(byId.get(id)!, facts);
          if (engineM !== refM) {
            t.modalityMismatches++;
            recordFinding(
              t,
              'conformance-modality',
              `${id}:${engineM}!=${refM}`,
              `entry ${id} resolves to modality '${engineM}' in the engine but '${refM}' in the reference`,
              [byId.get(id)?.cite ?? id],
              facts,
              ordinal,
            );
          }
        }
      }

      // Coverage
      for (const id of engineApplied) {
        everApplied.add(id);
        trackModalityByBranch(byId.get(id)!, facts);
      }
      for (const d of evalResult.displays) {
        for (const id of d.chosen) oneOfChosen.add(id);
      }

      // Consistency
      if (engineApplied.length === 0) {
        t.noObligationCount++;
        const pos = String(facts['fact:position'] ?? '(absent)');
        noObligationPositions.set(pos, (noObligationPositions.get(pos) ?? 0) + 1);
        if (!EXPECTED_EMPTY_POSITIONS.has(pos)) {
          recordFinding(
            t,
            'consistency-no-obligation',
            pos,
            `record has zero applied lights entries and so no lawful display, for a vessel with fact:position = ${pos}`,
            [],
            facts,
            ordinal,
          );
        }
      }

      for (const [aId, bId] of excludingPairs) {
        if (evalResult.modalities[aId] !== 'modality:shall' || evalResult.modalities[bId] !== 'modality:shall') continue;
        if (!engineApplied.includes(aId) || !engineApplied.includes(bId)) continue;
        t.conflictingObligationCount++;
        recordFinding(
          t,
          'consistency-conflicting-shall',
          `${aId},${bId}`,
          `entries ${aId} and ${bId} are both resolved 'shall' and rel:excludes the other: a conflicting obligation`,
          [byId.get(aId)!.cite, byId.get(bId)!.cite],
          facts,
          ordinal,
        );
      }

      const contributingIds = new Set<string>();
      for (const d of evalResult.displays) {
        for (const id of d.entries) contributingIds.add(id);
      }
      // rel:overrides and rel:exempts already give an applied `shall` entry
      // a named, relation-based reason for contributing nothing (reported
      // in `overridden` / `exempted`) -- correctly-modeled displacement,
      // not the orphan shape this check exists to catch.
      const displacedIds = new Set<string>([
        ...evalResult.overridden.map((x) => x.id),
        ...evalResult.exempted.map((x) => x.id),
      ]);
      for (const id of engineApplied) {
        const m = evalResult.modalities[id];
        if (m !== 'modality:shall' && m !== 'modality:shall-if-practicable') continue;
        if (contributingIds.has(id)) continue;
        if (displacedIds.has(id)) continue;
        t.orphanShallCount++;
        recordFinding(
          t,
          'consistency-orphan-shall',
          id,
          `entry ${id} is applied and resolved '${m}' but contributes to no display: no own lights, no surviving import, no one_of group it belongs to`,
          [byId.get(id)?.cite ?? id],
          facts,
          ordinal,
        );
      }

      for (const id of engineApplied) {
        if (evalResult.modalities[id] === 'modality:conditional') {
          t.unresolvedConditionalCount++;
          recordFinding(
            t,
            'consistency-unresolved-conditional',
            id,
            `entry ${id} is applied and modality: conditional, but no modality_by branch matched this fact record`,
            [byId.get(id)?.cite ?? id],
            facts,
            ordinal,
          );
        }
      }
    }
  }
  t.wallMs = Date.now() - t0;
  t.everApplied = [...everApplied].sort();
  t.oneOfEverChosen = [...oneOfChosen].sort();
  t.noObligationPositions = Object.fromEntries(noObligationPositions);
  t.modalityByBranchTaken = Object.fromEntries(
    [...branchTaken].map(([id, s]) => [id, [...s].sort((a, b) => a - b)]),
  );
  return t;
}

/** The tally one pass over the union of the shards would have produced. */
export function mergeTallies(tallies: Tally[]): Tally {
  const out = emptyTally();
  const everApplied = new Set<string>();
  const oneOfChosen = new Set<string>();
  const branchTaken = new Map<string, Set<number>>();
  for (const t of tallies) {
    out.n += t.n;
    out.wallMs = Math.max(out.wallMs, t.wallMs);
    out.conformanceFailures += t.conformanceFailures;
    out.modalityMismatches += t.modalityMismatches;
    out.noObligationCount += t.noObligationCount;
    out.conflictingObligationCount += t.conflictingObligationCount;
    out.orphanShallCount += t.orphanShallCount;
    out.unresolvedConditionalCount += t.unresolvedConditionalCount;
    for (const [pos, c] of Object.entries(t.noObligationPositions)) {
      out.noObligationPositions[pos] = (out.noObligationPositions[pos] ?? 0) + c;
    }
    for (const f of Object.values(t.findings)) {
      const key = findingKey(f);
      const existing = out.findings[key];
      if (!existing) {
        out.findings[key] = { ...f, cites: [...f.cites] };
        continue;
      }
      existing.count += f.count;
      if (f.witnessOrdinal < existing.witnessOrdinal) {
        existing.witnessOrdinal = f.witnessOrdinal;
        existing.sampleFacts = f.sampleFacts;
      }
    }
    for (const id of t.everApplied) everApplied.add(id);
    for (const id of t.oneOfEverChosen) oneOfChosen.add(id);
    for (const [id, branches] of Object.entries(t.modalityByBranchTaken)) {
      const s = branchTaken.get(id) ?? new Set<number>();
      for (const b of branches) s.add(b);
      branchTaken.set(id, s);
    }
  }
  out.everApplied = [...everApplied].sort();
  out.oneOfEverChosen = [...oneOfChosen].sort();
  out.modalityByBranchTaken = Object.fromEntries(
    [...branchTaken].map(([id, s]) => [id, [...s].sort((a, b) => a - b)]),
  );
  return out;
}
