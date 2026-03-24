# Tutorial 05 — Jetson Optimization

Squeeze maximum performance from your Jetson hardware for Ranch workloads.

---

## Jetson-Specific CUDA Settings

The Jetson Orin family uses **unified memory**: the CPU and GPU share the same physical DRAM. This is both an advantage and a constraint.

**Advantage**: No explicit host↔device memory copies. Tensors allocated on CPU are accessible by the GPU (and vice versa) without `cudaMemcpy`. This simplifies the Ranch memory model and reduces latency for small tensors.

**Constraint**: GPU memory and CPU memory compete for the same pool. If you run heavy system processes alongside Ranch, the GPU will see effective VRAM reduction.

### Key CUDA Settings

In `.env`:

```bash
# Which CUDA device to use (0 = first GPU)
CUDA_DEVICE="0"

# Fraction of unified memory to reserve for GPU workloads
# Leave headroom for system: 0.85 is safe for Orin Nano
GPU_MEMORY_FRACTION="0.85"

# Enable CUDA memory pool (reduces allocation overhead for repeated small allocs)
CUDA_MEMORY_POOL="true"

# Persistent kernel mode: keeps CUDA kernel alive between tasks
CUDA_PERSISTENT_KERNEL="true"
```

### Checking GPU Status

```bash
# Live GPU stats (Jetson-specific)
sudo tegrastats --interval 1000

# Or use jtop (install: pip3 install jetson-stats)
jtop
```

Key metrics to watch:
- **GR3D %**: GPU utilization (target 60–90% during Ranch workloads)
- **RAM**: Combined CPU+GPU usage (keep below 85% of total)
- **EMC %**: Memory bandwidth utilization

---

## VRAM Management for Orin Nano (8GB)

The Orin Nano has 8GB of unified memory shared between CPU and OS. For stable Ranch operation, stay under **6.5GB total** to leave headroom for the OS and web UI.

### Typical Memory Budget

| Component | Memory |
|---|---|
| OS + system processes | ~1.0 GB |
| Next.js web UI | ~0.3 GB |
| Prisma/SQLite | ~0.2 GB |
| Collie Orchestrator | ~0.3 GB |
| CRDT Memory Pasture (in-memory) | ~0.5 GB (10k entries) |
| Active agents (warm pool) | ~4.0 GB (10 agents × 400MB each for 7B model) |
| **Total** | **~6.3 GB** |

For Night School LoRA breeding, peak usage can spike to ~7GB. This is why the installer configures a 16GB swap file — it absorbs the breeding peak without OOM crashes.

### Reducing Memory Usage

If you hit OOM errors:

1. **Reduce warm pool size**: Set `COLLIE_WARM_POOL_SIZE="5"` in `.env`
2. **Use a smaller base model**: Switch from 7B to 3B parameters for agent inference
3. **Reduce Night School batch size**: Set `BREEDING_BATCH_SIZE="1"` in `.env` to breed one pair at a time
4. **Increase swap**: The installer sets 16GB; you can go higher on systems with fast NVMe

---

## Power Profiles

Jetson supports multiple power profiles via `nvpmodel`. The installer sets max performance (mode 0), but you may want to adjust based on use case.

### Available Profiles

| Mode | Name | CPU | GPU | TDP | Use Case |
|---|---|---|---|---|---|
| 0 | MAXN | All cores, max freq | 1024 MHz | 20W | Production / Night School |
| 1 | 10W | 4 cores, reduced freq | 614 MHz | 10W | Battery / thermal limit |
| 2 | 15W | 6 cores, reduced freq | 819 MHz | 15W | Balanced |
| 3 | 7W | 2 cores, min freq | 306 MHz | 7W | Quiet mode / standby |

Switch profiles:

```bash
# Set to 7W quiet mode
sudo nvpmodel -m 3

# Set to max performance
sudo nvpmodel -m 0

# Check current mode
sudo nvpmodel -q
```

Lock clocks for deterministic benchmarks:

```bash
sudo jetson_clocks          # lock all clocks at max
sudo jetson_clocks --restore # restore dynamic clocking
```

### Thermal Considerations

The Orin Nano has a compact thermal design. Under sustained Ranch workloads (Night School breeding), the SoC can throttle if ambient temperature is high or airflow is poor.

Symptoms of thermal throttling:
- tok/s drops mid-task without load change
- `tegrastats` shows CPU/GPU frequency below max
- `jetson_clocks` shows thermal limit active

Mitigations:
1. Ensure adequate airflow around the module (don't enclose it)
2. Use the official heatsink/fan kit for AGX Orin
3. Schedule Night School at cooler ambient times (early morning)
4. Set `BREEDING_SCHEDULE="0 4 * * *"` (4am) if overnight temps are lower in your environment

---

## Benchmark Targets

Run the Ranch benchmark suite:

```bash
make benchmark
```

### Orin Nano (8GB, mode 0) Targets

| Metric | Target | Notes |
|---|---|---|
| Inference throughput | >80 tok/s | 7B model, INT4 quantized |
| Agent coordination latency | <200ms | Collie dispatch to first token |
| CRDT write throughput | >1,000 writes/s | In-memory, SQLite-backed |
| RAG retrieval latency | <20ms | Top-5, 10k entry Pasture |
| Night School cycle time | <3 hours | 10 agents, 5 breeding pairs |
| Memory Pasture boot time | <500ms | Full CRDT state, 10k entries |

### AGX Orin (64GB, mode 0) Targets

| Metric | Target |
|---|---|
| Inference throughput | >300 tok/s (70B model, INT4) |
| Agent coordination latency | <50ms |
| Concurrent warm agents | >100 |
| Night School cycle time | <45 minutes (50 agents) |

### If Your Benchmarks Are Below Target

1. **Check thermal state**: `sudo tegrastats | grep -i therm`
2. **Check power mode**: `sudo nvpmodel -q` (should be mode 0)
3. **Check swap activity**: `vmstat 1` — high swap activity during inference means insufficient RAM for warm pool
4. **Check quantization**: Ensure models are INT4 quantized, not FP16 (4× memory reduction)
5. **Check CUDA utilization**: `tegrastats` GR3D should be >60% during inference

---

## Model Quantization for Jetson

For the Orin Nano, use INT4 quantized models (4-bit weights). This gives ~4× memory reduction with typically <3% quality loss on most benchmarks.

Recommended: `llama.cpp` GGUF format with Q4_K_M quantization. This provides the best quality/size tradeoff for the unified memory architecture.

The LLN Playground fine-tuning export is compatible with `llama.cpp` GGUF — use the export button in the LLN UI to generate a fine-tuning dataset, then follow the `torchtune` → GGUF conversion pipeline in `docs/advanced/quantization.md`.

---

## Useful Commands Reference

```bash
# Monitor GPU in real time
sudo tegrastats --interval 500

# Full system monitor (requires: pip3 install jetson-stats)
sudo jtop

# Check current nvpmodel
sudo nvpmodel -q

# Lock clocks for consistent benchmarks
sudo jetson_clocks

# Check memory usage by process
sudo smem -r -k | head -20

# Night School memory peak monitoring
watch -n 5 'free -h && sudo tegrastats 2>/dev/null | head -1'

# Ranch benchmark
make benchmark
```
