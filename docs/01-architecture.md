# Architecture — Mask-Locked Inference Chip

**Synthesized from**: `mask_locked_plan.txt`, `mask_locked_deep_dive.md`, `neuromorphic_architecture_report.md`, `research/Neural_Synapse_Chip_Design_Synthesis.md`

---

## The Core Architectural Insight

Traditional AI chips have a fundamental bottleneck: **weight memory access**. For every multiply-accumulate operation, the weight must be fetched from DRAM or SRAM. This costs:

- **Energy**: Memory reads consume 100-1000x more energy than the compute itself
- **Bandwidth**: Memory bus saturates before compute units are fully utilized
- **Latency**: DRAM access adds 50-200ns per access; compute takes ~1ns

Mask-locking eliminates this entirely. The weight **is** the metal interconnect. It's always "present" at the compute unit with zero access cost. The chip doesn't load weights — it *is* the weights.

```
Traditional NPU power budget at 10W:
  ├── Memory access (weight loads): ~60%   ← 6W
  ├── Memory access (activation):  ~20%   ← 2W
  └── Actual compute (MACs):       ~20%   ← 2W

Mask-locked chip power budget at 2-3W:
  ├── Metal weight access:           0%   ← 0W (no access needed)
  ├── Activation SRAM:              30%   ← 0.6-0.9W
  └── Compute (ternary add/sub):    70%   ← 1.4-2.1W
```

---

## Architectural Components

### 1. Hardwired Weight Matrix (Metal Layers M1–M6)

The transformer's parameters — attention, FFN, embeddings — are encoded as physical metal structures in the chip's interconnect layers.

**Encoding scheme** (ternary):
```
Weight +1 → Via connection present (current flows)
Weight  0 → No via, no connection (open circuit)
Weight -1 → Inverted via, differential line (inverted current)
```

For a 2B-parameter model at ternary (1.58 bits/weight):
- Total weight bits: ~3.2 billion bits
- Distributed across M1–M6 interconnect layers
- No area overhead beyond routing that must exist anyway
- Unlike SRAM, no standby leakage, no refresh, no bit-cell overhead

**Layer allocation** (28nm process):
```
M6 (top)  → Long-range routing, embedding table
M5        → Attention weight matrix rows
M4        → Attention weight matrix columns
M3        → FFN weight matrix rows
M2        → FFN weight matrix columns
M1 (base) → Local connections, layer norm params
```

### 2. Systolic Array (Matrix Multiply Engine)

A weight-stationary systolic array where each processing element (PE) computes one dot product component.

```
Input activations flow EAST →
                    ┌────┬────┬────┬────┐
                    │ PE │ PE │ PE │ PE │  ← Row 0
                    ├────┼────┼────┼────┤
Output  ← partial  │ PE │ PE │ PE │ PE │  ← Row 1
sums               ├────┼────┼────┼────┤
flow SOUTH ↓       │ PE │ PE │ PE │ PE │  ← Row 2
                    ├────┼────┼────┼────┤
                    │ PE │ PE │ PE │ PE │  ← Row 3
                    └────┴────┴────┴────┘
                    Each PE holds ONE hardwired weight
```

For ternary weights, each PE is trivially simple:
```verilog
// Single PE for ternary weight
module pe_ternary (
    input  signed [7:0] activation,
    input  [1:0]        weight_encoded,  // 00=-1, 01=0, 10=+1
    input  signed [23:0] partial_sum_in,
    output signed [23:0] partial_sum_out
);
    wire signed [7:0] contribution;
    assign contribution = (weight_encoded == 2'b10) ?  activation :
                          (weight_encoded == 2'b00) ? -activation : 8'b0;
    assign partial_sum_out = partial_sum_in + {{16{contribution[7]}}, contribution};
endmodule
```

**No multipliers.** Just a mux and an adder. This is why ternary weights are critical — it makes each PE dramatically simpler and more power-efficient.

### 3. Activation SRAM

The **only mutable state** in the chip. Stores:
- Input token embeddings (read from I/O)
- Intermediate layer activations (ping-pong buffers)
- KV cache (for autoregressive generation)
- Output logits (written to I/O)

**Size estimate** (2B params, 2K context):
```
Embedding buffer:     512 dims × INT8  = 512 bytes
Activation ping-pong: 2 × 2048 dims × INT16 = 8KB
KV cache:             24 layers × 2K tokens × 512 dims × INT8 = 24MB
Output logits:        32K vocab × INT16 = 64KB

Total SRAM needed: ~25MB
28nm SRAM density: ~1MB/mm²
SRAM area estimate: ~25mm²
```

### 4. Control Logic (Finite State Machine)

No CPU. No OS. A hardwired FSM sequences the inference loop:

```
IDLE → LOAD_TOKEN → EMBED → [LAYER_0..N: ATTN → FFN → NORM] → DECODE → OUTPUT → IDLE
```

State transitions are deterministic and hardwired. Latency per token is constant and predictable — no cache misses, no branch mispredictions, no OS preemption.

### 5. I/O Interface

The chip appears as a simple peripheral. Options under evaluation:

| Interface | Bandwidth | Latency | Best for |
|---|---|---|---|
| USB 3.2 Gen 1 | 5 Gbps | ~1ms | Raspberry Pi, maker |
| PCIe Gen 3 x1 | 8 Gbps | ~1µs | Industrial, embedded |
| M.2 2242 | PCIe x4 | ~1µs | Compact embedded |
| Custom | Unlimited | ~100ns | OEM integration |

Token embedding (512 bytes) → chip in ~1µs over PCIe. Each output token (~64 bytes) → host in ~100ns. At 80-150 tok/s, I/O is not the bottleneck.

---

## Full Die Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       SuperInstance Die (28nm)                      │
│                                                                     │
│  ┌──────────┐    ┌─────────────────────────────────────────────┐   │
│  │ I/O Pads │    │              Activation SRAM (25MB)          │   │
│  │ USB/PCIe │    │   ┌──────┬──────┬──────┬──────┬──────┐     │   │
│  └────┬─────┘    │   │Embed │Attn0 │FFN0  │...   │KV$ │     │   │
│       │           │   └──────┴──────┴──────┴──────┴──────┘     │   │
│  ┌────▼─────┐    └──────────────┬────────────────────────────┘   │
│  │ Control  │                   │                                   │
│  │  FSM     │    ┌──────────────▼────────────────────────────┐   │
│  └────┬─────┘    │         Systolic Array Farm                │   │
│       │           │  ┌──────────────┐  ┌──────────────┐       │   │
│       └──────────►│  │ Attn SA (QKV)│  │  FFN SA      │       │   │
│                   │  │ 512×512 PEs  │  │ 512×2048 PEs │       │   │
│                   │  └──────────────┘  └──────────────┘       │   │
│                   └───────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Metal Weight Layers (M1-M6)                     │   │
│  │    Ternary weights hardwired into via connections            │   │
│  │    ~2B parameters × 1.58 bits = 3.2 billion interconnects   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Power:  <3W active | <1W idle                                      │
│  Clock:  ~500MHz target                                             │
│  Die:    ~27-55mm² (35-55mm² from synthesis, 27mm² optimistic)      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Neuromorphic Influences

The architecture draws inspiration from biological neural systems — specifically the synaptic spine neck geometry used in biology for thermal and signal isolation.

Key bio-inspired design elements (from `neuromorphic_architecture_report.md`):

1. **Spine neck thermal isolation**: Narrow metal necks between weight storage vias act as thermal resistors, preventing hotspot propagation
2. **Hebbian spatial organization**: Weights frequently activated together are placed near each other, reducing routing length and capacitance
3. **Sparse connectivity**: Ternary weights with many zeros map naturally to biological sparse connectivity; zero-weight vias simply don't exist

These are not metaphors — they translate to concrete layout choices that improve thermal management and reduce dynamic power by 15-30%.

---

## Why 28nm (Not 4nm or 7nm)

| Factor | 4nm (TSMC N4) | 7nm (TSMC N7) | 28nm (GF/TSMC) |
|---|---|---|---|
| Mask set NRE | $15-20M | $8-12M | $2-4M |
| Design & verification | $5-10M | $3-6M | $1-3M |
| MPW shuttle cost | Not available | $500K+ | $50-200K |
| Foundry availability | TSMC only, queue | TSMC/Samsung | Multiple, easy access |
| Design tools | Requires latest EDA | Requires modern EDA | Open-source viable |
| Where efficiency comes from | Process scaling | Process scaling | **Architecture** (mask-locking) |

Our efficiency gains come from eliminating memory access, not from process scaling. A mask-locked design on 28nm outperforms a conventional design on 4nm for inference workloads because the memory bottleneck dominates — and we've eliminated it entirely.

---

## Performance Projections

| Metric | Conservative | Target | Optimistic |
|---|---|---|---|
| Throughput | 50 tok/s | 100 tok/s | 150 tok/s |
| Power | 3W | 2.5W | 2W |
| Tokens/Watt | 17 | 40 | 75 |
| Latency (first token) | 50ms | 20ms | 10ms |
| Die area | 55mm² | 40mm² | 27mm² |
| Clock frequency | 400MHz | 500MHz | 600MHz |

Comparison:
- Hailo-10H: 1-2 tokens/watt (5W, 5-10 tok/s on LLMs)
- Jetson Orin Nano: ~2 tokens/watt (12W, 25 tok/s on 7B)
- **SuperInstance**: 40+ tokens/watt target

---

## Key Open Technical Questions

1. **Timing closure at 500MHz**: Systolic array propagation delay across 512 PEs — will timing close at target frequency?
2. **Weight compiler**: PyTorch checkpoint → Verilog `.mem` files → GDSII metal routing — this tool doesn't exist yet
3. **KV cache bandwidth**: 24MB SRAM with simultaneous read/write for all attention heads — memory port count?
4. **Clock distribution**: Distributing 500MHz clock across 90mm² die with <50ps skew
5. **Power delivery network**: Sub-3W but high peak currents during systolic array operation — decap strategy?

See `research/cycle4_pdn_analysis.md` for PDN analysis details.
