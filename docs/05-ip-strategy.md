# IP Strategy — Patents, FTO, and Competitive Defense

**Synthesized from**: `research/Patent_IP_Strategy_DeepDive_Report.md`, `download/DeepResearch_Patent_IP_Strategy.md`, `download/DeepResearch_iFairy_IP_Relationship.md`

---

## Strategic Imperative

File provisional patents **within 7 days** of reading this document. Taalas has $219M in funding, the same core technology concept, and no patents found as of March 2026. This window closes fast. A provisional filing costs ~$3,000 and establishes priority date for 12 months while you build out the full application.

The goal: establish SuperInstance as the **dominant IP holder for edge mask-locked inference** before any well-funded competitor (Taalas, Samsung, Hailo) files blocking patents.

---

## Patent Landscape Analysis

### USPTO Search Results (March 2026)

| Search Term | Results | Blocking Risk |
|---|---|---|
| "Taalas" assignee | **No patents found** | N/A |
| "mask ROM neural network" | No direct hits | NONE |
| "hardwired neural network weights" | No direct hits | NONE |
| "metal interconnect weight encoding" | No direct hits | NONE |
| "mask-locked inference" | No direct hits | NONE |
| "ternary weight silicon encoding" | No direct hits | NONE |
| "cartridge AI inference" | No direct hits | NONE |

**Key finding**: The specific combination of mask-locking + edge inference + ternary weights + cartridge form factor has no prior art in the patent literature. This is an extraordinary opportunity — the technology is novel, working, and unprotected by anyone.

### Related Prior Art That Exists (Design-Around Required)

| Patent | Owner | Risk | Design-Around |
|---|---|---|---|
| SRAM-based weight storage | Various (Intel, ARM) | LOW | Our weights are in metal, not SRAM |
| ROM-based lookup tables | Texas Instruments | LOW | Lookup is in activation space, not weight space |
| Mask ROM for microcode | IBM (expired) | NONE | Expired, and different application |
| Neural network ASIC | Google (TPU) | LOW | No mask-locking, no ternary weights |
| BitNet training method | Microsoft | MEDIUM | They own training; we license weights under MIT |

**Freedom to Operate**: Clear path exists. Our specific implementation — encoding transformer weights into metal interconnect layers at manufacture for edge inference — is novel and unencumbered.

---

## Patent Portfolio Strategy

### Tier 1 — File Immediately (Provisional, ~$3K each)

**Patent 1: Mask-Locked Edge Inference Architecture**

Claims:
1. Method of encoding neural network weights into semiconductor metal interconnect layers
2. A mask-locked inference chip wherein weights are represented as via connections between metal layers
3. Edge AI accelerator with zero memory bandwidth requirement for inference weights
4. Chip manufacturing method: model checkpoint → ternary quantization → via placement → tapeout

**Patent 2: Cartridge-Based AI Hardware Platform**

Claims:
1. A physical AI cartridge comprising: inference chip, connector, form factor specification
2. System comprising: host device, cartridge interface, swappable inference cartridges
3. Method of model deployment via physical cartridge substitution (no software update required)
4. Cartridge form factor with model metadata encoded in non-volatile storage

**Patent 3: Ternary Weight Encoding in Metal Interconnects**

Claims:
1. Ternary weight encoding scheme using via presence/absence/polarity
2. Method of mapping {-1, 0, +1} weights to metal layer routing
3. Weight compiler tool: transformer checkpoint → via placement specifications
4. Hilbert curve spatial layout for ternary weight via placement (locality optimization)

### Tier 2 — File Within 90 Days (Full Application, ~$15-25K each)

**Patent 4: Thermal Isolation for Weight Encoding Vias**

Claims:
1. Spine-neck thermal isolation structures between weight encoding regions and compute arrays
2. Bio-inspired thermal management method for mask-locked inference dies
3. Via placement with thermal isolation to maintain weight integrity across temperature range

**Patent 5: Swarm Coordination for Mask-Locked Cartridges**

Claims:
1. Multi-cartridge inference system with inter-cartridge communication protocol
2. Distributed inference across multiple mask-locked chips (model parallelism)
3. Cartridge-to-cartridge token routing for pipeline parallelism

### Tier 3 — Defensive Publications (No Cost, Within 180 Days)

Publish technical details to establish prior art and prevent competitors from patenting:
- TLMM implementation details for ternary inference
- KV cache architecture for fixed-function inference chips
- Benchmark methodology for comparing mask-locked vs. programmable chips
- Weight compiler intermediate representation specification

**Why defensive publications?** They prevent anyone else from patenting the disclosed concepts. Once published, they're prior art forever. This is especially important for implementation details that are obvious once the core patents are filed.

---

## Model IP Analysis

### BitNet b1.58 (Microsoft) — MIT License

**License**: MIT (confirmed)
**Patent grant**: MIT license does NOT include explicit patent grant
**Risk**: Microsoft may hold process patents on the AbsMean quantization training method

**Mitigation**:
- We don't use Microsoft's training code — we use the resulting model weights
- The trained weights themselves are model outputs, not code
- Engage Microsoft for explicit commercial silicon embedding permission
- Fallback: train our own ternary model from scratch using the published architecture

**Recommendation**: Reach out to Microsoft Research for a silicon embedding agreement. They want BitNet deployed; we're the hardware that does it.

### iFairy / Fairy±i (Peking University) — Apache 2.0 + Patent Grant

**License**: Apache 2.0 (confirmed)
**Patent grant**: **YES** — Apache 2.0 includes an explicit royalty-free patent grant
**Risk**: LOW — free to use commercially in silicon

Apache 2.0 states: *"Each Contributor hereby grants to You a perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable patent license..."*

**This is the preferred licensing model for second-generation chips.** iFairy weights can be embedded in silicon with full legal clarity.

### Llama 3.x (Meta) — Custom License

**License**: Llama 3 Community License
**Silicon embedding**: NOT addressed in current license
**Risk**: MEDIUM — license is ambiguous on hardware encoding

**Action**: Engage Meta's business development team for explicit hardware embedding agreement. This is a new use case; Meta has incentive to enable it (expands Llama deployment surface).

**Fallback**: Use BitNet b1.58 (MIT) as primary; avoid Llama until license clarified.

---

## Taalas Monitoring Protocol

Taalas is the highest-priority patent monitoring target. Set up automated monitoring:

1. **USPTO Patent Full-Text Database**: Weekly alert for assignee "Taalas" or inventor "Bajic"
2. **Google Patents**: Monthly search for "mask ROM inference chip" and variations
3. **WIPO PatentScope**: Monthly search for PCT applications by Taalas
4. **Defensive action trigger**: If Taalas files broad claims on mask-locking, file continuation claims to establish narrower prior art

**Key distinction to preserve**: Taalas uses "mask ROM recall fabric" with SRAM (4-bit, data center). Our approach is "metal interconnect ternary weight encoding" (1.58-bit, edge). These are different enough to coexist — but the claims need to be carefully drawn to not overlap.

---

## Budget

| Activity | Estimated Cost | Timeline |
|---|---|---|
| 3× Provisional patents | $9,000 | Immediately |
| Freedom-to-operate study | $15,000-25,000 | Month 1-2 |
| 3× Full utility applications | $45,000-75,000 | Month 2-6 |
| 2× Additional provisionals (Tier 2) | $6,000 | Month 2-3 |
| International PCT filing (key claims) | $40,000-60,000 | Month 6-12 |
| Ongoing monitoring and prosecution | $30,000-50,000/year | Ongoing |
| **Total 5-year program** | **$455,000-575,000** | — |

**This is included in the $500K seed ask.** Patent protection is not optional — it's the primary defense against Samsung, Taalas, or any well-funded entrant copying the design.

---

## Key IP Contacts

- **Patent counsel**: Engage a semiconductor-specialized patent firm (Wilson Sonsini, Fenwick & West, or Cooley LLP — all have strong chip IP practices)
- **Microsoft BitNet**: Research licensing contact at Microsoft Research Asia
- **Meta Llama**: business@meta.com for commercial licensing
- **Peking University iFairy**: Apache 2.0 — no contact needed, free to use
