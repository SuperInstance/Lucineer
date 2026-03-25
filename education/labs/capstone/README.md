# Capstone Project: Design Your Own Mask-Lock Chip

**Duration:** 4 weeks | **Difficulty:** Expert | **Prerequisites:** All labs + certification

## Overview

Design a complete mask-lock inference chip for a real-world application of your choice. This is an open-ended project that demonstrates mastery of the full MLS stack.

## Project Options

### Option A: Medical Device Chip
Design an inference chip for a wearable ECG monitor that detects arrhythmias on-device.
- Constraints: < 100 mW, battery-operated, HIPAA-compliant privacy cascade
- Model: 1M-parameter ternary CNN for ECG classification
- Deliverable: RTL + GDSII + compliance report

### Option B: Smart Home Controller
Design a chip for voice command recognition (wake word + 20 commands).
- Constraints: < 50 mW always-on, < 500 mW active inference
- Model: 5M-parameter ternary RNN/Transformer
- Deliverable: RTL + FPGA demo + power analysis

### Option C: Edge Language Model
Scale TinyLlama to a multi-chip cascade system for longer context.
- Constraints: 4-chip cascade, < 20W total, 2048-token context
- Model: 1.1B-parameter ternary transformer
- Deliverable: RTL + cascade protocol + simulation results

### Option D: Your Own Idea
Propose a novel application. Must be approved by instructor.

## Milestones

### Week 1: Proposal & Architecture
- Application description and requirements
- Block diagram and data flow
- Resource budget (gates, memory, power)
- Risk assessment

### Week 2: Implementation
- RTL design (using MLS building blocks)
- CLAWC compilation pipeline
- Testbench development

### Week 3: Verification & Optimization
- Full simulation with golden model comparison
- Timing closure
- Power optimization
- MLS compliance testing

### Week 4: Presentation & Report
- Technical paper (5-8 pages, IEEE format)
- 15-minute presentation with live demo
- Code review with peers
- Portfolio package assembly

## Deliverables

1. **Design documents**: Architecture spec, block diagrams, timing analysis
2. **RTL source**: All SystemVerilog, fully parameterized
3. **Testbenches**: Self-checking, >95% toggle coverage
4. **CLAWC artifacts**: Generated RTL, GDSII, BOM
5. **Measurements**: Power, performance, accuracy
6. **Technical paper**: IEEE conference format
7. **Presentation**: Slides + live demo recording
8. **Portfolio**: GitHub repo with README, CI passing

## Evaluation

| Criterion | Weight |
|-----------|--------|
| Technical depth | 25% |
| Working implementation | 25% |
| Verification quality | 15% |
| Power/performance results | 15% |
| Documentation & presentation | 10% |
| Innovation / creativity | 10% |

## Past Capstone Examples

- "TernaryBERT-Nano: 10M-param BERT on a USB-C dongle" — Achieved 85% GLUE accuracy at 1.8W
- "PrivacyGuard: Hardware PII filter for hospital networks" — Real-time SSN/MRN redaction at 10 Gbps
- "CascadeGPT: 4-chip TinyLlama with 4096 context" — Coherent generation at 15 tokens/sec, 18W
