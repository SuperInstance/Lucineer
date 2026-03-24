# Smart Home Ranch — Breeding Recipe

Evolve your home automation agents into a Home Intelligence system that anticipates your needs.

---

## When to Breed

Smart Home agents need behavioral data before breeding:
- Observer needs at least **2 weeks of sensor data** (so it has seen weekend vs. weekday patterns)
- Controller needs at least **100 decisions logged** (so there's enough action history to evaluate)
- Both should have synthesis scores above **0.65** (lower threshold than knowledge agents — behavioral agents are harder to evaluate)

Check the Learning dashboard (`/learning`) for agent scores.

---

## Recommended Breeding Pairs

### Recipe 1: Pattern Recognizer

**Parents**: Observer + Logger
**Goal**: An agent that both detects patterns AND builds a structured behavioral model of household routines
**When**: After 3 weeks of operation (needs weekend + weekday cycles)

```
breed: observer-1 + logger-1
weight: [0.55, 0.45]   # favor observer (pattern detection is primary)
validation_set: examples/smart-home/validation/pattern-recognizer.jsonl
```

Expected result: **Pattern Recognizer** — instead of just detecting anomalies, this agent maintains a probabilistic model of expected household behavior. Anomaly scores are relative to *your* specific patterns, not generic baselines. False positive rate drops significantly.

---

### Recipe 2: Context Controller

**Parents**: Reasoner + Controller
**Goal**: An agent that reasons about context AND acts, without the two-step handoff
**When**: After 4 weeks, when Controller has a safety compliance rate of 100% (no constraint violations) and Reasoner has high context accuracy

```
breed: reasoner-1 + controller-1
weight: [0.50, 0.50]   # equal weight — both capabilities are core
validation_set: examples/smart-home/validation/context-controller.jsonl
safety_constraints: examples/smart-home/safety.json  # ALWAYS pass safety constraints
```

**Important**: The safety constraints file is always injected into the offspring's system prompt. Breeding cannot remove safety constraints.

Expected result: **Context Controller** — a single agent that interprets sensor context and issues actions in one pass. Latency from sensor event to actuator command drops from ~2s (two-agent handoff) to ~400ms.

---

### Recipe 3: Home Intelligence (Generation 3)

**Parents**: Pattern Recognizer (Recipe 1) + Context Controller (Recipe 2)
**Goal**: A fully anticipatory home automation agent
**When**: After 8 weeks and 2 successful breeding cycles

```
breed: pattern-recognizer-g2 + context-controller-g2
weight: [0.45, 0.55]   # favor context-controller (action quality matters most)
validation_set: examples/smart-home/validation/home-intelligence.jsonl
safety_constraints: examples/smart-home/safety.json
```

Expected result: **Home Intelligence** — anticipates actions before sensors trigger. Sees you typically start brewing coffee at 7am on weekdays; starts pre-heating the kettle at 6:55am. This is the transition from reactive automation to anticipatory intelligence.

---

## Validation Sets for Behavioral Agents

Smart Home validation is harder than text quality evaluation. The key metrics:

- **Safety compliance**: 0 safety constraint violations (hard requirement)
- **Action accuracy**: % of decisions matching your manual override history
- **Anticipation rate**: % of actions taken before you would have triggered them manually
- **False positive rate**: % of actions that turned out to be wrong (you overrode them)

Create validation sets from your Logger's history:

```bash
# Export Logger history as validation set
bun run scripts/export-validation.ts \
  --herd smart-home \
  --agent logger-1 \
  --format smart-home \
  --output examples/smart-home/validation/home-intelligence.jsonl
```

This creates a validation set from your actual household history — the most accurate possible test for your specific home.

---

## Rollback Procedure

If a bred agent starts making bad decisions (wrong room temperature, lights at wrong times):

```bash
# Immediate rollback to previous generation
make breed ROLLBACK=1 HERD=smart-home

# Or pause the Controller entirely while you investigate
# Set CONTROLLER_PAUSED=true in .env, then restart Ranch
```

The Logger agent always records the reasoning chain for each action — inspect logs at `/learning` to understand why the bred agent made a decision.
