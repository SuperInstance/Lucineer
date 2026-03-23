# Mask-Lock Chip Extraction

The mask-lock/SuperInstance components have been extracted to a standalone repo at:

```
/home/user/mask-lock-chip
```

## What was extracted

- `mask_locked_plan.txt`, `mask_locked_deep_dive.md`, `FPGA_Prototype_Implementation_Guide.md`
- `neuromorphic_architecture_report.md`, `SuperInstance_Executive_Summary.md`, `SuperInstance_Investor_Pitch.md`
- `research/` — all 20 research cycles (thermal, neuromorphic, quantization, IP, competitive intel)
- `thermal_simulation/` — all Python FEA solvers
- `download/` — all execution plans, investment memo, deep research reports (excluding LLN docs)
- `final_delivery/` — all consolidated deliverables
- `public/55_to_10_Planning_Package/`, `public/SuperInstance_ALL_FILES/`, research ZIPs
- `customer_validation_research/`
- `src/app/` pages: manufacturing, rtl-studio, specs, timing-playground, cell-builder, voxel-explorer, math-universe, economics, professional

## What stays in Lucineer

- `src/app/lln-playground/` — LLN educational platform (19 components)
- `src/app/agent-playground/`, `agent-cells/`, `crdt-lab/`, `tile-intelligence/`
- `src/app/music/`, `learning/`, `tabula-rosa/`, `lln-tiles/`, `mist/`
- All LLN API routes (`/api/lln-training`, `/api/lln-game`, `/api/synthesis`, `/api/sim-chat`)
- Prisma schema (LLN user progress, game state)
