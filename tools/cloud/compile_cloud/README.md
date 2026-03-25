# Compile Cloud — SaaS Compilation Service

## Overview

Compile Cloud provides CLAWC compilation as a REST API service. Upload an ONNX model, specify a target, and receive synthesized RTL, GDSII, and programming files. No local EDA tools required.

## API

### Base URL
```
https://api.clawcloud.dev/v1
```

### Authentication
```
Authorization: Bearer <api_key>
```

### Endpoints

#### POST /compile

Submit a compilation job.

**Request:**
```bash
curl -X POST https://api.clawcloud.dev/v1/compile \
  -H "Authorization: Bearer $API_KEY" \
  -F "model=@model.onnx" \
  -F "target=fpga-kv260" \
  -F "quantize=ternary" \
  -F "mac_array_size=32x32" \
  -F "clock_mhz=200"
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `model` | file | yes | — | ONNX, GGUF, or TorchScript model file |
| `target` | string | yes | — | `fpga-kv260`, `fpga-genesys2`, `asic-sky130`, `asic-gf180`, `sim-verilator` |
| `quantize` | string | no | `ternary` | `ternary`, `int4`, `int8`, `fp16` |
| `mac_array_size` | string | no | auto | `8x8`, `16x16`, `32x32`, `64x64`, `256x256` |
| `clock_mhz` | int | no | auto | Target clock frequency |
| `optimize` | string | no | `balanced` | `area`, `speed`, `power`, `balanced` |
| `callback_url` | string | no | — | Webhook URL for completion notification |

**Response:**
```json
{
  "job_id": "clw_abc123def456",
  "status": "queued",
  "progress": 0,
  "estimated_seconds": 180,
  "created_at": "2026-03-25T10:30:00Z"
}
```

#### GET /jobs/{job_id}

Poll job status.

**Response:**
```json
{
  "job_id": "clw_abc123def456",
  "status": "done",
  "progress": 100,
  "result": {
    "artifacts": [
      {"name": "chip_top.sv", "url": "/v1/artifacts/clw_abc123def456/chip_top.sv", "size_bytes": 45200},
      {"name": "weight_rom.sv", "url": "/v1/artifacts/clw_abc123def456/weight_rom.sv", "size_bytes": 128000},
      {"name": "weights.mem", "url": "/v1/artifacts/clw_abc123def456/weights.mem", "size_bytes": 512000},
      {"name": "chip.gds", "url": "/v1/artifacts/clw_abc123def456/chip.gds", "size_bytes": 2400000},
      {"name": "scheduling.json", "url": "/v1/artifacts/clw_abc123def456/scheduling.json", "size_bytes": 1200},
      {"name": "bom.json", "url": "/v1/artifacts/clw_abc123def456/bom.json", "size_bytes": 800}
    ],
    "utilization": {
      "luts": {"used": 45200, "available": 117120, "percent": 38.6},
      "ffs": {"used": 30100, "available": 234240, "percent": 12.8},
      "bram": {"used": 80, "available": 144, "percent": 55.6},
      "dsp": {"used": 0, "available": 1248, "percent": 0.0}
    },
    "timing": {
      "target_mhz": 200,
      "achieved_mhz": 210,
      "worst_slack_ns": 0.24,
      "met": true
    },
    "power": {
      "dynamic_w": 1.8,
      "static_w": 0.4,
      "total_w": 2.2
    },
    "model_stats": {
      "total_params": 25000000,
      "ternary_size_mb": 4.94,
      "sparsity": 0.61,
      "layers": 25
    }
  }
}
```

#### GET /artifacts/{job_id}/{filename}

Download a compilation artifact.

#### GET /usage

Get account usage and quota.

**Response:**
```json
{
  "tier": "free",
  "compiles_today": 0,
  "daily_limit": 1,
  "parameters_compiled": 0,
  "parameters_limit": 100000000,
  "resets_at": "2026-03-26T00:00:00Z"
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Compile Cloud                         │
│                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐  │
│  │ FastAPI   │    │ Redis    │    │ Celery Workers   │  │
│  │ Gateway   │───►│ Queue    │───►│ (n × GPU nodes)  │  │
│  │ (auth,    │    │          │    │                   │  │
│  │  rate     │    │          │    │ ┌──────────────┐ │  │
│  │  limit)   │    │          │    │ │ CLAWC        │ │  │
│  └──────────┘    └──────────┘    │ │ Compiler     │ │  │
│       │                          │ └──────┬───────┘ │  │
│       │                          │        │          │  │
│  ┌────▼─────┐                    │ ┌──────▼───────┐ │  │
│  │ PostgreSQL│                    │ │ Yosys/Vivado │ │  │
│  │ (jobs,    │                    │ │ (synthesis)  │ │  │
│  │  users,   │                    │ └──────┬───────┘ │  │
│  │  billing) │                    │        │          │  │
│  └──────────┘                    │ ┌──────▼───────┐ │  │
│                                  │ │ OpenROAD     │ │  │
│  ┌──────────┐                    │ │ (PnR, GDSII) │ │  │
│  │ R2/S3    │◄───────────────────│ └──────────────┘ │  │
│  │ (artifact │                    └──────────────────┘  │
│  │  storage) │                                          │
│  └──────────┘                                          │
└─────────────────────────────────────────────────────────┘
```

## Pricing

| Tier | Price | Daily Compiles | Max Params | Targets |
|------|-------|---------------|------------|---------|
| **Free** | $0 | 1 | 100M | sim-verilator only |
| **Developer** | $29/mo | 10 | 1B | All FPGA targets |
| **Professional** | $99/mo | 50 | 10B | All targets + ASIC |
| **Enterprise** | Custom | Unlimited | Unlimited | Dedicated workers + SLA |

**Per-compilation pricing** (above tier limits):
- Open-source models (public repo): **Free** (any tier)
- Proprietary models: **$0.01 per million parameters**

### Open Source Benefit

If your model repository is public on GitHub, compilations are free regardless of tier. We verify by checking the `model` file hash against public model registries (HuggingFace, ONNX Model Zoo).

## Self-Hosted

For air-gapped or on-premise deployments:

```bash
# Docker Compose deployment
git clone https://github.com/superinstance/lucineer.git
cd lucineer/tools/cloud/compile_cloud

# Configure
cp .env.example .env
# Edit .env: DATABASE_URL, REDIS_URL, S3_BUCKET, etc.

# Deploy
docker compose up -d

# Scale workers
docker compose up -d --scale worker=4
```

## References

- `compiler/clawc/` — CLAWC compiler (backend for this service)
- `tools/clawstudio/synthesis/cloud_client.ts` — VS Code client
- FastAPI documentation: https://fastapi.tiangolo.com
