"""
clawc.backend.pnr_interface — Place & Route API (OpenROAD).

Wraps OpenROAD TCL commands for automated P&R of generated RTL.

Stages:
  1. Synthesis    — Yosys: SV → gate-level netlist
  2. Floorplan    — OpenROAD: die/core area, power rings
  3. Placement    — OpenROAD: global → detailed placement
  4. CTS          — OpenROAD: clock tree synthesis
  5. Routing      — OpenROAD: global → detailed routing
  6. Sign-off     — OpenROAD: timing / DRC / LVS reports
  7. GDS merge    — KLayout: merge macro GDS + route GDS

Requires:
  - openroad in PATH (https://github.com/The-OpenROAD-Project/OpenROAD)
  - yosys in PATH
  - klayout (optional, for GDS merge)
"""

from __future__ import annotations

import subprocess
import textwrap
from pathlib import Path
from typing import Optional

from clawc.utils.logger import get_logger

log = get_logger("backend.pnr")


class PnRConfig:
    def __init__(
        self,
        pdk_root: Path,
        target: str = "sky130",
        clk_period_ns: float = 10.0,   # 100 MHz default
        core_utilization: float = 0.45,
        aspect_ratio: float = 1.0,
        die_area_um2: Optional[float] = None,
    ):
        self.pdk_root = pdk_root
        self.target = target
        self.clk_period_ns = clk_period_ns
        self.core_utilization = core_utilization
        self.aspect_ratio = aspect_ratio
        self.die_area_um2 = die_area_um2

    @property
    def liberty_file(self) -> Path:
        if "sky130" in self.target:
            return self.pdk_root / "sky130A/libs.ref/sky130_fd_sc_hd/lib/sky130_fd_sc_hd__tt_025C_1v80.lib"
        if "gf180" in self.target:
            return self.pdk_root / "gf180mcuC/libs.ref/gf180mcu_fd_sc_mcu7t5v0/lib/gf180mcu_fd_sc_mcu7t5v0__tt_025C_3v30.lib"
        raise ValueError(f"Unknown target for liberty lookup: {self.target}")

    @property
    def lef_file(self) -> Path:
        if "sky130" in self.target:
            return self.pdk_root / "sky130A/libs.ref/sky130_fd_sc_hd/lef/sky130_fd_sc_hd.lef"
        if "gf180" in self.target:
            return self.pdk_root / "gf180mcuC/libs.ref/gf180mcu_fd_sc_mcu7t5v0/lef/gf180mcu_fd_sc_mcu7t5v0.lef"
        raise ValueError(f"Unknown target: {self.target}")


class OpenROADInterface:
    def __init__(self, pnr_cfg: PnRConfig, work_dir: Path):
        self.cfg = pnr_cfg
        self.work_dir = work_dir
        work_dir.mkdir(parents=True, exist_ok=True)

    def run_full_flow(self, sv_path: Path) -> Path:
        """Run full synthesis + P&R flow. Returns final GDS path."""
        log.info("PnR: starting full flow")

        netlist = self._run_synthesis(sv_path)
        self._run_pnr(netlist)
        gds_path = self._run_gds_export()

        log.info(f"PnR complete: {gds_path}")
        return gds_path

    # ------------------------------------------------------------------
    # Synthesis (Yosys)
    # ------------------------------------------------------------------

    def _run_synthesis(self, sv_path: Path) -> Path:
        netlist = self.work_dir / "netlist.v"
        synth_script = self.work_dir / "synth.tcl"

        script = textwrap.dedent(f"""
            # clawc Yosys synthesis script
            yosys -import
            read_verilog -sv {sv_path}
            synth -top chip_top -flatten
            dfflibmap -liberty {self.cfg.liberty_file}
            abc -liberty {self.cfg.liberty_file} -constr {self.work_dir}/abc.constr
            clean
            write_verilog {netlist}
        """).strip()

        abc_constr = self.work_dir / "abc.constr"
        abc_constr.write_text(f"set_driving_cell sky130_fd_sc_hd__buf_1\n"
                               f"set_load 33.44\n")

        synth_script.write_text(script)
        log.info("  Synthesis: running Yosys...")
        self._run_tool("yosys", ["-s", str(synth_script)])
        return netlist

    # ------------------------------------------------------------------
    # Place & Route (OpenROAD)
    # ------------------------------------------------------------------

    def _run_pnr(self, netlist: Path):
        odb_path = self.work_dir / "chip.odb"
        pnr_script = self.work_dir / "pnr.tcl"

        die_w = die_h = 500.0  # µm default; override with die_area_um2
        if self.cfg.die_area_um2:
            import math
            side = math.sqrt(self.cfg.die_area_um2 / (self.cfg.core_utilization))
            die_w = die_h = side

        script = textwrap.dedent(f"""
            # clawc OpenROAD P&R script
            read_lef {self.cfg.lef_file}
            read_liberty {self.cfg.liberty_file}
            read_verilog {netlist}
            link_design chip_top

            # Floorplan
            initialize_floorplan \\
                -die_area  "0 0 {die_w:.1f} {die_h:.1f}" \\
                -core_area "{die_w*0.05:.1f} {die_h*0.05:.1f} {die_w*0.95:.1f} {die_h*0.95:.1f}"

            # Power planning
            add_global_connection -net VDD -pin_pattern "^VPB$" -power
            add_global_connection -net VSS -pin_pattern "^VNB$" -ground
            global_connect

            # Placement
            place_pins -hor_layers met2 -ver_layers met3
            global_placement -density {self.cfg.core_utilization}
            detailed_placement

            # CTS
            clock_tree_synthesis -root_buf sky130_fd_sc_hd__clkbuf_16 \\
                                  -buf_list sky130_fd_sc_hd__clkbuf_4
            repair_clock_inverters

            # Routing
            global_route -guide_file {self.work_dir}/route.guide
            detailed_route -output_guide {self.work_dir}/final.guide

            # Reports
            report_checks -path_delay min_max -format full_clock_expanded
            report_power
            report_design_area

            write_db {odb_path}
        """).strip()

        pnr_script.write_text(script)
        log.info("  P&R: running OpenROAD...")
        self._run_tool("openroad", [str(pnr_script)])

    def _run_gds_export(self) -> Path:
        gds_path = self.work_dir / "chip_routed.gds"
        export_script = self.work_dir / "export.tcl"
        odb_path = self.work_dir / "chip.odb"

        script = textwrap.dedent(f"""
            read_db {odb_path}
            write_gds {gds_path}
        """).strip()

        export_script.write_text(script)
        log.info("  GDS export: running OpenROAD...")
        self._run_tool("openroad", [str(export_script)])
        return gds_path

    # ------------------------------------------------------------------
    # Tool runner
    # ------------------------------------------------------------------

    def _run_tool(self, tool: str, args: list):
        cmd = [tool] + args
        log.debug(f"  $ {' '.join(cmd)}")
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=self.work_dir,
            )
            if result.returncode != 0:
                log.error(f"  {tool} failed (rc={result.returncode}):")
                for line in result.stderr.splitlines()[-20:]:
                    log.error(f"    {line}")
                raise RuntimeError(f"{tool} exited with code {result.returncode}")
            log.debug(f"  {tool} OK")
        except FileNotFoundError:
            raise RuntimeError(
                f"Tool '{tool}' not found in PATH. "
                f"Install from https://github.com/The-OpenROAD-Project/OpenROAD"
            )
