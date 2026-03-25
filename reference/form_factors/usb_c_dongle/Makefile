# USB-C Dongle Build
# MLS Form Factor: Intelligence on a keychain

TOPLEVEL := usb_dongle_top
TARGET   ?= sky130

# RTL sources
COMMON_DIR := ../../common
LOCAL_SRC  := \
	rtl/usb_dongle_top.sv

COMMON_SRC := \
	$(COMMON_DIR)/mls_common.sv \
	$(COMMON_DIR)/a2a_register_file.sv

# Reference RTL (from TernaryAir)
REF_RTL := ../../../download/ternaryair/hardware/rtl
REF_SRC := \
	$(REF_RTL)/rau.sv \
	$(REF_RTL)/synaptic_array.sv \
	$(REF_RTL)/weight_rom.sv \
	$(REF_RTL)/kv_cache.sv

ALL_SRC := $(COMMON_SRC) $(REF_SRC) $(LOCAL_SRC)

.PHONY: sim lint synth bom clean

# Verilator simulation
sim:
	verilator --cc --exe --build -Wall --trace \
		-DSIMULATION \
		--top-module $(TOPLEVEL) \
		$(ALL_SRC)
	@echo "Simulation built: obj_dir/V$(TOPLEVEL)"

# Lint check
lint:
	verilator --lint-only -Wall \
		-DSIMULATION \
		--top-module $(TOPLEVEL) \
		$(ALL_SRC)

# OpenROAD synthesis (sky130)
synth:
	@echo "Target PDK: $(TARGET)"
	@echo "Running synthesis with OpenROAD..."
	@echo "(Requires OpenROAD + sky130 PDK installed)"
	# yosys -p "read_verilog -sv $(ALL_SRC); synth_sky130; write_json synth.json"

# Bill of materials
bom:
	@echo "USB-C Dongle BOM"
	@echo "================"
	@echo "  MLS Inference ASIC (sky130)  ×1   $$8.00"
	@echo "  USB-C connector              ×1   $$0.50"
	@echo "  3.3V LDO (AP2112)            ×1   $$0.30"
	@echo "  Decoupling caps (100nF)      ×4   $$0.20"
	@echo "  LEDs (0402)                  ×3   $$0.15"
	@echo "  PCB (2-layer, 15×30mm)       ×1   $$1.50"
	@echo "  Enclosure (injection mold)   ×1   $$1.50"
	@echo "  --------------------------------"
	@echo "  BOM Total:                        $$12.15"
	@echo "  Assembly:                         $$8.00"
	@echo "  Retail Target:                    $$20.00"

clean:
	rm -rf obj_dir *.vvp *.vcd *.fst *.log synth.json
