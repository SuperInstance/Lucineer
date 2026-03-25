"""Main CLAWC compiler orchestrator."""

import json
from pathlib import Path

from .frontend.onnx_loader import ONNXLoader
from .frontend.gguf_loader import GGUFLoader
from .middle_end.quantizer import Quantizer
from .middle_end.partitioner import Partitioner
from .middle_end.scheduler import Scheduler
from .backend.rtl_gen import RTLGenerator
from .backend.gdsii_gen import GDSIIGenerator
from .backend.targets import get_target_arch
from .utils.logger import setup_logger

logger = setup_logger(__name__)


class Compiler:
    """Main CLAWC compiler."""

    def __init__(self, target="sim-verilator", quantize="ternary", 
                 output_dir="output/", verbose=False):
        """Initialize compiler."""
        self.target = target
        self.quantize = quantize
        self.output_dir = Path(output_dir)
        self.verbose = verbose
        
        # Load target architecture
        self.arch = get_target_arch(target)
        logger.info(f"Loaded target architecture: {self.arch.name}")
        
        # Create pipeline stages
        self.quantizer = Quantizer(quantize_format=quantize)
        self.partitioner = Partitioner(arch=self.arch)
        self.scheduler = Scheduler(arch=self.arch)
        self.rtl_gen = RTLGenerator(arch=self.arch)
        self.gdsii_gen = GDSIIGenerator(pdk=self._get_pdk())

    def compile(self, model_path):
        """Compile a model to target."""
        model_path = Path(model_path)
        logger.info(f"Stage 1: Loading model from {model_path}")
        
        # Frontend: Load model
        graph = self._load_model(model_path)
        logger.info(f"  Loaded graph with {len(graph['nodes'])} nodes")
        
        # Middle-end: Optimize
        logger.info("Stage 2: Optimization passes")
        graph = self.quantizer.quantize(graph)
        graph = self.partitioner.partition(graph)
        graph = self.scheduler.schedule(graph)
        
        # Backend: Generate output
        logger.info("Stage 3: Code generation")
        outputs = {}
        
        # Always generate RTL (Verilog/SystemVerilog)
        rtl_code = self.rtl_gen.generate(graph)
        rtl_path = self.output_dir / "chip_top.sv"
        rtl_path.write_text(rtl_code)
        outputs["chip_top.sv"] = rtl_path
        logger.info(f"  Generated RTL: {rtl_path}")
        
        # Generate GDSII if PDK available
        if self.target.startswith("asic-"):
            try:
                gds_code = self.gdsii_gen.generate(graph, rtl_code)
                gds_path = self.output_dir / "chip.gds"
                with open(gds_path, "wb") as f:
                    f.write(gds_code)
                outputs["chip.gds"] = gds_path
                logger.info(f"  Generated GDSII: {gds_path}")
            except Exception as e:
                logger.warning(f"  Could not generate GDSII: {e}")
        
        # Generate weight bitstream
        weights_bin = self._generate_weights_binary(graph)
        weights_path = self.output_dir / "programming.bin"
        weights_path.write_bytes(weights_bin)
        outputs["programming.bin"] = weights_path
        logger.info(f"  Generated weights: {weights_path}")
        
        # Generate BOM
        bom = self._generate_bom(graph)
        bom_path = self.output_dir / "bom.json"
        bom_path.write_text(json.dumps(bom, indent=2))
        outputs["bom.json"] = bom_path
        logger.info(f"  Generated BOM: {bom_path}")
        
        return {
            "status": "success",
            "target": self.target,
            "quantize": self.quantize,
            "files": list(outputs.keys()),
            "output_dir": str(self.output_dir),
        }

    def _load_model(self, model_path):
        """Load model from file."""
        suffix = model_path.suffix.lower()
        
        if suffix == ".onnx":
            loader = ONNXLoader()
        elif suffix == ".gguf":
            loader = GGUFLoader()
        elif suffix == ".pt":
            from .frontend.torchscript import TorchScriptLoader
            loader = TorchScriptLoader()
        else:
            raise ValueError(f"Unsupported model format: {suffix}")
        
        return loader.load(model_path)

    def _generate_weights_binary(self, graph):
        """Generate weight binary for flashing."""
        # Collect all quantized weights and serialize
        weights_bytes = bytearray()
        
        for node in graph.get("nodes", []):
            if "weights" in node:
                w = node["weights"]
                if isinstance(w, (list, tuple)):
                    for val in w:
                        if isinstance(val, (list, tuple)):
                            for v in val:
                                weights_bytes.append(int(v) & 0xFF)
                        else:
                            weights_bytes.append(int(val) & 0xFF)
        
        return bytes(weights_bytes)

    def _generate_bom(self, graph):
        """Generate bill of materials."""
        return {
            "project": "MLS Inference",
            "target": self.target,
            "quantization": self.quantize,
            "node_count": len(graph.get("nodes", [])),
            "estimated_power_mw": 200,
            "estimated_area_mm2": 25,
            "cells": {
                "MAC": len([n for n in graph.get("nodes", []) if n.get("op") == "matmul"]),
                "REG": 256,
                "LOGIC": 1024,
            },
        }

    def _get_pdk(self):
        """Get PDK name for target."""
        pdks = {
            "asic-sky130": "sky130",
            "asic-gf180": "gf180mcu",
            "asic-generic": None,
            "fpga-kv260": None,
            "sim-verilator": None,
        }
        return pdks.get(self.target)
