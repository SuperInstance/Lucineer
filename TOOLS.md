# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## CLI Agents
- **Claude Code** v2.1.100 → `claude` (coding plan active)
- **Crush** v0.56.0 → `crush` (coding plan active)
- **Aider** v0.86.2 → `aider` (DeepSeek API)
  - `aider --model deepseek/deepseek-chat` — fast coding
  - `aider --model deepseek/deepseek-reasoner` — deep reasoning
- All at `/home/ubuntu/.local/bin/` or `/home/ubuntu/.npm-global/bin/`

## z.ai Models (max coding plan)
- `glm-5.1` — expert (me)
- `glm-5-turbo` — runner, daily driver
- `glm-4.7` — good mid-tier
- `glm-4.7-flash` — bulk parallel spray
- ~~glm-4.7-flashx~~ — NOT on plan, don't use

## Scripts
- `scripts/batch.py` — parallel workers (export, descriptions, analyze)
- `scripts/task_worker.py` — single-task CLI for z.ai calls

## GitHub
- SuperInstance / lucineer — token in ~/.bashrc
- Git creds in ~/.git-credentials

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.
