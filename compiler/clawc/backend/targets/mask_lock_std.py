"""Mask-Lock Standard (MLS) architecture - our primary target."""


class MaskLockStdArch:
    """MLS 1.0 compliant architecture with mask-locked weights."""

    def __init__(self, pdk="sky130"):
        """Initialize MLS architecture."""
        self.name = f"Mask-Lock Standard v1.0 ({pdk})"
        self.pdk = pdk
        self.mac_rows = 256
        self.mac_cols = 256
        self.clock_mhz = 200
        self.vdd_core_mv = 1000  # 1.0V core
        self.vdd_io_mv = 1800    # 1.8V I/O
        self.process_nm = 130 if pdk == "sky130" else 180
        self.compute_power_mw = 200
        self.area_mm2 = 25  # More optimized
        
        # MLS-specific features
        self.weight_layers = ["M2", "M4"]  # Metal layers for weights
        self.power_domains = ["CORE", "IO", "CTRL"]
        self.interfaces = ["usb-c", "pcie-m2", "ucie"]
        self.quantization_support = ["ternary", "int4"]  # MLS-native
        self.cascade_capable = True
        self.privacy_escrow = True  # Hardware privacy support

    def __repr__(self):
        return f"{self.name} ({self.mac_rows}×{self.mac_cols} @ {self.clock_mhz}MHz)"
