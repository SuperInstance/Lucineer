"""
Compile Cloud — FastAPI Backend

SaaS compilation service: POST /compile {model, target} → GDSII/RTL.
Queue system via Celery + Redis for long-running compilations.
"""

import hashlib
import os
import tempfile
import uuid
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

# ---------- Configuration ----------

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./compile_cloud.db")
ARTIFACT_DIR = os.getenv("ARTIFACT_DIR", "/tmp/clawcloud/artifacts")
MAX_MODEL_SIZE_MB = int(os.getenv("MAX_MODEL_SIZE_MB", "500"))

# ---------- Models ----------


class CompileTarget(str, Enum):
    SIM_VERILATOR = "sim-verilator"
    FPGA_KV260 = "fpga-kv260"
    FPGA_GENESYS2 = "fpga-genesys2"
    FPGA_AWS_F1 = "fpga-aws-f1"
    ASIC_SKY130 = "asic-sky130"
    ASIC_GF180 = "asic-gf180"


class QuantizeMode(str, Enum):
    TERNARY = "ternary"
    INT4 = "int4"
    INT8 = "int8"
    FP16 = "fp16"


class OptimizeMode(str, Enum):
    AREA = "area"
    SPEED = "speed"
    POWER = "power"
    BALANCED = "balanced"


class JobStatus(str, Enum):
    QUEUED = "queued"
    COMPILING = "compiling"
    SYNTHESIZING = "synthesizing"
    ROUTING = "routing"
    BITGEN = "bitgen"
    DONE = "done"
    FAILED = "failed"


class Utilization(BaseModel):
    used: int
    available: int
    percent: float


class UtilizationReport(BaseModel):
    luts: Utilization
    ffs: Utilization
    bram: Utilization
    dsp: Utilization


class TimingReport(BaseModel):
    target_mhz: int
    achieved_mhz: int
    worst_slack_ns: float
    met: bool


class PowerEstimate(BaseModel):
    dynamic_w: float
    static_w: float
    total_w: float


class ModelStats(BaseModel):
    total_params: int
    ternary_size_mb: float
    sparsity: float
    layers: int


class Artifact(BaseModel):
    name: str
    url: str
    size_bytes: int


class CompileResult(BaseModel):
    artifacts: list[Artifact]
    utilization: UtilizationReport
    timing: TimingReport
    power: PowerEstimate
    model_stats: ModelStats


class JobResponse(BaseModel):
    job_id: str
    status: JobStatus
    progress: int
    estimated_seconds: Optional[int] = None
    created_at: str
    result: Optional[CompileResult] = None
    error: Optional[str] = None


class UsageResponse(BaseModel):
    tier: str
    compiles_today: int
    daily_limit: int
    parameters_compiled: int
    parameters_limit: int
    resets_at: str


class AccountTier(str, Enum):
    FREE = "free"
    DEVELOPER = "developer"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"


TIER_LIMITS = {
    AccountTier.FREE: {"daily": 1, "max_params": 100_000_000, "targets": {CompileTarget.SIM_VERILATOR}},
    AccountTier.DEVELOPER: {"daily": 10, "max_params": 1_000_000_000, "targets": {
        CompileTarget.SIM_VERILATOR, CompileTarget.FPGA_KV260,
        CompileTarget.FPGA_GENESYS2, CompileTarget.FPGA_AWS_F1,
    }},
    AccountTier.PROFESSIONAL: {"daily": 50, "max_params": 10_000_000_000, "targets": set(CompileTarget)},
    AccountTier.ENTERPRISE: {"daily": 999_999, "max_params": 999_999_999_999, "targets": set(CompileTarget)},
}


# ---------- In-memory store (replace with PostgreSQL in production) ----------

_jobs: dict[str, JobResponse] = {}
_users: dict[str, dict] = {
    "demo": {"tier": AccountTier.FREE, "compiles_today": 0, "params_compiled": 0},
}


def _get_user(api_key: str) -> dict:
    """Look up user by API key. In production, this queries PostgreSQL."""
    if not api_key or not api_key.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid API key")
    token = api_key.replace("Bearer ", "")
    user = _users.get(token)
    if not user:
        # Auto-create free tier for new keys
        _users[token] = {"tier": AccountTier.FREE, "compiles_today": 0, "params_compiled": 0}
        user = _users[token]
    return user


# ---------- Application ----------

app = FastAPI(
    title="Compile Cloud",
    description="CLAWC compilation as a service — upload ONNX, get RTL/GDSII",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/v1/compile", response_model=JobResponse)
async def submit_compile(
    model: UploadFile = File(...),
    target: CompileTarget = Form(...),
    quantize: QuantizeMode = Form(QuantizeMode.TERNARY),
    mac_array_size: str = Form("auto"),
    clock_mhz: int = Form(0),
    optimize: OptimizeMode = Form(OptimizeMode.BALANCED),
    callback_url: Optional[str] = Form(None),
    authorization: str = Header(...),
):
    """Submit a model for compilation."""
    user = _get_user(authorization)
    tier = user["tier"]
    limits = TIER_LIMITS[tier]

    # Check daily limit
    if user["compiles_today"] >= limits["daily"]:
        raise HTTPException(
            status_code=429,
            detail=f"Daily compile limit reached ({limits['daily']} for {tier.value} tier). "
                   f"Upgrade at https://clawcloud.dev/pricing",
        )

    # Check target access
    if target not in limits["targets"]:
        allowed = ", ".join(t.value for t in limits["targets"])
        raise HTTPException(
            status_code=403,
            detail=f"Target '{target.value}' not available on {tier.value} tier. "
                   f"Allowed targets: {allowed}",
        )

    # Check model size
    content = await model.read()
    size_mb = len(content) / (1024 * 1024)
    if size_mb > MAX_MODEL_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"Model too large ({size_mb:.1f} MB). Maximum: {MAX_MODEL_SIZE_MB} MB",
        )

    # Save model to temp storage
    job_id = f"clw_{uuid.uuid4().hex[:12]}"
    job_dir = Path(ARTIFACT_DIR) / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    model_path = job_dir / model.filename
    model_path.write_bytes(content)

    # Estimate compile time based on model size
    estimated_seconds = max(30, int(size_mb * 3))

    # Create job record
    now = datetime.now(timezone.utc).isoformat()
    job = JobResponse(
        job_id=job_id,
        status=JobStatus.QUEUED,
        progress=0,
        estimated_seconds=estimated_seconds,
        created_at=now,
    )
    _jobs[job_id] = job

    # Update usage
    user["compiles_today"] += 1

    # In production: submit to Celery task queue
    # compile_task.delay(job_id, str(model_path), target, quantize, mac_array_size, clock_mhz, optimize)

    return job


@app.get("/v1/jobs/{job_id}", response_model=JobResponse)
async def get_job_status(job_id: str, authorization: str = Header(...)):
    """Get compilation job status."""
    _get_user(authorization)

    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found")

    return job


@app.get("/v1/artifacts/{job_id}/{filename}")
async def download_artifact(job_id: str, filename: str, authorization: str = Header(...)):
    """Download a compilation artifact."""
    _get_user(authorization)

    artifact_path = Path(ARTIFACT_DIR) / job_id / filename
    if not artifact_path.exists():
        raise HTTPException(status_code=404, detail=f"Artifact '{filename}' not found")

    return FileResponse(str(artifact_path), filename=filename)


@app.get("/v1/usage", response_model=UsageResponse)
async def get_usage(authorization: str = Header(...)):
    """Get account usage and quota."""
    user = _get_user(authorization)
    tier = user["tier"]
    limits = TIER_LIMITS[tier]

    # Calculate reset time (next midnight UTC)
    now = datetime.now(timezone.utc)
    tomorrow = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if tomorrow <= now:
        from datetime import timedelta
        tomorrow += timedelta(days=1)

    return UsageResponse(
        tier=tier.value,
        compiles_today=user["compiles_today"],
        daily_limit=limits["daily"],
        parameters_compiled=user["params_compiled"],
        parameters_limit=limits["max_params"],
        resets_at=tomorrow.isoformat(),
    )


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "service": "compile-cloud", "version": "1.0.0"}


# ---------- Celery Task (production) ----------

# In production, this runs as a separate Celery worker process:
#
# from celery import Celery
# celery_app = Celery("compile_cloud", broker=REDIS_URL)
#
# @celery_app.task(bind=True)
# def compile_task(self, job_id, model_path, target, quantize, mac_array_size, clock_mhz, optimize):
#     """Run CLAWC compilation as a background task."""
#     from compiler.clawc.compiler import ClawCompiler, CompilerConfig
#
#     # Update status: compiling
#     _jobs[job_id].status = JobStatus.COMPILING
#     _jobs[job_id].progress = 10
#
#     config = CompilerConfig(
#         target=target,
#         quantization=quantize,
#         mac_array_size=mac_array_size,
#         clock_mhz=clock_mhz,
#         optimization=optimize,
#     )
#
#     compiler = ClawCompiler(config)
#     result = compiler.compile(model_path, output_dir=f"{ARTIFACT_DIR}/{job_id}")
#
#     # Update job with results
#     _jobs[job_id].status = JobStatus.DONE
#     _jobs[job_id].progress = 100
#     _jobs[job_id].result = result
