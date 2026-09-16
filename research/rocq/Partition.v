(* Partition soundness for threshold predicates.

   A predicate that compares a numeric fact only against a fixed finite set
   of thresholds cannot tell two values apart unless some threshold lies
   between them or equals one of them. So it is decided everywhere once it
   is checked at every threshold and at one point inside each open interval
   between (and beyond) them: the representatives the conformance harness
   enumerates (research/conformance/enumerate.ts, numericRepresentatives).

   Generic over any strictly ordered type with a decidable three-way
   comparison; instantiated at the end over the reals with the harness's own
   choice of representatives (c - 1, the thresholds, midpoints, c + 1). *)

From Coq Require Import List Sorted Reals Lra.
Import ListNotations.

Section Generic.

Variable A : Type.
Variable lt : A -> A -> Prop.
Variable cmp : A -> A -> comparison.

Hypothesis lt_trans : forall x y z, lt x y -> lt y z -> lt x z.
Hypothesis lt_irrefl : forall x, ~ lt x x.
Hypothesis cmp_spec : forall x y, CompSpec eq lt x y (cmp x y).

Lemma lt_asym : forall x y, lt x y -> lt y x -> False.
Proof. intros x y H1 H2. exact (lt_irrefl x (lt_trans x y x H1 H2)). Qed.

Lemma cmp_eq_iff : forall x y, cmp x y = Eq <-> x = y.
Proof.
  intros x y. destruct (cmp_spec x y) as [H | H | H]; split; intro H'.
  - exact H.
  - reflexivity.
  - discriminate.
  - subst; exfalso; exact (lt_irrefl y H).
  - discriminate.
  - subst; exfalso; exact (lt_irrefl y H).
Qed.

Lemma cmp_lt_iff : forall x y, cmp x y = Lt <-> lt x y.
Proof.
  intros x y. destruct (cmp_spec x y) as [H | H | H]; split; intro H'.
  - discriminate.
  - subst; exfalso; exact (lt_irrefl y H').
  - exact H.
  - reflexivity.
  - discriminate.
  - exfalso; exact (lt_asym x y H' H).
Qed.

Lemma cmp_gt_iff : forall x y, cmp x y = Gt <-> lt y x.
Proof.
  intros x y. destruct (cmp_spec x y) as [H | H | H]; split; intro H'.
  - discriminate.
  - subst; exfalso; exact (lt_irrefl y H').
  - discriminate.
  - exfalso; exact (lt_asym x y H H').
  - exact H.
  - reflexivity.
Qed.

(* ---- Predicates ---------------------------------------------------- *)

(* The numeric constraint forms the predicate semantics admit, plus equality
   for completeness; `not`, conjunction of a `when`'s constraints, and
   `any_of`. *)
Inductive op := OpLt | OpLe | OpGt | OpGe | OpEq | OpNe.

Inductive formula :=
| FTrue : formula
| FCmp : op -> A -> formula
| FNot : formula -> formula
| FAnd : formula -> formula -> formula
| FOr : formula -> formula -> formula.

Definition eval_op (o : op) (c : comparison) : bool :=
  match o with
  | OpLt => match c with Lt => true | _ => false end
  | OpLe => match c with Gt => false | _ => true end
  | OpGt => match c with Gt => true | _ => false end
  | OpGe => match c with Lt => false | _ => true end
  | OpEq => match c with Eq => true | _ => false end
  | OpNe => match c with Eq => false | _ => true end
  end.

Fixpoint eval (f : formula) (x : A) : bool :=
  match f with
  | FTrue => true
  | FCmp o c => eval_op o (cmp x c)
  | FNot g => negb (eval g x)
  | FAnd g h => eval g x && eval h x
  | FOr g h => eval g x || eval h x
  end.

(* The thresholds a formula reads. *)
Fixpoint constants (f : formula) : list A :=
  match f with
  | FTrue => []
  | FCmp _ c => [c]
  | FNot g => constants g
  | FAnd g h => constants g ++ constants h
  | FOr g h => constants g ++ constants h
  end.

(* ---- Cells --------------------------------------------------------- *)

(* Two values are in the same cell of the partition induced by [cs] when no
   threshold in [cs] tells them apart. *)
Definition same_cell (cs : list A) (x y : A) : Prop :=
  forall c, In c cs -> cmp x c = cmp y c.

Lemma eval_same_cell : forall cs f x y,
  incl (constants f) cs -> same_cell cs x y -> eval f x = eval f y.
Proof.
  intros cs f x y Hincl Hcell. induction f; simpl in *.
  - reflexivity.
  - rewrite (Hcell a); [ reflexivity | apply Hincl; left; reflexivity ].
  - rewrite IHf; [ reflexivity | exact Hincl ].
  - rewrite IHf1, IHf2; [ reflexivity | | ];
      intros c Hc; apply Hincl, in_or_app; auto.
  - rewrite IHf1, IHf2; [ reflexivity | | ];
      intros c Hc; apply Hincl, in_or_app; auto.
Qed.

(* [reps] covers [cs] when every value shares a cell with some representative. *)
Definition covers (cs reps : list A) : Prop :=
  forall x, exists r, In r reps /\ same_cell cs x r.

(* Two formulas over the thresholds that agree on a covering set of
   representatives agree everywhere. *)
Theorem decided_by_representatives : forall cs reps f g,
  covers cs reps ->
  incl (constants f) cs -> incl (constants g) cs ->
  (forall r, In r reps -> eval f r = eval g r) ->
  forall x, eval f x = eval g x.
Proof.
  intros cs reps f g Hcov Hf Hg Hreps x.
  destruct (Hcov x) as [r [Hin Hcell]].
  rewrite (eval_same_cell cs f x r Hf Hcell).
  rewrite (eval_same_cell cs g x r Hg Hcell).
  exact (Hreps r Hin).
Qed.

(* ---- The harness's representatives --------------------------------- *)

(* One point below the least threshold, every threshold, one point strictly
   between each adjacent pair, one point above the greatest. *)
Variable below above : A -> A.
Variable mid : A -> A -> A.
Hypothesis below_lt : forall c, lt (below c) c.
Hypothesis above_gt : forall c, lt c (above c).
Hypothesis mid_between : forall a b, lt a b -> lt a (mid a b) /\ lt (mid a b) b.

Fixpoint reps_from (c : A) (rest : list A) : list A :=
  match rest with
  | [] => [c; above c]
  | c' :: rest' => c :: mid c c' :: reps_from c' rest'
  end.

Definition representatives (cs : list A) : list A :=
  match cs with
  | [] => []
  | c :: rest => below c :: reps_from c rest
  end.

Lemma representatives_length : forall cs,
  cs <> [] -> length (representatives cs) = 2 * length cs + 1.
Proof.
  intros [| c rest] Hne; [ contradiction | simpl; f_equal ].
  clear Hne. revert c. induction rest as [| c' rest' IH]; intro c; simpl.
  - reflexivity.
  - rewrite IH. simpl. ring.
Qed.

Lemma sorted_head : forall c l,
  StronglySorted lt (c :: l) -> forall d, In d (c :: l) -> d = c \/ lt c d.
Proof.
  intros c l Hs d Hd. inversion Hs as [| ? ? _ Hall]; subst.
  destruct Hd as [Hd | Hd]; [ left; symmetry; exact Hd | right ].
  rewrite Forall_forall in Hall. exact (Hall d Hd).
Qed.

Lemma lt_head_all : forall x c l,
  StronglySorted lt (c :: l) -> lt x c -> forall d, In d (c :: l) -> lt x d.
Proof.
  intros x c l Hs Hx d Hd.
  destruct (sorted_head c l Hs d Hd) as [-> | Hlt]; [ exact Hx | ].
  exact (lt_trans x c d Hx Hlt).
Qed.

Lemma reps_from_covers : forall rest c x,
  StronglySorted lt (c :: rest) -> cmp x c <> Lt ->
  exists r, In r (reps_from c rest) /\ same_cell (c :: rest) x r.
Proof.
  induction rest as [| c' rest' IH]; intros c x Hs Hx; simpl.
  - destruct (cmp x c) eqn:E; [ | contradiction | ].
    + apply cmp_eq_iff in E; subst x.
      exists c. split; [ left; reflexivity | intros d _; reflexivity ].
    + exists (above c). split; [ right; left; reflexivity | ].
      intros d [Hd | []]; subst d. rewrite E.
      symmetry; apply cmp_gt_iff; apply above_gt.
  - inversion Hs as [| ? ? Hs' Hall]; subst.
    assert (Hcc' : lt c c') by (inversion Hall; assumption).
    destruct (cmp x c) eqn:E; [ | contradiction | ].
    + apply cmp_eq_iff in E; subst x.
      exists c. split; [ left; reflexivity | intros d _; reflexivity ].
    + apply cmp_gt_iff in E.
      destruct (mid_between c c' Hcc') as [Hm1 Hm2].
      destruct (cmp x c') eqn:E'.
      * (* x = c' : the tail's own representative *)
        destruct (IH c' x Hs') as [r [Hin Hcell]]; [ rewrite E'; discriminate | ].
        exists r. split; [ right; right; exact Hin | ].
        intros d [Hd | Hd]; [ subst d | exact (Hcell d Hd) ].
        apply cmp_eq_iff in E'; subst x.
        specialize (Hcell c' (or_introl eq_refl)).
        rewrite (proj2 (cmp_eq_iff c' c') eq_refl) in Hcell.
        symmetry in Hcell; apply cmp_eq_iff in Hcell; subst r.
        reflexivity.
      * (* c < x < c' : the midpoint *)
        apply cmp_lt_iff in E'.
        exists (mid c c'). split; [ right; left; reflexivity | ].
        intros d [Hd | Hd]; [ subst d | ].
        { rewrite (proj2 (cmp_gt_iff x c) E).
          symmetry; apply cmp_gt_iff; exact Hm1. }
        { rewrite (proj2 (cmp_lt_iff x d) (lt_head_all x c' rest' Hs' E' d Hd)).
          symmetry; apply cmp_lt_iff.
          exact (lt_head_all (mid c c') c' rest' Hs' Hm2 d Hd). }
      * (* x > c' : the tail's own representative *)
        destruct (IH c' x Hs') as [r [Hin Hcell]]; [ rewrite E'; discriminate | ].
        exists r. split; [ right; right; exact Hin | ].
        intros d [Hd | Hd]; [ subst d | exact (Hcell d Hd) ].
        rewrite (proj2 (cmp_gt_iff x c) E).
        specialize (Hcell c' (or_introl eq_refl)).
        rewrite E' in Hcell. symmetry in Hcell. apply cmp_gt_iff in Hcell.
        symmetry; apply cmp_gt_iff. exact (lt_trans c c' r Hcc' Hcell).
Qed.

Theorem representatives_cover : forall cs,
  cs <> [] -> StronglySorted lt cs -> covers cs (representatives cs).
Proof.
  intros cs Hne Hs x. destruct cs as [| c rest]; [ contradiction | simpl ].
  destruct (cmp x c) eqn:E.
  - destruct (reps_from_covers rest c x Hs) as [r [Hin Hcell]];
      [ rewrite E; discriminate | exists r; auto ].
  - apply cmp_lt_iff in E.
    exists (below c). split; [ left; reflexivity | ].
    intros d Hd.
    rewrite (proj2 (cmp_lt_iff x d) (lt_head_all x c rest Hs E d Hd)).
    symmetry; apply cmp_lt_iff.
    exact (lt_head_all (below c) c rest Hs (below_lt c) d Hd).
  - destruct (reps_from_covers rest c x Hs) as [r [Hin Hcell]];
      [ rewrite E; discriminate | exists r; auto ].
Qed.

(* The lemma: over a sorted, non-empty threshold set, two predicates that
   read only those thresholds and agree on the harness's representatives
   agree on every value of the type. *)
Theorem partition_sound : forall cs f g,
  cs <> [] -> StronglySorted lt cs ->
  incl (constants f) cs -> incl (constants g) cs ->
  (forall r, In r (representatives cs) -> eval f r = eval g r) ->
  forall x, eval f x = eval g x.
Proof.
  intros cs f g Hne Hs.
  apply decided_by_representatives, representatives_cover; assumption.
Qed.

End Generic.

Local Open Scope R_scope.

(* ---- Instantiation over the reals ---------------------------------- *)

Definition Rcmp (x y : R) : comparison :=
  match total_order_T x y with
  | inleft (left _) => Lt
  | inleft (right _) => Eq
  | inright _ => Gt
  end.

Lemma Rcmp_spec : forall x y, CompSpec eq Rlt x y (Rcmp x y).
Proof.
  intros x y; unfold Rcmp.
  destruct (total_order_T x y) as [[H | H] | H]; constructor; assumption.
Qed.

(* enumerate.ts: sorted[0] - 1, each constant, (sorted[i] + sorted[i+1]) / 2,
   sorted[last] + 1. *)
Definition Rrepresentatives : list R -> list R :=
  representatives R (fun c => c - 1) (fun c => c + 1) (fun a b => (a + b) / 2).

Theorem partition_sound_R : forall cs f g,
  cs <> [] -> StronglySorted Rlt cs ->
  incl (constants R f) cs -> incl (constants R g) cs ->
  (forall r, In r (Rrepresentatives cs) -> eval R Rcmp f r = eval R Rcmp g r) ->
  forall x, eval R Rcmp f x = eval R Rcmp g x.
Proof.
  apply (partition_sound R Rlt Rcmp).
  - exact Rlt_trans.
  - exact Rlt_irrefl.
  - exact Rcmp_spec.
  - intro c; lra.
  - intro c; lra.
  - intros a b H; lra.
Qed.

(* The fact:length_m axis: thresholds 7, 12, 20, 50 and 100 m give the
   eleven representatives the harness reports. *)
Example length_m_representatives :
  Rrepresentatives [7; 12; 20; 50; 100]
  = [6; 7; 19/2; 12; 16; 20; 35; 50; 75; 100; 101].
Proof. unfold Rrepresentatives; simpl; repeat f_equal; lra. Qed.

Print Assumptions partition_sound.
