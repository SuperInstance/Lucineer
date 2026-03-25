"""Quantization pass: FP32 -> INT4/Ternary."""

import math


class Quantizer:
    """Quantize weights and activations to lower precision."""

    def __init__(self, quantize_format="ternary"):
        """Initialize quantizer."""
        self.format = quantize_format

    def quantize(self, graph):
        """Apply quantization to graph."""
        if self.format == "float32":
            return graph  # No quantization
        
        for node in graph.get("nodes", []):
            if "weights" in node and node["weights"]:
                if self.format == "ternary":
                    node["weights"] = self._quantize_ternary(node["weights"])
                elif self.format == "int4":
                    node["weights"] = self._quantize_int4(node["weights"])
                elif self.format == "int8":
                    node["weights"] = self._quantize_int8(node["weights"])

        return graph

    def _quantize_ternary(self, weights):
        """Quantize to ternary {-1, 0, +1}."""
        if isinstance(weights, (list, tuple)):
            result = []
            for w in weights:
                if isinstance(w, (list, tuple)):
                    result.append(self._quantize_ternary(w))
                else:
                    # Map to nearest ternary value
                    if abs(w) < 0.5:
                        result.append(0)
                    elif w > 0:
                        result.append(1)
                    else:
                        result.append(-1)
            return result
        else:
            if abs(weights) < 0.5:
                return 0
            elif weights > 0:
                return 1
            else:
                return -1

    def _quantize_int4(self, weights):
        """Quantize to INT4 [-8, +7]."""
        if not weights:
            return weights

        # Flatten to find min/max
        flat = self._flatten(weights)
        if not flat:
            return weights

        min_val = min(flat)
        max_val = max(flat)

        # Scale to INT4 range
        scale = (max_val - min_val) / 15 if max_val != min_val else 1
        
        def quantize_val(w):
            if scale > 0:
                q = round((w - min_val) / scale)
            else:
                q = 0
            return max(-8, min(7, q))  # Clamp to INT4

        return self._map_weights(weights, quantize_val)

    def _quantize_int8(self, weights):
        """Quantize to INT8 [-128, +127]."""
        if not weights:
            return weights

        flat = self._flatten(weights)
        if not flat:
            return weights

        min_val = min(flat)
        max_val = max(flat)
        scale = (max_val - min_val) / 255 if max_val != min_val else 1

        def quantize_val(w):
            if scale > 0:
                q = round((w - min_val) / scale)
            else:
                q = 0
            return max(-128, min(127, q))

        return self._map_weights(weights, quantize_val)

    def _flatten(self, weights):
        """Flatten nested list."""
        result = []
        if isinstance(weights, (list, tuple)):
            for w in weights:
                if isinstance(w, (list, tuple)):
                    result.extend(self._flatten(w))
                else:
                    result.append(w)
        else:
            result.append(weights)
        return result

    def _map_weights(self, weights, func):
        """Apply function to all weights recursively."""
        if isinstance(weights, (list, tuple)):
            return [self._map_weights(w, func) for w in weights]
        else:
            return func(weights)
