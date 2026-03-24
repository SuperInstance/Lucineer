# MLS 1.0 Interface Specification

**Mask-Lock Standard (MLS) v1.0 — Host-Chip Communication**
**Status:** Reference Implementation
**Date:** 2026-03-24
**Revision:** 1.0

---

## 1. A2A-to-Silicon Protocol

The **Agent-to-Agent (A2A) to Silicon** protocol defines how local LLM agents communicate with mask-locked chips. It is a **memory-mapped register interface** accessible via USB-C, PCIe, or UCIe.

### 1.1 Protocol Overview

```
┌──────────────┐
│  LLM Agent   │
│  (Host CPU)  │
└───────┬──────┘
        │
        ↓
   ┌─────────────────────────────────┐
   │  A2A-to-Silicon Adapter         │
   │  (USB Host, PCIe RC, UCIe Link) │
   │  • Register mapping             │
   │  • DMA controllers              │
   │  • Interrupt routing            │
   └────────┬────────────────────────┘
            │
            ↓
   ┌─────────────────────────────────┐
   │  Mask-Locked Chip               │
   │  • Control/Status Registers     │
   │  • MAC Array                    │
   │  • Result Buffer                │
   └─────────────────────────────────┘
```

### 1.2 Addressing

**All registers are accessed at base address 0x1000** (configurable via device tree).

Offsets and sizes are defined in MLS-Core.md §5.2.

---

## 2. Command Set

### 2.1 LOAD_WEIGHTS (0x01)

**Purpose:** Prepare weights for mask generation (pre-fabrication only).

**Write to CONTROL register (0x1000):**
```
[7:0]   = 0x01 (command)
[15:8]  = reserved (0)
[31:16] = payload size in bytes
```

**Sequence:**
1. Write WEIGHT_START (0x1008) with memory pointer
2. Write WEIGHT_SIZE (0x100C) with byte count
3. Write CONTROL with LOAD_WEIGHTS command
4. Poll STATUS until STATUS.ready = 1

**Response:**
```
STATUS[0] = 1 (ready, weights loaded)
STATUS[1] = 0 (no error)
COMPLIANCE_HASH (0x101C) = SHA256 of weights
```

**Error Conditions:**
```
STATUS[1] = 1 (error set):
  Check COMPLIANCE_HASH for mismatch
  Weights may be corrupted
```

---

### 2.2 RUN_INFERENCE (0x02)

**Purpose:** Execute one forward pass through the ternary/INT4 MAC array.

**Write to CONTROL register:**
```
[7:0]   = 0x02 (command)
[15:8]  = flags:
             [0] = use_cache (pre-loaded weights)
             [1] = enable_profiling (timing measurement)
             [2] = reserved
[31:16] = batch_size (usually 1)
```

**Input Setup:**
1. Write INPUT_BASE (0x1010) with activation buffer pointer
2. Write OUTPUT_BASE (0x1014) with result buffer pointer
3. Write CONTROL with RUN_INFERENCE command
4. Poll STATUS until STATUS.busy = 0

**Execution Timeline:**
```
T=0:    Command written
T=1:    Load activations from INPUT_BASE
T=2-5:  MAC pipeline execution (5 cycles @ 200MHz = 25ns)
T=6:    Write results to OUTPUT_BASE
T=7:    Set STATUS.ready = 1
```

**Result Retrieval:**
```
Read RESULT[0..63] (starting at offset 0x100)
Each RESULT[i] is a 32-bit signed integer
```

**Profiling (if enabled):**
```
Elapsed cycles: (T_end - T_start) / 5ns
Energy: (VDD_CORE current) * (elapsed_time) * 1.0V
Report in STATUS extended register (optional)
```

---

### 2.3 READ_LOGITS (0x03)

**Purpose:** Read inference results from output buffer.

**Write to CONTROL:**
```
[7:0]   = 0x03 (command)
[15:8]  = reserved
[31:16] = result_count (max 64)
```

**Data Format:**
```
RESULT[i] format (32-bit signed):
  [31]    = Sign bit
  [30:0]  = Magnitude
```

**Example (classification output):**
```
RESULT[0] = 512      (class 0 logit)
RESULT[1] = -256     (class 1 logit)
RESULT[2] = 1024     (class 2 logit, highest)
→ Predicted class = 2
```

---

### 2.4 CASCADE_ESCALATE (0x04)

**Purpose:** Send inference result to next chip in cascade (privacy escrow).

See MLS-Cascade.md for full protocol.

**Write to CONTROL:**
```
[7:0]   = 0x04 (command)
[15:8]  = flags:
             [0] = blind_aggregation
             [1] = differential_privacy
[31:16] = next_chip_id
```

---

## 3. Status Register

**Read-only at offset 0x1004:**

```
Bit  Name           Type  Description
───────────────────────────────────────────
0    ready          RO    1 = operation complete
1    error          RO    1 = error occurred
2    busy           RO    1 = inference in progress
3    power_ok       RO    1 = power domains stable
4    hash_verified  RO    1 = weight hash passed
5    thermal_warn   RO    1 = die temp > 95°C
[31:6] reserved     RO    0
```

**Clearing Errors:**
Write any value to STATUS to clear error flag (after addressing root cause).

---

## 4. Interrupt Handling

### 4.1 Interrupt Conditions

Chip asserts interrupt line when:
- STATUS.ready transitions 0 → 1 (operation complete)
- STATUS.error transitions 0 → 1 (error detected)
- STATUS.thermal_warn transitions 0 → 1 (temperature spike)

### 4.2 Interrupt Service Routine (ISR)

```c
void mls_chip_isr(void) {
    uint32_t status = read_register(0x1004);  // Read STATUS

    if (status & 0x02) {  // error bit
        fprintf(stderr, "MLS error detected\n");
        // Clear and recover
    }

    if (status & 0x01) {  // ready bit
        // Inference complete
        read_results();
    }

    if (status & 0x20) {  // thermal_warn bit
        // Throttle frequency or power down
        chip_sleep();
    }
}
```

---

## 5. DMA Protocol (Optional)

For high-throughput applications, chips support **Direct Memory Access**:

### 5.1 DMA Configuration

```
Register    Offset   Purpose
──────────────────────────────────
DMA_CTRL    0x40     Enable, mode, count
DMA_SRC     0x44     Source memory address
DMA_DST     0x48     Destination address
DMA_COUNT   0x4C     Bytes to transfer
DMA_STATUS  0x50     Progress, errors
```

### 5.2 DMA Example: Weight Streaming

```python
# Stream 1MB of weights from host to chip
dma_ctrl = 0x01  # Enable DMA
dma_src = host_weight_buffer  # Host memory
dma_dst = chip_weight_buffer  # Chip memory
dma_count = 1024 * 1024  # 1MB

write_register(0x44, dma_src)
write_register(0x48, dma_dst)
write_register(0x4C, dma_count)
write_register(0x40, dma_ctrl)

# Wait for completion
while (read_register(0x50) & 0x01) == 0:
    pass
```

---

## 6. Power Management Interface

### 6.1 Power States

```
State       Description                    Wakeup Latency
──────────────────────────────────────────────────────────
ACTIVE      Full power, all domains on     —
IDLE        MAC powered down, cores on    ~2 µs
SLEEP       I/O only, cores/MAC gated     ~100 µs
OFF         All domains off (VSS only)    ~1 ms (full reset)
```

### 6.2 State Transitions

**Write to power control register (0x60):**

```
[2:0] = target_state:
    0x0 = ACTIVE
    0x1 = IDLE
    0x2 = SLEEP
    0x3 = OFF
```

**Example: Transition to IDLE**
```c
uint32_t ctrl = read_register(0x60);
ctrl &= ~0x7;  // Clear state bits
ctrl |= 0x1;   // Set IDLE
write_register(0x60, ctrl);
usleep(10);    // Wait for transition
```

---

## 7. Compliance Certificate (JSON)

At manufacturing, each chip generates a **compliance certificate**:

```json
{
  "mls_version": "1.0",
  "chip_id": "MLS-2026-0001-A",
  "fabrication_date": "2026-03-24",
  "foundry": "TSMC N7",
  "weight_hash": "a3d5f8e...",
  "quantization_type": "ternary",
  "mac_count": 256,
  "clock_frequency": 200000000,
  "power_domains": 3,
  "interfaces": ["usb-c", "pcie-m2", "ucie"],
  "compliance_tests": {
    "timing_closure": "PASS",
    "power_estimation": "PASS",
    "ternary_verification": "PASS"
  },
  "signature": "0x...",
  "certified": true
}
```

Stored in **non-volatile memory** (eFuse or OTP) on chip.

---

## 8. Revision History

| Version | Date       | Changes |
|---------|-----------|---------|
| 1.0     | 2026-03-24 | Initial release with A2A protocol |

---

**End of MLS Interface Specification**
