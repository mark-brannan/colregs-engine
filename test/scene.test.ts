// Replays fixtures/scene-fixtures.json: every scene assignable to `Scene`
// unedited, every pair evaluated as its own encounter, and the conflicts
// exactly the ones the case names. Then the two gates a conflict passes --
// a duty that asks for the helm, and a vessel foreclosing it.

import { describe, expect, it } from 'vitest';
import sceneFixturesJson from '../fixtures/scene-fixtures.json';
import applicabilityJson from 'colregs/data/applicability.json';
import { evaluateScene, reduceTraffic } from '../src/index.js';
import type { ApplicabilityData, Rule2DepartureModel, Scene, SceneConflict } from '../src/types.js';

interface SceneFixtureCase {
  name: string;
  model: Rule2DepartureModel;
  scene: Scene;
  expect: { conflicts: SceneConflict[] };
}

const applicability = applicabilityJson as unknown as ApplicabilityData;
const fixtures = sceneFixturesJson as unknown as { cases: SceneFixtureCase[] };
const [crowded, clear] = fixtures.cases;

describe('colregs-engine scene fixtures (verbatim replay)', () => {
  for (const c of fixtures.cases) {
    it(`${c.name}: one evaluation per pair, each a crossing`, () => {
      const result = evaluateScene(c.scene, { model: c.model });
      expect(result.pairs.length).toBe(c.scene.others.length);
      for (const pair of result.pairs) {
        expect(pair.encounter).toBe('encounter:crossing');
        expect(pair.roles.self).toEqual([
          { role: 'role:give-way', by: 'rule:15a:keep_out_of_the_way' },
        ]);
      }
    });

    it(`${c.name}: conflicts are the ones the case names`, () => {
      expect(evaluateScene(c.scene, { model: c.model }).conflicts).toEqual(c.expect.conflicts);
    });

    it(`${c.name}: traffic counts every other vessel`, () => {
      const traffic = evaluateScene(c.scene, { model: c.model }).traffic;
      const counted = Object.values(traffic).reduce((n, s) => n + (s.count ?? 0), 0);
      expect(counted).toBe(c.scene.others.length);
      expect(traffic).toEqual(reduceTraffic(c.scene.own, c.scene.others, { model: c.model }));
    });
  }

  it('forecloses the crowded scene and not the clear one', () => {
    expect(crowded.expect.conflicts.length).toBe(2);
    expect(clear.expect.conflicts).toEqual([]);
    expect(reduceTraffic(crowded.scene.own, crowded.scene.others, { model: crowded.model })
      .starboard?.foreclosed).toBe(true);
    expect(reduceTraffic(clear.scene.own, clear.scene.others, { model: clear.model })
      .starboard?.foreclosed).toBe(false);
  });
});

describe('evaluateScene', () => {
  it('reports no conflict without a model to foreclose against', () => {
    expect(evaluateScene(crowded.scene).conflicts).toEqual([]);
  });

  it('reports no conflict where own holds no duty to manoeuvre', () => {
    const noDuty: Scene = {
      ...crowded.scene,
      own: { ...crowded.scene.own, geo: { 'geo:rel_bearing_deg': 320 } },
    };
    const result = evaluateScene(noDuty, { model: crowded.model });
    for (const pair of result.pairs) expect(pair.roles.self).toEqual([]);
    expect(result.traffic.starboard?.foreclosed).toBe(true);
    expect(result.conflicts).toEqual([]);
  });

  it('evaluates a scene of one vessel as the encounter it is', () => {
    const single: Scene = {
      ...crowded.scene,
      others: [crowded.scene.others[0]],
      pairs: [crowded.scene.pairs?.[0] ?? {}],
    };
    const result = evaluateScene(single, { model: crowded.model });
    expect(result.conflicts).toEqual([]);
    expect(result.traffic.starboard?.count).toBe(1);
    expect(result.pairs[0].roles.self[0].role).toBe('role:give-way');
  });

  it('evaluates a scene of no vessels at all', () => {
    const empty = evaluateScene({ own: crowded.scene.own, others: [] }, { model: crowded.model });
    expect(empty.pairs).toEqual([]);
    expect(empty.conflicts).toEqual([]);
    expect(empty.traffic.starboard).toEqual({ count: 0, foreclosed: false });
  });

  it('evaluates against caller-supplied data', () => {
    // The same data less every precedence entry: no duty survives, so the
    // foreclosed sector has nothing left to be in conflict with.
    const roleless: ApplicabilityData = {
      ...applicability,
      entries: applicability.entries.filter((e) => e.category !== 'category:precedence'),
    };
    const result = evaluateScene(crowded.scene, { model: crowded.model, data: roleless });
    expect(result.pairs[0].colregs.source).toBe('caller');
    expect(result.pairs[0].roles.self).toEqual([]);
    expect(result.traffic.starboard?.foreclosed).toBe(true);
    expect(result.conflicts).toEqual([]);
  });

  it('cuts its sectors with the caller data it was handed', () => {
    const arcless = { ...applicability, entries: [] } as ApplicabilityData;
    expect(() => evaluateScene(crowded.scene, { data: arcless })).toThrow(
      /symmetric about the fore-and-aft line/,
    );
  });

  it('names what a malformed scene is missing', () => {
    expect(() => evaluateScene({ own: crowded.scene.own } as unknown as Scene)).toThrow(
      /scene.others must be an array/,
    );
  });
});
