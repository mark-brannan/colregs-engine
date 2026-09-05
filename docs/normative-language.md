# Normative language — how "shall", "may" and friends are used here

Status: **ink**, 2026-09-05. Reviewed and accepted by the maintainer; this is the
standing decision until an ADR supersedes it.

## The decision

Two vocabularies, kept apart on purpose:

1. **Our own requirements** (`docs/requirements.md` in colregs, and any spec
   in this repo) use **MUST / MUST NOT / SHOULD / SHOULD NOT / MAY** in capitals,
   with the meaning given by [RFC 2119] as clarified by [RFC 8174]: only
   the capitalised words carry that meaning. Lower-case "must" or "should" in our prose is
   ordinary English.
2. **The data follows the Convention.** The `modality` field in
   `data/applicability.json` holds a lower-case token derived from the
   Convention's own verb for that paragraph: `shall`, `may`, `shall-not`,
   `shall-if-practicable`, `shall-not-impede`, `conditional`, `exempt`.
   These are *not* RFC 2119 keywords. They are normalised from treaty text,
   and the verbatim paragraph sits next to them in `data/rules.json` so a
   reader can check the token against the words.

So a capitalised MUST is a claim about the package. A lower-case `shall` in
the data is a claim about what COLREGS says. Nothing in the repo maps one
onto the other.

## Where COLREGS will surprise an RFC reader

If you learned obligation words from RFCs, three things about the
Convention are counterintuitive. The data model follows the Convention,
not the RFC, on each.

- **There is no SHOULD tier.** RFC 2119 gives you a recommended-but-waivable
  level. COLREGS uses "should" once in the Rules (8(b); the Annexes are not checked) and
  nowhere defines it as a weaker rank of duty. Instead the Convention
  **softens a duty with a condition on it, not with a weaker verb**:
  "so far as possible", "if the circumstances of the case admit", "if
  practicable". The data carries that as `shall-if-practicable`, a
  qualified obligation, rather than inventing a `should`. One token covers
  several phrasings ("so far as possible", "if the circumstances of the
  case admit"); whether the exact qualifier deserves its own field beside
  `modality` is colregs question Q-31, still open.
- **`may` is a lawful alternative, not an optional extra.** In RFC 2119 a
  MAY is something nobody may depend on. In COLREGS a `may` display, such
  as the Rule 25(b) tricolor, is one of several complete, lawful options.
  Once a vessel chooses it, that choice is exhaustive: the tricolor
  *replaces* the 25(a) lights, it does not add to them. The data keeps every
  lawful option with its own modality and never picks one; `rel:in_lieu_of`
  records the replacement.
- **`shall not impede` is its own kind of duty.** It has no RFC analogue.
  It is weaker than "shall keep out of the way", and Rule 8(f) says the
  other vessel keeps all her own duties too. Where a paragraph's verb is
  "shall not impede" (Rules 9(b), 9(c), 10(i), 10(j)) that is its
  `modality`; the same duty is also recorded as an `effect` on the vessel,
  so a paragraph with a different verb can still impose it (Rule 18(d)(i)).

`shall not` (a prohibition) and `shall` (an obligation) mean what an RFC
reader expects.

## What we defer to, and for what

| Question | Defer to |
|---|---|
| What MUST / SHOULD / MAY mean in our own specs | [RFC 2119], [RFC 8174] |
| What `shall` / `may` / `shall not` mean in the data | The paragraph text in `data/rules.json`; no external standard redefines it |
| Which edition of COLREGS, and which amendments, the data encodes | colregs `docs/adr/0001` and the provenance requirements (`REQ-PROV-*`); this note says nothing about editions |
| How standards bodies read `shall`/`should`/`may`/`can` in their own documents | [ISO/IEC Directives, Part 2], Clause 7. Not adopted here; listed because marine-standards readers will assume it |

The gap between ISO's `should` (a recommendation) and COLREGS's conditional
`shall` is exactly the first surprise above. None of this is legal advice:
the data records what the text says, not how a court would read it.

## For reviewers

A pull request that adds or changes an entry is held to this note. Check:

- the `modality` token matches the paragraph's own verb, and a
  practicability phrase ("so far as possible", "if the circumstances of the
  case admit", "if practicable") becomes `shall-if-practicable`, never a
  new `should`;
- a `may` entry names what it stands in place of with `rel:in_lieu_of`;
- a "shall not impede" paragraph carries the `shall-not-impede` effect,
  whatever its `modality`;
- new prose in `requirements.md` capitalises the RFC keywords it means and
  leaves ordinary "must" and "should" in lower case.

[RFC 2119]: https://www.rfc-editor.org/rfc/rfc2119
[RFC 8174]: https://www.rfc-editor.org/rfc/rfc8174
[ISO/IEC Directives, Part 2]: https://www.iso.org/sites/directives/current/part2/index.xhtml
