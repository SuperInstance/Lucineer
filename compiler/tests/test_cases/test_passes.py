"""
Tests for compiler passes: quantizer, ternary_legalize, mac_fusion, memory_flatten.

Run: python -m pytest compiler/tests/test_cases/test_passes.py -v
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import numpy as np
import pytest

from clawc.ir import IRModule, IRFunction, IRNode, IRTensor, DType
from clawc.middle_end.quantizer import QuantizationPass, _quantize_ternary
from clawc.passes.ternary_legalize import TernaryLegalizePass
from clawc.passes.mac_fusion import MACFusionPass
from clawc.passes.memory_flatten import MemoryFlattenPass, _ternary_to_2bit


# ------------------------------------------------------------------ #
# Helpers                                                              #
# ------------------------------------------------------------------ #

def make_matmul_module(rows=8, cols=8, dtype=DType.FP32) -> IRModule:
    """Single matmul with a weight tensor."""
    module = IRModule(name="test")
    fn = IRFunction(name="main")
    data = np.random.randn(rows, cols).astype(np.float32)
    if dtype == DType.TERNARY:
        data = np.sign(data).astype(np.float32)
    wt = IRTensor("w0", (rows, cols), dtype, data=data)
    fn.add_tensor(wt)
    fn.add_node(IRNode("matmul", ["x", "w0"], ["y"],
                       attrs={"weight_tensor": wt, "weight_frozen": False}))
    module.add_function(fn)
    return module


# ------------------------------------------------------------------ #
# Quantization tests                                                   #
# ------------------------------------------------------------------ #

class TestQuantizer:
    def test_ternary_values_bounded(self):
        arr = np.random.randn(64, 64).astype(np.float32) * 5
        q = _quantize_ternary(arr)
        assert np.all(q >= -1.0)
        assert np.all(q <= 1.0)

    def test_ternary_unique_values(self):
        arr = np.random.randn(100, 100).astype(np.float32)
        q = _quantize_ternary(arr)
        unique = set(np.unique(q).tolist())
        assert unique.issubset({-1.0, 0.0, 1.0})

    def test_ternary_zero_input(self):
        arr = np.zeros((4, 4), dtype=np.float32)
        q = _quantize_ternary(arr)
        assert np.all(q == 0.0)

    def test_pass_converts_fp32_to_ternary(self):
        m = make_matmul_module()
        QuantizationPass("ternary").run(m)
        fn = m.get_main()
        for t in fn.tensors.values():
            if t.data is not None:
                assert t.dtype == DType.TERNARY

    def test_pass_fp32_noop(self):
        m = make_matmul_module()
        original_dtype = m.get_main().tensors["w0"].dtype
        QuantizationPass("fp32").run(m)
        assert m.get_main().tensors["w0"].dtype == original_dtype

    def test_pass_int8_range(self):
        m = make_matmul_module()
        QuantizationPass("int8").run(m)
        fn = m.get_main()
        t = fn.tensors["w0"]
        assert t.dtype == DType.INT8


# ------------------------------------------------------------------ #
# Ternary legalization tests                                           #
# ------------------------------------------------------------------ #

class TestTernaryLegalize:
    def test_clamps_illegal_values(self):
        m = make_matmul_module(dtype=DType.TERNARY)
        fn = m.get_main()
        # Inject illegal values
        fn.tensors["w0"].data[0, 0] = 2.5
        fn.tensors["w0"].data[0, 1] = -3.0
        TernaryLegalizePass().run(m)
        arr = fn.tensors["w0"].data
        assert np.all(arr >= -1.0) and np.all(arr <= 1.0)

    def test_extracts_activation_scale(self):
        m = make_matmul_module(dtype=DType.TERNARY)
        TernaryLegalizePass().run(m)
        node = m.get_main().nodes[0]
        assert "activation_scale" in node.attrs
        scales = node.attrs["activation_scale"]
        assert len(scales) == 8  # n_rows

    def test_marks_zero_rows(self):
        m = make_matmul_module(dtype=DType.TERNARY)
        fn = m.get_main()
        fn.tensors["w0"].data[3, :] = 0.0   # force row 3 to zero
        fn.tensors["w0"].data[5, :] = 0.0   # force row 5 to zero
        TernaryLegalizePass().run(m)
        node = fn.nodes[0]
        assert "zero_rows" in node.attrs
        assert set(node.attrs["zero_rows"]) == {3, 5}

    def test_no_scale_for_1d_tensor(self):
        m = IRModule(name="t")
        fn = IRFunction(name="main")
        bias = IRTensor("b", (8,), DType.TERNARY,
                        data=np.array([1.0, -1.0, 0.0, 1.0, 0.0, -1.0, 1.0, 0.0]))
        fn.add_tensor(bias)
        fn.add_node(IRNode("add", ["x", "b"], ["y"],
                           attrs={"weight_tensor": bias, "weight_frozen": False}))
        m.add_function(fn)
        TernaryLegalizePass().run(m)  # should not raise


# ------------------------------------------------------------------ #
# MAC fusion tests                                                     #
# ------------------------------------------------------------------ #

class TestMACFusion:
    def _make_ternary_matmul(self, name="w", stage=0):
        m = make_matmul_module(dtype=DType.TERNARY)
        TernaryLegalizePass().run(m)
        m.get_main().nodes[0].attrs["pipeline_stage"] = stage
        return m

    def test_ternary_accumulate_style(self):
        m = self._make_ternary_matmul()
        MACFusionPass().run(m)
        node = m.get_main().nodes[0]
        assert node.attrs.get("mac_style") == "ternary_accumulate"

    def test_pos_neg_masks_populated(self):
        m = self._make_ternary_matmul()
        MACFusionPass().run(m)
        node = m.get_main().nodes[0]
        assert "pos_mask" in node.attrs
        assert "neg_mask" in node.attrs
        pos = node.attrs["pos_mask"]
        neg = node.attrs["neg_mask"]
        assert pos.shape == (8, 8)
        assert neg.shape == (8, 8)

    def test_sparsity_range(self):
        m = self._make_ternary_matmul()
        MACFusionPass().run(m)
        sparsity = m.get_main().nodes[0].attrs["sparsity"]
        assert 0.0 <= sparsity <= 1.0


# ------------------------------------------------------------------ #
# Memory flatten (mask-lock transform) tests                          #
# ------------------------------------------------------------------ #

class TestMemoryFlatten:
    def test_ternary_to_2bit_encoding(self):
        assert _ternary_to_2bit(-1.0) == 0b01
        assert _ternary_to_2bit( 0.0) == 0b00
        assert _ternary_to_2bit(+1.0) == 0b10

    def test_freeze_sets_weight_frozen(self):
        m = make_matmul_module(dtype=DType.TERNARY)
        MemoryFlattenPass().run(m)
        node = m.get_main().nodes[0]
        assert node.attrs.get("weight_frozen") is True

    def test_rom_init_populated(self):
        m = make_matmul_module(dtype=DType.TERNARY)
        MemoryFlattenPass().run(m)
        node = m.get_main().nodes[0]
        assert "rom_init" in node.attrs
        assert isinstance(node.attrs["rom_init"], list)
        assert len(node.attrs["rom_init"]) > 0

    def test_rom_depth_matches_numel(self):
        m = make_matmul_module(rows=4, cols=4, dtype=DType.TERNARY)
        MemoryFlattenPass().run(m)
        node = m.get_main().nodes[0]
        # 4×4 = 16 elements, 16 per 32-bit word → 1 word
        assert node.attrs["rom_depth"] == 1

    def test_dram_bytes_saved_positive(self):
        m = make_matmul_module(dtype=DType.TERNARY)
        MemoryFlattenPass().run(m)
        node = m.get_main().nodes[0]
        assert node.attrs["dram_bytes_saved"] > 0

    def test_compression_ratio_gt_1(self):
        m = make_matmul_module(rows=32, cols=32, dtype=DType.TERNARY)
        MemoryFlattenPass().run(m)
        node = m.get_main().nodes[0]
        assert node.attrs["compression_ratio"] > 1.0

    def test_fp32_node_stays_dram(self):
        m = make_matmul_module(dtype=DType.FP32)
        MemoryFlattenPass().run(m)
        node = m.get_main().nodes[0]
        assert node.attrs.get("weight_frozen") is False
        assert node.attrs.get("storage") == "dram_scratchpad"

    def test_generate_sv_rom(self):
        m = make_matmul_module(rows=4, cols=4, dtype=DType.TERNARY)
        mfp = MemoryFlattenPass()
        mfp.run(m)
        node = m.get_main().nodes[0]
        sv = mfp.generate_sv_rom(node, "test_rom")
        assert "module test_rom" in sv
        assert "endmodule" in sv
        assert "mem[" in sv
        assert "Mask-lock ROM" in sv

    def test_roundtrip_encode_decode(self):
        """Verify that ternary → ROM → decode gives back original values."""
        arr = np.array([-1.0, 0.0, +1.0, -1.0, +1.0, 0.0, -1.0, +1.0,
                        +1.0, -1.0, 0.0, 0.0, +1.0, -1.0, +1.0, 0.0],
                       dtype=np.float32)
        mfp = MemoryFlattenPass()
        words, _ = mfp._encode_rom(arr)

        # Decode
        decoded = []
        for word in words:
            for bit_pos in range(16):
                enc = (word >> (bit_pos * 2)) & 0x3
                if enc == 0b10:
                    decoded.append(+1.0)
                elif enc == 0b01:
                    decoded.append(-1.0)
                else:
                    decoded.append(0.0)

        decoded = np.array(decoded[:len(arr)])
        np.testing.assert_array_equal(decoded, arr)
