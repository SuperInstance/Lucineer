# Compiler Construction — Building CLAWC Passes

## Overview

A 4-week intensive on building optimization passes for the CLAWC mask-lock
inference compiler. You will add real passes that ship in the compiler.

| | |
|---|---|
| **Duration** | 4 weeks, 12 hours/week |
| **Prerequisites** | Chip Design 101, Python proficiency |
| **Outcome** | Contribute a working pass to the CLAWC compiler |

## Weekly Schedule

### Week 1 — Compiler Architecture
- CLAWC pipeline: frontend → middle-end → backend
- Internal representation (IR): nodes, edges, weights
- The compilation flow: `model.onnx → IR → optimized IR → chip_top.sv`
- **Exercise:** Trace a small model through the full pipeline
- **Reference:** `compiler/clawc/compiler.py`

### Week 2 — Frontend Passes
- ONNX graph ingestion: operators, shapes, weights
- GGUF format: BitNet-specific metadata
- Graph canonicalization: normalize operator names, fuse constants
- **Exercise:** Add TFLite frontend support
- **Reference:** `compiler/clawc/frontend/`

### Week 3 — Middle-End Optimization
- Quantization: FP32 → INT4 → ternary
- The mask-lock pass: converting DRAM weights to ROM constants
- Layer fusion: Conv+ReLU → FusedConvReLU
- Tiling: partitioning large MatMuls for the 256×256 MAC array
- **Exercise:** Write a dead-node elimination pass
- **Reference:** `compiler/clawc/middle_end/`, `compiler/passes/`

### Week 4 — Backend Code Generation
- RTL generation: IR nodes → SystemVerilog modules
- GDSII generation: using gdstk for mask layout
- Target-specific optimization: sky130 vs. FPGA
- **Exercise:** Add a new target (e.g., Intel Cyclone V FPGA)
- **Reference:** `compiler/clawc/backend/`
