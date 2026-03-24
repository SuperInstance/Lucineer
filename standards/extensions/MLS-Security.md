# MLS Security Extension (Draft)

**Mask-Lock Standard (MLS) v1.0 — Security & Side-Channel Resistance**
**Status:** Future Extension (Post-v1.0)
**Date:** 2026-03-24
**Revision:** 0.1

---

## 1. Threat Model

### 1.1 Attack Surface

MLS chips are vulnerable to:

1. **Side-channel attacks**:
   - Timing analysis (inference latency reveals input properties)
   - Power analysis (current spikes leak intermediate values)
   - Electromagnetic (EM) side-channel (radiated emissions)

2. **Physical attacks**:
   - Chip reverse-engineering (decap + optical imaging)
   - Fault injection (laser/EM pulses to flip bits)
   - Invasive attacks (focused ion beam modification)

3. **Software attacks**:
   - Cache-based side-channels (Spectre-like)
   - Privilege escalation to read weight registers
   - Firmware/bootloader exploits

### 1.2 Threat Scope for MLS

**In scope** (weights are public):
- Recovering ternary/INT4 weight values (not a threat)

**Out of scope** (protected by cascade privacy escrow):
- Inferring activation values without all noise keys
- Reading raw logits in multi-chip cascade

**Future scope** (post-v1.0):
- Timing side-channels (this extension)
- Power analysis resistance
- Fault tolerance

---

## 2. Timing Attack Mitigation

### 2.1 Constant-Time Inference

The zero-skip optimization (MLS-Core.md §2.2) introduces **variable latency**:

```
if (weight == 0 || activation == 0):
    skip multiply      (1 cycle)
else:
    compute multiply   (5 cycles)
```

An attacker can measure latency to infer sparsity patterns:
- High latency → few zeros in input
- Low latency → many zeros in input

### 2.2 Constant-Time MAC (CT-MAC)

Future MLS chips should implement **constant-time multiply**:

```
// Always use 5 cycles, regardless of operand values
cycle 0: Load operands (always)
cycle 1: Compute product (always)
cycle 2: Check for zero (masked)
cycle 3: Conditional mux (constant time)
cycle 4: Accumulate (always)
```

This prevents timing leakage of zero patterns.

### 2.3 Dummy Cycles

Insert randomized **dummy cycles** to prevent latency correlation:

```
Total execution time = 25 ns + random_delay

random_delay ∈ {0, 25, 50, 75, 100} ns (5 slots)
Distribution: uniform (entropy per instruction)
```

Overhead: ~50% additional latency, but eliminates timing channels.

---

## 3. Power Analysis Resistance

### 3.1 Threat: Differential Power Analysis (DPA)

Measure power supply current during MAC operations:

```
if (product == 0):
    P_consume = P_baseline ≈ 150 mW
else:
    P_consume = P_baseline + ΔP_multiply ≈ 160 mW

Adversary can measure ΔP and infer when products are zero.
```

### 3.2 Equalized Power (EP) Design

All MAC operations consume **identical power**:

1. **Mux all operands through identical logic paths**:
   - Zero operand → compute 0 via full ALU (not short-circuit)
   - Non-zero operand → compute via same ALU
   - Combinational logic identical in both cases

2. **Randomized dummy operations**:
   - Perform spurious MAC cycles with random operands
   - Same power profile as real MACs
   - Attacker cannot distinguish real from dummy

3. **Current source equalization**:
   - Each MAC cell draws **fixed current** from VDD_CORE
   - Current divider circuit ensures constant I regardless of data
   - Voltage ripple clamped to < 50 mV (regulatory requirement)

### 3.3 EM Side-Channel (EMI) Resistance

Electromagnetic emissions correlate with data-dependent operations.

**Mitigation:**
- Faraday cage shielding around MAC array
- Multiple VDD/VSS layers (reduced loop area)
- Decoupling capacitors: 100 nF per cell

---

## 4. Fault Injection Tolerance

### 4.1 Threat: Bit-flip Attacks

Laser/EM fault injection can flip bits in weights or intermediate values:

```
Original: w = +1 (encoded as BASE trace, 14 nm)
Attack:   Laser pulse → w = -1 (gate destroyed)
Effect:   Inference gives incorrect result
```

### 4.2 Error Detection & Correction (EDAC)

Add Hamming codes to all weight bits:

```
7-bit weight encoding:
  b0, b1, b2 = data bits (ternary: 3 bits)
  p0, p1, p2, p3 = parity bits (Hamming(7,4))

Syndrome calculation:
  s0 = p0 XOR b0 XOR b1 XOR b3
  s1 = p1 XOR b0 XOR b2 XOR b3
  s2 = p2 XOR b1 XOR b2 XOR b3

If syndrome != 0, error detected & corrected
```

**Cost:** 28% area overhead per weight byte (7 bits → 8 bits in practice).

### 4.3 Watchdog Circuits

Hardware monitors for **abnormal behavior**:

```
1. Accumulator range check
   if (|accumulator| > 2^30):
       FLAG_ERROR = 1 (detects flipped bits in result)

2. Timing monitor
   if (inference_latency > expected + 10%):
       FLAG_TIMING_FAULT = 1 (detects logic corruption)

3. Power monitor
   if (VDD_ripple > 100 mV):
       FLAG_POWER_FAULT = 1 (detects supply attack)
```

---

## 5. Secure Boot & Attestation

### 5.1 Root-of-Trust (RoT)

MLS chips include an immutable **RoT** in eFuse (one-time programmable):

```
eFuse[0:255]   = manufacturer_public_key (ECC P-256)
eFuse[256:511] = secure_boot_flag
```

At power-on:
1. Load bootloader from flash
2. Verify bootloader signature with manufacturer_public_key
3. If signature invalid, halt (secure failure)

### 5.2 Weight Attestation

Prove to external verifier that weights are correct:

```
Attestation token:
  SIGN(chip_id || weight_hash || timestamp, private_key)

Verifier can:
  1. Read weight_hash from chip register
  2. Verify signature (using manufacturer_public_key)
  3. Confirm weights match design intent

No way to forge attestation without private key.
```

---

## 6. Secure Multi-Tenancy (Future)

### 6.1 Threat: Cross-Inference Leakage

If a chip runs two users' inferences sequentially:

```
User A: model_A runs
User A's activations linger in:
  - MAC accumulators (not cleared)
  - Output register buffer
  - Possibly power supply glitches

User B: model_B runs
User B can infer User A's output via side-channels
```

### 6.2 Secure Isolation

1. **Accumulator scrubbing**: Zero all accumulators before mode switch
2. **Register flushing**: Fill output buffers with random data
3. **Power conditioning**: Discharge VDD ripple via RC networks
4. **Thermal reset**: Cool die between tenants (optional, slow)

---

## 7. Security Roadmap

| Feature | Target | Complexity | Cost |
|---------|--------|-----------|------|
| Constant-time zero-skip | v1.1 | Low | ~2% area |
| Power equalization | v1.1 | Medium | ~5% area |
| Hamming codes (EDAC) | v1.2 | Medium | ~28% area |
| Secure boot (RoT) | v1.2 | Medium | ~1% area (eFuse) |
| EM shielding | v2.0 | High | ~10% area |
| Secure multi-tenancy | v2.0 | High | ~5% logic overhead |

---

## 8. Appendix: Side-Channel Analysis References

- Kocher et al., "The Power of Timing Attacks" (1996)
- Brier et al., "Correlation Power Analysis" (2004)
- Genkin et al., "Physical Key Extraction Attacks on PCs" (2016)

---

**End of MLS Security Extension**
