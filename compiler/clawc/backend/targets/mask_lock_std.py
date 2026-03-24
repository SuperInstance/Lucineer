"""
clawc.backend.targets.mask_lock_std — Mask-Lock standard ASIC target.

Supports both sky130 and gf180mcuC open PDKs.

Architecture decisions:
  - 32×32 PE array (sky130) / 64×64 (gf180)
  - Ternary weights encoded in M3/M4 metal (mask-locked)
  - 256 KB SRAM scratchpad for activations + FP32 residuals
  - PCIe Gen2 x1 / UART / SPI host interface
  - 1.8V core, 3.3V I/O (gf180) / 1.8V (sky130)
  - Target: <3W active, <0.1mW standby

Power budget (sky130, 100 MHz):
    PE array:   ~1.2W  (dominant — ternary reduces vs FP)
    SRAM:       ~0.4W
    Clocking:   ~0.2W
    I/O:        ~0.1W
    Misc:       ~0.1W
    Total:      ~2.0W  (margin within 3W budget)
"""

TARGET_NAME = "mask_lock_std"
DISPLAY_NAME = "Mask-Lock Standard ASIC (sky130 / gf180)"

_SKY130 = {
    "array_rows":       32,
    "array_cols":       32,
    "act_width":        16,
    "acc_width":        32,
    "clk_period_ns":    10.0,     # 100 MHz
    "core_utilization": 0.45,
    "rom_layers":       ["M3", "M4"],
    "sram_kb":          256,
    "supports_gds":     True,
    "supports_bitstream": True,
    "quant_native":     ["ternary", "int4", "int8"],
    "target_power_mw":  2000,
    "process_node":     "sky130",
    "vdd_core":         1.8,
    "vdd_io":           3.3,
    "die_area_um2":     4_000_000,    # 4 mm² target
    "note": "SKY130 open PDK — suitable for efabless shuttle.",
}

_GF180 = {
    **_SKY130,
    "array_rows":       64,
    "array_cols":       64,
    "acc_width":        48,
    "clk_period_ns":    5.0,          # 200 MHz
    "process_node":     "gf180mcuC",
    "vdd_core":         1.8,
    "vdd_io":           3.3,
    "die_area_um2":     8_000_000,    # 8 mm²
    "target_power_mw":  3000,
    "note": "GF180 open PDK — higher density / speed.",
}

VARIANTS = {
    "asic-sky130": _SKY130,
    "asic-gf180":  _GF180,
}

CONFIG = _SKY130   # default


def get_config(target: str) -> dict:
    return VARIANTS.get(target, _SKY130)


def rom_metal_layers(target: str) -> list:
    """Return which metal layers are used for mask-locked ROM storage."""
    return get_config(target).get("rom_layers", ["M3", "M4"])
