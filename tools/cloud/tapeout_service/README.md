# Tapeout Service — Connect to MPW Shuttles

## Overview

Tapeout Service bridges the gap between GDSII design files and physical silicon. It connects MLS designs to multi-project wafer (MPW) shuttle services, handling DRC/LVS checks, submission formatting, and foundry interface — so you can go from RTL to real chips without a foundry relationship.

## Supported Shuttles

| Shuttle | Foundry | Node | Cost/mm² | Min Area | Turnaround |
|---------|---------|------|----------|----------|------------|
| **Efabless chipIgnite** | SkyWater | 130nm (SKY130) | ~$0 (sponsored) | 10 mm² | 6-9 months |
| **Efabless chipIgnite** | GlobalFoundries | 180nm (GF180) | ~$0 (sponsored) | 10 mm² | 6-9 months |
| **Europractice** | Multiple | 65nm-180nm | $5K-$50K | 1-25 mm² | 4-8 months |
| **MUSE** | TSMC | 28nm-180nm | $10K-$100K | 1-25 mm² | 4-8 months |
| **TinyTapeout** | SkyWater | 130nm | $150/tile | 0.16 mm² | 6-9 months |

## Workflow

```
Your GDSII design
    │
    ▼ Upload to Tapeout Service
┌──────────────────────────────────┐
│  Pre-submission Checks           │
│  1. DRC (Design Rule Check)      │
│  2. LVS (Layout vs Schematic)    │
│  3. Antenna rules                │
│  4. Density checks               │
│  5. ESD compliance               │
│  6. MLS-specific validation      │
└──────────────────┬───────────────┘
                   │ All checks pass
                   ▼
┌──────────────────────────────────┐
│  Shuttle Matching                │
│  - Match die area to shuttle     │
│  - Check schedule compatibility  │
│  - Estimate cost                 │
│  - Recommend shuttle             │
└──────────────────┬───────────────┘
                   │ User confirms
                   ▼
┌──────────────────────────────────┐
│  Submission Prep                 │
│  - Reformat GDSII per foundry    │
│  - Add pad frame (if needed)     │
│  - Generate bond diagram         │
│  - Package documentation         │
└──────────────────┬───────────────┘
                   │ Submit
                   ▼
┌──────────────────────────────────┐
│  Foundry Interface               │
│  - Submit to shuttle program     │
│  - Track fabrication status      │
│  - Coordinate packaging          │
│  - Ship bare die or packaged     │
└──────────────────┬───────────────┘
                   │ 4-9 months
                   ▼
         Physical chips arrive 🎉
```

## API

### POST /v1/tapeout/check

Run pre-submission DRC/LVS checks on your GDSII.

```bash
curl -X POST https://api.clawcloud.dev/v1/tapeout/check \
  -H "Authorization: Bearer $API_KEY" \
  -F "gdsii=@chip.gds" \
  -F "pdk=sky130" \
  -F "top_cell=chip_top"
```

**Response:**
```json
{
  "job_id": "drc_abc123",
  "status": "done",
  "result": {
    "drc": {
      "status": "PASS",
      "violations": 0,
      "warnings": 3,
      "details": [
        {"rule": "met1.width", "count": 0, "status": "PASS"},
        {"rule": "met1.spacing", "count": 0, "status": "PASS"},
        {"rule": "via1.enclosure", "count": 0, "status": "PASS"}
      ]
    },
    "lvs": {
      "status": "PASS",
      "mismatches": 0
    },
    "density": {
      "metal1": 42.3,
      "metal2": 38.7,
      "metal3": 35.1,
      "all_within_spec": true
    },
    "die_area_mm2": 4.2,
    "recommended_shuttles": [
      {
        "name": "Efabless chipIgnite (SKY130)",
        "cost_estimate": "$0 (sponsored)",
        "next_deadline": "2026-06-01",
        "turnaround": "6-9 months"
      },
      {
        "name": "TinyTapeout tt09",
        "cost_estimate": "$150 × 26 tiles = $3,900",
        "next_deadline": "2026-05-15",
        "turnaround": "6 months"
      }
    ]
  }
}
```

### POST /v1/tapeout/submit

Submit design to a shuttle program.

### GET /v1/tapeout/status/{submission_id}

Track fabrication status.

## MLS-Specific Checks

Beyond standard DRC/LVS, the tapeout service validates MLS requirements:

| Check | Description | Requirement |
|-------|-------------|-------------|
| Weight layer integrity | Verify M4/M6 patterns encode valid ternary | No `2'b11` patterns |
| Weight density | Check via pattern density on weight layers | 30-70% density |
| Guard ring | Verify weight layers have guard rings | Tamper resistance |
| No test points | Ensure no probe pads on weight layers | Security |
| Hash verification | Compute weight hash, compare to design intent | Integrity |
| Pad frame | Check I/O pad placement and bonding | Manufacturability |

## Pricing

| Service | Price |
|---------|-------|
| DRC/LVS check | Free (unlimited) |
| Shuttle matching | Free |
| Submission prep (Efabless) | $99 |
| Submission prep (Europractice/MUSE) | $499 |
| Packaging coordination | $299 |
| Full-service tapeout management | $2,499 |

Shuttle fabrication costs are paid directly to the foundry/shuttle program.

## Packaging Options

After fabrication, we coordinate packaging:

| Package | Pins | Cost (100 units) | Use Case |
|---------|------|-------------------|----------|
| Bare die | N/A | $0 | Testing, flip-chip |
| QFN-32 | 32 | $3/unit | USB-C dongle |
| QFN-64 | 64 | $5/unit | M.2 card |
| BGA-256 | 256 | $12/unit | Thunderbolt |
| Chip-on-board | Custom | $2/unit | Battery pack |

## References

- Efabless chipIgnite: https://efabless.com
- TinyTapeout: https://tinytapeout.com
- SkyWater PDK: https://github.com/google/skywater-pdk
- GF180 PDK: https://github.com/google/gf180mcu-pdk
- `compiler/clawc/backend/gdsii_gen.py` — GDSII generation
- `compiler/clawc/backend/pnr_interface.py` — OpenROAD interface
