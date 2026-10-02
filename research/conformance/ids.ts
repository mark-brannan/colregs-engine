// Stable FIND-nn allocation for the conformance register. The identity of a
// finding is `check::groupKey` (walk.ts findingKey); this file turns that into
// the FIND-nn a reader cites. The map lives in findings/ids.json, is written
// only by run.ts, and is never hand-edited. A key keeps its id for good: a
// finding that stops appearing keeps its entry, so its number is not reused.

import type { FindingGroup } from './walk.js';
import { findingKey } from './walk.js';

export interface IdMap {
  /** The next unallocated number. */
  next: number;
  /** `check::groupKey` -> `FIND-nn`. */
  ids: Record<string, string>;
}

export type Finding = FindingGroup & { id: string };

export function formatId(n: number): string {
  return `FIND-${String(n).padStart(2, '0')}`;
}

function idNumber(id: string): number {
  return Number(id.slice('FIND-'.length));
}

function bySortedKey(a: FindingGroup, b: FindingGroup): number {
  return a.check !== b.check ? a.check.localeCompare(b.check) : a.groupKey.localeCompare(b.groupKey);
}

/**
 * Assigns ids to this run's findings against `prev` (null when no map exists
 * yet: numbering then follows sorted order from 1). New keys take `next` in
 * sorted order. Returns the findings sorted by id and the updated map.
 */
export function allocateIds(groups: FindingGroup[], prev: IdMap | null): { findings: Finding[]; map: IdMap } {
  const ids = { ...(prev?.ids ?? {}) };
  let next = prev?.next ?? 1;
  for (const g of [...groups].sort(bySortedKey)) {
    const key = findingKey(g);
    if (ids[key] === undefined) ids[key] = formatId(next++);
  }
  const findings = groups
    .map((g) => ({ ...g, id: ids[findingKey(g)]! }))
    .sort((a, b) => idNumber(a.id) - idNumber(b.id));
  return { findings, map: { next, ids } };
}

/** The map as committed: keys in id order, so a diff reads as allocations. */
export function serializeIdMap(map: IdMap): string {
  const ids = Object.fromEntries(Object.entries(map.ids).sort(([, a], [, b]) => idNumber(a) - idNumber(b)));
  return JSON.stringify({ next: map.next, ids }, null, 2) + '\n';
}
