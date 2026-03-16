"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Atom,
  Layers,
  Zap,
  AlertTriangle,
  CheckCircle,
  Info,
  Activity,
  ChevronRight,
} from "lucide-react";

// ── Physics constants ─────────────────────────────────────────────────────────

const MU_COX = 200e-6; // A/V²
const VDS_MAX = 2.5;   // V
const EPS0 = 8.854e-12; // F/m
const K_B = 8.617e-5;  // eV/K
const A_SUB = 1e-10;   // A/µm
const N_FACTOR = 1.3;

// ── Typed helpers & data ──────────────────────────────────────────────────────

interface TechNode {
  node: string;
  lg: number;
  vdd: number;
  tox: number;
  vth: number;
}

const TECH_NODES: TechNode[] = [
  { node: "180nm", lg: 180, vdd: 1.8,  tox: 4.0, vth: 0.5  },
  { node: "130nm", lg: 130, vdd: 1.5,  tox: 3.0, vth: 0.45 },
  { node: "90nm",  lg: 90,  vdd: 1.2,  tox: 2.2, vth: 0.4  },
  { node: "65nm",  lg: 65,  vdd: 1.1,  tox: 1.8, vth: 0.38 },
  { node: "45nm",  lg: 45,  vdd: 1.0,  tox: 1.4, vth: 0.35 },
  { node: "28nm",  lg: 28,  vdd: 0.9,  tox: 1.1, vth: 0.33 },
  { node: "14nm",  lg: 14,  vdd: 0.8,  tox: 0.9, vth: 0.30 },
  { node: "7nm",   lg: 7,   vdd: 0.75, tox: 0.7, vth: 0.28 },
  { node: "3nm",   lg: 3,   vdd: 0.7,  tox: 0.5, vth: 0.25 },
];

// Overdrive colors for MOSFET curves
const OD_COLORS = ["#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#a855f7"];
const OD_VALUES = [0.4, 0.6, 0.8, 1.0, 1.2]; // Vgs - Vth overdrive

function computeIv(wl: number, vth: number): { vds: number; id: number }[][] {
  return OD_VALUES.map((od) => {
    const vgs = vth + od;
    const points: { vds: number; id: number }[] = [];
    for (let i = 0; i <= 40; i++) {
      const vds = (i / 40) * VDS_MAX;
      const vov = vgs - vth;
      let id: number;
      if (vds < vov) {
        id = MU_COX * wl * (vov * vds - (vds * vds) / 2);
      } else {
        id = (MU_COX * wl * vov * vov) / 2;
      }
      points.push({ vds, id });
    }
    return points;
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProcessTechPage() {
  // Section 1: MOSFET I-V
  const [wl, setWl] = useState(10);
  const [vth, setVth] = useState(0.4);

  // Section 2: Tech node scaling
  const [selectedNode, setSelectedNode] = useState(5);

  // Section 3: FinFET
  const [wfin, setWfin] = useState(8);
  const [hfin, setHfin] = useState(35);

  // Section 4: Doping
  const [logNpeak, setLogNpeak] = useState(18);
  const [xj, setXj] = useState(80);

  // Section 5: Leakage
  const [tempC, setTempC] = useState(27);
  const [vthLeak, setVthLeak] = useState(0.4);

  // ── Section 1 computations ──────────────────────────────────────────────────

  const ivCurves = computeIv(wl, vth);
  const idMax = (MU_COX * wl * 1.2 * 1.2) / 2; // at 1.2V overdrive
  const gm = MU_COX * wl * 1.0; // at 1.0V overdrive

  // SVG helpers for I-V chart
  const IV_W = 320;
  const IV_H = 200;
  const IV_PAD_L = 52;
  const IV_PAD_B = 32;
  const IV_PAD_T = 12;
  const IV_PAD_R = 12;
  const IV_INNER_W = IV_W - IV_PAD_L - IV_PAD_R;
  const IV_INNER_H = IV_H - IV_PAD_T - IV_PAD_B;

  const idMaxChart = (MU_COX * wl * 1.2 * 1.2) / 2 * 1.1;

  function ivToSvgX(vds: number): number {
    return IV_PAD_L + (vds / VDS_MAX) * IV_INNER_W;
  }
  function ivToSvgY(id: number): number {
    return IV_PAD_T + IV_INNER_H - (id / idMaxChart) * IV_INNER_H;
  }

  // ── Section 2 computations ──────────────────────────────────────────────────

  const node = TECH_NODES[selectedNode];
  const W_NM = 100; // fixed width 100nm for Cgate
  const cGate = EPS0 * 3.9 * (W_NM * 1e-9) * (node.lg * 1e-9) / (node.tox * 1e-9); // F
  const cGateFF = cGate * 1e15; // fF
  const refNode = TECH_NODES[0]; // 180nm reference

  // Normalized bar values (relative to 180nm)
  const scalingBars: { label: string; value: number; color: string }[] = [
    { label: "Lg", value: node.lg / refNode.lg, color: "#8b5cf6" },
    { label: "Vdd", value: node.vdd / refNode.vdd, color: "#3b82f6" },
    { label: "tox", value: node.tox / refNode.tox, color: "#14b8a6" },
  ];

  // Delay ∝ C*Vdd / Id_on (Id_on = MU_COX*(W/L)/2*(Vdd-Vth)^2 with W/L=10)
  const idOn = (MU_COX * 10 * Math.pow(node.vdd - node.vth, 2)) / 2;
  const delay = cGate * node.vdd / idOn; // arbitrary units
  const idOnRef = (MU_COX * 10 * Math.pow(refNode.vdd - refNode.vth, 2)) / 2;
  const cGateRef = EPS0 * 3.9 * (W_NM * 1e-9) * (refNode.lg * 1e-9) / (refNode.tox * 1e-9);
  const delayRef = cGateRef * refNode.vdd / idOnRef;
  const delayNorm = delay / delayRef;

  // ── Section 3 computations ──────────────────────────────────────────────────

  const weff = 2 * hfin + wfin; // nm
  const weffRef = 2 * 35 + 8; // default reference
  const iDriveNorm = weff / weffRef;
  const finFetGood = wfin < 10;

  // SVG helpers for FinFET
  const FIN_W = 280;
  const FIN_H = 220;

  // ── Section 4 computations ──────────────────────────────────────────────────

  const nPeak = Math.pow(10, logNpeak);
  const sigma = xj / 3;

  function doping(x: number): number {
    return nPeak * Math.exp(-(x * x) / (2 * sigma * sigma)) + 1e15;
  }

  // Depletion width: sqrt(2*eps_Si*Vbi / (q*N_bg))
  const WD_CM = Math.sqrt((2 * 1.04e-12 * 0.7) / (1.6e-19 * 1e15));
  const WD_NM = WD_CM * 1e7; // cm → nm

  // SVG helpers for doping profile
  const DP_W = 320;
  const DP_H = 200;
  const DP_PAD_L = 52;
  const DP_PAD_B = 32;
  const DP_PAD_T = 12;
  const DP_PAD_R = 12;
  const DP_INNER_W = DP_W - DP_PAD_L - DP_PAD_R;
  const DP_INNER_H = DP_H - DP_PAD_T - DP_PAD_B;
  const DP_DEPTH_MAX = 300; // nm
  const DP_LOG_MIN = 14;
  const DP_LOG_MAX = 21;

  function dpToSvgX(x_nm: number): number {
    return DP_PAD_L + (x_nm / DP_DEPTH_MAX) * DP_INNER_W;
  }
  function dpToSvgY(n: number): number {
    const logN = Math.log10(Math.max(n, 1e13));
    const frac = (logN - DP_LOG_MIN) / (DP_LOG_MAX - DP_LOG_MIN);
    return DP_PAD_T + DP_INNER_H - frac * DP_INNER_H;
  }

  const dopingPoints: { x: number; y: number }[] = [];
  for (let i = 0; i <= 100; i++) {
    const x = (i / 100) * DP_DEPTH_MAX;
    const n = doping(x);
    dopingPoints.push({ x: dpToSvgX(x), y: dpToSvgY(n) });
  }
  const dopingPolyline = dopingPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // ── Section 5 computations ──────────────────────────────────────────────────

  const VT = K_B * (tempC + 273.15); // eV (used as V in exp)
  const iSubPerUm = A_SUB * Math.exp(-vthLeak / (N_FACTOR * VT)); // A/µm
  const iSubMA = iSubPerUm * 1000; // multiply by 1000µm width → mA
  const sSlope = N_FACTOR * VT * Math.log(10) * 1000; // mV/dec
  const iGate = 1e-12 * Math.exp(-20 * vthLeak); // A/µm
  const iJunct = 5e-13 * Math.exp(tempC / 30); // A/µm
  const iTotal = iSubPerUm + iGate + iJunct; // A/µm total
  const leakageWcm2 = iTotal * 1e4 * 0.9; // W/cm²
  const leakageTooHigh = leakageWcm2 > 1;

  // Log-normalize bars for display (0..100%)
  function logNorm(val: number, refMax: number): number {
    if (val <= 0) return 0;
    const logVal = Math.log10(val + 1e-30);
    const logMax = Math.log10(refMax + 1e-30);
    const logMin = logMax - 10;
    return Math.min(100, Math.max(0, ((logVal - logMin) / (logMax - logMin)) * 100));
  }
  const leakMaxRef = A_SUB * 1000; // A reference for normalization
  const subBar = logNorm(iSubMA * 1e-3, leakMaxRef);
  const gateBar = logNorm(iGate, leakMaxRef);
  const junctBar = logNorm(iJunct, leakMaxRef);

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <Atom className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Process Technology</h1>
              <p className="text-muted-foreground mt-1">
                CMOS scaling, transistor physics, FinFET, doping profiles, and leakage analysis
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* ── Section 1: MOSFET I-V Curves ─────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-semibold">MOSFET I-V Curves</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Controls */}
            <div className="space-y-5">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  W/L Ratio: <span className="font-mono text-foreground">{wl}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={wl}
                  onChange={(e) => setWl(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>1</span><span>20</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  Threshold Voltage: <span className="font-mono text-foreground">{vth.toFixed(2)} V</span>
                </label>
                <input
                  type="range"
                  min={0.2}
                  max={0.8}
                  step={0.01}
                  value={vth}
                  onChange={(e) => setVth(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0.2 V</span><span>0.8 V</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">I_D(sat) Formula</p>
                  <p className="font-mono text-sm">I_D = μCox·(W/L)/2·(Vgs−Vth)²</p>
                  <p className="text-xs text-muted-foreground mt-1">Drain current in saturation region</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted/20 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">I_D max (1.2V OD)</p>
                    <p className="font-mono text-violet-400">{(idMax * 1e3).toFixed(2)} mA</p>
                  </div>
                  <div className="bg-muted/20 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">g_m (1.0V OD)</p>
                    <p className="font-mono text-violet-400">{(gm * 1e3).toFixed(2)} mS</p>
                  </div>
                </div>

                <div className="flex flex-col gap-1 mt-2">
                  {OD_VALUES.map((od, i) => (
                    <div key={od} className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-0.5 rounded" style={{ backgroundColor: OD_COLORS[i] }} />
                      <span className="text-muted-foreground">Vgs = Vth + {od}V</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SVG Chart */}
            <div className="lg:col-span-2">
              <svg
                viewBox={`0 0 ${IV_W} ${IV_H}`}
                className="w-full"
                style={{ maxHeight: 220 }}
              >
                {/* Axes */}
                <line
                  x1={IV_PAD_L} y1={IV_PAD_T}
                  x2={IV_PAD_L} y2={IV_PAD_T + IV_INNER_H}
                  stroke="#555" strokeWidth={1}
                />
                <line
                  x1={IV_PAD_L} y1={IV_PAD_T + IV_INNER_H}
                  x2={IV_PAD_L + IV_INNER_W} y2={IV_PAD_T + IV_INNER_H}
                  stroke="#555" strokeWidth={1}
                />

                {/* X-axis ticks & labels */}
                {[0, 0.5, 1.0, 1.5, 2.0, 2.5].map((v) => (
                  <g key={v}>
                    <line
                      x1={ivToSvgX(v)} y1={IV_PAD_T + IV_INNER_H}
                      x2={ivToSvgX(v)} y2={IV_PAD_T + IV_INNER_H + 4}
                      stroke="#555" strokeWidth={1}
                    />
                    <text
                      x={ivToSvgX(v)} y={IV_H - 4}
                      textAnchor="middle" fontSize={9} fill="#888"
                    >
                      {v}
                    </text>
                  </g>
                ))}

                {/* Y-axis ticks */}
                {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
                  const id = frac * idMaxChart;
                  const y = ivToSvgY(id);
                  return (
                    <g key={frac}>
                      <line
                        x1={IV_PAD_L - 4} y1={y}
                        x2={IV_PAD_L} y2={y}
                        stroke="#555" strokeWidth={1}
                      />
                      <text
                        x={IV_PAD_L - 6} y={y + 3}
                        textAnchor="end" fontSize={8} fill="#888"
                      >
                        {(id * 1e3).toFixed(1)}
                      </text>
                    </g>
                  );
                })}

                {/* Axis labels */}
                <text x={IV_PAD_L + IV_INNER_W / 2} y={IV_H} textAnchor="middle" fontSize={9} fill="#aaa">
                  V_DS (V)
                </text>
                <text
                  x={10} y={IV_PAD_T + IV_INNER_H / 2}
                  textAnchor="middle" fontSize={9} fill="#aaa"
                  transform={`rotate(-90, 10, ${IV_PAD_T + IV_INNER_H / 2})`}
                >
                  I_D (mA)
                </text>

                {/* I-V curves */}
                {ivCurves.map((curve, ci) => {
                  const pts = curve.map((p) => `${ivToSvgX(p.vds)},${ivToSvgY(p.id)}`).join(" ");
                  return (
                    <polyline
                      key={ci}
                      points={pts}
                      fill="none"
                      stroke={OD_COLORS[ci]}
                      strokeWidth={1.5}
                    />
                  );
                })}

                {/* Saturation boundary dashes */}
                {OD_VALUES.map((od, ci) => {
                  const vov = od;
                  if (vov > VDS_MAX) return null;
                  const x = ivToSvgX(vov);
                  const idSat = (MU_COX * wl * vov * vov) / 2;
                  const y = ivToSvgY(idSat);
                  return (
                    <line
                      key={ci}
                      x1={x} y1={IV_PAD_T + IV_INNER_H}
                      x2={x} y2={y}
                      stroke={OD_COLORS[ci]}
                      strokeWidth={0.8}
                      strokeDasharray="3,2"
                      opacity={0.6}
                    />
                  );
                })}
              </svg>
              <p className="text-xs text-muted-foreground text-center mt-1">
                Dashed lines mark saturation boundary (V_DS = V_GS − V_th) for each curve
              </p>
            </div>
          </div>
        </div>

        {/* ── Section 2: Technology Node Scaling ───────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-semibold">Technology Node Scaling</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Node selector grid */}
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Select technology node:</p>
              <div className="grid grid-cols-3 gap-2">
                {TECH_NODES.map((n, i) => (
                  <button
                    key={n.node}
                    onClick={() => setSelectedNode(i)}
                    className={`py-2 px-1 text-xs font-mono rounded-lg border transition-all ${
                      selectedNode === i
                        ? "border-violet-500 bg-violet-500/20 text-violet-300"
                        : "border-border bg-muted/20 text-muted-foreground hover:border-violet-500/50"
                    }`}
                  >
                    {n.node}
                  </button>
                ))}
              </div>

              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">C_gate Formula</p>
                <p className="font-mono text-sm">C = ε₀εᵣ·W·L / t_ox</p>
                <p className="text-xs text-muted-foreground mt-1">Gate capacitance with 100nm width</p>
              </div>
            </div>

            {/* Detail panel */}
            <div className="space-y-3">
              <div className="bg-violet-500/10 border border-violet-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ChevronRight className="w-4 h-4 text-violet-400" />
                  <span className="font-semibold text-violet-300">{node.node} Node</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gate length L_g</span>
                    <span className="font-mono">{node.lg} nm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Supply voltage V_dd</span>
                    <span className="font-mono">{node.vdd} V</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Oxide thickness t_ox</span>
                    <span className="font-mono">{node.tox} nm</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Threshold V_th</span>
                    <span className="font-mono">{node.vth} V</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="text-muted-foreground">C_gate</span>
                    <span className="font-mono text-violet-400">{cGateFF.toFixed(3)} fF</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delay (normalized)</span>
                    <span className="font-mono text-violet-400">{delayNorm.toFixed(3)}×</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bar chart */}
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Normalized to 180nm node:</p>
              {scalingBars.map((bar) => (
                <div key={bar.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{bar.label}</span>
                    <span className="font-mono">{(bar.value * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-5 bg-muted/30 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: bar.color }}
                      animate={{ width: `${Math.min(bar.value * 100, 100)}%` }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-2">
                All parameters decrease with scaling — shorter gate, lower voltage, thinner oxide.
              </p>
            </div>
          </div>
        </div>

        {/* ── Section 3: FinFET 3D Visualizer ─────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-semibold">FinFET 3D Visualizer</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Controls */}
            <div className="space-y-5">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  Fin Width W_fin: <span className="font-mono text-foreground">{wfin} nm</span>
                </label>
                <input
                  type="range"
                  min={5}
                  max={15}
                  step={1}
                  value={wfin}
                  onChange={(e) => setWfin(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>5 nm</span><span>15 nm</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  Fin Height H_fin: <span className="font-mono text-foreground">{hfin} nm</span>
                </label>
                <input
                  type="range"
                  min={20}
                  max={50}
                  step={1}
                  value={hfin}
                  onChange={(e) => setHfin(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>20 nm</span><span>50 nm</span>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">W_eff Formula</p>
                <p className="font-mono text-sm">W_eff = 2·H_fin + W_fin</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Gate wraps three sides of the fin
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted/20 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground">W_eff</p>
                  <p className="font-mono text-violet-400">{weff} nm</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground">I_drive</p>
                  <p className="font-mono text-violet-400">{(iDriveNorm * 100).toFixed(0)}%</p>
                </div>
              </div>

              {/* Drive current bar */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Drive current (normalized):</p>
                <div className="h-4 bg-muted/30 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-green-500"
                    animate={{ width: `${Math.min(iDriveNorm * 100, 150)}%` }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    style={{ maxWidth: "100%" }}
                  />
                </div>
              </div>

              {/* Status badge */}
              {finFetGood ? (
                <div className="flex items-start gap-2 border border-green-500/40 bg-green-500/10 rounded-lg p-3">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-green-300">
                    W_fin = {wfin} nm — Fully depleted channel. Excellent short-channel control.
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-2 border border-red-500/40 bg-red-500/10 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-300">
                    W_fin = {wfin} nm — Short channel effects possible. Consider narrowing fin.
                  </p>
                </div>
              )}
            </div>

            {/* SVG FinFET diagram */}
            <div className="lg:col-span-2 flex justify-center">
              <svg viewBox={`0 0 ${FIN_W} ${FIN_H}`} className="w-full" style={{ maxHeight: 260 }}>
                {/* Substrate */}
                <rect x={30} y={170} width={220} height={30} rx={3} fill="#374151" stroke="#555" strokeWidth={1} />
                <text x={140} y={190} textAnchor="middle" fontSize={10} fill="#9ca3af">Substrate (p-Si)</text>

                {/* Fin body */}
                {(() => {
                  const finDisplayW = Math.max(8, wfin * 2.2);
                  const finDisplayH = Math.max(30, hfin * 2.0);
                  const finX = 140 - finDisplayW / 2;
                  const finY = 170 - finDisplayH;
                  return (
                    <g>
                      {/* Fin silicon */}
                      <rect
                        x={finX} y={finY}
                        width={finDisplayW} height={finDisplayH}
                        fill="#7dd3fc" stroke="#38bdf8" strokeWidth={1.5}
                        rx={1}
                      />

                      {/* Gate oxide (yellow border on top and sides) */}
                      <rect
                        x={finX - 4} y={finY - 4}
                        width={finDisplayW + 8} height={finDisplayH + 4}
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth={3}
                        rx={2}
                      />

                      {/* Polysilicon gate (wrapping top + sides) */}
                      <rect
                        x={finX - 14} y={finY - 16}
                        width={finDisplayW + 28} height={finDisplayH + 10}
                        fill="#6b7280"
                        fillOpacity={0.5}
                        stroke="#9ca3af"
                        strokeWidth={1}
                        rx={3}
                      />
                      <text x={140} y={finY - 22} textAnchor="middle" fontSize={9} fill="#d1d5db">
                        Polysilicon Gate
                      </text>

                      {/* Oxide label */}
                      <text x={finX - 20} y={finY + finDisplayH / 2 + 4} textAnchor="end" fontSize={8} fill="#fbbf24">
                        SiO₂
                      </text>

                      {/* Fin label */}
                      <text x={140} y={finY + finDisplayH / 2 + 4} textAnchor="middle" fontSize={8} fill="#1e3a5f">
                        Si Fin
                      </text>

                      {/* Wfin arrow */}
                      <line x1={finX} y1={finY + finDisplayH + 10} x2={finX + finDisplayW} y2={finY + finDisplayH + 10}
                        stroke="#a78bfa" strokeWidth={1} markerEnd="url(#arr)" />
                      <text x={140} y={finY + finDisplayH + 24} textAnchor="middle" fontSize={9} fill="#a78bfa">
                        W_fin = {wfin} nm
                      </text>

                      {/* Hfin arrow */}
                      <line x1={finX + finDisplayW + 18} y1={finY} x2={finX + finDisplayW + 18} y2={finY + finDisplayH}
                        stroke="#34d399" strokeWidth={1} />
                      <text
                        x={finX + finDisplayW + 22} y={finY + finDisplayH / 2}
                        fontSize={9} fill="#34d399"
                        transform={`rotate(90, ${finX + finDisplayW + 22}, ${finY + finDisplayH / 2})`}
                        textAnchor="middle"
                      >
                        H_fin = {hfin} nm
                      </text>
                    </g>
                  );
                })()}

                {/* Source / Drain labels */}
                <text x={50} y={140} fontSize={10} fill="#9ca3af">Source</text>
                <text x={210} y={140} fontSize={10} fill="#9ca3af">Drain</text>

                {/* W_eff annotation */}
                <text x={140} y={215} textAnchor="middle" fontSize={8} fill="#c4b5fd">
                  W_eff = 2·{hfin} + {wfin} = {weff} nm
                </text>
              </svg>
            </div>
          </div>
        </div>

        {/* ── Section 4: Doping Profile Simulator ─────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-semibold">Doping Profile Simulator</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Controls */}
            <div className="space-y-5">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  Peak Doping: <span className="font-mono text-foreground">10^{logNpeak} cm⁻³</span>
                </label>
                <input
                  type="range"
                  min={16}
                  max={20}
                  step={0.1}
                  value={logNpeak}
                  onChange={(e) => setLogNpeak(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>10¹⁶</span><span>10²⁰</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  Junction Depth x_j: <span className="font-mono text-foreground">{xj} nm</span>
                </label>
                <input
                  type="range"
                  min={10}
                  max={200}
                  step={1}
                  value={xj}
                  onChange={(e) => setXj(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>10 nm</span><span>200 nm</span>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Doping Formula</p>
                <p className="font-mono text-sm">N(x) = N_peak·exp(−x²/2σ²) + N_bg</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Gaussian implant profile with σ = x_j/3
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Junction depth x_j</span>
                  <span className="font-mono text-violet-400">{xj} nm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Depletion width W_d</span>
                  <span className="font-mono text-violet-400">{WD_NM.toFixed(1)} nm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Peak doping N_peak</span>
                  <span className="font-mono text-violet-400">10^{logNpeak.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Background N_bg</span>
                  <span className="font-mono">10¹⁵ cm⁻³</span>
                </div>
              </div>
            </div>

            {/* SVG Doping Chart */}
            <div className="lg:col-span-2">
              <svg viewBox={`0 0 ${DP_W} ${DP_H}`} className="w-full" style={{ maxHeight: 220 }}>
                {/* Axes */}
                <line
                  x1={DP_PAD_L} y1={DP_PAD_T}
                  x2={DP_PAD_L} y2={DP_PAD_T + DP_INNER_H}
                  stroke="#555" strokeWidth={1}
                />
                <line
                  x1={DP_PAD_L} y1={DP_PAD_T + DP_INNER_H}
                  x2={DP_PAD_L + DP_INNER_W} y2={DP_PAD_T + DP_INNER_H}
                  stroke="#555" strokeWidth={1}
                />

                {/* X-axis ticks */}
                {[0, 50, 100, 150, 200, 250, 300].map((x) => (
                  <g key={x}>
                    <line
                      x1={dpToSvgX(x)} y1={DP_PAD_T + DP_INNER_H}
                      x2={dpToSvgX(x)} y2={DP_PAD_T + DP_INNER_H + 4}
                      stroke="#555" strokeWidth={1}
                    />
                    <text
                      x={dpToSvgX(x)} y={DP_H - 4}
                      textAnchor="middle" fontSize={8} fill="#888"
                    >
                      {x}
                    </text>
                  </g>
                ))}

                {/* Y-axis log ticks */}
                {[14, 15, 16, 17, 18, 19, 20, 21].map((exp) => {
                  const y = dpToSvgY(Math.pow(10, exp));
                  return (
                    <g key={exp}>
                      <line
                        x1={DP_PAD_L - 4} y1={y}
                        x2={DP_PAD_L} y2={y}
                        stroke="#555" strokeWidth={1}
                      />
                      <text
                        x={DP_PAD_L - 6} y={y + 3}
                        textAnchor="end" fontSize={8} fill="#888"
                      >
                        10^{exp}
                      </text>
                    </g>
                  );
                })}

                {/* Axis labels */}
                <text
                  x={DP_PAD_L + DP_INNER_W / 2} y={DP_H}
                  textAnchor="middle" fontSize={9} fill="#aaa"
                >
                  Depth (nm)
                </text>
                <text
                  x={9} y={DP_PAD_T + DP_INNER_H / 2}
                  textAnchor="middle" fontSize={9} fill="#aaa"
                  transform={`rotate(-90, 9, ${DP_PAD_T + DP_INNER_H / 2})`}
                >
                  N (cm⁻³)
                </text>

                {/* Doping polyline */}
                <polyline
                  points={dopingPolyline}
                  fill="none"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                />

                {/* Background doping dashed line */}
                <line
                  x1={DP_PAD_L} y1={dpToSvgY(1e15)}
                  x2={DP_PAD_L + DP_INNER_W} y2={dpToSvgY(1e15)}
                  stroke="#fbbf24" strokeWidth={1} strokeDasharray="4,3"
                />
                <text
                  x={DP_PAD_L + DP_INNER_W - 2} y={dpToSvgY(1e15) - 3}
                  textAnchor="end" fontSize={8} fill="#fbbf24"
                >
                  N_bg
                </text>

                {/* Junction depth dashed vertical */}
                {xj <= DP_DEPTH_MAX && (
                  <>
                    <line
                      x1={dpToSvgX(xj)} y1={DP_PAD_T}
                      x2={dpToSvgX(xj)} y2={DP_PAD_T + DP_INNER_H}
                      stroke="#34d399" strokeWidth={1} strokeDasharray="4,3"
                    />
                    <text
                      x={dpToSvgX(xj) + 3} y={DP_PAD_T + 12}
                      fontSize={8} fill="#34d399"
                    >
                      x_j = {xj} nm
                    </text>
                  </>
                )}
              </svg>
              <p className="text-xs text-muted-foreground text-center mt-1">
                Yellow dashed: background 10¹⁵ cm⁻³ · Green dashed: junction depth x_j
              </p>
            </div>
          </div>
        </div>

        {/* ── Section 5: Leakage Power Analysis ───────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-semibold">Leakage Power Analysis</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Controls */}
            <div className="space-y-5">
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  Temperature: <span className="font-mono text-foreground">{tempC}°C</span>
                </label>
                <input
                  type="range"
                  min={-40}
                  max={125}
                  step={1}
                  value={tempC}
                  onChange={(e) => setTempC(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>−40°C</span><span>125°C</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  Threshold Voltage: <span className="font-mono text-foreground">{vthLeak.toFixed(2)} V</span>
                </label>
                <input
                  type="range"
                  min={0.2}
                  max={0.8}
                  step={0.01}
                  value={vthLeak}
                  onChange={(e) => setVthLeak(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0.2 V</span><span>0.8 V</span>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Subthreshold Leakage</p>
                <p className="font-mono text-sm">I_sub = A·exp(−Vth / (n·VT))</p>
                <p className="text-xs text-muted-foreground mt-1">
                  VT = kT/q = {(VT * 1000).toFixed(2)} mV at {tempC}°C
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">V_T = kT/q</span>
                  <span className="font-mono">{(VT * 1000).toFixed(2)} mV</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">S slope</span>
                  <span className="font-mono">{sSlope.toFixed(1)} mV/dec</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total leakage</span>
                  <span className={`font-mono ${leakageTooHigh ? "text-red-400" : "text-green-400"}`}>
                    {leakageWcm2.toFixed(3)} W/cm²
                  </span>
                </div>
              </div>

              {leakageTooHigh ? (
                <div className="flex items-start gap-2 border border-red-500/40 bg-red-500/10 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-300">
                    Leakage exceeds 1 W/cm² — high standby power. Increase V_th or reduce temperature.
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-2 border border-green-500/40 bg-green-500/10 rounded-lg p-3">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-green-300">
                    Leakage within acceptable range (&lt; 1 W/cm²).
                  </p>
                </div>
              )}
            </div>

            {/* Leakage bar chart */}
            <div className="lg:col-span-2 space-y-4">
              <p className="text-sm text-muted-foreground">Leakage current components (log-normalized):</p>

              {[
                {
                  label: "Subthreshold I_sub",
                  value: iSubMA * 1e-3,
                  unit: iSubMA < 0.001 ? `${(iSubMA * 1e6).toExponential(2)} nA/µm` : `${iSubMA.toExponential(2)} mA`,
                  pct: subBar,
                  color: "#ef4444",
                },
                {
                  label: "Gate tunneling I_gate",
                  value: iGate,
                  unit: `${iGate.toExponential(2)} A/µm`,
                  pct: gateBar,
                  color: "#f59e0b",
                },
                {
                  label: "Junction BTBT I_junct",
                  value: iJunct,
                  unit: `${iJunct.toExponential(2)} A/µm`,
                  pct: junctBar,
                  color: "#3b82f6",
                },
              ].map((bar) => (
                <div key={bar.label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{bar.label}</span>
                    <span className="font-mono text-xs">{bar.unit}</span>
                  </div>
                  <div className="h-6 bg-muted/30 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: bar.color }}
                      animate={{ width: `${Math.min(bar.pct, 100)}%` }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    />
                  </div>
                </div>
              ))}

              <div className="bg-muted/20 rounded-lg p-4 mt-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Total leakage breakdown</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Subthreshold</p>
                    <p className="font-mono text-red-400">{((iSubPerUm / iTotal) * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Gate tunnel</p>
                    <p className="font-mono text-yellow-400">{((iGate / iTotal) * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Junction BTBT</p>
                    <p className="font-mono text-blue-400">{((iJunct / iTotal) * 100).toFixed(1)}%</p>
                  </div>
                </div>
                <div className="flex justify-between text-sm pt-1 border-t border-border">
                  <span className="text-muted-foreground">Total (W/cm²)</span>
                  <span className={`font-mono font-semibold ${leakageTooHigh ? "text-red-400" : "text-green-400"}`}>
                    {leakageWcm2.toFixed(4)} W/cm²
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom Formula Reference Card ─────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-semibold">Formula Reference</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">MOSFET Saturation</p>
              <p className="font-mono text-sm">I_D(sat) = μCox·(W/L)/2·(Vgs−Vth)²</p>
              <p className="text-xs text-muted-foreground mt-1">
                Drain current saturates when V_DS &gt; V_GS − V_th
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Gate Capacitance</p>
              <p className="font-mono text-sm">C_gate = ε₀εᵣ·W·L / t_ox</p>
              <p className="text-xs text-muted-foreground mt-1">
                Decreases with node scaling — drives speed improvement
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">FinFET Width</p>
              <p className="font-mono text-sm">W_eff = 2·H_fin + W_fin</p>
              <p className="text-xs text-muted-foreground mt-1">
                Gate controls three fin surfaces for superior electrostatics
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Subthreshold Leakage</p>
              <p className="font-mono text-sm">I_sub = A·exp(−Vth/(n·kT/q))</p>
              <p className="font-mono text-sm mt-1">S = n·(kT/q)·ln(10) mV/dec</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ideal S = 60 mV/dec at 300K; n &gt; 1 in real devices
              </p>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
