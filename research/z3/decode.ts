// Reading a Z3 model back out as fact values, and relating a value to the
// enumeration's representative grid. Separate from run.ts so a test can
// import it without running the harness.

import type { Axis } from '../conformance/enumerate.js';
import type { FactRecord, FactValue } from '../../src/types.js';

/** An SMT-LIB numeral as printed by Z3: `4.0`, `1/2`, `(- 3.0)`, `(/ 1.0 2.0)`. */
export function parseNumeral(text: string): number {
  const s = text.trim();
  let m = /^\(-\s+(.*)\)$/.exec(s);
  if (m) return -parseNumeral(m[1]);
  m = /^\(\/\s+(\S+)\s+(\S+)\)$/.exec(s);
  if (m) return parseNumeral(m[1]) / parseNumeral(m[2]);
  m = /^(-?[\d.]+)\/(-?[\d.]+)$/.exec(s);
  if (m) return Number(m[1]) / Number(m[2]);
  const n = Number(s);
  if (!Number.isFinite(n)) {
    // Z3 prints an algebraic number as `(root-obj ...)`. Linear arithmetic
    // cannot produce one, so this would mean the theory is not what we think.
    throw new Error(`cannot decode ${text} as a fact value; is the theory still linear?`);
  }
  return n;
}

/**
 * Snaps a numeric value to the representative the enumeration would have
 * visited for the same threshold interval -- the partition enumerate.ts
 * builds: below the first constant, each constant, one midpoint per open
 * interval, above the last.
 */
export function snapToGrid(axis: Axis, value: number): number {
  if (axis.kind !== 'numeric') return value;
  const cs = axis.constants;
  if (cs.length === 0) return value;
  for (const c of cs) if (value === c) return c;
  if (value < cs[0]) return cs[0] - 1;
  if (value > cs[cs.length - 1]) return cs[cs.length - 1] + 1;
  for (let i = 0; i + 1 < cs.length; i++) {
    if (value > cs[i] && value < cs[i + 1]) return (cs[i] + cs[i + 1]) / 2;
  }
  /* c8 ignore next */
  throw new Error(`${value} fell outside every interval of ${axis.key}`);
}

export function snapRecord(axes: Axis[], facts: FactRecord): FactRecord {
  const out: Record<string, FactValue> = { ...(facts as Record<string, FactValue>) };
  for (const axis of axes) {
    if (axis.kind !== 'numeric') continue;
    out[axis.key] = snapToGrid(axis, out[axis.key] as number);
  }
  return out as FactRecord;
}

/** Which numeric axes of a record hold a value the enumeration never visits. */
export function offGridAxes(axes: Axis[], facts: FactRecord): string[] {
  const out: string[] = [];
  for (const axis of axes) {
    if (axis.kind !== 'numeric') continue;
    const v = (facts as Record<string, FactValue>)[axis.key] as number;
    if (!axis.values.includes(v)) out.push(`${axis.key}=${v}`);
  }
  return out;
}
