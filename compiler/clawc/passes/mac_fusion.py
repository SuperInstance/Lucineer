"""
clawc.passes.mac_fusion — Fuse multiply-accumulate chains.

For ternary weights the multiply is trivial (+1 = pass, -1 = negate, 0 = skip).
This pass:

1. Converts matmul nodes with ternary weights from:
       out[i] = sum_j( W[i,j] * x[j] )
   to a signed-accumulate pattern:
       out[i] = sum_{j:W[i,j]=+1} x[j]  -  sum_{j:W[i,j]=-1} x[j]
   flagged via attrs["mac_style"] = "ternary_accumulate"

2. Detects back-to-back matmul chains (e.g. QKV projection in transformers)
   and schedules them as a single tiled MAC operation
   attrs["mac_style"] = "tiled_qkv"

3. Marks nodes eligible for systolic array row-stationary dataflow.
"""

from __future__ import annotations

import numpy as np
from typing import List

from clawc.ir import IRModule, IRFunction, IRNode, DType
from clawc.utils.logger import get_logger

log = get_logger("passes.mac_fusion")


class MACFusionPass:
    def run(self, module: IRModule):
        n_ternary = 0
        n_tiled = 0

        for fn in module.functions.values():
            n_ternary += self._apply_ternary_mac(fn)
            n_tiled += self._fuse_qkv_chains(fn)

        log.info(f"  mac_fusion: {n_ternary} ternary-accumulate, {n_tiled} tiled-qkv")

    # ------------------------------------------------------------------

    def _apply_ternary_mac(self, fn: IRFunction) -> int:
        n = 0
        for node in fn.nodes:
            if node.op not in ("matmul", "matmul_bias", "matmul_relu", "matmul_gelu"):
                continue
            wt = node.attrs.get("weight_tensor")
            if wt is None or wt.data is None or wt.dtype != DType.TERNARY:
                continue

            arr = wt.data
            if arr.ndim < 2:
                continue

            # Precompute positive / negative masks for RTL generation
            pos_mask = (arr > 0.5).astype(np.uint8)   # W[i,j] == +1
            neg_mask = (arr < -0.5).astype(np.uint8)  # W[i,j] == -1

            # Density statistics (useful for FPGA LUT budget)
            n_plus  = int(pos_mask.sum())
            n_minus = int(neg_mask.sum())
            n_zero  = int((arr == 0).sum())
            sparsity = n_zero / arr.size

            node.attrs.update({
                "mac_style": "ternary_accumulate",
                "pos_mask": pos_mask,       # shape [out, in]
                "neg_mask": neg_mask,
                "sparsity": round(sparsity, 4),
                "n_plus": n_plus,
                "n_minus": n_minus,
                "n_zero": n_zero,
            })
            n += 1
        return n

    def _fuse_qkv_chains(self, fn: IRFunction) -> int:
        """
        Detect Q, K, V projection matmuls sharing the same input and fuse them.
        This enables a single pass over the input activations for all three projections.
        """
        # Group nodes by their first input
        from collections import defaultdict
        input_groups = defaultdict(list)
        for node in fn.nodes:
            if node.op in ("matmul", "matmul_bias") and node.inputs:
                input_groups[node.inputs[0]].append(node)

        n_tiled = 0
        for inp, nodes in input_groups.items():
            if len(nodes) < 2:
                continue
            # All must be ternary matmuls at the same pipeline stage
            if not all(
                n.attrs.get("mac_style") == "ternary_accumulate" and
                n.attrs.get("pipeline_stage") == nodes[0].attrs.get("pipeline_stage")
                for n in nodes
            ):
                continue

            for node in nodes:
                node.attrs["mac_style"] = "tiled_qkv"
                node.attrs["tiled_group_size"] = len(nodes)
            n_tiled += len(nodes)

        return n_tiled
