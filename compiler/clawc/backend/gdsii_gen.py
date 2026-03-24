"""
clawc.backend.gdsii_gen — GDSII mask generation using gdstk.

Generates a simplified floor-plan GDSII for the chip:
  - Core region: tiled PE array
  - ROM stripes: mask-locked weight metal layers
  - Pad ring: power/ground, I/O pads
  - Fills: density fill to meet DRC requirements

For real tapeout this would drive OpenROAD P&R; here we emit a
schematic-level GDSII suitable for review and area estimation.

Requires: pip install gdstk
"""

from __future__ import annotations

import math
from pathlib import Path
from typing import List, Tuple

from clawc.ir import IRModule, IRNode
from clawc.utils.logger import get_logger

log = get_logger("backend.gdsii_gen")

# Layer map (sky130 / generic)
_LAYER = {
    "core_boundary": (0, 0),
    "pe_array":      (1, 0),
    "rom_metal":     (2, 0),
    "sram":          (3, 0),
    "io_pad":        (4, 0),
    "power_ring":    (5, 0),
    "label":         (6, 0),
}


class GDSIIGenerator:
    def __init__(self, cfg, ir: IRModule):
        self.cfg = cfg
        self.ir = ir

    def emit(self, out_path: Path) -> Path:
        try:
            import gdstk
        except ImportError:
            raise ImportError("gdstk required: pip install gdstk")

        lib = gdstk.Library(name="clawc_chip")
        top = lib.new_cell("chip_top")

        # Compute floorplan
        fp = self._compute_floorplan()
        log.info(f"  GDSII floorplan: {fp['die_w']:.1f} × {fp['die_h']:.1f} µm  "
                 f"(PE={fp['pe_w']:.1f}×{fp['pe_h']:.1f}  ROM={fp['rom_h']:.1f})")

        # Core boundary
        top.add(gdstk.rectangle(
            (0, 0), (fp["die_w"], fp["die_h"]),
            layer=_LAYER["core_boundary"][0],
            datatype=_LAYER["core_boundary"][1],
        ))

        # Power ring
        ring_w = 5.0
        top.add(gdstk.rectangle(
            (0, 0), (fp["die_w"], ring_w),
            layer=_LAYER["power_ring"][0], datatype=0))
        top.add(gdstk.rectangle(
            (0, fp["die_h"] - ring_w), (fp["die_w"], fp["die_h"]),
            layer=_LAYER["power_ring"][0], datatype=0))
        top.add(gdstk.rectangle(
            (0, 0), (ring_w, fp["die_h"]),
            layer=_LAYER["power_ring"][0], datatype=0))
        top.add(gdstk.rectangle(
            (fp["die_w"] - ring_w, 0), (fp["die_w"], fp["die_h"]),
            layer=_LAYER["power_ring"][0], datatype=0))

        # PE array tile grid
        self._add_pe_array(top, fp)

        # ROM stripes (mask-locked weights)
        self._add_rom_stripes(top, fp)

        # SRAM scratchpad
        sram_x = fp["margin"] + fp["pe_w"] + fp["margin"]
        sram_y = fp["margin"]
        top.add(gdstk.rectangle(
            (sram_x, sram_y),
            (sram_x + fp["sram_w"], sram_y + fp["sram_h"]),
            layer=_LAYER["sram"][0], datatype=0))

        # I/O pads
        self._add_io_pads(top, fp)

        # Labels
        top.add(gdstk.Label(
            f"clawc/{self.cfg.target}", (fp["die_w"] / 2, fp["die_h"] / 2),
            layer=_LAYER["label"][0]))

        lib.write_gds(str(out_path))
        return out_path

    # ------------------------------------------------------------------

    def _compute_floorplan(self) -> dict:
        fn = self.ir.get_main()
        n_params = self.ir.param_count()
        n_frozen = sum(1 for n in fn.nodes if n.attrs.get("weight_frozen"))

        # Area model: 0.05 µm² per ternary parameter (sky130 density)
        rom_area_um2 = n_params * 0.05
        pe_area_um2  = max(500.0, n_params / 1000 * 0.1)
        sram_area    = 200.0

        margin = 20.0
        pe_side  = math.sqrt(pe_area_um2)
        rom_side = math.sqrt(rom_area_um2)

        die_w = pe_side + rom_side + sram_area ** 0.5 + 4 * margin
        die_h = max(pe_side, rom_side) + 2 * margin + 40  # pad ring

        return {
            "die_w": die_w, "die_h": die_h,
            "pe_w": pe_side, "pe_h": pe_side,
            "rom_w": rom_side, "rom_h": rom_side,
            "sram_w": math.sqrt(sram_area), "sram_h": math.sqrt(sram_area),
            "margin": margin,
            "n_frozen": n_frozen,
        }

    def _add_pe_array(self, cell, fp: dict):
        import gdstk
        x0, y0 = fp["margin"], fp["margin"]
        # Draw tiled grid of PE cells
        tile_size = 5.0
        nx = max(1, int(fp["pe_w"] / tile_size))
        ny = max(1, int(fp["pe_h"] / tile_size))
        for ix in range(nx):
            for iy in range(ny):
                cell.add(gdstk.rectangle(
                    (x0 + ix * tile_size + 0.5, y0 + iy * tile_size + 0.5),
                    (x0 + (ix+1) * tile_size - 0.5, y0 + (iy+1) * tile_size - 0.5),
                    layer=_LAYER["pe_array"][0], datatype=0))

    def _add_rom_stripes(self, cell, fp: dict):
        import gdstk
        # ROM stripes represent the mask-locked metal layers
        x0 = fp["margin"] + fp["pe_w"] + fp["margin"]
        y0 = fp["margin"]
        stripe_h = 2.0
        stripe_gap = 0.5
        n_stripes = max(1, int(fp["rom_h"] / (stripe_h + stripe_gap)))
        for i in range(n_stripes):
            y = y0 + i * (stripe_h + stripe_gap)
            cell.add(gdstk.rectangle(
                (x0, y), (x0 + fp["rom_w"], y + stripe_h),
                layer=_LAYER["rom_metal"][0], datatype=0))

    def _add_io_pads(self, cell, fp: dict):
        import gdstk
        pad_w, pad_h = 60.0, 80.0
        pad_spacing = 20.0
        n_pads_bottom = max(1, int(fp["die_w"] / (pad_w + pad_spacing)))
        for i in range(n_pads_bottom):
            x = (fp["die_w"] - n_pads_bottom * (pad_w + pad_spacing)) / 2 \
                + i * (pad_w + pad_spacing)
            cell.add(gdstk.rectangle(
                (x, 0), (x + pad_w, pad_h),
                layer=_LAYER["io_pad"][0], datatype=0))
