"""Generic ML accelerator architecture (baseline systolic array)."""


class GenericMLArch:
    """Generic systolic array-based ML accelerator."""

    def __init__(self):
        """Initialize generic architecture."""
        self.name = "Generic ML Systolic Array"
        self.mac_rows = 256
        self.mac_cols = 256
        self.clock_mhz = 200
        self.vdd_mv = 1000  # 1.0V
        self.process_nm = 7
        self.compute_power_mw = 200
        self.area_mm2 = 50
        self.interfaces = ["memory-mapped"]  # Just memory
        self.quantization_support = ["float32", "int8", "int4", "ternary"]

    def __repr__(self):
        return f"{self.name} ({self.mac_rows}×{self.mac_cols} @ {self.clock_mhz}MHz)"
