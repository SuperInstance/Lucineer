"""
clawc.frontend.onnx_loader — Ingest ONNX graphs into IRModule.

Supports ONNX opset 11–21. Maps ONNX ops to clawc IR ops:
    Gemm / MatMul  → matmul
    Conv           → conv2d
    Relu/Gelu/Silu → activation
    Add/Mul        → elementwise
    Gather         → embedding_lookup
    LayerNorm      → layer_norm
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict

import numpy as np

from clawc.ir import IRModule, IRFunction, IRNode, IRTensor, DType
from clawc.utils.logger import get_logger

log = get_logger("frontend.onnx")

# Map ONNX op_type → clawc IR op name
_OP_MAP: Dict[str, str] = {
    "Gemm": "matmul",
    "MatMul": "matmul",
    "Conv": "conv2d",
    "ConvTranspose": "conv2d_transpose",
    "Relu": "relu",
    "Gelu": "gelu",
    "Silu": "silu",
    "Sigmoid": "sigmoid",
    "Tanh": "tanh",
    "Add": "add",
    "Sub": "sub",
    "Mul": "mul",
    "Div": "div",
    "Reshape": "reshape",
    "Transpose": "transpose",
    "Softmax": "softmax",
    "LayerNormalization": "layer_norm",
    "BatchNormalization": "batch_norm",
    "Gather": "embedding_lookup",
    "Flatten": "flatten",
    "Squeeze": "squeeze",
    "Unsqueeze": "unsqueeze",
    "Concat": "concat",
    "Split": "split",
    "Slice": "slice",
    "Resize": "resize",
    "MaxPool": "maxpool",
    "AveragePool": "avgpool",
    "GlobalAveragePool": "global_avgpool",
    "Attention": "attention",       # ONNX-ML extension
}

_ONNX_DTYPE_MAP = {
    1:  DType.FP32,
    10: DType.FP16,
    3:  DType.INT8,
    # ONNX has no native ternary — we infer from initializer range
}


class OnnxLoader:
    def __init__(self, cfg):
        self.cfg = cfg

    def load(self) -> IRModule:
        try:
            import onnx
        except ImportError:
            raise ImportError("onnx package required: pip install onnx")

        path = self.cfg.input_path
        log.info(f"Loading ONNX model: {path}")
        model = onnx.load(str(path))
        onnx.checker.check_model(model)

        opset = model.opset_import[0].version if model.opset_import else 0
        log.info(f"  ONNX opset: {opset}  nodes: {len(model.graph.node)}")

        module = IRModule(name=path.stem)
        fn = IRFunction(name="main")

        # Load initializers (weights)
        initializers: Dict[str, np.ndarray] = {}
        for init in model.graph.initializer:
            arr = _to_numpy(init)
            initializers[init.name] = arr
            dtype = _infer_dtype(arr)
            tensor = IRTensor(
                name=init.name,
                shape=tuple(arr.shape),
                dtype=dtype,
                data=arr,
            )
            fn.add_tensor(tensor)

        # Load graph inputs (activations — no data)
        for inp in model.graph.input:
            if inp.name not in initializers:
                shape = _shape_from_type_proto(inp.type)
                dtype = _dtype_from_type_proto(inp.type)
                fn.add_tensor(IRTensor(name=inp.name, shape=shape, dtype=dtype))

        # Convert nodes
        for onnx_node in model.graph.node:
            op = _OP_MAP.get(onnx_node.op_type, onnx_node.op_type.lower())
            attrs = {a.name: _attr_value(a) for a in onnx_node.attribute}

            # Attach weight tensor reference for matmul/conv ops
            weight_tensor = None
            for inp_name in onnx_node.input:
                if inp_name in initializers:
                    weight_tensor = fn.tensors.get(inp_name)
                    break

            node_attrs = {**attrs}
            if weight_tensor is not None:
                node_attrs["weight_tensor"] = weight_tensor
                node_attrs["weight_frozen"] = False   # will be set True by MemoryFlattenPass

            ir_node = IRNode(
                op=op,
                inputs=list(onnx_node.input),
                outputs=list(onnx_node.output),
                attrs=node_attrs,
            )
            fn.add_node(ir_node)

        module.add_function(fn)
        log.info(f"  IR: {module}")
        return module


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _to_numpy(initializer) -> np.ndarray:
    import onnx.numpy_helper
    return onnx.numpy_helper.to_array(initializer)


def _infer_dtype(arr: np.ndarray) -> DType:
    if arr.dtype == np.float32:
        unique = np.unique(arr)
        if set(unique.tolist()).issubset({-1.0, 0.0, 1.0}):
            return DType.TERNARY
        return DType.FP32
    if arr.dtype == np.float16:
        return DType.FP16
    if arr.dtype in (np.int8, np.uint8):
        return DType.INT8
    return DType.FP32


def _shape_from_type_proto(type_proto) -> tuple:
    try:
        dims = type_proto.tensor_type.shape.dim
        return tuple(d.dim_value if d.dim_value > 0 else -1 for d in dims)
    except Exception:
        return (-1,)


def _dtype_from_type_proto(type_proto) -> DType:
    try:
        elem = type_proto.tensor_type.elem_type
        return _ONNX_DTYPE_MAP.get(elem, DType.FP32)
    except Exception:
        return DType.FP32


def _attr_value(attr):
    import onnx
    if attr.type == onnx.AttributeProto.INT:
        return attr.i
    if attr.type == onnx.AttributeProto.FLOAT:
        return attr.f
    if attr.type == onnx.AttributeProto.STRING:
        return attr.s.decode("utf-8")
    if attr.type == onnx.AttributeProto.INTS:
        return list(attr.ints)
    if attr.type == onnx.AttributeProto.FLOATS:
        return list(attr.floats)
    return None
