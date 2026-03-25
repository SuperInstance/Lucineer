#!/usr/bin/env python3
"""
Week 1 Exercise: 4-Bit ALU Simulator

Implement a cycle-accurate ALU supporting 8 operations.
This is the building block that will become hardware in Week 2.

Operations:
  0 = ADD    4 = XOR
  1 = SUB    5 = NOT (A only)
  2 = AND    6 = SHL (A << 1)
  3 = OR     7 = SHR (A >> 1)
"""


class ALU:
    """4-bit ALU."""

    BITS = 4
    MASK = (1 << BITS) - 1  # 0xF

    def compute(self, a: int, b: int, op: int) -> tuple[int, dict]:
        """Compute ALU operation.

        Args:
            a: 4-bit operand A (0–15)
            b: 4-bit operand B (0–15)
            op: 3-bit operation code (0–7)

        Returns:
            (result, flags) where flags has zero, carry, negative
        """
        a &= self.MASK
        b &= self.MASK

        carry = False

        if op == 0:    # ADD
            raw = a + b
            carry = raw > self.MASK
            result = raw & self.MASK
        elif op == 1:  # SUB
            raw = a - b
            carry = raw < 0
            result = raw & self.MASK
        elif op == 2:  # AND
            result = a & b
        elif op == 3:  # OR
            result = a | b
        elif op == 4:  # XOR
            result = a ^ b
        elif op == 5:  # NOT
            result = (~a) & self.MASK
        elif op == 6:  # SHL
            raw = a << 1
            carry = bool(raw & (1 << self.BITS))
            result = raw & self.MASK
        elif op == 7:  # SHR
            carry = bool(a & 1)
            result = a >> 1
        else:
            raise ValueError(f"Invalid opcode: {op}")

        flags = {
            "zero": result == 0,
            "carry": carry,
            "negative": bool(result & (1 << (self.BITS - 1))),
        }

        return result, flags


def test_alu():
    """Verification tests for the ALU."""
    alu = ALU()
    passed = 0
    failed = 0

    def check(desc, a, b, op, expected_result, expected_flags=None):
        nonlocal passed, failed
        result, flags = alu.compute(a, b, op)
        ok = result == expected_result
        if expected_flags:
            for k, v in expected_flags.items():
                if flags[k] != v:
                    ok = False
        if ok:
            passed += 1
            print(f"  [PASS] {desc}")
        else:
            failed += 1
            print(f"  [FAIL] {desc}: got {result} (flags={flags}), expected {expected_result}")

    print("=== ALU Tests ===\n")

    # ADD
    check("3 + 5 = 8",  3, 5, 0, 8)
    check("15 + 1 = 0 (carry)", 15, 1, 0, 0, {"carry": True, "zero": True})
    check("0 + 0 = 0 (zero)", 0, 0, 0, 0, {"zero": True})

    # SUB
    check("7 - 3 = 4",  7, 3, 1, 4)
    check("3 - 7 = 12 (borrow)", 3, 7, 1, 12, {"carry": True})

    # AND
    check("0xF & 0x5 = 0x5", 0xF, 0x5, 2, 0x5)
    check("0xA & 0x5 = 0x0", 0xA, 0x5, 2, 0x0, {"zero": True})

    # OR
    check("0xA | 0x5 = 0xF", 0xA, 0x5, 3, 0xF)

    # XOR
    check("0xF ^ 0xF = 0x0", 0xF, 0xF, 4, 0x0, {"zero": True})
    check("0xA ^ 0x5 = 0xF", 0xA, 0x5, 4, 0xF)

    # NOT
    check("NOT 0x0 = 0xF", 0x0, 0, 5, 0xF)
    check("NOT 0xF = 0x0", 0xF, 0, 5, 0x0, {"zero": True})

    # SHL
    check("0x5 << 1 = 0xA", 0x5, 0, 6, 0xA)
    check("0x8 << 1 = 0x0 (carry)", 0x8, 0, 6, 0x0, {"carry": True, "zero": True})

    # SHR
    check("0xA >> 1 = 0x5", 0xA, 0, 7, 0x5)
    check("0x1 >> 1 = 0x0 (carry)", 0x1, 0, 7, 0x0, {"carry": True, "zero": True})

    print(f"\nResults: {passed}/{passed+failed} passed")
    return failed == 0


if __name__ == "__main__":
    success = test_alu()
    exit(0 if success else 1)
