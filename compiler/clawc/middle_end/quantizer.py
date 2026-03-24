"""
clawc.middle_end.quantizer — Weight quantization pass.

Converts FP32 weights to INT8, INT4, or Ternary {-1,0,+1}.

Ternary quantization follows BitNet b1.58:
    scale = mean(|W|)
    W_q   = clip(round(W / scale), -1, +1)
"""

from __future__ import annotations

import numpy as np

from clawc.ir import IRModule, IRNode, IRTensor, DType
from clawc.utils.logger import get_logger

log = get_logger("middle_end.quantizer")


class QuantizationPass:
    def __init__(self, scheme: str = "ternary"):
        assert scheme in ("fp32", "fp16", "int8", "int4", "ternary"), \
            f"Unknown quant scheme: {scheme}"
        self.scheme = scheme

    def run(self, module: IRModule):
        if self.scheme == "fp32":
            log.info("  quantizer: fp32 — no-op")
            return

        n_converted = 0
        for fn in module.functions.values():
            for name, tensor in fn.tensors.items():
                if tensor.data is None:
                    continue  # activation, not a weight
                if tensor.dtype == DType.TERNARY and self.scheme == "ternary":
                    continue  # already ternary
                tensor.data, tensor.dtype = self._quantize(tensor.data)
                n_converted += 1

        log.info(f"  quantizer: converted {n_converted} tensors → {self.scheme}")

    def _quantize(self, arr: np.ndarray):
        arr = arr.astype(np.float32)
        if self.scheme == "fp16":
            return arr.astype(np.float16), DType.FP16
        if self.scheme == "int8":
            return _quantize_int8(arr), DType.INT8
        if self.scheme == "int4":
            return _quantize_int4(arr), DType.INT4
        if self.scheme == "ternary":
            return _quantize_ternary(arr), DType.TERNARY
        return arr, DType.FP32


# ------------------------------------------------------------------
# Quantization functions
# ------------------------------------------------------------------

def _quantize_ternary(arr: np.ndarray) -> np.ndarray:
    """
    BitNet b1.58 ternary quantization.
    scale = 1 / mean(|W|)
    W_q = clip(round(W * scale), -1, +1)
    """
    scale = np.mean(np.abs(arr))
    if scale < 1e-8:
        return np.zeros_like(arr, dtype=np.float32)
    w_scaled = arr / scale
    w_q = np.clip(np.round(w_scaled), -1.0, 1.0).astype(np.float32)
    return w_q


def _quantize_int8(arr: np.ndarray) -> np.ndarray:
    """
    Symmetric INT8: scale = max(|W|) / 127
    """
    max_val = np.max(np.abs(arr))
    if max_val < 1e-8:
        return np.zeros_like(arr, dtype=np.int8)
    scale = max_val / 127.0
    q = np.clip(np.round(arr / scale), -128, 127).astype(np.int8)
    return q.astype(np.float32)   # store as float for IR uniformity


def _quantize_int4(arr: np.ndarray) -> np.ndarray:
    """
    Grouped INT4: group_size=32, per-group symmetric quantization.
    """
    flat = arr.flatten().astype(np.float32)
    group_size = 32
    n_groups = (len(flat) + group_size - 1) // group_size
    out = np.zeros_like(flat)
    for g in range(n_groups):
        start = g * group_size
        end = min(start + group_size, len(flat))
        group = flat[start:end]
        max_val = np.max(np.abs(group))
        if max_val < 1e-8:
            continue
        scale = max_val / 7.0
        out[start:end] = np.clip(np.round(group / scale), -8, 7)
    return out.reshape(arr.shape)
