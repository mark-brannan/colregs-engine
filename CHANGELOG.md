# Changelog

## [0.1.8](https://github.com/mark-brannan/colregs-engine/compare/v0.1.7...v0.1.8) (2026-09-17)


### Added

* adopt colregs 0.3.4 — jurisdiction resolution (ADR 0018/0020) and the excluded drop (ADR 0019) ([#123](https://github.com/mark-brannan/colregs-engine/issues/123)) ([840ca8a](https://github.com/mark-brannan/colregs-engine/commit/840ca8ad1b2c4ba32ee6cc2d70fae1602142263c))
* apply the Rule 20(c) modality shift in evaluateDisplay (ADR 0021) ([#130](https://github.com/mark-brannan/colregs-engine/issues/130)) ([103e726](https://github.com/mark-brannan/colregs-engine/commit/103e7260956292baa42958430474b9c8a6816e3e))
* **conformance:** shard the exhaustive walk across processes and CI runners ([#129](https://github.com/mark-brannan/colregs-engine/issues/129)) ([c936c7b](https://github.com/mark-brannan/colregs-engine/commit/c936c7bb079654cc08a6ee086e8e0de6d99f9000))
* evaluateEncounter reads roles from both frames, pooled (ADR 0016) ([#110](https://github.com/mark-brannan/colregs-engine/issues/110)) ([99b2d55](https://github.com/mark-brannan/colregs-engine/commit/99b2d5590eef8752a6da75daee5d3401360e0036))
* **research:** situation enumerator and the ADR 0016 reference read ([#117](https://github.com/mark-brannan/colregs-engine/issues/117)) ([bb1f236](https://github.com/mark-brannan/colregs-engine/commit/bb1f23651cbf69e5a04a4f7968135126ecbf5562))
* scaffold the Rule 20(c) modality shift mechanism (ADR 0021) ([#128](https://github.com/mark-brannan/colregs-engine/issues/128)) ([f331fb0](https://github.com/mark-brannan/colregs-engine/commit/f331fb019ded17b657b482d2808f8c8bedfad0e3))

## [0.1.7](https://github.com/mark-brannan/colregs-engine/compare/v0.1.6...v0.1.7) (2026-09-17)


### Added

* consume colregs' operations manifest (ADR 0014) ([#95](https://github.com/mark-brannan/colregs-engine/issues/95)) ([18207a5](https://github.com/mark-brannan/colregs-engine/commit/18207a5ecae393e2c1317f5a9138e3c2840c54d5)), closes [#86](https://github.com/mark-brannan/colregs-engine/issues/86)
* relation reach and import reads follow colregs ADR 0019 ([#98](https://github.com/mark-brannan/colregs-engine/issues/98)) ([#100](https://github.com/mark-brannan/colregs-engine/issues/100)) ([b6e7d07](https://github.com/mark-brannan/colregs-engine/commit/b6e7d07d46c1337522e89793565074c5f09d3c25))
* stub traffic facts on Situation and the n-vessel Scene ([#82](https://github.com/mark-brannan/colregs-engine/issues/82)) ([#90](https://github.com/mark-brannan/colregs-engine/issues/90)) ([9563b67](https://github.com/mark-brannan/colregs-engine/commit/9563b6749e3dc90535b5b5d54b50c38e18f88ad6))

## [0.1.6](https://github.com/mark-brannan/colregs-engine/compare/v0.1.5...v0.1.6) (2026-09-16)


### Added

* **research:** partition-soundness lemma in Rocq, compiled in CI ([#88](https://github.com/mark-brannan/colregs-engine/issues/88)) ([d85869a](https://github.com/mark-brannan/colregs-engine/commit/d85869a97908b619b4f00abcefda0e1881b24a78))


### Fixed

* **conduct:** read the 13(d) latch ahead of the role in phaseAt ([#85](https://github.com/mark-brannan/colregs-engine/issues/85)) ([00ba762](https://github.com/mark-brannan/colregs-engine/commit/00ba76235749efb10c5d3cf4d111312ff724d14f))

## [0.1.5](https://github.com/mark-brannan/colregs-engine/compare/v0.1.4...v0.1.5) (2026-09-15)


### Added

* add category, status alphabet and provenance to the display envelope ([#57](https://github.com/mark-brannan/colregs-engine/issues/57)) ([215fcb6](https://github.com/mark-brannan/colregs-engine/commit/215fcb6f39a5890e4665218388981b678e9f9cb4))
* build evaluateEncounter, partial evaluateConduct and evaluateRule2Departure ([#71](https://github.com/mark-brannan/colregs-engine/issues/71)) ([90f38d6](https://github.com/mark-brannan/colregs-engine/commit/90f38d65d5f00240fdbba192c5612e4ff5ae1b0a))

## [0.1.4](https://github.com/mark-brannan/colregs-engine/compare/v0.1.3...v0.1.4) (2026-09-12)


### Added

* stub first — export the three unbuilt verbs, and amend ADR 0002 to say so ([#60](https://github.com/mark-brannan/colregs-engine/issues/60)) ([7628a0c](https://github.com/mark-brannan/colregs-engine/commit/7628a0c1e3b450e67a23d7f6911f31d87ad3ea6a))

## [0.1.3](https://github.com/mark-brannan/colregs-engine/compare/v0.1.2...v0.1.3) (2026-09-09)


### ⚠ BREAKING CHANGES

* evaluate, appliedEntries, and the Evaluation type alias are removed from the public API. Use evaluateDisplay, appliedDisplayEntries, and DisplayEvaluation instead.

### Added

* remove deprecated evaluate/appliedEntries/Evaluation aliases ([#51](https://github.com/mark-brannan/colregs-engine/issues/51)) ([35a149a](https://github.com/mark-brannan/colregs-engine/commit/35a149a6e670c9b162cee09ecda296e36e1cd2b1))

## [0.1.2](https://github.com/mark-brannan/colregs-engine/compare/v0.1.1...v0.1.2) (2026-09-08)


### Fixed

* **ci:** publish workflow skips prose-budget like CI does ([#44](https://github.com/mark-brannan/colregs-engine/issues/44)) ([523c923](https://github.com/mark-brannan/colregs-engine/commit/523c923b52adaa771903b00a90fb4ff15217a1e0))
* enforce enum-only refinement targets, constrain modifiers in Z3 theory ([#42](https://github.com/mark-brannan/colregs-engine/issues/42)) ([757f007](https://github.com/mark-brannan/colregs-engine/commit/757f0077dd87b4b99ae1f4039afe6bfc047875d7))

## [0.1.1](https://github.com/mark-brannan/colregs-engine/compare/v0.1.0...v0.1.1) (2026-09-08)


### Added

* rel:overrides displaces lights in evaluateDisplay ([#36](https://github.com/mark-brannan/colregs-engine/issues/36)) ([40e77bb](https://github.com/mark-brannan/colregs-engine/commit/40e77bb2d4cc17e33c281103777bb6e72456ce10))


### Fixed

* **conformance:** enumerate modifiers only where they refine; expected-empty carve-out for position:moored ([#38](https://github.com/mark-brannan/colregs-engine/issues/38)) ([919c8ee](https://github.com/mark-brannan/colregs-engine/commit/919c8ee4728331ba6bea0dd6d86e0d72850cb395))
