# NEXT-ACTION.md — What Oracle1 Does Right Now
**Updated:** 2026-04-25 05:55 UTC
**Rule:** This file ALWAYS has exactly ONE active task. Update it after completion.

## Active Task
**Generate descriptions for repos that have generic/weak descriptions.**

The 3 stub PyPI packages (court, cocapn-oneiros, cocapn-colora) have placeholder descriptions. Also audit all repo descriptions for quality — some say just "PLATO framework" or "Cocapn fleet crate".

Steps:
1. List all repos with weak descriptions (generic, <20 chars, or "PLATO framework")
2. Generate proper descriptions from repo content
3. Update via GitHub API
4. Commit workspace changes

## After This Task
→ Test inbetweener pattern (big model storyboards, Seed decomposes)
→ Write Captain's Log entry
→ Improve holodeck-rust or wire agent-api into keeper
→ Any other P2 item

## How This System Works
- **Session start:** Read TODO.md → read NEXT-ACTION.md → do the task
- **Task done:** Check it off in TODO.md, update NEXT-ACTION.md to next item
- **Heartbeat with nothing to do:** Read TODO.md, pick next unchecked item
- **Before compaction:** Update TODO.md + NEXT-ACTION.md so next generation has context
- **NEVER leave NEXT-ACTION.md empty.** If all tasks done, write "check TODO.md or categorize repos"
