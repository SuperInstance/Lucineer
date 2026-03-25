# Lab 2: RTL Design — Build a MAC Unit

**Duration:** 4 hours | **Difficulty:** Intermediate | **Prerequisites:** Lab 1, SystemVerilog basics

## Objective

Design, simulate, and verify a ternary Multiply-Accumulate (MAC) unit — the fundamental building block of mask-lock inference chips.

## Learning Outcomes

By completing this lab, you will:
- Implement a ternary MAC (Rotation-Accumulate Unit) in SystemVerilog
- Understand why ternary weights eliminate multipliers (~90% gate reduction)
- Write self-checking testbenches with coverage
- Analyze gate count and critical path timing

## Background

Traditional neural network accelerators use 8/16/32-bit multipliers. A single FP32 multiply costs ~5,000 gates. Ternary weights `{-1, 0, +1}` replace multiplication with:
- **+1**: Pass activation unchanged
- **0**: Output zero (zero-skip optimization)
- **-1**: Negate activation (2's complement inversion)

This reduces a multiplier to a 2:1 mux + inverter (~50 gates).

## Part 1: Design the RAU (90 min)

### 1.1 Weight Decoder

```systemverilog
// Implement this module
module weight_decoder #(
    parameter int WIDTH = 8
)(
    input  logic signed [WIDTH-1:0] activation,
    input  logic [1:0]              weight,     // 2'b00=+1, 2'b01=0, 2'b10=-1
    output logic signed [WIDTH-1:0] result
);
    // YOUR CODE HERE
    // Hint: Use a case statement. For -1, negate. For 0, output zero. For +1, pass through.
endmodule
```

### 1.2 Accumulator

```systemverilog
module accumulator #(
    parameter int IN_WIDTH  = 8,
    parameter int ACC_WIDTH = 24
)(
    input  logic                        clk,
    input  logic                        rst_n,
    input  logic signed [IN_WIDTH-1:0]  data_in,
    input  logic                        valid,
    input  logic                        clear,
    output logic signed [ACC_WIDTH-1:0] acc_out
);
    // YOUR CODE HERE
    // Hint: Sign-extend data_in to ACC_WIDTH before adding
endmodule
```

### 1.3 Complete RAU

Combine weight_decoder + accumulator into a single `rau` module with pipeline register.

## Part 2: Testbench (60 min)

### 2.1 Exhaustive Weight Testing

Write a testbench that verifies all 9 combinations:
| Activation | Weight | Expected Output |
|-----------|--------|----------------|
| +5        | +1     | +5             |
| +5        | 0      | 0              |
| +5        | -1     | -5             |
| 0         | +1     | 0              |
| 0         | 0      | 0              |
| 0         | -1     | 0              |
| -3        | +1     | -3             |
| -3        | 0      | 0              |
| -3        | -1     | +3             |

### 2.2 Accumulation Sequence

Feed a sequence of 8 weighted activations and verify the final sum matches expected value.

### 2.3 Edge Cases

- Maximum positive activation (+127) with weight -1
- Maximum negative activation (-128) with weight +1
- Accumulator near overflow

## Part 3: Synthesis Analysis (45 min)

### 3.1 Gate Count Comparison

Use Yosys to synthesize your RAU and compare:

```bash
# Synthesize ternary RAU
yosys -p "read_verilog -sv rau.sv; synth; stat"

# Compare with traditional 8-bit multiplier
yosys -p "read_verilog -sv mult_mac.sv; synth; stat"
```

**Expected results:**
| Design | Gates | Critical Path |
|--------|-------|--------------|
| Ternary RAU | ~80 | ~1.2 ns |
| 8-bit MAC | ~900 | ~4.5 ns |

### 3.2 Array Scaling

Estimate total gates for a 256×256 array of RAUs vs. traditional MACs.

## Part 4: Formal Verification (45 min)

Add SVA assertions to your RAU:

```systemverilog
// Weight 0 always produces 0 output
assert property (@(posedge clk)
    weight == 2'b01 |-> result == 0
);

// +1 weight passes activation unchanged
assert property (@(posedge clk)
    weight == 2'b00 |-> result == activation
);

// Reserved weight never appears
assert property (@(posedge clk)
    weight != 2'b11
);
```

Run with SymbiYosys:
```bash
sby -f rau.sby
```

## Deliverables

1. `rau.sv` — Complete RAU module
2. `tb_rau.sv` — Self-checking testbench (all 9 combinations pass)
3. `synthesis_report.txt` — Yosys gate count output
4. `rau.sby` — Formal verification script
5. Written analysis: Why does ternary encoding reduce power consumption?

## Grading Rubric

| Criterion | Points |
|-----------|--------|
| Correct ternary decode | 25 |
| Accumulator with sign extension | 20 |
| Testbench covers all 9 cases | 20 |
| Formal assertions pass | 15 |
| Synthesis analysis complete | 10 |
| Written analysis quality | 10 |

## Reference

- `reference/common/mls_common.sv` — Weight encoding definitions
- `download/ternaryair/hardware/rtl/rau.sv` — Production RAU implementation
- MLS Specification §3: Ternary Arithmetic
