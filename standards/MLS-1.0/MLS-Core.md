# MLS 1.0 Core Architecture Specification

**Mask-Lock Standard (MLS) v1.0**
**Status:** Reference Implementation
**Date:** 2026-03-24
**Revision:** 1.0

---

## 1. Executive Summary

The Mask-Lock Standard (MLS) defines a hardware architecture where neural network weights are immutably encoded in metal routing layers (M1–M6) of a silicon chip. This creates a "mask-locked" execution engine: weights are fixed at fabrication, guaranteeing reproducibility, auditability, and tamper-evidence while enabling extreme energy efficiency.

MLS establishes:
- **Weight Encoding**: Ternary weights {-1, 0, +1} or quantized INT4 in metal layers
- **Processing Elements**: Standard multiply-accumulate (MAC) cells with ternary support
- **Clocking**: 200 MHz reference target, distributed to cores
- **Power Domains**: Independent gating for core logic, I/O, and memory
- **Pinout**: USB-C Alt Mode, PCIe M.2, UCIe inter-chip links

---

## 2. Mask-Lock Architecture

### 2.1 Weight Encoding in Metal Layers

Weights are **physically encoded as metal trace widths** in the back-end-of-line (BEOL) layers:

| Layer | Purpose | Encoding |
|-------|---------|----------|
| M1    | Power/Ground grid | Supply distribution |
| M2    | Row-wise weights | 1st bit (sign or magnitude LSB) |
| M3    | Vertical interconnect | Routing |
| M4    | Column-wise weights | 2nd bit (magnitude MSB) |
| M5    | Long-range carry/skip | Partial product routing |
| M6    | Control signals | Weight enable/select multiplexing |

**Ternary Weight Representation:**
```
Width encoding per wire:
  THIN_TRACE   (1.0x λ) = 0
  BASE_TRACE   (2.0x λ) = +1
  WIDE_TRACE   (3.0x λ) = -1
```

Where λ is the minimum feature size (e.g., 7nm λ → actual traces 7nm, 14nm, 21nm wide).

### 2.2 Standard Cell Library (SCL) Requirements

All MLS chips **must** include a certified SCL supporting:

#### 2.2.1 Ternary MAC Cell
```
Inputs:  A_in  (3-bit ternary: [-1,0,+1])
         B_in  (3-bit ternary: [-1,0,+1])
         Cin   (Partial product in)
Outputs: P_out (Sum of products)
         Cout  (Carry out)
```

Truth table:
```
A   B   P = A*B
-1  -1  +1
-1   0   0
-1  +1  -1
 0  -1   0
 0   0   0
 0  +1   0
+1  -1  -1
+1   0   0
+1  +1  +1
```

#### 2.2.2 Mask-Locked Register
- Gated by weight layer (M6) select signals
- Can be written during **mask generation phase only**
- Read-only during runtime (post-fabrication)

#### 2.2.3 Zero-Skip Logic
- Detects zero operands to short-circuit MAC
- ~40% energy savings on sparsity

### 2.3 Core Logic Architecture

```
┌─────────────────────────────────────────────┐
│           Mask-Locked Core                  │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │  Ternary MAC Array (N×M cells)       │  │
│  │  • Weights hardcoded in M2/M4        │  │
│  │  • Activations via A/B ports         │  │
│  │  • Result accumulation               │  │
│  └──────────────────────────────────────┘  │
│                 ↓                           │
│  ┌──────────────────────────────────────┐  │
│  │  Output Register Bank (Read-only)    │  │
│  │  • Gated by M6 control layer         │  │
│  │  • Hash verification circuits        │  │
│  └──────────────────────────────────────┘  │
│                 ↓                           │
│  ┌──────────────────────────────────────┐  │
│  │  Control FSM                          │  │
│  │  • LOAD_WEIGHTS (mask generation)    │  │
│  │  • RUN_INFERENCE (runtime)           │  │
│  │  • ERROR handling                    │  │
│  └──────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 3. Clocking and Timing

### 3.1 Reference Clock Specification

**Target Frequency:** 200 MHz
**Clock Period:** 5 ns
**Skew Budget:** < 100 ps (5% of period)

### 3.2 Clock Distribution Network (CDN)

```
Input PLL (200 MHz)
    ↓
Primary Grid (H-tree from core center)
    ↓
├─ Core Clock: 1.0× (200 MHz) → MAC arrays
├─ I/O Clock:  0.5× (100 MHz) → Interface
└─ Memory Clock: 1.0× (200 MHz) → Reg file
```

### 3.3 Timing Closure Constraints

| Path | Setup Time | Hold Time | Clock-to-Q |
|------|------------|-----------|-----------|
| MAC input → output | 2.5 ns | 0.8 ns | 1.2 ns |
| Reg write → read | 1.5 ns | 0.5 ns | 1.0 ns |
| I/O input → core | 2.0 ns | 0.7 ns | — |

All paths must meet **worst-case ss/0.72V** (slow-slow, low voltage).

---

## 4. Power Domains

### 4.1 Domain Hierarchy

```
VDD_CORE (1.0V nominal)
├─ PD_MAC: Multiply-accumulate arrays
├─ PD_REG: Output register bank
└─ PD_CTRL: State machine & arbitration

VDD_IO (1.8V nominal)
└─ PD_IO: Interface drivers (USB, PCIe, UCIe)

VSS (Ground, shared)
```

### 4.2 Power Gating

- **PD_MAC**: Can be powered down when idle (wake latency: 2 μs)
- **PD_REG**: Always-on (supports fast interrupt response)
- **PD_CTRL**: Always-on (state tracking)
- **PD_IO**: Software-controlled sleep mode

### 4.3 Power Estimation

**At 200 MHz, nominal PVT:**
- MAC array: ~150 mW (dynamic) + 20 mW (static)
- Register file: ~30 mW (dynamic) + 5 mW (static)
- I/O (active): ~50 mW
- I/O (sleep): < 1 mW

**Total per core: ~255 mW @ max frequency**

---

## 5. Pinout Standardization

### 5.1 Physical Interfaces

#### 5.1.1 USB-C Alt Mode (Primary Control)
- 16-bit data bus (USB 2.0 SuperSpeed mode)
- Control registers mapped to USB device endpoints
- Power delivery: up to 5A @ 20V (100W)

#### 5.1.2 PCIe M.2 (High-Throughput)
- Gen 4 x1 (4 GB/s unidirectional)
- DMA support for weight streaming
- No plug-and-play requirement (dedicated slot)

#### 5.1.3 UCIe (Multi-Chip Cascade)
- Universal Chiplet Interface standard
- 16 lanes @ 32 Gbps per lane (512 GB/s aggregate)
- Privacy escrow protocol (see MLS-Cascade.md)

### 5.2 Register Map (Base Address 0x1000)

```
Offset  Name              R/W  Size  Purpose
──────────────────────────────────────────────
0x00    CONTROL           RW   32b   [7:0] command, [31:8] reserved
0x04    STATUS            R    32b   [0] ready, [1] error, [2] busy
0x08    WEIGHT_START      RW   32b   M2/M4 layer base address
0x0C    WEIGHT_SIZE       RW   32b   Total weight bytes
0x10    INPUT_BASE        RW   32b   Activation buffer pointer
0x14    OUTPUT_BASE       RW   32b   Result buffer pointer
0x18    CORE_ID           R    8b    Chip revision & core count
0x1C    COMPLIANCE_HASH   R    256b  SHA256 of weight configuration
0x100   RESULT[0..63]     R    32b   Output logits (per result register)
```

---

## 6. Standard Compliance Checklist

An MLS-compliant chip **must**:

- [ ] Use mask-locked ternary MAC cells (traced in M2/M4)
- [ ] Include clock distribution meeting 5ns period / 100ps skew
- [ ] Implement register map at base 0x1000 with all defined offsets
- [ ] Support USB-C Alt Mode or PCIe M.2 (at minimum one)
- [ ] Include SHA256 hardware hash of weight configuration
- [ ] Meet power domain isolation (separate VDD_CORE / VDD_IO)
- [ ] Pass compliance_tests/test_suite.py with **zero errors**
- [ ] Generate MLS Compliance Certificate (JSON)

---

## 7. Revision History

| Version | Date       | Changes |
|---------|-----------|---------|
| 1.0     | 2026-03-24 | Initial release |

---

## Appendix A: Glossary

- **BEOL**: Back-end-of-line (metal layers M1–M6)
- **CDN**: Clock Distribution Network
- **MAC**: Multiply-Accumulate
- **PVT**: Process, Voltage, Temperature
- **UCIe**: Universal Chiplet Interface Express
- **λ**: Lambda, minimum feature size

---

**End of MLS Core Architecture Specification**
