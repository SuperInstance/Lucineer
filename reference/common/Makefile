# Common RTL build rules shared by all form factors
# Include from form factor Makefiles with: include ../../common/Makefile.common

# Simulator selection
SIM ?= verilator
TOPLEVEL ?= chip_top

# Common source files
COMMON_DIR := $(dir $(lastword $(MAKEFILE_LIST)))
COMMON_SRC := \
	$(COMMON_DIR)/mls_common.sv \
	$(COMMON_DIR)/a2a_register_file.sv

# Verilator flags
VERILATOR_FLAGS := --cc --exe --build -Wall \
	--trace --trace-fst \
	-CFLAGS "-std=c++17" \
	-DCLK_PERIOD_NS=5

# Icarus flags
IVERILOG_FLAGS := -g2012 -Wall -DSIMULATION

# Simulation time
SIM_TIME ?= 100us

.PHONY: sim lint synth clean

sim: $(TOPLEVEL)_sim
	./$(TOPLEVEL)_sim +timeout=$(SIM_TIME)

lint:
	verilator --lint-only -Wall $(COMMON_SRC) $(LOCAL_SRC)

clean:
	rm -rf obj_dir *.vvp *.vcd *.fst *.log
