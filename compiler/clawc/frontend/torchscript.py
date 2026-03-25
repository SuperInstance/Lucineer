"""PyTorch JIT/TorchScript model loader for CLAWC."""

from pathlib import Path


class TorchScriptLoader:
    """Load PyTorch models (JIT compiled or TorchScript)."""

    def load(self, model_path):
        """Load PyTorch model and return computational graph."""
        try:
            import torch
        except ImportError:
            raise ImportError(
                "PyTorch support requires 'torch' package. "
                "Install from https://pytorch.org"
            )

        model_path = Path(model_path)
        
        # Load TorchScript model
        try:
            module = torch.jit.load(str(model_path))
        except Exception:
            # Try loading as regular PyTorch model
            import pickle
            with open(model_path, "rb") as f:
                module = pickle.load(f)

        # Convert to IR
        graph = self._extract_graph(module)
        return graph

    def _extract_graph(self, module):
        """Extract computation graph from PyTorch module."""
        try:
            import torch
        except ImportError:
            raise ImportError("PyTorch required")

        nodes = []
        weights = {}

        # Extract parameters
        for name, param in module.named_parameters():
            if param is not None:
                weights[name] = param.data.tolist() if hasattr(param, 'tolist') else str(param)

        # For JIT models, extract graph from module.graph
        if hasattr(module, "graph"):
            for node in module.graph.nodes():
                ir_node = {
                    "name": str(node),
                    "op": node.kind().split("::")[1] if "::" in node.kind() else node.kind(),
                    "inputs": [str(i) for i in node.inputs()],
                    "outputs": [str(o) for o in node.outputs()],
                }
                nodes.append(ir_node)
        else:
            # Fallback: just record the module structure
            nodes.append({
                "name": "pytorch_module",
                "op": module.__class__.__name__.lower(),
                "inputs": ["input"],
                "outputs": ["output"],
            })

        return {
            "nodes": nodes,
            "inputs": ["input"],
            "outputs": ["output"],
            "weights": weights,
            "format": "pytorch",
        }
