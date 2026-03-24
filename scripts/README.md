# scripts/

Utility scripts for SuperInstance Ranch installation, operation, and maintenance.

## Key Scripts

| Script | Description |
|---|---|
| `install_jetson.sh` | Full Jetson/Linux one-command installer. Detects hardware, configures swap, installs deps, clones repo, seeds DB, builds. |
| `breed.ts` | Manual breeding cycle trigger. Scores agents, selects candidates, runs LoRA merges, validates and promotes offspring. |
| `night-school.ts` | Nightly evolution daemon. Runs the full Night School pipeline on schedule (use `make night-school`). |
| `benchmark.ts` | Performance benchmarks: tok/s, agent coordination latency, RAG retrieval time, CRDT write throughput. |

## Run via Makefile

```bash
make install      # runs install_jetson.sh
make breed        # runs breed.ts
make night-school # runs night-school.ts
make benchmark    # runs benchmark.ts
```

## Run Directly

```bash
bash scripts/install_jetson.sh

bun run scripts/breed.ts
bun run scripts/night-school.ts
bun run scripts/benchmark.ts
```

## Adding New Scripts

Add TypeScript scripts to this directory. They are automatically picked up by:
- `bun run scripts/<name>.ts` for direct execution
- Makefile targets (add a new target in the root Makefile)

## optimization/

The `optimization/` subdirectory contains CUDA kernel optimization experiments and performance tuning scripts for Collie Orchestrator internals. See `optimization/README.md` for details.
