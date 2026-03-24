# examples/

Ranch templates. Each template is a pre-configured herd designed for a specific use case.

## Available Templates

| Template | Description |
|---|---|
| `consultancy/` | Business knowledge work — research, analysis, client briefs, strategic synthesis |
| `coder/` | Software development — code generation, review, documentation, and debugging |
| `smart-home/` | IoT and home automation — sensor monitoring, context-aware control, GPIO |
| `websocket/` | WebSocket demonstration — real-time agent communication example |

## Using a Template

Each template has:
- `README.md` — what the template does and example outputs
- `setup.sh` — one command to import the template into your Ranch
- `breed.md` — breeding recipes for evolving the herd over time

```bash
# Example: set up the Coder Ranch
bash examples/coder/setup.sh

# Then open the herd in the web UI
# http://localhost:3000/agent-cells
```

## Creating Your Own Template

1. Build and run a herd in your Ranch for 2+ weeks
2. Export the herd: `bun run scripts/export-herd.ts --herd my-herd --output examples/my-template/`
3. Write a `README.md` describing what the herd does
4. Write a `breed.md` with breeding recipes
5. Submit a PR

Your template will be available to the Ranch community.
