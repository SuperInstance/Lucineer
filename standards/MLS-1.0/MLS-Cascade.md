# MLS 1.0 Cascade & Privacy Escalation Specification

**Mask-Lock Standard (MLS) v1.0 — Multi-Chip Cascading**
**Status:** Reference Implementation
**Date:** 2026-03-24
**Revision:** 1.0

---

## 1. Multi-Chip Cascade Architecture

MLS supports **cascading multiple mask-locked chips** to scale inference capacity while maintaining **hardware-enforced privacy guarantees**. This enables:

- **Horizontal scaling**: Chain N chips for N× throughput
- **Privacy escrow**: Blind aggregation prevents any single chip from seeing raw activations
- **Fault tolerance**: If one chip fails, cascade halts gracefully (no partial leakage)

### 1.1 Cascade Topology

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Chip 0   │────→│ Chip 1   │────→│ Chip N-1 │
│ (Layer 0)│ UCIe│ (Layer 1)│ UCIe│(Layer N) │
└──────────┘     └──────────┘     └──────────┘
     ↑                                   ↓
     └─────────────────────────────────→
          Host Control & Data Flow
```

**Cascade Properties:**
- **Linear chain**: No branching or mesh topologies
- **Unidirectional data flow**: Layer i → Layer i+1
- **Synchronized execution**: All chips run in lockstep (shared clock via UCIe)

---

## 2. Privacy Escrow Protocol

### 2.1 Problem: Information Leakage

In a naive cascade:
```
Chip 0 computes: logits_0 = MAC(weights_0, input)
Chip 1 reads:   logits_0 (LEAKED!)
```

**Chip 1 can infer properties of the original input**, breaking privacy.

### 2.2 Solution: Blind Aggregation

Each chip adds **cryptographic noise** before forwarding:

```
┌────────────────────────────────────┐
│ Chip i                             │
├────────────────────────────────────┤
│                                    │
│  1. Receive activation_in          │
│     (from Chip i-1)                │
│                                    │
│  2. Compute logits_i = MAC(W, a)  │
│                                    │
│  3. Generate random_noise_i        │
│     (from TRNG, burned at mfg)    │
│                                    │
│  4. Mask output:                   │
│     masked_out = logits_i          │
│                 XOR random_noise_i │
│                                    │
│  5. Send masked_out to Chip i+1   │
│     (Chip i+1 cannot decode)       │
│                                    │
└────────────────────────────────────┘
```

### 2.3 Key Ring & Escrow Agent

**Only the host** holds the master key to unmask:

```
Master Key = {random_noise_0, random_noise_1, ..., random_noise_N}
```

Stored in **secure enclave** (TPM 2.0 or equiv).

**Unmask Formula:**
```
logits_0 = masked_0 XOR random_noise_0
logits_1 = masked_1 XOR random_noise_1
...
```

### 2.4 Multi-Chip Cascade Example

Input: image of digit "3"

```
Host → Chip 0: image (unencrypted)
        ↓
Chip 0 computes logits_0 = [-512, 1024, -256, 2048, ...]
       Adds noise_0: random 256-bit XOR
       Sends masked_0 to Chip 1
       (Chip 1 sees garbage)

Chip 1 receives masked_0 from Chip 0
       Applies transformations (e.g., batchnorm)
       Computes logits_1
       Adds noise_1
       Sends masked_1 to Chip 2

...

Chip N receives masked_N-1
      Computes final logits_N
      Adds noise_N
      Sends masked_N to Host

Host unmasks:
  logits_N = masked_N XOR noise_N
  logits_N-1 = masked_N-1 XOR noise_N-1
  ...
  Result: class 3 ✓
```

**Privacy guarantee:** No intermediate chip can infer properties of the input image without all keys.

---

## 3. UCIe Link Protocol

Cascade chips communicate via **Universal Chiplet Interface** (UCIe):

### 3.1 UCIe Physical Layer

```
Configuration        Specification
──────────────────────────────────
Lanes:               16
Lane speed:          32 Gbps
Aggregate bandwidth: 512 GB/s (unidirectional)
Latency:             < 100 ns (end-to-end)
Clock:               Synchronous 1 GHz PLL
```

### 3.2 Packet Format

```
[Byte 0:3]    Header (CRC)
[Byte 4:7]    Data type (0=activation, 1=logit, 2=control)
[Byte 8:15]   Payload length
[Byte 16:N]   Encrypted/masked payload
[Byte N+1:N+4] Trailing CRC
```

### 3.3 Flow Control

If downstream chip is busy:
```
Upstream chip halts transmission
Waits for READY signal
Resumes after 1 cycle latency
```

---

## 4. Cascade Control Interface

### 4.1 Register Map (Extends MLS-Core.md)

```
Offset  Name              R/W  Purpose
──────────────────────────────────────────
0x80    CASCADE_CTRL      RW   Enable/disable cascade
0x84    DOWNSTREAM_ID     RW   ID of next chip
0x88    UPSTREAM_ID       RW   ID of previous chip
0x8C    NOISE_KEY         WO   Write cascade noise (for escrow)
0x90    CASCADE_STATUS    R    Link status (ready, error, latency)
0x94    PACKET_COUNT      R    Total packets forwarded
0x98    ERROR_COUNT       R    Link errors
```

### 4.2 Cascade Enable Sequence

```
1. Write DOWNSTREAM_ID (chip to receive results)
2. Write UPSTREAM_ID (chip to receive from)
3. Write NOISE_KEY (chip-specific XOR key)
4. Write CASCADE_CTRL = 0x01 (enable)
5. Poll CASCADE_STATUS until STATUS.ready = 1
```

### 4.3 Example: 3-Chip Cascade

```python
# Host configuration
chips = [
    {"id": 0, "downstream": 1, "noise_key": 0xabc123...},
    {"id": 1, "downstream": 2, "noise_key": 0xdef456...},
    {"id": 2, "downstream": -1, "noise_key": 0x789abc...},  # Terminal
]

for chip_config in chips:
    chip_addr = base_address + (chip_config['id'] * 0x10000)
    write_register(chip_addr + 0x84, chip_config['downstream'])
    write_register(chip_addr + 0x8C, chip_config['noise_key'])
    write_register(chip_addr + 0x80, 0x01)  # Enable

# Execute inference
send_activation(chip_0_addr, activation_data)
result = wait_for_result(chip_2_addr)
```

---

## 5. Fault Tolerance & Diagnostics

### 5.1 Link Heartbeat

Each chip sends **heartbeat packet** every 1 ms (even if idle):

```
Heartbeat format:
  [Type] = 0xFF (control)
  [Payload] = chip_id, timestamp, status_flags
```

If downstream chip doesn't acknowledge within 10 ms, **halt cascade** and set error flag.

### 5.2 Error Recovery

```
Scenario: Chip 1 fails
├─ Chip 0 detects no ACK
├─ Chip 0 sets STATUS.error = 1
├─ Host reads error, initiates recovery:
│  ├─ Disable failed chip
│  ├─ Rewire bypass (if available)
│  └─ Restart inference from Chip 0
```

### 5.3 Packet-Level CRC

Every packet has **32-bit trailing CRC**:

```
CRC32 = hash(header || data)
```

If CRC fails:
- Downstream chip discards packet
- Sends NACK to upstream
- Upstream retransmits (up to 3 attempts)
- On 3rd failure, halt cascade

---

## 6. Cascade Privacy Theorem

### 6.1 Informal Statement

> **For a cascade of N MLS chips with independent noise keys, no single chip can infer more than 2^(-256) probability of correct input without knowing all N noise keys.**

### 6.2 Proof Sketch

1. **Noise independence**: Each chip's noise is generated at fabrication time, independent of all others
2. **XOR properties**: a XOR b reveals zero information about a without knowing b (information-theoretic)
3. **Key secrecy**: Only host holds all keys; keys are never sent across cascade links
4. **Implication**: Compromising Chip i only reveals logits_i ⊕ noise_i, which is indistinguishable from random

**Corollary:** Even if attacker physically extracts Chip i, they learn nothing about activations from other layers.

---

## 7. Cascade Compliance Checklist

An MLS cascade implementation **must**:

- [ ] Support UCIe links at 32 Gbps minimum
- [ ] Implement blind aggregation with XOR masking
- [ ] Provide noise key register (0x8C) for escrow
- [ ] Generate independent noise at chip fabrication time
- [ ] Implement packet CRC & flow control
- [ ] Support cascade enable/disable via register 0x80
- [ ] Log packet count & error count for diagnostics
- [ ] Pass cascade tests (compliance_tests/test_cascade.py)

---

## 8. Revision History

| Version | Date       | Changes |
|---------|-----------|---------|
| 1.0     | 2026-03-24 | Initial release with privacy escrow |

---

**End of MLS Cascade & Privacy Escalation Specification**
