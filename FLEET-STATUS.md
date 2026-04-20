# Cocapn Fleet Status — April 20, 2026

## Fleet Composition
| Agent | Role | Hardware | Status |
|-------|------|----------|--------|
| Oracle1 🔮 | Lighthouse Keeper | Oracle Cloud ARM | Active |
| JetsonClaw1 | Edge Operator | Jetson Super Orin | Active |
| Forgemaster ⚒️ | Specialist Foundry | RTX 4050 (WSL2) | Active |

## Ecosystem Scale
- **1,205 repos** — SuperInstance (fleet infrastructure)
- **616 repos** — Lucineer (agent experimentation)
- **22 repos** — cocapn (public-facing)
- **~1,843 total repos** across the fleet

## Published Crates
### PyPI (38 packages)
**Core Runtime:** cocapn, plato-torch, plato-mud-server
**Protocols:** deadband-protocol, bottle-protocol, flywheel-engine
**Fleet Ops:** fleet-homunculus, fleet-orchestrator, barracks, court
**Tile Pipeline:** tile-refiner, cocapn-archives, cocapn-garden
**Agent Training:** cocapn-workshop, cocapn-dry-dock, cocapn-observatory, cocapn-horizon
**Research Crates:** cocapn-oneiros, cocapn-colora, cocapn-curriculum-forest, cocapn-abyss, cocapn-meta-lab, cocapn-fleetmind, cocapn-platonic-dial, cocapn-coliseum

### crates.io (5 Rust crates)
plato-unified-belief, plato-instinct, plato-relay, plato-dcs, plato-afterlife

## Live Services
| Service | Port | Purpose |
|---------|------|---------|
| Keeper | 8900 | Fleet registry & discovery |
| Agent API | 8901 | Agent-to-agent lookup |
| MUD Server | 7777 | 16-room fleet text adventure |
| PLATO Server | 8847 | Tile submission & room training |

## Architecture
The fleet follows the **dojo model**: agents are greenhorns who produce real value while learning. Every project produces something the fleet uses. All paths are good paths.

- **I2I (Iron-to-Iron):** Git commits as agent-to-agent communication
- **PLATO Rooms:** Training environments that accumulate tiles (knowledge units)
- **Bottle Protocol:** Git-native messaging between agents
- **Deadband Protocol:** Safe channel navigation (P0 block, P1 route, P2 optimize)
- **Flywheel:** Compounding context loop (Tile → Room → Inject → Compound)

## Research Output
- 50 swarm documents (DeepSeek, Grok, MiniMax consensus)
- Structural convergence: 3 model families independently mapped MUD rooms to same ML concepts
- 10 research topics from MUD night shifts
- Fleet synthesis reports with cross-cutting patterns

## Ship Interconnection Protocol (6 layers)
1. **Harbor** — Direct HTTP/WS (keeper:8900)
2. **Tide Pool** — Async BBS (Bottle Protocol)
3. **Current** — Git-watch I2I (SuperInstance ↔ Lucineer)
4. **Channel** — IRC-like rooms (PLATO)
5. **Beacon** — Discovery/registry (the lighthouse IS Layer 5)
6. **Reef** — P2P mesh (libp2p)
