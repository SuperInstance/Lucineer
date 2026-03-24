"""
Integration test: full compiler pipeline from IRModule → all artifacts.

Run: python -m pytest compiler/tests/test_cases/test_pipeline.py -v
"""

import sys, os
import json
import struct
import tempfile
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import numpy as np
import pytest

from clawc import Compiler, CompilerConfig
from clawc.ir import IRModule, IRFunction, IRNode, IRTensor, DType


# ------------------------------------------------------------------ #
# Fixtures                                                             #
# ------------------------------------------------------------------ #

def minimal_ternary_model() -> IRModule:
    """3-layer ternary model, fully pre-built."""
    module = IRModule(name="minimal")
    fn = IRFunction(name="main")

    dims = [(32, 64), (64, 64), (64, 32)]
    for i, (r, c) in enumerate(dims):
        data = np.sign(np.random.randn(r, c)).astype(np.float32)
        wt = IRTensor(f"w{i}", (r, c), DType.TERNARY, data=data)
        fn.add_tensor(wt)
        fn.add_node(IRNode("matmul", [f"h{i}", f"w{i}"], [f"h{i+1}"],
                           attrs={"weight_tensor": wt, "weight_frozen": False}))

    # Add a relu after first matmul
    fn.add_node(IRNode("relu", ["h1"], ["h1_act"]))

    module.add_function(fn)
    return module


# ------------------------------------------------------------------ #
# Tests                                                                #
# ------------------------------------------------------------------ #

class TestFullPipeline:
    def test_compile_from_ir_emits_rtl(self):
        m = minimal_ternary_model()
        with tempfile.TemporaryDirectory() as td:
            cfg = CompilerConfig(
                input_path=Path("model.gguf"),
                output_dir=Path(td),
                target="sim-verilator",
                quant_scheme="ternary",
                opt_level=2,
                emit={"rtl", "bitstream", "bom"},
            )
            result = Compiler(cfg).compile_from_ir(m)
            assert "rtl" in result.artifacts
            assert Path(result.artifacts["rtl"]).exists()

    def test_compile_from_ir_emits_bom(self):
        m = minimal_ternary_model()
        with tempfile.TemporaryDirectory() as td:
            cfg = CompilerConfig(
                input_path=Path("model.gguf"),
                output_dir=Path(td),
                target="asic-sky130",
                quant_scheme="ternary",
                emit={"bom"},
            )
            result = Compiler(cfg).compile_from_ir(m)
            assert "bom" in result.artifacts
            bom_path = Path(result.artifacts["bom"])
            assert bom_path.exists()
            bom = json.loads(bom_path.read_text())
            assert "total_usd" in bom
            assert bom["target"] == "asic-sky130"

    def test_compile_from_ir_emits_bitstream(self):
        m = minimal_ternary_model()
        with tempfile.TemporaryDirectory() as td:
            cfg = CompilerConfig(
                input_path=Path("model.gguf"),
                output_dir=Path(td),
                emit={"bitstream"},
            )
            result = Compiler(cfg).compile_from_ir(m)
            assert "bitstream" in result.artifacts
            bs_path = Path(result.artifacts["bitstream"])
            assert bs_path.exists()
            # Validate magic bytes
            with open(bs_path, "rb") as f:
                magic = f.read(4)
            assert magic == b"CLWC"

    def test_elapsed_ms_populated(self):
        m = minimal_ternary_model()
        with tempfile.TemporaryDirectory() as td:
            cfg = CompilerConfig(Path("x.gguf"), Path(td))
            result = Compiler(cfg).compile_from_ir(m)
            assert result.elapsed_ms > 0

    def test_opt_level_0_skips_fusion(self):
        """At opt_level=0 no fusions should happen."""
        m = minimal_ternary_model()
        with tempfile.TemporaryDirectory() as td:
            cfg = CompilerConfig(
                input_path=Path("x.gguf"),
                output_dir=Path(td),
                opt_level=0,
                emit={"rtl"},
            )
            result = Compiler(cfg).compile_from_ir(m)
            # At opt_level 0 weight_frozen should NOT be set
            fn = m.get_main()
            frozen = [n for n in fn.nodes if n.attrs.get("weight_frozen")]
            assert len(frozen) == 0

    def test_opt_level_2_freezes_weights(self):
        m = minimal_ternary_model()
        with tempfile.TemporaryDirectory() as td:
            cfg = CompilerConfig(
                input_path=Path("x.gguf"),
                output_dir=Path(td),
                opt_level=2,
                quant_scheme="ternary",
                emit={"rtl"},
            )
            result = Compiler(cfg).compile_from_ir(m)
            fn = m.get_main()
            frozen = [n for n in fn.nodes if n.attrs.get("weight_frozen")]
            assert len(frozen) > 0

    def test_cascade_assigns_chip_ids(self):
        m = minimal_ternary_model()
        with tempfile.TemporaryDirectory() as td:
            cfg = CompilerConfig(
                input_path=Path("x.gguf"),
                output_dir=Path(td),
                cascade_chips=2,
                emit={"rtl"},
            )
            result = Compiler(cfg).compile_from_ir(m)
            fn = m.get_main()
            chip_ids = {n.attrs.get("chip_id") for n in fn.nodes}
            assert 0 in chip_ids

    def test_bom_cascade_multiplied(self):
        # Use separate output dirs to avoid bom.json overwrite
        with tempfile.TemporaryDirectory() as td1, tempfile.TemporaryDirectory() as td2:
            m1 = minimal_ternary_model()
            cfg1 = CompilerConfig(Path("x.gguf"), Path(td1), cascade_chips=1, emit={"bom"})
            r1 = Compiler(cfg1).compile_from_ir(m1)
            bom1 = json.loads(Path(r1.artifacts["bom"]).read_text())

            m2 = minimal_ternary_model()
            cfg2 = CompilerConfig(Path("x.gguf"), Path(td2), cascade_chips=2, emit={"bom"})
            r2 = Compiler(cfg2).compile_from_ir(m2)
            bom2 = json.loads(Path(r2.artifacts["bom"]).read_text())

            # 2-chip BOM should cost more than 1-chip
            assert bom2["total_usd"] > bom1["total_usd"]
