// Ladder step 3 (cheap): every entry's `cite` must resolve to a paragraph
// in colregs data/rules.json.
//
// Cites look like "23(a)(i)" (one paragraph) or "23(a)(iii)-(iv)" /
// "24(a)(ii)-(iv)" (a range: the suffix after the last shared prefix
// varies, both ends must resolve). rules.json's paragraph keys are exactly
// those dotted/parenthesised paths.

import type { RulesData } from '../../src/types.js';

/** Expand a cite like "23(a)(iii)-(iv)" into ["23(a)(iii)", "23(a)(iv)"],
 * or a plain cite like "23(a)(i)" into itself. */
export function expandCite(cite: string): string[] {
  const dash = cite.indexOf('-');
  if (dash === -1) return [cite];
  const before = cite.slice(0, dash);
  const after = cite.slice(dash + 1);
  // before is "23(a)(iii)"; the range replaces its last parenthesised
  // group with `after`, e.g. "23(a)(iii)-(iv)" -> "23(a)(iv)".
  const lastOpen = before.lastIndexOf('(');
  if (lastOpen === -1) return [cite]; // not a recognised shape; report unresolved
  const prefix = before.slice(0, lastOpen);
  const endCite = after.startsWith('(') ? prefix + after : prefix + '(' + after + ')';
  return [before, endCite];
}

/** Paragraph paths a jurisdiction's resolved skeleton spells (ADR 0020): the
 * `intl` base plus, for a non-`intl` jurisdiction, its own delta paths --
 * the union is enough to check a cite resolves, since a suppressed path is
 * never what an entry in force under that jurisdiction cites. */
function resolvedPaths(rules: RulesData, jurisdiction: string): Set<string> {
  const paths = new Set(Object.keys(rules.paragraphs));
  for (const path of Object.keys(rules.deltas?.[jurisdiction]?.paragraphs ?? {})) {
    paths.add(path);
  }
  return paths;
}

export function unresolvedCite(cite: string, rules: RulesData, jurisdiction: string): string[] {
  const paths = resolvedPaths(rules, jurisdiction);
  return expandCite(cite).filter((c) => !paths.has(c));
}
