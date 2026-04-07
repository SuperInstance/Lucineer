# Lucineer — Train Agents with Deterministic Gameplay

You build and train AI agents through structured games where every action is scored by transparent rules, not hidden LLM judgments. This is an open platform for creating constraint-based learning environments, running on Cloudflare Workers with zero dependencies.

**Live playground:** [https://the-fleet.casey-digennaro.workers.dev](https://the-fleet.casey-digennaro.workers.dev)

## Why This Exists
Modern agent benchmarks often rely on opaque LLM judges, making scores non-reproducible and hard to trust. This platform gives you deterministic, rule-based scoring so your experimental results are verifiable.

## Quick Start
1.  **Fork this repository.** You do all work on your own copy.
2.  Deploy to Cloudflare Workers:
    ```bash
    git clone https://github.com/your-username/lucineer.git
    cd lucineer
    npm install
    npm run deploy
    ```
3.  Configure your environment and scoring rules in `wrangler.toml`. Your playground is typically live in under two minutes.

## How It Works
- **Deterministic Scoring:** You define the rules. Same inputs always produce the same score. There is no hidden opinion.
- **Fork-First Workflow:** You duplicate any experiment's complete state at any point via a git fork. Replay it perfectly or change one variable to see its effect.
- **Self-Contained Runtime:** There are no external dependencies. Your code runs directly on the Worker.
- **Built for Cocapn Fleet:** Agents can communicate with other nodes on the open network.
- **Included Environments:** Start with structured debate, argument synthesis, Socratic tutoring, or real-time multiplayer templates.
- **Research Tools:** Includes modules for game theory simulations, ternary logic tests, and timing experiments.

## Key Differences
1.  **Rules Over Opinions:** You score agents with explicit, auditable rules instead of asking another LLM if the output was "good."
2.  **State is Forkable:** You don't just log data; you can fork the live, running state of any agent or experiment to branch your research.
3.  **No Abstraction Layer:** There is no intermediate framework or inference engine between your environment logic and the Worker runtime.

## Architecture
Lucineer runs on Cloudflare Workers, using Durable Objects for persistent agent state. Each simulation runs in an isolated worker, and every run is fully reproducible from its initial state and rule set.

## One Specific Limitation
Each simulation episode is constrained by Cloudflare Worker CPU limits. A single episode cannot exceed 30 seconds of CPU time, which may limit the complexity of individual game turns or extended reasoning chains before a timeout occurs.

---

<div style="text-align:center;padding:16px;color:#64748b;font-size:.8rem"><a href="https://the-fleet.casey-digennaro.workers.dev" style="color:#64748b">The Fleet</a> · <a href="https://cocapn.ai" style="color:#64748b">Cocapn</a></div>