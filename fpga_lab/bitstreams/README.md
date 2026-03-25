# Pre-Built Bitstreams

This directory contains pre-built FPGA bitstreams for quick deployment.

**Note:** Bitstreams are tracked via Git LFS due to their size (~5–50 MB each).

## Available Bitstreams

| File | Platform | Design | Size | Date |
|------|----------|--------|------|------|
| `kv260_bitnet2b.bit` | KV260 | BitNet 2B (32×32 array) | ~12 MB | — |
| `kv260_privacy.bit` | KV260 | PII Redaction Demo | ~8 MB | — |
| `genesys2_cascade_a.bit` | Genesys 2 | Cascade Board A | ~15 MB | — |
| `genesys2_cascade_b.bit` | Genesys 2 | Cascade Board B | ~15 MB | — |

## Setup Git LFS

```bash
git lfs install
git lfs track "fpga_lab/bitstreams/*.bit"
git lfs track "fpga_lab/bitstreams/*.bin"
```

## Programming

```bash
# KV260 (via xsdb)
xsdb -eval 'connect; targets -set -filter {name =~ "*A53*#0"}; fpga kv260_bitnet2b.bit'

# Genesys 2 (via Vivado Hardware Manager)
vivado -mode batch -source program.tcl -tclargs genesys2_cascade_a.bit
```

## Building From Source

Bitstreams are built nightly by CI. To build locally:

```bash
cd ../reference/fpga_prototypes/kv260_bitnet2b/
make bitstream
cp build/kv260_bitnet2b_top.bit ../../fpga_lab/bitstreams/kv260_bitnet2b.bit
```
