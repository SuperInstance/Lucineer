"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Droplets,
  Wind,
  Thermometer,
  Zap,
  Info,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

// ── Physics constants ──────────────────────────────────────────────────────────

const C_P_WATER = 4186; // J/(kg·K)
const RHO_WATER = 1000; // kg/m³
const K_COPPER = 400; // W/(m·K)
const K_EFF_VAPOR = 20000; // W/(m·K) effective vapor chamber
const MU_WATER = 0.001; // Pa·s dynamic viscosity at ~20°C
const SIGMA_WATER = 0.072; // N/m surface tension

// Hydraulic channel geometry
const CHANNEL_ROWS = 4;
const CHANNEL_COLS = 20;

// ── Helpers ────────────────────────────────────────────────────────────────────

function lerpColor(norm: number): string {
  // blue → cyan → green → yellow → red
  const stops = [
    [59, 130, 246],   // blue
    [34, 211, 238],   // cyan
    [34, 197, 94],    // green
    [234, 179, 8],    // yellow
    [239, 68, 68],    // red
  ] as const;
  const idx = norm * (stops.length - 1);
  const lo = Math.floor(Math.min(idx, stops.length - 2));
  const hi = lo + 1;
  const t = idx - lo;
  const [r0, g0, b0] = stops[lo];
  const [r1, g1, b1] = stops[hi];
  return `rgb(${Math.round(r0 + t * (r1 - r0))},${Math.round(g0 + t * (g1 - g0))},${Math.round(b0 + t * (b1 - b0))})`;
}

// Darcy-Weisbach pressure drop for a microchannel
// D_h in meters, L in meters, v in m/s
function pressureDrop(D_h_m: number, L_m: number, v_m_s: number): number {
  const Re = (RHO_WATER * v_m_s * D_h_m) / MU_WATER;
  const f = Re < 2300 ? 64 / Re : 0.316 * Math.pow(Re, -0.25);
  return f * (L_m / D_h_m) * (RHO_WATER * v_m_s * v_m_s) / 2; // Pa
}

// Pump power W
function pumpPower(dP_Pa: number, Q_m3s: number, eta = 0.6): number {
  return (dP_Pa * Q_m3s) / eta;
}

// Spreading resistance for a circular source approximation
// A_s in m², k in W/(m·K)
function spreadingResistance(A_s_m2: number, k: number): number {
  return 1 / (2 * k * Math.sqrt(Math.PI * A_s_m2)); // °C/W
}

// ── Data ───────────────────────────────────────────────────────────────────────

const HEAT_PIPE_TYPES = [
  { name: "Aluminum vapor chamber", R_th: 0.04, highlight: true },
  { name: "Copper sintered wick", R_th: 0.05, highlight: false },
  { name: "Copper mesh wick", R_th: 0.08, highlight: false },
  { name: "Grooved copper", R_th: 0.12, highlight: false },
  { name: "Standard copper slug", R_th: 0.25, highlight: false },
];

const FLOW_REGIMES = [
  {
    name: "Bubbly",
    voidFraction: "0–0.25",
    htc: "5,000–15,000",
    color: "#3b82f6",
    note: "Discrete bubbles, high h near onset of nucleate boiling",
    width: "18%",
  },
  {
    name: "Slug",
    voidFraction: "0.25–0.50",
    htc: "10,000–30,000",
    color: "#8b5cf6",
    note: "Alternating liquid plugs and vapor slugs; unstable in microchannels",
    width: "22%",
  },
  {
    name: "Annular",
    voidFraction: "0.50–0.80",
    htc: "20,000–80,000",
    color: "#ec4899",
    note: "Thin liquid film on wall; highest heat transfer coefficient region",
    width: "35%",
  },
  {
    name: "Mist",
    voidFraction: "0.80–1.0",
    htc: "1,000–5,000",
    color: "#ef4444",
    note: "Dry-out: wall exposed to vapor — critical failure mode for chips",
    width: "25%",
  },
];

// ── Component ──────────────────────────────────────────────────────────────────

export default function FluidCoolingPage() {
  // Section 1 — Coolant Flow
  const [flowRate_Lmin, setFlowRate] = useState(2.0); // L/min
  const [T_in, setTin] = useState(20); // °C
  const [chipPower_W, setChipPower] = useState(200); // W

  // Section 2 — Heat Pipe
  const [hp_power, setHpPower] = useState(150); // W
  const [hp_sink_T, setHpSinkT] = useState(40); // °C

  // Section 3 — Vapor Chamber
  const [vc_sourceArea_mm2, setVcSourceArea] = useState(100); // mm²
  const [vc_totalArea_mm2, setVcTotalArea] = useState(2500); // mm²
  const [vc_power_W, setVcPower] = useState(200); // W

  // Section 5 — Pump curve
  const [D_h_mm, setDhMm] = useState(1.0); // mm
  const L_CHANNEL = 0.08; // 80 mm channel length (m)

  // ── Section 1 derived values ────────────────────────────────────────────────
  const mdot = (flowRate_Lmin / 60) * RHO_WATER; // kg/s
  const T_out = T_in + chipPower_W / (mdot * C_P_WATER);
  const deltaT_fluid = T_out - T_in;

  // Channel temperature gradient (position 0 = inlet, 19 = outlet)
  const channelTemps = useMemo(() => {
    return Array.from({ length: CHANNEL_COLS }, (_, col) => {
      const frac = col / (CHANNEL_COLS - 1);
      return T_in + frac * deltaT_fluid;
    });
  }, [T_in, deltaT_fluid]);

  const tMin_fluid = T_in;
  const tMax_fluid = T_out;

  // Arrow animation speed based on flow rate
  const arrowAnimDuration = 2.5 / flowRate_Lmin; // faster at high flow

  // ── Section 2 derived values ────────────────────────────────────────────────
  const hp_results = HEAT_PIPE_TYPES.map((hp) => ({
    ...hp,
    T_source: hp_sink_T + hp_power * hp.R_th,
  }));
  const hp_max_T_source = Math.max(...hp_results.map((h) => h.T_source));

  // ── Section 3 derived values ────────────────────────────────────────────────
  const A_s_m2 = vc_sourceArea_mm2 * 1e-6;
  const R_vc = spreadingResistance(A_s_m2, K_EFF_VAPOR);
  const R_cu = spreadingResistance(A_s_m2, K_COPPER);
  const dT_vc = vc_power_W * R_vc;
  const dT_cu = vc_power_W * R_cu;
  const reduction_pct = ((dT_cu - dT_vc) / dT_cu) * 100;

  // ── Section 5 derived pump curve ───────────────────────────────────────────
  const D_h_m = D_h_mm * 1e-3;
  // Channel cross-section assumed square: D_h = side length
  const A_ch_m2 = (D_h_m / 2) * (D_h_m / 2) * Math.PI; // approx circular
  const NUM_CHANNELS = 80; // total channels in cold plate

  const pumpCurvePoints = useMemo(() => {
    const points = [];
    for (let Q_Lmin = 0.2; Q_Lmin <= 5.0; Q_Lmin += 0.2) {
      const Q_m3s = (Q_Lmin / 60) * 1e-3;
      const Q_per_channel = Q_m3s / NUM_CHANNELS;
      const v = Q_per_channel / A_ch_m2;
      const dP = pressureDrop(D_h_m, L_CHANNEL, v);
      const P_pump = pumpPower(dP, Q_m3s);
      const mdot_c = Q_m3s * RHO_WATER;
      const T_out_c = T_in + chipPower_W / (mdot_c * C_P_WATER);
      const coolingEff = chipPower_W / (P_pump + 1e-9); // W cooling per W pump
      points.push({ Q_Lmin, dP, P_pump, T_out_c, coolingEff });
    }
    return points;
  }, [D_h_m, chipPower_W, T_in]);

  const svgW = 480;
  const svgH = 220;
  const svgPad = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartW = svgW - svgPad.left - svgPad.right;
  const chartH = svgH - svgPad.top - svgPad.bottom;

  const maxQ = 5.0;
  const maxPump = Math.max(...pumpCurvePoints.map((p) => p.P_pump), 1);

  function toX(Q: number) {
    return svgPad.left + (Q / maxQ) * chartW;
  }
  function toY(P: number) {
    return svgPad.top + chartH - (P / maxPump) * chartH;
  }

  const pumpPath = pumpCurvePoints
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(p.Q_Lmin).toFixed(1)},${toY(p.P_pump).toFixed(1)}`)
    .join(" ");

  // "Sweet spot" — region where COP is highest (roughly 1–3 L/min for most configs)
  const sweetSpotX1 = toX(1.0);
  const sweetSpotX2 = toX(3.0);

  // Tick marks
  const xTicks = [0, 1, 2, 3, 4, 5];
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map((t) => t * maxPump);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Header ── */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Droplets className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-1">
                Round 6 · Chip Engineering Series
              </p>
              <h1 className="text-3xl font-bold">Fluid Dynamics for Chip Cooling</h1>
              <p className="text-muted-foreground mt-1 max-w-2xl">
                Interactive simulation of liquid cooling, heat pipes, and vapor chambers
                for high-power inference chips. Adjust parameters and see real-time
                physics-based results.
              </p>
              <div className="flex flex-wrap gap-4 mt-3 text-sm">
                <span className="text-muted-foreground">
                  Chip power:{" "}
                  <span className="text-foreground font-mono font-medium">{chipPower_W} W</span>
                </span>
                <span className="text-muted-foreground">
                  Flow rate:{" "}
                  <span className="text-foreground font-mono font-medium">
                    {flowRate_Lmin.toFixed(1)} L/min
                  </span>
                </span>
                <span className={T_out > 50 ? "text-yellow-400" : "text-blue-400"}>
                  T_out = {T_out.toFixed(1)}°C
                  {T_out > 50 && " ⚠ high"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 1 — Coolant Flow Visualizer
        ══════════════════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Droplets className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-semibold">1 · Microchannel Cold Plate Flow</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Channel visualizer */}
            <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-muted-foreground">
                  {CHANNEL_COLS}×{CHANNEL_ROWS} microchannel grid — left = inlet, right = outlet
                </p>
                <span className="text-xs font-mono text-blue-300">
                  ΔT = {deltaT_fluid.toFixed(2)}°C
                </span>
              </div>

              {/* Channel grid */}
              <div className="relative overflow-hidden rounded-xl border border-border/50 bg-slate-950">
                {Array.from({ length: CHANNEL_ROWS }, (_, row) => (
                  <div key={row} className="flex" style={{ height: 52 }}>
                    {Array.from({ length: CHANNEL_COLS }, (_, col) => {
                      const temp = channelTemps[col];
                      const norm = tMax_fluid > tMin_fluid
                        ? (temp - tMin_fluid) / (tMax_fluid - tMin_fluid)
                        : 0;
                      const bg = lerpColor(Math.min(1, Math.max(0, norm)));
                      return (
                        <div
                          key={col}
                          className="flex-1 relative overflow-hidden flex items-center justify-center border-r border-b border-slate-900/60"
                          style={{ backgroundColor: bg + "55" }}
                        >
                          {/* Animated flow arrow */}
                          <motion.div
                            className="absolute inset-0 flex items-center"
                            style={{ paddingLeft: "10%" }}
                            animate={{ x: ["0%", "100%"] }}
                            transition={{
                              repeat: Infinity,
                              duration: arrowAnimDuration,
                              ease: "linear",
                              delay: (col * 0.04 + row * 0.15) % arrowAnimDuration,
                            }}
                          >
                            <div
                              className="text-white/80 font-bold select-none"
                              style={{
                                fontSize: 10,
                                textShadow: "0 0 6px rgba(0,0,0,0.8)",
                              }}
                            >
                              →
                            </div>
                          </motion.div>
                          {/* Temperature dot for outlet column */}
                          {col === CHANNEL_COLS - 1 && row === 0 && (
                            <span
                              className="absolute right-0.5 top-0.5 text-[8px] font-mono text-white/90"
                              style={{ textShadow: "0 0 4px #000" }}
                            >
                              {T_out.toFixed(1)}°
                            </span>
                          )}
                          {col === 0 && row === 0 && (
                            <span
                              className="absolute left-0.5 top-0.5 text-[8px] font-mono text-white/90"
                              style={{ textShadow: "0 0 4px #000" }}
                            >
                              {T_in}°
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* Inlet / Outlet labels */}
                <div className="flex justify-between px-2 py-1 bg-slate-900/60 text-[10px] font-mono text-slate-400">
                  <span>← INLET ({T_in}°C)</span>
                  <span>OUTLET ({T_out.toFixed(1)}°C) →</span>
                </div>
              </div>

              {/* Color scale legend */}
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-muted-foreground">{T_in}°C</span>
                <div
                  className="flex-1 h-3 rounded"
                  style={{
                    background:
                      "linear-gradient(to right, rgb(59,130,246), rgb(34,211,238), rgb(34,197,94), rgb(234,179,8), rgb(239,68,68))",
                  }}
                />
                <span className="text-xs text-muted-foreground">{T_out.toFixed(1)}°C</span>
              </div>

              {/* Formula */}
              <div className="mt-3 p-3 bg-muted/40 rounded-xl">
                <p className="font-mono text-xs text-blue-300">
                  T_out = T_in + Q / (ṁ · c_p)
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ṁ = {(mdot).toFixed(4)} kg/s &nbsp;·&nbsp; c_p = {C_P_WATER} J/(kg·K) &nbsp;·&nbsp;
                  Q = {chipPower_W} W
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-5">
              {/* Flow rate */}
              <div className="bg-card rounded-2xl border border-border p-5">
                <label className="text-sm font-medium flex items-center gap-2 mb-3">
                  <Wind className="w-4 h-4 text-blue-400" />
                  Flow Rate
                </label>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">0.5 L/min</span>
                  <span className="font-mono text-sm font-semibold text-blue-300">
                    {flowRate_Lmin.toFixed(1)} L/min
                  </span>
                  <span className="text-xs text-muted-foreground">5 L/min</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={5}
                  step={0.1}
                  value={flowRate_Lmin}
                  onChange={(e) => setFlowRate(parseFloat(e.target.value))}
                  className="w-full accent-blue-400"
                />
              </div>

              {/* Inlet temperature */}
              <div className="bg-card rounded-2xl border border-border p-5">
                <label className="text-sm font-medium flex items-center gap-2 mb-3">
                  <Thermometer className="w-4 h-4 text-cyan-400" />
                  Inlet Temperature
                </label>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">10°C</span>
                  <span className="font-mono text-sm font-semibold text-cyan-300">
                    {T_in}°C
                  </span>
                  <span className="text-xs text-muted-foreground">30°C</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={30}
                  step={1}
                  value={T_in}
                  onChange={(e) => setTin(parseInt(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              {/* Chip power */}
              <div className="bg-card rounded-2xl border border-border p-5">
                <label className="text-sm font-medium flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  Chip Power
                </label>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">50 W</span>
                  <span className="font-mono text-sm font-semibold text-yellow-300">
                    {chipPower_W} W
                  </span>
                  <span className="text-xs text-muted-foreground">400 W</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={400}
                  step={10}
                  value={chipPower_W}
                  onChange={(e) => setChipPower(parseInt(e.target.value))}
                  className="w-full accent-yellow-400"
                />
              </div>

              {/* Result summary */}
              <div
                className={`rounded-2xl border p-5 ${
                  T_out > 60
                    ? "border-red-500/40 bg-red-500/10"
                    : T_out > 45
                    ? "border-yellow-500/40 bg-yellow-500/10"
                    : "border-blue-500/40 bg-blue-500/10"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {T_out > 60 ? (
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-blue-400" />
                  )}
                  <span className="text-sm font-semibold">Outlet: {T_out.toFixed(2)}°C</span>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>Mass flow ṁ = {(mdot * 1000).toFixed(2)} g/s</p>
                  <p>ΔT fluid = {deltaT_fluid.toFixed(2)}°C</p>
                  <p>Heat capacity flow = {(mdot * C_P_WATER).toFixed(0)} W/K</p>
                  <p className="text-xs mt-2">
                    {T_out > 60
                      ? "Warning: high outlet temp — increase flow rate or reduce power"
                      : "Coolant within acceptable range"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 2 — Heat Pipe Performance Chart
        ══════════════════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Thermometer className="w-5 h-5 text-orange-400" />
            <h2 className="text-xl font-semibold">2 · Heat Pipe Thermal Resistance</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Bar chart */}
            <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-6">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">Thermal Resistance R_th (°C/W)</p>
                <span className="text-xs text-muted-foreground">
                  Lower = better
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-4 font-mono">
                T_source = T_sink + P × R_th
              </p>

              <div className="space-y-3">
                {hp_results.map((hp) => {
                  const barPct = (hp.R_th / 0.25) * 100;
                  const isHot = hp.T_source > 100;
                  return (
                    <motion.div
                      key={hp.name}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`rounded-xl border p-3 ${
                        hp.highlight
                          ? "border-green-500/40 bg-green-500/10"
                          : "border-border bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {hp.highlight && (
                            <span className="text-[10px] font-bold text-green-400 bg-green-400/15 px-1.5 py-0.5 rounded">
                              BEST
                            </span>
                          )}
                          <span
                            className={`text-sm font-medium ${
                              hp.highlight ? "text-green-300" : ""
                            }`}
                          >
                            {hp.name}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-sm">{hp.R_th} °C/W</span>
                          <span
                            className={`ml-3 font-mono text-sm ${
                              isHot ? "text-red-400" : "text-foreground"
                            }`}
                          >
                            T_s = {hp.T_source.toFixed(1)}°C
                            {isHot && " ⚠"}
                          </span>
                        </div>
                      </div>
                      {/* Bar */}
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{
                            backgroundColor: hp.highlight
                              ? "#22c55e"
                              : hp.R_th > 0.2
                              ? "#ef4444"
                              : hp.R_th > 0.1
                              ? "#f59e0b"
                              : "#3b82f6",
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${barPct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Scale hint */}
              <div className="flex justify-between text-xs text-muted-foreground mt-2 px-1">
                <span>0 °C/W (ideal)</span>
                <span>0.25 °C/W (worst)</span>
              </div>
            </div>

            {/* Controls & formula */}
            <div className="space-y-4">
              <div className="bg-card rounded-2xl border border-border p-5">
                <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  Input Conditions
                </h3>

                <label className="text-xs text-muted-foreground">
                  Source Power (W)
                </label>
                <div className="flex items-center justify-between mt-1 mb-1">
                  <span className="text-xs text-muted-foreground">10 W</span>
                  <span className="font-mono text-sm font-semibold text-yellow-300">
                    {hp_power} W
                  </span>
                  <span className="text-xs text-muted-foreground">500 W</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={10}
                  value={hp_power}
                  onChange={(e) => setHpPower(parseInt(e.target.value))}
                  className="w-full accent-yellow-400 mb-4"
                />

                <label className="text-xs text-muted-foreground">
                  Sink Temperature (°C)
                </label>
                <div className="flex items-center justify-between mt-1 mb-1">
                  <span className="text-xs text-muted-foreground">20°C</span>
                  <span className="font-mono text-sm font-semibold text-cyan-300">
                    {hp_sink_T}°C
                  </span>
                  <span className="text-xs text-muted-foreground">70°C</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={70}
                  step={1}
                  value={hp_sink_T}
                  onChange={(e) => setHpSinkT(parseInt(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div className="bg-card rounded-2xl border border-border p-5">
                <h3 className="text-sm font-semibold mb-3">
                  <Info className="w-4 h-4 inline mr-1 text-muted-foreground" />
                  Formula
                </h3>
                <p className="font-mono text-xs bg-muted/50 rounded-lg p-3 text-blue-200">
                  T_source = T_sink + P × R_th
                </p>
                <div className="space-y-1 text-xs text-muted-foreground mt-3">
                  <p>P = {hp_power} W (source power)</p>
                  <p>T_sink = {hp_sink_T}°C</p>
                  <p>
                    Best case (vapor chamber):{" "}
                    <span className="font-mono text-green-300">
                      {(hp_sink_T + hp_power * 0.04).toFixed(1)}°C
                    </span>
                  </p>
                  <p>
                    Worst case (slug):{" "}
                    <span className="font-mono text-red-300">
                      {(hp_sink_T + hp_power * 0.25).toFixed(1)}°C
                    </span>
                  </p>
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-5 text-xs text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground">Why vapor chambers win</p>
                <p>
                  Effective k ≈ 20,000 W/(m·K) vs. solid copper at 400 W/(m·K).
                  Phase-change (evaporation + condensation) transfers latent heat
                  500× more efficiently than conduction alone.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 3 — Vapor Chamber Efficiency Calculator
        ══════════════════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Wind className="w-5 h-5 text-violet-400" />
            <h2 className="text-xl font-semibold">3 · Vapor Chamber Spreading Resistance</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Calculator inputs */}
            <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Source (hotspot) area (mm²)
                </label>
                <div className="flex items-center justify-between mt-1 mb-1">
                  <span className="text-xs text-muted-foreground">10</span>
                  <span className="font-mono font-semibold text-violet-300">
                    {vc_sourceArea_mm2} mm²
                  </span>
                  <span className="text-xs text-muted-foreground">500</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={500}
                  step={10}
                  value={vc_sourceArea_mm2}
                  onChange={(e) => setVcSourceArea(parseInt(e.target.value))}
                  className="w-full accent-violet-400"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Total spreader area (mm²)
                </label>
                <div className="flex items-center justify-between mt-1 mb-1">
                  <span className="text-xs text-muted-foreground">500</span>
                  <span className="font-mono font-semibold text-violet-300">
                    {vc_totalArea_mm2} mm²
                  </span>
                  <span className="text-xs text-muted-foreground">10000</span>
                </div>
                <input
                  type="range"
                  min={500}
                  max={10000}
                  step={100}
                  value={vc_totalArea_mm2}
                  onChange={(e) => setVcTotalArea(parseInt(e.target.value))}
                  className="w-full accent-violet-400"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Power (W)
                </label>
                <div className="flex items-center justify-between mt-1 mb-1">
                  <span className="text-xs text-muted-foreground">10 W</span>
                  <span className="font-mono font-semibold text-yellow-300">
                    {vc_power_W} W
                  </span>
                  <span className="text-xs text-muted-foreground">600 W</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={600}
                  step={10}
                  value={vc_power_W}
                  onChange={(e) => setVcPower(parseInt(e.target.value))}
                  className="w-full accent-yellow-400"
                />
              </div>

              {/* Formula */}
              <div className="p-3 bg-muted/40 rounded-xl">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                  Spreading Resistance Formula
                </p>
                <p className="font-mono text-xs text-violet-300">
                  R_spread = 1 / (2 · k_eff · √(π · A_s))
                </p>
                <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                  <p>k_eff (vapor chamber) = {K_EFF_VAPOR.toLocaleString()} W/(m·K)</p>
                  <p>k (copper) = {K_COPPER} W/(m·K)</p>
                  <p>A_s = source area in m²</p>
                </div>
              </div>
            </div>

            {/* Results comparison */}
            <div className="space-y-4">
              {/* Visual comparison bars */}
              <div className="bg-card rounded-2xl border border-border p-6">
                <h3 className="text-sm font-semibold mb-4">Spreading Resistance Comparison</h3>

                {[
                  {
                    label: "Vapor Chamber",
                    k: K_EFF_VAPOR,
                    R: R_vc,
                    dT: dT_vc,
                    color: "#8b5cf6",
                    best: true,
                  },
                  {
                    label: "Solid Copper",
                    k: K_COPPER,
                    R: R_cu,
                    dT: dT_cu,
                    color: "#f59e0b",
                    best: false,
                  },
                ].map((item) => {
                  const barPct = Math.min(100, (item.R / R_cu) * 100);
                  return (
                    <div key={item.label} className="mb-4">
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                          {item.best && (
                            <span className="text-[10px] font-bold text-violet-400 bg-violet-400/15 px-1.5 py-0.5 rounded">
                              BEST
                            </span>
                          )}
                          <span className="text-sm font-medium">{item.label}</span>
                        </div>
                        <div className="text-right text-xs font-mono">
                          <span>R = {item.R.toFixed(5)} K/W</span>
                          <span
                            className="ml-3 font-semibold"
                            style={{ color: item.color }}
                          >
                            ΔT = {item.dT.toFixed(2)}°C
                          </span>
                        </div>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: item.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${barPct}%` }}
                          transition={{ duration: 0.7, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Reduction percentage */}
                <div
                  className={`mt-4 rounded-xl p-4 border ${
                    reduction_pct > 90
                      ? "border-green-500/40 bg-green-500/10"
                      : "border-violet-500/40 bg-violet-500/10"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="font-semibold text-sm">
                      ΔT reduced by{" "}
                      <span className="text-green-300 font-mono">
                        {reduction_pct.toFixed(1)}%
                      </span>
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Vapor chamber ΔT: {dT_vc.toFixed(2)}°C vs copper ΔT:{" "}
                    {dT_cu.toFixed(2)}°C at {vc_power_W} W
                  </p>
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-5 text-xs text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground">Physical Insight</p>
                <p>
                  The vapor chamber achieves k_eff = {(K_EFF_VAPOR / K_COPPER).toFixed(0)}× the
                  conductivity of copper by leveraging phase-change. Liquid evaporates at the
                  hotspot (absorbing latent heat ≈ 2.26 MJ/kg) and condenses across the entire
                  plate, redistributing heat with minimal temperature gradient.
                </p>
                <p>
                  Note: this formula uses the spreading source area A_s to compute resistance.
                  Smaller hotspots create steeper gradients — hence smaller A_s = higher R_spread.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 4 — Two-Phase Flow Regime Diagram
        ══════════════════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Droplets className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-semibold">4 · Two-Phase Flow Regimes</h2>
          </div>

          <div className="bg-card rounded-2xl border border-border p-6">
            {/* Regime pipeline visual */}
            <div className="mb-2">
              <p className="text-sm text-muted-foreground mb-4">
                As coolant heats along the channel, it transitions through distinct two-phase
                flow regimes — each with different heat transfer characteristics.
              </p>
            </div>

            {/* Pipeline bar */}
            <div className="relative h-16 flex rounded-xl overflow-hidden border border-border mb-6">
              {FLOW_REGIMES.map((regime, i) => (
                <div
                  key={regime.name}
                  className="flex items-center justify-center relative"
                  style={{
                    width: regime.width,
                    backgroundColor: regime.color + "33",
                    borderRight: i < FLOW_REGIMES.length - 1 ? `2px dashed ${regime.color}` : "none",
                  }}
                >
                  <span
                    className="font-semibold text-xs text-center leading-tight"
                    style={{ color: regime.color, textShadow: "0 0 8px rgba(0,0,0,0.8)" }}
                  >
                    {regime.name}
                  </span>
                  {/* Flow direction arrow at top */}
                  <div
                    className="absolute bottom-1 right-1 text-[10px] opacity-60"
                    style={{ color: regime.color }}
                  >
                    →
                  </div>
                </div>
              ))}
              {/* Temperature gradient overlay */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(to right, rgba(59,130,246,0.08), rgba(239,68,68,0.15))",
                }}
              />
            </div>

            {/* Detail cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {FLOW_REGIMES.map((regime) => (
                <div
                  key={regime.name}
                  className="rounded-xl border p-4"
                  style={{ borderColor: regime.color + "55", backgroundColor: regime.color + "0d" }}
                >
                  <p
                    className="font-semibold text-sm mb-3"
                    style={{ color: regime.color }}
                  >
                    {regime.name} Flow
                  </p>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Void fraction α</span>
                      <p className="font-mono text-foreground">{regime.voidFraction}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">HTC (W/m²·K)</span>
                      <p className="font-mono text-foreground">{regime.htc}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Notes</span>
                      <p className="text-muted-foreground leading-tight mt-0.5">
                        {regime.note}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Boiling onset formula */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-4 bg-muted/40 rounded-xl">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                  Onset of Nucleate Boiling (ONB)
                </p>
                <p className="font-mono text-sm text-cyan-300 mb-3">
                  ΔT_ONB = √(2 · q″ · σ · T_sat / (h_fg · ρ_v · k_l))
                </p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    <span className="font-mono text-foreground">q″</span> — wall heat
                    flux (W/m²)
                  </p>
                  <p>
                    <span className="font-mono text-foreground">σ</span> — liquid surface
                    tension ={" "}
                    <span className="font-mono">{SIGMA_WATER} N/m</span> (water @ 20°C)
                  </p>
                  <p>
                    <span className="font-mono text-foreground">T_sat</span> — saturation
                    temperature (K)
                  </p>
                  <p>
                    <span className="font-mono text-foreground">h_fg</span> — latent heat
                    of vaporisation ≈ 2.26 MJ/kg
                  </p>
                  <p>
                    <span className="font-mono text-foreground">ρ_v</span> — vapour
                    density at T_sat
                  </p>
                  <p>
                    <span className="font-mono text-foreground">k_l</span> — liquid
                    thermal conductivity ≈ 0.6 W/(m·K)
                  </p>
                </div>
              </div>

              <div className="p-4 bg-muted/40 rounded-xl text-xs text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground text-sm">
                  Why regime matters for chip cooling
                </p>
                <p>
                  <span className="text-violet-300 font-semibold">Annular</span> regime
                  offers the best heat transfer: a thin liquid film on the microchannel wall
                  evaporates efficiently. Engineers size flow rates to maintain annular flow
                  at the hottest channel sections.
                </p>
                <p>
                  <span className="text-red-300 font-semibold">Mist / dry-out</span> is
                  critical failure: the wall is exposed to vapour with very low HTC, causing
                  a sudden temperature spike — potentially destroying the chip within
                  milliseconds.
                </p>
                <p>
                  Two-phase cooling can achieve effective heat fluxes of{" "}
                  <span className="text-foreground font-mono">{">"} 1000 W/cm²</span> in annular
                  regime — far beyond single-phase liquid at ≈ 50–200 W/cm².
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════
            SECTION 5 — Pump Power vs. Flow Rate Trade-off
        ══════════════════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-yellow-400" />
            <h2 className="text-xl font-semibold">5 · Pump Power vs. Flow Rate Trade-off</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* SVG chart */}
            <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium">Pump Power vs. Flow Rate</p>
                  <p className="text-xs text-muted-foreground">
                    D_h = {D_h_mm} mm · L = {(L_CHANNEL * 1000).toFixed(0)} mm channel ·
                    η = 60%
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-sm bg-blue-400" />
                  <span className="text-muted-foreground">Pump power (W)</span>
                  <div className="ml-2 w-3 h-3 rounded-sm bg-green-400/40 border border-green-400" />
                  <span className="text-muted-foreground">Sweet spot</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <svg
                  width={svgW}
                  height={svgH}
                  className="w-full max-w-full"
                  viewBox={`0 0 ${svgW} ${svgH}`}
                >
                  {/* Sweet spot highlight */}
                  <rect
                    x={sweetSpotX1}
                    y={svgPad.top}
                    width={sweetSpotX2 - sweetSpotX1}
                    height={chartH}
                    fill="#22c55e"
                    fillOpacity={0.08}
                    stroke="#22c55e"
                    strokeOpacity={0.3}
                    strokeWidth={1}
                    strokeDasharray="4 3"
                  />
                  <text
                    x={(sweetSpotX1 + sweetSpotX2) / 2}
                    y={svgPad.top + 14}
                    fill="#4ade80"
                    fontSize={10}
                    textAnchor="middle"
                    opacity={0.85}
                  >
                    Sweet Spot
                  </text>

                  {/* Grid lines */}
                  {yTicks.map((t) => (
                    <line
                      key={t}
                      x1={svgPad.left}
                      x2={svgW - svgPad.right}
                      y1={toY(t)}
                      y2={toY(t)}
                      stroke="#334155"
                      strokeWidth={1}
                    />
                  ))}
                  {xTicks.map((t) => (
                    <line
                      key={t}
                      x1={toX(t)}
                      x2={toX(t)}
                      y1={svgPad.top}
                      y2={svgPad.top + chartH}
                      stroke="#334155"
                      strokeWidth={1}
                    />
                  ))}

                  {/* Pump curve path */}
                  <path
                    d={pumpPath}
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth={2.5}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />

                  {/* Current operating point */}
                  {(() => {
                    const cur = pumpCurvePoints.find(
                      (p) => Math.abs(p.Q_Lmin - flowRate_Lmin) < 0.15
                    );
                    if (!cur) return null;
                    return (
                      <>
                        <circle
                          cx={toX(cur.Q_Lmin)}
                          cy={toY(cur.P_pump)}
                          r={6}
                          fill="#fbbf24"
                          stroke="#fff"
                          strokeWidth={1.5}
                        />
                        <text
                          x={toX(cur.Q_Lmin) + 9}
                          y={toY(cur.P_pump) - 4}
                          fill="#fbbf24"
                          fontSize={10}
                        >
                          {cur.P_pump.toFixed(2)} W
                        </text>
                      </>
                    );
                  })()}

                  {/* Axes */}
                  <line
                    x1={svgPad.left}
                    x2={svgPad.left}
                    y1={svgPad.top}
                    y2={svgPad.top + chartH}
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                  />
                  <line
                    x1={svgPad.left}
                    x2={svgW - svgPad.right}
                    y1={svgPad.top + chartH}
                    y2={svgPad.top + chartH}
                    stroke="#94a3b8"
                    strokeWidth={1.5}
                  />

                  {/* Y-axis labels */}
                  {yTicks.map((t) => (
                    <text
                      key={t}
                      x={svgPad.left - 6}
                      y={toY(t) + 4}
                      fill="#94a3b8"
                      fontSize={10}
                      textAnchor="end"
                    >
                      {t.toFixed(2)}
                    </text>
                  ))}

                  {/* X-axis labels */}
                  {xTicks.map((t) => (
                    <text
                      key={t}
                      x={toX(t)}
                      y={svgPad.top + chartH + 14}
                      fill="#94a3b8"
                      fontSize={10}
                      textAnchor="middle"
                    >
                      {t}
                    </text>
                  ))}

                  {/* Axis labels */}
                  <text
                    x={svgPad.left + chartW / 2}
                    y={svgH - 2}
                    fill="#64748b"
                    fontSize={11}
                    textAnchor="middle"
                  >
                    Flow Rate (L/min)
                  </text>
                  <text
                    x={10}
                    y={svgPad.top + chartH / 2}
                    fill="#64748b"
                    fontSize={11}
                    textAnchor="middle"
                    transform={`rotate(-90, 10, ${svgPad.top + chartH / 2})`}
                  >
                    Pump Power (W)
                  </text>
                </svg>
              </div>

              {/* Darcy-Weisbach formula */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <div className="p-3 bg-muted/40 rounded-xl">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                    Pressure Drop (Darcy-Weisbach)
                  </p>
                  <p className="font-mono text-xs text-blue-300">
                    ΔP = f · (L/D_h) · (ρ·v²/2)
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    f = 64/Re (laminar, Re &lt; 2300)
                    <br />
                    f = 0.316·Re^(−0.25) (turbulent)
                  </p>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                    Pump Power
                  </p>
                  <p className="font-mono text-xs text-yellow-300">
                    P_pump = ΔP · Q / η
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    η = pump efficiency = 60%
                    <br />
                    Q = volumetric flow (m³/s)
                  </p>
                </div>
              </div>
            </div>

            {/* Side controls */}
            <div className="space-y-4">
              {/* D_h selector */}
              <div className="bg-card rounded-2xl border border-border p-5">
                <h3 className="text-sm font-semibold mb-4">
                  Hydraulic Diameter D_h
                </h3>
                <div className="flex gap-2">
                  {[0.5, 1.0, 2.0].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDhMm(d)}
                      className={`flex-1 py-2 rounded-lg text-sm font-mono transition-colors ${
                        D_h_mm === d
                          ? "bg-blue-500/20 border border-blue-500/50 text-blue-300"
                          : "bg-muted text-muted-foreground hover:text-foreground border border-transparent"
                      }`}
                    >
                      {d} mm
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Smaller D_h → higher Re → higher ΔP but also higher heat transfer
                  coefficient (Nu ∝ 1/D_h for laminar flow).
                </p>
              </div>

              {/* Live metrics for current flow rate */}
              {(() => {
                const Q_m3s = (flowRate_Lmin / 60) * 1e-3;
                const Q_per_ch = Q_m3s / NUM_CHANNELS;
                const v = Q_per_ch / A_ch_m2;
                const Re = (RHO_WATER * v * D_h_m) / MU_WATER;
                const dP = pressureDrop(D_h_m, L_CHANNEL, v);
                const P_p = pumpPower(dP, Q_m3s);
                const regime = Re < 2300 ? "Laminar" : "Turbulent";
                return (
                  <div className="bg-card rounded-2xl border border-border p-5">
                    <h3 className="text-sm font-semibold mb-3">
                      Current Operating Point
                    </h3>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Flow rate</span>
                        <span className="font-mono">{flowRate_Lmin.toFixed(1)} L/min</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Velocity / channel</span>
                        <span className="font-mono">{v.toFixed(2)} m/s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Reynolds number</span>
                        <span className={`font-mono ${Re > 2300 ? "text-yellow-400" : "text-blue-400"}`}>
                          {Re.toFixed(0)} ({regime})
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pressure drop</span>
                        <span className="font-mono">{(dP / 1000).toFixed(2)} kPa</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground font-semibold">Pump power</span>
                        <span className="font-mono font-semibold text-yellow-300">
                          {P_p.toFixed(3)} W
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">COP (Q_chip/P_pump)</span>
                        <span className="font-mono text-green-300">
                          {(chipPower_W / (P_p + 1e-9)).toFixed(0)}×
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="bg-card rounded-2xl border border-border p-5 text-xs text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground">Sweet Spot Logic</p>
                <p>
                  At low flow rates, chip ΔT is high. At high flow rates, pump power
                  dominates system energy budget. The sweet spot (1–3 L/min for typical
                  cold plates) maximises cooling per watt of pumping energy — the
                  hydraulic COP.
                </p>
                <p>
                  For data-centre AI chips drawing 400–700 W, liquid cooling adds only
                  1–5 W of pump power — a tiny overhead vs. air cooling fans at 20–80 W.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer note ── */}
        <div className="border-t border-border pt-6 text-xs text-muted-foreground text-center">
          Round 6 · Fluid Dynamics for Chip Cooling — All calculations use first-principles
          physics: Darcy-Weisbach, energy balance, spreading resistance, and two-phase
          flow correlations. Values are approximate for educational purposes.
        </div>
      </div>
    </div>
  );
}
