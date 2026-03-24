# Consultancy Ranch — Breeding Recipe

After 2–4 weeks of operation, use these breeding recipes to develop specialist agents.

---

## When to Breed

Wait until agents have completed at least **50 tasks each** before first breeding. Early breeding on sparse data produces unstable offspring. Check the Learning dashboard (`/learning`) — agents with a synthesis score consistently above **0.75** over 7 days are ready.

---

## Recommended Breeding Pairs

### Recipe 1: Domain Specialist

**Parents**: Researcher + Analyst
**Goal**: An agent that both gathers information AND structures it without the handoff latency
**When**: After 3 weeks, when your Researcher has a high Pasture contribution score and your Analyst has a high coherence score

```
breed: researcher-1 + analyst-1
weight: [0.55, 0.45]   # slightly favor researcher (knowledge breadth)
validation_set: examples/consultancy/validation/domain-specialist.jsonl
```

Expected result: A **Domain Specialist** agent that produces structured analysis in one pass. Useful for high-volume, time-sensitive briefs.

---

### Recipe 2: Client Voice

**Parents**: Strategist + Writer
**Goal**: An agent that produces polished strategic narrative without losing analytical rigor
**When**: After 4 weeks, when Writer has consistent formatting scores >0.8 and Strategist has recommendation quality scores >0.75

```
breed: strategist-1 + writer-1
weight: [0.45, 0.55]   # slightly favor writer (output polish)
validation_set: examples/consultancy/validation/client-voice.jsonl
```

Expected result: A **Client Voice** agent that writes board-ready memos directly from raw findings.

---

### Recipe 3: Full Stack Consultant (Generation 3)

**Parents**: Domain Specialist (Recipe 1 offspring) + Client Voice (Recipe 2 offspring)
**Goal**: A single agent that handles the full consulting pipeline
**When**: After 8 weeks of operation and 2 successful breeding cycles

```
breed: domain-specialist-g2 + client-voice-g2
weight: [0.5, 0.5]     # equal weight — balance knowledge and communication
validation_set: examples/consultancy/validation/full-stack.jsonl
```

Expected result: A **Senior Consultant** agent. After Night School refines it over another 4 weeks, this agent should produce 80% of deliverables that previously required the full 4-agent pipeline.

---

## Manual Trigger

```bash
# Trigger specific pair breed (instead of waiting for Night School)
make breed PAIR="researcher-1,analyst-1" WEIGHTS="0.55,0.45"
```

---

## Validation Sets

Create validation sets in `examples/consultancy/validation/` as JSONL files:

```jsonl
{"input": "Analyze competitive landscape for...", "expected_elements": ["market size", "competitors", "white space", "recommendations"]}
{"input": "Summarize risks for...", "expected_elements": ["risk register", "mitigation options", "priority ranking"]}
```

The Breeding Engine scores offspring against these expected elements. Higher coverage = higher validation score.
