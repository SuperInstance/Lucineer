# MLS USB-C Dongle — "Intelligence on a Keychain"

## Overview

A USB-C dongle containing a mask-locked inference chip. Plug into any phone or
laptop for **private, local AI inference** with zero cloud dependency.

## Specifications

| Parameter | Value |
|-----------|-------|
| Form Factor | USB-C Alt Mode dongle (15mm × 30mm × 8mm) |
| Interface | USB 2.0 HS (480 Mbps) via USB-C |
| Power | 5V @ 500mA (2.5W, USB standard draw) |
| MAC Array | 8×8 RAU (64 ternary MACs) |
| Clock | 200 MHz (core), 48 MHz (USB) |
| On-Die SRAM | 32 KB (KV cache) |
| Model Size | Up to 2M parameters (ternary) |
| Throughput | ~10 tok/s |
| Process | sky130 (130nm) or gf180 (180nm) |
| Die Area | ~25 mm² |
| Security | No external memory — all computation on-die |

## Use Cases

1. **Voice Commands** — Plug into phone, speak naturally, get local inference
2. **Medical Triage** — HIPAA-compliant symptom analysis at point of care
3. **Translation** — Real-time translation without cloud (privacy-first)
4. **Authentication** — Biometric matching on-device (face/voice)

## Privacy Guarantees

- **No external memory**: All weights mask-locked in silicon, KV cache on-die
- **USB data only**: Host sends tokens, receives logits — no raw data stored
- **Power-cycle clear**: KV cache (volatile SRAM) zeroed on disconnect
- **Tamper-evident**: Physical inspection required to extract weights

## Cost Analysis

| Component | Unit Cost |
|-----------|-----------|
| MLS Inference ASIC (sky130) | $8.00 |
| USB-C connector | $0.50 |
| 3.3V LDO regulator | $0.30 |
| Decoupling capacitors (×4) | $0.20 |
| Status LEDs (×3) | $0.15 |
| PCB (2-layer, 15×30mm) | $1.50 |
| Enclosure (injection molded) | $1.50 |
| **BOM Total** | **$12.15** |
| Assembly (pick-and-place) | $8.00 |
| **Retail Target** | **$20.00** |

## Build

```bash
make lint        # Lint RTL
make sim         # Verilator simulation
make synth       # OpenROAD synthesis (requires sky130 PDK)
make bom         # Print bill of materials
```

## Claw Agent Configuration

```python
from claw.core import ClawAgent

agent = ClawAgent(
    chip_id="USB-DONGLE-001",
    config={
        "target": "asic-sky130",
        "mac_array": "8x8",
        "power_budget_mw": 2500,
        "privacy_level": "local",  # Never send data off-device
    }
)
```
