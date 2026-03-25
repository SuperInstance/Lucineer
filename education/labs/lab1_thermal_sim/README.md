# Lab 1 — Thermal Simulation

## Objective

Simulate the thermal behavior of a mask-locked chip under inference load.
Understand how power density, die area, and cooling affect temperature.

## Duration: 3 hours

## Setup

```bash
cd education/labs/lab1_thermal_sim
pip install numpy matplotlib
```

## Background

At 28nm, our chip targets <3W at the wall. Key thermal parameters:
- Silicon thermal conductivity: 148 W/(m·K)
- Die thickness: 300 µm
- Package: QFN (passive cooling, no fan)

Reference: `docs/03-thermal-engineering.md`

## Exercise

### Part 1: Steady-State Thermal Model (45 min)

Implement the thermal resistance network model:

```
T_junction → R_silicon → R_die_attach → R_TIM → R_package → T_ambient
```

Calculate junction temperature for:
- 1W, 2W, 3W total power
- 25°C and 45°C ambient

### Part 2: Transient Thermal Simulation (45 min)

Simulate temperature rise during a 10-second inference burst:
1. Start at ambient (25°C)
2. Apply 2W inference load for 5s
3. Return to idle (0.1W) for 5s
4. Plot temperature vs. time

### Part 3: Hotspot Analysis (45 min)

The MAC array has non-uniform power density. Simulate a 2D thermal grid:
- MAC array region: 0.5 W/mm²
- I/O ring: 0.1 W/mm²
- Control logic: 0.05 W/mm²

Plot the temperature heatmap. Where are the hotspots?

### Part 4: Design Trade-offs (45 min)

Explore the design space:
- What happens if you double the array size (2× MACs)?
- What if you reduce clock from 200 MHz to 100 MHz?
- At what power does the chip need active cooling?

## Reference Code

- `research/thermal_dynamics_simulation.py`
- `research/cycle5_thermal_fluid.py`
- `fpga_lab/measurements/thermal/thermal_logger.py`

## Deliverables

1. `thermal_sim.py` — Your simulation code
2. `thermal_report.md` — Analysis with plots
3. Plots: steady-state, transient, heatmap, trade-off curves
