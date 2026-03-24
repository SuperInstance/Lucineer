"""
clawc.frontend.gguf_loader — Load BitNet GGUF models into IRModule.

GGUF is the format used by llama.cpp / BitNet b1.58.
Key quantization types we care about:
    Q8_0  (INT8)
    Q4_K  (INT4 grouped)
    TQ1_0 (ternary 1.58-bit — native mask-lock format)
    TQ2_0 (ternary 2-bit)

Reference: https://github.com/ggerganov/ggml/blob/master/docs/gguf.md
"""

from __future__ import annotations

import struct
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from clawc.ir import IRModule, IRFunction, IRNode, IRTensor, DType
from clawc.utils.logger import get_logger

log = get_logger("frontend.gguf")

# GGUF magic
_MAGIC = b"GGUF"
_VERSION_3 = 3

# GGUF value types
_GGUF_TYPES = {
    0: "uint8",  1: "int8",  2: "uint16", 3: "int16",
    4: "uint32", 5: "int32", 6: "float32",7: "bool",
    8: "string", 9: "array",10: "uint64",11: "int64",
    12: "float64",
}

# Quantization type → DType mapping
_QTYPE_MAP = {
    0:  DType.FP32,    # F32
    1:  DType.FP16,    # F16
    8:  DType.INT8,    # Q8_0
    12: DType.INT4,    # Q4_K_M
    16: DType.TERNARY, # TQ1_0  (BitNet b1.58)
    17: DType.TERNARY, # TQ2_0
}


class GgufLoader:
    def __init__(self, cfg):
        self.cfg = cfg

    def load(self) -> IRModule:
        path = self.cfg.input_path
        log.info(f"Loading GGUF model: {path}")

        with open(path, "rb") as f:
            header = self._read_header(f)
            tensors_meta = self._read_tensor_infos(f, header["n_tensors"])
            data_offset = f.tell()
            # Align to 32 bytes
            data_offset = (data_offset + 31) & ~31

        module = IRModule(name=path.stem)
        fn = IRFunction(name="main")

        arch = header["metadata"].get("general.architecture", "unknown")
        n_layers = int(header["metadata"].get(f"{arch}.block_count", 0))
        log.info(f"  arch={arch}  layers={n_layers}  tensors={len(tensors_meta)}")

        # Build IR tensors from metadata (lazy-load data)
        with open(path, "rb") as f:
            for meta in tensors_meta:
                dtype = _QTYPE_MAP.get(meta["qtype"], DType.FP32)
                data = self._read_tensor_data(f, data_offset, meta, dtype)
                tensor = IRTensor(
                    name=meta["name"],
                    shape=tuple(meta["shape"]),
                    dtype=dtype,
                    data=data,
                )
                fn.add_tensor(tensor)

        # Reconstruct transformer layer graph from naming conventions
        self._build_transformer_ir(fn, n_layers, arch)

        module.add_function(fn)
        module.metadata.update({
            "source_format": "gguf",
            "arch": arch,
            "n_layers": n_layers,
            **{k: v for k, v in header["metadata"].items()
               if k.startswith("general.")},
        })
        log.info(f"  IR: {module}")
        return module

    # ------------------------------------------------------------------
    # GGUF binary parsing
    # ------------------------------------------------------------------

    def _read_header(self, f) -> dict:
        magic = f.read(4)
        if magic != _MAGIC:
            raise ValueError(f"Not a GGUF file (magic={magic!r})")
        version = struct.unpack("<I", f.read(4))[0]
        n_tensors = struct.unpack("<Q", f.read(8))[0]
        n_kv = struct.unpack("<Q", f.read(8))[0]
        metadata = {}
        for _ in range(n_kv):
            key = self._read_string(f)
            val = self._read_value(f)
            metadata[key] = val
        return {"version": version, "n_tensors": n_tensors, "metadata": metadata}

    def _read_tensor_infos(self, f, n_tensors: int) -> List[dict]:
        infos = []
        for _ in range(n_tensors):
            name = self._read_string(f)
            n_dims = struct.unpack("<I", f.read(4))[0]
            shape = list(struct.unpack(f"<{n_dims}Q", f.read(8 * n_dims)))
            qtype = struct.unpack("<I", f.read(4))[0]
            offset = struct.unpack("<Q", f.read(8))[0]
            infos.append({"name": name, "shape": shape, "qtype": qtype, "offset": offset})
        return infos

    def _read_tensor_data(self, f, base_offset: int, meta: dict,
                          dtype: DType) -> Optional[np.ndarray]:
        """Read and dequantize tensor data. Returns float32 array."""
        offset = base_offset + meta["offset"]
        f.seek(offset)
        numel = 1
        for s in meta["shape"]:
            numel *= s

        qtype = meta["qtype"]
        if qtype == 0:   # F32
            raw = f.read(numel * 4)
            return np.frombuffer(raw, dtype=np.float32).reshape(meta["shape"])
        elif qtype == 1:  # F16
            raw = f.read(numel * 2)
            return np.frombuffer(raw, dtype=np.float16).astype(np.float32).reshape(meta["shape"])
        elif qtype in (16, 17):  # TQ1_0 / TQ2_0 — ternary
            return self._dequant_ternary(f, numel, meta["shape"], qtype)
        elif qtype == 8:  # Q8_0
            return self._dequant_q8(f, numel, meta["shape"])
        else:
            log.warning(f"  Unsupported qtype {qtype} for {meta['name']}, skipping data")
            return None

    def _dequant_ternary(self, f, numel: int, shape: list, qtype: int) -> np.ndarray:
        """Dequantize TQ1_0/TQ2_0 to float {-1, 0, +1}."""
        # TQ1_0: 1.58 bits per weight — 5 ternary values packed in 8 bits
        # TQ2_0: 2 bits per weight — 4 values packed in byte
        out = np.zeros(numel, dtype=np.float32)
        if qtype == 17:  # TQ2_0: 2bpw
            n_bytes = (numel + 3) // 4
            raw = np.frombuffer(f.read(n_bytes), dtype=np.uint8)
            for i in range(numel):
                byte_idx, bit_off = divmod(i * 2, 8)
                if byte_idx < len(raw):
                    val = (raw[byte_idx] >> bit_off) & 0x3
                    out[i] = float(val) - 1.0   # {0,1,2} → {-1,0,+1}
        else:  # TQ1_0: pack 5 ternary in 8 bits (base-3 encoding)
            n_bytes = (numel + 4) // 5
            raw = f.read(n_bytes)
            idx = 0
            for byte in raw:
                v = byte
                for _ in range(5):
                    if idx >= numel:
                        break
                    out[idx] = float(v % 3) - 1.0
                    v //= 3
                    idx += 1
        return out.reshape(shape)

    def _dequant_q8(self, f, numel: int, shape: list) -> np.ndarray:
        """Dequantize Q8_0 (32 weights per block with fp16 scale)."""
        block_size = 32
        n_blocks = (numel + block_size - 1) // block_size
        out = np.zeros(numel, dtype=np.float32)
        for b in range(n_blocks):
            scale = struct.unpack("<e", f.read(2))[0]   # fp16
            block = np.frombuffer(f.read(block_size), dtype=np.int8).astype(np.float32)
            start = b * block_size
            end = min(start + block_size, numel)
            out[start:end] = block[:end - start] * scale
        return out.reshape(shape)

    # ------------------------------------------------------------------
    # String / value parsing helpers
    # ------------------------------------------------------------------

    def _read_string(self, f) -> str:
        n = struct.unpack("<Q", f.read(8))[0]
        return f.read(n).decode("utf-8", errors="replace")

    def _read_value(self, f):
        vtype = struct.unpack("<I", f.read(4))[0]
        typename = _GGUF_TYPES.get(vtype, "unknown")
        if typename in ("uint8",):     return struct.unpack("B", f.read(1))[0]
        if typename == "int8":         return struct.unpack("b", f.read(1))[0]
        if typename == "uint16":       return struct.unpack("<H", f.read(2))[0]
        if typename == "int16":        return struct.unpack("<h", f.read(2))[0]
        if typename == "uint32":       return struct.unpack("<I", f.read(4))[0]
        if typename == "int32":        return struct.unpack("<i", f.read(4))[0]
        if typename == "float32":      return struct.unpack("<f", f.read(4))[0]
        if typename == "bool":         return bool(struct.unpack("B", f.read(1))[0])
        if typename == "string":       return self._read_string(f)
        if typename == "uint64":       return struct.unpack("<Q", f.read(8))[0]
        if typename == "int64":        return struct.unpack("<q", f.read(8))[0]
        if typename == "float64":      return struct.unpack("<d", f.read(8))[0]
        if typename == "array":
            elem_type = struct.unpack("<I", f.read(4))[0]
            n = struct.unpack("<Q", f.read(8))[0]
            # Read array — limit to avoid huge reads for unknown types
            return [self._read_value(f) for _ in range(min(n, 1024))]
        return None

    # ------------------------------------------------------------------
    # Transformer IR reconstruction
    # ------------------------------------------------------------------

    def _build_transformer_ir(self, fn: IRFunction, n_layers: int, arch: str):
        """
        Reconstruct the transformer computation graph from GGUF tensor naming.
        GGUF names follow: blk.{layer}.{component}.weight
        """
        # Embedding
        if "token_embd.weight" in fn.tensors:
            fn.add_node(IRNode(
                op="embedding_lookup",
                inputs=["input_ids", "token_embd.weight"],
                outputs=["hidden_states"],
                attrs={"weight_tensor": fn.tensors["token_embd.weight"],
                       "weight_frozen": False},
            ))

        # Transformer blocks
        for layer in range(n_layers):
            prefix = f"blk.{layer}"
            # Self-attention projections
            for proj in ("attn_q", "attn_k", "attn_v", "attn_output"):
                w_name = f"{prefix}.{proj}.weight"
                if w_name in fn.tensors:
                    fn.add_node(IRNode(
                        op="matmul",
                        inputs=[f"layer_{layer}_input", w_name],
                        outputs=[f"layer_{layer}_{proj}_out"],
                        attrs={"layer": layer, "proj": proj,
                               "weight_tensor": fn.tensors[w_name],
                               "weight_frozen": False},
                    ))
            # FFN
            for ffn in ("ffn_gate", "ffn_up", "ffn_down"):
                w_name = f"{prefix}.{ffn}.weight"
                if w_name in fn.tensors:
                    fn.add_node(IRNode(
                        op="matmul",
                        inputs=[f"layer_{layer}_attn_out", w_name],
                        outputs=[f"layer_{layer}_{ffn}_out"],
                        attrs={"layer": layer, "proj": ffn,
                               "weight_tensor": fn.tensors[w_name],
                               "weight_frozen": False},
                    ))

        # Output norm + LM head
        for name in ("output_norm.weight", "output.weight"):
            if name in fn.tensors:
                fn.add_node(IRNode(
                    op="matmul" if "output" in name else "layer_norm",
                    inputs=["final_hidden", name],
                    outputs=["logits" if "output" in name else "normed"],
                    attrs={"weight_tensor": fn.tensors[name], "weight_frozen": False},
                ))
