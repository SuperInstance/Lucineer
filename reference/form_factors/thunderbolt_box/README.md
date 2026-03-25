# MLS Thunderbolt Box — "Desktop AI Co-Processor"

## Overview

An external enclosure containing **4 cascaded MLS chips** connected via
Thunderbolt 4/USB4. Functions like an eGPU, but for privacy-first AI inference.

## Specifications

| Parameter | Value |
|-----------|-------|
| Form Factor | External enclosure (~100mm × 150mm × 25mm) |
| Interface | Thunderbolt 4 / USB4 (40 Gbps) |
| Power | 12V @ 5A (60W external PSU) |
| MAC Array | 4× 64×64 RAU = 16,384 effective MACs |
| Chip-to-Chip | UCIe lanes between MLS chips |
| Clock | 200 MHz per chip |
| Total SRAM | 1 MB (256KB × 4 chips) |
| Model Size | Up to 7B parameters (ternary) |
| Throughput | ~200 tok/s |
| Cooling | Active fan (PWM controlled) |

## Cascade Architecture

```
Thunderbolt Host
       │ (40 Gbps)
       ▼
   ┌──────────────────────────────────────┐
   │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  │
   │  │ Chip 0 │──│ Chip 1 │──│ Chip 2 │──│ Chip 3 │  │
   │  │ L0-L7  │  │ L8-L15 │  │L16-L23 │  │L24-L31 │  │
   │  └────────┘  └────────┘  └────────┘  └────────┘  │
   │         UCIe        UCIe        UCIe              │
   │  Fan + Power Management + Thermal Sensors         │
   └──────────────────────────────────────┘
```

## Cost Analysis

| Component | Unit Cost |
|-----------|-----------|
| MLS Inference ASIC (×4) | $60.00 |
| Thunderbolt controller | $12.00 |
| UCIe bridge (×3) | $9.00 |
| 60W PSU (external) | $8.00 |
| Fan + heatsink | $5.00 |
| PCB (6-layer) | $8.00 |
| Enclosure (aluminum) | $12.00 |
| **BOM Total** | **$114.00** |
| Assembly | $25.00 |
| **Retail Target** | **$199.00** |
