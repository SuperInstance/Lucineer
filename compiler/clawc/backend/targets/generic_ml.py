"""
clawc.backend.targets.generic_ml — Generic systolic array target.

Used for simulation (sim-verilator) and as a baseline reference.

Array configuration: 8×8 PEs, 16-bit activations, 32-bit accumulators.
No PDK-specific constraints.
"""

TARGET_NAME = "generic_ml"
DISPLAY_NAME = "Generic ML Systolic Array (Simulation)"

CONFIG = {
    "array_rows":       8,
    "array_cols":       8,
    "act_width":        16,
    "acc_width":        32,
    "clk_period_ns":    10.0,    # 100 MHz
    "rom_layers":       ["M1", "M2"],
    "sram_kb":          256,
    "supports_gds":     False,
    "supports_bitstream": True,
    "quant_native":     ["ternary", "int8"],
    "target_power_mw":  None,    # no constraint
    "note": "Simulation target — no PDK required. Use for Verilator/VCS RTL sim.",
}


def get_liberty() -> None:
    return None  # no std-cell library


def get_lef() -> None:
    return None
