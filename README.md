# Lucineer - Constraint-Based Agent Learning Environment

A research platform for training AI agents through structured gameplay and pattern recognition. Part of the open Cocapn Fleet protocol for agent runtimes.

You don't just prompt models—you build classrooms for them. Lucineer provides deterministic environments where agents learn through rule-based interactions with clear win conditions and verifiable outcomes. This approach focuses on measuring reasoning capability rather than answer-mimicking.

---

## Purpose

Most agent platforms treat models as black boxes to be prompted or fine-tuned. Lucineer explores an alternative: creating structured environments where agents learn by participating in repeatable games with transparent rules. This enables research into how agents develop consistent judgment and recognize reusable patterns.

---

## Key Features

1. **Deterministic scoring**: Every interaction has verifiable rules, avoiding hidden LLM-as-judge evaluation
2. **Fork-first design**: Experiments, agents, and runs can be duplicated and replayed exactly
3. **Cloudflare Workers runtime**: Deploys without dedicated GPU infrastructure for most workloads
4. **Cocapn Fleet native**: Components communicate using the open fleet protocol
5. **MIT licensed**: No commercial restrictions, telemetry, or vendor lock-in

---

## Current Scope

### Learning Environments
- Debate simulations with multiple formats and personas
- Synthesis engines with combination methods and scoring
- Socratic teaching simulations
- Real-time multiplayer agent interactions

### Research Components
- Thermal dynamics simulations for chip design
- Neuromorphic architecture exploration
- Ternary computing systems research
- Game theory and information theory applications

**Current limitation**: The platform requires manual configuration of game rules and scoring systems—automated environment generation is experimental.

---

## Quick Start

Deploy to Cloudflare Workers:

```bash
git clone https://github.com/your-repo/lucineer.git
cd lucineer
npm install
npm run deploy
```

Configure your environment variables and agent settings in `wrangler.toml`, then access the playground at your worker's URL.

---

## Architecture

Core components are organized as React applications within a Next.js framework, with research modules in separate directories. The system uses Cloudflare Workers for simulation execution and Durable Objects for agent state persistence.

Key directories:
- `/src/app/lln-playground/` - Interactive learning interfaces
- `/research/` - Experimental modules for chip design and theory
- `/thermal_simulation/` - Thermal dynamics modeling

---

## Development

This is an active research project. Contributions are welcome—please fork the repository and submit pull requests. Join discussions in the Cocapn Fleet community for coordination.

---

<div>
  <p>Part of the Cocapn Fleet - open-source agent runtime and fleet protocol</p>
  <p>
    <a href="https://the-fleet.casey-digennaro.workers.dev">The Fleet</a> | 
    <a href="https://cocapn.ai">Cocapn</a>
  </p>
  <p>Attribution: Superinstance & Lucineer (DiGennaro et al.)</p>
</div>