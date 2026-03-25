#!/usr/bin/env python3
"""
CLAWC - Mask-Lock Inference Compiler
CLI Entry Point

Usage:
  clawc model.onnx -o chip.gds --target=sky130
  clawc model.gguf -o output/ --target=fpga-kv260 --quantize=ternary
  clawc --list-targets
  clawc --help
"""

import argparse
import sys
from pathlib import Path

from .compiler import Compiler
from .utils.logger import setup_logger

logger = setup_logger(__name__)

AVAILABLE_TARGETS = [
    "sim-verilator",      # Verilator simulation
    "fpga-kv260",         # Xilinx Kria SOM
    "asic-sky130",        # SkyWater 130nm
    "asic-gf180",         # GlobalFoundries 180nm
    "asic-generic",       # Generic systolic array
]

QUANTIZATION_FORMATS = [
    "float32",            # No quantization (simulation)
    "int8",               # 8-bit integer
    "int4",               # 4-bit integer
    "ternary",            # {-1, 0, +1} (MLS-native)
]


def parse_args():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="CLAWC: Mask-Lock Inference Compiler",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  clawc model.onnx -o output/ --target=sky130
  clawc model.gguf -o output/ --target=fpga-kv260 --quantize=ternary
  clawc --list-targets
""",
    )

    parser.add_argument("model", nargs="?", help="Model file (ONNX, GGUF, or PyTorch)")
    parser.add_argument(
        "-o", "--output", default="output/", help="Output directory (default: output/)"
    )
    parser.add_argument(
        "--target",
        default="sim-verilator",
        choices=AVAILABLE_TARGETS,
        help="Target architecture",
    )
    parser.add_argument(
        "--quantize",
        default="ternary",
        choices=QUANTIZATION_FORMATS,
        help="Quantization format",
    )
    parser.add_argument(
        "--list-targets", action="store_true", help="List available targets and exit"
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Verbose output (debug)"
    )

    return parser.parse_args()


def main():
    """Main CLI entry point."""
    args = parse_args()

    # List targets and exit
    if args.list_targets:
        print("Available CLAWC targets:")
        for target in AVAILABLE_TARGETS:
            print(f"  {target}")
        sys.exit(0)

    # Require model file
    if not args.model:
        print("Error: model file required", file=sys.stderr)
        sys.exit(1)

    model_path = Path(args.model)
    if not model_path.exists():
        print(f"Error: model file not found: {model_path}", file=sys.stderr)
        sys.exit(1)

    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info("CLAWC v0.1.0")
    logger.info(f"Compiling: {model_path}")
    logger.info(f"Target: {args.target}")
    logger.info(f"Quantization: {args.quantize}")
    logger.info(f"Output: {output_dir}")

    try:
        # Create compiler instance
        compiler = Compiler(
            target=args.target,
            quantize=args.quantize,
            output_dir=output_dir,
            verbose=args.verbose,
        )

        # Compile model
        result = compiler.compile(model_path)

        logger.info("✓ Compilation successful")
        logger.info("Generated files:")
        for filename in result["files"]:
            logger.info(f"  - {filename}")

        logger.info(f"Compilation complete. Output in: {output_dir}")

    except Exception as e:
        logger.error(f"Compilation failed: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
