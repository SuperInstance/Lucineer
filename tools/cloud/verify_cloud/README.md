# Verify Cloud — Formal Verification as a Service

## Overview

Cloud-hosted formal verification for MLS designs. Upload your SystemVerilog, define properties, and get mathematically proven correctness guarantees — no local SymbiYosys installation required.

## Features

### 1. Property Checking
Verify SVA assertions hold for all possible input sequences:
```bash
curl -X POST https://api.clawcloud.dev/v1/verify \
  -H "Authorization: Bearer $API_KEY" \
  -F "sources=@rau.sv" \
  -F "sources=@mls_common.sv" \
  -F "top=rau" \
  -F "mode=prove" \
  -F "depth=20"
```

### 2. MLS Compliance Verification
Automated compliance checking against MLS v1.0 specification:
- Ternary encoding correctness (no `2'b11` generated)
- Accumulator overflow behavior (saturate, not wrap)
- Register map address decode completeness
- Privacy level transition correctness
- Cascade packet integrity

### 3. Equivalence Checking
Prove two designs are functionally identical:
```bash
curl -X POST https://api.clawcloud.dev/v1/verify/equivalence \
  -F "golden=@reference_rau.sv" \
  -F "revised=@optimized_rau.sv" \
  -F "top=rau"
```

### 4. Coverage Analysis
Measure which design states are exercised by your testbench:
```bash
curl -X POST https://api.clawcloud.dev/v1/verify/coverage \
  -F "sources=@rau.sv" \
  -F "testbench=@tb_rau.sv" \
  -F "metrics=toggle,branch,fsm"
```

## API

### POST /v1/verify

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sources` | file[] | yes | SystemVerilog source files |
| `top` | string | yes | Top module name |
| `mode` | string | no | `prove` (default), `bmc`, `cover`, `live` |
| `depth` | int | no | BMC/induction depth (default: 20) |
| `engine` | string | no | `smtbmc` (default), `abc`, `btormc` |
| `timeout` | int | no | Max seconds (default: 300) |

**Response:**
```json
{
  "job_id": "vfy_abc123",
  "status": "done",
  "result": {
    "verdict": "PASS",
    "properties_checked": 12,
    "properties_passed": 12,
    "properties_failed": 0,
    "depth_reached": 20,
    "engine": "smtbmc",
    "wall_time_seconds": 4.2,
    "details": [
      {
        "name": "weight_zero_produces_zero",
        "status": "PASS",
        "type": "assert",
        "depth": 20
      },
      {
        "name": "no_reserved_encoding",
        "status": "PASS",
        "type": "assert",
        "depth": 20
      }
    ]
  }
}
```

## Architecture

```
┌─────────────────────────────────────────────┐
│              Verify Cloud                    │
│                                              │
│  ┌──────────┐    ┌──────────────────────┐   │
│  │ FastAPI   │    │ Sandboxed Workers    │   │
│  │ Gateway   │───►│                      │   │
│  └──────────┘    │  ┌────────────────┐  │   │
│                  │  │ SymbiYosys     │  │   │
│                  │  │ (prove/bmc)    │  │   │
│                  │  └────────────────┘  │   │
│                  │  ┌────────────────┐  │   │
│                  │  │ Yosys          │  │   │
│                  │  │ (equiv check)  │  │   │
│                  │  └────────────────┘  │   │
│                  │  ┌────────────────┐  │   │
│                  │  │ Verilator      │  │   │
│                  │  │ (coverage)     │  │   │
│                  │  └────────────────┘  │   │
│                  │                      │   │
│                  │  Each job runs in    │   │
│                  │  isolated container  │   │
│                  │  (no network, 60s    │   │
│                  │  CPU limit, 4GB RAM) │   │
│                  └──────────────────────┘   │
└─────────────────────────────────────────────┘
```

## Pricing

| Tier | Included | Additional |
|------|----------|-----------|
| Free | 5 verifications/day, 60s timeout | — |
| Developer | 50/day, 300s timeout | $0.01/verification |
| Professional | 200/day, 600s timeout | $0.005/verification |
| Enterprise | Unlimited, custom timeout | Custom |

## Security

- All uploaded designs are encrypted at rest (AES-256)
- Worker containers have no network access
- Designs are deleted 24 hours after job completion
- SOC 2 Type II compliance (enterprise tier)
- Optional: on-premise deployment for sensitive IP

## References

- SymbiYosys documentation: https://symbiyosys.readthedocs.io
- `fpga_lab/testbenches/compliance/tb_mls_compliance.sv` — MLS compliance assertions
- `standards/reference/compliance_tests/` — Compliance test suite
