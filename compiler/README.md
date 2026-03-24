# clawc — Mask-Lock Inference Compiler

Compiles ONNX/GGUF/TorchScript models into hardware artifacts for the Mask-Lock chip architecture.

## Quick Start

```sh
# Install
pip install -e compiler/

# List targets
clawc --list-targets

# Compile ONNX model → RTL + BOM
clawc model.onnx -o out/ --target=asic-sky130

# Compile BitNet GGUF → FPGA bitstream
clawc model.gguf -o out/ --target=fpga-kv260

# Compile with 2-chip cascade
clawc model.onnx -o out/ --target=asic-sky130 --cascade=2
```

## Python API

```python
from clawc import Compiler, CompilerConfig
from pathlib import Path

cfg = CompilerConfig(
    input_path=Path("model.gguf"),
    output_dir=Path("out/"),
    target="asic-sky130",
    quant_scheme="ternary",
    opt_level=2,
    emit={"rtl", "bitstream", "bom"},
)
result = Compiler(cfg).compile()
print(result.artifacts)
# {'rtl': 'out/chip_top.sv', 'bitstream': 'out/programming.bin', 'bom': 'out/bom.json'}
```

## Output Artifacts

| Artifact | File | Description |
|----------|------|-------------|
| `rtl` | `chip_top.sv` | SystemVerilog netlist |
| `gds` | `chip.gds` | GDSII mask data (PDK required) |
| `bitstream` | `programming.bin` | Packed ternary weight bitstream |
| `bom` | `bom.json` | Bill of Materials cost estimate |

## Targets

| Target | Description |
|--------|-------------|
| `sim-verilator` | Generic simulation (no PDK) |
| `fpga-kv260` | AMD/Xilinx KV260 Kria FPGA |
| `asic-sky130` | SKY130 open PDK (efabless shuttle) |
| `asic-gf180` | GF180MCU open PDK |

## Architecture

```
Frontend          Middle-end             Backend
──────────        ──────────────         ───────────────────
onnx_loader  ──►  QuantizationPass  ──►  rtl_gen.py  → .sv
gguf_loader  ──►  TernaryLegalize   ──►  gdsii_gen.py → .gds
torchscript  ──►  MACFusion         ──►  pnr_interface.py
             ──►  MemoryFlatten     ──►  (→ OpenROAD → .gds)
                  Partitioner
                  Scheduler
```

### The Mask-Lock Transform (`MemoryFlattenPass`)

Standard chips load weights from DRAM at runtime (power-hungry).
The mask-lock transform converts ternary weight matrices to ROM constants:

```
Before:  W = DRAM[weight_addr]    # memory-bound, ~100pJ/access
After:   W = ROM_constant          # metal-layer, ~0.01pJ/access
```

Ternary encoding (2 bits/weight):
- `+1` → `0b10`
- ` 0` → `0b00`
- `-1` → `0b01`

## Tests

```sh
# Unit tests (no external deps)
python -m pytest compiler/tests/test_cases/ -v

# With onnx
pip install onnx && python -m pytest compiler/tests/ -v -k onnx

# Lit tests
pip install lit && lit compiler/tests/
```

## Runtime (C)

The `runtime/` directory provides a C library for host communication:

```c
#include "clawrt.h"

clawrt_handle_t h;
clawrt_open(&h, CLAWRT_TRANSPORT_PCIE, "/dev/clawc0");
clawrt_load_bitstream(&h, "programming.bin");

int32_t logits[32000];
clawrt_output_t out = { .logits = logits, .n_logits = 32000 };
uint32_t tokens[] = {1, 2048, 42};
clawrt_run(&h, tokens, 3, &out, NULL);

printf("%.1f tok/s\n", out.tokens_per_second);
clawrt_close(&h);
```

Supported transports: PCIe (ASIC), SPI (Jetson), UART (debug), Sim (Verilator).
