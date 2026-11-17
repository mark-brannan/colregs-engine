----------------------------- MODULE TwoVessel -----------------------------
(***************************************************************************)
(* Two power-driven vessels under Rules 13 to 19, abstracted. Geometry is *)
(* a nondeterministic sector; the spec carries the encounter type, the    *)
(* 13(d) overtaking history, the Rule 17 phase and the visibility mode.   *)
(* Invariant names follow colregs docs/part-b-invariants.md: Inv13d is    *)
(* INV-13d.                                                                *)
(*                                                                         *)
(* Vessels do anything: a Move is any manoeuvre, lawful or not. Each      *)
(* conduct invariant is a Breach predicate over a state and a manoeuvre;  *)
(* Lawful is the absence of every breach. What TLC checks of conduct is   *)
(* that the duties can be met together: at every reachable state each     *)
(* vessel has a lawful manoeuvre (Satisfiable and its parts).             *)
(*                                                                         *)
(* An open reading is a CONSTANT, and run.ts checks the spec under each   *)
(* value:                                                                  *)
(*   Q31      "if the circumstances admit" / "so far as possible":        *)
(*            "binding" (the caveat never excuses) or "excusable" (it     *)
(*            excuses when the circumstances do not admit).               *)
(*   Q55      a visibility transition: "persist" (13(d) history and the   *)
(*            Rule 17 phase survive the fog) or "reset" (Section II       *)
(*            starts afresh when sight is regained).                      *)
(*   Q57      the 17(a)(i) baseline: "attachment" or "steady" (a turn in  *)
(*            progress when the role attached may complete).              *)
(*   Trigger  how non-compliance "becomes apparent" (17(a)(ii)):          *)
(*            "perfect" (at the first non-compliant state), "lag" (after  *)
(*            two in a row) or "free" (at any state, a free input).       *)
(***************************************************************************)
EXTENDS Naturals, FiniteSets, TLC

CONSTANTS V, Q31, Q55, Q57, Trigger

ASSUME Cardinality(V) = 2
ASSUME Q31 \in {"binding", "excusable"}
ASSUME Q55 \in {"persist", "reset"}
ASSUME Q57 \in {"attachment", "steady"}
ASSUME Trigger \in {"perfect", "lag", "free"}

\* The two vessels are interchangeable, so TLC checks one of each mirror pair.
Mirror == Permutations(V)

Other(v) == CHOOSE w \in V : w # v
Max(a, b) == IF a > b THEN a ELSE b
None == [v \in V |-> FALSE]
All == [v \in V |-> TRUE]
Only(v) == [w \in V |-> w = v]

(* The deeming sectors of the moment. Over(v): v is deemed to be         *)
(* overtaking the other (13(b)). HeadOn: each sees the other ahead or     *)
(* nearly ahead (14(b)). Cross(v): the other is on v's starboard side     *)
(* (15(a)). Clear: past and clear, which ends the encounter.              *)
Over(v) == [k |-> "over", by |-> {v}]
Cross(v) == [k |-> "cross", by |-> {v}]
HeadOn == [k |-> "head", by |-> {}]
Clear == [k |-> "clear", by |-> {}]
Sectors == {HeadOn, Clear} \cup {Over(v) : v \in V} \cup {Cross(v) : v \in V}

(* fwd[v]: the other is forward of v's beam. stb[v]: the other is on     *)
(* v's starboard side. Each sector fixes what it implies; in fog the rest *)
(* is free. In sight nothing reads the rest, so it is held at FALSE.      *)
SightFwd(g) == CASE g.k = "over" -> Only(CHOOSE v \in g.by : TRUE)
                 [] g.k = "head" -> All
                 [] OTHER -> None
SightStb(g) == IF g.k = "cross" THEN Only(CHOOSE v \in g.by : TRUE) ELSE None
Consistent(g, f, s) ==
  CASE g.k = "clear" -> f = None /\ s = None
    [] g.k = "over" -> \E v \in g.by : f[v] /\ ~f[Other(v)]
    [] g.k = "head" -> f = All
    [] OTHER -> \E v \in g.by : s[v] /\ ~s[Other(v)]

(* "ahead": an avoiding manoeuvre whose track crosses ahead of the other. *)
(* "plot": she keeps her course and speed and makes 19(d)'s               *)
(* determination.                                                         *)
Moves == {"hold", "plot", "stbd", "port", "speed", "ahead"}
Holding == {"hold", "plot"}

VARIABLES
  geo, fwd, stb,  \* the sector, and which side and end of the beam the other is
  vis,            \* "sight" (Section II) or "fog" (Rule 19)
  admits,         \* the circumstances of the case admit the caveated duties
  due,            \* the time for action has come: early (16), ample (19(d))
  hist,           \* 13(d): hist[v], v is the overtaking vessel of this encounter
  ever,           \* ghost: v deemed overtaking at some state since the encounter began
  phase,          \* Rule 17: 0 never stand-on, then 1, 2, 3; one marker per vessel
  acted,          \* v has taken avoiding action under Section II
  r19,            \* Rule 19(d): "todo", then "nocq" or "cq", then "acted"
  settling,       \* a turn was in progress when the stand-on role attached
  age             \* consecutive states the give-way vessel has been non-compliant, to 2

vars == <<geo, fwd, stb, vis, admits, due, hist, ever, phase, acted, r19, settling, age>>

(* Classification, as a function of the state's parts, so a step can     *)
(* read it of the next state.                                             *)
EType(g, vi, h) ==
  IF vi = "fog" \/ g = Clear THEN "none"
  ELSE IF \E v \in V : h[v] THEN "overtaking"
  ELSE CASE g = HeadOn -> "head-on"
         [] g.k = "cross" -> "crossing"
         [] OTHER -> "none"

RoleOf(v, g, vi, h) ==
  LET t == EType(g, vi, h) IN
  CASE t = "overtaking" -> IF h[v] THEN "give-way" ELSE "stand-on"
    [] t = "crossing" -> IF g = Cross(v) THEN "give-way" ELSE "stand-on"
    [] OTHER -> "none"

(* 13(d), armed at 13(b)'s deeming (Q-51); while one vessel's history    *)
(* stands the other's sector test is suppressed (Q-47).                   *)
Armed(g, vi, h) == [v \in V |-> h[v] \/ (vi = "sight" /\ g = Over(v) /\ ~h[Other(v)])]

Type == EType(geo, vis, hist)
Role(v) == RoleOf(v, geo, vis, hist)
GiveWay(v) == Role(v) = "give-way"
StandOn(v) == Role(v) = "stand-on"
Fog == vis = "fog" /\ geo # Clear
Noncompliant == \E v \in V : GiveWay(v) /\ due /\ ~acted[v]
Binding == Q31 = "binding" \/ admits
Toward(v) == IF stb[v] THEN "stbd" ELSE "port"
\* 19(d)(i)'s exception: Rule 13's sector, read inside Section III.
Overtaking19(v) == geo = Over(v)

(* The manoeuvres a caveated duty forbids at this state. When the        *)
(* circumstances do not admit, they are the only avoiding manoeuvres.     *)
Forbidden(v) ==
  (IF Type = "crossing" /\ GiveWay(v) THEN {"ahead"} ELSE {})
  \cup (IF StandOn(v) /\ phase[v] = 2 /\ Type = "crossing" /\ ~stb[v] THEN {"port"} ELSE {})
  \cup (IF Fog /\ fwd[v] /\ ~Overtaking19(v) THEN {"port"} ELSE {})
  \cup (IF Fog /\ ~fwd[v] THEN {Toward(v)} ELSE {})

Avoiding(v) == IF admits \/ Forbidden(v) = {} THEN Moves \ Holding ELSE Forbidden(v)

---------------------------------------------------------------------------
(* Conduct. One Breach per invariant, true when manoeuvre m breaks it.   *)

Breach14a(v, m) == Type = "head-on" /\ (m \in {"port", "ahead"} \/ (due /\ ~acted[v] /\ m # "stbd"))
\* INV-16, qualitative: once action is due, the give-way vessel's manoeuvre avoids.
Breach16(v, m) == GiveWay(v) /\ due /\ ~acted[v] /\ m \notin Avoiding(v)
Breach15aNotAhead(v, m) == Type = "crossing" /\ GiveWay(v) /\ m = "ahead" /\ Binding
Breach17a1(v, m) ==
  StandOn(v) /\ phase[v] = 1 /\ m \notin Holding /\ ~(Q57 = "steady" /\ settling)
\* Q-53, an exception: the only lawful departure in phase 2 avoids collision.
Breach17a2(v, m) == StandOn(v) /\ phase[v] = 2 /\ m \notin Holding \cup Avoiding(v)
Breach17b(v, m) == StandOn(v) /\ phase[v] = 3 /\ m \notin Avoiding(v)
Breach17c(v, m) ==
  StandOn(v) /\ phase[v] = 2 /\ Type = "crossing" /\ ~stb[v] /\ m = "port" /\ Binding
Breach19dDetermine(v, m) == Fog /\ due /\ r19[v] = "todo" /\ m # "plot"
Breach19dAction(v, m) == Fog /\ due /\ r19[v] = "cq" /\ m \notin Avoiding(v)
Breach19d1(v, m) == Fog /\ fwd[v] /\ ~Overtaking19(v) /\ m = "port" /\ Binding
Breach19d2(v, m) == Fog /\ ~fwd[v] /\ m = Toward(v) /\ Binding

Lawful(v, m) ==
  ~ \/ Breach14a(v, m) \/ Breach16(v, m) \/ Breach15aNotAhead(v, m)
    \/ Breach17a1(v, m) \/ Breach17a2(v, m) \/ Breach17b(v, m) \/ Breach17c(v, m)
    \/ Breach19dDetermine(v, m) \/ Breach19dAction(v, m)
    \/ Breach19d1(v, m) \/ Breach19d2(v, m)

---------------------------------------------------------------------------
(* Steps. Env moves the world on one tick; Move is one vessel's          *)
(* manoeuvre between ticks.                                               *)

Init ==
  /\ geo = Clear /\ fwd = None /\ stb = None
  /\ vis \in {"sight", "fog"} /\ admits \in BOOLEAN /\ due = FALSE
  /\ hist = None /\ ever = None /\ phase = [v \in V |-> 0]
  /\ acted = None /\ r19 = [v \in V |-> "todo"] /\ settling = FALSE /\ age = 0

(* One tick to the world (g, f, s, vi), the conditions (a, d) and whether *)
(* collision can no longer be avoided by the give-way vessel alone (c),   *)
(* with the history, the phase and the duties' memory carried forward.    *)
Tick(g, f, s, vi, a, d, c) ==
  LET ends == g = Clear
      \* Section II state starts afresh: a new encounter, or Q-55's reset.
      \* Nothing reads Section II state in fog, so the reset drops it as the
      \* fog comes in rather than as it lifts; to every check the two are one.
      fresh == ends \/ (Q55 = "reset" /\ vis = "sight" /\ vi = "fog")
      inFog == vi = "fog" /\ vis = "fog" /\ ~ends
      h == Armed(g, vi, IF fresh THEN None ELSE hist)
      a2 == IF fresh THEN None ELSE acted
      d2 == ~ends /\ (d \/ (due /\ ~fresh))
      p0 == IF fresh THEN [v \in V |-> 0] ELSE phase
      nc == \E v \in V : RoleOf(v, g, vi, h) = "give-way" /\ d2 /\ ~a2[v]
      ag == IF Trigger # "lag" \/ ~nc THEN 0
            ELSE IF fresh \/ ~Noncompliant THEN 1
            ELSE IF age = 2 THEN 2 ELSE age + 1
      apparent == IF Trigger = "perfect" THEN nc ELSE ag = 2
      Options(v) ==
        IF RoleOf(v, g, vi, h) # "stand-on" THEN {p0[v]}
        ELSE IF c THEN {3}
        ELSE IF Trigger = "free" THEN {Max(p0[v], 1), Max(p0[v], 2)}
        ELSE {Max(p0[v], IF apparent THEN 2 ELSE 1)}
      attaches == \E v \in V : RoleOf(v, g, vi, h) = "stand-on" /\ p0[v] = 0
  IN /\ c => vi = "sight" /\ ~ends
     /\ geo' = g /\ vis' = vi
     /\ fwd' = IF vi = "sight" THEN SightFwd(g) ELSE f
     /\ stb' = IF vi = "sight" THEN SightStb(g) ELSE s
     /\ admits' = a /\ due' = d2
     /\ hist' = h
     /\ ever' = IF ends THEN None ELSE [v \in V |-> ever[v] \/ h[v]]
     /\ phase' \in {p \in [V -> 0..3] : \A v \in V : p[v] \in Options(v)}
     /\ acted' = a2
     /\ r19' = IF inFog THEN r19 ELSE [v \in V |-> "todo"]
     /\ settling' \in IF attaches THEN BOOLEAN ELSE {~fresh /\ vi = "sight" /\ settling}
     /\ age' = ag

NewGeometry ==
  \E g \in Sectors, f \in [V -> BOOLEAN], s \in [V -> BOOLEAN] :
    /\ IF vis = "sight" THEN f = SightFwd(g) /\ s = SightStb(g) ELSE Consistent(g, f, s)
    /\ Tick(g, f, s, vis, admits, due, FALSE)
NewVisibility ==
  \E vi \in {"sight", "fog"} : vi # vis /\ Tick(geo, fwd, stb, vi, admits, due, FALSE)
NewConditions == \E a, d, c \in BOOLEAN : Tick(geo, fwd, stb, vis, a, d, c)
Env == NewGeometry \/ NewVisibility \/ NewConditions

Move(v) ==
  \E m \in Moves :
    /\ geo # Clear
    /\ acted' = IF vis = "sight" /\ m \in Avoiding(v) THEN [acted EXCEPT ![v] = TRUE] ELSE acted
    /\ r19' \in CASE Fog /\ m = "plot" /\ r19[v] = "todo" ->
                       {[r19 EXCEPT ![v] = "cq"], [r19 EXCEPT ![v] = "nocq"]}
                  [] Fog /\ r19[v] = "cq" /\ m \in Avoiding(v) -> {[r19 EXCEPT ![v] = "acted"]}
                  [] OTHER -> {r19}
    /\ settling' = (settling /\ ~(StandOn(v) /\ m \notin Holding))
    /\ UNCHANGED <<geo, fwd, stb, vis, admits, due, hist, ever, phase, age>>

Next == Env \/ \E v \in V : Move(v)
Spec == Init /\ [][Next]_vars

---------------------------------------------------------------------------
(* Classification and precedence, over any conduct.                      *)

TypeOK ==
  /\ geo \in Sectors /\ fwd \in [V -> BOOLEAN] /\ stb \in [V -> BOOLEAN]
  /\ vis \in {"sight", "fog"} /\ admits \in BOOLEAN /\ due \in BOOLEAN
  /\ hist \in [V -> BOOLEAN] /\ ever \in [V -> BOOLEAN] /\ phase \in [V -> 0..3]
  /\ acted \in [V -> BOOLEAN] /\ r19 \in [V -> {"todo", "cq", "nocq", "acted"}]
  /\ settling \in BOOLEAN /\ age \in 0..2

InvPartition == vis = "sight" /\ geo # Clear => Type \in {"overtaking", "head-on", "crossing"}
InvRolesExclusive == \A v \in V : Role(v) \in {"give-way", "stand-on"} => Role(Other(v)) # Role(v)
Inv17a1Scope == \A v \in V : StandOn(v) <=> GiveWay(Other(v))
Inv19aNoroles == vis = "fog" => \A v \in V : Role(v) = "none"

Inv13d == \A v \in V : vis = "sight" /\ geo # Clear /\ ever[v] => Type = "overtaking"
Inv13dDuty ==
  \A v \in V : vis = "sight" /\ geo # Clear /\ ever[v] => GiveWay(v) /\ StandOn(Other(v))
\* INV-16-scope: holding breaks INV-16 for every give-way vessel, whichever rule named her.
Inv16Scope == \A v \in V : GiveWay(v) /\ due /\ ~acted[v] => Breach16(v, "hold")
Inv17Phases == \A v \in V : StandOn(v) => phase[v] \in 1..3
\* INV-17-phases, monotone (Q-54) for the whole encounter, fog included.
Prop17PhasesMonotone == [][\A v \in V : geo' # Clear => phase'[v] >= phase[v]]_vars
\* INV-17d: no step that leaves the geometry and visibility alone, which
\* takes in every Rule 17 phase change and every manoeuvre, moves a role.
Prop17d ==
  [][geo' = geo /\ vis' = vis => \A v \in V : RoleOf(v, geo', vis', hist') = Role(v)]_vars

---------------------------------------------------------------------------
(* Conduct: the duties can be met together. A duty no caveat reaches is  *)
(* checked where none does (Free); the caveated ones where one does.      *)

Free(v) == admits \/ Forbidden(v) = {}
Departs(v) == \E m \in Moves \ Holding : Lawful(v, m)

Satisfiable == \A v \in V : \E m \in Moves : Lawful(v, m)
Inv14a == \A v \in V : Type = "head-on" => Lawful(v, "stbd") /\ ~Lawful(v, "port")
Inv16 == \A v \in V : GiveWay(v) /\ Free(v) => Departs(v)
Inv17b == \A v \in V : StandOn(v) /\ phase[v] = 3 => Departs(v) /\ ~Lawful(v, "hold")
\* INV-17a2-permission, the modal limb: holding is lawful, and so is a departure.
Inv17a2Permission ==
  \A v \in V : StandOn(v) /\ phase[v] = 2 => Lawful(v, "hold") /\ (Free(v) => Departs(v))
Inv19dDetermine ==
  \A v \in V : Fog /\ due /\ r19[v] = "todo" => \A m \in Moves : Lawful(v, m) => m = "plot"
Inv19dAction == \A v \in V : Fog /\ r19[v] = "cq" /\ Free(v) => \E m \in Moves : Lawful(v, m)

\* Q-31: where the circumstances do not admit, a lawful manoeuvre exists only if the caveat excuses.
Inv15aNotAhead == \A v \in V : Type = "crossing" /\ GiveWay(v) => \E m \in Moves : Lawful(v, m)
Inv17c == \A v \in V : StandOn(v) /\ phase[v] = 2 => Departs(v)
Inv19d1 == \A v \in V : Fog /\ fwd[v] => \E m \in Moves : Lawful(v, m)
Inv19d2 == \A v \in V : Fog /\ ~fwd[v] => \E m \in Moves : Lawful(v, m)

(* Witnesses: true under one reading, false under the other.             *)

\* Q-57: under attachment no departure is lawful in phase 1.
Inv17a1 == \A v \in V : StandOn(v) /\ phase[v] = 1 => ~Departs(v)
\* INV-17a2-trigger: phase 2 comes only of real non-compliance ...
Inv17a2TriggerReal == \A v \in V : StandOn(v) /\ phase[v] = 2 => due
\* ... and never at the first state of it.
Prop17a2TriggerLag ==
  [][\A v \in V : phase[v] < 2 /\ phase'[v] = 2 /\ vis' = "sight" => Noncompliant]_vars

(* Reachability: false under every reading, each naming a state some     *)
(* check above reads, so that no check holds only because its antecedent  *)
(* is never met.                                                          *)
NeverDrawnOut == ~\E v \in V : vis = "sight" /\ ever[v] /\ geo \notin {Over(v), Clear}
NeverHeadOnDue == ~(Type = "head-on" /\ due)
NeverGiveWayDue == ~\E v \in V : GiveWay(v) /\ due /\ ~acted[v] /\ ~admits
NeverPhase2 == ~\E v \in V : StandOn(v) /\ phase[v] = 2 /\ Type = "crossing"
NeverPhase3 == ~\E v \in V : StandOn(v) /\ phase[v] = 3
NeverCloseQuarters19 == ~\E v \in V : Fog /\ due /\ r19[v] = "cq"
=============================================================================
