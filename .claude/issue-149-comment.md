## Corrective action 1 (hook + guard): proposal, reviewed against this post-mortem

**Ruling (owner, 2026-10-01):** ask before every local conformance run, sampled or full. A later toggle may relax this; it starts strict.

**Shape.** A languette guard, `ask-first`, on the Python engine (#20 there), wired as its first live guard. Each repo lists its expensive commands and their local cost in a config it owns. Colregs lists `npm run conformance` and `tsx research/conformance/run.ts`. The guard refuses the command until an `AskUserQuestion` naming it has been answered "Run conformance". Each approval is spent on one run.

**How it fares against the post-mortem's runs:**

| From the post-mortem | What the guard does | Why # |
|---|---|---|
| Run 2, prescribed by the brief | asks, whatever the brief says | 3 |
| No local cost anywhere in reach | the refusal and the question carry the repo's figure: ~759M records, ~46 min, load ~20 on 16 cores; `--sample=N` and `--jobs=N` named as cheaper forms | 4 |
| Run 3, a repeat after 46 min | the approval is spent, so it asks again | 5 |
| `&` / `nohup` / `timeout` / `npm test && …` | asks; the scanner sees through wrappers, chains and `sh -c` | 3, 5 |
| `pkill -f research/conformance/run.ts` and `pgrep` polling | pass; stopping it must never be gated | 8 |
| `grep`, `git commit -m`, `cat` mentioning it | pass; the languette scanner reads them as text, not a run | (the naive substring hook got this wrong) |

**What it does not cover** (other corrective actions, not this hook):
- Run 1's broken environment and deleted fixtures (why 7): a script-side refusal.
- The sampled default, `nice` and `--jobs` (why 2): script-side.
- Polling instead of reporting (why 6): agent conduct, not a command guard.
- `./x.sh` or `$CMD` hiding the run: a languette known gap, stated in its README.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
