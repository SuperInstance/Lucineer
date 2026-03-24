"""
clawc.passes.memory_flatten — The Mask-Lock Transform.

This is the core compiler transformation that gives the chip its name.

Standard inference chips load weights from DRAM at runtime:
    W = DRAM[weight_addr]         # power-hungry, latency-bound

Mask-lock freezes weights into the metal layers of the chip:
    W = ROM_constant              # near-zero read energy, ~1 cycle

The transformation:
1. For each node with weight_tensor and dtype==TERNARY:
   - Encode weight matrix as a 2-bit-per-element ROM array
   - Generate the ROM initialization literal for RTL emission
   - Set node.attrs["weight_frozen"] = True
   - Set node.attrs["rom_init"] = the packed ROM data

2. Generate DRAM → ROM migration annotations:
   - attrs["dram_bytes_saved"] = original DRAM footprint
   - attrs["rom_bits"] = new ROM footprint

3. Non-ternary weights (FP32 residuals, scales) stay in a small DRAM
   or SRAM scratchpad.

After this pass, RTLGenerator uses the ROM init data directly to emit
parameterized ROM modules in SystemVerilog.
"""

from __future__ import annotations

import struct
from typing import List, Tuple

import numpy as np

from clawc.ir import IRModule, IRNode, DType
from clawc.utils.logger import get_logger

log = get_logger("passes.memory_flatten")

# Ternary encoding: -1 → 0b01, 0 → 0b00, +1 → 0b10 (2 bits each)
_T_NEG  = 0b01
_T_ZERO = 0b00
_T_POS  = 0b10


def _ternary_to_2bit(val: float) -> int:
    if val > 0.5:
        return _T_POS
    if val < -0.5:
        return _T_NEG
    return _T_ZERO


class MemoryFlattenPass:
    """The mask-lock transform: weights → ROM constants."""

    def run(self, module: IRModule):
        n_frozen = 0
        total_dram_bytes = 0
        total_rom_bits = 0

        for fn in module.functions.values():
            for node in fn.nodes:
                if node.attrs.get("weight_frozen"):
                    continue  # already done
                wt = node.attrs.get("weight_tensor")
                if wt is None or wt.data is None:
                    continue
                if wt.dtype != DType.TERNARY:
                    # Non-ternary: flag as DRAM (scratchpad)
                    node.attrs["weight_frozen"] = False
                    node.attrs["storage"] = "dram_scratchpad"
                    continue

                # --- The mask-lock transform ---
                flat = wt.data.flatten()
                rom_init, rom_bits = self._encode_rom(flat)

                dram_bytes_saved = flat.size * 4  # FP32 baseline
                node.attrs.update({
                    "weight_frozen":   True,
                    "storage":         "rom_metal",
                    "rom_init":        rom_init,       # List[int] — packed words
                    "rom_bits":        rom_bits,
                    "rom_depth":       len(rom_init),
                    "rom_width":       32,             # bits per word
                    "weight_rows":     wt.shape[0] if wt.data.ndim >= 1 else 1,
                    "weight_cols":     wt.shape[1] if wt.data.ndim >= 2 else flat.size,
                    "dram_bytes_saved": dram_bytes_saved,
                    "compression_ratio": round(dram_bytes_saved / max(1, rom_bits // 8), 2),
                })

                total_dram_bytes += dram_bytes_saved
                total_rom_bits += rom_bits
                n_frozen += 1

        if n_frozen > 0:
            ratio = total_dram_bytes / max(1, total_rom_bits // 8)
            log.info(
                f"  memory_flatten: {n_frozen} tensors frozen to ROM  "
                f"DRAM saved={total_dram_bytes/1024:.1f} KB  "
                f"ROM={total_rom_bits/1024:.1f} Kbits  "
                f"compression={ratio:.1f}x"
            )
        else:
            log.info("  memory_flatten: no ternary weights found — run quantizer first")

    # ------------------------------------------------------------------
    # ROM encoding
    # ------------------------------------------------------------------

    def _encode_rom(self, flat: np.ndarray) -> Tuple[List[int], int]:
        """
        Pack ternary values (2 bits each) into 32-bit words.
        Returns (word_list, total_bit_count).

        Memory layout:
          word[0] holds elements [0..15]   (2 bits each, LSB first)
          word[1] holds elements [16..31]
          ...
        """
        words = []
        n = len(flat)
        items_per_word = 16   # 16 × 2-bit = 32-bit word

        for word_idx in range(0, n, items_per_word):
            word = 0
            for bit_pos in range(items_per_word):
                elem_idx = word_idx + bit_pos
                if elem_idx >= n:
                    break
                enc = _ternary_to_2bit(float(flat[elem_idx]))
                word |= (enc << (bit_pos * 2))
            words.append(word)

        rom_bits = len(words) * 32
        return words, rom_bits

    def generate_sv_rom(self, node: IRNode, rom_name: str) -> str:
        """
        Generate a parameterized SystemVerilog ROM module for this node's weights.
        Called by RTLGenerator — returns SV source as a string.
        """
        depth = node.attrs["rom_depth"]
        width = node.attrs["rom_width"]
        rom_init = node.attrs["rom_init"]
        rows = node.attrs.get("weight_rows", 1)
        cols = node.attrs.get("weight_cols", depth)

        lines = [
            f"// Mask-lock ROM: {rom_name}",
            f"// Weight shape: [{rows} x {cols}]  ternary 2bpw",
            f"// Generated by clawc MemoryFlattenPass",
            f"module {rom_name} #(",
            f"    parameter DEPTH = {depth},",
            f"    parameter WIDTH = {width}",
            f") (",
            f"    input  logic [$clog2(DEPTH)-1:0] addr,",
            f"    output logic [WIDTH-1:0]          data",
            f");",
            f"    logic [WIDTH-1:0] mem [0:DEPTH-1];",
            f"    initial begin",
        ]
        for i, word in enumerate(rom_init):
            lines.append(f"        mem[{i:5d}] = {width}'h{word:08x};")
        lines += [
            f"    end",
            f"    assign data = mem[addr];",
            f"endmodule  // {rom_name}",
        ]
        return "\n".join(lines)
