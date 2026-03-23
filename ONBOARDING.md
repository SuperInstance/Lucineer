# Onboarding Guide — Mask-Lock Inference Chip

Welcome to the SuperInstance mask-lock chip project. This guide gets you productive in under an hour depending on your background.

---

## What We're Building

A **mask-locked AI inference chip**: neural network weights are physically encoded into silicon metal interconnect layers at manufacture. The chip is a complete inference engine — it accepts tokens in, outputs tokens out, with no software stack, no memory bottleneck, and no reconfigurability.

The business analogy: **game cartridges for AI**. Different chips = different models. Swap cartridges for different tasks. The "console" is your host device; the "cartridge" is the SuperInstance chip.

---

## Choose Your Path

### Path A — Hardware Engineer (ASIC / RTL)

**Your goal**: Understand the microarchitecture and contribute to RTL design.

**Day 1**
1. Read `mask_locked_plan.txt` (10 pages, covers everything end-to-end)
2. Read `docs/01-architecture.md` (systolic arrays, weight encoding, control FSM)
3. Open `src/app/rtl-studio/` — interactive Verilog design flow visualization

**Day 2**
1. Read `docs/03-thermal-engineering.md` — power budget is critical (<3W)
2. Run the thermal simulations:
   ```bash
   cd thermal_simulation
   pip install numpy scipy matplotlib
   python core_thermal.py
   python mac_array.py
   ```
3. Read `research/Thermal_Dynamics_Mathematical_Framework.md` for the full physics

**Day 3+**
1. Read `FPGA_Prototype_Implementation_Guide.md` — Gate 0 is the immediate priority
2. Read `docs/06-fpga-prototype.md` — TLMM implementation details
3. Target platform: AMD KV260 Starter Kit (~$250)
4. Key architecture reference: `neuromorphic_architecture_report.md` (bio-inspired weight storage)

**Key design decisions to understand**:
- Why 28nm and not 4nm → `mask_locked_plan.txt` §8.4
- Why ternary weights → `docs/02-quantization.md`
- Why systolic arrays → `docs/01-architecture.md` §2

---

### Path B — ML / AI Engineer

**Your goal**: Understand the quantization story and validate model selection.

**Day 1**
1. Read `docs/02-quantization.md` — ternary weights, BitNet, hardware implications
2. Read `research/Ternary_Binary_Neural_Networks_Research_Report.md` — full BitNet + iFairy analysis
3. Key paper: **BitNet b1.58** (arXiv:2402.17764) — ternary weights matching FP16 quality

**Day 2**
1. Understand TLMM (Table-Lookup MatMul):
   - Traditional MAC: multiply + accumulate = two operations, expensive in silicon
   - TLMM: table lookup replaces multiply, 10x area reduction on FPGA
   - Read `docs/06-fpga-prototype.md` §1 for full TLMM walkthrough
2. Understand the weight encoding pipeline:
   ```
   Trained Model (.ckpt)
       → Ternary quantization (AbsMean)
       → Weight compiler (PyTorch → Verilog constants)
       → GDSII metal pattern generation
       → Foundry tapeout
   ```

**Day 3+**
1. Evaluate candidate models:
   - **BitNet-b1.58-2B-4T** (recommended first target) — 2.4B params, MIT license, 4T training tokens
   - Llama-3.2-3B (INT4 baseline) — well-understood, Apache 2.0
   - Phi-3-mini (3.8B) — strong quality at small size
2. Run quantization benchmarks with `bitnet.cpp` before committing to silicon
3. Key quality threshold: <2% degradation from FP16 on MMLU/HellaSwag

**Critical questions you own**:
- What's the minimum precision that preserves acceptable quality?
- Which layers tolerate INT2? Which need INT4?
- What's the KV cache requirement for 2K context?

---

### Path C — Software / Platform Developer

**Your goal**: Build tooling, drivers, and the SDK that makes the chip usable.

**Day 1**
1. Read `mask_locked_plan.txt` §3.2 — I/O interface choices (USB / PCIe / M.2)
2. Explore the interactive visualizations to understand what the chip does:
   ```bash
   npm install && npm run dev
   # http://localhost:3000/manufacturing
   # http://localhost:3000/specs
   # http://localhost:3000/rtl-studio
   ```

**Day 2**
1. Read `docs/07-business-model.md` — understand the developer experience we're targeting
2. The chip's external interface: **send token embeddings in, receive logit distributions out**
3. No OS. No drivers in the traditional sense — the chip registers as a simple USB/PCIe peripheral

**Day 3+**
1. Reference: `download/AGENT_TASKS_GATE0_FPGA.md` — Gate 0 software tasks
2. The weight compiler is the critical software artifact:
   - Input: PyTorch checkpoint + quantization config
   - Output: Verilog memory initialization files (`.hex`, `.mem`)
   - This is novel work — no existing open-source tool does this

**What you'll build**:
- Weight compiler (PyTorch → Verilog constants)
- Host SDK (Python/C library to communicate with chip)
- Evaluation harness (compare chip output vs. software reference)
- Chip interface driver (USB/PCIe peripheral descriptor)

---

### Path D — Investor / Executive

**Your goal**: Understand the business case and current state.

1. Read `SuperInstance_Executive_Summary.md` — one-pager (2 min)
2. Read `SuperInstance_Investor_Pitch.md` — full deck (10 min)
3. Read `docs/04-competitive-landscape.md` — Taalas, Hailo, Jetson positioning
4. Read `docs/07-business-model.md` — cost structure, pricing, exit analysis
5. Read `docs/05-ip-strategy.md` — patent strategy vs. Taalas

Key numbers: `$500K seed → 18 months → Gate 0 (FPGA, 25 tok/s) → Gate 1 (MPW tapeout) → Gate 2 (10K units, first revenue)`

---

## Project State (March 2026)

| Component | Status |
|---|---|
| Technical research | ✅ Complete — 20 research cycles, thermal models, competitive analysis |
| Architecture design | ✅ Complete — systolic arrays, TLMM, weight encoding spec |
| Quantization validation | ✅ Complete — BitNet b1.58 confirmed production-ready |
| FPGA prototype | 🔄 Starting — AMD KV260, 12-week plan |
| RTL (Verilog) | 🔄 Not started — depends on Gate 0 validation |
| Patent filings | 🔄 In progress — 5 provisional applications |
| MPW tapeout | ⏳ Gate 1 — Month 7-12 |
| First silicon | ⏳ Gate 1.5 — Month 12-14 |
| Production | ⏳ Gate 2 — Month 13-18 |

---

## Critical Decisions Already Made

These are settled. Don't reopen unless you have compelling new data.

| Decision | Choice | Rationale |
|---|---|---|
| Process node | 28nm | NRE $2-4M vs $15-20M at 4nm; efficiency from architecture not process |
| Weight format | Ternary {-1, 0, +1} | Enables TLMM, no multipliers, maps to metal vias naturally |
| Target model | BitNet b1.58-2B-4T | MIT license, production-ready, 1.58-bit native training |
| FPGA platform | AMD KV260 | Best LUT density, DSP count for TLMM, affordable |
| Market | Edge (<5W, <$100) | Taalas owns data center; edge is unclaimed |
| Architecture | Weight-stationary systolic array | Optimal for inference with fixed weights |

---

## Open Questions (Need Answers)

These are active research/decision areas:

1. **Model licensing**: Explicit permission from Microsoft/Meta to encode weights in silicon?
2. **Interface**: USB 3.2 vs PCIe Gen 3 vs M.2 — what do Raspberry Pi / embedded developers actually plug into?
3. **Foundry**: TSMC vs GlobalFoundries vs MOSIS shuttle for first MPW?
4. **Quantization floor**: Can INT2 work for FFN layers? Any quality data for sub-2B ternary models?
5. **KV cache size**: 2K context requires ~16MB SRAM at 2B params — what's the area cost at 28nm?
6. **Cartridge connector**: Physical form factor and connector standard for the swappable cartridge model?

---

## Glossary

| Term | Definition |
|---|---|
| **Mask-locking** | Encoding neural network weights permanently into silicon metal interconnect layers during chip manufacture |
| **TLMM** | Table-Lookup Matrix Multiplication — replaces multiply-accumulate with table lookups; 10x area reduction |
| **Systolic array** | 2D grid of processing elements where data flows in a wave pattern; ideal for matrix multiply |
| **Ternary weights** | Weights constrained to {-1, 0, +1}; eliminates multipliers, enables mask-ROM storage |
| **BitNet b1.58** | Microsoft's natively-ternary LLM training framework; 1.58 bits/weight (log₂(3)) |
| **GDSII** | The file format for chip layouts sent to foundries; describes every metal layer geometrically |
| **MPW** | Multi-Project Wafer — shared tapeout that splits mask cost across multiple designs; path to affordable first silicon |
| **NRE** | Non-Recurring Engineering — one-time cost for mask set, design, verification; ~$2-4M at 28nm |
| **KV cache** | Key-Value cache for transformer attention; the only mutable SRAM state in the chip |
| **Tapeout** | Submitting final GDSII files to a foundry to begin manufacturing |
| **PDK** | Process Design Kit — foundry-provided library of standard cells and design rules |
| **Taalas** | Best-funded competitor ($219M); uses mask-locked approach for data center (200W+), not edge |

---

## Where to Ask Questions

- Technical architecture → open a GitHub Discussion tagged `architecture`
- Quantization / model quality → tagged `ml`
- Thermal / power → tagged `hardware`
- Business / strategy → tagged `strategy`
- FPGA implementation → tagged `fpga`

When filing an issue, include: your background, what you read, what you expected, what you found.

---

## Contributing

1. Fork, create a branch named `your-name/description`
2. Research changes → update the relevant `docs/` file
3. Code changes → open PR against `main`
4. All RTL changes require simulation evidence (waveform screenshots or testbench output)
5. All quantization claims require benchmark data (MMLU/HellaSwag perplexity numbers)

See `final_delivery/core_documents/` for the full technical specification that PRs must stay consistent with.
