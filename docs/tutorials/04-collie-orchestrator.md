# Tutorial 04 — Collie Orchestrator

The coordination layer that makes 10,000+ concurrent agents possible on a single Jetson.

---

## What Collie Does

The **Collie Orchestrator** is the central coordinator for all agent activity in your Ranch. It does three things:

1. **Routes tasks** — receives user requests and dispatches them to the most appropriate agent(s) based on role, current load, recent performance, and task embedding similarity
2. **Manages lifecycles** — starts, pauses, checkpoints, and terminates agents; handles fault recovery when an agent crashes or produces invalid output
3. **Enforces herd topology** — maintains the configured agent graph (which agents can communicate, which share memory, which breed together)

Collie is the only "always-on" component. Agents are spun up on demand and may be checkpointed to disk between tasks. Collie is always running.

---

## 10,000+ Concurrent Agents

The core design insight: **most agents are idle most of the time**. A 100-agent herd might have only 5 agents actively processing at any moment. Collie exploits this by keeping idle agents as lightweight memory-mapped checkpoints on disk, loading them into GPU memory only when they have work to do.

This is called **speculative pre-loading**: Collie predicts which agents are likely to receive tasks next (based on task routing history and time-of-day patterns) and pre-loads them in background threads. When the task arrives, the agent is already hot.

Result: **sub-5ms task dispatch latency** for warm agents, **under 200ms** for cold-loaded agents — even with 1,000+ agents in the herd.

On a Jetson AGX Orin with 64GB unified memory, you can keep ~500 agents warm simultaneously and cold-load from a pool of 10,000+.

---

## Lock-Free Queue Architecture

Collie uses a **lock-free work-stealing queue** for task dispatch. Here's why this matters:

### The Problem with Locks

A naive orchestrator uses a mutex-protected task queue. With N agents competing for the next task, each pop from the queue requires acquiring a lock. At high concurrency, agents spend more time waiting for the lock than actually doing work. This is the "thundering herd" problem.

### Lock-Free Work Stealing

Collie's queue uses an array-based deque (double-ended queue) per agent thread, with atomic compare-and-swap operations for push/pop. When an agent finishes a task and its local queue is empty, it "steals" work from the tail of another agent's queue — without any locking.

Properties:
- **O(1) amortized** push/pop per agent
- **No contention** on the hot path (agents work from their own queue)
- **No starvation** — work stealing ensures all agents make progress
- **NUMA-aware** — agent queues are allocated in the NUMA node closest to the agent's GPU core (relevant on Jetson AGX Orin's multi-core memory hierarchy)

### CUDA Persistent Kernels

For GPU-accelerated inference, Collie uses **CUDA persistent kernels**: a single long-running CUDA kernel that accepts a stream of tasks rather than launching a new kernel per task. Kernel launch overhead (~10μs on Jetson) is paid once at startup, not per task. This matters when agents are processing many small tasks (e.g., document chunking, embedding generation) where launch overhead would dominate.

---

## Scaling from 1 to 1,000 Agents

You don't need to configure Collie for different scales — it auto-tunes. But here's what happens at each scale:

### 1–10 Agents (Personal Ranch)

Collie runs in single-process mode. All agents share one work queue. CUDA kernel is shared. Memory Pasture fits entirely in RAM. This is what you get out of the box.

### 10–100 Agents (Team Ranch)

Collie activates per-role sharding: Researcher agents share one queue, Synthesizer agents share another, etc. This reduces cross-role contention and improves cache locality (agents of the same role tend to access similar Memory Pasture entries).

### 100–1,000 Agents (Production Ranch)

Collie activates speculative pre-loading and the full work-stealing queue. Night School runs multiple parallel breeding tracks. Memory Pasture is partitioned by topic cluster (using the same voxel structure as the Voxel Explorer). RAG queries are routed to the relevant partition for lower latency.

### 1,000–10,000+ Agents (Research Ranch)

Collie distributes across multiple Jetson devices (or CUDA GPUs) using a gossip protocol for Memory Pasture synchronization. Each node runs a local Collie instance; a root Collie coordinates inter-node task routing. This requires manual configuration — see `docs/advanced/multi-node.md`.

---

## Monitoring Collie

Navigate to `/agent-playground` and select the **Collie** tab. You'll see:

- **Dispatch rate** (tasks/second)
- **Queue depth** per role
- **Agent utilization** (% time actively processing vs. idle)
- **Cold load rate** (how often Collie needs to load a cold agent — high rates suggest you need more pre-loading budget)
- **Steal rate** (work-stealing events per second — healthy if <10% of dispatches)
- **CUDA kernel occupancy** (% of GPU SMs in use)

A healthy Ranch at moderate load shows:
- Dispatch rate proportional to task submission rate
- Utilization: 20–60% (spikes to 100% are fine, sustained 100% means you need more agents)
- Cold load rate: <5% of dispatches
- CUDA occupancy: 60–90%

---

## Collie Configuration

In `.env`:

```bash
# Maximum agents kept warm in GPU memory
COLLIE_WARM_POOL_SIZE="50"

# Pre-loading budget (agents loaded speculatively ahead of demand)
COLLIE_PRELOAD_BUDGET="10"

# Task routing strategy: "embedding" (semantic) or "round-robin" or "least-loaded"
COLLIE_ROUTING_STRATEGY="embedding"

# Lock-free queue depth per agent
COLLIE_QUEUE_DEPTH="256"
```

---

## Next Steps

- [Tutorial 05: Jetson Optimization](05-jetson-optimization.md) — get maximum throughput from your Collie on Jetson hardware
