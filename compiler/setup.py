"""
clawc — Mask-Lock Inference Compiler

Install (development):
    pip install -e compiler/

Install (user):
    pip install compiler/
"""

from setuptools import setup, find_packages

setup(
    name="clawc",
    version="0.1.0",
    description="Mask-Lock Inference Compiler: ONNX/GGUF → SystemVerilog/GDSII",
    packages=find_packages(exclude=["tests*"]),
    python_requires=">=3.10",
    install_requires=[
        "numpy>=1.24",
    ],
    extras_require={
        "onnx":   ["onnx>=1.14"],
        "torch":  ["torch>=2.0"],
        "gds":    ["gdstk>=0.9"],
        "dev":    ["pytest>=7", "lit>=15"],
    },
    entry_points={
        "console_scripts": [
            "clawc=clawc.__main__:main",
        ],
    },
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Science/Research",
        "Topic :: Scientific/Engineering :: Electronic Design Automation (EDA)",
        "Programming Language :: Python :: 3",
        "Programming Language :: C",
    ],
)
