# Coder Ranch — Breeding Recipe

Evolve your development agents into a Staff Engineer.

---

## When to Breed

Coder agents need domain exposure before breeding. Wait until:
- Implementer has generated at least **100 code completions** in your codebase
- Reviewer has reviewed at least **50 diffs**
- Both have synthesis scores consistently above **0.70**

Check the Learning dashboard (`/learning`) for scores.

---

## Recommended Breeding Pairs

### Recipe 1: Senior Developer

**Parents**: Implementer + Reviewer
**Goal**: An agent that writes code AND self-reviews in one pass (no separate review step)
**When**: After 3 weeks of operation

```
breed: implementer-1 + reviewer-1
weight: [0.60, 0.40]   # favor implementer (generation is primary)
validation_set: examples/coder/validation/senior-dev.jsonl
```

Expected result: **Senior Developer** — generates code with inline review notes. Catches its own edge cases and security issues. Reduces review turnaround from hours to seconds.

---

### Recipe 2: Tech Lead

**Parents**: Architect + Senior Developer (Recipe 1 offspring)
**Goal**: An agent that handles full feature development from design to implementation
**When**: After 5 weeks and one successful breeding cycle

```
breed: architect-1 + senior-dev-g2
weight: [0.40, 0.60]   # favor senior-dev (implementation focus)
validation_set: examples/coder/validation/tech-lead.jsonl
```

Expected result: **Tech Lead** — given a feature spec, produces architecture notes, implementation, tests, and review comments in a single pass. This is the agent that handles 90% of routine development work.

---

### Recipe 3: Staff Engineer (Generation 3)

**Parents**: Tech Lead (Recipe 2) + Documenter
**Goal**: A fully autonomous development agent that produces production-ready code with docs
**When**: After 8 weeks and 2 successful breeding cycles

```
breed: tech-lead-g3 + documenter-1
weight: [0.70, 0.30]   # favor tech-lead (keep engineering focus)
validation_set: examples/coder/validation/staff-engineer.jsonl
```

Expected result: **Staff Engineer** — production-ready output: code + tests + docs + review comments. Output passes your CI pipeline without human edits >70% of the time (measured against held-out feature tickets).

---

## Validation Sets

Create `.jsonl` validation files for each recipe:

```jsonl
{"input": "Write a Redis rate limiter middleware...", "checks": ["has_types", "has_tests", "no_any", "handles_errors"]}
{"input": "Review this diff: [diff]", "checks": ["identifies_security_issue", "suggests_refactor", "correct_approval"]}
```

Checks are evaluated by the Critic agent in the herd. Higher check coverage = higher validation score.

---

## Language-Specific Tips

The Implementer learns your preferred patterns from the Memory Pasture. To reinforce specific patterns:

1. Go to **CRDT Lab** and add annotated examples manually:
   - `[GOOD PATTERN]` — prefix entries you want the agent to emulate
   - `[AVOID]` — prefix entries you want the agent to avoid

2. These annotations weight the RAG retrieval, making positive patterns more likely to appear in agent context.
