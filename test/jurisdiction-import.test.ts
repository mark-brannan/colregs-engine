// Regression: `byId` in evaluateDisplay() was built from unfiltered
// data.entries, while `applied` was jurisdiction-filtered via
// jurisdictionEntries(). An intl entry a jurisdiction suppresses (ADR 0018)
// was still reachable through rel:includes/rel:conditional_includes/one_of
// on some other applied entry, because importRef() resolved refs through
// the unfiltered byId map -- the suppression tombstone was bypassed by the
// relation graph. byId is now built from jurisdictionEntries() too, so an
// import of a suppressed (or foreign-jurisdiction) entry fails closed via
// importRef's existing `if (!ref) throw`.

import { describe, expect, it } from 'vitest';
import { evaluateDisplay } from '../src/evaluate';
import type { ApplicabilityData, Entry } from '../src/types';

const suppressed: Entry = {
  id: 'suppressedIntl',
  jurisdiction: 'intl',
  cite: 'test suppressed',
  when: {},
  lights: [{ light: 'test-light-suppressed' }],
  modality: 'modality:shall',
};

const carrier: Entry = {
  id: 'carrier',
  jurisdiction: 'intl',
  cite: 'test carrier',
  when: {},
  lights: [],
  modality: 'modality:shall',
  'rel:includes': ['suppressedIntl'],
};

const data: ApplicabilityData = {
  known_omissions: [],
  entries: [carrier, suppressed],
  suppressions: [
    {
      jurisdiction: 'us/inland',
      suppresses: 'suppressedIntl',
      cite: 'test',
      why: 'test',
    },
  ],
};

describe('jurisdiction filtering: rel:includes cannot resurrect a suppressed entry', () => {
  it('importing a suppressed entry via rel:includes fails closed', () => {
    expect(() => evaluateDisplay({}, { data, jurisdiction: 'us/inland' })).toThrow(
      /unknown entry ref suppressedIntl/,
    );
  });

  it('the same entry is reachable when no jurisdiction suppresses it', () => {
    const result = evaluateDisplay({}, { data, jurisdiction: 'intl' });
    const entryIds = result.displays.flatMap((d) => d.entries);
    expect(entryIds).toContain('suppressedIntl');
  });
});
