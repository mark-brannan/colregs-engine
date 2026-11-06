// languette's ask-first guard denies every Bash command in a session whose
// .languette/ask-first.json it cannot read. This keeps a bad edit to that
// list from reaching main: it must parse, and use only the keys the guard
// knows.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Match = { cmd?: unknown; args?: unknown; script?: unknown };
type Command = Record<string, unknown> & { id: string; match: Match[] };
const list: { commands: Command[] } = JSON.parse(readFileSync(".languette/ask-first.json", "utf8"));
const COMMAND_KEYS = new Set(["id", "match", "cost", "approve_label", "cheaper"]);
const nonEmpty = (v: unknown) => typeof v === "string" && v.length > 0;

describe(".languette/ask-first.json", () => {
  it("has only a commands list", () => {
    expect(Object.keys(list)).toEqual(["commands"]);
    expect(Array.isArray(list.commands) && list.commands.length > 0).toBe(true);
  });

  for (const c of list.commands) it(`${c.id} is well formed`, () => {
    for (const k of Object.keys(c)) expect(COMMAND_KEYS).toContain(k);
    for (const k of ["id", "cost", "approve_label"]) expect(nonEmpty(c[k])).toBe(true);
    if ("cheaper" in c) expect(nonEmpty(c.cheaper)).toBe(true);
    expect(Array.isArray(c.match) && c.match.length > 0).toBe(true);
    for (const m of c.match) {
      expect(nonEmpty(m.cmd)).toBe(true);
      expect("args" in m || "script" in m).toBe(true);
    }
  });

  it("gives each command its own approve label", () => {
    const labels = list.commands.map((c) => c.approve_label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
