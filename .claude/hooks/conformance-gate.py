#!/usr/bin/env python3
"""PreToolUse gate: the conformance suite never runs locally without the user's say-so.

The full walk is heavy enough to stall the whole machine. Any Bash command that
would start it is denied until the user has picked APPROVE in an AskUserQuestion
dialog whose question mentions "conformance". Each approval is good for exactly
one run: its tool_use id is recorded and never honoured twice.

Fails closed: if the transcript can't be read, the command is denied.
"""
import json
import re
import sys
from pathlib import Path

APPROVE = "Run conformance"
PATTERN = re.compile(r"npm\s+run\s+conformance\b|research/conformance/run\b")

DENY_REASON = f"""\
The conformance suite is heavy enough to stall the user's machine and is gated.
Before running it, call AskUserQuestion with a question that contains the word
"conformance", says exactly which command you will run and why it is needed now,
and offers an option labelled exactly "{APPROVE}" (plus one to skip). If the
user picks "{APPROVE}", retry the same command once. One approval = one run."""


def deny(reason: str) -> None:
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": reason,
    }}))
    sys.exit(0)


def text_of(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(text_of(c.get("text", c.get("content", ""))) if isinstance(c, dict) else str(c)
                        for c in content)
    return ""


def latest_unused_approval(transcript: Path, used: set) -> "str | None":
    asks = set()
    approved = None
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
                if "conformance" in json.dumps(block.get("input", {})).lower():
                    asks.add(block.get("id"))
            elif block.get("type") == "tool_result" and block.get("tool_use_id") in asks:
                if not block.get("is_error") and f'"{APPROVE.lower()}"' in text_of(block.get("content")).lower():
                    approved = block["tool_use_id"]
    return approved if approved and approved not in used else None


def main() -> None:
    event = json.load(sys.stdin)
    command = (event.get("tool_input") or {}).get("command", "")
    if not PATTERN.search(command):
        sys.exit(0)

    try:
        transcript = Path(event["transcript_path"])
        ledger = transcript.with_suffix(".conformance-approvals")
        used = set(ledger.read_text().split()) if ledger.exists() else set()
        approval = latest_unused_approval(transcript, used)
    except Exception as exc:  # fail closed
        deny(f"{DENY_REASON}\n(gate could not read the transcript: {exc})")

    if approval is None:
        deny(DENY_REASON)

    with ledger.open("a") as f:
        f.write(approval + "\n")
    sys.exit(0)


if __name__ == "__main__":
    main()
