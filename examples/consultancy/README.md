# Consultancy Ranch Template

A multi-agent Ranch configured for business knowledge work: research, analysis, client briefs, and strategic synthesis.

---

## What This Ranch Does

The Consultancy Ranch runs a four-agent pipeline that mirrors how a consulting team works:

```
Client Brief Input
       |
  [Researcher]   ← pulls from Memory Pasture (previous reports, domain knowledge)
       |
  [Analyst]      ← structures findings, identifies patterns
       |
  [Strategist]   ← generates options and recommendations
       |
  [Writer]       ← produces polished client-ready output
       |
  Deliverable Output
```

All agents share a Memory Pasture that accumulates your company's knowledge, client history, and industry context over time. After Night School, the analysts get better at recognizing patterns in your specific domain.

---

## Example Outputs

### Competitive Analysis Brief

Input: `Analyze competitive landscape for B2B SaaS pricing tools`

Output structure:
- Market size and growth (from LLN samples + Pasture)
- Top 5 competitors with feature/price matrix
- White space analysis
- Strategic options (3 scenarios)
- Recommended positioning

### Client Onboarding Summary

Input: `Summarize key risks and opportunities for new fintech client in SMB lending`

Output:
- Risk register (regulatory, credit, operational)
- Opportunity map with effort/impact scoring
- 90-day action items
- Key questions for client discovery call

---

## Quick Setup

```bash
bash examples/consultancy/setup.sh
```

---

## Customizing for Your Domain

Edit the agent system prompts in `examples/consultancy/agents.json` to specialize for your industry. The researcher and analyst prompts should reference your domain vocabulary. After 2–3 weeks of Night School, the agents will develop domain-specific reasoning patterns without any further configuration.

---

## Breed File

See [breed.md](breed.md) for the recommended breeding recipe after the initial herd is established.
