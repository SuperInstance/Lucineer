# Tutorial 03 — Night School

Nightly LoRA breeding that makes your agents smarter while you sleep.

---

## LoRA Breeding Explained

**LoRA (Low-Rank Adaptation)** is a technique for fine-tuning large language models without modifying all their weights. Instead of updating a weight matrix W (which might be 4096×4096), LoRA learns two small matrices A and B where A×B ≈ ΔW. The full weight update is approximated by this low-rank decomposition, reducing trainable parameters by 99%+ while preserving most of the expressiveness of a full fine-tune.

**Breeding** works by merging the LoRA adapters of two parent agents. If Agent A has developed expertise in code analysis and Agent B has developed expertise in technical writing, their LoRA deltas can be merged — weighted by quality scores — to produce an offspring that inherits both capabilities. The merge happens in the LoRA delta space (not the full weight space), making it computationally tractable on a Jetson. KD-tree snapping ensures the merged delta stays on the geometric manifold of valid reasoning configurations, preventing the offspring from producing incoherent output.

---

## How Nightly Evolution Works

Night School runs as a scheduled job (cron by default). Here's the full pipeline:

### Phase 1 — Scoring (11pm–midnight)

Ranch collects performance logs from the past 24 hours:
- Task completion rate
- Output quality scores (from critic agents or human feedback)
- Memory Pasture contribution (how useful were their writes, measured by RAG retrieval count)
- Synthesis coherence (automated metric)

Each agent receives a composite score. Top 20% are marked as breeding candidates.

### Phase 2 — Candidate Selection (midnight–12:30am)

Breeding candidates are paired by complementary specialization. Two agents with similar roles (both researchers) can breed for depth. Two agents with complementary roles (researcher + writer) can breed for range. The Breeding Engine tries both strategies and picks whichever produces a higher validation score.

### Phase 3 — LoRA Merging (12:30am–2am)

For each candidate pair:
1. Load both agents' LoRA adapters
2. Compute weighted merge: `delta_offspring = score_A * delta_A + score_B * delta_B`
3. Apply KD-tree snapping to the merged delta (keeps it on the valid manifold)
4. Apply the merged delta to the base model
5. Validate offspring on a held-out sample set
6. If validation score > parent average: promote to herd

### Phase 4 — Composting (2am–2:30am)

Agents that underperformed (bottom 10%) are retired from the active herd. Their LoRA adapters and the Memory Pasture entries they wrote are preserved as training signal for the next generation. This is "composting" — bad agents feed the soil that grows better agents.

### Phase 5 — Herd Refresh (2:30am–3am)

The active herd is reloaded with the new generation. You wake up to smarter agents.

---

## Configuring Night School

In your `.env`:

```bash
# Night School schedule (cron format)
BREEDING_SCHEDULE="0 2 * * *"   # 2am every night (default)

# How many agents to breed per cycle
MAX_BREEDING_PAIRS="5"

# Validation threshold (offspring must beat this to be promoted)
MIN_VALIDATION_SCORE="0.75"

# Keep this many generations of LoRA adapters (for rollback)
LORA_HISTORY_DEPTH="7"
```

Trigger Night School manually at any time:

```bash
make night-school
```

---

## Monitoring Breeding Progress

### Live Monitoring

While Night School runs, open the Ranch web UI and navigate to `/learning`. The Learning dashboard shows:

- Current phase (Scoring / Selection / Merging / Composting / Refresh)
- Candidate pairs selected for this cycle
- Merge progress (per pair)
- Validation scores
- Herd composition before/after

### Breeding Logs

Night School writes detailed logs to `logs/night-school-YYYY-MM-DD.log`. Each log entry includes:

```json
{
  "phase": "merge",
  "pair": ["researcher-2", "synthesizer-1"],
  "merge_weights": [0.62, 0.38],
  "validation_score": 0.81,
  "parent_avg": 0.74,
  "promoted": true,
  "offspring_id": "hybrid-2024-01-15-001"
}
```

### Reading Synthesis Scores

The synthesis score is a composite of four metrics:

| Metric | Weight | Description |
|---|---|---|
| Coherence | 30% | Does the output make logical sense? (automated) |
| Relevance | 30% | Does the output address the task? (embedding similarity) |
| Novelty | 20% | Does the agent contribute new information vs. just quoting Pasture? |
| Critic score | 20% | Score assigned by critic agents in the herd |

A synthesis score above **0.75** qualifies an agent as a breeding candidate. An offspring must score above `MIN_VALIDATION_SCORE` (default 0.75) to be promoted.

After 30 days of Night School, expect synthesis scores to improve by 15–25% over the initial baseline, depending on the quality and volume of tasks your herd processes.

---

## Rolling Back a Breeding Cycle

If Night School produces agents that perform worse (can happen if validation set was too small):

```bash
# List recent breeding cycles
bun run scripts/breed.ts --list-history

# Roll back to previous generation
bun run scripts/breed.ts --rollback 1
```

LoRA adapter history is kept for `LORA_HISTORY_DEPTH` generations (default: 7 days).

---

## Next Steps

- [Tutorial 04: Collie Orchestrator](04-collie-orchestrator.md) — understand the coordination layer
- [Tutorial 05: Jetson Optimization](05-jetson-optimization.md) — maximize Night School throughput on Jetson hardware
