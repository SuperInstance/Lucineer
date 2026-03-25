# Lab 3: FPGA Bringup — Program the KV260

**Duration:** 4 hours | **Difficulty:** Intermediate | **Prerequisites:** Labs 1-2

## Objective

Synthesize a ternary inference engine, program it onto a Kria KV260 FPGA, and run a live inference through the PS-PL AXI bridge.

## Learning Outcomes

- Synthesize SystemVerilog for Xilinx UltraScale+ using Vivado
- Understand PS-PL communication via AXI4-Lite
- Program a bitstream and verify hardware behavior
- Measure real power consumption and throughput

## Equipment

- Kria KV260 Vision AI Starter Kit (or Codespaces simulation)
- USB cable for JTAG/UART
- Optional: INA226 current sensor for power measurement

## Part 1: Project Setup (45 min)

### 1.1 Create Vivado Project

```tcl
create_project mls_kv260 ./mls_kv260 -part xck26-sfvc784-2LV-c
add_files {
    ../../reference/common/mls_common.sv
    ../../reference/common/a2a_register_file.sv
    ../../reference/fpga_prototypes/kv260_bitnet2b/kv260_bitnet2b_top.sv
}
set_property top kv260_bitnet2b_top [current_fileset]
```

### 1.2 Add Constraints

Create `kv260.xdc`:
```tcl
# Clock (PS-generated 200 MHz on PL fabric)
create_clock -period 5.000 -name pl_clk0 [get_pins */PS8/PLCLK0]

# AXI signals are synchronous to pl_clk0
set_false_path -from [get_clocks pl_clk0] -to [get_ports {led[*]}]
```

### 1.3 Block Design

Create a Zynq UltraScale+ block design with:
- PS: AXI Master GP0
- PL: Your inference engine wrapped as AXI4-Lite slave
- Address map: Base 0xA000_0000, 64KB range

## Part 2: Synthesis & Implementation (60 min)

### 2.1 Run Synthesis

```tcl
launch_runs synth_1 -jobs 4
wait_on_run synth_1
```

**Check utilization** — target numbers for 32×32 MAC array:
| Resource | Used | Available | Utilization |
|----------|------|-----------|------------|
| LUT | ~18,000 | 117,120 | ~15% |
| FF | ~12,000 | 234,240 | ~5% |
| DSP | 0 | 1,248 | 0% |
| BRAM | ~32 | 144 | ~22% |

Key insight: **0 DSP usage** — ternary weights need no multipliers!

### 2.2 Timing Closure

Verify timing meets 200 MHz target:
```tcl
report_timing_summary -delay_type min_max -max_paths 10
```

If timing fails, add pipeline registers to the adder tree.

### 2.3 Generate Bitstream

```tcl
launch_runs impl_1 -to_step write_bitstream -jobs 4
wait_on_run impl_1
```

## Part 3: Hardware Testing (60 min)

### 3.1 Program FPGA

```bash
# On KV260 (PetaLinux)
sudo xmutil unloadapp
sudo xmutil loadapp mls_kv260
```

### 3.2 Register Access

```python
import mmap, struct

# Memory-map the PL register space
with open("/dev/mem", "r+b") as f:
    mm = mmap.mmap(f.fileno(), 0x10000, offset=0xA0000000)

    # Read chip ID
    chip_id = struct.unpack("<I", mm[0x18:0x1C])[0]
    print(f"Chip ID: 0x{chip_id:08X}")

    # Read status
    status = struct.unpack("<I", mm[0x04:0x08])[0]
    print(f"Status: 0x{status:08X}")

    # Write command: RUN_INFERENCE
    mm[0x00:0x04] = struct.pack("<I", 0x02)
```

### 3.3 Run Inference

Load test weights, feed input activations, read output logits. Compare against software golden model.

## Part 4: Power Measurement (45 min)

### 4.1 Measure with INA226

```python
from fpga_lab.measurements.power.measure import INA226Reader, analyze_samples

reader = INA226Reader(bus="/sys/bus/i2c/devices/1-0040")
samples = reader.collect_samples(duration_s=10, interval_ms=100)
results = analyze_samples(samples)
print(f"Average power: {results['mean_power_w']:.3f} W")
print(f"Peak power: {results['max_power_w']:.3f} W")
```

### 4.2 Compare Power States

| State | Expected Power |
|-------|---------------|
| Idle | ~0.5 W |
| Inference (32×32) | ~1.2 W |
| Full load | ~2.0 W |

## Deliverables

1. Vivado project with passing synthesis and implementation
2. Utilization report screenshot showing 0 DSP usage
3. Timing report showing all paths met at 200 MHz
4. Register read/write log demonstrating hardware communication
5. Power measurement CSV (if hardware available)

## Troubleshooting

| Issue | Solution |
|-------|---------|
| Timing failure | Add pipeline stages to adder tree |
| AXI bus hang | Check address alignment (4-byte) |
| Bitstream won't load | Verify part number matches KV260 |
| No UART output | Check PS UART mux configuration |

## Reference

- `reference/fpga_prototypes/kv260_bitnet2b/` — Reference design
- `fpga_lab/platforms/kv260/platform.json` — Platform specifications
- Xilinx UG1089: KV260 Getting Started Guide
