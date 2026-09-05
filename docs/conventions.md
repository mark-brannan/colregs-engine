# Conventions

## Ink, pencil, open

Design documents in this project mark each decision with a confidence
level. The level is not a comment on the author's certainty; it is the
**rule for who may change it and on what grounds.** A session reads the
level before it reads the content, and behaves accordingly.

| level | marker | who changes it | on what grounds |
|---|---|---|---|
| **Ink** | none (default in ADRs) | Mark | significant evidence: a counterexample, a verification result, a primary source. A session may argue, citing the evidence. It never edits ink itself. |
| **Pencil** | `✎` | any session | a better idea. Log the change and why. Each pencilled item names what would settle it. |
| **Open** | `?` | anyone proposes | a proposal moves it to pencil |

How to ask a session about them:

- "What's in pencil?" — list them, with what would settle each.
- "Should we change this pencil item?" — give an opinion and change it if
  Mark agrees, or on your own if the doc says the session may.
- "Should we change this ink item?" — answer only with evidence. If there is
  none, say "no evidence to reopen it" and stop.

Ink and pencil are per item, not per document. A document is mostly ink
with pencilled items, or mostly pencil with a few ink anchors; both are
normal. Moving an item from pencil to ink is a decision Mark makes, and it
gets a one-line log entry saying what settled it.
