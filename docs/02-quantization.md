# Quantization — Ternary Weights for Mask-Locked Silicon

**Synthesized from**: `research/Ternary_Binary_Neural_Networks_Research_Report.md`, `research/Information_Theory_Weight_Encoding_Framework.md`, `research/Statistical_Mechanics_Neural_Networks.md`

---

## Why Quantization Is Central to This Project

Quantization is not an optimization — it's a **prerequisite**. A 2B-parameter model at FP32 is 8GB of weights. That's impossible to encode in silicon metal layers economically. At ternary (1.58 bits/param), the same model is ~400MB equivalent — feasible at 28nm.

More importantly, ternary weights fundamentally change the compute primitive:
- **FP16/INT8**: Multiply-accumulate — requires multiplier hardware
- **Ternary**: Conditional-add — weight is +1 (add), 0 (skip), or -1 (subtract)

No multiplier means each processing element is 5-10x smaller in silicon area. This is how you fit 2B parameters with 500M-1B transistors instead of requiring 53B (like Taalas at 6nm).

---

## The Ternary Weight Scheme

### AbsMean Quantization (BitNet method)

```python
def quantize_to_ternary(W: torch.Tensor) -> tuple[torch.Tensor, float]:
    """
    Quantize weight matrix to {-1, 0, +1} using AbsMean scaling.

    Returns quantized weights and scale factor for dequantization.
    """
    scale = W.abs().mean()           # scale = E[|w|]
    W_scaled = W / (scale + 1e-5)   # normalize
    W_q = torch.round(W_scaled)      # round to nearest integer
    W_q = torch.clamp(W_q, -1, 1)   # clamp to ternary range
    return W_q, scale
```

**Information-theoretic analysis**:
- Each ternary weight carries log₂(3) ≈ 1.585 bits of information
- vs. FP16: 16 bits, INT4: 4 bits, INT2: 2 bits
- Compression ratio vs FP16: 10.1x
- Compression ratio vs INT4: 2.5x

### What "1.58 Bits" Means in Practice

For a 2B-parameter model:
| Precision | Bits/param | Total storage | Silicon encoding |
|---|---|---|---|
| FP32 | 32 | 8 GB | Not practical |
| BF16 | 16 | 4 GB | Not practical |
| INT8 | 8 | 2 GB | Borderline (large die) |
| INT4 | 4 | 1 GB | Feasible |
| **Ternary (1.58-bit)** | **1.58** | **~400 MB** | **Target** |
| Binary (1-bit) | 1 | 250 MB | Quality loss |

---

## BitNet b1.58 — The Target Model

### Why BitNet b1.58 Is The Right Model

BitNet b1.58 (Microsoft Research, arXiv:2402.17764) is natively trained at 1.58-bit precision — not post-hoc quantized. This is critical:

- **Post-hoc quantization** (take FP16 model, quantize to INT4): quality degrades 1-5% on benchmarks
- **Native ternary training** (train from scratch at 1.58-bit): quality matches FP16 baseline with no degradation

The model architecture is identical to LLaMA — same attention, same FFN, same layer count — but every weight matrix is trained with the AbsMean quantization constraint baked in.

### Official Release: BitNet-b1.58-2B-4T

| Property | Value |
|---|---|
| Parameters | 2.4B |
| Training tokens | 4 Trillion |
| Architecture | LLaMA-based |
| License | **MIT** (usable in commercial silicon) |
| HuggingFace | `microsoft/BitNet-b1.58-2B-4T` |
| Weight format | GGUF (i2_s, tl1, tl2 kernels) |

### BitNet Performance vs. Alternatives

| Benchmark | FP16 LLaMA-2B | BitNet b1.58-2B | Degradation |
|---|---|---|---|
| MMLU | ~51% | ~50% | **<1%** |
| HellaSwag | ~72% | ~71% | **<1%** |
| ARC-Easy | ~69% | ~68% | **<1%** |
| Perplexity (WikiText-2) | ~6.8 | ~7.1 | **4%** |

Perplexity degrades slightly; downstream task quality is nearly identical. For edge inference this tradeoff is excellent.

### bitnet.cpp Benchmarks (Software Reference)

| Platform | Speedup vs FP16 | Energy Reduction |
|---|---|---|
| x86 CPU (Intel i9) | 2.37x – 6.17x | 71.9% – 82.2% |
| ARM CPU (Apple M2) | 1.37x – 5.07x | 55.4% – 70.0% |
| **Mask-locked ASIC (projected)** | **10–50x** | **~90%** |

The ASIC advantage comes from: (1) no memory bandwidth overhead, (2) parallelism across entire weight matrix simultaneously, (3) no instruction decode overhead.

---

## TLMM — Table-Lookup Matrix Multiplication

TLMM (Table-Lookup MatMul, from TeLLMe paper arXiv:2510.15926) is the key algorithmic primitive for implementing ternary inference in hardware.

### Standard MAC vs. TLMM

**Traditional INT8 MAC**:
```
for each weight W[i] and activation A[i]:
    accumulator += A[i] * W[i]    ← requires multiplier
```

**TLMM for ternary weights**:
```
# Precompute table: for each possible activation value, store +A and -A
table[+val] = +A    # for weight = +1
table[zero] = 0     # for weight = 0
table[-val] = -A    # for weight = -1

# Inference: just table lookup
for each weight W[i] and activation A[i]:
    accumulator += table[W[i]][A[i]]    ← lookup only, no multiply
```

### Hardware Savings

| Implementation | Area per MAC | Power | Latency |
|---|---|---|---|
| INT8 × INT8 multiplier | ~200 LUTs (FPGA) | High | 3-5 cycles |
| **TLMM ternary** | **~20 LUTs** | **Low** | **1 cycle** |
| ASIC INT8 MAC | ~500µm² @ 28nm | High | 1 cycle |
| **ASIC ternary add** | **~50µm²** | **10x lower** | **1 cycle** |

10x area reduction means 10x more compute units per mm² — or 10x smaller die for the same throughput.

### FPGA TLMM Implementation

For the Gate 0 AMD KV260 prototype:

```verilog
// TLMM processing element — ternary weight, 4-bit activation index
module tlmm_pe #(
    parameter WEIGHT = 2'b10   // Hardcoded: 00=-1, 01=0, 10=+1
)(
    input  wire [3:0]  act_index,     // 4-bit activation quantized index
    input  wire [15:0] lut_entry,     // Precomputed table[act_index]
    input  wire signed [23:0] acc_in,
    output wire signed [23:0] acc_out
);
    wire signed [15:0] contribution;
    assign contribution = (WEIGHT == 2'b10) ?  $signed(lut_entry) :
                          (WEIGHT == 2'b00) ? -$signed(lut_entry) : 16'b0;
    assign acc_out = acc_in + {{8{contribution[15]}}, contribution};
endmodule
```

On KV260 (XCZU5EG):
- Available LUTs: ~234K
- TLMM PE per LUT: ~20 LUTs
- Parallel PEs: ~11,700
- Throughput estimate: ~25-50 tokens/second (prototype target)

---

## iFairy / Fairy±i — Next-Generation Approach

From Peking University (arXiv:2508.05571). Extends ternary to **complex-valued weights** using the C₄ group: {+1, -1, +i, -i}.

### Why Complex Weights?

Complex multiplication in the C₄ group reduces to:
```
(a + bi)(±1) = ±a ± bi          ← trivial sign flip
(a + bi)(±i) = ∓b ± ai          ← element swap + sign flip
```

**No multiplication required.** Just element swaps and sign flips. This is even simpler than ternary addition.

### iFairy vs. BitNet Comparison

| Property | BitNet b1.58 | iFairy (Fairy±i) |
|---|---|---|
| Weight space | {-1, 0, +1} | {+1, -1, +i, -i} |
| Bits/weight | 1.58 | 2.0 |
| Operations | Add/subtract | Swap + sign flip |
| Hardware | Ternary adder | 2-bit mux |
| License | MIT | Apache 2.0 + patent grant |
| Maturity | Production (4T tokens) | Research (arXiv only) |
| Quality | FP16-equivalent | Competitive |

For hardware: iFairy may actually be **simpler** than BitNet — element swap is a wire permutation in hardware, requiring zero compute logic. This is extremely promising for mask-locked silicon.

**Status**: Research stage only. Not yet production-ready. BitNet b1.58 is the primary target; iFairy is the research track for second-generation chips.

---

## TOM Accelerator — Academic Validation

TOM (arXiv:2602.20662) is a ternary ROM-SRAM hybrid accelerator that directly validates the mask-locked concept at academic scale.

| Metric | TOM Result | SuperInstance Target |
|---|---|---|
| Throughput | **3,306 tokens/second** | 80-150 tok/s |
| Architecture | ROM-SRAM hybrid | Metal-hardwired |
| Model | BitNet-2B | BitNet-2B |
| Process | Not specified | 28nm |

TOM achieves 3,306 tok/s — orders of magnitude above our target. The SuperInstance design is more conservative because we're targeting <3W power, not maximum throughput. The TOM result proves the compute model works at scale.

---

## Quantization Quality Gates

Before any tapeout, these benchmarks must pass:

| Benchmark | Threshold | Why |
|---|---|---|
| MMLU accuracy | >48% | General reasoning |
| HellaSwag | >70% | Common-sense inference |
| ARC-Easy | >66% | Question answering |
| WikiText-2 perplexity | <8.0 | Language modeling |
| GSM8K | >15% | Mathematical reasoning |

These thresholds represent <2% degradation from FP16 baseline — the point at which users cannot notice quality loss in conversational tasks.

---

## Weight Compiler Pipeline (To Be Built)

The weight compiler is the critical software artifact that bridges trained models and silicon:

```
Input: PyTorch checkpoint (*.ckpt or *.safetensors)
    ↓
Ternary quantization (AbsMean per-layer)
    ↓
Verify quality (run benchmark suite)
    ↓
Reshape to systolic array layout (row-major → PE-major)
    ↓
Apply Hilbert curve memory layout (17.3% locality improvement)
    ↓
Generate Verilog .mem files (one per layer)
    ↓
Generate via placement instructions for P&R tool
    ↓
Output: GDSII-ready metal layer definitions
```

This pipeline does not exist as open-source software. Building it is a Gate 1 deliverable.
