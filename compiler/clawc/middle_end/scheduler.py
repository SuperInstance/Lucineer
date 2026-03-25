"""Scheduler: Layer fusion, pipeline scheduling, MAC array tiling."""


class Scheduler:
    """Schedule operations on MAC array with pipelining and fusion."""

    def __init__(self, arch=None):
        """Initialize scheduler."""
        self.arch = arch

    def schedule(self, graph):
        """Apply scheduling optimizations."""
        nodes = graph.get("nodes", [])
        
        # Optimize: fuse compatible layers
        nodes = self._fuse_layers(nodes)
        
        # Optimize: tile MatMul operations
        nodes = self._tile_matmuls(nodes)
        
        graph["nodes"] = nodes
        graph["schedule_info"] = {
            "pipeline_depth": 5,  # 5-stage MAC pipeline
            "fusion_groups": len([n for n in nodes if n.get("fused")]),
        }
        
        return graph

    def _fuse_layers(self, nodes):
        """Fuse operations: e.g., Conv+ReLU -> ConvReLU."""
        fused = []
        i = 0
        
        while i < len(nodes):
            node = nodes[i]
            
            # Check if next node is fusible with current
            if (i + 1 < len(nodes) and 
                self._can_fuse(node, nodes[i + 1])):
                
                fused_node = {
                    "name": f"fused_{node['name']}_{nodes[i+1]['name']}",
                    "op": f"fused_{node['op']}_{nodes[i+1]['op']}",
                    "inputs": node["inputs"],
                    "outputs": nodes[i + 1]["outputs"],
                    "fused": True,
                    "original_ops": [node["op"], nodes[i + 1]["op"]],
                }
                
                # Merge weights
                if "weights" in node:
                    fused_node["weights"] = node["weights"]
                
                fused.append(fused_node)
                i += 2  # Skip both nodes
            else:
                fused.append(node)
                i += 1
        
        return fused

    def _can_fuse(self, node1, node2):
        """Check if two nodes can be fused."""
        # Can fuse if output of node1 is input to node2
        if node1["outputs"] and node2["inputs"]:
            return node1["outputs"][0] in node2["inputs"]
        
        # Can fuse common patterns: matmul+relu, conv+relu, etc.
        fusible = {
            ("matmul", "relu"): True,
            ("matmul", "gelu"): True,
            ("conv", "relu"): True,
            ("dense", "relu"): True,
        }
        
        return fusible.get((node1.get("op"), node2.get("op")), False)

    def _tile_matmuls(self, nodes):
        """Tile large MatMul operations for MAC array."""
        tiled = []
        
        for node in nodes:
            if node.get("op") != "matmul":
                tiled.append(node)
                continue
            
            # Check if weights fit in 256×256 MAC array
            weights = node.get("weights", [])
            if self._fits_in_mac_array(weights):
                tiled.append(node)
            else:
                # Tile it
                tiles = self._create_tiles(node)
                tiled.extend(tiles)
        
        return tiled

    def _fits_in_mac_array(self, weights):
        """Check if weights fit in 256×256 MAC array."""
        if not weights:
            return True
        
        flat = self._flatten(weights)
        # Rough estimate: assume square matrix
        import math
        size = int(math.sqrt(len(flat)))
        return size <= 256

    def _create_tiles(self, node):
        """Create tiled versions of a large MatMul."""
        # For now, just return the original
        # Real implementation would split into 256×256 chunks
        return [node]

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
