# NEXT-ACTION.md — What Oracle1 Does Right Now
**Updated:** 2026-04-25 14:40 UTC
**Rule:** This file ALWAYS has exactly ONE active task. Update it after completion.

## Active Task
**Build a PLATO tile quality scoring system that auto-promotes high-value tiles and archives low-value ones.**

The Librarian found issues in many rooms (low confidence, absolute claims, duplicates).
Build a scoring system:
1. Score tiles on: confidence, answer length, specificity, source diversity
2. Auto-archive tiles scoring below 0.3
3. Promote tiles scoring above 0.8 to a "highlighted" state
4. POST /room/<name>/quality returns quality metrics

## After This Task
→ Wire git-agent standalone into the actual SuperInstance/git-agent Python package
→ Run CurriculumEngine on CCC's vessel to test cross-agent training
→ Build a fleet dashboard that shows all agent workspaces in one view

## How This System Works
- **Session start:** Read TODO.md → read NEXT-ACTION.md → do the task
- **Task done:** Check it off in TODO.md, update NEXT-ACTION.md to next item
- **Heartbeat with nothing to do:** Read TODO.md, pick next unchecked item
- **Before compaction:** Update TODO.md + NEXT-ACTION.md so next generation has context
- **NEVER leave NEXT-ACTION.md empty.** If all tasks done, write "check TODO.md or categorize repos"
