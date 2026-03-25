# KV260 BitNet 2B Prototype Build
# FPGA: Xilinx Kria KV260 (Zynq UltraScale+ xck26)

TOPLEVEL := kv260_bitnet2b_top
PART     := xck26-sfvc784-2LV-c
BOARD    := xilinx.com:kv260:part0:1.4

# Source files
COMMON_DIR := ../../common
REF_RTL    := ../../../download/ternaryair/hardware/rtl

SRC := \
	$(COMMON_DIR)/mls_common.sv \
	$(COMMON_DIR)/a2a_register_file.sv \
	$(REF_RTL)/rau.sv \
	$(REF_RTL)/synaptic_array.sv \
	$(REF_RTL)/weight_rom.sv \
	$(REF_RTL)/kv_cache.sv \
	kv260_bitnet2b_top.sv

# Constraints
XDC := kv260_pins.xdc

.PHONY: sim vivado synth bitstream program clean

# Verilator simulation
sim:
	verilator --cc --exe --build -Wall --trace \
		-DSIMULATION --top-module $(TOPLEVEL) $(SRC)

# Generate Vivado project
vivado:
	vivado -mode batch -source build_vivado.tcl

# Synthesis only
synth:
	@echo "Run: vivado -mode batch -source build_vivado.tcl"
	@echo "Target: $(PART)"
	@echo "Board: $(BOARD)"

# Generate bitstream
bitstream: vivado
	@echo "Bitstream generated: build/$(TOPLEVEL).bit"

# Program KV260
program:
	@echo "xsdb -eval 'connect; targets -set -filter {name =~ \"*A53*#0\"}; fpga build/$(TOPLEVEL).bit'"

clean:
	rm -rf obj_dir build *.log *.jou .Xil
