"""GGUF (BitNet) model loader for CLAWC."""

from pathlib import Path


class GGUFLoader:
    """Load GGUF models (BitNet, Llama quantized) and convert to IR."""

    def load(self, model_path):
        """Load GGUF model and return computational graph."""
        try:
            import gguf
        except ImportError:
            raise ImportError(
                "GGUF support requires 'gguf' package. "
                "Install with: pip install gguf"
            )

        model_path = Path(model_path)
        reader = gguf.GGUFReader(str(model_path))

        # Extract metadata
        metadata = reader.metadata

        # Extract tensors (weights/parameters)
        tensors = {}
        for tensor in reader.tensors:
            tensors[tensor.name] = {
                "shape": tensor.shape,
                "dtype": str(tensor.tensor_type),
                "data": tensor.data,
            }

        # Reconstruct graph structure from metadata
        graph = self._reconstruct_graph(metadata, tensors)
        return graph

    def _reconstruct_graph(self, metadata, tensors):
        """Reconstruct computation graph from GGUF metadata."""
        # GGUF metadata typically contains model architecture info
        model_type = metadata.get("general.type", "unknown")
        layer_count = metadata.get("llama.block_count", 0)

        nodes = []

        # Create nodes for each layer
        for layer_idx in range(int(layer_count) if layer_count else 0):
            # Attention layer
            nodes.append({
                "name": f"attn_layer_{layer_idx}",
                "op": "attention",
                "inputs": [f"hidden_{layer_idx}"],
                "outputs": [f"attn_out_{layer_idx}"],
                "weights": self._get_layer_weights(tensors, layer_idx, "attn"),
            })

            # Feed-forward layer
            nodes.append({
                "name": f"ffn_layer_{layer_idx}",
                "op": "linear_relu",
                "inputs": [f"attn_out_{layer_idx}"],
                "outputs": [f"hidden_{layer_idx + 1}"],
                "weights": self._get_layer_weights(tensors, layer_idx, "ffn"),
            })

        return {
            "nodes": nodes,
            "inputs": ["input_ids"],
            "outputs": [f"hidden_{layer_count}"],
            "weights": tensors,
            "format": "gguf",
            "metadata": {
                "model_type": model_type,
                "layer_count": int(layer_count) if layer_count else 0,
            },
        }

    def _get_layer_weights(self, tensors, layer_idx, component):
        """Get weights for specific layer component."""
        weights = {}
        prefix = f"blk.{layer_idx}.{component}"

        for name, tensor in tensors.items():
            if name.startswith(prefix):
                weights[name] = tensor

        return weights if weights else None
