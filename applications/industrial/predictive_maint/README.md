# Predictive Maintenance — Local Vibration Analysis

## Overview

A smart battery pack or USB-C dongle attached to industrial equipment that performs real-time vibration analysis using mask-locked ternary models. Detects bearing wear, misalignment, imbalance, and other failure modes before catastrophic failure — without sending machine data to the cloud.

## The Problem

- Unplanned downtime costs manufacturers $50B+/year (Deloitte)
- Cloud-based predictive maintenance exposes proprietary process data
- Factory floor connectivity is unreliable (EMI, shielding, air-gapped networks)
- Existing solutions require $50K+ per machine + annual subscription
- OT/IT convergence creates cybersecurity risk — IoT sensors become attack vectors

## Architecture

```
┌─────────────────────────────────────────────┐
│         Smart Sensor Module                  │
│                                              │
│  ┌──────────┐    ┌─────────────────────┐    │
│  │ 3-axis   │    │ MLS Battery Pack    │    │
│  │ Accel.   │───►│ (8×8 RAU, 8 MHz)   │    │
│  │ (ADXL355)│    │                      │    │
│  │ 4 kHz    │    │  Vibration CNN (5M)  │    │
│  └──────────┘    │  Anomaly det. (2M)   │    │
│                  │                      │    │
│  ┌──────────┐    │  Power: 50 mW active │    │
│  │ Temp     │───►│        5 mW sleep    │    │
│  │ Sensor   │    │                      │    │
│  └──────────┘    │  Battery: 6 months   │    │
│                  │  (sample 1/min)      │    │
│                  └──────────┬──────────┘    │
│                             │ BLE / LoRa    │
└─────────────────────────────┼───────────────┘
                              ▼
                   ┌─────────────────┐
                   │ Gateway / HMI    │
                   │ (alerts only,    │
                   │  no raw data)    │
                   └─────────────────┘
```

## Failure Mode Detection

| Fault | Vibration Signature | Detection Accuracy |
|-------|--------------------|--------------------|
| Bearing inner race | BPFI harmonics at characteristic freq | 94% |
| Bearing outer race | BPFO harmonics | 96% |
| Shaft imbalance | 1× RPM dominant | 98% |
| Misalignment | 2× RPM dominant, axial vibration | 95% |
| Looseness | Multiple harmonics, sub-harmonics | 91% |
| Gear mesh fault | Gear mesh frequency sidebands | 93% |
| Cavitation (pumps) | Broadband high-frequency noise | 89% |
| Electrical fault (motors) | 2× line frequency | 92% |

## Processing Pipeline

```
Accelerometer (4 kHz, 3-axis)
    │
    ▼ 1024-sample window (256ms)
FFT → Power Spectrum (512 bins)
    │
    ▼ On-chip (mask-locked ternary CNN)
Feature extraction → [bearing, balance, alignment, mesh, overall]
    │
    ▼ Anomaly scoring
Health index: 0.0 (failed) → 1.0 (perfect)
    │
    ▼ Trend analysis (on-chip, rolling 30-day window)
RUL estimate: "Bearing replacement needed in ~14 days"
    │
    ▼ Alert decision (on-chip)
    │
    ├─── Normal (health > 0.8): Log only, sleep 60s
    ├─── Warning (0.5-0.8): BLE alert to gateway, sleep 10s
    └─── Critical (< 0.5): LoRa alert + continuous monitoring
```

## Key Properties

| Property | Value |
|----------|-------|
| **Privacy** | Raw vibration data never leaves the sensor — only health scores and alerts |
| **Integrity** | Fault detection model cannot be tampered with (mask-locked) |
| **Security** | No firmware update path — no attack surface for OT network compromise |
| **Battery life** | 6 months at 1 sample/min, 2 weeks at continuous monitoring |
| **Cost** | $49 per sensor (vs $500+ for cloud-connected alternatives) |
| **Connectivity** | BLE 5.0 for alerts, LoRa for long-range (optional) |

## Hardware Specifications

| Parameter | Value |
|-----------|-------|
| Form factor | Smart battery pack (65mm × 40mm × 20mm) |
| Chip | MLS Battery Pack (8×8 RAU) |
| Clock | 8 MHz (active), 32 kHz (sleep) |
| Power | 50 mW active, 5 mW sleep |
| Accelerometer | ADXL355 (3-axis, ±40g, 4 kHz) |
| Temperature | TMP117 (±0.1°C accuracy) |
| Battery | 2× 18650 Li-ion (7000 mAh total) |
| Wireless | BLE 5.0 + LoRa (SX1276) |
| Enclosure | IP67, -40°C to +85°C |
| Mounting | Magnetic base + M8 stud |
| Model | Vibration CNN (5M) + anomaly detector (2M) |

## Deployment

### Step 1: Attach
Magnetic mount to motor housing, pump casing, gearbox, or bearing block. No wiring, no configuration.

### Step 2: Commission
Sensor auto-learns normal vibration baseline over 48 hours. No model training needed — the ternary CNN generalizes across similar equipment classes.

### Step 3: Monitor
Gateway receives BLE health scores and alerts. Dashboard shows fleet health overview. No raw vibration data is transmitted.

### Step 4: Act
When health index drops below threshold, maintenance team receives work order with:
- Suspected fault type (bearing, alignment, etc.)
- Estimated remaining useful life
- Recommended action
- Historical trend chart

## Business Model

| Offering | Price | Recurring |
|----------|-------|-----------|
| Sensor unit (battery pack) | $49 | None |
| Gateway (BLE/LoRa → Ethernet) | $199 | None |
| Dashboard software | $0 | Open-source |
| Fleet package (100 sensors + 5 gateways) | $6,000 | None |
| Custom fault model (per equipment class) | $10K | NRE |
| Enterprise support | — | $5K/year |

**Key differentiator:** No subscription. One-time purchase. The model is in the metal — there is nothing to subscribe to.

## References

- ISO 10816: Mechanical vibration evaluation
- ISO 13373: Condition monitoring of machines
- `reference/form_factors/battery_pack/` — Smart battery reference design
- `reference/form_factors/battery_pack/power_mgmt/bq_compat.sv` — BQ40Z50 compatibility
- `claw/examples/smart_battery.py` — Battery management demo
