# MLS Associate Certification

**Level:** Entry | **Prerequisites:** None | **Exam Duration:** 2 hours

## Overview

The MLS Associate certification validates foundational knowledge of mask-lock chip architecture, ternary arithmetic, and the MLS standard. Ideal for students, junior engineers, and anyone entering the field.

## Domains

### Domain 1: Digital Logic Fundamentals (20%)
- Boolean algebra and logic gates
- Sequential vs combinational circuits
- Timing concepts: setup, hold, clock period
- Power: static vs dynamic dissipation

### Domain 2: Ternary Arithmetic (25%)
- Weight encoding: `{-1, 0, +1}` → `{2'b10, 2'b01, 2'b00}`
- Why ternary eliminates multipliers
- Accumulation and sign extension
- Zero-skip optimization

### Domain 3: MLS Architecture (25%)
- RAU (Rotation-Accumulate Unit) operation
- Systolic array organization
- Weight ROM (mask-locked via patterns)
- KV cache for attention

### Domain 4: Inference Pipeline (15%)
- Tokenization → Embedding → Layers → Output
- Attention mechanism basics
- MLP (feedforward) layers
- Autoregressive generation

### Domain 5: Privacy & Security (15%)
- Mask-lock security properties
- Privacy cascade levels (local, edge, cloud)
- Why weights can't be extracted electronically
- Comparison with software-only approaches

## Exam Format

- **60 multiple-choice questions** (4 options each)
- **Passing score:** 72% (43/60)
- **Time limit:** 2 hours
- **Proctored:** Online or in-person

## Sample Questions

**Q1.** What is the 2-bit encoding for weight value 0 in MLS?
- A) 2'b00
- B) 2'b01 ✓
- C) 2'b10
- D) 2'b11

**Q2.** A ternary RAU processes activation +7 with weight -1. The output is:
- A) +7
- B) -7 ✓
- C) 0
- D) +1

**Q3.** Why do mask-lock chips use 0 DSP blocks on FPGA?
- A) DSPs are too expensive
- B) Ternary weights only need mux + inverter, not multipliers ✓
- C) DSPs consume too much power
- D) The FPGA doesn't have DSPs

## Study Resources

- Course: Chip Design 101 (Modules 1-3)
- Labs: Lab 1 (Thermal Sim), Lab 2 (RTL Design)
- Spec: MLS v1.0 Architecture (sections 1-3)
- Reference: `reference/common/mls_common.sv`

## Certification Badge

Upon passing, you receive:
- Digital badge (Credly)
- PDF certificate
- GitHub badge for profile
- Listed on MLS Certified Engineers directory

## Renewal

- Valid for 2 years
- Renew by: passing updated exam OR earning Professional certification
