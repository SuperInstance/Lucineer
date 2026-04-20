# Neural Plato v0.1 Boot Sequence

**Doc ID**: NP-BSS-001  
**Date**: 2026-04-20  
**Status**: REFERENCE  
**Targets**: RTX 4050 Mobile (6 GB), Jetson Orin Nano (8 GB shared)  
**Base**: Qwen2.5-7B-Q4_K_M (`qwen2.5-7b-q4_k_m.gguf`)

---

## 0. Hardware Probe

```c
typedef struct {
    uint64_t mem_total;        // Bytes
    uint16_t sm_count;         // 20 (Orin) | 48 (4050)
    uint8_t  pcie_gen;         // 3 | 4
    uint8_t  dma_engines;      // 2 | 5
    uint8_t  resident_rooms;   // 3 | 6
    uint8_t  max_agents;       // 6 | 12
} PlatoHwCaps;
```

| `mem_total` | `resident_rooms` | `max_agents` | Action |
|---|---|---|---|
| < 5.5 GiB | — | — | ABORT (`E_INSUFFICIENT_VRAM`) |
| 5.5 – 7.0 GiB | 3 | 6 | RTX 4050 profile |
| 7.0 – 9.0 GiB | 6 | 12 | Jetson Orin profile (deduct 1.2 GiB OS/CV) |

Probe: ~50 ms (`nvmlInit` + `cudaMemGetInfo`).

---

## 1. Memory Maps

### Symbol Table

| Symbol | Bytes | Hex | Note |
|---|---|---|---|
| `BASE` | 3,758,096,384 | `0xE000_0000` | Q4_K_M weights |
| `KERNEL` | 104,857,600 | `0x0640_0000` | Rank-64 LoRA + StateBridge |
| `KV` | 536,870,912 | `0x2000_0000` | 32L×2×128H×64D×8k×fp16 |
| `DEADBAND` | 52,428,800 | `0x0320_0000` | Safety LoRA (rank 32) + sparse rejection tensor |
| `ROOM` | 52,428,800 | `0x0320_0000` | Domain LoRA (rank 128, alpha 256) |
| `AGENT` | 4,096 | `0x0000_1000` | State vector (padded to 4 KiB) |

### RTX 4050 — 6 GB (`0x0000_0000` – `0x1800_0000`)

```
0x0000_0000 ┬ BASE_MODEL  ................ 3.500 GiB
0x0E00_0000 ┼ KERNEL_ADPT ................ 0.098 GiB
0x0E64_0000 ┼ KV_CACHE  .................. 0.500 GiB
0x1064_0000 ┼ DEADBAND  .................. 0.049 GiB
0x1096_0000 ┼ ROOM_0  .................... 0.050 GiB
0x10C8_0000 ┼ ROOM_1  .................... 0.050 GiB
0x10FA_0000 ┼ ROOM_2  .................... 0.050 GiB
0x112C_0000 ┼ AGENT_TBL (6×) ............. 0.00002 GiB
0x112C_6000 ┼ FREE  ...................... 1.722 GiB
0x1800_0000 ┴ VRAM_TOP
```

**Committed**: 4.278 GiB | **Headroom**: 1.722 GiB  
Fits: 3 rooms, 6 agents, 1 swap buffer, activation scratch.

### Jetson Orin — 8 GB Shared

Effective PLATO budget: ~6.8 GiB after 1.2 GiB OS + 300 MiB CUDA + 256 MiB PVA/VIC.

```
0x0000_0000 ┬ BASE_MODEL  ................ 3.500 GiB
0x0E00_0000 ┼ KERNEL_ADPT ................ 0.098 GiB
0x0E64_0000 ┼ KV_CACHE  .................. 0.500 GiB
0x1064_0000 ┼ DEADBAND  .................. 0.049 GiB
0x1096_0000 ┼ ROOM_0  .................... 0.050 GiB
0x10C8_0000 ┼ ROOM_1  .................... 0.050 GiB
0x10FA_0000 ┼ ROOM_2  .................... 0.050 GiB
0x112C_0000 ┼ ROOM_3  .................... 0.050 GiB
0x115E_0000 ┼ ROOM_4  .................... 0.050 GiB
0x1190_0000 ┼ ROOM_5  .................... 0.050 GiB
0x11C2_0000 ┼ AGENT_TBL (12×) ............ 0.00005 GiB
0x11C2_C000 ┼ FREE  ...................... 1.495 GiB
0x1B00_0000 ┴ BUDGET_TOP (effective)
```

**Committed**: 5.305 GiB | **Headroom**: 1.495 GiB  
Fits: 6 rooms, 12 agents, 2 swap buffers, OS jitter.

---

## 2. Boot Stages

All offsets logical device-relative. Allocator page = 4 KiB.

### Stage 1 — KERNEL (T+0.000 s → T+2.500 s)

| Offset Start | Offset End | Region | Bytes |
|---|---|---|---|
| `0x0000_0000` | `0x0E00_0000` | `BASE_MODEL` | 3,758,096,384 |
| `0x0E00_0000` | `0x0E64_0000` | `KERNEL_ADPT` | 104,857,600 |
| `0x0E64_0000` | `0x1064_0000` | `KV_CACHE` | 536,870,912 |

**SHA256**: 7 chunks × 512 MiB, CPU-7-way parallel, overlapped with DMA.  
**Failure**: Retry DMA once; fallback to `weights.fallback.gguf` (Q4_0, 3.2 GiB).  
**OOM**: Halve KV to 4k seq (save 256 MiB). Still OOM → `E_INSUFFICIENT_VRAM`.

**Timing (RTX 4050, PCIe 4.0 x8)**:

| Op | Duration |
|---|---|
| File read + H2D DMA | 2.10 s (~1.8 GB/s) |
| KV zero-fill | 0.04 s |
| SHA256 (overlapped 80%) | 0.35 s |
| Kernel adapter load | 0.01 s |
| **Total** | **~2.5 s** |

### Stage 2 — DEADBAND (T+2.500 s → T+2.800 s)

| Offset Start | Offset End | Bytes | Content |
|---|---|---|---|
| `0x1064_0000` | `0x1096_0000` | 52,428,800 | Safety LoRA + sparse rejection COO tensor |

Sparse tensor: `int32[2,2048]` indices + `fp16[2048]` values = 20,480 B (stored in adapter slack).

**Gate states**:
- **P0** (Negative Space): `OPEN` — reject tokens with >0.85 forbidden subspace overlap.
- **P1** (Safe Channel): `OPEN` after P0 validates.
- **P2** (Optimisation): `CLOSED` until P1 certifies.

**Timing**: 0.05 s memcpy + 0.15 s DFA compile (CPU) + 0.05 s handshake = **0.30 s**.

### Stage 3 — ROOMS (T+2.800 s → T+3.400 s)

Per-room: 50 MiB adapter only (context lives in host RAM, paged on demand).

| HW | Rooms Resident | Time |
|---|---|---|
| RTX 4050 | 3 | 3 × 0.20 s = **0.60 s** |
| Jetson Orin | 6 | 6 × 0.10 s = **0.60 s** |

Per room: 0.05 s adapter memcpy + 0.05 s metadata/checksum + 0.10 s (Jetson parallel) context pointer bind.

**Failure**: Adapter checksum fail → mark `DEGRADED`, route to `ROOM_0`, queue re-distillation. Default room also fails → boot kernel+deadband only (minimum viable).

### Stage 4 — AGENTS (T+3.400 s → T+3.500 s)

| HW | Table Offset | Bytes | Agents |
|---|---|---|---|
| RTX 4050 | `0x112C_0000` | 24,576 | 6 |
| Jetson Orin | `0x11C2_0000` | 49,152 | 12 |

Host RAM per agent: 64 KiB task queue + 256 KiB tile buffer.

**Time**: 0.01 s GPU zero-fill + 0.05 s host alloc + 0.04 s scheduler handshake = **0.10 s**.

### End-of-Boot Summary

| Profile | Total VRAM | Wall Time | Headroom |
|---|---|---|---|
| RTX 4050 (3 rooms, 6 agents) | 4.278 GiB | ~3.5 s | 1.722 GiB |
| Jetson Orin (6 rooms, 12 agents) | 5.305 GiB | ~3.5 s | 1.495 GiB |

---

## 3. Room Paging — LRU + Sentiment

### Page States

| State | Location | Latency | Launch? |
|---|---|---|---|
| `RESIDENT` | VRAM | 0 ms | Yes |
| `CACHED` | Pinned host RAM | ~40 ms | Yes (UVM zero-copy on Orin) |
| `FROZEN` | Pageable host RAM + disk mmap | ~1.2 s | No |
| `ARCHIVED` | Disk (ensign + tile log) | ~3.5 s | No |

### Eviction Score

```python
E = (t_now - t_last_access) / (1.0 + S_ema + I_boost)
```

- `S_ema`: sentiment EMA [-1.0, 1.0]. High positive → stay resident.
- `I_boost`: `CRITICAL` rooms (DEADBAND, KERNEL) = 10.0, never evicted.
- Evicted room: `CACHED` if `S_ema > 0`, else `FROZEN`.

### Swap-In Protocol

1. Request room `R`.
2. `R` already `RESIDENT` elsewhere → ref-count++, no memcpy.
3. `R` is `CACHED`/`FROZEN`:
   - Evict victim `V` = max `E`.
   - Async `V` → host (non-blocking).
   - Async `R` ← host (overlapped).
   - Warm-fill last 1,024 tokens from tile index.
   - Atomic page-table update.
4. `R` is `ARCHIVED` → load ensign (~200 MB, 1.5 s), reconstruct context (~50 MB, 2.0 s), then step 3.

**Latency targets**: `CACHED`→`RESIDENT` 400 ms; `FROZEN`→`RESIDENT` 1.2 s; `ARCHIVED`→`RESIDENT` 3.5 s.

### Limits

| HW | `MAX_RESIDENT` | `MAX_CACHED` | `MAX_FROZEN` |
|---|---|---|---|
| RTX 4050 | 3 | 8 | unlimited |
| Jetson Orin | 6 | 16 | unlimited |

---

## 4. Failure Recovery

### Stage 1 — KERNEL

| Failure | Detection | Recovery | Fallback |
|---|---|---|---|
| SHA256 mismatch | CPU worker `BAD_CHECKSUM` | Retry DMA once; re-read chunk | Fallback weights (Q4_0); else `E_KERNEL_CORRUPT` |
| OOM | `cudaErrorMemoryAllocation` | Halve KV cache (4k seq) | `E_INSUFFICIENT_VRAM` |
| Adapter magic mismatch | `PLATO_KA_v0` fail | Re-compile from `src/plato-kernel/` | Generic mode (no kernel routing) |

### Stage 2 — DEADBAND

| Failure | Detection | Recovery | Fallback |
|---|---|---|---|
| DFA compile error | `REG_ECOMPLEX` | Skip pattern, log to `deadband_skip.list` | < 12 patterns → P0-only safe mode (read-only) |
| Rejection tensor shape | `vocab_size` != 151,936 | Rebuild from pattern index | Tokenizer mismatch → `E_TOKENIZER_DRIFT` |
| Gate corruption | P0 flag != 0x01 | Hard reset from ROM defaults | Persistent → watchdog reboot |

### Stage 3 — ROOMS

| Failure | Detection | Recovery | Fallback |
|---|---|---|---|
| Adapter checksum fail | SHA256 mismatch | Mark `DEGRADED`, route to `ROOM_0`, re-distill | Default fails → kernel+deadband only |
| Context warm-fill timeout | > 5 s | Truncate to 256 tokens, flag `HIGH_ENTROPY` | Short-context ops until background fill |
| OOM during load | `cudaMalloc` fail | Evict lowest-priority room, retry | No evictable room → `E_ROOM_NO_VRAM` |

### Stage 4 — AGENTS

| Failure | Detection | Recovery | Fallback |
|---|---|---|---|
| Host OOM | `malloc` NULL | Reduce tile buffer to 64 KiB | Headless mode (no tile buffer) |
| ID race | CAS fail on `AGENT_TBL` | Retry next ID | — |
| Illegal GPU access | CUDA segfault | Tombstone (`0xFF`), emit ghost tile, free slot | Base corrupted → Stage 1 reboot |

---

*"The model is not loaded. It is inhabited."*
