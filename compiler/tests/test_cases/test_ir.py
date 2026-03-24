"""
Tests for clawc IR (IRModule, IRFunction, IRNode, IRTensor).

Run: python -m pytest compiler/tests/test_cases/test_ir.py -v
"""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import numpy as np
import pytest

from clawc.ir import IRModule, IRFunction, IRNode, IRTensor, DType


# ------------------------------------------------------------------ #
# Fixtures                                                             #
# ------------------------------------------------------------------ #

def make_module(n_layers: int = 2) -> IRModule:
    module = IRModule(name="test_model")
    fn = IRFunction(name="main")

    # Embedding
    emb = IRTensor("embd.weight", (512, 64), DType.FP32,
                   data=np.random.randn(512, 64).astype(np.float32))
    fn.add_tensor(emb)

    for i in range(n_layers):
        w = IRTensor(f"layer_{i}.weight", (64, 64), DType.FP32,
                     data=np.random.randn(64, 64).astype(np.float32))
        fn.add_tensor(w)
        fn.add_node(IRNode(
            op="matmul",
            inputs=[f"h_{i}", w.name],
            outputs=[f"h_{i+1}"],
            attrs={"weight_tensor": w, "weight_frozen": False},
        ))

    module.add_function(fn)
    return module


# ------------------------------------------------------------------ #
# Tests                                                                #
# ------------------------------------------------------------------ #

class TestIRTensor:
    def test_numel(self):
        t = IRTensor("x", (3, 4, 5), DType.FP32)
        assert t.numel == 60

    def test_flatten_no_data_raises(self):
        t = IRTensor("x", (10,), DType.FP32, data=None)
        with pytest.raises(ValueError):
            t.flatten()

    def test_flatten_with_data(self):
        arr = np.arange(12, dtype=np.float32).reshape(3, 4)
        t = IRTensor("w", (3, 4), DType.FP32, data=arr)
        flat = t.flatten()
        assert len(flat) == 12
        assert flat[0] == 0.0
        assert flat[-1] == 11.0

    def test_repr(self):
        t = IRTensor("w", (2, 3), DType.TERNARY)
        assert "TERNARY" in repr(t)
        assert "w" in repr(t)


class TestIRNode:
    def test_weight_frozen_default_false(self):
        n = IRNode("matmul", ["x", "w"], ["y"])
        assert not n.is_weight_frozen()

    def test_weight_frozen_true(self):
        n = IRNode("matmul", ["x", "w"], ["y"], attrs={"weight_frozen": True})
        assert n.is_weight_frozen()

    def test_repr(self):
        n = IRNode("relu", ["h"], ["h_out"])
        assert "relu" in repr(n)


class TestIRModule:
    def test_op_count(self):
        m = make_module(n_layers=3)
        assert m.op_count() == 3

    def test_param_count(self):
        m = make_module(n_layers=2)
        # emb: 512×64 = 32768, layer0: 64×64=4096, layer1: 64×64=4096
        assert m.param_count() == 32768 + 4096 + 4096

    def test_collect_weights(self):
        m = make_module(n_layers=2)
        weights = m.collect_weights()
        assert len(weights) == 3  # emb + 2 layers

    def test_get_main(self):
        m = make_module()
        fn = m.get_main()
        assert fn.name == "main"

    def test_get_main_no_functions_raises(self):
        m = IRModule()
        with pytest.raises(KeyError):
            m.get_main()

    def test_stats(self):
        m = make_module(n_layers=2)
        s = m.stats()
        assert s["functions"] == 1
        assert s["nodes"] == 2
        assert s["params_M"] > 0

    def test_fingerprint_stable(self):
        m = make_module(n_layers=2)
        fp1 = m.fingerprint()
        fp2 = m.fingerprint()
        assert fp1 == fp2
        assert len(fp1) == 12

    def test_fingerprint_different_models(self):
        m1 = make_module(n_layers=2)
        m2 = make_module(n_layers=3)
        assert m1.fingerprint() != m2.fingerprint()

    def test_repr(self):
        m = make_module()
        r = repr(m)
        assert "test_model" in r
        assert "nodes=" in r
