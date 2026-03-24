"""
clawc.frontend.torchscript — Load PyTorch JIT / TorchScript models.

Supports:
  - torch.jit.save() exports (.pt / .pth)
  - torch.export() + ExportedProgram (PyTorch 2+)

Maps ATen ops → clawc IR ops.
"""

from __future__ import annotations

from typing import Dict, List

import numpy as np

from clawc.ir import IRModule, IRFunction, IRNode, IRTensor, DType
from clawc.utils.logger import get_logger

log = get_logger("frontend.torchscript")

_ATEN_OP_MAP: Dict[str, str] = {
    "aten::linear":           "matmul",
    "aten::mm":               "matmul",
    "aten::bmm":              "matmul",
    "aten::matmul":           "matmul",
    "aten::conv1d":           "conv1d",
    "aten::conv2d":           "conv2d",
    "aten::relu":             "relu",
    "aten::relu_":            "relu",
    "aten::gelu":             "gelu",
    "aten::silu":             "silu",
    "aten::sigmoid":          "sigmoid",
    "aten::tanh":             "tanh",
    "aten::add":              "add",
    "aten::add_":             "add",
    "aten::mul":              "mul",
    "aten::mul_":             "mul",
    "aten::softmax":          "softmax",
    "aten::layer_norm":       "layer_norm",
    "aten::batch_norm":       "batch_norm",
    "aten::embedding":        "embedding_lookup",
    "aten::reshape":          "reshape",
    "aten::view":             "reshape",
    "aten::transpose":        "transpose",
    "aten::permute":          "transpose",
    "aten::cat":              "concat",
    "aten::split":            "split",
    "aten::max_pool2d":       "maxpool",
    "aten::avg_pool2d":       "avgpool",
    "aten::adaptive_avg_pool2d": "global_avgpool",
    "aten::dropout":          "dropout",
    "aten::scaled_dot_product_attention": "attention",
}


class TorchScriptLoader:
    def __init__(self, cfg):
        self.cfg = cfg

    def load(self) -> IRModule:
        try:
            import torch
        except ImportError:
            raise ImportError("torch required: pip install torch")

        path = self.cfg.input_path
        log.info(f"Loading TorchScript model: {path}")

        try:
            # Try TorchScript first
            scripted = torch.jit.load(str(path), map_location="cpu")
            return self._from_torchscript(scripted, path.stem)
        except Exception as e:
            log.debug(f"TorchScript load failed ({e}), trying torch.load...")

        # Fallback: try torch.load (state_dict or full model)
        obj = torch.load(str(path), map_location="cpu", weights_only=False)
        if isinstance(obj, dict):
            return self._from_state_dict(obj, path.stem)
        elif hasattr(obj, "state_dict"):
            return self._from_module(obj, path.stem)
        else:
            raise ValueError(f"Cannot interpret torch file: {type(obj)}")

    # ------------------------------------------------------------------

    def _from_torchscript(self, model, name: str) -> IRModule:
        import torch
        module = IRModule(name=name)
        fn = IRFunction(name="main")

        # Extract parameters
        for pname, param in model.named_parameters():
            arr = param.detach().cpu().numpy()
            tensor = IRTensor(
                name=pname,
                shape=tuple(arr.shape),
                dtype=_torch_dtype(param.dtype),
                data=arr,
            )
            fn.add_tensor(tensor)

        # Walk graph nodes
        try:
            graph = model.graph
            torch._C._jit_pass_inline(graph)
            for node in graph.nodes():
                op = _ATEN_OP_MAP.get(node.kind(), node.kind().lower())
                inputs = [i.debugName() for i in node.inputs()]
                outputs = [o.debugName() for o in node.outputs()]
                fn.add_node(IRNode(op=op, inputs=inputs, outputs=outputs,
                                   attrs={"weight_frozen": False}))
        except Exception as e:
            log.warning(f"  Graph walk failed ({e}), building from params only")
            self._synthesize_nodes_from_params(fn)

        module.add_function(fn)
        log.info(f"  IR: {module}")
        return module

    def _from_state_dict(self, state_dict: dict, name: str) -> IRModule:
        log.info(f"  Building IR from state_dict ({len(state_dict)} tensors)")
        import torch
        module = IRModule(name=name)
        fn = IRFunction(name="main")

        for pname, param in state_dict.items():
            if not hasattr(param, "numpy"):
                continue
            arr = param.detach().cpu().numpy() if hasattr(param, "detach") else np.array(param)
            tensor = IRTensor(
                name=pname,
                shape=tuple(arr.shape),
                dtype=_infer_dtype_from_arr(arr),
                data=arr,
            )
            fn.add_tensor(tensor)

        self._synthesize_nodes_from_params(fn)
        module.add_function(fn)
        log.info(f"  IR: {module}")
        return module

    def _from_module(self, model, name: str) -> IRModule:
        log.info("  Building IR from nn.Module")
        return self._from_state_dict(
            {k: v for k, v in model.state_dict().items()},
            name,
        )

    def _synthesize_nodes_from_params(self, fn: IRFunction):
        """
        When we can't walk the graph, infer ops from parameter naming.
        Heuristic: weight + bias pairs → matmul node.
        """
        weights = {n: t for n, t in fn.tensors.items()
                   if "weight" in n.lower() and t.data is not None}
        for wname, wt in weights.items():
            bname = wname.replace("weight", "bias")
            op = "conv2d" if len(wt.shape) == 4 else "matmul"
            inputs = [wname]
            if bname in fn.tensors:
                inputs.append(bname)
            fn.add_node(IRNode(
                op=op,
                inputs=inputs,
                outputs=[wname.replace("weight", "out")],
                attrs={"weight_tensor": wt, "weight_frozen": False},
            ))


def _torch_dtype(dtype) -> DType:
    import torch
    return {
        torch.float32: DType.FP32,
        torch.float16: DType.FP16,
        torch.int8:    DType.INT8,
    }.get(dtype, DType.FP32)


def _infer_dtype_from_arr(arr: np.ndarray) -> DType:
    if arr.dtype == np.float16:
        return DType.FP16
    if arr.dtype in (np.int8, np.uint8):
        return DType.INT8
    if arr.dtype == np.float32:
        vals = np.unique(arr)
        if len(vals) <= 3 and set(vals.tolist()).issubset({-1.0, 0.0, 1.0}):
            return DType.TERNARY
    return DType.FP32
