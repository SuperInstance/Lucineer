"""
clawc — Mask-Lock Inference Compiler
CLI entry point.

Usage:
    clawc model.onnx -o out/ --target=sky130
    clawc model.gguf -o out/ --target=fpga-kv260
    clawc --list-targets
"""

import argparse
import sys
import json
from pathlib import Path

from clawc.utils.logger import get_logger
from clawc.compiler import Compiler, CompilerConfig

log = get_logger("clawc")

TARGETS = {
    "fpga-kv260":   "clawc.backend.targets.fpga_kv260",
    "asic-sky130":  "clawc.backend.targets.mask_lock_std",
    "asic-gf180":   "clawc.backend.targets.mask_lock_std",
    "sim-verilator":"clawc.backend.targets.generic_ml",
}


def parse_args(argv=None):
    p = argparse.ArgumentParser(
        prog="clawc",
        description="Mask-Lock Inference Compiler — ONNX/GGUF → RTL/GDS",
    )
    p.add_argument("input", nargs="?", help="Input model file (.onnx | .gguf | .pt)")
    p.add_argument("-o", "--output", default="out/", help="Output directory (default: out/)")
    p.add_argument("--target", default="sim-verilator",
                   help="Backend target (use --list-targets to see options)")
    p.add_argument("--list-targets", action="store_true", help="List available targets and exit")
    p.add_argument("--opt-level", type=int, default=2, choices=[0, 1, 2, 3],
                   help="Optimization level (0=none … 3=aggressive)")
    p.add_argument("--quant", default="ternary", choices=["fp32", "int8", "int4", "ternary"],
                   help="Weight quantization scheme")
    p.add_argument("--cascade", type=int, default=1, metavar="N",
                   help="Partition model across N chips")
    p.add_argument("--emit", nargs="+",
                   default=["rtl", "bitstream", "bom"],
                   choices=["rtl", "gds", "bitstream", "bom", "sim"],
                   help="Artifacts to emit")
    p.add_argument("--pdk-root", default=None, help="PDK root path (required for GDS emission)")
    p.add_argument("--verbose", "-v", action="store_true")
    return p.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)

    if args.list_targets:
        print("\nAvailable clawc targets:")
        for name, module in TARGETS.items():
            print(f"  {name:<20} ({module})")
        print()
        return 0

    if not args.input:
        print("error: input model file required (or --list-targets)", file=sys.stderr)
        return 1

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"error: input file not found: {input_path}", file=sys.stderr)
        return 1

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.target not in TARGETS:
        print(f"error: unknown target '{args.target}'. Use --list-targets.", file=sys.stderr)
        return 1

    cfg = CompilerConfig(
        input_path=input_path,
        output_dir=output_dir,
        target=args.target,
        opt_level=args.opt_level,
        quant_scheme=args.quant,
        cascade_chips=args.cascade,
        emit=set(args.emit),
        pdk_root=Path(args.pdk_root) if args.pdk_root else None,
        verbose=args.verbose,
    )

    log.info(f"clawc  input={input_path}  target={args.target}  opt={args.opt_level}")

    try:
        compiler = Compiler(cfg)
        result = compiler.compile()
    except Exception as exc:
        log.error(f"Compilation failed: {exc}")
        if args.verbose:
            raise
        return 1

    # Print summary
    print(f"\nclawc — compilation complete  ({result.elapsed_ms:.0f} ms)")
    print(f"  output: {output_dir}/")
    for artifact, path in sorted(result.artifacts.items()):
        size = Path(path).stat().st_size if Path(path).exists() else 0
        print(f"    {artifact:<20} {path}  ({size:,} bytes)")
    if result.bom:
        total = result.bom.get("total_usd", 0)
        print(f"  estimated BOM cost: ${total:.2f}")
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
