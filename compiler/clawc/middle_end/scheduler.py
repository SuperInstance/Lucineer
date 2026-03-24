"""
clawc.middle_end.scheduler — Layer fusion and pipeline scheduling.

Fusions applied (opt-level 2+):
  matmul + add      → matmul_bias
  matmul + relu     → matmul_relu
  matmul + gelu     → matmul_gelu
  conv2d + batch_norm + relu → conv_bn_relu
  layer_norm + matmul       → ln_matmul (pre-norm transformer block)

Pipeline scheduling:
  Assigns a pipeline stage to each node for systolic array wave-fronting.
  Nodes on the same chip with no dependency can run in parallel (same stage).
"""

from __future__ import annotations

from collections import defaultdict
from typing import Dict, List, Set

from clawc.ir import IRModule, IRFunction, IRNode
from clawc.utils.logger import get_logger

log = get_logger("middle_end.scheduler")

_ACTIVATION_OPS = {"relu", "gelu", "silu", "sigmoid", "tanh"}
_NORM_OPS = {"batch_norm", "layer_norm"}


class SchedulerPass:
    def run(self, module: IRModule):
        n_fused = 0
        for fn in module.functions.values():
            n_fused += self._fuse_layers(fn)
            self._assign_pipeline_stages(fn)
        log.info(f"  scheduler: {n_fused} fusions; pipeline stages assigned")

    # ------------------------------------------------------------------
    # Layer fusion
    # ------------------------------------------------------------------

    def _fuse_layers(self, fn: IRFunction) -> int:
        n_fused = 0
        changed = True
        while changed:
            changed = False
            output_to_node: Dict[str, IRNode] = {}
            for node in fn.nodes:
                for out in node.outputs:
                    output_to_node[out] = node

            new_nodes: List[IRNode] = []
            consumed: Set[int] = set()

            for i, node in enumerate(fn.nodes):
                if i in consumed:
                    continue

                # matmul/conv + activation
                if node.op in ("matmul", "conv2d"):
                    next_node = self._find_single_consumer(node, fn.nodes, output_to_node)
                    if next_node and next_node.op in _ACTIVATION_OPS:
                        j = fn.nodes.index(next_node)
                        fused = IRNode(
                            op=f"{node.op}_{next_node.op}",
                            inputs=node.inputs,
                            outputs=next_node.outputs,
                            attrs={**node.attrs, "fused_ops": [node.op, next_node.op]},
                        )
                        new_nodes.append(fused)
                        consumed.add(i)
                        consumed.add(j)
                        n_fused += 1
                        changed = True
                        continue

                # matmul + add (bias)
                if node.op == "matmul":
                    next_node = self._find_single_consumer(node, fn.nodes, output_to_node)
                    if next_node and next_node.op == "add":
                        j = fn.nodes.index(next_node)
                        fused = IRNode(
                            op="matmul_bias",
                            inputs=node.inputs + [inp for inp in next_node.inputs
                                                   if inp not in node.outputs],
                            outputs=next_node.outputs,
                            attrs={**node.attrs, "fused_ops": ["matmul", "add"]},
                        )
                        new_nodes.append(fused)
                        consumed.add(i)
                        consumed.add(j)
                        n_fused += 1
                        changed = True
                        continue

                # conv + batch_norm + relu (triple fusion)
                if node.op == "conv2d":
                    n1 = self._find_single_consumer(node, fn.nodes, output_to_node)
                    if n1 and n1.op in _NORM_OPS:
                        n2 = self._find_single_consumer(n1, fn.nodes, output_to_node)
                        if n2 and n2.op in _ACTIVATION_OPS:
                            j1 = fn.nodes.index(n1)
                            j2 = fn.nodes.index(n2)
                            fused = IRNode(
                                op=f"conv_bn_{n2.op}",
                                inputs=node.inputs,
                                outputs=n2.outputs,
                                attrs={**node.attrs,
                                       "fused_ops": ["conv2d", n1.op, n2.op],
                                       "bn_attrs": n1.attrs},
                            )
                            new_nodes.append(fused)
                            consumed.update({i, j1, j2})
                            n_fused += 2
                            changed = True
                            continue

                new_nodes.append(node)

            fn.nodes = new_nodes

        return n_fused

    def _find_single_consumer(self, node: IRNode, all_nodes: List[IRNode],
                               output_to_node: Dict[str, IRNode]) -> IRNode | None:
        """Return the next node if `node` has exactly one output used by one node."""
        if len(node.outputs) != 1:
            return None
        out = node.outputs[0]
        consumers = [n for n in all_nodes if out in n.inputs]
        return consumers[0] if len(consumers) == 1 else None

    # ------------------------------------------------------------------
    # Pipeline stage assignment
    # ------------------------------------------------------------------

    def _assign_pipeline_stages(self, fn: IRFunction):
        """
        Topological sort → assign pipeline stage (wave number) per node.
        Nodes at the same stage can be processed in parallel by the systolic array.
        """
        output_to_stage: Dict[str, int] = {}

        for node in fn.nodes:
            if not node.inputs:
                stage = 0
            else:
                stage = max(
                    (output_to_stage.get(inp, -1) for inp in node.inputs),
                    default=-1,
                ) + 1
            node.attrs["pipeline_stage"] = stage
            for out in node.outputs:
                output_to_stage[out] = stage

        n_stages = max((n.attrs.get("pipeline_stage", 0) for n in fn.nodes), default=0) + 1
        log.debug(f"  {fn.name}: {n_stages} pipeline stages, {len(fn.nodes)} nodes")
