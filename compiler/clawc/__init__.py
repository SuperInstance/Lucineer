"""
clawc — Mask-Lock Inference Compiler

Python API:
    from clawc import Compiler, CompilerConfig
    from pathlib import Path

    cfg = CompilerConfig(
        input_path=Path("model.gguf"),
        output_dir=Path("out/"),
        target="asic-sky130",
        quant_scheme="ternary",
    )
    result = Compiler(cfg).compile()
    print(result.artifacts)
"""

from clawc.compiler import Compiler, CompilerConfig
from clawc.ir import IRModule, IRFunction, IRNode, IRTensor, DType

__all__ = [
    "Compiler",
    "CompilerConfig",
    "IRModule",
    "IRFunction",
    "IRNode",
    "IRTensor",
    "DType",
]
__version__ = "0.1.0"
