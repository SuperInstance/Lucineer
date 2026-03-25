"""Target architecture loader."""

from .generic_ml import GenericMLArch
from .mask_lock_std import MaskLockStdArch
from .fpga_kv260 import FPGAKv260Arch


def get_target_arch(target_name):
    """Get target architecture by name."""
    targets = {
        "asic-generic": GenericMLArch(),
        "asic-sky130": MaskLockStdArch(pdk="sky130"),
        "asic-gf180": MaskLockStdArch(pdk="gf180mcu"),
        "fpga-kv260": FPGAKv260Arch(),
        "sim-verilator": GenericMLArch(),
    }
    
    if target_name not in targets:
        raise ValueError(f"Unknown target: {target_name}")
    
    return targets[target_name]
