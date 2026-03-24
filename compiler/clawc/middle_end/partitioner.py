"""
clawc.middle_end.partitioner — Split model across N chips (cascade).

Strategy: balanced layer-wise partition.
  - Count total matmul/conv2d nodes
  - Assign consecutive groups to chip_id 0..N-1
  - Each chip gets: input buffer, computation nodes, output buffer

After partitioning each IRNode gets:
    node.attrs["chip_id"] = 0..N-1
    node.attrs["inter_chip_io"] = True  (on boundary nodes)
"""

from __future__ import annotations

import math
from typing import List

from clawc.ir import IRModule, IRNode
from clawc.utils.logger import get_logger

log = get_logger("middle_end.partitioner")

_COMPUTE_OPS = {"matmul", "conv2d", "conv1d", "conv2d_transpose", "attention"}


class PartitionerPass:
    def __init__(self, n_chips: int = 2):
        assert n_chips >= 1
        self.n_chips = n_chips

    def run(self, module: IRModule):
        if self.n_chips == 1:
            for fn in module.functions.values():
                for node in fn.nodes:
                    node.attrs["chip_id"] = 0
            return

        for fn in module.functions.values():
            compute_nodes = [n for n in fn.nodes if n.op in _COMPUTE_OPS]
            n_compute = len(compute_nodes)
            if n_compute == 0:
                continue

            nodes_per_chip = math.ceil(n_compute / self.n_chips)
            log.info(f"  partitioner: {n_compute} compute nodes → "
                     f"{self.n_chips} chips (~{nodes_per_chip}/chip)")

            # Assign chip IDs to compute nodes
            chip_map = {}
            for i, node in enumerate(compute_nodes):
                chip_id = min(i // nodes_per_chip, self.n_chips - 1)
                node.attrs["chip_id"] = chip_id
                chip_map[id(node)] = chip_id

            # Assign non-compute nodes to same chip as their producer
            assigned = {id(n): n.attrs["chip_id"] for n in compute_nodes}
            for node in fn.nodes:
                if "chip_id" not in node.attrs:
                    # Find nearest compute predecessor
                    chip_id = self._infer_chip(node, fn, assigned)
                    node.attrs["chip_id"] = chip_id

            # Mark inter-chip boundaries
            self._mark_boundaries(fn)

        per_chip = self._count_per_chip(module)
        log.info(f"  partition summary: {per_chip}")

    def _infer_chip(self, node: IRNode, fn, assigned: dict) -> int:
        # Find the chip of the first input that has an assignment
        for inp in node.inputs:
            for other in fn.nodes:
                if inp in other.outputs and id(other) in assigned:
                    return assigned[id(other)]
        return 0

    def _mark_boundaries(self, fn):
        output_to_chip = {}
        for node in fn.nodes:
            chip = node.attrs.get("chip_id", 0)
            for out in node.outputs:
                output_to_chip[out] = chip

        for node in fn.nodes:
            chip = node.attrs.get("chip_id", 0)
            for inp in node.inputs:
                src_chip = output_to_chip.get(inp)
                if src_chip is not None and src_chip != chip:
                    node.attrs["inter_chip_io"] = True
                    break

    def _count_per_chip(self, module: IRModule) -> dict:
        counts = {}
        for fn in module.functions.values():
            for node in fn.nodes:
                c = node.attrs.get("chip_id", 0)
                counts[c] = counts.get(c, 0) + 1
        return {f"chip{k}": v for k, v in sorted(counts.items())}
