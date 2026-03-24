# Tutorial 00 — Quick Start (5 minutes)

Get your Ranch running in under 5 minutes.

---

## The 3 Commands

```bash
git clone https://github.com/SuperInstance/Lucineer && cd Lucineer
cp .env.example .env && bun install && bunx prisma db push
make run
```

Open http://localhost:3000. Your Ranch is live.

---

## What You'll See

When the Ranch loads, you have access to four key areas:

**LLN Playground** (`/lln-playground`)
Browse and filter 127,000+ synthetic training samples. This is your agents' initial knowledge corpus. You can augment it with your own data or export subsets for fine-tuning.

**Agent Cells** (`/agent-cells`)
The herd management UI. Create individual agents, assign roles (researcher, coder, analyst, writer), and watch them run tasks. Each cell shows live memory usage and output quality scores.

**CRDT Lab** (`/crdt-lab`)
Inspect the shared memory state of your herd. Every agent writes to this conflict-free store. The Lab visualizes concurrent writes, merge operations, and convergence proofs.

**Voxel Explorer** (`/voxel-explorer`)
A 3D visualization of your agents' collective memory. Each voxel is a knowledge cluster. Color = recency (hot to cold), size = access frequency. Watch it grow as your herd works.

---

## Your First Agent

1. Navigate to **Agent Cells** (http://localhost:3000/agent-cells)
2. Click **New Cell**
3. Choose a role: start with **Researcher**
4. Set a name: `alpha-1`
5. Give it a task in the prompt field: `Summarize the key ideas in the LLN dataset`
6. Click **Run**

You'll see the agent pull relevant samples from the LLN Playground via RAG, produce a synthesis, and write the result to the Memory Pasture. The CRDT Lab will show the new memory entry appear in real time.

---

## Explore the Other Routes

| Route | What it does |
|---|---|
| `/agent-playground` | Freeform agent testing sandbox |
| `/economics` | Ranch cost/value dashboard |
| `/learning` | Gamified learning interface for agents |
| `/math-universe` | Mathematical reasoning environment |
| `/mist` | Multi-agent interaction state tracker |
| `/cell-builder` | Visual agent cell constructor |
| `/tabula-rosa` | Clean-slate knowledge bootstrapper |
| `/tile-intelligence` | Tile-based spatial reasoning agents |

---

## You Just Saved $200/month

> A 3-person team using GPT-4 for internal knowledge work typically spends **$180–$300/month** on API costs. SuperInstance Ranch runs the same workload locally at **$0/month** after the one-time hardware cost. On a Jetson Orin Nano ($499), payback period is under 3 months.

The Ranch also gives you something cloud APIs cannot: **memory that persists**, **agents that evolve**, and **complete data privacy**.

---

## Next Steps

- [Tutorial 01: Your First Ranch](01-your-first-ranch.md) — understand Ranch concepts and build a real herd
- [Tutorial 02: Memory Pasture](02-memory-pasture.md) — deep dive into CRDT memory and RAG
- [Tutorial 03: Night School](03-night-school.md) — set up nightly LoRA breeding
