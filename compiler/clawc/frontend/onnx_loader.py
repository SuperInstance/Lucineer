"""ONNX model loader for CLAWC."""

import json
from pathlib import Path


class ONNXLoader:
    """Load ONNX models and convert to CLAWC IR."""

    def load(self, model_path):
        """Load ONNX model and return computational graph."""
        try:
            import onnx
        except ImportError:
            raise ImportError(
                "ONNX support requires 'onnx' package. "
                "Install with: pip install onnx"
            )

        model_path = Path(model_path)
        onnx_model = onnx.load(str(model_path))
        onnx.checker.check_model(onnx_model)

        # Convert to our internal graph representation
        graph = self._onnx_to_graph(onnx_model.graph)
        return graph

    def _onnx_to_graph(self, onnx_graph):
        """Convert ONNX graph to internal IR."""
        nodes = []
        weights = {}

        # Extract initializers (weights/constants)
        for init in onnx_graph.initializer:
            weights[init.name] = self._extract_tensor(init)

        # Extract nodes
        for onnx_node in onnx_graph.node:
            node = {
                "name": onnx_node.name,
                "op": onnx_node.op_type.lower(),
                "inputs": list(onnx_node.input),
                "outputs": list(onnx_node.output),
                "attributes": {attr.name: self._extract_attr(attr) 
                              for attr in onnx_node.attribute},
            }

            # Attach weights if this is a MatMul/Conv with weights
            if node["op"] in ("matmul", "gemm") and len(node["inputs"]) > 1:
                weight_name = node["inputs"][1]
                if weight_name in weights:
                    node["weights"] = weights[weight_name]

            nodes.append(node)

        return {
            "nodes": nodes,
            "inputs": [inp.name for inp in onnx_graph.input],
            "outputs": [out.name for out in onnx_graph.output],
            "weights": weights,
            "format": "onnx",
        }

    def _extract_tensor(self, tensor_proto):
        """Extract tensor data from protobuf."""
        try:
            import numpy as np
            from onnx import numpy_helper

            return numpy_helper.to_array(tensor_proto).tolist()
        except Exception:
            return None

    def _extract_attr(self, attr):
        """Extract ONNX attribute."""
        if attr.HasField("f"):
            return float(attr.f)
        elif attr.HasField("i"):
            return int(attr.i)
        elif attr.HasField("s"):
            return attr.s.decode("utf-8")
        elif len(attr.floats):
            return list(attr.floats)
        elif len(attr.ints):
            return list(attr.ints)
        else:
            return None
