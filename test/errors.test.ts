// NotImplementedError stays exported, an Error subclass, for the next verb
// named before it is built; no current verb throws it.

import { expect, it } from 'vitest';
import { NotImplementedError } from '../src/index';

it('is an Error carrying the verb and the section that fixed its shape', () => {
  const e = new NotImplementedError('x', 'ADR 0011 §1');
  expect(e).toBeInstanceOf(Error);
  expect(e.verb).toBe('x');
  expect(e.shapeFixedBy).toBe('ADR 0011 §1');
});
