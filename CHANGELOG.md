# Changelog

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
