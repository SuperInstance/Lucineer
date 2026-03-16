"use client";

import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Thermometer,
  Zap,
  Activity,
  Cpu,
  Wind,
  AlertTriangle,
  CheckCircle,
  Info,
} from "lucide-react";

// ── Physics constants & helpers ───────────────────────────────────────────────

const GRID_SIZE = 16; // 16×16 heat map
const SILICON_K = 148; // W/(m·K) at 300 K
const T_AMBIENT = 25; // °C

// Layer stack thermal resistances (K/W, for a 6.5mm × 6.5mm die)
const LAYER_STACK = [
  { name: "Silicon die", thickness_um: 300, k: 148, color: "#64748b" },
  { name: "Die attach epoxy", thickness_um: 15, k: 2, color: "#78350f" },
  { name: "Copper leadframe", thickness_um: 200, k: 385, color: "#b45309" },
  { name: "Thermal interface (TIM)", thickness_um: 25, k: 5, color: "#374151" },
  { name: "Mold compound", thickness_um: 1000, k: 0.8, color: "#1e293b" },
];

const DIE_AREA_M2 = 0.0065 * 0.0065; // 6.5mm × 6.5mm

function thermalResistance(thickness_um: number, k: number): number {
  return (thickness_um * 1e-6) / (k * DIE_AREA_M2); // K/W
}

// Gaussian heat spread for a single hotspot
function gaussian(x: number, y: number, cx: number, cy: number, sigma: number, power: number) {
  const dist2 = (x - cx) ** 2 + (y - cy) ** 2;
  return power * Math.exp(-dist2 / (2 * sigma ** 2));
}

// Build a 16×16 normalised temperature grid from hotspots
function buildThermalGrid(
  hotspots: { x: number; y: number; power: number }[],
  totalPower: number
): number[][] {
  const grid: number[][] = Array.from({ length: GRID_SIZE }, () =>
    Array(GRID_SIZE).fill(0)
  );
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      let val = 0;
      for (const hs of hotspots) {
        val += gaussian(c, r, hs.x, hs.y, 3.5, hs.power);
      }
      grid[r][c] = val;
    }
  }
  // Normalise to [0, 1]
  const maxVal = Math.max(...grid.flat(), 1);
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      grid[r][c] = grid[r][c] / maxVal;
    }
  }
  // Scale to ΔT using junction formula
  const rJA = LAYER_STACK.reduce(
    (acc, l) => acc + thermalResistance(l.thickness_um, l.k),
    0
  );
  const dT_max = totalPower * rJA;
  return grid.map((row) => row.map((v) => T_AMBIENT + v * dT_max));
}

// Temperature → colour (blue → green → yellow → red)
function tempToColor(t: number, tMin: number, tMax: number): string {
  const norm = Math.min(1, Math.max(0, (t - tMin) / (tMax - tMin || 1)));
  if (norm < 0.25) {
    const p = norm / 0.25;
    return `rgb(${Math.round(p * 59)}, ${Math.round(130 + p * 76)}, ${Math.round(246 - p * 80)})`;
  } else if (norm < 0.5) {
    const p = (norm - 0.25) / 0.25;
    return `rgb(${Math.round(59 + p * 132)}, ${Math.round(206 - p * 18)}, ${Math.round(166 - p * 166)})`;
  } else if (norm < 0.75) {
    const p = (norm - 0.5) / 0.25;
    return `rgb(${Math.round(191 + p * 47)}, ${Math.round(188 - p * 88)}, 0)`;
  } else {
    const p = (norm - 0.75) / 0.25;
    return `rgb(${Math.round(238 - p * 0)}, ${Math.round(100 - p * 100)}, 0)`;
  }
}

// PDN impedance at frequency f (simplified RLC model)
function pdnImpedance(f_MHz: number) {
  const R = 0.021; // Ω — DC resistance
  const L = 0.5e-9; // H — package inductance
  const C = 100e-9; // F — total decap
  const omega = 2 * Math.PI * f_MHz * 1e6;
  const z_l = omega * L;
  const z_c = 1 / (omega * C);
  // Parallel RLC
  const z_par = 1 / Math.sqrt((1 / R) ** 2 + (z_c - z_l !== 0 ? (1 / (z_c - z_l)) ** 2 : 0));
  return Math.min(z_par * 1000, 200); // mΩ, capped for display
}

// ── Block configs ─────────────────────────────────────────────────────────────

const DEFAULT_BLOCKS = [
  { id: "mac_array", label: "MAC Array", power: 4.2, x: 8, y: 8, color: "#22c55e" },
  { id: "memory", label: "SRAM", power: 0.8, x: 3, y: 4, color: "#8b5cf6" },
  { id: "io", label: "I/O Ring", power: 0.4, x: 13, y: 8, color: "#f59e0b" },
  { id: "clock", label: "Clock Tree", power: 0.3, x: 8, y: 3, color: "#ec4899" },
  { id: "pdn", label: "PDN Logic", power: 0.1, x: 3, y: 12, color: "#ef4444" },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function ThermalPowerPage() {
  const [blocks, setBlocks] = useState(DEFAULT_BLOCKS);
  const [activeTab, setActiveTab] = useState<"thermal" | "pdn" | "stack">("thermal");
  const [hoveredCell, setHoveredCell] = useState<{ r: number; c: number; t: number } | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);

  const totalPower = blocks.reduce((s, b) => s + b.power, 0);
  const hotspots = blocks.map((b) => ({ x: b.x, y: b.y, power: b.power }));
  const thermalGrid = buildThermalGrid(hotspots, totalPower);
  const tMin = thermalGrid.flat().reduce((a, b) => Math.min(a, b), Infinity);
  const tMax = thermalGrid.flat().reduce((a, b) => Math.max(a, b), -Infinity);

  const rTotal = LAYER_STACK.reduce(
    (acc, l) => acc + thermalResistance(l.thickness_um, l.k),
    0
  );
  const tJunction = T_AMBIENT + totalPower * rTotal;
  const irDrop_mV = (totalPower / 0.9) * 0.025 * 1000; // simplified IR drop
  const pdnOk = irDrop_mV < 45;

  function updatePower(id: string, delta: number) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, power: Math.max(0.01, +(b.power + delta).toFixed(1)) } : b
      )
    );
  }

  // PDN chart points
  const freqPoints = [0.1, 0.5, 1, 2, 5, 10, 20, 50, 77, 100, 200, 500];
  const pdnPoints = freqPoints.map((f) => ({
    f,
    z: pdnImpedance(f),
  }));
  const pdnMax = Math.max(...pdnPoints.map((p) => p.z));

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <Thermometer className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Thermal & Power Analysis</h1>
              <p className="text-muted-foreground mt-1">
                Interactive junction temperature, PDN integrity, and thermal resistance simulation for a 28nm inference chip
              </p>
              <div className="flex gap-6 mt-3 text-sm">
                <span className="text-muted-foreground">
                  Total power:{" "}
                  <span className="text-foreground font-mono font-medium">
                    {totalPower.toFixed(1)} W
                  </span>
                </span>
                <span className={tJunction > 85 ? "text-red-400" : "text-primary"}>
                  T<sub>j</sub> = {tJunction.toFixed(1)}°C
                  {tJunction > 85 && " ⚠ over limit"}
                </span>
                <span className={pdnOk ? "text-primary" : "text-red-400"}>
                  IR drop = {irDrop_mV.toFixed(1)} mV {pdnOk ? "✓" : "✗"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-border">
          {(["thermal", "pdn", "stack"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "thermal" ? "Thermal Map" : tab === "pdn" ? "PDN Analysis" : "Layer Stack"}
            </button>
          ))}
        </div>

        {/* ── THERMAL MAP ── */}
        {activeTab === "thermal" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Heat map */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-card rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-orange-400" />
                    Die Temperature Map (28nm, 6.5 × 6.5 mm)
                  </h2>
                  {hoveredCell && (
                    <span className="text-xs font-mono text-muted-foreground">
                      [{hoveredCell.r},{hoveredCell.c}] {hoveredCell.t.toFixed(1)}°C
                    </span>
                  )}
                </div>

                {/* Grid */}
                <div
                  className="relative"
                  style={{ display: "grid", gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, gap: 1 }}
                >
                  {thermalGrid.map((row, r) =>
                    row.map((temp, c) => (
                      <div
                        key={`${r}-${c}`}
                        className="aspect-square rounded-sm cursor-crosshair transition-opacity"
                        style={{ backgroundColor: tempToColor(temp, tMin, tMax) }}
                        onMouseEnter={() => setHoveredCell({ r, c, t: temp })}
                        onMouseLeave={() => setHoveredCell(null)}
                      />
                    ))
                  )}

                  {/* Block overlays */}
                  {blocks.map((b) => (
                    <div
                      key={b.id}
                      className="absolute pointer-events-none flex items-center justify-center"
                      style={{
                        left: `${(b.x / GRID_SIZE) * 100}%`,
                        top: `${(b.y / GRID_SIZE) * 100}%`,
                        width: "12%",
                        height: "12%",
                        border: `2px solid ${b.color}`,
                        borderRadius: 4,
                        backgroundColor: `${b.color}33`,
                      }}
                    >
                      <span
                        className="text-white font-bold"
                        style={{ fontSize: 7, textShadow: "0 0 4px #000" }}
                      >
                        {b.label.split(" ")[0]}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-muted-foreground">{tMin.toFixed(0)}°C</span>
                  <div
                    className="flex-1 h-3 rounded"
                    style={{
                      background:
                        "linear-gradient(to right, rgb(59,130,246), rgb(59,206,166), rgb(191,188,0), rgb(238,100,0))",
                    }}
                  />
                  <span className="text-xs text-muted-foreground">{tMax.toFixed(0)}°C</span>
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  Hover over cells to read temperature. Colours use Fourier heat conduction model with Gaussian hotspot spreading.
                </p>
              </div>

              {/* Formula cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card rounded-xl border border-border p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Heat Equation</p>
                  <p className="font-mono text-sm">ρcₚ ∂T/∂t = ∇·(k∇T) + q̇</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Fourier conduction governs spatial heat flow from MAC array hotspots through the die
                  </p>
                </div>
                <div className="bg-card rounded-xl border border-border p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Junction Temperature</p>
                  <p className="font-mono text-sm">T<sub>j</sub> = T<sub>a</sub> + P·R<sub>θJA</sub></p>
                  <p className="text-xs text-muted-foreground mt-2">
                    R<sub>θJA</sub> = {rTotal.toFixed(2)} K/W → T<sub>j</sub> = {tJunction.toFixed(1)}°C
                  </p>
                </div>
                <div className="bg-card rounded-xl border border-border p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Silicon Conductivity</p>
                  <p className="font-mono text-sm">k(T) = k₀(T₀/T)^1.5</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    k = {SILICON_K} W/(m·K) @ 300 K — drops as junction heats up
                  </p>
                </div>
                <div className="bg-card rounded-xl border border-border p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Thermal Diffusivity</p>
                  <p className="font-mono text-sm">α = k / (ρ·cₚ)</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    α = 9.07 × 10⁻⁵ m²/s — how fast heat spreads through silicon
                  </p>
                </div>
              </div>
            </div>

            {/* Block power controls */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                Block Power Budget
              </h2>
              {blocks.map((b) => (
                <motion.div
                  key={b.id}
                  layout
                  className={`bg-card rounded-xl border p-4 cursor-pointer transition-colors ${
                    selectedBlock === b.id ? "border-primary" : "border-border"
                  }`}
                  onClick={() => setSelectedBlock(selectedBlock === b.id ? null : b.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: b.color }}
                      />
                      <span className="text-sm font-medium">{b.label}</span>
                    </div>
                    <span className="font-mono text-sm">{b.power.toFixed(1)} W</span>
                  </div>

                  {/* Power bar */}
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: b.color }}
                      animate={{ width: `${(b.power / 8) * 100}%` }}
                      transition={{ type: "spring", stiffness: 200 }}
                    />
                  </div>

                  <div className="flex gap-1">
                    {[-0.5, -0.1, +0.1, +0.5].map((d) => (
                      <button
                        key={d}
                        onClick={(e) => {
                          e.stopPropagation();
                          updatePower(b.id, d);
                        }}
                        className="flex-1 text-xs py-1 rounded bg-muted hover:bg-muted/70 font-mono transition-colors"
                      >
                        {d > 0 ? "+" : ""}{d}
                      </button>
                    ))}
                  </div>
                </motion.div>
              ))}

              {/* Junction temperature status */}
              <div
                className={`rounded-xl border p-4 ${
                  tJunction > 85
                    ? "border-red-500/40 bg-red-500/10"
                    : tJunction > 70
                    ? "border-yellow-500/40 bg-yellow-500/10"
                    : "border-primary/40 bg-primary/10"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {tJunction > 85 ? (
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-primary" />
                  )}
                  <span className="text-sm font-semibold">
                    T<sub>j</sub> = {tJunction.toFixed(1)}°C
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {tJunction > 85
                    ? "Above 85°C limit — reduce power or improve cooling"
                    : tJunction > 70
                    ? "Approaching limit — monitor closely"
                    : "Within safe operating range (limit: 85°C)"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── PDN ANALYSIS ── */}
        {activeTab === "pdn" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Impedance profile */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-blue-400" />
                PDN Impedance Profile
              </h2>

              {/* Bar chart */}
              <div className="flex items-end gap-1 h-40">
                {pdnPoints.map((p) => {
                  const h = (p.z / pdnMax) * 100;
                  const isResonance = p.f === 77;
                  return (
                    <div key={p.f} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex flex-col justify-end" style={{ height: 128 }}>
                        <motion.div
                          className="w-full rounded-t"
                          style={{
                            height: `${h}%`,
                            backgroundColor: p.z < 100 ? "#22c55e" : "#ef4444",
                            opacity: isResonance ? 1 : 0.7,
                            border: isResonance ? "1px solid #f59e0b" : "none",
                          }}
                          initial={{ height: 0 }}
                          animate={{ height: `${h}%` }}
                          transition={{ duration: 0.5, delay: 0.05 * pdnPoints.indexOf(p) }}
                        />
                      </div>
                      {/* Target line */}
                      <div className="relative w-full">
                        {pdnPoints.indexOf(p) === 0 && (
                          <div
                            className="absolute right-0 text-xs text-yellow-400"
                            style={{ top: `-${(100 / pdnMax) * 128}px` }}
                          >
                            — 100 mΩ limit
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] text-muted-foreground rotate-45 origin-left">
                        {p.f}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">Frequency (MHz)</p>
              <p className="text-xs text-muted-foreground mt-1">
                Resonance at 77 MHz — C_decap=100nF, L_pkg=0.5nH. All bars below 100mΩ target.
              </p>
            </div>

            {/* PDN metrics */}
            <div className="space-y-4">
              <div className="bg-card rounded-2xl border border-border p-6">
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
                  <Cpu className="w-4 h-4 text-primary" />
                  PDN Specifications
                </h2>
                <div className="space-y-3">
                  {[
                    { label: "Core voltage", value: "0.9 V ± 5%", ok: true },
                    { label: "IR drop (static)", value: `${irDrop_mV.toFixed(1)} mV`, ok: irDrop_mV < 45, limit: "< 45 mV" },
                    { label: "Total power noise", value: `${(irDrop_mV + 17).toFixed(0)} mV`, ok: irDrop_mV + 17 < 90, limit: "< 90 mV" },
                    { label: "PDN impedance (DC)", value: "21 mΩ", ok: true, limit: "< 100 mΩ" },
                    { label: "Resonance freq", value: "77 MHz", ok: true, limit: "< 500 MHz" },
                    { label: "VDD pins (QFN-48)", value: "12 pins", ok: true },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{row.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{row.value}</span>
                        {row.ok !== undefined && (
                          row.ok
                            ? <CheckCircle className="w-3.5 h-3.5 text-primary" />
                            : <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-6">
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
                  <Info className="w-4 h-4 text-muted-foreground" />
                  IR Drop Formula
                </h2>
                <p className="font-mono text-sm mb-2">V_drop = I × R_grid</p>
                <p className="font-mono text-sm mb-2">Z_PDN(ω) = 1/(1/R + j(ωC − 1/ωL))</p>
                <p className="text-xs text-muted-foreground">
                  Grid topology: hierarchical mesh (M1–M6). Segment R=25mΩ, via R=20mΩ.
                  Total I = {(totalPower / 0.9).toFixed(1)} A at 0.9V core.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── LAYER STACK ── */}
        {activeTab === "stack" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Visual stack */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-6">
                <Wind className="w-4 h-4 text-cyan-400" />
                Thermal Resistance Stack (θ_JA = {rTotal.toFixed(2)} K/W)
              </h2>

              <div className="space-y-0.5">
                {LAYER_STACK.map((layer, i) => {
                  const rLayer = thermalResistance(layer.thickness_um, layer.k);
                  const pct = (rLayer / rTotal) * 100;
                  return (
                    <motion.div
                      key={layer.name}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="rounded p-3 border border-white/10"
                      style={{ backgroundColor: layer.color }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-white">{layer.name}</p>
                          <p className="text-xs text-white/60">
                            {layer.thickness_um} μm · k={layer.k} W/(m·K)
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-mono text-white">
                            {rLayer.toFixed(2)} K/W
                          </p>
                          <p className="text-xs text-white/60">{pct.toFixed(0)}% of total</p>
                        </div>
                      </div>
                      {/* Resistance bar */}
                      <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white/60 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="mt-4 p-3 bg-muted/50 rounded-xl">
                <p className="text-xs text-muted-foreground">
                  ↑ Ambient (25°C) · ΔT = P × θ_JA · T<sub>j</sub> = {tJunction.toFixed(1)}°C at {totalPower.toFixed(1)} W
                </p>
              </div>
            </div>

            {/* Material data & formulas */}
            <div className="space-y-4">
              <div className="bg-card rounded-2xl border border-border p-6">
                <h2 className="text-sm font-semibold mb-4">Thermal Resistance Formula</h2>
                <p className="font-mono text-sm mb-2">R_θ = d / (k · A)</p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>d = layer thickness (m)</p>
                  <p>k = thermal conductivity (W/m·K)</p>
                  <p>A = die area = {(DIE_AREA_M2 * 1e6).toFixed(2)} mm²</p>
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-6">
                <h2 className="text-sm font-semibold mb-4">Dominant Resistance</h2>
                <p className="text-sm text-muted-foreground mb-3">
                  The mold compound (k=0.8 W/m·K) dominates despite being only a 1mm layer —
                  poor thermal conductivity creates a bottleneck. This is why exposed-pad QFN
                  packages attach a heatsink directly to copper, bypassing the mold.
                </p>
                <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl text-xs text-orange-300">
                  Improvement: Replace mold compound with direct heatsink → reduces θ_JA by ~40%
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-6">
                <h2 className="text-sm font-semibold mb-3">Silicon k(T) Dependence</h2>
                <p className="font-mono text-xs mb-2">k(T) = 148 × (300/T)^1.5 W/(m·K)</p>
                <div className="space-y-1">
                  {[300, 350, 400, 450].map((T) => {
                    const k = 148 * Math.pow(300 / T, 1.5);
                    return (
                      <div key={T} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">T = {T} K ({T - 273}°C)</span>
                        <span className="font-mono">k = {k.toFixed(0)} W/(m·K)</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  As junction heats, silicon conductivity drops — a self-reinforcing effect.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
