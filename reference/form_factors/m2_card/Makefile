# M.2 2230 Inference Card Build
# MLS Form Factor: Laptop AI accelerator

TOPLEVEL := m2_card_top
TARGET   ?= sky130

# RTL sources
COMMON_DIR := ../../common
LOCAL_SRC  := rtl/m2_card_top.sv

COMMON_SRC := \
	$(COMMON_DIR)/mls_common.sv \
	$(COMMON_DIR)/a2a_register_file.sv

REF_RTL := ../../../download/ternaryair/hardware/rtl
REF_SRC := \
	$(REF_RTL)/rau.sv \
	$(REF_RTL)/synaptic_array.sv \
	$(REF_RTL)/weight_rom.sv \
	$(REF_RTL)/kv_cache.sv

ALL_SRC := $(COMMON_SRC) $(REF_SRC) $(LOCAL_SRC)

.PHONY: sim lint synth driver bom clean

sim:
	verilator --cc --exe --build -Wall --trace \
		-DSIMULATION --top-module $(TOPLEVEL) $(ALL_SRC)

lint:
	verilator --lint-only -Wall -DSIMULATION \
		--top-module $(TOPLEVEL) $(ALL_SRC)

synth:
	@echo "Synthesizing for $(TARGET)..."
	@echo "(Requires OpenROAD + PDK)"

# Build Linux kernel driver
driver:
	$(MAKE) -C /lib/modules/$$(uname -r)/build M=$(PWD)/pcie_phy modules

bom:
	@echo "M.2 2230 Inference Card BOM"
	@echo "==========================="
	@echo "  MLS Inference ASIC         ×1   $$15.00"
	@echo "  PCIe Gen3 PHY (retimer)    ×1   $$3.00"
	@echo "  M.2 2230 edge connector    ×1   $$0.80"
	@echo "  3.3V/1.0V PMIC             ×1   $$2.50"
	@echo "  Decoupling (100nF, 10uF)   ×8   $$0.40"
	@echo "  Activity LED               ×1   $$0.05"
	@echo "  PCB (4-layer, 22×30mm)     ×1   $$3.00"
	@echo "  --------------------------------"
	@echo "  BOM Total:                      $$24.75"
	@echo "  Assembly:                       $$10.00"
	@echo "  Retail Target:                  $$49.00"

clean:
	rm -rf obj_dir *.vvp *.vcd *.fst *.log
