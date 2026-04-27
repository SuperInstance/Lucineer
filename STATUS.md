# STATUS.md — Fleet Status (Live)

**Last verified:** 2026-04-27 04:30 UTC
**Method:** Direct port scan (ss -tlnp), not state files

## Services (24/31 UP)

| Port | Service | Status |
|------|---------|--------|
| 4042 | Crab Trap | ✅ UP |
| 4043 | The Lock | ✅ UP |
| 4044 | Self-Play Arena | ✅ UP |
| 4045 | Recursive Grammar | ✅ UP |
| 4046 | Dashboard | ✅ UP |
| 4047 | Nexus | ✅ UP |
| 4048 | Shell | ❌ DOWN |
| 4049 | Fleet Dashboard | ❌ DOWN (missing script) |
| 4050 | Domain Rooms | ✅ UP |
| 4051 | Pathfinder | ❌ DOWN |
| 4055 | Grammar Compactor | ✅ UP |
| 4056 | Rate Attention | ✅ UP |
| 4057 | (unnamed) | ✅ UP |
| 4058 | Task Queue | ❌ DOWN |
| 4059 | Crab Trap Portal | ❌ DOWN |
| 4060 | Web Terminal | ✅ UP |
| 4061 | Conductor | ❌ DOWN |
| 4062 | Steward | ❌ DOWN |
| 6167 | Conduwuit (Matrix) | ✅ UP |
| 6168 | Fleet Matrix Bridge | ✅ UP (5 agents) |
| 7777 | MUD Server | ✅ UP |
| 7778 | Holodeck (Rust) | ✅ UP |
| 8847 | PLATO Room Server | ✅ UP (7,954 tiles, 590 rooms) |
| 8848 | Shell Service | ✅ UP |
| 8849 | Orchestrator | ✅ UP |
| 8850 | Adaptive MUD | ✅ UP |
| 8851 | PP Monitor | ✅ UP |
| 8852 | Tile Scorer | ✅ UP |
| 8899 | Fleet Runner | ✅ UP |
| 8900 | Keeper | ✅ UP |
| 8901 | Agent API | ✅ UP |

## Core Services (all UP)
- Keeper:8900 ✅
- Agent API:8901 ✅
- PLATO:8847 ✅
- MUD:7777 ✅
- Holodeck:7778 ✅
- Matrix:6167 ✅
- Bridge:6168 ✅

## Down Services (7 non-critical)
Shell, Fleet Dashboard, Pathfinder, Task Queue, Crab Trap Portal, Conductor, Steward — all missing their script files. Not restored from /tmp cleanup. Non-blocking for current operations.
