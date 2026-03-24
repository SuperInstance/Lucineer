# CLAUDE.md — SuperInstance Ranch (Lucineer)

## Project Overview

SuperInstance Ranch is a self-evolving AI ranch platform for edge hardware (Jetson Orin Nano).
It runs local LLM agents that breed, debate, and synthesize knowledge autonomously — 100% air-gapped, no cloud dependency.

The main user-facing component is the **LLN (Local Learning Network) Playground**, a gamified education platform for AI concepts with multi-age support.

## Tech Stack

- **Runtime**: Next.js 16, React 19, TypeScript 5
- **Package manager**: Bun (not npm/yarn)
- **Styling**: Tailwind CSS 4, shadcn/ui (Radix primitives)
- **State**: Zustand 5, React Query 5
- **Database**: Prisma ORM — SQLite locally (`file:./db/ranch.db`), PostgreSQL for production
- **Build**: Standalone Next.js output (for Jetson deployment)
- **CI**: GitHub Actions (lint → prisma generate → build)

## Key Commands

```sh
bun install              # Install dependencies
bun run dev              # Dev server on port 3000
bun run build            # Production build (standalone)
bun run lint             # ESLint
bunx prisma db push      # Apply schema to DB
bunx prisma generate     # Generate Prisma client
```

Or via Makefile: `make run`, `make build`, `make lint`, `make db-push`, `make breed`, `make night-school`, `make benchmark`.

There are **no tests configured yet** (`make test` is a no-op).

## Project Structure

```
src/
  app/
    page.tsx              # Home page (education features showcase)
    layout.tsx            # Root layout with Navigation/Footer
    globals.css
    api/                  # API routes (lln-training, lln-game, synthesis, sim-chat, agent-think, chat, user-actions, download)
    lln-playground/       # Main feature: dataset browser & synthesis engine (19 components)
    agent-cells/          # Herd management UI
    crdt-lab/             # CRDT memory inspector
    voxel-explorer/       # 3D memory visualization
    agent-playground/     # Freeform agent testing
    learning/             # Gamified learning interface
    mist/                 # Multi-agent state tracker
    tile-intelligence/    # Tile-based reasoning
    tabula-rosa/          # Blank-slate AI training
    math-universe/        # Math reasoning environment
    music/                # MIDI AI playground
    economics/            # Cost/value dashboard
    cell-builder/         # Visual agent constructor
    manufacturing/        # Chip manufacturing specs (mask-lock reference)
    rtl-studio/           # RTL design visualization
    specs/                # Chip specifications
    timing-playground/    # Timing analysis tool
  components/
    ui/                   # shadcn/ui components
    agent/                # Agent-specific components
    Navigation.tsx
    Footer.tsx
  lib/
    db.ts                 # Prisma client singleton
    utils.ts              # Utility functions (cn helper)
  hooks/                  # React hooks
prisma/
  schema.prisma           # DB schema (gamification, achievements, social features)
scripts/
  install_jetson.sh       # One-command Jetson installer
  breed.ts                # Manual LoRA merge cycle
  night-school.ts         # Nightly evolution daemon
  benchmark.ts            # Performance benchmarks
examples/                 # Ranch templates (coder, consultancy, smart-home)
docs/                     # Architecture docs, tutorials (mask-lock chip reference + 6 tutorials)
```

## Environment Setup

```sh
cp .env.example .env      # Then edit values
bun install
bunx prisma db push
bun run dev
```

Key env vars: `DATABASE_URL`, `CUDA_DEVICE`, `RANCH_NAME`, `BREEDING_SCHEDULE`, `NIGHT_SCHOOL_ENABLED`.

## Architecture Notes

- **App Router** — all routes under `src/app/`, no Pages Router
- **Path alias** — `@/` maps to `src/` (configured in tsconfig.json)
- **Standalone output** — `next.config.ts` sets `output: "standalone"` for Jetson deployment
- **Relaxed TypeScript** — `ignoreBuildErrors: true` in next config (builds proceed despite TS errors)
- **API routes** — Next.js route handlers at `src/app/api/*/route.ts`
- **Prisma client** — singleton in `src/lib/db.ts`, import as `import { db } from "@/lib/db"`

## Mask-Lock Chip Context

The `docs/01-07` series documents the mask-lock chip research (systolic arrays, ternary weights, BitNet b1.58 quantization). This research has been **extracted to a separate repo** per `EXTRACTION_NOTES.md`. The docs remain here as reference. Some UI pages (manufacturing, rtl-studio, specs, timing-playground) visualize this research.

## Conventions

- Components use shadcn/ui patterns — check `src/components/ui/` before building custom UI
- Use `cn()` from `@/lib/utils` for conditional class merging
- Bun for all package/script operations (never npm/yarn)
- ESLint 9 flat config
