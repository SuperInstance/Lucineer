# Smart Battery Pack Build
# MLS Form Factor: Power bank with privacy

TOPLEVEL := smart_battery_top

COMMON_DIR := ../../common
LOCAL_SRC  := \
	rtl/smart_battery_top.sv \
	power_mgmt/bq_compat.sv

COMMON_SRC := $(COMMON_DIR)/mls_common.sv

ALL_SRC := $(COMMON_SRC) $(LOCAL_SRC)

.PHONY: sim lint bom clean

sim:
	verilator --cc --exe --build -Wall --trace \
		-DSIMULATION --top-module $(TOPLEVEL) $(ALL_SRC)

lint:
	verilator --lint-only -Wall -DSIMULATION \
		--top-module $(TOPLEVEL) $(ALL_SRC)

bom:
	@echo "Smart Battery Pack BOM"
	@echo "======================"
	@echo "  MLS Battery Gauge IC       ×1   $$4.00"
	@echo "  4S Li-ion cells (10Ah)     ×4  $$15.00"
	@echo "  USB-C PD controller        ×1   $$2.50"
	@echo "  Protection MOSFET          ×1   $$1.00"
	@echo "  PCB + passives             ×1   $$3.00"
	@echo "  Enclosure (plastic)        ×1   $$4.00"
	@echo "  --------------------------------"
	@echo "  BOM Total:                      $$29.50"
	@echo "  Assembly:                       $$8.00"
	@echo "  Retail Target:                  $$49.00"

clean:
	rm -rf obj_dir *.log
