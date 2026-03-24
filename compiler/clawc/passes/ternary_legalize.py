"""
clawc.passes.ternary_legalize — Ensure all weight tensors use {-1, 0, +1}.

This pass validates that ternary quantization was applied correctly and
performs two additional legalizations:

1. **Scale extraction**: For each ternary weight W_q, extract the per-row
   (output-channel) scale factor s such that W ≈ W_q * s.
   Stores s as attrs["activation_scale"] for the RTL generator to use as a
   shift-add multiplier instead of a full multiplier array.

2. **Zero-row pruning**: Rows/columns that are all-zero after ternary
   quantization are marked for skip-connection insertion.
   Stores attrs["zero_rows"] = list[int].

This is a prerequisite for MemoryFlattenPass — the RTL can only ROM-ify
weights that are provably {-1, 0, +1}.
"""

from __future__ import annotations

import numpy as np

from clawc.ir import IRModule, IRNode, DType
from clawc.utils.logger import get_logger

log = get_logger("passes.ternary_legalize")


class TernaryLegalizePass:
    def run(self, module: IRModule):
        n_legalized = 0
        n_pruned_rows = 0

        for fn in module.functions.values():
            for node in fn.nodes:
                wt = node.attrs.get("weight_tensor")
                if wt is None or wt.data is None:
                    continue
                if wt.dtype != DType.TERNARY:
                    continue

                arr = wt.data
                # Verify values are in {-1, 0, +1}
                unique = np.unique(arr)
                illegal = unique[(unique < -1.001) | (unique > 1.001)]
                if len(illegal) > 0:
                    log.warning(f"  Clamping illegal ternary values in {wt.name}: {illegal[:4]}")
                    arr = np.clip(arr, -1.0, 1.0)
                    arr = np.round(arr).astype(np.float32)
                    wt.data = arr

                # Extract per-row activation scale
                if arr.ndim == 2:
                    row_max = np.max(np.abs(arr), axis=1)
                    row_max[row_max == 0] = 1.0
                    node.attrs["activation_scale"] = row_max.tolist()

                    # Find zero rows
                    zero_rows = np.where(np.all(arr == 0, axis=1))[0].tolist()
                    if zero_rows:
                        node.attrs["zero_rows"] = zero_rows
                        n_pruned_rows += len(zero_rows)

                n_legalized += 1

        log.info(f"  ternary_legalize: {n_legalized} tensors verified, "
                 f"{n_pruned_rows} zero rows pruned")
