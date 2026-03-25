# Chip Design 101 — From Python to Silicon

## Course Overview

A 12-week hands-on course that takes you from Python programmer to chip
designer. You will design, simulate, and deploy a mask-locked inference chip
using open-source tools.

**By the end, you will have:** A working MLS-compliant chip design running on
a real FPGA, with a GDSII tape-out ready for fabrication.

| | |
|---|---|
| **Duration** | 12 weeks, ~10 hours/week |
| **Prerequisites** | Python proficiency, basic ML concepts |
| **Hardware** | None required (Codespaces), or Xilinx KV260 ($249) for labs 3+ |
| **Certification** | MLS-Associate (included), MLS-Professional ($199 exam) |

## Pricing

| Tier | Price | Includes |
|------|-------|----------|
| **Open Access** | Free | All course content, readings, exercises |
| **Lab Access** | $299/month | Codespaces environments, FPGA cloud access |
| **Full Course** | $999 one-time | Labs + 1:1 mentorship + certification exam |
| **Enterprise** | Contact us | Team licenses, custom labs, on-site training |

---

## Weekly Schedule

### Module 1: Foundations (Weeks 1–2)

#### Week 1 — Digital Logic from First Principles
`01_digital_logic/`

- Boolean algebra, truth tables, Karnaugh maps
- Combinational logic: MUX, decoder, ALU
- Sequential logic: flip-flops, registers, FSMs
- **Exercise:** Build a 4-bit ALU in Python, then translate to gates
- **Lab checkpoint:** Python logic simulator passes all tests

#### Week 2 — SystemVerilog for Hardware Design
`02_systemverilog/`

- HDL mindset: "describing hardware" vs. "writing software"
- SystemVerilog fundamentals: `always_ff`, `always_comb`, `generate`
- Parameterized modules, interfaces, assertions
- Simulation with Verilator: compile, run, view waveforms
- **Exercise:** Implement a pipelined adder in SystemVerilog
- **Lab checkpoint:** Adder passes Verilator testbench

### Module 2: The Ternary MAC (Weeks 3–5)

#### Week 3 — Understanding the RAU
`02_systemverilog/` (continued)

- Study the RAU (Rotation-Accumulate Unit) from `download/ternaryair/hardware/rtl/rau.sv`
- Why ternary? The BitNet b1.58 quantization paper
- Weight encoding: `{-1, 0, +1}` → 2-bit `{10, 01, 00}`
- Zero-skip optimization: skip computation when weight = 0
- **Exercise:** Write a RAU testbench that checks all 9 weight×activation pairs
- **Reference:** `fpga_lab/testbenches/pe_tb.sv`

#### Week 4 — Building the Synaptic Array
`02_systemverilog/` (continued)

- From one RAU to an N×M array (systolic architecture)
- Column adder trees for partial sum reduction
- Parameterized `generate` blocks for scalable arrays
- **Exercise:** Build a 4×4 synaptic array, simulate matrix multiply
- **Reference:** `download/ternaryair/hardware/rtl/synaptic_array.sv`

#### Week 5 — Weight ROM and Mask-Locking
`06_mask_lock_design/`

- The mask-lock concept: weights as metal via patterns
- Simulation model vs. silicon reality
- Security properties: why geometry beats encryption
- **Exercise:** Implement a weight ROM, verify with known test vectors
- **Reference:** `download/ternaryair/hardware/rtl/weight_rom.sv`

### Module 3: Chip Integration (Weeks 6–8)

#### Week 6 — Full Chip Architecture
`03_synthesis/`

- Top-level design: FSM + array + KV cache + register file
- A2A register map (MLS-Interface spec)
- Command set: `LOAD_WEIGHTS`, `RUN_INFERENCE`, `READ_LOGITS`
- **Exercise:** Write the control FSM for a minimal inference engine
- **Reference:** `download/ternaryair/hardware/rtl/top_level.sv`

#### Week 7 — Synthesis and Timing
`03_synthesis/`

- Logic synthesis with Yosys (open-source)
- Technology mapping: your RTL → standard cells
- Static timing analysis: setup/hold, clock skew, slack
- SDC constraints: clock definitions, I/O delays
- **Exercise:** Synthesize your MAC array for sky130, analyze timing report
- **Lab checkpoint:** Timing closure at 200 MHz

#### Week 8 — Place and Route
`04_pnr/`

- Floorplanning: arranging blocks on the die
- Placement: standard cells in rows
- Clock tree synthesis: balanced clock distribution
- Routing: metal layers, via patterns
- Power delivery network (PDN): VDD/VSS grid
- **Exercise:** Run OpenROAD flow on your design
- **Lab checkpoint:** DRC/LVS clean layout

### Module 4: Compilers and Software (Weeks 9–10)

#### Week 9 — The CLAWC Compiler
`05_mlir_compilers/`

- Compiler architecture: frontend → middle-end → backend
- ONNX model loading and graph extraction
- Quantization passes: FP32 → ternary
- Scheduling: tiling large operations for the MAC array
- **Exercise:** Add an optimization pass to CLAWC
- **Reference:** `compiler/clawc/`

#### Week 10 — MLIR Concepts and Optimization
`05_mlir_compilers/`

- Multi-Level IR: why compilers need multiple abstractions
- Dialect design: from "tensor operations" to "MAC instructions"
- The mask-lock pass: converting DRAM weights to ROM constants
- **Exercise:** Write a custom CLAWC pass (memory_flatten)
- **Reference:** `compiler/passes/`

### Module 5: Deployment (Weeks 11–12)

#### Week 11 — FPGA Prototyping
`06_mask_lock_design/`

- Porting your design to the KV260
- AXI4-Lite interface for PS-PL communication
- Loading weights, running inference, reading results
- Power and thermal measurement
- **Exercise:** Deploy on KV260 or Codespaces emulation
- **Lab checkpoint:** Inference produces correct output

#### Week 12 — Tape-Out and Capstone
`06_mask_lock_design/`

- GDSII generation with CLAWC + OpenROAD
- Design rule checking (DRC) and layout vs. schematic (LVS)
- Preparing for fabrication: sky130 shuttle run
- **Capstone:** Complete your MLS-compliant chip design
- **Deliverables:** RTL, testbench, GDSII, BOM, documentation

---

## Assessment

| Component | Weight | Description |
|-----------|--------|-------------|
| Weekly exercises | 30% | Auto-graded via testbench pass/fail |
| Lab checkpoints | 30% | Mentor-reviewed milestones |
| Capstone project | 30% | Complete chip design with documentation |
| Peer review | 10% | Review another student's design |

## Tools (All Pre-Installed in Codespaces)

| Tool | Purpose | License |
|------|---------|---------|
| Verilator | RTL simulation | Open source |
| Yosys | Logic synthesis | Open source |
| OpenROAD | Place & route | Open source |
| GTKWave | Waveform viewer | Open source |
| CLAWC | MLS compiler | MIT |
| Python 3.12 | Scripting, analysis | Open source |
| Vivado WebPACK | FPGA synthesis | Free (Xilinx) |

## Instructors

Designed by the SuperInstance Ranch team. Community mentors available for
1:1 office hours (Full Course tier).
