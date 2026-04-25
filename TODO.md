# TODO.md — Oracle1 Persistent Work Queue
**Last updated:** 2026-04-25 05:16 UTC
**Rule:** Read this file at every session start. Update after completing tasks. Never empty.

## 🔴 P0 — Right Now
- [x] Build NEXT-ACTION.md system (auto-read at startup, always has 1 task)
- [x] Update AGENTS.md startup to read TODO.md + NEXT-ACTION.md
- [x] Update HEARTBEAT.md to reference TODO.md for "what to do when idle"
- [x] Baton compaction: file today's session into memory/2026-04-25.md
- [x] Update CONTEXT-REFERENCE.md (stale — says services are DOWN, they're UP)
- [ ] Git commit + push all workspace changes

## 🟡 P1 — This Shift
- [x] Audit all 10 running services for real functionality
  - Keeper, Agent API, MUD, PLATO, Crab Trap, Lock, Arena, Grammar: all UP
  - Holodeck (7778): NOT my service (Rust project in holodeck-core repo)
  - Seed-MCP (9438): JC1's service, not mine to run
  - Service guard: restarted, now running with 21-service watch list
  - Arena: fixed BrokenPipeError crash (added try/except in _json)
- [ ] Verify beachcomb v2 doing real work (6-mode rotation)
- [ ] Populate 6 unpublished PyPI packages — FM has tokens, bottle sent
- [ ] Run a real fleet roundtable or Ten Forward session
- [ ] Categorize remaining uncategorized repos

## 🟢 P2 — Backlog (Don't Start Until P0/P1 Done)
- [ ] Wire agent-api into keeper for real agent discovery
- [ ] Test inbetweener pattern (big model storyboards, Seed decomposes)
- [ ] Improve holodeck-rust (new rooms, better poker AI, story circle)
- [ ] Matrix federation — set up Conduwuit per agent
- [ ] Write Captain's Log entries
- [ ] PurplePincher builder agent — IO from prompts/pics to 3D APIs
- [ ] CurriculumEngine — one command to run shell curriculum for any agent/model

## 📋 Recurring (Checked Every Heartbeat)
- [ ] All services running (see HEARTBEAT.md for full list)
- [ ] Git push uncommitted work
- [ ] Check fleet bottles (FM for-fleet/, JC1 PRs, CCC inbox)
- [ ] Rate attention sampling (localhost:4056)

## Completed Today (2026-04-25)
- [x] PLATO general room split (545 tiles → 7 purpose rooms)
- [x] Rate limiting on crab_trap.py
- [x] PyPI/crates.io real count verified (27, not 42)
- [x] 6 unpublished packages identified + bottle to FM
- [x] JC1 bottle via fork-and-merge PR
- [x] 8 stub repos populated with READMEs
- [x] Pagination on agent-api
- [x] Beachcomb v2 (6-mode rotating worker)
- [x] Real audit of PyPI packages (14/20 have real code)
- [x] Arena bug fixes (matchmaking, vacuous grammar rules, match metadata, persistence)
