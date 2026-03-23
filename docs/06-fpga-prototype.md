# FPGA Prototype — Gate 0 Implementation Guide

**Synthesized from**: `FPGA_Prototype_Implementation_Guide.md`, `download/FPGA_Development_Guide_v2.docx`, `download/AGENT_TASKS_GATE0_FPGA.md`, `research/nvidia_enhanced_rtl/`, `research/twelve_round_framework/`

---

## Gate 0 Goal

Demonstrate **25-50 tokens/second** of BitNet b1.58-2B inference on an FPGA platform, at **<5W**, with output matching software reference within floating-point rounding tolerance.

This proves:
1. The TLMM (Table-Lookup MatMul) approach works for ternary inference
2. The target power budget is achievable
3. The weight encoding pipeline (model → hardware) can be automated
4. The architecture is correct before committing $2-4M to silicon

**Timeline**: 12 weeks. **Budget**: ~$50K total.

---

## Platform Selection

### Recommended: AMD KV260 Starter Kit

| Spec | Value |
|---|---|
| FPGA | Zynq UltraScale+ XCZU5EG |
| LUTs | 234K |
| BRAMs | 144 × 36Kb = 5.1MB |
| DSP48E2 | 1,248 |
| Price | ~$249 |
| I/O | USB 3, PCIe, GPIO |
| Power | 15W max (we'll use <5W) |

**Why KV260**:
- Best LUT density per dollar for TLMM implementation
- Large enough BRAM for KV cache (though we'll need HBM workaround)
- Active community, good tooling (Vivado/Vitis)
- Similar I/O to target chip interface (USB, PCIe)

**Alternative if KV260 unavailable**: AMD ZCU102 (~$2,500, overkill but proven) or Intel Cyclone V ($150, tight but possible for 1B model only).

---

## TLMM Implementation

TLMM (Table-Lookup Matrix Multiplication) is the core algorithm for ternary inference on FPGAs. It replaces multiply-accumulate with table lookups.

### Concept

```
Standard INT8 MAC:
  output += activation[i] * weight[i]    ← requires DSP48 multiplier

TLMM for ternary weights:
  // Precompute: lut[i] = activation value at index i
  output += (weight == +1) ?  lut[activation_index] :
            (weight == -1) ? -lut[activation_index] : 0
```

For 4-bit activation quantization (16 levels):
- LUT has 16 entries × 16-bit values = 32 bytes per row
- One lookup per weight per input token
- No multipliers, just address + mux

### 10x Area Savings vs. INT8 MAC

| Implementation | Area | Power | Why |
|---|---|---|---|
| INT8 MAC (DSP48) | 1 DSP + ~50 LUT | ~10mW | Full multiplier |
| INT8 MAC (LUT) | ~200 LUT | ~8mW | 8×8 LUT multiplier |
| TLMM ternary | ~20 LUT | ~2mW | Just mux + adder |

On KV260 with 234K LUTs:
- INT8 MAC: max 1,170 parallel MACs
- **TLMM: max 11,700 parallel accumulators**

10x more parallelism at the same silicon budget → 10x throughput advantage for fixed ternary models.

### Ternary Weight Encoding

```verilog
// 2-bit encoding for ternary weights
// 00 = -1 (inverted contribution)
// 01 =  0 (no contribution)
// 10 = +1 (positive contribution)
// 11 = reserved

module tlmm_accumulator #(
    parameter N_WEIGHTS  = 512,    // Row length of weight matrix
    parameter ACT_BITS   = 4,      // Activation quantization bits
    parameter ACC_BITS   = 24      // Accumulator width
) (
    input  wire                    clk,
    input  wire                    rst_n,
    input  wire [ACT_BITS-1:0]     act_index [N_WEIGHTS-1:0],
    input  wire [1:0]              weights   [N_WEIGHTS-1:0],  // Hardcoded!
    input  wire [15:0]             lut_table [2**ACT_BITS-1:0],
    output wire signed [ACC_BITS-1:0] accumulator
);
    // Each weight's contribution is independent — pipeline-friendly
    wire signed [15:0] contributions [N_WEIGHTS-1:0];

    genvar i;
    generate
        for (i = 0; i < N_WEIGHTS; i++) begin : gen_pe
            assign contributions[i] =
                (weights[i] == 2'b10) ?  $signed(lut_table[act_index[i]]) :
                (weights[i] == 2'b00) ? -$signed(lut_table[act_index[i]]) :
                                         16'b0;
        end
    endgenerate

    // Tree reduction for accumulation
    // ... (adder tree implementation)
endmodule
```

**Critical note**: On the FPGA prototype, `weights[]` will be initialized from `.mem` files loaded at startup. On the final ASIC, they're hardwired into metal. The behavioral RTL is identical — only the synthesis target differs.

---

## Activation Quantization

Activations are quantized to 4-bit indices for the LUT:

```verilog
module activation_quantizer (
    input  wire [15:0] activation_fp16,
    output reg  [3:0]  quantized_index
);
    // Symmetric quantization: 16 levels from -scale to +scale
    // Maps FP16 activations to 0..15 index space
    wire [6:0] exponent = activation_fp16[14:10];
    wire       sign     = activation_fp16[15];

    always @(*) begin
        // Clamp and bin into 4-bit range
        casez ({sign, exponent})
            8'b0_0????? : quantized_index = 4'd15;  // Large positive
            8'b0_10???? : quantized_index = 4'd12;
            8'b0_100??? : quantized_index = 4'd10;
            // ... full case table
            8'b1_0????? : quantized_index = 4'd0;   // Large negative
            default:      quantized_index = 4'd7;   // Near zero
        endcase
    end
endmodule
```

---

## Memory Architecture on FPGA

The biggest challenge on FPGA is KV cache. A 2B model with 2K context needs ~24MB of KV cache — far more than KV260's 5.1MB of BRAM.

**Solutions**:
1. **Reduce context to 256 tokens** for Gate 0: reduces KV cache to ~3MB (fits in BRAM) — acceptable for prototype
2. **External HBM** via PCIe: use host RAM as KV cache, accept latency penalty (fine for prototype, not production)
3. **Reduce model**: use 1B parameter model for Gate 0, matching BRAM capacity

**Recommended for Gate 0**: 256-token context, 1B model variant, on-chip BRAM only.

| Resource | Available | Required (1B, 256tok) | Headroom |
|---|---|---|---|
| LUTs | 234K | ~190K | 18% |
| BRAMs | 5.1MB | ~4.2MB | 18% |
| DSP48E2 | 1,248 | 50 (layer norm, scale) | 96% |
| Clock | 300MHz max | 200MHz target | 33% |

---

## 12-Week Development Plan

### Weeks 1-2: Environment Setup
- Install Vivado ML Edition (free for KV260)
- Set up bitnet.cpp as software reference implementation
- Establish test framework: chip output vs. software reference
- Get KV260 board powered on, basic UART communication working

### Weeks 3-5: TLMM Core
- Implement single TLMM accumulator module
- Verify against software reference for single matrix multiply
- Profile LUT usage, timing at 200MHz
- Implement activation quantizer

### Weeks 6-8: Transformer Layer
- Wire TLMM into attention (Q, K, V, Output projections)
- Implement FFN (two TLMM blocks)
- Implement layer normalization (INT16 fixed-point)
- Implement ReLU / SiLU activation (LUT-based)
- Test single transformer layer end-to-end

### Weeks 9-10: Full Model Integration
- Stack 24 transformer layers (or reduced set for prototype)
- Implement token embedding lookup
- Implement KV cache (BRAM or external)
- Implement argmax / sampling for token generation

### Weeks 11-12: Validation & Documentation
- Run 100+ inference tests vs. software reference
- Measure actual throughput and power (KV260 power monitor)
- Document all deviations from spec
- Write Gate 0 report and architecture freeze recommendation

---

## Hilbert Curve Weight Layout

From `research/FPGA_Prototype_Implementation_Guide.md`:

Weights stored in 1D BRAM/ROM benefit from Hilbert curve ordering — a space-filling curve that maps 2D weight matrix positions to 1D memory addresses while maximizing locality.

**Why this matters for FPGA**:
- BRAM is accessed linearly in the systolic array's dataflow
- If spatially adjacent weights are also sequentially adjacent in memory, BRAM read bursts are more efficient
- Hilbert curve achieves **17.3% better locality** vs. row-major ordering

```
Row-major ordering:      Hilbert curve ordering:
(0,0)(0,1)(0,2)...      (0,0)(0,1)(1,1)(1,0)...
(1,0)(1,1)(1,2)...  →   (2,0)(3,0)(3,1)(2,1)...
(2,0)(2,1)(2,2)...      (2,2)(3,2)(3,3)(2,3)...

Sequential neighbors     Spatially local access
in memory               pattern preserved
```

Implementation is in the weight compiler — weights are reordered before `.mem` file generation. The FPGA sees weights in Hilbert order and processes them in a corresponding dataflow pattern.

---

## Weight Compiler (Gate 0 Version)

The weight compiler converts a trained model to FPGA `.mem` files:

```bash
# Usage (Gate 0 version - simplified)
python weight_compiler.py \
    --model microsoft/BitNet-b1.58-2B-4T \
    --target fpga_kv260 \
    --context-length 256 \
    --output ./weights/

# Output files:
# weights/embed.mem          (token embedding table)
# weights/layer_0_attn.mem   (attention weights, layer 0)
# weights/layer_0_ffn.mem    (FFN weights, layer 0)
# ... (24 layers × 2 files each)
# weights/lm_head.mem        (language model head)
```

Gate 0 compiler does NOT need to produce GDSII — just `.mem` files for Vivado initialization. The GDSII metal pattern generator is a Gate 1 deliverable.

---

## Success Criteria

Gate 0 is complete when ALL of the following are met:

| Criterion | Target | Measurement |
|---|---|---|
| Throughput | ≥25 tok/s | tokens/second on KV260 |
| Power | <5W | KV260 power monitor |
| Accuracy | Matches software within 0.5 perplexity | WikiText-2 subset |
| Stability | No hangs over 1000 inference calls | Automated test suite |
| Documentation | RTL commented, architecture diagram updated | PR review |

**Failure modes to monitor**:
- Timing violations at 200MHz → reduce clock or pipeline more aggressively
- BRAM overflow → reduce model or context length
- Accuracy divergence → check quantization scaling factors
- Power overage → reduce parallelism, add clock gating

---

## Gate 0 → Gate 1 Decision

After Gate 0, the team decides:

```
Gate 0 passes → Architecture freeze → File patents → RTL development → MPW tapeout
Gate 0 fails (accuracy) → Revisit quantization strategy → Retest
Gate 0 fails (power) → Reduce parallelism → Retest
Gate 0 fails (throughput) → Increase clock / pipeline → Retest
```

The FPGA prototype does not need to be production-quality. It needs to prove the **concept** — that TLMM achieves ternary inference at the target power and quality envelope. Architecture, performance, and reliability improvements happen in RTL development.
