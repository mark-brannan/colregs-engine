# Two vessels under Rules 13 to 19, in TLA+

✎ **Pencil.** Step P4.2 of the
[research programme](../../docs/research-programme.md): an abstract
two-vessel spec, checked by TLC as an offline oracle. Invariant names follow
colregs [`docs/part-b-invariants.md`](https://github.com/mark-brannan/colregs/blob/main/docs/part-b-invariants.md);
`Inv13d` is `INV-13d`.

```
npm run tla                       # six readings, one after another
npm run tla -- --only=Q55-reset   # one reading
```

A reading is one TLC pass over the whole state space plus a pass per
expected counterexample, on one worker: 10k to 105k distinct states, under
two minutes a reading, the counterexamples in seconds. Not in `npm test` and
not in CI. TLC is `$TLA2TOOLS`, else `research/tla/.tools/tla2tools.jar`:

```
gh release download v1.7.4 --repo tlaplus/tlaplus --pattern tla2tools.jar --dir research/tla/.tools
sha256sum research/tla/.tools/tla2tools.jar   # 936a2620…0e88, as expectations.json
```

## The model

State: the deeming sector of the moment (overtaking by either vessel,
head-on, crossing with either on the other's starboard side, past and
clear), which side and end of the beam each sees the other, visibility
(in sight, or fog), the 13(d) overtaking history, the Rule 17 phase per
vessel, and what each duty remembers. Geometry and conditions change
nondeterministically; vessels manoeuvre freely, lawful or not.

Classification and roles are the data's: 13(d) armed at deeming (`Q-51`),
broad (`Q-52`), with the other vessel's sector test suppressed while a
history stands (`Q-47`); roles from the encounter type; no role in fog
(`INV-19a-noroles`); not in sight is Rule 19 (`Q-56` closed). Phases are
monotone (`Q-54`) and phase 2 is an exception (`Q-53`).

Conduct is a `Breach` predicate per invariant over a state and a
manoeuvre. The undetermined terms enter as inputs, not numbers: `due` is
"early" (16) and "ample time" (19(d)); `admits` is "the circumstances of
the case"; when they do not admit, the only manoeuvre that avoids is the
one the caveat forbids. What TLC checks of conduct is that the duties can
be met together: every reachable state leaves each vessel a lawful
manoeuvre.

## Readings

Each open reading is a `CONSTANT`. `base` is the reading under which every
check holds; each other run changes one.

| run               | reading                                                         | fails, with a counterexample                                    |
| ----------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| `base`            | `Q31` excusable, `Q55` persist, `Q57` attachment, `Trigger` lag | nothing                                                         |
| `Q31-binding`     | the caveat never excuses                                        | `Inv15aNotAhead`, `Inv17c`, `Inv19d1`, `Inv19d2`, `Satisfiable` |
| `Q55-reset`       | Section II starts afresh after fog                              | `Inv13d`, `Inv13dDuty`, `Prop17PhasesMonotone`                  |
| `Q57-steady`      | a turn in progress may complete                                 | `Inv17a1`                                                       |
| `trigger-perfect` | apparent at the first non-compliant state                       | `Prop17a2TriggerLag`                                            |
| `trigger-free`    | apparent whenever, a free input                                 | `Inv17a2TriggerReal`, `Prop17a2TriggerLag`                      |

What the counterexamples show:

- **`Q-31` binding.** Where the circumstances do not admit, a duty to act
  meets a caveat forbidding the only avoiding manoeuvre: the give-way vessel
  of a crossing whose only way clear crosses ahead (15(a)); in fog, a turn
  to port for a vessel forward of the beam (19(d)(i)) or toward one abaft
  it (19(d)(ii)). In phase 2 of a crossing, 17(c) leaves the stand-on
  vessel holding on as the only lawful choice, and 17(a)(ii)'s permission
  empty. `Inv17b` holds either way: 17(c) does not reach phase 3.
- **`Q-55` reset.** Five states: an overtaking drawn onto the bow, fog, sight
  regained, and the pair reads head-on. The reclassification 13(d) forbids
  happens by way of the fog; the duty moves and the phase falls back.
- **`Q-57`** and **`Trigger`** each show their options apart: a phase 1
  departure that `steady` permits; phase 2 without non-compliance (`free`),
  or at its first state (`perfect`).

## Checks

|                                           | checks                                                                                                                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Held under every reading                  | `Inv14a`, `Inv16`, `Inv16Scope`, `Inv17a2Permission`, `Inv17b`, `Prop17d`, `Inv17Phases`, `Inv19dDetermine`, `Inv19dAction`                                    |
| Held except under `Q55` reset             | `Inv13d`, `Inv13dDuty`, `Prop17PhasesMonotone`                                                                                                                 |
| Over an open question, both ways          | `Inv15aNotAhead`, `Inv17c`, `Inv19d1`, `Inv19d2` (`Q-31`); `Inv17a1` (`Q-57`); `Inv17a2TriggerReal`, `Prop17a2TriggerLag` (17(a)(ii)'s trigger)                |
| Cross-rule, single-state                  | `InvPartition`, `InvRolesExclusive`, `Inv17a1Scope`, `Inv19aNoroles`, `TypeOK`                                                                                 |
| Reachability, failing under every reading | the six `Never…` checks: an overtaking drawn out, head-on with action due, a give-way vessel due to act, phase 2 in a crossing, phase 3, close quarters in fog |

`Inv17a2Permission` and `Inv19dAction` are stated where no caveat reaches;
where one does, they are `Inv17c` and `Inv19d1`/`Inv19d2`.

## What it does not cover

`INV-19e` (its subject is not a pair). Rule 18's ranks and sailing vessels:
both vessels are power-driven. Risk of collision is not a gate (`Q-50`
wide). Kinematics: which manoeuvre avoids collision is an input, not
reachability over a manoeuvring envelope, and "early", "ample time" and
"so close" are one boolean each, not durations (P4.4). Three vessels
(P4.3). Next: TLC traces as `evaluateCompliance` fixtures.
