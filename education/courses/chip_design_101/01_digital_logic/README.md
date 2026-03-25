# Week 1 — Digital Logic from First Principles

## Learning Objectives

By the end of this week you will:
- Understand Boolean algebra and be able to simplify logic expressions
- Design combinational circuits (MUX, decoder, ALU) from truth tables
- Design sequential circuits (flip-flops, counters, FSMs)
- Translate a Python logic model to a gate-level description

## Readings

1. **Harris & Harris**, *Digital Design and Computer Architecture*, Ch. 1–3
2. `docs/01-architecture.md` — MLS architecture overview
3. [Nand2Tetris](https://www.nand2tetris.org/) Project 1 (free, optional)

## Exercise: 4-Bit ALU in Python

Build a cycle-accurate ALU simulator in Python, then verify it matches
the hardware truth table.

```python
# File: alu_sim.py — implement this

class ALU:
    """4-bit ALU supporting: ADD, SUB, AND, OR, XOR, NOT, SHL, SHR."""

    def compute(self, a: int, b: int, op: int) -> tuple[int, dict]:
        """
        Args:
            a: 4-bit operand A (0–15)
            b: 4-bit operand B (0–15)
            op: 3-bit operation code

        Returns:
            (result, flags) where flags = {"zero": bool, "carry": bool, "negative": bool}
        """
        # YOUR CODE HERE
        pass
```

## Checkpoint

Run `python -m pytest test_alu.py` — all 32 test cases must pass.
