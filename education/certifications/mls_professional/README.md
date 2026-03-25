# MLS Professional Certification

**Level:** Intermediate | **Prerequisites:** MLS Associate | **Exam Duration:** 3 hours

## Overview

The MLS Professional certification validates hands-on ability to design, verify, and deploy mask-lock inference chips. For practicing engineers building production hardware.

## Domains

### Domain 1: RTL Design (25%)
- Parameterized SystemVerilog modules
- Generate blocks for scalable arrays
- Clock domain crossing and reset strategies
- Synthesis-aware coding (no latches, proper FSMs)

### Domain 2: Verification (20%)
- Self-checking testbenches with scoreboards
- SystemVerilog Assertions (SVA)
- Formal verification with SymbiYosys
- Coverage-driven verification (toggle, functional)

### Domain 3: FPGA Implementation (20%)
- Vivado synthesis and implementation flow
- Timing closure strategies (pipelining, retiming)
- Resource optimization (LUT packing, BRAM inference)
- PS-PL communication via AXI

### Domain 4: Compiler & Toolchain (15%)
- CLAWC compilation pipeline
- Model quantization (FP32 → ternary)
- Layer partitioning for multi-chip
- Weight export in MLS format

### Domain 5: System Integration (20%)
- A2A register map and command protocol
- Privacy cascade implementation
- Multi-chip cascade communication
- Power management and thermal monitoring

## Exam Format

- **Part A:** 40 multiple-choice questions (90 min)
- **Part B:** 3 hands-on lab exercises (90 min)
  - Design a parameterized module from spec
  - Debug a failing testbench
  - Analyze timing report and fix critical path
- **Passing score:** 75% overall, minimum 60% per part

## Practical Lab Requirements

Before sitting the exam, candidates must submit:
1. Completed Labs 1-5 with passing results
2. A working FPGA bitstream that runs inference
3. Power measurement report showing < 5W

## Study Resources

- Course: Chip Design 101 (all modules)
- Labs: All 5 labs + at least one capstone option reviewed
- Spec: MLS v1.0 complete specification
- Reference designs: All 5 form factors

## Certification Badge

Upon passing, you receive:
- Professional digital badge (Credly)
- Printed certificate with hologram
- Access to MLS Professional Slack channel
- Eligible to mentor Associate candidates
- Listed as MLS Professional on engineer directory

## Renewal

- Valid for 3 years
- Renew by: 30 CPE credits OR passing updated exam OR earning Fellow certification
