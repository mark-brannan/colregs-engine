// Drives .claude/hooks/conformance-gate.py the way Claude Code does: a
// PreToolUse event on stdin, a transcript on disk, a deny decision on stdout.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HOOK = resolve(dirname(fileURLToPath(import.meta.url)), '../.claude/hooks/conformance-gate.py');
const RUN = 'npm run conformance -- --sample=1000';

type Answer = string | string[];

function transcript(...asks: { question: string; answer: Answer }[]): string {
  const lines = asks.flatMap(({ question, answer }, i) => [
    { message: { role: 'assistant', content: [{ type: 'tool_use', id: `ask${i}`, name: 'AskUserQuestion', input: { questions: [{ question, options: [{ label: 'Run conformance' }, { label: 'Skip' }] }] } }] } },
    {
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: `ask${i}`, content: `Your questions have been answered: "${question}"="${answer}".` }] },
      toolUseResult: { questions: [{ question }], answers: { [question]: answer } },
    },
  ]);
  const path = join(mkdtempSync(join(tmpdir(), 'conformance-gate-')), 'session.jsonl');
  writeFileSync(path, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return path;
}

function allowed(command: string, transcriptPath: string): boolean {
  const run = spawnSync('python3', [HOOK], {
    input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, transcript_path: transcriptPath }),
    encoding: 'utf8',
  });
  expect(run.status, run.stderr).toBe(0);
  return !run.stdout.includes('"deny"');
}

const ASK = 'Run the conformance sample (npm run conformance -- --sample=1000, ~1 min)?';

describe('conformance gate', () => {
  it.each([
    'npm run conformance',
    'npm test && npm run conformance',
    'nohup npm run conformance > walk.log 2>&1 &',
    'timeout 600 npm --silent run conformance',
    'pnpm conformance',
    'npx tsx research/conformance/run.ts --jobs=4',
    'cd research/conformance && tsx run.ts',
    'bash -c "npm run conformance"',
  ])('refuses %s without an approval', (command) => {
    expect(allowed(command, transcript())).toBe(false);
  });

  it.each([
    'grep -n "npm run conformance" AGENTS.md',
    'git commit -m "npm run conformance rewrites findings"',
    'pkill -f research/conformance/run.ts',
    'pgrep -f research/conformance/run.ts',
    'npm test',
  ])('lets %s through, it does not start a run', (command) => {
    expect(allowed(command, '/nonexistent/transcript.jsonl')).toBe(true);
  });

  it('allows one run per approval', () => {
    const path = transcript({ question: ASK, answer: 'Run conformance' });
    expect(allowed(RUN, path)).toBe(true);
    expect(allowed(RUN, path)).toBe(false);
  });

  it.each<[string, Answer]>([
    ['Skip', 'Skip'],
    ['a free-text answer that quotes the label', 'Do not "Run conformance", use the sample'],
    ['a dismissed dialog', '[User dismissed — do not proceed, wait for next instruction]'],
  ])('refuses after %s', (_, answer) => {
    expect(allowed(RUN, transcript({ question: ASK, answer }))).toBe(false);
  });

  it('lets a later Skip withdraw an unspent approval', () => {
    const path = transcript({ question: ASK, answer: 'Run conformance' }, { question: ASK, answer: 'Skip' });
    expect(allowed(RUN, path)).toBe(false);
  });

  it('fails closed when the transcript cannot be read', () => {
    expect(allowed(RUN, '/nonexistent/transcript.jsonl')).toBe(false);
  });
});
