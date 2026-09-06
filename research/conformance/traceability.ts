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

export function unresolvedCite(cite: string, rules: RulesData): string[] {
  return expandCite(cite).filter((c) => !(c in rules.paragraphs));
}
