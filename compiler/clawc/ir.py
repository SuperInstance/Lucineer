"""
clawc.ir — Internal Representation (IR).

A simple graph IR inspired by MLIR/LLVM:
  - IRModule   : top-level container (functions, globals)
  - IRFunction : ordered list of IRNodes
  - IRNode     : single operation (like an MLIR Op)
  - IRTensor   : typed + shaped value (weight or activation)

The "mask-lock transform" converts IRNode weights from dynamic
(DRAM-loaded) to static (ROM-inlined constant) — flagged via
node.attrs["weight_frozen"] = True.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Dict, List, Optional, Tuple
import hashlib

import numpy as np


class DType(Enum):
    FP32   = auto()
    FP16   = auto()
    INT8   = auto()
    INT4   = auto()
    TERNARY = auto()   # {-1, 0, +1}


@dataclass
class IRTensor:
    name: str
    shape: Tuple[int, ...]
    dtype: DType
    data: Optional[np.ndarray] = None   # None = runtime activation

    @property
    def numel(self) -> int:
        n = 1
        for s in self.shape:
            n *= s
        return n

    def flatten(self):
        if self.data is None:
            raise ValueError(f"Tensor {self.name} has no static data")
        return self.data.flatten()

    def __repr__(self):
        return f"IRTensor({self.name}, {self.shape}, {self.dtype.name})"


@dataclass
class IRNode:
    """Single IR operation (matmul, conv, activation, etc.)."""
    op: str                                     # e.g. "matmul", "conv2d", "relu"
    inputs: List[str]                           # names of input IRTensors
    outputs: List[str]                          # names of output IRTensors
    attrs: Dict[str, Any] = field(default_factory=dict)
    # attrs of interest:
    #   weight_tensor   : IRTensor — the frozen weight (after mask-lock)
    #   weight_frozen   : bool     — True = ROM, False = DRAM
    #   fused_ops       : list     — ops fused into this node
    #   chip_id         : int      — partition assignment

    def is_weight_frozen(self) -> bool:
        return bool(self.attrs.get("weight_frozen", False))

    def __repr__(self):
        return f"IRNode({self.op}, inputs={self.inputs}, outputs={self.outputs})"


@dataclass
class IRFunction:
    name: str
    nodes: List[IRNode] = field(default_factory=list)
    tensors: Dict[str, IRTensor] = field(default_factory=dict)

    def add_node(self, node: IRNode):
        self.nodes.append(node)

    def add_tensor(self, tensor: IRTensor):
        self.tensors[tensor.name] = tensor

    def get_tensor(self, name: str) -> IRTensor:
        if name not in self.tensors:
            raise KeyError(f"Tensor '{name}' not in function '{self.name}'")
        return self.tensors[name]


class IRModule:
    """Top-level IR container — analogous to an MLIR Module."""

    def __init__(self, name: str = "module"):
        self.name = name
        self.functions: Dict[str, IRFunction] = {}
        self.metadata: Dict[str, Any] = {}

    # ------------------------------------------------------------------
    # Construction helpers
    # ------------------------------------------------------------------

    def add_function(self, fn: IRFunction):
        self.functions[fn.name] = fn

    def get_main(self) -> IRFunction:
        """Return the primary inference function."""
        for key in ("main", "forward", "infer", "model"):
            if key in self.functions:
                return self.functions[key]
        if self.functions:
            return next(iter(self.functions.values()))
        raise KeyError("No functions in IRModule")

    # ------------------------------------------------------------------
    # Statistics
    # ------------------------------------------------------------------

    @property
    def nodes(self) -> List[IRNode]:
        return [n for fn in self.functions.values() for n in fn.nodes]

    def op_count(self) -> int:
        return len(self.nodes)

    def param_count(self) -> int:
        total = 0
        for fn in self.functions.values():
            for t in fn.tensors.values():
                if t.data is not None:
                    total += t.numel
        return total

    def collect_weights(self) -> Dict[str, IRTensor]:
        """Return all tensors that have static weight data."""
        result = {}
        for fn in self.functions.values():
            for name, t in fn.tensors.items():
                if t.data is not None:
                    result[name] = t
        return result

    def stats(self) -> Dict[str, Any]:
        weights = self.collect_weights()
        frozen = sum(
            1 for fn in self.functions.values()
            for n in fn.nodes if n.is_weight_frozen()
        )
        return {
            "functions": len(self.functions),
            "nodes": self.op_count(),
            "params_M": round(self.param_count() / 1e6, 3),
            "weight_tensors": len(weights),
            "frozen_nodes": frozen,
        }

    def fingerprint(self) -> str:
        h = hashlib.sha256()
        for fn_name, fn in sorted(self.functions.items()):
            for node in fn.nodes:
                h.update(f"{fn_name}/{node.op}/{node.inputs}/{node.outputs}".encode())
        return h.hexdigest()[:12]

    def __repr__(self):
        s = self.stats()
        return (f"IRModule({self.name!r}, "
                f"fns={s['functions']}, nodes={s['nodes']}, "
                f"params={s['params_M']}M)")
