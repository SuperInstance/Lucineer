"""
clawc.compiler — Top-level Compiler driver.

Orchestrates: Frontend → IR → Middle-end passes → Backend.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Set, Dict, Any

from clawc.utils.logger import get_logger
from clawc.ir import IRModule

log = get_logger("compiler")


@dataclass
class CompilerConfig:
    input_path: Path
    output_dir: Path
    target: str = "sim-verilator"
    opt_level: int = 2
    quant_scheme: str = "ternary"   # fp32 | int8 | int4 | ternary
    cascade_chips: int = 1
    emit: Set[str] = field(default_factory=lambda: {"rtl", "bitstream", "bom"})
    pdk_root: Optional[Path] = None
    verbose: bool = False


@dataclass
class CompilationResult:
    artifacts: Dict[str, str] = field(default_factory=dict)
    bom: Dict[str, Any] = field(default_factory=dict)
    elapsed_ms: float = 0.0
    stats: Dict[str, Any] = field(default_factory=dict)


class Compiler:
    """
    Main compiler pipeline.

    Stages:
        1. Frontend   : load model → IRModule
        2. Middle-end : optimization passes
        3. Backend    : generate RTL / GDS / bitstream / BOM
    """

    def __init__(self, cfg: CompilerConfig):
        self.cfg = cfg
        self._ir: Optional[IRModule] = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def compile(self) -> CompilationResult:
        t0 = time.perf_counter()
        result = CompilationResult()

        log.info("=== Stage 1: Frontend ===")
        self._ir = self._run_frontend()
        log.info(f"  IR nodes: {len(self._ir.nodes)}  ops: {self._ir.op_count()}")

        log.info("=== Stage 2: Middle-end passes ===")
        self._run_middle_end()

        log.info("=== Stage 3: Backend ===")
        self._run_backend(result)

        result.elapsed_ms = (time.perf_counter() - t0) * 1000
        return result

    def compile_from_ir(self, ir: IRModule) -> CompilationResult:
        """Compile starting from a pre-built IRModule (Python API)."""
        self._ir = ir
        t0 = time.perf_counter()
        result = CompilationResult()
        self._run_middle_end()
        self._run_backend(result)
        result.elapsed_ms = (time.perf_counter() - t0) * 1000
        return result

    # ------------------------------------------------------------------
    # Frontend dispatch
    # ------------------------------------------------------------------

    def _run_frontend(self) -> IRModule:
        suffix = self.cfg.input_path.suffix.lower()
        if suffix == ".onnx":
            from clawc.frontend.onnx_loader import OnnxLoader
            return OnnxLoader(self.cfg).load()
        elif suffix in (".gguf", ".bin"):
            from clawc.frontend.gguf_loader import GgufLoader
            return GgufLoader(self.cfg).load()
        elif suffix in (".pt", ".pth"):
            from clawc.frontend.torchscript import TorchScriptLoader
            return TorchScriptLoader(self.cfg).load()
        else:
            raise ValueError(f"Unsupported input format: {suffix}")

    # ------------------------------------------------------------------
    # Middle-end passes
    # ------------------------------------------------------------------

    def _run_middle_end(self):
        from clawc.middle_end.quantizer import QuantizationPass
        from clawc.middle_end.partitioner import PartitionerPass
        from clawc.middle_end.scheduler import SchedulerPass
        from clawc.passes.ternary_legalize import TernaryLegalizePass
        from clawc.passes.mac_fusion import MACFusionPass
        from clawc.passes.memory_flatten import MemoryFlattenPass

        pipeline = []

        # Always run quantization
        pipeline.append(QuantizationPass(self.cfg.quant_scheme))

        # Opt-level 1+: fuse MACs
        if self.cfg.opt_level >= 1:
            pipeline.append(MACFusionPass())

        # Opt-level 2+: ternary legalization + mask-lock memory transform
        if self.cfg.opt_level >= 2:
            pipeline.append(TernaryLegalizePass())
            pipeline.append(MemoryFlattenPass())   # key mask-lock transform

        # Multi-chip partitioning
        if self.cfg.cascade_chips > 1:
            pipeline.append(PartitionerPass(n_chips=self.cfg.cascade_chips))

        # Scheduling / layer fusion (opt 1+)
        if self.cfg.opt_level >= 1:
            pipeline.append(SchedulerPass())

        for p in pipeline:
            log.info(f"  running pass: {p.__class__.__name__}")
            p.run(self._ir)
            if self.cfg.verbose:
                log.debug(f"    {self._ir.stats()}")

    # ------------------------------------------------------------------
    # Backend dispatch
    # ------------------------------------------------------------------

    def _run_backend(self, result: CompilationResult):
        cfg = self.cfg

        if "rtl" in cfg.emit:
            from clawc.backend.rtl_gen import RTLGenerator
            gen = RTLGenerator(cfg, self._ir)
            sv_path = gen.emit(cfg.output_dir / "chip_top.sv")
            result.artifacts["rtl"] = str(sv_path)
            log.info(f"  RTL written: {sv_path}")

        if "gds" in cfg.emit:
            if not cfg.pdk_root:
                log.warning("  GDS emission skipped: --pdk-root not set")
            else:
                from clawc.backend.gdsii_gen import GDSIIGenerator
                gen = GDSIIGenerator(cfg, self._ir)
                gds_path = gen.emit(cfg.output_dir / "chip.gds")
                result.artifacts["gds"] = str(gds_path)
                log.info(f"  GDS written: {gds_path}")

        if "bitstream" in cfg.emit:
            bs_path = self._emit_bitstream()
            result.artifacts["bitstream"] = str(bs_path)
            log.info(f"  Bitstream written: {bs_path}")

        if "bom" in cfg.emit:
            bom = self._emit_bom()
            bom_path = cfg.output_dir / "bom.json"
            import json
            bom_path.write_text(json.dumps(bom, indent=2))
            result.artifacts["bom"] = str(bom_path)
            result.bom = bom
            log.info(f"  BOM written: {bom_path}")

    def _emit_bitstream(self) -> Path:
        """Serialize quantized weight tensor to a packed binary bitstream."""
        import struct
        path = self.cfg.output_dir / "programming.bin"
        weights = self._ir.collect_weights()
        with open(path, "wb") as f:
            # Header: magic + version + weight count
            f.write(b"CLWC")
            f.write(struct.pack("<HH", 1, 0))          # version 1.0
            f.write(struct.pack("<I", len(weights)))
            for name, tensor in weights.items():
                name_enc = name.encode("utf-8")
                f.write(struct.pack("<H", len(name_enc)))
                f.write(name_enc)
                flat = tensor.flatten()
                f.write(struct.pack("<I", len(flat)))
                # Ternary: pack as 2-bit values into bytes
                for i in range(0, len(flat), 4):
                    byte_val = 0
                    for j in range(4):
                        if i + j < len(flat):
                            v = int(flat[i + j]) & 0x3
                            byte_val |= (v << (j * 2))
                    f.write(struct.pack("B", byte_val))
        return path

    def _emit_bom(self) -> dict:
        """Generate Bill of Materials cost estimate."""
        ir = self._ir
        n_params = ir.param_count()
        n_chips = self.cfg.cascade_chips

        # Rough cost model (sky130 node)
        die_mm2 = max(1.0, n_params / 1e6 * 0.05)   # ~0.05 mm² per M ternary params
        wafer_cost_per_mm2 = 0.15                    # sky130 shuttle estimate
        die_cost = die_mm2 * wafer_cost_per_mm2
        package_cost = 1.20 * n_chips
        bom = {
            "target": self.cfg.target,
            "n_chips": n_chips,
            "n_params_M": round(n_params / 1e6, 2),
            "die_area_mm2": round(die_mm2, 3),
            "die_cost_usd": round(die_cost * n_chips, 2),
            "package_cost_usd": round(package_cost, 2),
            "total_usd": round((die_cost + package_cost) * n_chips, 2),
            "note": "Estimated shuttle pricing; production pricing differs.",
        }
        return bom
