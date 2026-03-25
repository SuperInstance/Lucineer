# FPGA Lab Testbench Runner
# Runs all testbenches via Verilator or Icarus Verilog

SIM ?= verilator

# Source directories
COMMON_RTL := ../../reference/common
TERNARY_RTL := ../../download/ternaryair/hardware/rtl

# Shared sources
COMMON_SRC := \
	$(COMMON_RTL)/mls_common.sv \
	$(COMMON_RTL)/a2a_register_file.sv

RAU_SRC := $(TERNARY_RTL)/rau.sv

ALL_COMMON := $(COMMON_SRC) $(RAU_SRC)

# Individual testbenches
TB_PE    := pe_tb.sv
TB_CHIP  := chip_tb.sv
TB_COMPL := compliance/tb_mls_compliance.sv

.PHONY: all pe chip compliance clean

all: pe chip compliance

# PE (RAU) testbench
pe:
ifeq ($(SIM),verilator)
	verilator --binary -Wall --trace --timing \
		-DSIMULATION --top-module pe_tb \
		$(RAU_SRC) $(TB_PE) \
		-o obj_pe/Vpe_tb && ./obj_pe/Vpe_tb
else
	iverilog -g2012 -DSIMULATION -o pe_tb.vvp $(RAU_SRC) $(TB_PE) && vvp pe_tb.vvp
endif
	@echo ""

# Full chip integration testbench
chip:
ifeq ($(SIM),verilator)
	verilator --binary -Wall --trace --timing \
		-DSIMULATION --top-module chip_tb \
		$(ALL_COMMON) $(TB_CHIP) \
		-o obj_chip/Vchip_tb && ./obj_chip/Vchip_tb
else
	iverilog -g2012 -DSIMULATION -o chip_tb.vvp $(ALL_COMMON) $(TB_CHIP) && vvp chip_tb.vvp
endif
	@echo ""

# MLS-1.0 compliance testbench
compliance:
ifeq ($(SIM),verilator)
	verilator --binary -Wall --trace --timing \
		-DSIMULATION --top-module tb_mls_compliance \
		$(ALL_COMMON) $(TB_COMPL) \
		-o obj_compl/Vtb_mls_compliance && ./obj_compl/Vtb_mls_compliance
else
	iverilog -g2012 -DSIMULATION -o compliance.vvp $(ALL_COMMON) $(TB_COMPL) && vvp compliance.vvp
endif
	@echo ""

clean:
	rm -rf obj_pe obj_chip obj_compl *.vvp *.vcd *.fst
