# RFC-0001: Mask-Lock Standard v1.0

- **Author(s):** SuperInstance (@superinstance)
- **Status:** Final
- **Created:** 2025-01-15
- **Updated:** 2026-03-25
- **Supersedes:** None
- **Superseded by:** None

## Abstract

This RFC defines the Mask-Lock Standard (MLS) v1.0 — a specification for inference chips where neural network weights are physically encoded in metal via patterns rather than stored in mutable memory. MLS defines the ternary weight encoding, the Rotation-Accumulate Unit (RAU) architecture, the A2A register map, and the privacy cascade protocol.

## Motivation

Current AI inference hardware stores model weights in SRAM or DRAM. This creates three fundamental problems:

1. **Weight theft:** Weights can be read out via debug interfaces, side-channel attacks, or physical probing. A $100M training investment can be stolen in minutes.

2. **Weight tampering:** Adversaries can modify weights to introduce backdoors, degrade performance, or cause misclassification. Software integrity checks can be bypassed.

3. **Privacy leakage:** Inference engines with mutable weights can be reprogrammed to exfiltrate user data. There is no hardware guarantee that the chip does what it claims.

Mask-lock solves all three by encoding weights in the metal interconnect layers during fabrication. Once manufactured, weights cannot be read, modified, or replaced — they are as permanent as the silicon itself.

### Use Cases

- **Medical devices:** HIPAA-compliant inference where weight integrity is provable
- **Edge AI:** Tamper-proof models deployed in adversarial environments
- **IP protection:** Model weights that cannot be extracted even with physical access
- **Privacy-first inference:** Hardware-enforced guarantee that data stays on-device

## Specification

### 1. Ternary Weight Encoding

Weights are encoded as 2-bit values in metal via patterns:

| Value | Encoding | Metal Pattern |
|-------|---------|---------------|
| +1 | `2'b00` | Via present on M4, absent on M6 |
| 0 | `2'b01` | Via absent on both M4 and M6 |
| -1 | `2'b10` | Via absent on M4, present on M6 |
| _Reserved_ | `2'b11` | MUST NOT appear in valid designs |

**Normative:** Implementations MUST reject or flag weight values of `2'b11`. Behavior upon encountering `2'b11` is undefined but SHOULD trigger an error status.

### 2. Rotation-Accumulate Unit (RAU)

The RAU is the fundamental compute element, replacing traditional multiply-accumulate:

```
              ┌─────────────┐
activation ──►│  Weight      │
  [N-1:0]     │  Decoder     ├──► product [N-1:0]
weight ──────►│  (mux+inv)   │
  [1:0]       └─────────────┘
                     │
                     ▼
              ┌─────────────┐
              │ Accumulator  │
              │  [A-1:0]     ├──► acc_out [A-1:0]
              └─────────────┘
```

**Weight decode logic:**
- `2'b00` (+1): `product = activation` (pass-through)
- `2'b01` (0): `product = 0` (zero-skip, clock-gate for power saving)
- `2'b10` (-1): `product = -activation` (2's complement negation)

**Normative requirements:**
- Accumulator width MUST be at least `N + ceil(log2(max_accumulations))` bits
- Accumulator MUST saturate on overflow (not wrap)
- Zero-skip optimization SHOULD clock-gate the accumulator for `weight == 0`

### 3. Systolic Array Organization

RAUs are arranged in a 2D systolic array:

```
         col_0    col_1    col_2   ...  col_C-1
        ┌──────┐ ┌──────┐ ┌──────┐    ┌──────┐
row_0   │ RAU  │→│ RAU  │→│ RAU  │→...│ RAU  │→ out[0]
        └──┬───┘ └──┬───┘ └──┬───┘    └──┬───┘
           ↓        ↓        ↓            ↓
        ┌──────┐ ┌──────┐ ┌──────┐    ┌──────┐
row_1   │ RAU  │→│ RAU  │→│ RAU  │→...│ RAU  │→ out[1]
        └──┬───┘ └──┬───┘ └──┬───┘    └──┬───┘
           ↓        ↓        ↓            ↓
          ...      ...      ...          ...
```

**Form factor scaling:**

| Form Factor | Array Size | Clock (MHz) | Power (W) |
|-------------|-----------|-------------|-----------|
| USB-C dongle | 8×8 | 200 | 2.5 |
| M.2 card | 64×64 | 400 | 7.0 |
| Thunderbolt box | 4×256×256 | 500 | 45 |
| UCIe chiplet | 256×256 | 800 | 3.0 |
| Battery pack | 8×8 | 8 | 0.05 |

### 4. A2A Register Map

Host-chip communication via memory-mapped registers at base address `0x1000`:

| Offset | Name | R/W | Description |
|--------|------|-----|-------------|
| 0x00 | CMD | W | Command register |
| 0x04 | STATUS | R | Status (packed struct) |
| 0x08 | ADDR | RW | Data address pointer |
| 0x0C | DATA | RW | Data read/write |
| 0x10 | INPUT_BASE | RW | Input buffer base address |
| 0x14 | OUTPUT_BASE | RW | Output buffer base address |
| 0x18 | CHIP_ID | R | Unique chip identifier |
| 0x1C | TEMPERATURE | R | Die temperature (°C × 256) |
| 0x20 | CASCADE_CTRL | RW | Multi-chip cascade control |
| 0x24 | PRIVACY_LEVEL | RW | Privacy cascade level (0-3) |

**Commands:**

| Code | Name | Description |
|------|------|-------------|
| 0x01 | LOAD_WEIGHTS | Initialize weight ROM read path |
| 0x02 | RUN_INFERENCE | Execute forward pass |
| 0x03 | READ_LOGITS | Read output logits |
| 0x04 | CASCADE_ESCALATE | Escalate to next cascade level |
| 0x05 | CLEAR_KV_CACHE | Clear key-value cache |
| 0x06 | SLEEP | Enter low-power mode |
| 0x07 | WAKE | Exit low-power mode |

**Status register (packed):**

```
[31:16] reserved
[15:12] error_code
[11:8]  current_layer
[7]     cascade_active
[6]     privacy_filtered
[5]     thermal_throttle
[4]     weights_loaded
[3]     kv_cache_valid
[2]     inference_done
[1]     busy
[0]     ready
```

### 5. Privacy Cascade

Three-tier privacy escalation with hardware enforcement:

| Level | Scope | Data Treatment |
|-------|-------|---------------|
| 0 — Local | On-chip | Raw data, never leaves device |
| 1 — Edge | Multi-chip | Anonymized features only |
| 2 — Cloud | Remote | Differential privacy, ε=1.0 |

**Normative:**
- Level 0 (local) MUST be the default
- Escalation to Level 1 requires `CASCADE_ESCALATE` command
- Escalation to Level 2 requires Level 1 active AND explicit `PRIVACY_LEVEL = 2`
- De-escalation is immediate upon `PRIVACY_LEVEL` write
- Each escalation MUST be logged in the audit register (append-only)

## Rationale

### Why ternary?

Ternary (`{-1, 0, +1}`) provides the optimal balance between model accuracy and hardware simplicity. Research (Ma et al., 2024) demonstrates that 1.58-bit models achieve competitive perplexity with:
- ~90% gate count reduction vs INT8
- ~95% reduction vs FP16
- ~60% weight sparsity (free zero-skip power saving)
- Memory reduction to 0.2 GB per billion parameters

### Why metal via patterns?

Alternative weight storage approaches and their weaknesses:
- **eFuse/antifuse:** One-time programmable, but readable via FIB/SEM
- **ROM (implant):** Readable via delayering and optical inspection
- **Metal patterns:** Require destroying the chip to read; no non-destructive extraction method exists

### Why not binary (1-bit)?

Pure binary `{-1, +1}` (1 bit per weight) causes unacceptable accuracy loss for models >100M parameters. The zero state in ternary provides:
- Natural sparsity (no computation needed)
- Better gradient flow during QAT
- ~2-3 perplexity points better than binary

## Backwards Compatibility

This is the initial version of the MLS specification. No backwards compatibility concerns.

Future versions MUST maintain:
- Ternary encoding format (`2'b00`, `2'b01`, `2'b10`)
- A2A register map at offsets 0x00-0x1C
- Privacy cascade levels 0-2

Future versions MAY add:
- New commands (codes 0x08+)
- New registers (offsets 0x28+)
- New privacy levels (3+)
- Extended status fields (bits 31:16)

## Reference Implementation

- `reference/common/mls_common.sv` — SystemVerilog package with all types
- `reference/common/a2a_register_file.sv` — Register file implementation
- `reference/form_factors/` — All 5 form factor implementations
- `download/ternaryair/hardware/rtl/` — Original RAU and array designs

## Security Considerations

### Weight Extraction Resistance
Metal via patterns cannot be read electronically. Physical analysis requires:
- Focused Ion Beam (FIB) delayering — destroys layers as they're read
- Cross-section SEM — examines a single slice, destroying the chip
- No known non-destructive method exists for reading via patterns in internal metal layers (M4-M6)

### Side-Channel Resistance
- Zero-skip optimization leaks weight sparsity pattern via power analysis
- Mitigation: Optional constant-time mode (disable zero-skip, fixed power profile)
- Implementations SHOULD offer both modes; security-critical applications MUST use constant-time

### Fault Injection
- Voltage/clock glitching could corrupt accumulator values
- Mitigation: Dual-rail computation with comparison (optional, area doubles)
- Mitigation: Result hash verification against golden reference

## Test Plan

- Compliance test suite: `fpga_lab/testbenches/compliance/tb_mls_compliance.sv`
- Python test suite: `standards/reference/compliance_tests/test_suite.py`
- Per-form-factor testbenches: `fpga_lab/testbenches/`
- Annual third-party security audit

## Unresolved Questions

_None — this RFC has reached Final status._

## References

1. Ma et al., "The Era of 1-bit LLMs: All Large Language Models are in 1.58 Bits" (2024)
2. Hubara et al., "Quantized Neural Networks: Training Neural Networks with Low Precision Weights and Activations" (2018)
3. CERN Open Hardware Licence v2
4. Harris & Harris, "Digital Design and Computer Architecture" (2022)
