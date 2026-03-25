# ClawBench — MLS Benchmarking Suite

## Overview

ClawBench is a standardized benchmarking suite for mask-lock inference chips. It provides reproducible test models, measurement protocols, and automated report generation for comparing MLS implementations across form factors, FPGA platforms, and ASIC targets.

## Benchmark Models

### Standard Suite

| Model | Parameters | Layers | Use Case | MLS Target |
|-------|-----------|--------|----------|-----------|
| `mnist-tiny` | 50K | 3 | Smoke test | All |
| `cifar-cnn` | 500K | 8 | Image classification | USB-C, Battery |
| `bert-nano` | 4M | 4 | Text classification | USB-C, M.2 |
| `whisper-pico` | 10M | 6 | Speech recognition | M.2 |
| `gpt-micro` | 25M | 12 | Text generation | M.2, Thunderbolt |
| `llama-tiny` | 110M | 12 | Full LLM | Thunderbolt |
| `llama-small` | 350M | 24 | Cascade LLM | Thunderbolt (4-chip) |
| `llama-1b` | 1.1B | 32 | Production LLM | UCIe + cascade |

All models are pre-quantized to ternary (`{-1, 0, +1}`) and available in ONNX + MLS weight format.

### Workload Profiles

| Profile | Description | Sequence Length | Batch Size |
|---------|-------------|-----------------|------------|
| `latency` | Single-token generation | 128 | 1 |
| `throughput` | Maximum tokens/second | 128 | 8 |
| `long-context` | Extended context window | 2048 | 1 |
| `streaming` | Continuous inference | ∞ | 1 |
| `power` | Sustained load for power measurement | 512 | 1 |

## Metrics

### Primary Metrics

| Metric | Unit | Description |
|--------|------|-------------|
| `tokens_per_second` | tok/s | Generation throughput |
| `first_token_latency` | ms | Time to first generated token |
| `per_token_latency` | ms | Average time per subsequent token |
| `power_average` | W | Average power during inference |
| `power_peak` | W | Peak instantaneous power |
| `energy_per_token` | mJ/tok | Energy efficiency |
| `utilization_lut` | % | LUT utilization (FPGA) |
| `utilization_dsp` | % | DSP utilization (should be 0%) |
| `timing_mhz` | MHz | Achieved clock frequency |

### Derived Metrics

| Metric | Formula | Description |
|--------|---------|-------------|
| `tokens_per_watt` | tok/s ÷ W | Power efficiency |
| `tokens_per_dollar` | tok/s ÷ price | Cost efficiency |
| `perf_per_mm2` | tok/s ÷ die_area | Area efficiency |

## Usage

### Run Benchmark

```bash
# Run full suite on simulated KV260
python3 -m clawbench run --platform kv260 --suite standard

# Run specific model
python3 -m clawbench run --platform kv260 --model gpt-micro --profile latency

# Run on real hardware (requires FPGA connection)
python3 -m clawbench run --platform kv260 --connection /dev/claw0 --suite standard

# Compare two platforms
python3 -m clawbench compare --platforms kv260,genesys2 --suite standard
```

### Generate Report

```bash
# HTML report with charts
python3 -m clawbench report --input results/ --output report.html

# Markdown table
python3 -m clawbench report --input results/ --format markdown

# JSON (for CI integration)
python3 -m clawbench report --input results/ --format json
```

## File Structure

```
clawbench/
├── README.md
├── __init__.py
├── __main__.py              # CLI entry point
├── runner.py                # Benchmark orchestrator
├── suite/
│   ├── __init__.py
│   ├── models.py            # Model definitions and loaders
│   ├── workloads.py         # Workload profile definitions
│   ├── metrics.py           # Metric collection and calculation
│   └── models/              # Pre-quantized model files
│       ├── mnist_tiny.json
│       ├── cifar_cnn.json
│       ├── bert_nano.json
│       ├── whisper_pico.json
│       ├── gpt_micro.json
│       └── llama_tiny.json
├── report_generator/
│   ├── __init__.py
│   ├── html_report.py       # Interactive HTML with Chart.js
│   ├── markdown_report.py   # GitHub-flavored markdown tables
│   ├── json_report.py       # Machine-readable JSON
│   ├── comparison.py        # Multi-platform comparison charts
│   └── templates/
│       └── report.html      # HTML report template
└── platforms/
    ├── __init__.py
    ├── base.py              # Abstract platform interface
    ├── simulated.py         # Software simulation (no hardware)
    └── fpga.py              # Real FPGA measurement
```

## Report Example

```
╔══════════════════════════════════════════════════════════════╗
║                  ClawBench Report v1.0                       ║
║                  Platform: Kria KV260                        ║
║                  Date: 2026-03-25                            ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Model            Tok/s   Latency  Power  Efficiency         ║
║  ─────────────────────────────────────────────────────       ║
║  mnist-tiny        8,420    0.1ms   0.8W   10,525 tok/W     ║
║  cifar-cnn         2,100    0.5ms   1.1W    1,909 tok/W     ║
║  bert-nano           850    1.2ms   1.4W      607 tok/W     ║
║  whisper-pico        320    3.1ms   1.8W      178 tok/W     ║
║  gpt-micro           145    6.9ms   2.1W       69 tok/W     ║
║  llama-tiny           33   30.3ms   2.8W       12 tok/W     ║
║                                                              ║
║  DSP Usage: 0 / 1,248 (0.0%)  ← Ternary: no multipliers   ║
║  LUT Usage: 45,200 / 117,120 (38.6%)                       ║
║  Clock: 200 MHz (timing met)                                ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

## CI Integration

ClawBench integrates with the FPGA CI pipeline (`.github/workflows/fpga_ci.yml`):

```yaml
- name: Run ClawBench
  run: |
    python3 -m clawbench run \
      --platform kv260 \
      --suite standard \
      --output results/

- name: Check regression
  run: |
    python3 -m clawbench check-regression \
      --current results/ \
      --baseline benchmarks/baseline.json \
      --threshold 5%  # Fail if >5% performance regression
```

## References

- MLPerf Inference benchmark (methodology inspiration)
- `fpga_lab/measurements/performance/benchmark.py` — Low-level measurement tools
- `fpga_lab/platforms/` — Platform specifications
