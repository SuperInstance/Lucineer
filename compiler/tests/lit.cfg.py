"""
lit.cfg.py — LLVM lit test suite configuration for clawc.

Usage:
    lit compiler/tests/
    lit compiler/tests/ -v --filter=onnx
    lit compiler/tests/test_cases/frontend/

Requires: pip install lit
"""

import lit.formats
import os
import sys

# Test suite name shown in output
config.name = "clawc"

# Use ShTest for .clawtest files, PythonTest for .py
config.test_format = lit.formats.ShTest(execute_external=True)

# File extensions to treat as test files
config.suffixes = {".clawtest", ".py", ".sh"}

# Root of compiler source (allows `clawc` to be found on PATH)
compiler_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, compiler_root)
config.environment["PYTHONPATH"] = compiler_root + os.pathsep + \
                                    config.environment.get("PYTHONPATH", "")

# Substitutions available in .clawtest files
config.substitutions.append(("%clawc",      f"python -m clawc"))
config.substitutions.append(("%clawc_run",  f"python -m clawc"))
config.substitutions.append(("%test_dir",   os.path.dirname(os.path.abspath(__file__))))
config.substitutions.append(("%fixtures",   os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                                          "test_cases", "fixtures")))

# Tests that require optional deps
config.available_features = set()
try:
    import onnx
    config.available_features.add("onnx")
except ImportError:
    pass

try:
    import torch
    config.available_features.add("torch")
except ImportError:
    pass

try:
    import gdstk
    config.available_features.add("gdstk")
except ImportError:
    pass

# Timeout per test (seconds)
config.test_exec_root = os.path.join(compiler_root, "tests", "output")
os.makedirs(config.test_exec_root, exist_ok=True)
