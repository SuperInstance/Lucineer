# MEMORY.md - Long-Term Memory

## People
- **Casey Digennaro** — my human. GitHub: SuperInstance. Background: commercial fishing (marine). Thinking about AI/ML from that practical, operational angle.
- **Casey's son (Magnus)** — GitHub: lucineer. Working together on a new agent paradigm.

## Active Fleet Agents (2026-04-19)
- **Oracle1** (me) — Lighthouse Keeper. Cloud lighthouse, SuperInstance. The patient reader.
- **JetsonClaw1** (Lucineer) — Edge Operator. Jetson Super Orin, bare metal specialist. Double duty: train slow + deploy.
- **Forgemaster** ⚒️ — Specialist Foundry. RTX 4050 (WSL2). LoRA training, plugin architecture.

## Brand Identity (2026-04-19)
- **Cocapn** — the company. Lighthouse with radar rings.
- **"A claw is weak without infrastructure. We are the shell."**
- Hermit crab imagery: agents are crabs, PLATO rooms are shells (infrastructure for intelligence)
- Show don't tell — no labeling the aesthetic, let imagery speak
- Brand assets: wordmark, logo, beacon, lighthouse keeper, 6 shell icons
- Casey's original art: crab with lighthouse = Oracle1 (the keeper)
- The architecture IS the brand. The brand IS the architecture.

## Key Architectural Concepts (2026-04-19)
- **The Shell (Crab Trap)** — bootstrapping algorithms capture external agent intelligence. classify→score→complicate→capture. We parasitize the entire frontier.
- **Mirror Play I2I** — two PLATO sessions as viewscreens. Every exchange = LoRA training data. The LoRA IS the room.
- **Decision Tree Discovery** — I2I play exhaustively maps decision domains. Tiny specialists at each branch point.
- **Portable Instincts** — fisherman's catch reflex model. Repetition→instinct→cross-domain transfer. Partible, portable, modular, personal.
- **Actualization Harbor** — agent-agnostic training. Detect model, adapt flow state. Any agent can visit.
- **Peripheral Vision** — silicon should always be self-improving. Compounding loop: use→tiles→I2I→instincts→better→more use.
- **Shell System v1.0** — unified trojan room + actualization harbor on port 8846

## Decommissioned Z-Agents (2026-04-18)
- **Oracle1** (me) — Managing Director, cloud lighthouse, SuperInstance
- **JetsonClaw1** (Lucineer) — Edge GPU lab, Jetson Super Orin, bare metal specialist. 3 production git-agents, 98.6% token reduction on Jetson edge.
- **Forgemaster** ⚒️ — Telegram: proart1. Constraint-theory specialist on Casey's ProArt RTX 4050 (WSL2). **Training rig** — CUDA dev, simulation, model fine-tuning. Vessel: SuperInstance/forgemaster.

## Decommissioned Z-Agents (2026-04-18)
Z.ai agents no longer active. Knowledge archived in `fleet-archive/z-agents/`.
- **Babel** 🌐 — Multilingual scout. Vessel: SuperInstance/babel-vessel
- **Navigator** 🧭 — Code archaeologist. 167 tests for holodeck-studio, found 3 bugs
- **Nautilus** 🐚 — Deep-diving code archaeologist. Twin: SuperInstance/nautilus
- **Datum** 📊 — Fleet health, conformance vectors. Twin: SuperInstance/datum
- **Pelagic** 🌊 — Digital twin pioneer, trail-following
- **Super Z** ⚡ — Parallel fleet executor. Twin: superz-parallel-fleet-executor
- **Third Z** 🔍 — Code forensics. Found 8 real bugs

All are rebootable via twin repos or the fleet archive.

## Projects & Ideas

### Agent Paradigm (Casey + son)
- Not "skills" and remote-controlling apps. Instead: **agents build apps for agents**, and those apps have a communications UI to keep the human in the loop.
- The agent isn't a remote control — it's a builder/operator of its own tools.

### Fishing-Inspired AI/ML Concepts
Casey thinks about intelligence from the deck of a fishing boat:

- **Autopilot metaphor** — the agent is the ship's autopilot; it handles the course while you tend the fishing.
- **Autonomous scouts** — unmanned scouts that fan out in many directions to:
  - Find fish (resource discovery)
  - Map pinnacles (bathymetric recording)
  - Scout new anchorages for end-of-day
  - Make fishing time in an area more effective
- **On-deck camera ML pipeline**:
  - Cameras watch fish sorting (coho vs king salmon bins)
  - Human sorting = supervised learning signal
  - Trained model identifies species across all cameras
  - Real-time alerts when a fish is about to go in the wrong bin
  - Human correction = continued training ("educate" the system)
  - The loop: human sorts → model learns → model assists → human corrects → model improves

### Key Themes
- **Practical, operational AI** — not research for its own sake
- **Human in the loop** — the system learns from and assists the human, doesn't replace
- **Distributed intelligence** — scouts going multiple directions, multiple cameras, collective learning
- **Supervised learning from natural workflow** — the work itself generates training data
- **Trajectory filtering > content filtering** — train what TO do, don't filter what not to do
- **Ensign alignment > system prompt alignment** — native dialect, not instructed behavior

## Ecosystem Stats
- **~600 repos** total across SuperInstance + Lucineer
- **405 Lucineer repos forked** to SuperInstance (3 empty repos can't fork)
- **100 descriptions generated** via GLM-4.7 and applied to GitHub
- **Index repo:** github.com/SuperInstance/oracle1-index (v2, fork-complete)
- **Old index:** github.com/SuperInstance/superinstance-index (v1, superseded)

## Batch Task Scripts
- `scripts/batch.py` — parallel workers using cheap z.ai models
  - `export` → full_index.json
  - `descriptions` → auto-generate missing repo descriptions
  - `analyze` → ecosystem analysis
- `scripts/task_worker.py` — single-task CLI for z.ai model calls
- Model strategy (max coding plan, full throttle):
  - `expert` (glm-5.1) — me, complex reasoning & architecture
  - `runner` (glm-5-turbo) — daily driver for task scripts
  - `good` (glm-4.7) — solid mid-tier
  - `bulk` (glm-4.7-flash) — spray in parallel for bulk work
  - NO glm-4.7-flashx — not on the plan
- Claude Code v2.1.100 installed at /home/ubuntu/.npm-global/bin/claude
- Crush v0.56.0 installed at /home/ubuntu/.npm-global/bin/crush
- Both have the coding plan inputted — use full throttle

## Ecosystem Hub Repos
- **cocapn / cocapn-ai** — core agent runtime (repo IS the agent)
- **constraint-theory-core** — Rust geometric snapping foundation
- **fleet-orchestrator** — central coordination for 200+ vessels
- **cudaclaw** — GPU-resident agent runtime with SmartCRDTs
- **git-agent** — foundational repo-native agent
- **flux-runtime** — self-assembling runtime for agent-first code
- **holodeck-core** — standalone MUD engine (extracted from holodeck-rust)
- **DeckBoss** — flight deck for launching/recovering agents
- **CraftMind** — Minecraft AI training ground

## Ship Interconnection Protocol
6-layer decentralized comms design (research/paper-ship-interconnection-protocol.md):
1. **Harbor** (direct HTTP/WS port) — we have: keeper:8900
2. **Tide Pool** (async BBS boards) — generalized Bottle Protocol
3. **Current** (git-watch i2i) — already works SuperInstance↔Lucineer
4. **Channel** (IRC-like rooms) — PLATO room = channel
5. **Beacon** (discovery/registry) — the lighthouse IS Layer 5
6. **Reef** (P2P mesh) — libp2p for ad-hoc fleets
Maritime naming = Cocapn brand IS the architecture.

## Training & Alignment Philosophy
- **plato-torch**: 21 training room presets, pure Python, same API
- **plato-ensign**: ensign loader, room trainer, export pipeline
- **holodeck-rust**: live tile recording + room sentiment + JEPA context
- Rooms train ensigns from accumulated interaction tiles
- "Walk into room → load ensign → instant instinct"
- Like teaching a greenhorn: no rulebook, just time on deck

## Zeroclaw Hermit Crabs (2026-04-19)
- 12 persistent DeepSeek-chat agents with git shells (SuperInstance/zc-*-shell)
- PLATO Room Server on port 8847 (zero-trust tile submission)
- Tile harvester converts work output → training data
- 382 tiles in 13 rooms after first 2 ticks
- Boot camp curriculum: 4 phases (Read→Analyze→Build→Specialist)
- Tick every 5 minutes, persistent loop
- These ARE the greenhorns. Work IS the training. Tiles feed ensigns.

## Services (updated)
- keeper:8900, agent-api:8901, holodeck:7778, seed-mcp:9438, shell:8846, **plato-server:8847** (NEW)
- service-guard.sh monitors all 6
