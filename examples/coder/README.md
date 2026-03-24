# Coder Ranch Template

A multi-agent Ranch for software development: code review, generation, documentation, and debugging.

---

## What This Ranch Does

The Coder Ranch runs a development pipeline with agents that mirror a senior engineering team:

```
Code / Task Input
       |
  [Architect]    ← reviews design, suggests structure, flags anti-patterns
       |
  [Implementer]  ← writes code, follows patterns from Memory Pasture (your codebase)
       |
  [Reviewer]     ← code review: correctness, style, edge cases, security
       |
  [Documenter]   ← generates docstrings, READMEs, and API docs
       |
  Output: Code + Review + Docs
```

The Memory Pasture accumulates your team's codebase, conventions, and architectural decisions. After Night School, the Implementer agent learns your specific patterns, preferred libraries, and naming conventions — producing code that looks like it was written by your team.

---

## Example Outputs

### Code Generation

Input: `Write a rate limiter middleware for our Express API that uses Redis and supports per-user and per-IP limits`

Output:
- Implementation matching your existing middleware patterns (from Pasture)
- Unit tests in your team's preferred test framework
- Inline documentation
- Reviewer feedback (edge cases, error handling notes)

### Code Review

Input: `[paste pull request diff]`

Output:
- Line-by-line review comments (like GitHub review)
- Summary: approved / changes requested / needs discussion
- Security checklist
- Performance notes
- Suggested refactors with code examples

### Documentation Generation

Input: `[paste module/class code]`

Output:
- JSDoc/TSDoc with parameter types and examples
- README section for the module
- API reference in your team's doc format

---

## Quick Setup

```bash
bash examples/coder/setup.sh
```

---

## Loading Your Codebase into the Pasture

After setup, seed the Memory Pasture with your codebase:

1. Go to **CRDT Lab** (http://localhost:3000/crdt-lab)
2. Click **Bulk Import**
3. Select your codebase directory (Ranch will chunk and embed all `.ts`, `.js`, `.py`, `.go` etc. files)
4. Click **Index**

After indexing, the Implementer agent will pull relevant code patterns from the Pasture as context when generating new code.

---

## Breed File

See [breed.md](breed.md) for breeding recipes to develop a Staff Engineer agent.
