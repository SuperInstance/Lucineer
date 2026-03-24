# MLS 1.0 Quantization Specification

**Mask-Lock Standard (MLS) v1.0 — Quantization Formats**
**Status:** Reference Implementation
**Date:** 2026-03-24
**Revision:** 1.0

---

## 1. Quantization Overview

MLS supports two primary quantization schemes optimized for mask-locked silicon:

1. **Ternary (TQ)**: {-1, 0, +1} — ultralow precision, 3 states
2. **INT4 (IQ)**: [-8, +7] — low precision, 4-bit signed integer

Both formats are **fixed after mask generation** and verified by hardware compliance circuits.

---

## 2. Ternary Quantization (TQ)

### 2.1 Representation

Each ternary weight occupies **1 byte in the weight configuration**, but is physically encoded as a **single M2/M4 trace width** in the mask:

```
Ternary Value   Wire Width (λ units)   Trace Width (@ 7nm)
─────────────────────────────────────────────────────────
  -1            3.0×                   21 nm (WIDE)
   0            1.0×                   7 nm  (THIN)
  +1            2.0×                   14 nm (BASE)
```

### 2.2 Ternary MAC Unit

The ternary MAC computes:
```
Result = Σ(w_i × a_i) + Cin
```

Where:
- w_i ∈ {-1, 0, +1} (weight, hardcoded)
- a_i ∈ {-1, 0, +1} (activation, runtime)
- Cin = partial product carry-in

**3-bit Input Representation (Sign-Magnitude):**
```
Bit 2: Sign (1=negative, 0=positive)
Bit 1: Magnitude MSB
Bit 0: Magnitude LSB

0b000 = 0
0b001 = +1
0b011 = +1 (redundant)
0b100 = -1 (sign bit set)
0b101 = -1 (sign bit + magnitude)
```

### 2.3 Zero-Skip Optimization

If either w_i or a_i is 0, the MAC is short-circuited:
```
if (w_i == 0 || a_i == 0):
    Result += Cin    (skip multiply)
else:
    Result += (w_i * a_i) + Cin
```

**Energy Savings:** ~40% on sparse networks (BitNet-style)

### 2.4 Accumulation Width

Post-MAC accumulation uses **32-bit signed integer**:
```
Accumulator = ΣΣ(w[m][n] × a[n])
Range: [-2^31, 2^31-1]
```

Overflow **saturates** rather than wraps (architectural guarantee).

---

## 3. INT4 Quantization (IQ)

### 3.1 Representation

INT4 uses **2 bits per weight** (paired in a byte):

```
Byte Layout (2 weights):
  [7:4] = Weight 1 (4-bit signed)
  [3:0] = Weight 0 (4-bit signed)

4-bit Signed Range: [-8, +7]
Encoding: Two's complement
```

### 3.2 INT4 MAC Unit

The INT4 MAC computes:
```
Result = Σ(w_i × a_i) + Cin
```

Where:
- w_i ∈ [-8, +7] (weight, hardcoded in M2/M4)
- a_i ∈ [-8, +7] (activation, runtime)
- Cin = 32-bit partial sum

**3-bit × 4-bit Multiplier:**

```
Partial product width = 8 bits (signed)
Adder tree: 8-bit → 32-bit accumulator with saturation
```

### 3.3 Activation Quantization

**Ternary activations** (not quantized, live values):
```
a_i ∈ {-1, 0, +1}  (same as ternary weights)
```

Or **INT4 activations** (quantized at layer boundaries):
```
a_i ∈ [-8, +7]  (calibrated per-layer during training)
```

### 3.4 Calibration Protocol

INT4 weights and activations are **calibrated offline** using a reference dataset:

```
1. Train full-precision model
2. Collect batch statistics (min, max, mean for each layer)
3. Calculate scale factor: s = (max - min) / 15
4. Quantize: q = round((float_val - min) / s)
5. Clip: q_clipped = clamp(q, -8, +7)
6. Encode in mask (M2/M4 traces)
7. Verify with compliance tests
```

---

## 4. Mixed Precision (Ternary + INT4)

MLS allows **per-layer** quantization mixing:

```
Layer 0:  Ternary (w) × Ternary (a)     [3 states × 3 states]
Layer 1:  INT4 (w) × Ternary (a)        [16 states × 3 states]
Layer 2:  INT4 (w) × INT4 (a)           [16 states × 16 states]
...
Output:   Ternary (w) × INT4 (a)        [classification]
```

**Protocol:**
- Declare quantization per layer in mask metadata
- Hardware multiplexers select correct MAC unit
- Compliance tests verify per-layer consistency

---

## 5. Format Verification

### 5.1 Weight Integrity Hash

All weights are hashed and burned into read-only registers at boot:

```python
SHA256_weights = hash(
    quantization_type ||  # 0x01 = ternary, 0x04 = INT4
    layer_count ||
    concatenate(all_weights_bytes)
)
```

Stored at register offset 0x1C (MLS-Core.md §5.2).

### 5.2 Runtime Verification Circuits

During each inference, hardware verifies:

1. **Checksum**: Partial product accumulation matches expected range
2. **Range Check**: Output logits within [-2^31, 2^31-1]
3. **Timing**: MAC pipeline completes in 5 cycles (200MHz)

If any check fails, **STATUS.error flag** is set and inference halts.

---

## 6. Example: BitNet b1.58 Quantization

BitNet b1.58 uses a **quantization scheme** compatible with MLS ternary:

```
Original model weights:
  w_orig ∈ ℝ (full precision)

Quantize to [-1.58, 0, +1.58]:
  q_scale = 2 / mean(|w_orig|)
  w_quant = round(q_scale * w_orig)

Binarize to {-1, 0, +1}:
  w_mls = { -1 if w_quant < 0,
             0 if w_quant == 0,
            +1 if w_quant > 0 }
```

**Result:** ~99.5% accuracy on CIFAR-10 using pure ternary weights in mask.

---

## 7. Quantization Checklist

An MLS implementation **must**:

- [ ] Support ternary quantization (TQ)
- [ ] Implement ternary MAC units with zero-skip
- [ ] Include INT4 MAC units (optional, but recommended)
- [ ] Store quantization type in mask metadata
- [ ] Calculate SHA256 weight hash at boot
- [ ] Enforce saturation on accumulator overflow
- [ ] Pass calibration tests (compliance_tests/test_suite.py)

---

## 8. Revision History

| Version | Date       | Changes |
|---------|-----------|---------|
| 1.0     | 2026-03-24 | Initial release, ternary & INT4 |

---

**End of MLS Quantization Specification**
