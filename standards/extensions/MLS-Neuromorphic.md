# MLS Neuromorphic Extension (Draft)

**Mask-Lock Standard (MLS) v1.0 — Spiking Neural Network Support**
**Status:** Future Extension (Post-v1.0)
**Date:** 2026-03-24
**Revision:** 0.1

---

## 1. Motivation: Spiking Neural Networks

Spiking Neural Networks (SNNs) are brain-inspired models that:

- **Communicate via spikes** (discrete events) instead of continuous activations
- **Consume 100× less energy** than conventional ANNs
- **Process temporal sequences** naturally (no explicit time dimension needed)
- **Map naturally to neuromorphic hardware** (event-driven computation)

### 1.1 SNN vs ANN

**Artificial Neural Network (ANN):**
```
Activation: a = σ(Σ w_i × x_i)  (continuous value)
Energy: High (every multiply happens)
Latency: Fixed (all operations)
```

**Spiking Neural Network (SNN):**
```
Voltage: V(t) = Σ w_i × δ(x_i(t))  (spike events)
Spike if: V(t) > θ_threshold
Energy: Ultra-low (only spikes consume power)
Latency: Variable (depends on spike timing)
```

### 1.2 MLS + SNN Synergy

MLS's **ternary weights** are ideal for SNNs:

```
Weight value   SNN meaning
─────────────────────────
   -1          Inhibitory synapse
    0          No synapse
   +1          Excitatory synapse
```

This naturally maps to biological neural weights.

---

## 2. SNN Architecture Extension

### 2.1 Leaky Integrate-and-Fire (LIF) Neuron Model

Standard SNN neuron:

```
Membrane voltage dynamics:
  dV/dt = -V/τ + Σ w_i × spike_i(t)

If V(t) > θ:
  Fire spike
  V(t) := V(reset)
```

Where:
- τ = membrane time constant (~20-100 ms)
- θ = spike threshold (typically 1.0)
- V(reset) = resting potential (0.0)

### 2.2 Hardware Mapping to MLS

Extend MAC array to support **temporal computation**:

```
┌─────────────────────────────────────┐
│  Enhanced MAC Cell (LIF variant)    │
├─────────────────────────────────────┤
│                                     │
│  Input: spike_i ∈ {0, 1}            │
│  Weight: w_i ∈ {-1, 0, +1}          │
│  Output: V[t] (membrane voltage)    │
│                                     │
│  Computation:                       │
│    1. If spike_i:                   │
│       V[t] += w_i                   │
│    2. Apply leak:                   │
│       V[t] = V[t] - (V[t] / τ)     │
│    3. Check threshold:              │
│       if V[t] > θ:                  │
│           emit_spike()              │
│           V[t] = 0 (reset)          │
│                                     │
│  Register: 32-bit voltage tracker   │
│                                     │
└─────────────────────────────────────┘
```

### 2.3 Timestamp-Based Execution

Instead of **batch inference**, SNNs run in **time steps**:

```
for t in range(T_total):
    # Load spike input for timestep t
    write_register(0x1000, SPIKE_INPUT | (t & 0xFFFF))

    # Execute one time step
    write_register(0x1000, RUN_TIMESTEP)

    # Read output spikes
    spikes_out = read_register(0x200)  # Output spike register
```

Total latency: T_total × (1 + spike_read_latency)

---

## 3. Register Extensions for SNN

### 3.1 New Registers (Offset from base 0x1000)

```
Offset  Name              R/W  Purpose
──────────────────────────────────────
0xA0    SPIKE_INPUT       RW   Current spike pattern (one-hot)
0xA4    TIMESTEP          RW   Current simulation time (0 to T_max)
0xA8    NEURON_STATE      RW   Base address of V[t] memory
0xAC    TAU_CONFIG        RW   Membrane time constant
0xB0    THRESHOLD         RW   Spike threshold (fixed-point)
0xB4    SPIKE_OUTPUT      R    Firing pattern (one-hot)
0xB8    SNN_STATUS        R    Simulation progress
```

### 3.2 Commands (Extended)

Add new command codes:

```
Command     Code   Purpose
──────────────────────────────────
LOAD_WEIGHTS 0x01  (unchanged)
RUN_INFERENCE 0x02  (unchanged, ANN mode)
READ_LOGITS 0x03   (unchanged)
CASCADE_ESCALATE 0x04 (unchanged)
────────────────────────────────
LOAD_SNN_MODEL 0x11 Load SNN connectivity
RUN_TIMESTEP  0x12 Execute single time step
RUN_SNN_BATCH 0x13 Execute T timesteps
SPIKE_INJECT  0x14 Inject external spikes
```

---

## 4. SNN Execution Timeline

### 4.1 SNN Simulation Protocol

```
1. Load SNN connectivity (weights, tau, threshold)
   write_register(0xA0, LOAD_SNN_MODEL)

2. Initialize neuron states (V[i] = 0 for all i)

3. For each timestep t = 0 to T_max:
   a. Inject input spikes (or read from data stream)
      write_register(0xA0, SPIKE_INPUT | spike_pattern)

   b. Run single timestep
      write_register(0xA4, RUN_TIMESTEP)
      wait 100 ns (one time step ≈ 1 μs scaled)

   c. Read output spikes
      spikes_out = read_register(0xB4)

   d. Store result
      output_spike_trains[t] = spikes_out

4. Extract final classification (majority vote over spike times)
```

### 4.2 Energy Profile

**SNN vs ANN comparison (256×256 MAC array):**

| Metric | ANN | SNN (10 spikes/sec) | SNN (100 spikes/sec) |
|--------|-----|-------------------|----------------------|
| Per-inference power | 200 mW | 2 mW | 20 mW |
| Latency | 25 ns | 1 μs | 100 ns |
| Per-task energy | 5 μJ | 2 μJ | 2 μJ |

SNNs excel at **sparse, event-driven** workloads.

---

## 5. Temporal Dynamics Integration

### 5.1 Continuous-Time vs Discrete-Time

**Discrete-time SNN (simpler):**
```
V[t+1] = V[t] × (1 - 1/τ) + Σ w_i × spike_i[t]
```
Timestep Δt = 1 ms (biological-like)

**Continuous-time hardware (future):**
```
dV/dt = -V/τ + Σ w_i × spike_i(t)
∫ dV = ∫ (-V/τ + input) dt
```
Requires analog circuits (post-v1.0 research).

### 5.2 Learning Rules (Plasticity)

Future SNN extension could support **online learning**:

```
Weight update (STDP - Spike-Timing-Dependent Plasticity):
  Δw_ij = η × [spike_pre(t) × spike_post(t + Δt)]

If neuron j fires shortly after i:
  → w_ij increases (strengthening)
If timing reversed:
  → w_ij decreases (weakening)
```

**Challenge:** Mask-locked weights are immutable (cannot change post-fabrication).

**Solution:** Hybrid approach:
- Mask-locked primary weights (w_base ∈ {-1, 0, +1})
- Ephemeral modulation weights (w_mod, 8-bit, RAM-based)
- Final weight: w_effective = w_base × (1 + w_mod / 256)

---

## 6. Applications

### 6.1 Event-Based Vision

Process spiking outputs from neuromorphic cameras (DVS - Dynamic Vision Sensor):

```
Input: Pixel-level spike stream (asynchronous events)
  x, y, t, polarity (on/off)

SNN inference:
  1. Event arrives at pixel (x, y) at time t
  2. Inject spike into SNN input layer
  3. Propagate through network (LIF neurons)
  4. Classify motion pattern (1-100 ms latency)

Output: Classification (gesture, object, etc.)

Energy: nJ per event (1000× better than ANN)
```

### 6.2 Temporal Sound Processing

Audio spikes (cochlear model):

```
Input: Cochlear frequency bands (spiking representation)
  f_1, f_2, ..., f_N (spike times per band)

Network: SNN for speech recognition
  - Input layer: 64 cochlear bands
  - Hidden: 256-neuron reservoir
  - Output: 10-class phoneme

Latency: 50-200 ms (real-time speech)
```

### 6.3 Robotic Control

Closed-loop sensorimotor loop:

```
Input: Joint angles, touch sensors (asynchronous events)
Output: Motor commands (spike bursts → actuator PWM)
Latency: 1-10 ms (reactive control)
```

---

## 7. Implementation Roadmap

| Phase | Target | Features | Est. Area |
|-------|--------|----------|-----------|
| v1.0 | Now | ANN (ternary MAC) | 100% |
| v1.1 | 2026-Q3 | SNN simulation (discrete) | +2% |
| v1.2 | 2026-Q4 | SNN with STDP learning | +5% |
| v2.0 | 2027-H1 | Continuous-time analog + digital hybrid | +15% |

---

## 8. Research Questions

1. **Can we achieve biological AER (Address-Event Representation) compatibility?**
   - MLS as neuromorphic accelerator backend
   - Standard interfaces for DVS, BrainScaleS, Loihi

2. **What's the optimal τ (time constant) for edge inference?**
   - Too short (τ < 1 ms) → high frequency, energy penalty
   - Too long (τ > 100 ms) → slow decisions
   - Likely τ ≈ 10 ms sweet spot

3. **Can we support learning without modifying mask-locked weights?**
   - Modulation approach viable?
   - How much precision needed (4-bit? 8-bit?)

---

## 9. References

- Maass et al., "Networks of Spiking Neurons" (1997)
- Gerstner, "Spiking Neuron Models" (2014)
- Posch et al., "Dynamic Vision Sensor" (2008)
- Brette et al., "Brian: A simple and flexible simulator for spiking neural networks" (2007)

---

**End of MLS Neuromorphic Extension**
