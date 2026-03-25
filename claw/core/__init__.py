"""
CLAW - Hardware-Rooted Agent (Closest to metal-Lock)

The agent that lives on the mask-locked chip itself.
Knows its own transistor arrangement, enforces privacy by default,
and compiles requests directly to hardware operations.

Core modules:
- agent.py: Main inference loop & decision engine
- compiler_iface.py: Interface to CLAWC compiler
- hardware_model.py: Self-model of physical chip constraints
- privacy_engine.py: Differential privacy & data redaction
"""

__version__ = "0.1.0"
__author__ = "SuperInstance Ranch"

from .agent import ClawAgent

__all__ = ["ClawAgent"]
