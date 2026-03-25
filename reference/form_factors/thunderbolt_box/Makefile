# Thunderbolt Box Build
# MLS Form Factor: Desktop AI co-processor

TOPLEVEL := thunderbolt_top

COMMON_DIR := ../../common
LOCAL_SRC  := rtl/thunderbolt_top.sv

COMMON_SRC := \
	$(COMMON_DIR)/mls_common.sv \
	$(COMMON_DIR)/a2a_register_file.sv

ALL_SRC := $(COMMON_SRC) $(LOCAL_SRC)

.PHONY: sim lint bom clean

sim:
	verilator --cc --exe --build -Wall --trace \
		-DSIMULATION --top-module $(TOPLEVEL) $(ALL_SRC)

lint:
	verilator --lint-only -Wall -DSIMULATION \
		--top-module $(TOPLEVEL) $(ALL_SRC)

bom:
	@echo "Thunderbolt Box BOM"
	@echo "==================="
	@echo "  MLS Inference ASIC (×4)    ×4  $$60.00"
	@echo "  Thunderbolt controller     ×1  $$12.00"
	@echo "  UCIe bridge IC (×3)        ×3  $$9.00"
	@echo "  60W external PSU           ×1  $$8.00"
	@echo "  Fan + heatsink assembly    ×1  $$5.00"
	@echo "  PCB (6-layer, 100×150mm)   ×1  $$8.00"
	@echo "  Aluminum enclosure         ×1  $$12.00"
	@echo "  --------------------------------"
	@echo "  BOM Total:                     $$114.00"
	@echo "  Assembly:                      $$25.00"
	@echo "  Retail Target:                 $$199.00"

clean:
	rm -rf obj_dir *.log
