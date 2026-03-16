"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Zap,
  Activity,
  Radio,
  Shield,
  Eye,
  AlertTriangle,
  CheckCircle,
  Info,
} from "lucide-react";

// ── Physics constants ──────────────────────────────────────────────────────────
const EPS0 = 8.854e-12; // F/m
const MU0 = 4 * Math.PI * 1e-7; // H/m
const RHO_AL = 2.65e-8; // Ω·m (aluminum)
const T_WIRE = 0.3e-6; // m, wire thickness
const EPS_R = 3.9; // SiO2
const H_OX = 0.5e-6; // m, oxide thickness (dielectric height)

// ── Helper: clamp ─────────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// ── Parasitic helpers ─────────────────────────────────────────────────────────
function calcR(W_um: number): number {
  // R in mΩ/mm: ρ / (W × t) × 1e-3 (length in mm = 1e-3 m)
  const W = W_um * 1e-6;
  return (RHO_AL / (W * T_WIRE)) * 1e-3 * 1000; // mΩ/mm
}

function calcC(W_um: number): number {
  // C in fF/mm: ε0·εr·W·L / H, L = 1mm
  const W = W_um * 1e-6;
  const L = 1e-3;
  return (EPS0 * EPS_R * W * L) / H_OX * 1e15; // fF/mm
}

function calcL(W_um: number): number {
  // L in pH/mm: µ0/(2π) × ln(2H/W) × 1e-3 m length
  const W = W_um * 1e-6;
  const ratio = Math.max((2 * H_OX) / W, 1.01);
  return (MU0 / (2 * Math.PI)) * Math.log(ratio) * 1e-3 * 1e12; // pH/mm
}

// Parasitic severity score 0-1
function parasiticScore(W_um: number): number {
  const r = calcR(W_um);
  const rMax = calcR(0.1);
  return clamp(r / rMax, 0, 1);
}

function parasiticColor(W_um: number): string {
  const s = parasiticScore(W_um);
  if (s < 0.33) return "#22c55e";
  if (s < 0.66) return "#eab308";
  return "#ef4444";
}

// ── Z0 stripline ──────────────────────────────────────────────────────────────
function calcZ0(W_um: number, H_um: number, t_um: number, er: number): number {
  const W = W_um * 1e-6;
  const H = H_um * 1e-6;
  const t = t_um * 1e-6;
  const inner = (4 * H) / (0.67 * Math.PI * W * (0.8 + t / W));
  return (60 / Math.sqrt(er)) * Math.log(Math.max(inner, 1.01));
}

// ── erfc approximation ─────────────────────────────────────────────────────────
function erfc(x: number): number {
  // Abramowitz & Stegun approximation
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const poly =
    t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const result = poly * Math.exp(-(x * x));
  return x >= 0 ? result : 2 - result;
}

// ── Net grid data ─────────────────────────────────────────────────────────────
const GRID_NETS = Array.from({ length: 36 }, (_, i) => ({
  id: i,
  row: Math.floor(i / 6),
  col: i % 6,
  // Stagger widths for visual variety
  baseWidth: 0.1 + ((i * 1.7 + (i % 6) * 0.4) % 9.9),
}));

// ── Main Component ─────────────────────────────────────────────────────────────
export default function EMIntegrityPage() {
  // Section 1 – Parasitic
  const [wireWidth, setWireWidth] = useState(1.0);
  const [hoveredNet, setHoveredNet] = useState<number | null>(null);

  // Section 2 – Crosstalk
  const [ctLength, setCtLength] = useState(5); // mm
  const [ctSep, setCtSep] = useState(2); // µm
  const [ctFreq, setCtFreq] = useState(5); // GHz

  // Section 3 – Return path
  const [rpWidth, setRpWidth] = useState(5); // µm
  const [planeSplit, setPlaneSplit] = useState(false);
  const [gapWidth, setGapWidth] = useState(50); // µm

  // Section 4 – Eye diagram
  const [eyeJitter, setEyeJitter] = useState(15); // ps
  const [eyeRise, setEyeRise] = useState(40); // ps
  const [eyeNoise, setEyeNoise] = useState(30); // mV

  // Section 5 – EM / ESD
  const [emCurrent, setEmCurrent] = useState(10); // mA
  const [emLength, setEmLength] = useState(5); // mm
  const [emFreq, setEmFreq] = useState(1); // GHz

  // ── Section 2 calcs ──
  const Cself = calcC(1.0); // fF/mm for 1µm wire (reference)
  const Ccoupling =
    (EPS0 * EPS_R * (ctLength * 1e-3) * T_WIRE) / (ctSep * 1e-6) * 1e15; // fF total
  const Cself_total = Cself * ctLength; // fF
  const vProp = 3e8 / Math.sqrt(EPS_R); // m/s
  const Td_ns = (ctLength * 1e-3) / vProp * 1e9; // ns
  const BW_GHz = ctFreq;
  const Tr_ps = 0.35 / BW_GHz * 1000; // ps
  const Tr_ns = Tr_ps / 1000;
  const NEXT_frac = (Ccoupling / Math.max(Cself_total, 0.001)) * (1 / 4);
  const FEXT_frac = (Ccoupling / Math.max(Cself_total, 0.001)) * (Td_ns / Math.max(Tr_ns, 0.001));
  const NEXT_pct = NEXT_frac * 100;
  const FEXT_pct = FEXT_frac * 100;
  // Recommended separation for NEXT < 5%
  // NEXT = (C_c/C_self)/4 < 0.05  → C_c/C_self < 0.2
  // C_c = ε0εr·L·t/d, C_self = ε0εr·W·L/H
  // ratio = C_c/C_self = (t/d)/(W/H) = t·H/(d·W)
  // 0.2 = t·H/(d_rec·W) → d_rec = t·H/(0.2·W)
  const recSep_um = (T_WIRE * 1e6 * H_OX * 1e6) / (0.2 * 1.0); // µm (W=1µm)
  const recSep_actual =
    (T_WIRE * 1e6 * H_OX * 1e6) / (0.2 * 1.0) * (1.0 / Math.max(wireWidth, 0.1));

  // ── Section 3 calcs ──
  const Z0 = calcZ0(rpWidth, 500, 300, EPS_R);
  const gapDL_nH =
    planeSplit
      ? (MU0 * (gapWidth * 1e-6)) /
        Math.PI *
        Math.log(Math.max((gapWidth * 1e-6) / H_OX, 1.01)) *
        1e9
      : 0; // nH
  const Tr_rp_ps = 100; // fixed 100ps for SSN demo
  const I_swing = 0.02; // 20 mA
  const Vssn_mV = planeSplit
    ? gapDL_nH * 1e-9 * (I_swing / (Tr_rp_ps * 1e-12)) * 1000
    : 0;

  // ── Section 4 calcs ──
  const V_swing = 800; // mV
  const eyeHeight_mV = Math.max(0, V_swing - 2 * eyeNoise);
  const T_bit_ps = 100; // 10 Gbps
  const eyeWidth_ps = Math.max(0, T_bit_ps - 2 * eyeJitter);
  const sigma_noise = eyeNoise / 3; // rough σ
  const ber_arg = eyeHeight_mV / (2 * sigma_noise * Math.SQRT2);
  const BER = 0.5 * erfc(ber_arg);
  const eyeOpen = eyeHeight_mV > 400 && eyeWidth_ps > 50;
  const eyeMarginal = !eyeOpen && eyeHeight_mV > 200;

  // SVG eye diagram path generation (simplified overlay)
  function buildEyePaths(): string[] {
    const paths: string[] = [];
    const W = 300;
    const H = 120;
    const cx = W / 2;
    const cy = H / 2;
    const ew = (eyeWidth_ps / T_bit_ps) * (W * 0.8);
    const eh = (eyeHeight_mV / V_swing) * (H * 0.7);
    const riseW = (eyeRise / T_bit_ps) * (W * 0.4);
    const jW = (eyeJitter / T_bit_ps) * (W * 0.4);
    const noiseH = (eyeNoise / V_swing) * (H * 0.35);

    // Generate N overlaid traces
    const N = 40;
    const seed = (n: number) => (Math.sin(n * 127.1 + n * 311.7) * 43758.5453) % 1;

    for (let i = 0; i < N; i++) {
      const jx = (seed(i) - 0.5) * 2 * jW;
      const ny = (seed(i + N) - 0.5) * 2 * noiseH;
      const bit = seed(i + 2 * N) > 0.5 ? 1 : 0;
      const yHi = cy - eh / 2 - H * 0.05 + ny;
      const yLo = cy + eh / 2 + H * 0.05 + ny;
      const xLeft = cx - ew / 2 - riseW / 2 + jx;
      const xRight = cx + ew / 2 + riseW / 2 + jx;
      const xMid = cx + jx;

      if (bit === 1) {
        // High bit: show top part of eye crossing
        paths.push(
          `M ${clamp(xLeft - W * 0.1, 0, W)} ${yLo} L ${clamp(xLeft, 0, W)} ${yHi} L ${clamp(xRight, 0, W)} ${yHi} L ${clamp(xRight + W * 0.05, 0, W)} ${yLo}`
        );
      } else {
        // Low bit: show bottom part
        paths.push(
          `M ${clamp(xLeft - W * 0.1, 0, W)} ${yHi} L ${clamp(xLeft, 0, W)} ${yLo} L ${clamp(xRight, 0, W)} ${yLo} L ${clamp(xRight + W * 0.05, 0, W)} ${yHi}`
        );
      }
      void xMid; // used implicitly
    }
    return paths;
  }

  const eyePaths = buildEyePaths();

  // ── Section 5 calcs ──
  const lambda_m = 3e8 / (emFreq * 1e9); // m
  const I_A = emCurrent * 1e-3;
  const l_m = emLength * 1e-3;
  const Prad_uW = 80 * Math.PI ** 2 * ((I_A * l_m) / lambda_m) ** 2 * 1e6; // µW
  const Prad_dBm = 10 * Math.log10(Prad_uW * 1e-3 / 1e-3); // dBm
  const FCC_limit_dBm = -46; // dBm/MHz Class B

  // ── SPEF worst nets ──
  const netParasitics = GRID_NETS.map((n) => {
    const W = clamp(wireWidth * (0.3 + (n.baseWidth / 9.9) * 0.7 + 0.3), 0.1, 10);
    return {
      id: n.id,
      W,
      R: calcR(W),
      C: calcC(W),
      L: calcL(W),
    };
  });
  const worstNets = [...netParasitics].sort((a, b) => b.R - a.R).slice(0, 5);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <Zap className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  Round 8
                </span>
                <h1 className="text-3xl font-bold">Electromagnetic &amp; Signal Integrity</h1>
              </div>
              <p className="text-muted-foreground mt-1">
                Interactive parasitic extraction, crosstalk, return path, eye diagrams, and EM radiation for
                high-speed chip interconnects
              </p>
              <div className="flex flex-wrap gap-6 mt-3 text-sm">
                <span className="text-muted-foreground">
                  Wire width:{" "}
                  <span className="font-mono text-foreground">{wireWidth.toFixed(2)} µm</span>
                </span>
                <span className="text-muted-foreground">
                  NEXT:{" "}
                  <span className={NEXT_pct > 5 ? "text-red-400 font-mono" : "text-green-400 font-mono"}>
                    {NEXT_pct.toFixed(1)}%
                  </span>
                </span>
                <span className="text-muted-foreground">
                  Z₀:{" "}
                  <span
                    className={
                      Math.abs(Z0 - 50) < 5
                        ? "text-green-400 font-mono"
                        : Math.abs(Z0 - 50) < 15
                        ? "text-yellow-400 font-mono"
                        : "text-red-400 font-mono"
                    }
                  >
                    {Z0.toFixed(1)} Ω
                  </span>
                </span>
                <span className="text-muted-foreground">
                  Eye:{" "}
                  <span
                    className={
                      eyeOpen
                        ? "text-green-400 font-mono"
                        : eyeMarginal
                        ? "text-yellow-400 font-mono"
                        : "text-red-400 font-mono"
                    }
                  >
                    {eyeOpen ? "Open" : eyeMarginal ? "Marginal" : "Closed"}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {/* ══════════════════════════════════════════════════════════════
            SECTION 1 – PARASITIC EXTRACTOR
        ══════════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-violet-400" />
            <h2 className="text-xl font-semibold">1. Parasitic Extractor Visualizer</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Net grid */}
            <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-muted-foreground">
                  6×6 Net Grid — chip top view
                </p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Low
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-yellow-500 inline-block" /> Med
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> High
                  </span>
                </div>
              </div>

              {/* Width slider */}
              <div className="mb-5">
                <label className="text-xs text-muted-foreground flex justify-between mb-1">
                  <span>Wire Width</span>
                  <span className="font-mono text-foreground">{wireWidth.toFixed(2)} µm</span>
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={10}
                  step={0.05}
                  value={wireWidth}
                  onChange={(e) => setWireWidth(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0.1 µm</span>
                  <span>10 µm</span>
                </div>
              </div>

              {/* Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6, 1fr)",
                  gap: 4,
                }}
              >
                {GRID_NETS.map((n) => {
                  const W = clamp(wireWidth * (0.3 + (n.baseWidth / 9.9) * 0.7 + 0.3), 0.1, 10);
                  const color = parasiticColor(W);
                  const isHovered = hoveredNet === n.id;
                  return (
                    <div
                      key={n.id}
                      className="relative aspect-square rounded-md cursor-pointer transition-all border-2"
                      style={{
                        backgroundColor: color + "40",
                        borderColor: isHovered ? "#ffffff" : color + "80",
                      }}
                      onMouseEnter={() => setHoveredNet(n.id)}
                      onMouseLeave={() => setHoveredNet(null)}
                    >
                      <div
                        className="absolute inset-0 rounded flex items-center justify-center"
                        style={{ fontSize: 8, color }}
                      >
                        N{n.id}
                      </div>
                      {isHovered && (
                        <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 bg-popover border border-border rounded-lg p-2 shadow-lg text-xs">
                          <p className="font-semibold mb-1 font-mono">Net {n.id} — {W.toFixed(2)} µm</p>
                          <p>R = <span className="font-mono">{calcR(W).toFixed(1)} mΩ/mm</span></p>
                          <p>C = <span className="font-mono">{calcC(W).toFixed(1)} fF/mm</span></p>
                          <p>L = <span className="font-mono">{calcL(W).toFixed(2)} pH/mm</span></p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Formula row */}
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { label: "R (mΩ/mm)", formula: "ρ / (W·t)", value: `${calcR(wireWidth).toFixed(1)}` },
                  { label: "C (fF/mm)", formula: "ε₀εᵣWL/H", value: `${calcC(wireWidth).toFixed(1)}` },
                  { label: "L (pH/mm)", formula: "µ₀/2π·ln(2H/W)", value: `${calcL(wireWidth).toFixed(2)}` },
                ].map((item) => (
                  <div key={item.label} className="bg-muted/40 rounded-xl p-3 text-center">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="font-mono text-xs mt-0.5 text-muted-foreground">{item.formula}</p>
                    <p className="font-mono text-lg font-bold mt-1">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* SPEF panel */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">SPEF Summary — Top 5 Worst Nets</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Standard Parasitic Exchange Format (SPEF) lists nets sorted by resistance, helping designers
                identify timing-critical interconnects.
              </p>

              <div className="space-y-2">
                {worstNets.map((n, rank) => (
                  <div
                    key={n.id}
                    className="rounded-xl border border-border p-3 bg-muted/20"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-mono font-semibold text-muted-foreground">
                        #{rank + 1} NET_{n.id}
                      </span>
                      <span className="text-xs font-mono" style={{ color: parasiticColor(n.W) }}>
                        {n.W.toFixed(2)} µm
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-xs font-mono">
                      <span className="text-muted-foreground">R {n.R.toFixed(0)}</span>
                      <span className="text-muted-foreground">C {n.C.toFixed(0)}</span>
                      <span className="text-muted-foreground">L {n.L.toFixed(1)}</span>
                    </div>
                    <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(n.R / worstNets[0].R) * 100}%`,
                          backgroundColor: parasiticColor(n.W),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-muted/30 rounded-xl p-3 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">SPEF format (excerpt)</p>
                <pre className="font-mono text-[10px] leading-relaxed overflow-x-auto">{`*D_NET NET_${worstNets[0]?.id} ${(worstNets[0]?.C / 1000).toFixed(4)}
*RES
1:A 1:B ${(worstNets[0]?.R / 1000).toFixed(4)}
*CAP
1 1:A ${(worstNets[0]?.C / 2000).toFixed(4)}
*END`}</pre>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 2 – CROSSTALK
        ══════════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-yellow-400" />
            <h2 className="text-xl font-semibold">2. Crosstalk Noise Calculator</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Controls + SVG */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Two parallel wires: aggressor switches, inducing noise on victim via capacitive coupling.
              </p>

              {/* Wire diagram SVG */}
              <svg
                viewBox="0 0 300 100"
                className="w-full rounded-xl bg-muted/20 border border-border"
              >
                {/* Aggressor wire */}
                <rect x="10" y="20" width="280" height="8" rx="2" fill="#f59e0b" opacity="0.8" />
                <text x="14" y="16" fontSize="9" fill="#f59e0b">Aggressor</text>

                {/* Victim wire */}
                <rect x="10" y="72" width="280" height="8" rx="2" fill="#60a5fa" opacity="0.8" />
                <text x="14" y="68" fontSize="9" fill="#60a5fa">Victim</text>

                {/* Coupling arrows */}
                {[60, 100, 140, 180, 220].map((x) => (
                  <g key={x}>
                    <line x1={x} y1="28" x2={x} y2="72" stroke="#a78bfa" strokeWidth="1.2" strokeDasharray="3,2" />
                    <polygon points={`${x},70 ${x - 3},62 ${x + 3},62`} fill="#a78bfa" />
                    <text x={x - 5} y="52" fontSize="7" fill="#a78bfa">Cc</text>
                  </g>
                ))}

                {/* Separation label */}
                <line x1="260" y1="28" x2="260" y2="72" stroke="#64748b" strokeWidth="1" />
                <text x="264" y="52" fontSize="8" fill="#94a3b8">d={ctSep}µm</text>

                {/* NEXT noise sketch */}
                <polyline
                  points="10,88 30,88 32,82 36,94 40,86 44,90 280,90"
                  fill="none"
                  stroke="#a78bfa"
                  strokeWidth="1.5"
                  opacity="0.7"
                />
                <text x="10" y="100" fontSize="7" fill="#a78bfa">NEXT noise ~{NEXT_pct.toFixed(1)}%</text>
              </svg>

              {/* Sliders */}
              {[
                { label: "Wire Length", value: ctLength, min: 0.5, max: 20, step: 0.5, unit: "mm", setter: setCtLength },
                { label: "Separation", value: ctSep, min: 0.5, max: 20, step: 0.5, unit: "µm", setter: setCtSep },
                { label: "Switching Freq", value: ctFreq, min: 0.1, max: 28, step: 0.1, unit: "GHz", setter: setCtFreq },
              ].map((s) => (
                <div key={s.label}>
                  <label className="text-xs text-muted-foreground flex justify-between mb-1">
                    <span>{s.label}</span>
                    <span className="font-mono text-foreground">{s.value.toFixed(1)} {s.unit}</span>
                  </label>
                  <input
                    type="range"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={s.value}
                    onChange={(e) => s.setter(Number(e.target.value))}
                    className="w-full accent-yellow-500"
                  />
                </div>
              ))}
            </div>

            {/* Results */}
            <div className="space-y-4">
              <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
                <h3 className="text-sm font-semibold">Coupling Results</h3>
                {[
                  { label: "C_coupling", value: `${Ccoupling.toFixed(1)} fF`, formula: "ε₀εᵣ·L·t / d" },
                  { label: "C_self", value: `${Cself_total.toFixed(1)} fF`, formula: "ε₀εᵣ·W·L / H" },
                  { label: "T_d (prop delay)", value: `${(Td_ns * 1000).toFixed(1)} ps`, formula: "L / v_prop" },
                  { label: "T_r (rise time)", value: `${Tr_ps.toFixed(0)} ps`, formula: "0.35 / BW" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-mono text-xs text-muted-foreground">{row.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">({row.formula})</span>
                    </div>
                    <span className="font-mono font-medium">{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div
                  className={`rounded-2xl border p-5 ${
                    NEXT_pct > 5 ? "border-red-500/40 bg-red-500/10" : "border-green-500/40 bg-green-500/10"
                  }`}
                >
                  <p className="text-xs text-muted-foreground mb-1">NEXT</p>
                  <p className="font-mono text-2xl font-bold">{NEXT_pct.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">(C_c/C_s) × V/4</p>
                  {NEXT_pct > 5 && (
                    <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Exceeds 5% limit
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-border bg-card p-5">
                  <p className="text-xs text-muted-foreground mb-1">FEXT</p>
                  <p className="font-mono text-2xl font-bold">{FEXT_pct.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">(C_c/C_s)×(T_d/T_r)</p>
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-5">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <p className="text-sm font-semibold">Recommended Separation</p>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  To keep NEXT &lt; 5% of signal swing:
                </p>
                <p className="font-mono text-lg font-bold text-green-400">
                  d ≥ {clamp(recSep_actual, 0.1, 999).toFixed(1)} µm
                </p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  d_rec = t·H / (0.2·W)
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 3 – RETURN PATH
        ══════════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Radio className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-semibold">3. Return Path Analysis</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cross-section SVG */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
              <h3 className="text-sm font-semibold">Stripline Cross-Section</h3>

              <svg viewBox="0 0 320 160" className="w-full rounded-xl bg-muted/20 border border-border">
                {/* Ground plane bottom */}
                <rect x="0" y="130" width="320" height="18" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="1" />
                <text x="8" y="143" fontSize="9" fill="#93c5fd">GND Plane (return)</text>

                {/* Dielectric */}
                <rect x="0" y="60" width="320" height="70" fill="#1a1a2e" opacity="0.7" />
                <text x="8" y="100" fontSize="8" fill="#6b7280">SiO₂ εᵣ=3.9</text>

                {/* Signal trace */}
                {(() => {
                  const traceW = clamp((rpWidth / 10) * 60 + 10, 10, 80);
                  const traceX = 160 - traceW / 2;
                  return (
                    <g>
                      <rect x={traceX} y="52" width={traceW} height="10" rx="2" fill="#f59e0b" />
                      <text x="160" y="48" fontSize="9" fill="#f59e0b" textAnchor="middle">
                        Signal ({rpWidth}µm)
                      </text>
                    </g>
                  );
                })()}

                {/* Return current arrows hugging trace */}
                {planeSplit ? (
                  <>
                    {/* Gap in ground plane */}
                    <rect x="130" y="130" width={clamp((gapWidth / 200) * 60, 5, 100)} height="18" fill="#1e1e1e" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,2" />
                    <text x="160" y="158" fontSize="8" fill="#ef4444" textAnchor="middle">
                      Plane split — gap={gapWidth}µm
                    </text>
                    {/* Diverging return path */}
                    <path
                      d="M 100,130 Q 80,110 60,130"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                      strokeDasharray="4,2"
                    />
                    <path
                      d="M 220,130 Q 240,110 260,130"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                      strokeDasharray="4,2"
                    />
                    <text x="60" y="108" fontSize="7" fill="#ef4444">↑ loop↑</text>
                    <text x="240" y="108" fontSize="7" fill="#ef4444">↑ loop↑</text>
                  </>
                ) : (
                  <>
                    {/* Normal return path arrows */}
                    {[130, 150, 170, 190].map((x) => (
                      <g key={x}>
                        <line x1={x} y1="130" x2={x} y2="62" stroke="#22c55e" strokeWidth="1.2" opacity="0.6" strokeDasharray="2,3" />
                        <polygon points={`${x},130 ${x - 3},122 ${x + 3},122`} fill="#22c55e" opacity="0.6" />
                      </g>
                    ))}
                    <text x="160" y="148" fontSize="8" fill="#22c55e" textAnchor="middle">
                      Return current (Lenz's law)
                    </text>
                  </>
                )}

                {/* H dimension */}
                <line x1="290" y1="62" x2="290" y2="130" stroke="#64748b" strokeWidth="1" />
                <text x="294" y="100" fontSize="8" fill="#94a3b8">H</text>
              </svg>

              {/* Plane split toggle */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPlaneSplit(!planeSplit)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    planeSplit ? "bg-red-500" : "bg-muted"
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      planeSplit ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-sm">Plane Split {planeSplit ? "(ON — BAD)" : "(OFF)"}</span>
              </div>

              {planeSplit && (
                <div>
                  <label className="text-xs text-muted-foreground flex justify-between mb-1">
                    <span>Gap Width</span>
                    <span className="font-mono text-foreground">{gapWidth} µm</span>
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={300}
                    step={10}
                    value={gapWidth}
                    onChange={(e) => setGapWidth(Number(e.target.value))}
                    className="w-full accent-red-500"
                  />
                </div>
              )}

              {/* Trace width slider */}
              <div>
                <label className="text-xs text-muted-foreground flex justify-between mb-1">
                  <span>Trace Width</span>
                  <span className="font-mono text-foreground">{rpWidth} µm</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={0.5}
                  value={rpWidth}
                  onChange={(e) => setRpWidth(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
            </div>

            {/* Metrics */}
            <div className="space-y-4">
              {/* Z0 */}
              <div className="bg-card rounded-2xl border border-border p-5">
                <h3 className="text-sm font-semibold mb-3">Characteristic Impedance Z₀</h3>
                <div className="font-mono text-xs text-muted-foreground mb-2">
                  Z₀ = (60/√εᵣ) × ln(4H/(0.67π·W·(0.8 + t/W)))
                </div>
                <div className="flex items-end gap-3 mt-3">
                  <p
                    className="font-mono text-4xl font-bold"
                    style={{
                      color:
                        Math.abs(Z0 - 50) < 5
                          ? "#22c55e"
                          : Math.abs(Z0 - 50) < 15
                          ? "#eab308"
                          : "#ef4444",
                    }}
                  >
                    {Z0.toFixed(1)} Ω
                  </p>
                  <p className="text-sm text-muted-foreground mb-1">target: 50 Ω</p>
                </div>
                {/* Z0 bar */}
                <div className="mt-3 h-3 bg-muted rounded-full overflow-hidden relative">
                  <div className="absolute h-full w-0.5 bg-green-500" style={{ left: "50%" }} />
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      width: `${clamp((Z0 / 150) * 100, 2, 100)}%`,
                      backgroundColor:
                        Math.abs(Z0 - 50) < 5
                          ? "#22c55e"
                          : Math.abs(Z0 - 50) < 15
                          ? "#eab308"
                          : "#ef4444",
                    }}
                    animate={{ width: `${clamp((Z0 / 150) * 100, 2, 100)}%` }}
                    transition={{ type: "spring", stiffness: 200 }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0 Ω</span>
                  <span className="text-green-400">50 Ω</span>
                  <span>150 Ω</span>
                </div>
              </div>

              {/* SSN */}
              {planeSplit && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <h3 className="text-sm font-semibold text-red-400">Plane Split — SSN Analysis</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ΔL (loop inductance)</span>
                      <span className="font-mono">{gapDL_nH.toFixed(3)} nH</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">V_SSN = L·dI/dt</span>
                      <span className="font-mono text-red-400">{Vssn_mV.toFixed(1)} mV</span>
                    </div>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground mt-3 bg-muted/30 rounded p-2">
                    ΔL = µ₀·gap/π × ln(gap/H)<br />
                    V_SSN = ΔL × I_swing / T_r
                  </div>
                </motion.div>
              )}

              {/* Return path explainer */}
              <div className="bg-card rounded-2xl border border-border p-5">
                <h3 className="text-sm font-semibold mb-2">Why Return Path Matters</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  By Lenz&apos;s law, return current naturally follows the path that minimises loop
                  inductance — directly beneath the signal trace on the ground plane. A gap or split
                  in the plane forces current to detour, greatly increasing loop area and thus
                  inductance, causing simultaneous switching noise (SSN), EMI, and crosstalk.
                </p>
                <div className="mt-3 font-mono text-xs text-muted-foreground bg-muted/30 rounded p-2">
                  L_loop ∝ loop_area<br />
                  V_noise = L_loop × dI/dt
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 4 – EYE DIAGRAM
        ══════════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-5 h-5 text-green-400" />
            <h2 className="text-xl font-semibold">4. Eye Diagram Simulator</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* SVG eye */}
            <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-muted-foreground">
                  10 Gbps SerDes — superimposed bit-period overlays
                </p>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    eyeOpen
                      ? "bg-green-500/20 text-green-400"
                      : eyeMarginal
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {eyeOpen ? "Eye Open" : eyeMarginal ? "Marginal" : "Eye Closed"}
                </span>
              </div>

              <svg
                viewBox="0 0 300 120"
                className="w-full rounded-xl border border-border"
                style={{ background: "#0a0a0f" }}
              >
                {/* Grid */}
                {[30, 60, 90].map((y) => (
                  <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="#1e293b" strokeWidth="0.5" />
                ))}
                {[75, 150, 225].map((x) => (
                  <line key={x} x1={x} y1="0" x2={x} y2="120" stroke="#1e293b" strokeWidth="0.5" />
                ))}

                {/* Eye traces */}
                {eyePaths.map((d, i) => (
                  <path
                    key={i}
                    d={d}
                    fill="none"
                    stroke={eyeOpen ? "#22c55e" : eyeMarginal ? "#eab308" : "#ef4444"}
                    strokeWidth="0.8"
                    opacity="0.35"
                  />
                ))}

                {/* Eye opening box */}
                {(() => {
                  const W = 300;
                  const H = 120;
                  const ew = (eyeWidth_ps / T_bit_ps) * (W * 0.8);
                  const eh = (eyeHeight_mV / V_swing) * (H * 0.7);
                  const cx = W / 2;
                  const cy = H / 2;
                  return (
                    <rect
                      x={cx - ew / 2}
                      y={cy - eh / 2}
                      width={Math.max(ew, 0)}
                      height={Math.max(eh, 0)}
                      fill="none"
                      stroke={eyeOpen ? "#22c55e" : eyeMarginal ? "#eab308" : "#ef4444"}
                      strokeWidth="1"
                      strokeDasharray="4,2"
                      opacity="0.6"
                    />
                  );
                })()}

                {/* Labels */}
                <text x="4" y="10" fontSize="7" fill="#475569">800 mV</text>
                <text x="4" y="118" fontSize="7" fill="#475569">0 mV</text>
                <text x="2" y="64" fontSize="7" fill="#475569">400</text>
                <text x="120" y="118" fontSize="7" fill="#475569">0</text>
                <text x="270" y="118" fontSize="7" fill="#475569">100 ps</text>
              </svg>

              {/* Sliders */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Jitter", value: eyeJitter, min: 0, max: 45, step: 1, unit: "ps", setter: setEyeJitter, color: "accent-green-500" },
                  { label: "Rise Time", value: eyeRise, min: 10, max: 90, step: 1, unit: "ps", setter: setEyeRise, color: "accent-green-500" },
                  { label: "Noise Amp", value: eyeNoise, min: 0, max: 150, step: 5, unit: "mV", setter: setEyeNoise, color: "accent-green-500" },
                ].map((s) => (
                  <div key={s.label}>
                    <label className="text-xs text-muted-foreground flex justify-between mb-1">
                      <span>{s.label}</span>
                      <span className="font-mono text-foreground">{s.value} {s.unit}</span>
                    </label>
                    <input
                      type="range"
                      min={s.min}
                      max={s.max}
                      step={s.step}
                      value={s.value}
                      onChange={(e) => s.setter(Number(e.target.value))}
                      className={`w-full accent-green-500`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Eye metrics */}
            <div className="space-y-4">
              <div className="bg-card rounded-2xl border border-border p-5 space-y-3">
                <h3 className="text-sm font-semibold">Eye Metrics</h3>
                {[
                  {
                    label: "Eye Height",
                    value: `${eyeHeight_mV.toFixed(0)} mV`,
                    formula: "V_swing − 2·V_noise",
                    ok: eyeHeight_mV > 400,
                  },
                  {
                    label: "Eye Width",
                    value: `${eyeWidth_ps.toFixed(0)} ps`,
                    formula: "T_bit − 2·t_jitter",
                    ok: eyeWidth_ps > 50,
                  },
                  {
                    label: "T_bit",
                    value: `${T_bit_ps} ps`,
                    formula: "1 / 10 Gbps",
                    ok: true,
                  },
                ].map((m) => (
                  <div key={m.label} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-muted-foreground">{m.label}</span>
                      <p className="text-xs font-mono text-muted-foreground">{m.formula}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold">{m.value}</span>
                      {m.ok ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div
                className={`rounded-2xl border p-5 ${
                  BER < 1e-12
                    ? "border-green-500/40 bg-green-500/10"
                    : BER < 1e-6
                    ? "border-yellow-500/40 bg-yellow-500/10"
                    : "border-red-500/40 bg-red-500/10"
                }`}
              >
                <h3 className="text-sm font-semibold mb-2">BER Estimate</h3>
                <p className="font-mono text-2xl font-bold">
                  {BER < 1e-15 ? "< 10⁻¹⁵" : BER.toExponential(1)}
                </p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  0.5 × erfc(H_eye / (2σ√2))
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {BER < 1e-12
                    ? "Excellent — meets OIF CEI spec"
                    : BER < 1e-6
                    ? "Marginal — FEC required"
                    : "Unacceptable — link fails"}
                </p>
              </div>

              <div className="bg-card rounded-2xl border border-border p-5 text-xs space-y-1 font-mono text-muted-foreground">
                <p className="text-foreground font-semibold text-sm mb-2">Key Equations</p>
                <p>σ_noise ≈ V_noise / 3</p>
                <p>H_eye = V_sw − 2·V_n</p>
                <p>W_eye = T_bit − 2·t_j</p>
                <p>BER ≈ ½·erfc(H/(2σ√2))</p>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 5 – EM RADIATION & ESD
        ══════════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-red-400" />
            <h2 className="text-xl font-semibold">5. EM Radiation &amp; ESD Immunity</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Radiation calculator */}
            <div className="bg-card rounded-2xl border border-border p-5 space-y-4">
              <h3 className="text-sm font-semibold">Dipole Antenna Radiation</h3>
              <p className="font-mono text-xs text-muted-foreground bg-muted/30 rounded p-2">
                P_rad = 80π² × (I·l/λ)²
              </p>

              {[
                { label: "Current Amplitude", value: emCurrent, min: 1, max: 100, step: 1, unit: "mA", setter: setEmCurrent },
                { label: "Wire Length", value: emLength, min: 0.1, max: 50, step: 0.1, unit: "mm", setter: setEmLength },
                { label: "Frequency", value: emFreq, min: 0.1, max: 10, step: 0.1, unit: "GHz", setter: setEmFreq },
              ].map((s) => (
                <div key={s.label}>
                  <label className="text-xs text-muted-foreground flex justify-between mb-1">
                    <span>{s.label}</span>
                    <span className="font-mono text-foreground">{s.value.toFixed(1)} {s.unit}</span>
                  </label>
                  <input
                    type="range"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={s.value}
                    onChange={(e) => s.setter(Number(e.target.value))}
                    className="w-full accent-red-500"
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">λ (wavelength)</p>
                  <p className="font-mono text-lg font-bold">
                    {((3e8 / (emFreq * 1e9)) * 100).toFixed(1)} cm
                  </p>
                </div>
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">l/λ ratio</p>
                  <p className="font-mono text-lg font-bold">
                    {((emLength * 1e-3) / (3e8 / (emFreq * 1e9)) * 100).toFixed(3)}%
                  </p>
                </div>
              </div>

              <div
                className={`rounded-xl border p-4 ${
                  Prad_dBm < FCC_limit_dBm
                    ? "border-green-500/40 bg-green-500/10"
                    : "border-red-500/40 bg-red-500/10"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs text-muted-foreground">Radiated Power</p>
                    <p className="font-mono text-2xl font-bold">
                      {Prad_uW < 0.001 ? Prad_uW.toExponential(2) : Prad_uW.toFixed(3)} µW
                    </p>
                    <p className="font-mono text-sm text-muted-foreground mt-1">
                      {isFinite(Prad_dBm) ? `${Prad_dBm.toFixed(1)} dBm` : "−∞ dBm"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">FCC Class B limit</p>
                    <p className="font-mono text-sm">{FCC_limit_dBm} dBm/MHz</p>
                    {Prad_dBm < FCC_limit_dBm ? (
                      <p className="text-xs text-green-400 flex items-center gap-1 mt-1 justify-end">
                        <CheckCircle className="w-3 h-3" /> Compliant
                      </p>
                    ) : (
                      <p className="text-xs text-red-400 flex items-center gap-1 mt-1 justify-end">
                        <AlertTriangle className="w-3 h-3" /> Violation
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ESD + Latch-up */}
            <div className="space-y-4">
              {/* ESD waveform */}
              <div className="bg-card rounded-2xl border border-border p-5">
                <h3 className="text-sm font-semibold mb-3">ESD Gun Waveform (IEC 61000-4-2)</h3>
                <svg viewBox="0 0 300 100" className="w-full rounded-xl bg-muted/10 border border-border">
                  {/* Axes */}
                  <line x1="30" y1="10" x2="30" y2="85" stroke="#475569" strokeWidth="1" />
                  <line x1="30" y1="85" x2="290" y2="85" stroke="#475569" strokeWidth="1" />
                  <text x="2" y="14" fontSize="7" fill="#64748b">kV</text>
                  <text x="240" y="95" fontSize="7" fill="#64748b">ns</text>

                  {/* IEC 61000-4-2: fast rise to 1kV at ~1ns, decay */}
                  {/* Grid */}
                  {[30, 60, 90].map((y) => (
                    <line key={y} x1="30" y1={y} x2="290" y2={y} stroke="#1e293b" strokeWidth="0.5" />
                  ))}

                  {/* Waveform path: rise in ~2ns, peak at 1kV, decay over 30ns */}
                  <polyline
                    points={`
                      30,85
                      35,85
                      38,15
                      45,22
                      60,35
                      90,50
                      130,62
                      180,72
                      240,79
                      290,83
                    `}
                    fill="none"
                    stroke="#f87171"
                    strokeWidth="2"
                  />
                  {/* Dashed contact discharge line */}
                  <line x1="38" y1="15" x2="290" y2="15" stroke="#475569" strokeWidth="0.5" strokeDasharray="3,3" />
                  <text x="32" y="13" fontSize="7" fill="#94a3b8">1 kV peak</text>
                  <text x="35" y="94" fontSize="7" fill="#94a3b8">0</text>
                  <text x="85" y="94" fontSize="7" fill="#94a3b8">30ns</text>
                  <text x="170" y="94" fontSize="7" fill="#94a3b8">60ns</text>
                </svg>
                <p className="text-xs text-muted-foreground mt-2">
                  Contact discharge: 1 kΩ, 30 pF. Peak current ~2A at 30 ns, decays exponentially.
                  Rise time ≈ 0.7–1 ns. Model: two-exponential I(t) = I₀(e^(−t/τ1) − e^(−t/τ2)).
                </p>
              </div>

              {/* ESD Protection diagram */}
              <div className="bg-card rounded-2xl border border-border p-5">
                <h3 className="text-sm font-semibold mb-3">ESD Protection Structure</h3>
                <svg viewBox="0 0 300 80" className="w-full rounded-xl bg-muted/10 border border-border mb-3">
                  {/* PAD */}
                  <rect x="5" y="30" width="30" height="20" rx="3" fill="#1e40af" stroke="#3b82f6" strokeWidth="1" />
                  <text x="20" y="43" fontSize="8" fill="#93c5fd" textAnchor="middle">PAD</text>

                  {/* ESD diode clamp */}
                  <line x1="35" y1="40" x2="75" y2="40" stroke="#94a3b8" strokeWidth="1.5" />
                  <rect x="75" y="25" width="30" height="30" rx="3" fill="#7c2d12" stroke="#f97316" strokeWidth="1" />
                  <text x="90" y="38" fontSize="7" fill="#fed7aa" textAnchor="middle">ESD</text>
                  <text x="90" y="48" fontSize="7" fill="#fed7aa" textAnchor="middle">Diode</text>

                  {/* RC filter */}
                  <line x1="105" y1="40" x2="145" y2="40" stroke="#94a3b8" strokeWidth="1.5" />
                  <rect x="145" y="28" width="40" height="24" rx="3" fill="#14532d" stroke="#22c55e" strokeWidth="1" />
                  <text x="165" y="38" fontSize="7" fill="#86efac" textAnchor="middle">RC</text>
                  <text x="165" y="48" fontSize="7" fill="#86efac" textAnchor="middle">Filter</text>

                  {/* Protected core */}
                  <line x1="185" y1="40" x2="225" y2="40" stroke="#94a3b8" strokeWidth="1.5" />
                  <rect x="225" y="25" width="50" height="30" rx="3" fill="#1e3a5f" stroke="#60a5fa" strokeWidth="1" />
                  <text x="250" y="38" fontSize="7" fill="#93c5fd" textAnchor="middle">Protected</text>
                  <text x="250" y="48" fontSize="7" fill="#93c5fd" textAnchor="middle">Core</text>

                  {/* GND arrows */}
                  <line x1="90" y1="55" x2="90" y2="70" stroke="#475569" strokeWidth="1" />
                  <line x1="80" y1="70" x2="100" y2="70" stroke="#475569" strokeWidth="1" />
                  <line x1="83" y1="73" x2="97" y2="73" stroke="#475569" strokeWidth="0.8" />
                  <line x1="86" y1="76" x2="94" y2="76" stroke="#475569" strokeWidth="0.6" />
                </svg>
                <p className="text-xs text-muted-foreground">
                  ESD diode clamp shunts transient to GND. RC low-pass filter limits slew rate. Core
                  sees attenuated pulse well below gate-oxide breakdown (~5–10 V for 28nm).
                </p>
              </div>

              {/* Latch-up I-V */}
              <div className="bg-card rounded-2xl border border-border p-5">
                <h3 className="text-sm font-semibold mb-3">Latch-up I-V Characteristic</h3>
                <svg viewBox="0 0 280 100" className="w-full rounded-xl bg-muted/10 border border-border">
                  {/* Axes */}
                  <line x1="25" y1="10" x2="25" y2="85" stroke="#475569" strokeWidth="1" />
                  <line x1="25" y1="85" x2="275" y2="85" stroke="#475569" strokeWidth="1" />
                  <text x="2" y="14" fontSize="7" fill="#64748b">I</text>
                  <text x="255" y="94" fontSize="7" fill="#64748b">V</text>

                  {/* Labels */}
                  <text x="26" y="94" fontSize="7" fill="#94a3b8">0</text>
                  <text x="100" y="94" fontSize="7" fill="#94a3b8">V_hold</text>
                  <text x="175" y="94" fontSize="7" fill="#94a3b8">V_trig</text>

                  {/* I-V curve: high-impedance leakage → trigger → negative resistance → holding */}
                  <polyline
                    points={`
                      25,83
                      105,80
                      120,75
                      130,55
                      135,25
                      140,50
                      160,55
                      200,58
                      250,60
                    `}
                    fill="none"
                    stroke="#a78bfa"
                    strokeWidth="2"
                  />

                  {/* Holding point marker */}
                  <circle cx="105" cy="80" r="3" fill="#22c55e" />
                  <text x="88" y="76" fontSize="7" fill="#22c55e">Hold</text>

                  {/* Trigger point marker */}
                  <circle cx="135" cy="25" r="3" fill="#ef4444" />
                  <text x="138" y="22" fontSize="7" fill="#ef4444">Trigger</text>

                  {/* NDR region label */}
                  <text x="136" y="42" fontSize="7" fill="#f59e0b" transform="rotate(-70,136,42)">
                    NDR
                  </text>
                </svg>
                <p className="text-xs text-muted-foreground mt-2">
                  Latch-up: parasitic PNPN thyristor latches on when V exceeds V_trigger. Once
                  triggered, holding voltage V_hold sustains conduction even at low supply — destructive
                  if current not limited. Guard rings and layout rules prevent latch-up in CMOS.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer formula reference ─────────────────────────────────────────── */}
        <section className="bg-card rounded-2xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Formula Reference</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono text-muted-foreground">
            {[
              { title: "Wire Resistance", eq: "R = ρ / (W·t)  [mΩ/mm]" },
              { title: "Gate Capacitance", eq: "C = ε₀·εᵣ·W·L / H  [fF]" },
              { title: "Partial Inductance", eq: "L = µ₀/2π · ln(2H/W)  [pH/mm]" },
              { title: "Coupling Cap", eq: "C_c = ε₀·εᵣ·L·t / d  [fF]" },
              { title: "NEXT", eq: "NEXT = (C_c/C_s) · V/4" },
              { title: "FEXT", eq: "FEXT = (C_c/C_s) · T_d/T_r" },
              { title: "Stripline Z₀", eq: "Z₀ = (60/√εᵣ)·ln(4H/0.67πW)" },
              { title: "SSN", eq: "V_SSN = L_loop · I_swing/T_r" },
              { title: "Dipole P_rad", eq: "P = 80π²·(I·l/λ)²  [W]" },
            ].map((f) => (
              <div key={f.title} className="bg-muted/20 rounded-lg p-3">
                <p className="text-foreground font-semibold text-xs mb-1">{f.title}</p>
                <p>{f.eq}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
