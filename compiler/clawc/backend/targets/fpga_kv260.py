"""
clawc.backend.targets.fpga_kv260 — AMD/Xilinx KV260 FPGA emulation target.

The KV260 (Kria) hosts a Zynq UltraScale+ MPSoC with:
  - PL (FPGA): ~256K LUTs, ~512 DSP58E2, 4 MB BRAM
  - PS (ARM Cortex-A53): host-side orchestration

Mapping strategy for ternary inference:
  - Each ternary MAC: 1 LUT2 (no DSP needed — addition only)
  - 16×16 PE array fits in ~4K LUTs
  - Weights: BRAM (small models) or block RAM init (mask-lock style)
  - Interface: AXI4-Stream from PS via DMA

FPGA resource estimate (16×16 PE, 7B ternary model):
  LUTs:  ~18K  (7% of KV260 PL)
  BRAM:  ~64 × 36Kb = 2.3 MB
  FF:    ~12K
  DSPs:  0  (ternary = no multipliers)

Generated artifacts:
  - chip_top.sv           RTL (instantiates BRAM init instead of ROM metal)
  - programming.bin       AXI4-Stream weight bitstream
  - vivado_project.tcl    Vivado project creation script
  - xdc/chip_top.xdc      Pin constraints for KV260
"""

TARGET_NAME = "fpga_kv260"
DISPLAY_NAME = "AMD/Xilinx KV260 (Kria) FPGA Emulation"

CONFIG = {
    "array_rows":          16,
    "array_cols":          16,
    "act_width":           16,
    "acc_width":           32,
    "clk_period_ns":       5.0,      # 200 MHz (PL clock)
    "rom_style":           "bram",   # vs "metal" for ASIC
    "bram_36k":            64,       # BRAM budget
    "lut_budget":          20_000,
    "supports_gds":        False,
    "supports_bitstream":  True,
    "supports_vivado_tcl": True,
    "quant_native":        ["ternary", "int8"],
    "target_power_mw":     5000,     # KV260 PL active
    "part":                "xck26-sfvc784-2LV-c",
    "board":               "xilinx_k26c_1.0",
    "ps_freq_mhz":         1333,
    "pl_freq_mhz":         200,
    "note": "KV260 FPGA emulation — weights stored in BRAM init (mask-lock style).",
}


def vivado_tcl(project_dir: str, sv_path: str, xdc_path: str) -> str:
    """Generate a Vivado project creation TCL script."""
    return f"""
# clawc-generated Vivado project script
# Run: vivado -mode batch -source vivado_project.tcl

set proj_dir {project_dir}
set part {CONFIG["part"]}

create_project clawc_chip $proj_dir -part $part -force
set_property board_part {CONFIG["board"]} [current_project]

# Add RTL sources
add_files -norecurse {sv_path}
set_property file_type {{SystemVerilog}} [get_files *.sv]

# Constraints
add_files -fileset constrs_1 {xdc_path}

# Synthesis + implementation
synth_design -top chip_top -part $part
opt_design
place_design
route_design

# Reports
report_timing_summary -file timing_summary.rpt
report_utilization    -file utilization.rpt
report_power          -file power.rpt

# Bitstream
write_bitstream -force chip_top.bit
puts "clawc: bitstream written to chip_top.bit"
""".strip()


def xdc_constraints(clk_period_ns: float = 5.0) -> str:
    """Generate XDC pin constraints for KV260."""
    return f"""
# clawc KV260 pin constraints
# Kria K26 SOM — PL clock from PS
create_clock -period {clk_period_ns} -name pl_clk0 [get_ports clk]

# AXI-Lite signals (PS↔PL via EMIO or AXI interconnect)
set_property PACKAGE_PIN H12 [get_ports clk]
set_property IOSTANDARD  LVCMOS18 [get_ports clk]
set_property PACKAGE_PIN G12 [get_ports rst_n]
set_property IOSTANDARD  LVCMOS18 [get_ports rst_n]

# Timing exceptions for ROM (combinational read path)
set_false_path -from [get_cells weight_rom_*]
""".strip()
