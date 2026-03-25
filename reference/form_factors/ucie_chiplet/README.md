# MLS UCIe Chiplet — "Server-Scale Integration"

## Overview

A bare die chiplet implementing the full MLS 256×256 MAC array, designed for
integration into multi-chiplet packages via UCIe (Universal Chiplet
Interconnect Express). Enables server-grade AI inference in heterogeneous
chip packages.

## Specifications

| Parameter | Value |
|-----------|-------|
| Form Factor | Bare die chiplet (5mm × 5mm) |
| Interface | UCIe 1.0 (16 lanes, 32 GT/s) |
| Bandwidth | 64 GB/s die-to-die |
| Power | Supplied by package substrate (0.75V core) |
| MAC Array | 256×256 RAU (65,536 ternary MACs) |
| Clock | 200 MHz |
| Throughput | 13.1 TOPS (ternary) |
| Model Size | Up to 70B parameters (multi-chiplet) |

## Integration

```
┌────────────────────────────────────┐
│  Multi-Chiplet Package             │
│                                    │
│  ┌────────┐  ┌────────┐           │
│  │ CPU    │──│ MLS    │  UCIe     │
│  │ (host) │  │Chiplet │           │
│  └────────┘  └────────┘           │
│       │           │               │
│  ┌────────┐  ┌────────┐           │
│  │ Memory │  │ MLS    │           │
│  │ (HBM)  │  │Chiplet │           │
│  └────────┘  └────────┘           │
│                                    │
│  Package Substrate (organic/Si)    │
└────────────────────────────────────┘
```

## Cost Analysis

| Component | Unit Cost |
|-----------|-----------|
| MLS chiplet die (5mm²) | $5.00 |
| UCIe PHY IP license | $2.00/die |
| Package integration | Varies by substrate |
| **Per-chiplet cost** | **~$7.00** |
