"""
Hardware Model - Self-representation of physical chip constraints.

Enables "hardware-aware programming": the agent optimizes code based on:
- Transistor arrangement
- Thermal constraints
- Timing paths
- Power domains
- Cache/memory hierarchy
"""


class HardwareModel:
    """Self-model of the mask-locked chip this agent runs on."""

    def __init__(self, chip_id="CLAW-001"):
        """Initialize hardware model."""
        self.chip_id = chip_id

        # MAC Array
        self.mac_rows = 256
        self.mac_cols = 256
        self.mac_pipeline_depth = 5  # cycles

        # Memory
        self.register_count = 256
        self.sram_kb = 64
        self.cache_line_bytes = 64

        # Power/Thermal
        self.power_budget_mw = 255
        self.power_mw = 200  # Current
        self.temp_c = 25  # Current
        self.temp_max_c = 100  # Thermal limit

        # Timing
        self.clock_mhz = 200
        self.clock_period_ns = 5
        self.timing_slack_ns = 0.5

        # Power Domains
        self.power_domains = {
            "CORE": {"voltage_v": 1.0, "power_mw": 200},
            "IO": {"voltage_v": 1.8, "power_mw": 30},
            "CTRL": {"voltage_v": 1.0, "power_mw": 20},
        }

    def can_fit_inference(self, mac_count=None, memory_kb=None):
        """Check if inference fits in local hardware."""
        mac_count = mac_count or 256 * 256
        memory_kb = memory_kb or 64

        mac_capacity = self.mac_rows * self.mac_cols
        mem_capacity = self.sram_kb

        return mac_count <= mac_capacity and memory_kb <= mem_capacity

    def estimate_power(self, layer_type, layer_size):
        """Estimate power consumption for a layer."""
        if layer_type == "matmul":
            # Ternary MAC: ~0.77 pJ/operation at 200MHz
            ops = layer_size[0] * layer_size[1] * layer_size[2]
            return ops * 0.77e-12 * 1e3  # Return mW

        elif layer_type == "elementwise":
            return 10  # mW (rough)

        elif layer_type == "memory":
            return 20  # mW (I/O + SRAM access)

        return 50  # Default

    def estimate_latency(self, ops):
        """Estimate latency in nanoseconds."""
        # MAC pipeline: 5 cycles
        cycles = (ops / (self.mac_cols)) * self.mac_pipeline_depth
        return cycles * self.clock_period_ns

    def can_add_layer(self, layer_power_mw, layer_latency_ns):
        """Check if adding a layer exceeds power/thermal budget."""
        new_power = self.power_mw + layer_power_mw

        if new_power > self.power_budget_mw:
            return False, f"Power budget exceeded: {new_power}mW > {self.power_budget_mw}mW"

        # Estimate temperature rise (very rough)
        power_density = new_power / 25  # mW/mm²
        estimated_temp = self.temp_c + (power_density / 10)  # Simplified

        if estimated_temp > self.temp_max_c:
            return False, f"Thermal limit: {estimated_temp:.1f}°C > {self.temp_max_c}°C"

        return True, "OK"

    def optimize_for_hardware(self, graph):
        """
        Optimize computation graph for this specific hardware.

        Returns optimized graph with tiling, fusion, scheduling decisions.
        """
        optimized_graph = {
            "original_nodes": len(graph.get("nodes", [])),
            "optimizations": [],
        }

        # Strategy 1: Layer fusion (reduce memory traffic)
        if len(graph.get("nodes", [])) > 1:
            optimized_graph["optimizations"].append("layer_fusion")

        # Strategy 2: Tile large MatMuls to 256×256
        for node in graph.get("nodes", []):
            if node.get("op") == "matmul":
                weights = node.get("weights", [])
                if self._needs_tiling(weights):
                    optimized_graph["optimizations"].append("matmul_tiling")

        # Strategy 3: Power gating (disable unused domains)
        if self.power_mw > self.power_budget_mw * 0.8:
            optimized_graph["optimizations"].append("power_gating")

        return optimized_graph

    def _needs_tiling(self, weights):
        """Check if a weight matrix needs tiling."""
        if not weights:
            return False
        flat = self._flatten(weights)
        import math
        size = int(math.sqrt(len(flat)))
        return size > 256

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

    def __repr__(self):
        return (
            f"HardwareModel({self.mac_rows}×{self.mac_cols} MAC, "
            f"{self.clock_mhz}MHz, {self.power_mw}mW, {self.temp_c}°C)"
        )
