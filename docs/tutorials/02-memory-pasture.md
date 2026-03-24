# Tutorial 02 — Memory Pasture

How agent memory works, why it survives reboots, and how to use it.

---

## CRDT: Conflict-Free State

A **CRDT** (Conflict-free Replicated Data Type) is a mathematical data structure that can be merged with any other instance of itself without conflicts — even if both were modified simultaneously by different agents on different machines.

### Why This Matters for Multi-Agent Systems

In a traditional database, two agents writing to the same field simultaneously causes a conflict. You need locks, transactions, or last-write-wins semantics — all of which introduce either latency (locks) or data loss (last-write-wins).

CRDTs avoid this entirely. The math guarantees that for any two CRDT states A and B:

```
merge(A, B) == merge(B, A)           # commutative
merge(merge(A, B), C) == merge(A, merge(B, C))  # associative
merge(A, A) == A                     # idempotent
```

This means: no matter what order agents write, no matter how many times a merge runs, the final state is always correct. **No locks. No conflicts. No data loss.**

### Ranch CRDT Implementation

The Ranch CRDT Pasture uses a hybrid structure:

- **G-Counter** for monotonic values (agent scores, task counts)
- **LWW-Register** with vector clocks for agent state (last output, current role)
- **OR-Set** for knowledge collections (entries can be added independently, removes are tombstoned)

All CRDT state is persisted to SQLite via Prisma and replicated in-memory for fast reads.

---

## How Memory Pasture Survives Reboots

Every CRDT write is journaled to SQLite in the same transaction. On startup, Ranch replays the journal to reconstruct the full CRDT state. This means:

- **No write-ahead log needed** — SQLite IS the log
- **No separate cache warming** — state loads directly from DB
- **No consistency check on boot** — CRDT semantics guarantee correctness regardless of order

Typical boot time: under 500ms to full CRDT state on a Jetson Orin Nano with 10,000 memory entries.

---

## RAG with the Local Prisma DB

**RAG (Retrieval Augmented Generation)** lets agents query the Memory Pasture before generating output. Instead of relying purely on their trained weights, they retrieve the most relevant stored knowledge and inject it into their context window.

### How Ranch RAG Works

1. Agent receives a task
2. Task is embedded (vector representation)
3. Prisma queries the CRDT store for top-K nearest neighbors by embedding similarity
4. Retrieved entries are prepended to the agent's context
5. Agent generates output conditioned on retrieved knowledge

### Adding to the Memory Pasture

Agents write to the Pasture automatically after each task. You can also add knowledge manually:

1. Go to **CRDT Lab** (http://localhost:3000/crdt-lab)
2. Click **New Entry**
3. Paste any text (documentation, meeting notes, code snippets, research papers)
4. Click **Index**

The entry is embedded, stored in the CRDT, and immediately available to all agents via RAG.

### Querying the Pasture Directly

The CRDT Lab has a query interface:

1. Go to http://localhost:3000/crdt-lab
2. Click **Query Pasture**
3. Enter a natural language query
4. See the top-K matches with similarity scores and provenance

---

## Voxel Explorer Tour

The **Voxel Explorer** (http://localhost:3000/voxel-explorer) is a 3D visualization of your Memory Pasture.

### What You're Looking At

Each **voxel** (3D cube) represents a cluster of semantically related memory entries. The voxels are positioned in 3D space by projecting the high-dimensional embedding space down to 3D using UMAP (Uniform Manifold Approximation and Projection).

**Color encoding:**
- Hot (red/orange) = recently written, high recency score
- Cool (blue/purple) = older entries, lower recency score
- White = very recent (written in last hour)

**Size encoding:**
- Large voxels = frequently accessed (high RAG retrieval count)
- Small voxels = rarely accessed
- Pulsing = currently being written by an active agent

### Navigation

- **Scroll**: zoom in/out
- **Click + drag**: rotate
- **Click voxel**: see all memory entries in that cluster
- **Search bar**: highlight voxels matching a query

### Reading the Visualization

A healthy Ranch shows:
- A few large, hot clusters around your domain topics (high access, recent writes)
- Many small cool voxels at the periphery (historical knowledge, rarely queried)
- Occasional pulsing (live agent writes)

A Ranch with poor memory hygiene shows:
- All voxels roughly equal size (no knowledge specialization)
- All voxels cool (agents not reading their memory — check RAG config)
- Scattered voxels with no clustering (unrelated data, consider curating the Pasture)

---

## Memory Pasture Management

### Pruning Old Entries

In `.env`, set `MAX_PASTURE_SIZE` to limit total entries (default: unlimited). When the limit is reached, entries are pruned by a combination of recency score and access frequency — the least useful memories are composted back into training signal for Night School.

### Exporting for Fine-tuning

From CRDT Lab → **Export** → select format (JSONL for torchtune, CSV for analysis). Exported datasets include embeddings, provenance, and agent attribution.

---

## Next Steps

- [Tutorial 03: Night School](03-night-school.md) — use Memory Pasture data to breed smarter agents
- [Tutorial 04: Collie Orchestrator](04-collie-orchestrator.md) — understand how Collie routes tasks using Pasture state
