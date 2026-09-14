// NotImplementedError stays exported, an Error subclass, for a verb whose
// underlying colregs data table is absent, not merely thin; no current verb
// throws it.

import { expect, it } from 'vitest';
import { NotImplementedError } from '../src/index';

it('is an Error carrying the verb and what data is missing', () => {
  const e = new NotImplementedError('x', 'derived["fact:rule18_class"]');
  expect(e).toBeInstanceOf(Error);
  expect(e.verb).toBe('x');
  expect(e.missing).toBe('derived["fact:rule18_class"]');
});
