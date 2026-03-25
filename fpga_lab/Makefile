# FPGA Lab — Master Build & Test
#
# Runs all testbenches, measurements, and builds
#
# Usage:
#   make test          # Run all testbenches (Verilator)
#   make compliance    # Run MLS-1.0 compliance suite
#   make benchmark     # Run performance benchmark (simulated)
#   make power         # Run power measurement (simulated)
#   make thermal       # Run thermal logging (simulated)
#   make ci            # Full CI pipeline (test + compliance + benchmark)

SIM ?= verilator

.PHONY: test compliance benchmark power thermal ci clean

# Run all testbenches
test:
	$(MAKE) -C testbenches all SIM=$(SIM)

# MLS-1.0 compliance only
compliance:
	$(MAKE) -C testbenches compliance SIM=$(SIM)

# Performance benchmark
benchmark:
	python3 measurements/performance/benchmark.py \
		--platform kv260 --model bitnet-2b --tokens 50 \
		--output-dir results/performance/

# Power measurement
power:
	python3 measurements/power/measure.py \
		--platform kv260 --source simulation --duration 5 \
		--output-dir results/power/

# Thermal logging
thermal:
	python3 measurements/thermal/thermal_logger.py \
		--duration 10 --output-dir results/thermal/

# Full CI pipeline
ci: test compliance benchmark power
	@echo ""
	@echo "========================================"
	@echo "  FPGA Lab CI Pipeline Complete"
	@echo "========================================"
	@echo "  ✓ Testbenches passed"
	@echo "  ✓ MLS-1.0 compliance verified"
	@echo "  ✓ Performance benchmarked"
	@echo "  ✓ Power measured"
	@echo "========================================"

clean:
	$(MAKE) -C testbenches clean
	rm -rf results/
