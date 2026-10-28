# Agent decisions

Append-only. Each entry is a call an agent made in pencil: a default it took
under the one-way-door test, with its undo. Written by `agent-decision`; the
heading is the UTC stamp, so `agent_decisions.md#<stamp>` links one entry.

### 20261016t030502z
- colregs-engine#158: left enumerate-shards 5s timeout flake unpadded; merged main only (no PR, branch main)

### 20261016t031813z
- A10 colregs-engine#113: left seaplane failures unpatched; undo: close PR (no PR, branch claude/A10-1016)

### 20261017t081525z
- pin-bump-alone's allowlist reads 'the fixture dirs' as research/conformance/findings/**, the register a pin rewrites; the repo has no fixtures directory Undo: edit the allow list in ci.yml ([#168](https://github.com/mark-brannan/colregs-engine/pull/168))

### 20261028t075659z
- evaluateScene renamed evaluateVessels, Scene renamed Vessels, SceneEvaluation renamed VesselsEvaluation, file src/vessels.ts (Scene is forbidden) Undo: rename back in a follow-up PR ([#178](https://github.com/mark-brannan/colregs-engine/pull/178))

### 20261028t075702z
- reduceTraffic renamed reduceOthers, files src/others.ts and test/others.test.ts, following the others: class and OthersFacts Undo: rename back in a follow-up PR ([#178](https://github.com/mark-brannan/colregs-engine/pull/178))
