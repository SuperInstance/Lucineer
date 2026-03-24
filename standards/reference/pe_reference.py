#!/usr/bin/env python3
"""
MLS Processing Element (PE) Reference Behavior Model

Implements a single ternary MAC (multiply-accumulate) cell
with compliance to MLS 1.0 specification.

Author: SuperInstance Ranch
License: MIT
"""

from dataclasses import dataclass
from typing import Tuple


@dataclass
class PEConfig:
    """Processing element configuration."""
    quantization: str = "ternary"  # "ternary" or "int4"
    width_bits: int = 32           # Accumulator width
    max_value: int = 2**31 - 1
    min_value: int = -(2**31)


class TernaryMAC:
    """Ternary multiply-accumulate unit (reference implementation)."""

    def __init__(self, config: PEConfig = None):
        self.config = config or PEConfig()
        self.accumulator = 0

    def multiply(self, weight: int, activation: int) -> int:
        """
        Ternary multiply: w × a where both are in {-1, 0, +1}.

        Truth table:
            w   a   result
            -1  -1   +1
            -1   0    0
            -1  +1   -1
             0  -1    0
             0   0    0
             0  +1    0
            +1  -1   -1
            +1   0    0
            +1  +1   +1
        """
        assert weight in (-1, 0, 1), f"Invalid weight: {weight}"
        assert activation in (-1, 0, 1), f"Invalid activation: {activation}"

        # Zero-skip optimization
        if weight == 0 or activation == 0:
            return 0

        return weight * activation

    def accumulate(self, product: int, carry_in: int = 0) -> Tuple[int, int]:
        """
        Add product to accumulator with saturation.

        Returns: (accumulator_result, carry_out)
        """
        result = self.accumulator + product + carry_in

        # Saturation on overflow
        if result > self.config.max_value:
            self.accumulator = self.config.max_value
        elif result < self.config.min_value:
            self.accumulator = self.config.min_value
        else:
            self.accumulator = result

        return self.accumulator, 0  # Carry always 0 for single-bit results

    def mac_cycle(self, weight: int, activation: int, carry_in: int = 0) -> int:
        """
        Single MAC cycle: multiply, then accumulate.

        Returns: Updated accumulator value
        """
        product = self.multiply(weight, activation)
        result, _ = self.accumulate(product, carry_in)
        return result

    def reset(self):
        """Reset accumulator to zero."""
        self.accumulator = 0

    def __repr__(self):
        return f"TernaryMAC(accumulator={self.accumulator})"


class INT4MAC:
    """INT4 multiply-accumulate unit (4-bit signed inputs)."""

    def __init__(self, config: PEConfig = None):
        self.config = config or PEConfig()
        self.accumulator = 0

    @staticmethod
    def _clamp_int4(value: int) -> int:
        """Clamp value to INT4 range [-8, +7]."""
        if value < -8:
            return -8
        elif value > 7:
            return 7
        return value

    def multiply(self, weight: int, activation: int) -> int:
        """
        INT4 multiply: w × a where both are 4-bit signed.

        Weight: hardcoded in mask (constant)
        Activation: runtime value
        Result: 8-bit signed product
        """
        weight = self._clamp_int4(weight)
        activation = self._clamp_int4(activation)
        product = weight * activation

        # Cap to 8-bit range (16-bit product would overflow)
        return max(-128, min(127, product))

    def accumulate(self, product: int) -> int:
        """
        Add product to 32-bit accumulator with saturation.
        """
        result = self.accumulator + product

        # Saturation
        if result > self.config.max_value:
            self.accumulator = self.config.max_value
        elif result < self.config.min_value:
            self.accumulator = self.config.min_value
        else:
            self.accumulator = result

        return self.accumulator

    def mac_cycle(self, weight: int, activation: int) -> int:
        """Single INT4 MAC cycle."""
        product = self.multiply(weight, activation)
        return self.accumulate(product)

    def reset(self):
        """Reset accumulator."""
        self.accumulator = 0


class TernaryMACArray:
    """Array of ternary MAC units (2D mesh)."""

    def __init__(self, rows: int, cols: int):
        self.rows = rows
        self.cols = cols
        self.macs = [[TernaryMAC() for _ in range(cols)] for _ in range(rows)]

    def reset_all(self):
        """Reset all accumulators."""
        for row in self.macs:
            for mac in row:
                mac.reset()

    def forward(self, weights: list[list[int]], activations: list[int]) -> list[int]:
        """
        Forward pass through MAC array.

        Args:
            weights: [rows][cols] ternary weight matrix (fixed)
            activations: [cols] ternary activation vector (runtime)

        Returns:
            [rows] output logits
        """
        assert len(weights) == self.rows
        assert len(weights[0]) == self.cols
        assert len(activations) == self.cols

        self.reset_all()

        for i in range(self.rows):
            for j in range(self.cols):
                weight = weights[i][j]
                activation = activations[j]
                self.macs[i][j].mac_cycle(weight, activation)

        # Sum all columns in each row to get final result
        results = []
        for i in range(self.rows):
            row_sum = sum(self.macs[i][j].accumulator for j in range(self.cols))
            results.append(row_sum)
        return results

    def __repr__(self):
        return f"TernaryMACArray({self.rows}×{self.cols})"


def test_ternary_mac():
    """Test ternary MAC unit."""
    mac = TernaryMAC()

    # Test multiply truth table
    test_cases = [
        (-1, -1, 1),
        (-1, 0, 0),
        (-1, 1, -1),
        (0, -1, 0),
        (0, 0, 0),
        (0, 1, 0),
        (1, -1, -1),
        (1, 0, 0),
        (1, 1, 1),
    ]

    for w, a, expected in test_cases:
        result = mac.multiply(w, a)
        assert result == expected, f"MAC({w}, {a}) = {result}, expected {expected}"

    # Test accumulation
    mac.reset()
    mac.mac_cycle(1, 1)  # 1×1 = 1
    assert mac.accumulator == 1
    mac.mac_cycle(1, 1)  # 1×1 = 1
    assert mac.accumulator == 2
    mac.mac_cycle(-1, 1)  # -1×1 = -1
    assert mac.accumulator == 1

    # Test saturation
    mac.reset()
    mac.accumulator = mac.config.max_value
    mac.mac_cycle(1, 1)  # Should saturate
    assert mac.accumulator == mac.config.max_value

    print("✓ TernaryMAC tests passed")


def test_int4_mac():
    """Test INT4 MAC unit."""
    mac = INT4MAC()

    # Test multiply
    assert mac.multiply(7, 7) == 49 or mac.multiply(7, 7) == 127  # Saturate at 127
    assert mac.multiply(-8, -8) == 64 or mac.multiply(-8, -8) == 127
    assert mac.multiply(0, 5) == 0

    # Test accumulation
    mac.reset()
    mac.mac_cycle(5, 3)  # 5×3 = 15
    assert mac.accumulator == 15
    mac.mac_cycle(2, 2)  # 2×2 = 4
    assert mac.accumulator == 19

    print("✓ INT4MAC tests passed")


def test_mac_array():
    """Test MAC array forward pass."""
    # Simple 4×3 array
    array = TernaryMACArray(rows=4, cols=3)

    # Weights (hardcoded in mask)
    weights = [
        [1, 0, 1],
        [1, 1, 0],
        [0, 1, 1],
        [-1, -1, 1],
    ]

    # Activations (runtime)
    activations = [1, 1, 1]

    results = array.forward(weights, activations)

    # Expected results:
    # Row 0: 1×1 + 0×1 + 1×1 = 2
    # Row 1: 1×1 + 1×1 + 0×1 = 2
    # Row 2: 0×1 + 1×1 + 1×1 = 2
    # Row 3: -1×1 + -1×1 + 1×1 = -1

    assert results[0] == 2
    assert results[1] == 2
    assert results[2] == 2
    assert results[3] == -1

    print("✓ MAC Array tests passed")


def test_zero_skip():
    """Test zero-skip optimization."""
    mac = TernaryMAC()

    # When weight is 0, product should be 0 (even with non-zero activation)
    mac.reset()
    for a in [-1, 0, 1]:
        mac.mac_cycle(0, a)  # 0 × a = 0
    assert mac.accumulator == 0

    # When activation is 0, product should be 0
    mac.reset()
    for w in [-1, 1]:
        mac.mac_cycle(w, 0)  # w × 0 = 0
    assert mac.accumulator == 0

    print("✓ Zero-skip optimization verified")


if __name__ == "__main__":
    test_ternary_mac()
    test_int4_mac()
    test_mac_array()
    test_zero_skip()
    print("\n✓ All PE reference tests passed!")
