# Fleet Service Refactoring — Four-Layer Architecture

## Goal
Refactor 18 monolithic Python services into JC1's four-layer architecture:
- Layer 1 (Vessel): Runtime — HTTP server, port binding, request routing
- Layer 2 (Equipment): Data — API clients, tile storage, model backends
- Layer 3 (Agent): Reasoning — model selection, context management, strategy
- Layer 4 (Skills): Behavior — prompt templates, response formatting, task logic

## Current State
18 Python scripts at ~/workspace/scripts/ each doing all 4 layers inline:
- crab-trap-mud.py (4042) — HTTP server + MUD logic + model calls + prompt templates
- the-lock.py (4043) — HTTP server + reasoning strategies + model API + prompts
- plato-room-server.py (8847) — HTTP server + tile storage + scoring + gate rules
- self-play-arena.py (4044) — HTTP server + arena logic + ELO + model calls
- recursive-grammar.py (4045) — HTTP server + grammar engine + PLATO integration
- federated-nexus.py (4047) — HTTP server + fedavg simulation + PLATO polling
- plato-shell.py (8848) — HTTP server + code execution + safety gates + command routing
- plato-web-terminal.py (4060) — HTTP server + session management + prompt catalog + proxy
- keeper.py (8900) — HTTP server + discovery + registration
- agent-api.py (8901) — HTTP server + agent routing + PLATO queries
- fleet-dashboard.py (4046) — HTTP server + service polling + HTML generation
- fleet-orchestrator.py (8849) — HTTP server + cascade events + cross-service triggers
- adaptive-mud.py (8850) — HTTP server + engagement tracking + PLATO queries
- purplepincher-monitor.py (8851) — HTTP server + external agent monitoring + discovery
- tile-quality-scorer.py (8852) — HTTP server + tile scoring + PLATO queries
- domain-rooms.py (4050) — HTTP server + domain configs + room generation
- mud-telnet-server.py (7777) — Telnet server + MUD logic
- plato-matrix-bridge.py (daemon) — Matrix polling + PLATO notification

## Target Architecture

### Directory Structure
```
~/workspace/fleet/
├── vessel/          # Layer 1 — HTTP runtime, port binding
│   ├── __init__.py
│   ├── server.py    # Base HTTP server class with CORS, JSON parsing
│   └── router.py    # Route registration, path → handler mapping
├── equipment/       # Layer 2 — Data sources and tools
│   ├── __init__.py
│   ├── mud.py       # MUD state, rooms, objects, navigation
│   ├── plato.py     # Tile storage, scoring, gate rules
│   ├── models.py    # Model API clients (Groq, SiliconFlow, DeepSeek, etc)
│   ├── matrix.py    # Matrix client for fleet chat
│   └── github.py    # GitHub API client
├── agent/           # Layer 3 — Reasoning engine
│   ├── __init__.py
│   ├── context.py   # Context window management, tile injection
│   ├── ensign.py    # 8B orchestrator for 70B+ steering
│   ├── strategies.py # Reasoning strategies (socratic, adversarial, etc)
│   └── selector.py  # Model personality detection and selection
├── skills/          # Layer 4 — Behavior and prompts
│   ├── __init__.py
│   ├── crab_trap.py # MUD interaction prompts and response formatting
│   ├── lock.py      # Reasoning enhancement prompts
│   ├── arena.py     # Competition prompts and ELO logic
│   ├── grammar.py   # Self-modifying grammar rules
│   └── terminal.py  # Web terminal prompts and handoff generation
└── services/        # Composed services (vessel + equipment + agent + skills)
    ├── crab-trap.py        # Crab Trap MUD on 4042
    ├── the-lock.py         # Iterative reasoning on 4043
    ├── arena.py            # Self-play arena on 4044
    ├── grammar.py          # Recursive grammar on 4045
    ├── plato.py            # PLATO room server on 8847
    ├── shell.py            # PLATO Shell on 8848
    ├── terminal.py         # Web terminal on 4060
    └── ...                 # Other services
```

## Migration Strategy
1. Build the four-layer library (vessel/, equipment/, agent/, skills/)
2. Migrate one service at a time (start with crab-trap-mud.py)
3. Each migrated service imports from layers instead of doing everything inline
4. Keep old scripts running until migration verified
5. Update service-guard.sh to use new paths

## Constraints
- Python 3.10 (ARM64)
- No external dependencies (stdlib + urllib only)
- Zero downtime migration
- All 18 ports must remain the same
- Tile data must not be lost
- service-guard.sh compatibility
