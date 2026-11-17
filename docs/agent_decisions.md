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

### 20261028t075705z
- SceneConflict renamed DutyConflict Undo: rename back in a follow-up PR ([#178](https://github.com/mark-brannan/colregs-engine/pull/178))

### 20261028t075709z
- local for the classified situation in evaluateCircumstances and the reference reading named classified, since the parameter is already situation Undo: rename the local ([#178](https://github.com/mark-brannan/colregs-engine/pull/178))

### 20261028t075712z
- lockfile colregs entry carries no integrity hash, as npm writes none for a GitHub-hosted dependency resolved afresh Undo: restore the integrity line ([#178](https://github.com/mark-brannan/colregs-engine/pull/178))

### 20261028t083330z
- decisions line carries no provenance stamp; the file header names whose lines they are Undo: append a provenance stamp to the line ([#180](https://github.com/mark-brannan/colregs-engine/pull/180))

### 20261031t003515z
- E2: no PR; the card's step 2-6 targets are gone from main and the one commit is superseded by main's voice.allow trim Undo: redo steps on a fresh branch (no PR, branch main)

### 20261106t011521z
- Added a parse-and-keys test for .languette/ask-first.json rather than leaning on languette's deny message, since a bad list denies every Bash call Undo: delete test/ask-first-list.test.ts ([#183](https://github.com/mark-brannan/colregs-engine/pull/183))

### 20261106t031724z
- partition-proof job cap 10 to 5 min, prove step 2 min; --user root; Docker Hub over ghcr copy Undo: revert the ci.yml commit ([#184](https://github.com/mark-brannan/colregs-engine/pull/184))

### 20261117t111023z
- unified evaluate accepts self's detection set inline on the other as well as keyed under her id in self.detected; told apart by value type Undo: drop the inline reading in detectionsOf and checkOther ([#187](https://github.com/mark-brannan/colregs-engine/pull/187))

### 20261117t111030z
- the six detection means are visual, sound, radar, ais, vhf, assumed, the worked example's names; each yes or no Undo: edit Detected and MEANS in src/unified.ts ([#187](https://github.com/mark-brannan/colregs-engine/pull/187))

### 20261117t111033z
- every other still needs a detection set from self, as known was required Undo: drop the throw in checkOther ([#187](https://github.com/mark-brannan/colregs-engine/pull/187))

### 20261117t111037z
- self's perception of her (bearing_deg, range_nm, observed) stays on the other and is refused on self, marked open Undo: move them under self keyed by her id, in situationFor and the checks ([#187](https://github.com/mark-brannan/colregs-engine/pull/187))

### 20261117t111041z
- the unified form's types are named Detected and CircumstancesVessel, replacing Known and Other one for one; Vessel stays the three operations' Undo: rename the two types ([#187](https://github.com/mark-brannan/colregs-engine/pull/187))

### 20261117t113949z
- The observation entry: observed is a list of notes on the vessel that made them; keys means, of (optional), inferred, bearing_rel_deg (a number or an {from_deg,to_deg} arc for a rough direction), range_nm, lights (lights.json ids), signal (the data's sound elements); unread keys refused Undo: reshape it in the unified form ([#189](https://github.com/mark-brannan/colregs-engine/pull/189))

### 20261117t113959z
- In sight when either vessel observes the other visually (3(k)), not self's own visual only Undo: one || in viewOf; rests on the sitting's question 1, api-examples 8a reads both ([#189](https://github.com/mark-brannan/colregs-engine/pull/189))

### 20261117t114004z
- Reading notes backwards tries a power-driven and a sailing vessel underway with no activity, the two the pencil names Undo: widen the HYPOTHESES list (the sitting's question 2) ([#189](https://github.com/mark-brannan/colregs-engine/pull/189))

### 20261117t114009z
- Appraisal: a non-empty asserted fact is rested on as given; otherwise the candidates, one answer when every envelope is equal, else candidates with decides, a list of paths into the circumstances; Indication key inSight Undo: change appraisal in src/unified.ts ([#189](https://github.com/mark-brannan/colregs-engine/pull/189))
