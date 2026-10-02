#!/usr/bin/env python3
"""PreToolUse gate: the conformance suite never runs locally without the user's say-so.

The full walk pegs every core for the better part of an hour. Any Bash command
that would start it, sampled or full, is denied until the user has picked
APPROVE in an AskUserQuestion dialog that mentions "conformance". Each approval
is good for exactly one run: its tool_use id goes in a ledger beside the
transcript and is never honoured twice. A later answer other than APPROVE
withdraws an unspent approval. The approval is spent when this hook allows the
command, so a run refused later (by the permission prompt, say) needs a fresh
ask.

Commands are read as shell, not as text: only a segment that launches the
suite is gated, so grep, git commit -m, pkill and pgrep that merely mention it
pass, as does --help, which only prints the usage. If the command can't be parsed, a plain substring match decides, and a
match is gated. A launch hidden in a script or a variable is not seen.

Fails closed: if the transcript can't be read, the command is denied.
"""
import fcntl
import json
import os
import re
import shlex
import sys
from pathlib import Path

APPROVE = "Run conformance"
SCRIPT = "conformance"  # the package.json script name
RUN_FILE = re.compile(r"(^|/)research/conformance/run(\.[cm]?[jt]s)?$")
SEPARATORS = {"&&", "||", ";", ";;", "|", "|&", "&", "\n", "(", ")"}
WRAPPERS = {"nohup", "nice", "ionice", "timeout", "time", "env", "command", "exec",
            "stdbuf", "setsid", "sudo", "xargs", "npx", "caffeinate"}
PACKAGE_MANAGERS = {"npm", "pnpm", "yarn", "bun"}
LAUNCHERS = {"tsx", "node", "ts-node", "bun", "deno"}
SHELLS = {"sh", "bash", "zsh", "dash"}
ASSIGNMENT = re.compile(r"^\w+=")
WRAPPER_ARG = re.compile(r"^(-.*|\w+=.*|\d+(\.\d+)?[smhd]?)$")  # options, VAR=x, durations
NPM_RUN = {"run", "run-script", "rum", "urn"}
HELP = {"--help", "-h"}
# The local cost has one home, the usage text run.ts prints for --help.
RUN_TS = Path(__file__).resolve().parents[2] / "research" / "conformance" / "run.ts"


def cost_line() -> str:
    try:
        m = re.search(r"^\s*(cost: .*)$", RUN_TS.read_text(), re.M)
    except OSError:
        m = None
    return f"--full {m.group(1)}" if m else "the usage text (--help) states what --full costs"


DENY_REASON = f"""\
The conformance suite is gated; {cost_line()}.
With no flags it runs a sample; --sample=N is cheaper, and --jobs=N lowers
the load of --full. Before running it, call
AskUserQuestion with a question that contains the word "conformance", says
exactly which command you will run, why it is needed now and what it costs,
and offers an option labelled exactly "{APPROVE}" (plus one to skip). If the
user picks "{APPROVE}", retry the same command once. One approval = one run.
If you cannot ask the user (a subagent, a headless run), do not run it: report
that it is needed and stop."""


def deny(reason: str) -> None:
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": reason,
    }}))
    sys.exit(0)


def tokens(command: str) -> list:
    lexer = shlex.shlex(command, posix=True, punctuation_chars="();<>|&\n")
    lexer.whitespace = " \t\r"
    lexer.whitespace_split = True
    return [t.strip("`") for t in lexer]


def segments(toks: list):
    seg = []
    for t in toks:
        if t in SEPARATORS or t.endswith("$"):  # "$" opens a "$(...)" substitution
            if seg:
                yield seg
            seg = []
        else:
            seg.append(t)
    if seg:
        yield seg


def strip_wrappers(argv: list) -> list:
    while argv and (ASSIGNMENT.match(argv[0]) or os.path.basename(argv[0]) in WRAPPERS):
        argv = argv[1:]
        while argv and WRAPPER_ARG.match(argv[0]):
            argv = argv[1:]
    return argv


def launches(command: str) -> bool:
    try:
        toks = tokens(command)
    except ValueError:  # unbalanced quotes: any mention is gated
        return SCRIPT in command
    in_suite_dir = False
    for seg in segments(toks):
        argv = strip_wrappers(seg)
        if not argv or HELP & set(argv):
            continue
        prog = os.path.basename(argv[0])
        args = argv[1:]
        if prog == "cd":
            in_suite_dir = bool(args) and args[0].rstrip("/").endswith("research/conformance")
        elif prog in SHELLS or prog == "eval":
            inner = [a for i, a in enumerate(args) if prog == "eval" or (i and re.match(r"^-\w*c$", args[i - 1]))]
            if any(launches(a) for a in inner):
                return True
        if prog in PACKAGE_MANAGERS and SCRIPT in args:
            if prog != "npm" or NPM_RUN & set(args):
                return True
        if RUN_FILE.search(argv[0]):
            return True
        if prog in LAUNCHERS and any(RUN_FILE.search(a) or (in_suite_dir and re.match(r"^(\./)?run(\.ts)?$", a))
                                     for a in args):
            return True
    return False


def latest_answer(transcript: Path) -> "str | None":
    """The tool_use id of the latest conformance ask, if its answer was APPROVE."""
    asks = set()
    latest = None
    for line in transcript.read_text().splitlines():
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        content = (entry.get("message") or {}).get("content")
        if not isinstance(content, list):
            continue
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "tool_use" and block.get("name") == "AskUserQuestion":
                if SCRIPT in json.dumps(block.get("input", {})).lower():
                    asks.add(block.get("id"))
            elif block.get("type") == "tool_result" and block.get("tool_use_id") in asks:
                answers = (entry.get("toolUseResult") or {}).get("answers") or {}
                approved = not block.get("is_error") and any(
                    a == APPROVE or a == [APPROVE] for a in answers.values())
                latest = block["tool_use_id"] if approved else None
    return latest


def main() -> None:
    event = json.load(sys.stdin)
    command = (event.get("tool_input") or {}).get("command", "")
    if not launches(command):
        sys.exit(0)

    try:
        transcript = Path(event["transcript_path"])
        ledger = transcript.with_suffix(".conformance-approvals")
        with ledger.open("a+") as f:
            fcntl.flock(f, fcntl.LOCK_EX)
            f.seek(0)
            approval = latest_answer(transcript)
            if approval is None or approval in f.read().split():
                approval = None
            else:
                f.write(approval + "\n")
    except Exception as exc:  # fail closed
        deny(f"{DENY_REASON}\n(gate could not read the transcript: {exc})")

    if approval is None:
        deny(DENY_REASON)
    sys.exit(0)


if __name__ == "__main__":
    main()
