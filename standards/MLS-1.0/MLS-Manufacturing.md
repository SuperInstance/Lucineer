# MLS 1.0 Manufacturing Specification

**Mask-Lock Standard (MLS) v1.0 — Foundry Interface Requirements**
**Status:** Reference Implementation
**Date:** 2026-03-24
**Revision:** 1.0

---

## 1. Manufacturing Overview

The **mask-lock** concept encodes weights **during metallization**, making them immutable post-fabrication. This section specifies foundry requirements, design rules, and hand-off procedures.

---

## 2. Mask Design Rules

### 2.1 Weight Encoding in Metal Layers

All MLS chips must follow **MLS Design Rules (MDR)** for weight encoding:

| Layer | Min Width | Max Width | Pitch | Purpose |
|-------|-----------|-----------|-------|---------|
| M1    | 0.28 μm   | 10 μm     | 0.40 μm | Power rails |
| M2    | 0.14 μm   | 0.42 μm   | 0.20 μm | Weight bits (row) |
| M3    | 0.28 μm   | 1.0 μm    | 0.40 μm | Interconnect |
| M4    | 0.14 μm   | 0.42 μm   | 0.20 μm | Weight bits (col) |
| M5    | 0.28 μm   | 0.84 μm   | 0.40 μm | Carry routing |
| M6    | 0.28 μm   | 0.84 μm   | 0.40 μm | Control (mux select) |

**Trace Width Encoding (ternary example @ 7nm process):**

```
State   Intended   Actual Width   MDR Code
────────────────────────────────────────────
  0     THIN       1.0× λ         W_THIN
 +1     BASE       2.0× λ         W_BASE
 -1     WIDE       3.0× λ         W_WIDE

λ = 7 nm (N7 example)
Actual widths: 7nm, 14nm, 21nm
```

### 2.2 Design Rule Checking (DRC)

Foundry must verify:

```
1. No adjacent traces on M2/M4 differ by more than 1 state
   (to avoid cross-talk coupling)

2. M2 traces spacing ≥ 0.20 μm (minimum pitch)

3. M4 traces spacing ≥ 0.20 μm

4. All ternary encodings are valid (no intermediate widths)

5. Via pattern matches (M1→M2, M3→M4, M5→M6)
```

**Tools:** Foundry's DRC deck must include MLS-specific rules.

---

## 3. Handoff Format

### 3.1 Design Data Package (DDP)

The chip designer delivers to foundry:

```
DDP/
├── rtl/                    # RTL source (Verilog/SystemVerilog)
├── synthesis/
│   └── chip.v              # Synthesized netlist
├── placement/
│   └── chip.def            # Placement constraints
├── routing/
│   └── chip.gds            # GDS II (final routed design)
├── weight_manifest.json    # Weight specifications
├── metal_layer_config.txt  # M2/M4 width assignments
├── compliance_report.pdf   # Pre-tape-out verification
├── safety_checklist.md     # 50-point review
└── README.md               # Build instructions
```

### 3.2 Weight Manifest (JSON)

```json
{
  "version": "1.0",
  "chip_name": "MLS-Ternary-256",
  "process": "TSMC N7",
  "foundry": "TSMC",
  "design_cycle": "2026-03-24",
  "weights": {
    "quantization": "ternary",
    "layer_count": 16,
    "total_weights": 262144,
    "mac_array_size": "256x256",
    "weight_memory": {
      "layer_0": {
        "start_byte": 0,
        "size_bytes": 262144,
        "m2_layer": true,
        "m4_layer": true,
        "sparse": false
      }
    }
  },
  "metal_mapping": {
    "M2": {
      "purpose": "weight_row_bits",
      "min_width_nm": 7,
      "nominal_widths_nm": [7, 14, 21],
      "encoding": "ternary_lsb"
    },
    "M4": {
      "purpose": "weight_col_bits",
      "min_width_nm": 7,
      "nominal_widths_nm": [7, 14, 21],
      "encoding": "ternary_msb"
    }
  },
  "compliance": {
    "sha256_weights": "a3d5f8e...",
    "tests_passed": 47,
    "tests_total": 50
  }
}
```

### 3.3 Metal Layer Configuration

```
# metal_layer_config.txt
# Format: [X_coord] [Y_coord] [Layer] [Width_Code] [Value]
#
# Width_Code: 0=THIN (1λ), 1=BASE (2λ), 2=WIDE (3λ)
# Layer: 2=M2, 4=M4
# Value: -1, 0, +1 (expected weight)

0 0 M2 1 +1
0 0 M4 0  0
0 1 M2 2 -1
0 1 M4 1 +1
...
(262144 entries for 256×256 array)
```

---

## 4. Foundry Process

### 4.1 Wafer Build

```
Stage              Timeline     Actions
──────────────────────────────────────────────
Pre-tape           T+0          Receive DDP, verify DRC
Planning           T+1          Generate masks (28 layers)
Lithography        T+2–T+4      Pattern wafers
Deposition         T+5–T+10     Grow oxide, deposit metal
Metallization      T+11–T+13    ⭐ M2/M4 weights (critical)
                                 Apply photoresist w/ weight codes
                                 Etch to exact widths
CMP                T+14–T+16    Polish back to nominal
High-K/Metal Gate  T+17–T+20    Complete backend
Testing            T+21–T+22    Wafer probing (functional + compliance)
Packaging          T+23–T+25    Bump, mount, test
```

### 4.2 Metallization (Critical Stage)

**Step: Deposit M2 Layer**

1. **Lithography**: Mask defines M2 pattern
2. **Etch**: Dry etch to specified widths:
   - THIN (1λ): etch time = t₀
   - BASE (2λ): etch time = 1.8t₀ (monitor critical dimension)
   - WIDE (3λ): etch time = 2.6t₀
3. **In-situ measurement**: SEM confirms widths ±5%
4. **CMP**: Polish to flat surface (~0.1 μm overfill)

**Quality gates:**
- All THIN traces: 7 nm ± 0.5 nm
- All BASE traces: 14 nm ± 0.7 nm
- All WIDE traces: 21 nm ± 1.0 nm
- No bridges (shorts between adjacent traces)

---

## 5. Post-Fabrication Verification

### 5.1 Wafer Probing

**Functional Tests:**
- Power-on reset works
- Clock distribution stable
- All registers accessible
- MAC array responds to commands

**Compliance Tests:**
- Run compliance_tests/test_suite.py
- Verify weight hash matches expected SHA256
- Check timing closure (setup/hold)
- Measure power consumption

### 5.2 Sample Defect Analysis

For every wafer, analyze **5 chips** with SEM:

```
1. Cross-section M2 layer → measure trace widths
2. Cross-section M4 layer → verify weight bits
3. SEM image at 10,000× magnification
4. Compare to design intent
5. Report: "All traces within ±5% of design"
```

**Acceptance criteria:**
- ≥ 95% of weight bits match design
- ≥ 99% functional tests pass
- No systematic shorts or opens

---

## 6. Test Program (Testvec)

### 6.1 Chip Test Coverage

```
Test ID   Purpose                          Duration
─────────────────────────────────────────────────────
T001      Power-on reset                   10 ms
T002      Clock distribution               50 ms
T003      Register read/write access       100 ms
T004      MAC unit functionality           200 ms
T005      Ternary multiplication (all 9)   500 ms
T006      Accumulator saturation           100 ms
T007      Input/output buses               50 ms
T008      Power domain isolation           100 ms
T009      Thermal sensor (if present)      50 ms
T010      Compliance hash verification     200 ms
─────────────────────────────────────────────────────
Total:                                     ~1.4 seconds
```

### 6.2 Compliance Hash Test

```
Test T010: Verify weight hash at boot

1. Hardware computes SHA256(all_weight_bytes)
2. Read COMPLIANCE_HASH register (0x101C)
3. Compare to golden SHA256 from weight_manifest.json
4. If match: PASS, chip is MLS-certified
   If mismatch: FAIL, chip discarded (fabrication defect)
```

---

## 7. Certification & Labeling

### 7.1 MLS Compliance Certificate

Each passing chip receives a **digital certificate**:

```json
{
  "mls_certified": true,
  "version": "1.0",
  "chip_id": "MLS-2026-0001-A3",
  "die_coordinates": "X12 Y34",
  "wafer_id": "W2026-1234-5",
  "foundry": "TSMC",
  "process": "N7",
  "fabrication_date": "2026-03-24",
  "weight_hash": "a3d5f8e12c4b...",
  "quantization": "ternary",
  "mac_count": 256,
  "compliance_tests": {
    "total": 50,
    "passed": 50,
    "failed": 0
  },
  "signer": "TSMC_COMPLIANCE_ENGINE_v1",
  "signature": "0x...",
  "issued": "2026-03-24T15:30:00Z"
}
```

Stored in **eFuse register** on chip (immutable, tamper-evident).

### 7.2 Traceability

Each chip is labeled with:
- **Die ID**: (X, Y) coordinates on wafer
- **Wafer Lot**: W2026-1234-5 (implies foundry, date, process)
- **QR Code**: Links to digital certificate
- **Serial Number**: MLS-2026-0001-A3 (sequential)

---

## 8. Design Checklist (Pre-Tape-Out)

Before sending to foundry, design team must verify:

- [ ] All weight bits correctly encoded in M2/M4
- [ ] M2/M4 traces pass DRC (width, spacing, no shorts)
- [ ] Weight manifest (JSON) complete & signed
- [ ] Metal layer config matches GDS II
- [ ] Compliance tests pass (50/50)
- [ ] Timing closure: all paths meet 5ns clock
- [ ] Power analysis: cores + I/O ≤ 255 mW
- [ ] Power domains properly isolated (separate VDD)
- [ ] Register map complete (offset 0x1000 baseline)
- [ ] Test program (testvec) ready for wafer probing
- [ ] SHA256 weight hash pre-computed
- [ ] No backdoors, test modes, or side channels
- [ ] Documentation complete (RTL comments, diagrams)

---

## 9. Revision History

| Version | Date       | Changes |
|---------|-----------|---------|
| 1.0     | 2026-03-24 | Initial release with TSMC N7 baseline |

---

**End of MLS Manufacturing Specification**
