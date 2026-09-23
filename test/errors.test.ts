// DataVersionMismatchError is the one error class on the root (colregs ADR
// 0023): an Error subclass carrying both versions, so a consumer can say
// which side is stale.

import { expect, it } from 'vitest';
import { DataVersionMismatchError } from '../src/index';

it('DataVersionMismatchError carries the resolved and caller-supplied versions', () => {
  const e = new DataVersionMismatchError('0.2.4', '0.2.2');
  expect(e).toBeInstanceOf(Error);
  expect(e.resolvedVersion).toBe('0.2.4');
  expect(e.dataVersion).toBe('0.2.2');
  expect(e.message).toContain('0.2.4');
  expect(e.message).toContain('0.2.2');
});
