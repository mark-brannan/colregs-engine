import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  committedFixtureCount,
  implausibleWalk,
  missingModules,
} from '../research/conformance/guards.js';

describe('conformance dependency preflight', () => {
  it('names every module that does not resolve', () => {
    const resolve = (id: string) => {
      if (id.startsWith('colregs/')) throw new Error('MODULE_NOT_FOUND');
    };
    expect(missingModules(resolve)).toEqual([
      'colregs/data/applicability.json',
      'colregs/data/rules.json',
      'colregs/fixtures/applicability-fixtures.json',
    ]);
  });

  it('reports nothing when everything resolves', () => {
    expect(missingModules(() => '/x')).toEqual([]);
  });
});

describe('conformance implausible-walk guard', () => {
  it('refuses a walk of 0 records', () => {
    expect(implausibleWalk(0, 0, 0)).toMatch(/0 records/);
  });

  it('refuses 0 findings against a non-empty register', () => {
    expect(implausibleWalk(1000, 0, 47)).toMatch(/0 findings but 47/);
  });

  it('accepts a real walk, and 0 findings against an empty register', () => {
    expect(implausibleWalk(1000, 3, 47)).toBeUndefined();
    expect(implausibleWalk(1000, 0, 0)).toBeUndefined();
  });

  it('counts only FIND-nn.json fixtures', () => {
    const dir = mkdtempSync(join(tmpdir(), 'findings-'));
    for (const n of ['FIND-01.json', 'FIND-02.json', 'README.md', 'triage.json']) writeFileSync(join(dir, n), '');
    expect(committedFixtureCount(dir)).toBe(2);
    expect(committedFixtureCount(join(dir, 'missing'))).toBe(0);
  });
});
