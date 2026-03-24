# Tutorial 01 — Your First Ranch

Understand the core concepts and build a real multi-agent herd.

---

## Ranch Concepts

### The Herd

A **Herd** is a named group of agents that share a Memory Pasture and work toward a common goal. Think of it like a team: each agent has a role, but they all pull from the same knowledge base and contribute to the same output.

```
Herd: "internal-knowledge"
├── alpha-1  (role: researcher)
├── alpha-2  (role: synthesizer)
├── alpha-3  (role: critic)
└── alpha-4  (role: writer)
```

Agents in a herd can see each other's recent outputs via the shared CRDT Pasture. The Collie Orchestrator routes tasks to the best-fit agent based on role, load, and recent performance scores.

### The Pasture

The **Memory Pasture** is a CRDT (Conflict-free Replicated Data Type) store shared by all agents in the herd. It is:

- **Persistent** — survives reboots, stored in Prisma/SQLite
- **Concurrent** — multiple agents write simultaneously without conflicts
- **Indexed** — every entry is RAG-indexed for instant retrieval
- **Versioned** — full history with merge proofs

### Breeding

**Breeding** is how agents evolve. Two high-performing agents can be merged via LoRA weight federation to produce an offspring that inherits the best traits of both. The offspring is validated against held-out samples before being promoted to the active herd.

You can trigger breeding manually (`make breed`) or let **Night School** run it automatically at 2am.

### Night School

**Night School** is the nightly evolution cycle. At the configured time (default: 2am), Ranch:

1. Scores all agents by output quality over the past 24 hours
2. Selects top performers as breeding candidates
3. Runs LoRA merges to produce offspring
4. Validates offspring on held-out samples
5. Promotes winners to the active herd
6. Compostes losers into the Memory Pasture as training signal

---

## Ranch Topology

```
                    ┌─────────────────────────────────────┐
                    │         COLLIE ORCHESTRATOR          │
                    │  (routes tasks, manages lifecycles)  │
                    └────────────┬────────────────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            │                    │                    │
     ┌──────▼──────┐     ┌──────▼──────┐     ┌──────▼──────┐
     │   Agent 1   │     │   Agent 2   │     │   Agent N   │
     │  Researcher │     │ Synthesizer │     │   Writer    │
     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
            │                    │                    │
            └────────────────────┼────────────────────┘
                                 │ reads/writes
                    ┌────────────▼────────────────────────┐
                    │          MEMORY PASTURE              │
                    │   CRDT state + RAG index + SQLite    │
                    └────────────┬────────────────────────┘
                                 │ nightly
                    ┌────────────▼────────────────────────┐
                    │         BREEDING ENGINE              │
                    │   LoRA merge + validation + promote  │
                    └─────────────────────────────────────┘
```

---

## Create Your First Agent Cell

1. Go to http://localhost:3000/agent-cells
2. Click **New Cell** (top right)
3. Fill in the form:
   - **Name**: `researcher-1`
   - **Role**: Researcher
   - **Herd**: Create new → `my-first-ranch`
   - **System prompt**: `You are a research agent. Summarize incoming information clearly and concisely. Always cite your sources from the Memory Pasture.`
4. Click **Create**

Your agent is now alive. It sits in the herd, ready to receive tasks from the Collie.

---

## Connect Agents in a Herd

Add two more agents to `my-first-ranch`:

**Agent 2 — Synthesizer**
- Name: `synthesizer-1`
- Role: Synthesizer
- Herd: `my-first-ranch` (existing)
- Prompt: `You receive summaries from researchers and produce a unified synthesis. Resolve contradictions. Identify gaps. Write in clear prose.`

**Agent 3 — Critic**
- Name: `critic-1`
- Role: Critic
- Herd: `my-first-ranch` (existing)
- Prompt: `You review synthesizer output. Check for logical errors, unsupported claims, and missing nuance. Output a critique and a quality score 0–10.`

Now when you submit a task to the herd, the Collie routes it through the researcher → synthesizer → critic pipeline. The critic's score feeds directly into Night School's breeding selection.

---

## Your First Herd Task

1. Go to **Agent Playground** (http://localhost:3000/agent-playground)
2. Select herd: `my-first-ranch`
3. Enter a task: `What are the key themes in the LLN synthetic dataset?`
4. Click **Run Herd**

Watch the task flow through your agents. Open CRDT Lab in another tab to see memory writes in real time.

---

## Next Steps

- [Tutorial 02: Memory Pasture](02-memory-pasture.md) — understand CRDT memory in depth
- [Tutorial 03: Night School](03-night-school.md) — automate agent evolution
