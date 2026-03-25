# MLS Battery Pack — "Power Bank with Privacy"

## Overview

A standard power bank with an embedded MLS inference chip. Combines battery
management (BQ40Z50-compatible) with on-device ML for anomaly detection,
predictive maintenance, and privacy-filtered telemetry.

## Specifications

| Parameter | Value |
|-----------|-------|
| Form Factor | Standard power bank PCB (~70mm × 110mm) |
| Battery | 4S Li-ion (14.8V nominal, 10000 mAh) |
| Interface | USB-C PD (5V/9V/12V/20V) |
| Power | Self-powered from battery cells |
| MAC Array | 8×8 RAU (ultra-low-power) |
| Clock | 32 kHz sleep / 8 MHz active (duty-cycled) |
| Standby Power | <10 μA (32 kHz mode) |
| Active Power | ~50 mW (8 MHz inference burst) |
| Process | sky130 (integrated into battery gauge IC) |

## Features

1. **ML Anomaly Detection** — Predict battery failures before they happen
2. **Predictive Maintenance** — Estimate remaining useful life
3. **Smart Charging** — Adapt charge profile based on usage patterns
4. **Privacy Telemetry** — Only aggregate stats leave device (no usage patterns)
5. **BQ40Z50 Compatible** — Drop-in replacement for TI fuel gauge

## Privacy Guarantees

- Raw voltage curves, current profiles, and usage patterns stay on-device
- Only coarse aggregate statistics sent via USB (SoC%, health%, fault flags)
- No location data, no charge timestamps, no usage patterns
- ML inference runs entirely on-die

## Cost Analysis

| Component | Unit Cost |
|-----------|-----------|
| MLS Battery Gauge IC | $4.00 |
| 4S Li-ion cells (10Ah) | $15.00 |
| USB-C PD controller | $2.50 |
| Protection MOSFET | $1.00 |
| PCB + passives | $3.00 |
| Enclosure | $4.00 |
| **BOM Total** | **$29.50** |
| Assembly | $8.00 |
| **Retail Target** | **$49.00** |
