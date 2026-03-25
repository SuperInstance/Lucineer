# Lab 5: Full-Stack Chip Design — TinyLlama on FPGA

**Duration:** 8 hours | **Difficulty:** Advanced | **Prerequisites:** Labs 1-4

## Objective

Take a TinyLlama model, quantize to ternary, compile to GDSII, emulate on FPGA.

**Success metric:** Model runs on FPGA, generates coherent text, <5W power.

This is your portfolio piece for job applications.

## Overview

```
TinyLlama-1.1B (FP32, 4.4GB)
    │
    ▼ Quantize (Lab 4)
TinyLlama-Ternary (1.58-bit, ~200MB)
    │
    ▼ Compile (CLAWC)
chip_top.sv + weights.bin + chip.gds
    │
    ▼ Synthesize (Vivado)
bitstream.bit + weights.mem
    │
    ▼ Program (KV260)
Live inference @ <5W
    │
    ▼ Validate
"The cat sat on the ___" → "mat" ✓
```

## Part 1: Model Preparation (90 min)

### 1.1 Download and Quantize

```bash
# Activate lab environment
cd /workspace/lab5_full_stack
source .devcontainer/setup.sh

# Download TinyLlama
python3 -c "
from transformers import AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained('TinyLlama/TinyLlama-1.1B-Chat-v1.0')
model.save_pretrained('./models/tinyllama_fp32')
"

# Export to ONNX
python3 export_onnx.py ./models/tinyllama_fp32 ./models/tinyllama.onnx
```

### 1.2 Quantize to Ternary

```bash
# Using your Lab 4 quantizer
python3 quantize.py \
    --model ./models/tinyllama.onnx \
    --output ./models/tinyllama_ternary.onnx \
    --method bitnet_b158 \
    --calibration-data wikitext-2

# Verify perplexity
python3 eval_perplexity.py ./models/tinyllama_ternary.onnx
# Expected: PPL ~9.2 (vs FP32 ~7.5)
```

### 1.3 Validate Quantized Model

```python
# Quick coherence test
from transformers import AutoTokenizer
tokenizer = AutoTokenizer.from_pretrained("TinyLlama/TinyLlama-1.1B-Chat-v1.0")

prompt = "The capital of France is"
# Run through quantized model
# Expected: "Paris" in top-5 logits
```

## Part 2: Compile with CLAWC (90 min)

### 2.1 Generate RTL

```bash
clawc ./models/tinyllama_ternary.onnx \
    --target fpga-kv260 \
    --output ./build/ \
    --quantize ternary \
    --mac-array 32x32 \
    --kv-cache 512KB \
    --verbose

# Output:
#   build/chip_top.sv        — Top-level RTL
#   build/weight_rom.sv      — Mask-lock weight ROM
#   build/weights.mem         — Weight memory initialization
#   build/scheduling.json     — Layer execution schedule
#   build/resource_report.txt — Estimated utilization
```

### 2.2 Inspect Generated RTL

```bash
# Check resource estimates
cat build/resource_report.txt
# Expected:
#   LUTs: ~45,000 / 117,120 (38%)
#   FFs:  ~30,000 / 234,240 (13%)
#   BRAM: ~80 / 144 (56%)
#   DSP:  0 / 1,248 (0%)     ← Key: zero DSPs!

# Check layer schedule
python3 -c "
import json
sched = json.load(open('build/scheduling.json'))
print(f'Total layers: {sched[\"num_layers\"]}')
print(f'Tiles per layer: {sched[\"tiles_per_layer\"]}')
print(f'Est. latency: {sched[\"estimated_ms\"]} ms/token')
"
```

### 2.3 Generate GDSII (Simulation)

```bash
# Generate GDSII layout (for portfolio — uses Sky130 PDK)
clawc ./models/tinyllama_ternary.onnx \
    --target asic-sky130 \
    --output ./build/gds/ \
    --quantize ternary

# View in KLayout
klayout build/gds/chip.gds
```

## Part 3: FPGA Synthesis (120 min)

### 3.1 Create Vivado Project

```tcl
# create_project.tcl
create_project tinyllama_fpga ./vivado_project -part xck26-sfvc784-2LV-c

# Add generated RTL
add_files [glob ./build/*.sv]
add_files ../../reference/common/mls_common.sv
add_files ../../reference/common/a2a_register_file.sv

# Add weight memory initialization
add_files ./build/weights.mem
set_property file_type {Memory Initialization Files} [get_files weights.mem]

# Set top module
set_property top chip_top [current_fileset]

# Add constraints
add_files -fileset constrs_1 ./constraints/kv260.xdc
```

### 3.2 Synthesize and Implement

```tcl
# Run synthesis
launch_runs synth_1 -jobs 4
wait_on_run synth_1

# Check utilization
open_run synth_1
report_utilization -file utilization.rpt

# Run implementation
launch_runs impl_1 -to_step write_bitstream -jobs 4
wait_on_run impl_1

# Check timing
report_timing_summary -file timing.rpt
```

### 3.3 Verify Timing Closure

All paths must meet timing at 200 MHz. If not:
1. Check critical path in timing report
2. Add pipeline registers to adder trees
3. Consider reducing MAC array to 16×16 and re-synthesizing

## Part 4: Hardware Deployment (90 min)

### 4.1 Program KV260

```bash
# Copy bitstream to KV260
scp vivado_project/tinyllama_fpga.runs/impl_1/chip_top.bit kv260:/home/petalinux/

# On KV260:
sudo fpgautil -b chip_top.bit -o /lib/firmware/xilinx/tinyllama/tinyllama.dtbo
sudo xmutil loadapp tinyllama
```

### 4.2 Load Weights

```python
import mmap, struct, time

# Memory-map PL register space
with open("/dev/mem", "r+b") as f:
    regs = mmap.mmap(f.fileno(), 0x10000, offset=0xA0000000)

    # Set weight base address
    regs[0x08:0x0C] = struct.pack("<I", 0x0000_0000)

    # Write LOAD_WEIGHTS command
    regs[0x00:0x04] = struct.pack("<I", 0x01)

    # Wait for weights loaded
    while True:
        status = struct.unpack("<I", regs[0x04:0x08])[0]
        if status & 0x10:  # weights_loaded bit
            break
        time.sleep(0.01)

    print("Weights loaded successfully")
```

### 4.3 Run Inference

```python
def run_inference(prompt: str) -> str:
    """Run inference on FPGA and return generated text."""
    # Tokenize
    tokens = tokenizer.encode(prompt)

    # Write input tokens to input buffer
    for i, token in enumerate(tokens):
        regs[0x1000 + i*2 : 0x1000 + i*2 + 2] = struct.pack("<H", token)

    # Set input size
    regs[0x10:0x14] = struct.pack("<I", 0x0000_1000)  # Input buffer base

    # Run inference command
    regs[0x00:0x04] = struct.pack("<I", 0x02)  # CMD_RUN_INFERENCE

    # Wait for completion
    start = time.time()
    while True:
        status = struct.unpack("<I", regs[0x04:0x08])[0]
        if status & 0x04:  # inference_done bit
            break
        if time.time() - start > 30:
            raise TimeoutError("Inference timeout")
        time.sleep(0.001)

    elapsed = time.time() - start

    # Read output logits
    regs[0x00:0x04] = struct.pack("<I", 0x03)  # CMD_READ_LOGITS
    time.sleep(0.01)

    output_token = struct.unpack("<H", regs[0x2000:0x2002])[0]
    output_text = tokenizer.decode([output_token])

    print(f"Latency: {elapsed*1000:.1f} ms")
    return output_text

# Test generation
prompt = "The cat sat on the"
result = run_inference(prompt)
print(f"Input: '{prompt}'")
print(f"Output: '{result}'")
```

## Part 5: Validation & Measurement (60 min)

### 5.1 Coherence Test Suite

```python
test_prompts = [
    ("The capital of France is", ["Paris"]),
    ("2 + 2 =", ["4"]),
    ("Water freezes at", ["0", "32", "zero"]),
    ("The cat sat on the", ["mat", "floor", "bed", "chair"]),
    ("Hello, my name is", None),  # Any coherent continuation
]

passed = 0
for prompt, expected in test_prompts:
    result = run_inference(prompt)
    if expected is None or any(e.lower() in result.lower() for e in expected):
        print(f"✓ '{prompt}' → '{result}'")
        passed += 1
    else:
        print(f"✗ '{prompt}' → '{result}' (expected one of {expected})")

print(f"\nCoherence: {passed}/{len(test_prompts)} tests passed")
```

### 5.2 Power Measurement

```bash
# Measure with INA226
python3 ../../fpga_lab/measurements/power/measure.py \
    --duration 60 \
    --output power_log.csv

# Analyze
python3 -c "
import csv
with open('power_log.csv') as f:
    powers = [float(row['power_w']) for row in csv.DictReader(f)]
print(f'Average: {sum(powers)/len(powers):.2f} W')
print(f'Peak: {max(powers):.2f} W')
print(f'Target: < 5.0 W')
print(f'Status: {\"PASS\" if max(powers) < 5.0 else \"FAIL\"}')"
```

### 5.3 Performance Summary

Fill in your results:

| Metric | Target | Your Result |
|--------|--------|------------|
| Power (avg) | < 5.0 W | ___ W |
| Power (peak) | < 7.0 W | ___ W |
| Latency/token | < 50 ms | ___ ms |
| Throughput | > 20 tok/s | ___ tok/s |
| Coherence | > 3/5 | ___/5 |
| DSP usage | 0 | ___ |
| LUT utilization | < 80% | ___% |

## Deliverables (Portfolio Package)

1. **Technical Report** (2-3 pages):
   - Architecture overview with block diagram
   - Quantization results (perplexity, sparsity)
   - Synthesis results (utilization, timing)
   - Power and performance measurements
   - Lessons learned

2. **Code Artifacts**:
   - `quantize.py` — Ternary quantization script
   - `build/` — Generated RTL and GDSII
   - `vivado_project/` — Synthesis project
   - `test_coherence.py` — Validation suite
   - `power_log.csv` — Power measurements

3. **Demo Video** (2-3 minutes):
   - Show the KV260 running inference
   - Demonstrate coherent text generation
   - Show power meter reading < 5W

## Grading Rubric

| Criterion | Points |
|-----------|--------|
| Successful quantization (PPL < 12) | 15 |
| CLAWC compilation succeeds | 15 |
| Vivado synthesis passes | 15 |
| Timing closure at ≥150 MHz | 10 |
| Hardware runs inference | 15 |
| Coherent text generation (≥3/5) | 10 |
| Power < 5W | 10 |
| Technical report quality | 10 |

## Reference

- `compiler/clawc/` — CLAWC compiler source
- `reference/fpga_prototypes/kv260_bitnet2b/` — KV260 reference design
- `fpga_lab/measurements/` — Measurement tools
- Ma et al., "The Era of 1-bit LLMs" (2024)
