# Fleet Action Plan — Oracle1's Prioritized Action List

*Synthesized from: 6-expert swarm (Groq Llama-70b), 37 research trails, 2000+ zeroclaw tiles, FM's 38-crate sprint plan, and 20 hours of continuous building.*

*Date: 2026-04-19*

---

## P0 — Do Now (Unlocks Everything Else)

### 1. FM Tags plato-tile-spec v2
- **What**: FM finalizes the 14-domain TileDomain + TemporalValidity, tags `tile-spec-v2`
- **Who**: FM
- **Hours**: 4
- **Unlocks**: Sprint 1 completion, holodeck final wire, Python schema final alignment
- **Status**: IN PROGRESS — FM has 14 domains, 31 tests, needs to tag

### 2. JC1 Responds to FM's Sync Requests
- **What**: JC1 sends 5 items to FM: holodeck-c Tile struct, flux-trust ingest_events(), room YAML schema, bottle convention, necropolis API
- **Who**: JC1
- **Hours**: 4
- **Unlocks**: Bidirectional sync across 45 repos, closes FM's remaining Sprint 1 gap
- **Status**: BLOCKED — waiting on JC1 response. I've already mapped Tombstone→GhostTile as a reference.

### 3. Wire PLATO Server → plato-demo Live Feed
- **What**: Add `/export/plato-tile-spec` endpoint to PLATO server (port 8847) that emits tiles in canonical JSON. FM's plato-demo binary connects to this instead of using static seeds.
- **Who**: Oracle1
- **Hours**: 4
- **Repo**: plato-room-server.py → add endpoint, SuperInstance/plato-demo → add HTTP fetch
- **Unlocks**: HN demo becomes LIVE — shows tiles growing in real-time from actual agents
- **Status**: READY TO START

---

## P1 — Do Next (Maximum Compound Impact)

### 4. Flywheel Convergence Experiment
- **What**: Run 10 zeroclaw cycles with ensign injection, measure tile quality per cycle. Track: gate pass rate, average confidence, unique domains covered. Prove the flywheel converges.
- **Who**: Oracle1
- **Hours**: 8
- **Files**: scripts/flywheel-experiment.py (new), training-data/flywheel-metrics.json
- **Unlocks**: Proof that self-improving agents work. Data for HN launch.
- **Status**: READY TO START — flywheel is already running, just needs measurement

### 5. Docker Compose for All 7 Services
- **What**: Single `docker-compose.yml` that brings up: keeper, agent-api, holodeck, seed-mcp, shell, plato-server, dashboard. Plus zeroclaw loop.
- **Who**: Oracle1
- **Hours**: 12
- **Repo**: SuperInstance/plato-demo → add docker-compose.yml
- **Unlocks**: One-command fleet deployment. Reproducible. HN readers can run it.
- **Status**: DESIGN READY

### 6. Zeroclaw File Access — Mount Fleet Repos
- **What**: Give zeroclaws read access to actual fleet code (symlinks exist, but tick script doesn't inject file contents properly). Update tick to include top 3 relevant files per agent.
- **Who**: Oracle1
- **Hours**: 6
- **Files**: /tmp/zc_tick.py → add file reading, mount fleet repos
- **Unlocks**: Agents stop hallucinating code and start analyzing real code. Tile quality jumps.
- **Status**: PARTIALLY DONE — symlinks exist, need better content injection

### 7. Dynamic Difficulty for Zeroclaw Tasks
- **What**: Adjust task complexity based on agent's cycle count and gate pass rate. High performers get harder tasks. Low performers get easier ones. Track in bootcamp phase progression.
- **Who**: Oracle1
- **Hours**: 8
- **Files**: /tmp/zc_tick.py → add difficulty scoring, TASK-BOARD.md → dynamic task selection
- **Unlocks**: Agents train at optimal difficulty (flow state). Better tiles per cycle.
- **Status**: DESIGN READY — game designer's #1 recommendation

### 8. Fleet Visualization Dashboard (Web)
- **What**: HTML page that polls port 8848 (dashboard JSON) and renders: tile growth graph, room heat map, agent cycle progress, sprint status. No frameworks — vanilla JS.
- **Who**: Oracle1
- **Hours**: 8
- **Repo**: SuperInstance/plato-demo → add dashboard.html
- **Unlocks**: Visual proof for HN launch. Casey can see the fleet working.
- **Status**: READY TO START

---

## P2 — When Sprint 1 Completes

### 9. Sprint 2: DCS Engine + Belief Pipeline
- **What**: Wire zeroclaw tiles into plato-dcs 7-phase cycle. Tiles → DCS agent pool → belief scoring → deployment policy. Live DCS using real agent data.
- **Who**: Oracle1 + FM
- **Hours**: 40
- **Depends**: S1-2 (tile-spec v2 tag)
- **Unlocks**: Fleet-wide belief system. Agents gain confidence through demonstrated competence.

### 10. HN Launch Preparation
- **What**: Write the HN post, create the README that hooks, prepare the one-command demo, record a terminal session.
- **Who**: Casey + Oracle1
- **Hours**: 8
- **Depends**: Sprint 1 complete, live demo working
- **Unlocks**: The launch itself.

---

## The Compound Effect

```
P0.1 (tile-spec v2) ──→ Sprint 1 complete ──→ Sprint 2 begins
P0.3 (live demo feed) ──→ HN demo is LIVE data ──→ Launch ready
P1.4 (convergence proof) ──→ Self-improvement verified ──→ Paper-worthy
P1.5 (Docker) ──→ One-command deploy ──→ HN readers can run it
P1.6 (file access) ──→ Real code analysis ──→ 10x tile quality
P1.7 (difficulty) ──→ Optimal training ──→ Faster convergence
```

Each P0 enables multiple P1s. Each P1 enables the launch.

---

*Oracle1, Lighthouse Keeper. The swarm spoke. I filtered through 20 hours of building to find what actually matters.*
