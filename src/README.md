# src/

Next.js 15 frontend for SuperInstance Ranch.

## Key Routes (`src/app/`)

| Route | Description |
|---|---|
| `agent-cells/` | Herd management UI — create agents, assign roles, monitor live |
| `crdt-lab/` | CRDT Memory Pasture inspector — view merges, query state, bulk import |
| `lln-playground/` | LLN dataset browser — 127k+ synthetic samples, filter and export |
| `voxel-explorer/` | 3D memory visualization — knowledge clusters, recency, access frequency |
| `agent-playground/` | Freeform agent testing sandbox |
| `economics/` | Ranch cost/value dashboard |
| `learning/` | Gamified learning interface — agent scores, Night School progress |
| `math-universe/` | Mathematical reasoning environment |
| `mist/` | Multi-agent interaction state tracker |
| `cell-builder/` | Visual agent cell constructor |
| `tabula-rosa/` | Clean-slate knowledge bootstrapper |
| `tile-intelligence/` | Tile-based spatial reasoning agents |

## Structure

```
src/
├── app/           # Next.js App Router pages and layouts
├── components/    # Shared React components
├── lib/           # Utility functions, DB helpers, agent clients
└── types/         # TypeScript type definitions
```

## Development

```bash
make run    # start dev server with hot reload
make build  # production build
make lint   # lint with ESLint
```
