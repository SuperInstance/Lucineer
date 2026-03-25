"""Partitioner: Split model across multiple mask-locked chips (cascade)."""


class Partitioner:
    """Partition computation graph across multiple chips."""

    def __init__(self, arch=None):
        """Initialize partitioner."""
        self.arch = arch

    def partition(self, graph):
        """Partition graph into chip clusters."""
        # For now, single-chip deployment
        # In future: use layer costs to split across cascade

        nodes = graph.get("nodes", [])
        
        # Estimate chip capacity
        mac_budget = 256 * 256  # 256×256 MAC array per MLS chip
        
        total_macs = 0
        for node in nodes:
            if node.get("op") == "matmul":
                # Rough estimate: weight count ~= MAC count
                weights = node.get("weights")
                if weights:
                    total_macs += self._count_macs(weights)
        
        if total_macs > mac_budget:
            # Would need to partition across multiple chips
            # Add cascade communication layers
            graph["partitions"] = self._partition_layers(nodes, mac_budget)
        else:
            graph["partitions"] = [{"nodes": nodes, "chip_id": 0}]
        
        return graph

    def _partition_layers(self, nodes, budget):
        """Partition layers to fit within budget per chip."""
        partitions = []
        current_partition = []
        current_macs = 0

        for node in nodes:
            node_macs = 0
            if node.get("op") == "matmul":
                node_macs = self._count_macs(node.get("weights", []))
            
            if current_macs + node_macs > budget and current_partition:
                # Start new partition
                partitions.append({
                    "nodes": current_partition,
                    "chip_id": len(partitions),
                })
                current_partition = []
                current_macs = 0
            
            current_partition.append(node)
            current_macs += node_macs

        if current_partition:
            partitions.append({
                "nodes": current_partition,
                "chip_id": len(partitions),
            })

        return partitions

    def _count_macs(self, weights):
        """Count estimated MACs from weight shape."""
        if not weights:
            return 0
        
        flat = self._flatten(weights)
        return len(flat)

    def _flatten(self, weights):
        """Flatten nested structure."""
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
