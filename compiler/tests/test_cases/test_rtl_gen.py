"""
Tests for RTL generation (chip_top.sv output).

Run: python -m pytest compiler/tests/test_cases/test_rtl_gen.py -v
"""

import sys, os
import tempfile
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import numpy as np
import pytest

from clawc.ir import IRModule, IRFunction, IRNode, IRTensor, DType
from clawc.compiler import CompilerConfig
from clawc.backend.rtl_gen import RTLGenerator
from clawc.passes.memory_flatten import MemoryFlattenPass
from clawc.middle_end.quantizer import QuantizationPass
from clawc.passes.ternary_legalize import TernaryLegalizePass


# ------------------------------------------------------------------ #
# Helpers                                                              #
# ------------------------------------------------------------------ #

def make_small_model() -> IRModule:
    module = IRModule(name="tiny")
    fn = IRFunction(name="main")
    for i in range(2):
        data = np.sign(np.random.randn(16, 16)).astype(np.float32)
        wt = IRTensor(f"w{i}", (16, 16), DType.TERNARY, data=data)
        fn.add_tensor(wt)
        fn.add_node(IRNode("matmul", [f"h{i}", f"w{i}"], [f"h{i+1}"],
                           attrs={"weight_tensor": wt, "weight_frozen": False}))
    module.add_function(fn)
    return module


def prepared_module() -> IRModule:
    m = make_small_model()
    QuantizationPass("ternary").run(m)
    TernaryLegalizePass().run(m)
    MemoryFlattenPass().run(m)
    return m


# ------------------------------------------------------------------ #
# Tests                                                                #
# ------------------------------------------------------------------ #

class TestRTLGenerator:
    def test_emit_creates_file(self):
        m = prepared_module()
        with tempfile.TemporaryDirectory() as td:
            cfg = CompilerConfig(
                input_path=Path("model.gguf"),
                output_dir=Path(td),
                target="sim-verilator",
            )
            gen = RTLGenerator(cfg, m)
            out = gen.emit(Path(td) / "chip_top.sv")
            assert out.exists()
            assert out.stat().st_size > 0

    def test_sv_contains_top_module(self):
        m = prepared_module()
        with tempfile.TemporaryDirectory() as td:
            cfg = CompilerConfig(Path("x.gguf"), Path(td))
            gen = RTLGenerator(cfg, m)
            sv_path = Path(td) / "chip_top.sv"
            gen.emit(sv_path)
            content = sv_path.read_text()
            assert "module chip_top" in content
            assert "endmodule" in content

    def test_sv_contains_pe_module(self):
        m = prepared_module()
        with tempfile.TemporaryDirectory() as td:
            cfg = CompilerConfig(Path("x.gguf"), Path(td))
            gen = RTLGenerator(cfg, m)
            sv = Path(td) / "chip_top.sv"
            gen.emit(sv)
            content = sv.read_text()
            assert "clawc_ternary_pe" in content
            assert "clawc_pe_array" in content

    def test_sv_contains_rom_for_frozen_weights(self):
        m = prepared_module()
        with tempfile.TemporaryDirectory() as td:
            cfg = CompilerConfig(Path("x.gguf"), Path(td))
            gen = RTLGenerator(cfg, m)
            sv = Path(td) / "chip_top.sv"
            gen.emit(sv)
            content = sv.read_text()
            assert "weight_rom_" in content

    def test_sv_contains_csr_module(self):
        m = prepared_module()
        with tempfile.TemporaryDirectory() as td:
            cfg = CompilerConfig(Path("x.gguf"), Path(td))
            gen = RTLGenerator(cfg, m)
            sv = Path(td) / "chip_top.sv"
            gen.emit(sv)
            content = sv.read_text()
            assert "clawc_csr" in content
            assert "s_axi_awaddr" in content

    def test_sv_contains_gelu_lut(self):
        m = prepared_module()
        with tempfile.TemporaryDirectory() as td:
            cfg = CompilerConfig(Path("x.gguf"), Path(td))
            gen = RTLGenerator(cfg, m)
            sv = Path(td) / "chip_top.sv"
            gen.emit(sv)
            content = sv.read_text()
            assert "clawc_gelu_lut" in content

    def test_gelu_lut_entries_count(self):
        m = prepared_module()
        cfg = CompilerConfig(Path("x.gguf"), Path("."))
        gen = RTLGenerator(cfg, m)
        lut = gen._gelu_lut_entries(256)
        assert len(lut) == 256
        for v in lut:
            assert 0 <= v <= 0xFFFF

    def test_sky130_array_params(self):
        m = prepared_module()
        cfg = CompilerConfig(Path("x.gguf"), Path("."), target="asic-sky130")
        gen = RTLGenerator(cfg, m)
        params = gen._target_params()
        assert params["array_rows"] == 32
        assert params["array_cols"] == 32

    def test_fpga_array_params(self):
        m = prepared_module()
        cfg = CompilerConfig(Path("x.gguf"), Path("."), target="fpga-kv260")
        gen = RTLGenerator(cfg, m)
        params = gen._target_params()
        assert params["array_rows"] == 16
        assert params["array_cols"] == 16
