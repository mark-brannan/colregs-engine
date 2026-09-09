// Two paths through a modifier axis's `refines` declaration that the pinned
// colregs data never exercises, because both of its real modifiers
// (fact:making_way, fact:on_mooring_buoy) refine an enum axis:
//
//   1. research/conformance/enumerate.ts's extractAxes() throws when a
//      `refines` target is declared but isn't an enum axis (see its comment
//      on why: expandModifiers compares by string equality against the
//      refined axis's raw value, so a non-enum target would silently drop
//      the modifier everywhere instead of refining it).
//   2. research/z3/encode.ts's buildEncoding() emits an `(assert (=> ...))`
//      implication for a modifier axis, constraining it to Z3's declared
//      totality. That line has never been pinned by a direct string check
//      — only exercised indirectly via the full pinned-data encoding.
//
// (1) needs a `refines` target FACT_SPEC never declares, so it mocks
// src/generated/fact-record.ts with a synthetic spec. (2) doesn't need a
// synthetic spec (the real making_way/position pair already has a valid
// enum target) but has no test of its own either, so it's pinned here
// alongside its non-enum counterpart.

import { describe, expect, it, vi } from "vitest";
import type { ApplicabilityData } from "../src/types.js";

describe("extractAxes: a modifier axis refining a non-enum target", () => {
  it("throws, naming the offending axis and its declared (non-enum) target kind", async () => {
    vi.resetModules();
    vi.doMock("../src/generated/fact-record.js", () => ({
      FACT_SPEC: {
        // The refinement target: declared, but not an enum.
        "fact:speed_kn": { kind: "number" },
        // The modifier: refines a value no numeric axis can ever equal by
        // string comparison.
        "fact:racing": {
          kind: "boolean",
          refines: { key: "fact:speed_kn", value: "fast" },
        },
      },
    }));

    const { extractAxes } = await import(
      "../research/conformance/enumerate.js"
    );
    const data = {
      entries: [
        {
          id: "synthetic-racing",
          cite: "test fixture",
          category: "display",
          modality: "shall",
          when: { "fact:racing": true },
        },
      ],
    } as unknown as ApplicabilityData;

    expect(() => extractAxes(data)).toThrow(
      /fact:racing refines fact:speed_kn, but that axis is not an enum axis \(declared kind: number\)/,
    );

    vi.doUnmock("../src/generated/fact-record.js");
    vi.resetModules();
  });
});

describe("buildEncoding: the modifier-refinement Z3 implication assert", () => {
  it("emits (assert (=> modifier (= target value))) for a modifier axis", async () => {
    const { buildEncoding } = await import("../research/z3/encode.js");
    const data = {
      entries: [
        {
          id: "synthetic-underway",
          cite: "test fixture",
          category: "display",
          modality: "shall",
          when: {
            "fact:making_way": true,
            "fact:position": "position:underway",
          },
        },
      ],
    } as unknown as ApplicabilityData;

    const { base } = buildEncoding(data);

    expect(base).toContain(
      "(assert (=> |fact:making_way| (= |fact:position| |position:underway|)))   ; fact:making_way refines fact:position=position:underway",
    );
  });
});
