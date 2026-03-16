"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Database,
  Layers,
  Cpu,
  Activity,
  Zap,
  AlertTriangle,
  CheckCircle,
  Info,
  ChevronRight,
} from "lucide-react";

// ─────────────────────────────────────────────
// Physics constants
// ─────────────────────────────────────────────
const I_CELL_CHARGE = 2e-15; // Coulombs per cell
const V_DD_DRAM = 1.1; // V
const T_RAS_NS = 50e-9; // seconds

// ─────────────────────────────────────────────
// Typed helpers
// ─────────────────────────────────────────────
interface CacheLevel {
  name: string;
  sizeLabel: string;
  ways: number;
  latency: number;
}

const CACHE_LEVELS: CacheLevel[] = [
  { name: "L1", sizeLabel: "32 KB", ways: 4, latency: 1 },
  { name: "L2", sizeLabel: "256 KB", ways: 8, latency: 10 },
  { name: "L3", sizeLabel: "8 MB", ways: 16, latency: 40 },
  { name: "DRAM", sizeLabel: "16 GB", ways: 0, latency: 200 },
];

interface Workload {
  label: string;
  oi: number;
  color: string;
}

const WORKLOADS: Workload[] = [
  { label: "GEMM", oi: 10, color: "#22d3ee" },
  { label: "Conv", oi: 2, color: "#a78bfa" },
  { label: "Attention", oi: 0.3, color: "#fb923c" },
];

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function formatWsLabel(wsKB: number): string {
  if (wsKB >= 1024 * 1024) return `${(wsKB / 1048576).toFixed(0)} GB`;
  if (wsKB >= 1024) return `${(wsKB / 1024).toFixed(0)} MB`;
  return `${wsKB} KB`;
}

// ─────────────────────────────────────────────
// Formula Card component
// ─────────────────────────────────────────────
function FormulaCard({
  label,
  formula,
  explanation,
}: {
  label: string;
  formula: string;
  explanation: string;
}) {
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{label}</p>
      <p className="font-mono text-sm">{formula}</p>
      <p className="text-xs text-muted-foreground mt-1">{explanation}</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function MemoryHierarchyPage() {
  // ── Section 1: 6T SRAM ──
  const [beta, setBeta] = useState(2.0);
  const [alpha, setAlpha] = useState(1.0);
  const [vddSram, setVddSram] = useState(1.0);
  const [sramMode, setSramMode] = useState<"read" | "write">("read");

  const snmRaw = (vddSram - 0.4) * (1 - Math.sqrt(alpha / (1 + beta)));
  const snm = clamp(snmRaw, 0, 999);

  // ── Section 2: Cache Hierarchy ──
  const [wsSlider, setWsSlider] = useState(10);
  const wsKB = Math.round(Math.pow(2, wsSlider));

  const H1 = wsKB <= 32 ? 0.97 : wsKB <= 256 ? 0.80 : wsKB <= 8192 ? 0.50 : 0.20;
  const H2 = wsKB <= 256 ? 0.95 : wsKB <= 8192 ? 0.75 : 0.35;
  const H3 = wsKB <= 8192 ? 0.90 : 0.55;
  const H_DRAM = 1.0;

  const amat = 1 + (1 - H1) * (10 + (1 - H2) * (40 + (1 - H3) * 200));

  const l1Contrib = 1;
  const l2Contrib = (1 - H1) * 10;
  const l3Contrib = (1 - H1) * (1 - H2) * 40;
  const dramContrib = (1 - H1) * (1 - H2) * (1 - H3) * 200;
  const totalContrib = l1Contrib + l2Contrib + l3Contrib + dramContrib;

  const l1Pct = (l1Contrib / totalContrib) * 100;
  const l2Pct = (l2Contrib / totalContrib) * 100;
  const l3Pct = (l3Contrib / totalContrib) * 100;
  const dramPct = (dramContrib / totalContrib) * 100;

  // ── Section 3: DRAM Refresh ──
  const [tRefSlider, setTRefSlider] = useState(6);
  const [rowCount, setRowCount] = useState(16384);
  const [tempDram, setTempDram] = useState(55);

  const tRefMs = Math.pow(2, tRefSlider);
  const tau = 64 * Math.exp(-(tempDram - 55) / 10);
  const refRate = 1 / (tRefMs / 1000);
  const pRefPw = rowCount * I_CELL_CHARGE * V_DD_DRAM * refRate * 1e12;
  const pRefUw = pRefPw / 1e6;
  const refreshOverheadPct = rowCount * T_RAS_NS * refRate * 100;
  const retentionOk = Math.exp(-tRefMs / tau) > 0.5;

  // ── Section 4: Memory Bandwidth ──
  const [busWidth, setBusWidth] = useState<32 | 64 | 128>(64);
  const [fMemMHz, setFMemMHz] = useState(3200);
  const [channels, setChannels] = useState(2);
  const [efficiency, setEfficiency] = useState(75);

  const bwGBs = (busWidth / 8) * ((fMemMHz * 2) / 1000) * channels * (efficiency / 100);

  // ── Section 5: Roofline ──
  const [peakGflops, setPeakGflops] = useState(100);
  const [peakBwGBs, setPeakBwGBs] = useState(200);

  const ridgeOI = peakGflops / peakBwGBs;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* ── Header ── */}
        <div className="bg-cyan-500/20 rounded-xl border border-cyan-500/30 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Layers className="w-6 h-6 text-cyan-400" />
            </div>
            <h1 className="text-2xl font-bold text-cyan-400">Memory Hierarchy</h1>
          </div>
          <p className="text-muted-foreground">
            SRAM cells, cache AMAT, DRAM refresh, bandwidth, and roofline model
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              { icon: Cpu, label: "6T SRAM Cell" },
              { icon: Layers, label: "Cache AMAT" },
              { icon: Database, label: "DRAM Refresh" },
              { icon: Activity, label: "Bandwidth" },
              { icon: Zap, label: "Roofline" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-3 py-1 text-xs text-cyan-400"
              >
                <Icon className="w-3 h-3" />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            Section 1: 6T SRAM Cell
        ══════════════════════════════════════════════ */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold">6T SRAM Cell</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Controls */}
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground flex justify-between mb-1">
                  <span>Cell Ratio β (W_pd/W_pg)</span>
                  <span className="font-mono text-foreground">{beta.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={0.1}
                  value={beta}
                  onChange={(e) => setBeta(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground flex justify-between mb-1">
                  <span>Access Ratio α</span>
                  <span className="font-mono text-foreground">{alpha.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  value={alpha}
                  onChange={(e) => setAlpha(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground flex justify-between mb-1">
                  <span>VDD</span>
                  <span className="font-mono text-foreground">{vddSram.toFixed(2)} V</span>
                </label>
                <input
                  type="range"
                  min={0.7}
                  max={1.2}
                  step={0.05}
                  value={vddSram}
                  onChange={(e) => setVddSram(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>

              {/* Mode toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setSramMode("read")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    sramMode === "read"
                      ? "bg-green-500/20 border-green-500/50 text-green-400"
                      : "bg-card border-border text-muted-foreground hover:border-green-500/30"
                  }`}
                >
                  Read Mode
                </button>
                <button
                  onClick={() => setSramMode("write")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    sramMode === "write"
                      ? "bg-orange-500/20 border-orange-500/50 text-orange-400"
                      : "bg-card border-border text-muted-foreground hover:border-orange-500/30"
                  }`}
                >
                  Write Mode
                </button>
              </div>

              {/* SNM metric */}
              <div
                className={`rounded-lg border p-4 flex items-center gap-3 ${
                  snm > 0.1
                    ? "border-green-500/40 bg-green-500/10"
                    : "border-red-500/40 bg-red-500/10"
                }`}
              >
                {snm > 0.1 ? (
                  <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                )}
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-semibold">
                    Static Noise Margin
                  </p>
                  <p
                    className={`text-2xl font-mono font-bold ${
                      snm > 0.1 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {(snm * 1000).toFixed(1)} mV
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {snm > 0.1 ? "Stable — good read stability" : "Unstable — cell may flip during read"}
                  </p>
                </div>
              </div>

              <FormulaCard
                label="Static Noise Margin"
                formula="SNM ≈ (VDD − Vth) · (1 − √(α / (1 + β)))"
                explanation="β = pull-down/pass-gate ratio; α = access/pull-up ratio. Larger β and smaller α improve SNM."
              />
            </div>

            {/* SVG Schematic */}
            <div className="flex flex-col items-center">
              <p className="text-xs text-muted-foreground mb-2">6T SRAM Schematic</p>
              <svg
                viewBox="0 0 300 220"
                className="w-full max-w-sm border border-border rounded-lg bg-muted/10"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* VDD rail */}
                <line x1="60" y1="20" x2="240" y2="20" stroke="#6b7280" strokeWidth="1.5" />
                <text x="150" y="14" textAnchor="middle" fontSize="10" fill="#9ca3af">VDD</text>

                {/* GND rail */}
                <line x1="60" y1="200" x2="240" y2="200" stroke="#6b7280" strokeWidth="1.5" />
                <text x="150" y="215" textAnchor="middle" fontSize="10" fill="#9ca3af">GND</text>

                {/* ─── Left inverter ─── */}
                {/* M3 PMOS — blue tint */}
                <rect x="60" y="25" width="40" height="30" rx="3"
                  fill={sramMode === "write" ? "#1e3a5f" : "#1e3a5f"}
                  stroke={sramMode === "write" ? "#fb923c" : "#3b82f6"} strokeWidth="1.5" />
                <text x="80" y="44" textAnchor="middle" fontSize="9" fill="#93c5fd">M3</text>
                <text x="80" y="54" textAnchor="middle" fontSize="7" fill="#6b7280">PMOS</text>

                {/* M1 NMOS — green tint */}
                <rect x="60" y="130" width="40" height="30" rx="3"
                  fill="#0f2e1a"
                  stroke={sramMode === "read" ? "#22c55e" : "#16a34a"} strokeWidth="1.5" />
                <text x="80" y="149" textAnchor="middle" fontSize="9" fill="#86efac">M1</text>
                <text x="80" y="159" textAnchor="middle" fontSize="7" fill="#6b7280">NMOS</text>

                {/* Left inverter vertical connections */}
                <line x1="80" y1="55" x2="80" y2="130" stroke="#6b7280" strokeWidth="1" />
                <line x1="80" y1="20" x2="80" y2="25" stroke="#6b7280" strokeWidth="1.5" />
                <line x1="80" y1="160" x2="80" y2="200" stroke="#6b7280" strokeWidth="1.5" />

                {/* Q node */}
                <circle cx="80" cy="100" r="4" fill="#22d3ee" />
                <text x="68" y="103" textAnchor="end" fontSize="9" fill="#22d3ee">Q</text>

                {/* ─── Right inverter ─── */}
                {/* M4 PMOS — blue tint */}
                <rect x="200" y="25" width="40" height="30" rx="3"
                  fill="#1e3a5f"
                  stroke={sramMode === "write" ? "#fb923c" : "#3b82f6"} strokeWidth="1.5" />
                <text x="220" y="44" textAnchor="middle" fontSize="9" fill="#93c5fd">M4</text>
                <text x="220" y="54" textAnchor="middle" fontSize="7" fill="#6b7280">PMOS</text>

                {/* M2 NMOS — green tint */}
                <rect x="200" y="130" width="40" height="30" rx="3"
                  fill="#0f2e1a"
                  stroke={sramMode === "read" ? "#22c55e" : "#16a34a"} strokeWidth="1.5" />
                <text x="220" y="149" textAnchor="middle" fontSize="9" fill="#86efac">M2</text>
                <text x="220" y="159" textAnchor="middle" fontSize="7" fill="#6b7280">NMOS</text>

                {/* Right inverter vertical connections */}
                <line x1="220" y1="55" x2="220" y2="130" stroke="#6b7280" strokeWidth="1" />
                <line x1="220" y1="20" x2="220" y2="25" stroke="#6b7280" strokeWidth="1.5" />
                <line x1="220" y1="160" x2="220" y2="200" stroke="#6b7280" strokeWidth="1.5" />

                {/* QB node */}
                <circle cx="220" cy="100" r="4" fill="#a78bfa" />
                <text x="232" y="103" textAnchor="start" fontSize="9" fill="#a78bfa">QB</text>

                {/* Cross-coupled gate wires */}
                {/* Q → gate of right inverter */}
                <path d="M 80 100 L 80 85 L 195 85 L 195 92" stroke="#22d3ee" strokeWidth="1" fill="none" strokeDasharray="3,2" />
                {/* QB → gate of left inverter */}
                <path d="M 220 100 L 220 115 L 105 115 L 105 108" stroke="#a78bfa" strokeWidth="1" fill="none" strokeDasharray="3,2" />

                {/* Gate connections to left inverter stack */}
                <line x1="60" y1="40" x2="50" y2="40" stroke="#a78bfa" strokeWidth="1" />
                <line x1="60" y1="145" x2="50" y2="145" stroke="#a78bfa" strokeWidth="1" />
                <line x1="50" y1="40" x2="50" y2="145" stroke="#a78bfa" strokeWidth="1" />
                <line x1="50" y1="108" x2="105" y2="108" stroke="#a78bfa" strokeWidth="1" />

                {/* Gate connections to right inverter stack */}
                <line x1="240" y1="40" x2="250" y2="40" stroke="#22d3ee" strokeWidth="1" />
                <line x1="240" y1="145" x2="250" y2="145" stroke="#22d3ee" strokeWidth="1" />
                <line x1="250" y1="40" x2="250" y2="145" stroke="#22d3ee" strokeWidth="1" />
                <line x1="250" y1="92" x2="195" y2="92" stroke="#22d3ee" strokeWidth="1" />

                {/* ─── Access transistors M5, M6 ─── */}
                {/* M5 left access — yellow tint */}
                <rect x="20" y="88" width="35" height="24" rx="3"
                  fill="#2d2500"
                  stroke={sramMode === "read" ? "#22c55e" : sramMode === "write" ? "#fb923c" : "#eab308"} strokeWidth="1.5" />
                <text x="37" y="102" textAnchor="middle" fontSize="9" fill="#fbbf24">M5</text>

                {/* M6 right access — yellow tint */}
                <rect x="245" y="88" width="35" height="24" rx="3"
                  fill="#2d2500"
                  stroke={sramMode === "read" ? "#22c55e" : sramMode === "write" ? "#fb923c" : "#eab308"} strokeWidth="1.5" />
                <text x="262" y="102" textAnchor="middle" fontSize="9" fill="#fbbf24">M6</text>

                {/* M5 connections */}
                <line x1="55" y1="100" x2="60" y2="100" stroke={sramMode === "read" ? "#22c55e" : "#fb923c"} strokeWidth="1.5" />
                <line x1="20" y1="100" x2="10" y2="100" stroke={sramMode === "read" ? "#22c55e" : "#fb923c"} strokeWidth="1.5" />

                {/* M6 connections */}
                <line x1="245" y1="100" x2="240" y2="100" stroke={sramMode === "read" ? "#22c55e" : "#fb923c"} strokeWidth="1.5" />
                <line x1="280" y1="100" x2="290" y2="100" stroke={sramMode === "read" ? "#22c55e" : "#fb923c"} strokeWidth="1.5" />

                {/* BL / BLB labels */}
                <text x="7" y="98" textAnchor="middle" fontSize="9" fill="#fbbf24">BL</text>
                <text x="293" y="98" textAnchor="middle" fontSize="9" fill="#fbbf24">BLB</text>

                {/* WL (word line) gate for M5 and M6 */}
                <line x1="37" y1="88" x2="37" y2="78" stroke="#9ca3af" strokeWidth="1" />
                <line x1="262" y1="88" x2="262" y2="78" stroke="#9ca3af" strokeWidth="1" />
                <line x1="37" y1="78" x2="262" y2="78" stroke="#9ca3af" strokeWidth="1" />
                <text x="150" y="74" textAnchor="middle" fontSize="8" fill="#9ca3af">WL</text>

                {/* Mode label */}
                <text x="150" y="195" textAnchor="middle" fontSize="8"
                  fill={sramMode === "read" ? "#22c55e" : "#fb923c"}>
                  {sramMode === "read" ? "READ: Q→M1→M5→BL" : "WRITE: BL→M5→Q"}
                </text>
              </svg>
              <p className="text-xs text-muted-foreground mt-2">
                PMOS = blue · NMOS = green · Access = yellow
              </p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            Section 2: Cache Hierarchy Simulator
        ══════════════════════════════════════════════ */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold">Cache Hierarchy Simulator</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground flex justify-between mb-1">
                  <span>Working Set Size</span>
                  <span className="font-mono text-foreground">{formatWsLabel(wsKB)}</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={18}
                  step={1}
                  value={wsSlider}
                  onChange={(e) => setWsSlider(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>1 KB</span>
                  <span>256 KB</span>
                  <span>256 MB</span>
                </div>
              </div>

              {/* AMAT display */}
              <div className="bg-muted/20 rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">AMAT</p>
                <p className="text-3xl font-mono font-bold text-cyan-400">{amat.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">cycles per access</p>
              </div>

              {/* Cache level info table */}
              <div className="space-y-1">
                {CACHE_LEVELS.map((lvl, i) => {
                  const hitRates = [H1, H2, H3, H_DRAM];
                  const hr = hitRates[i];
                  return (
                    <div key={lvl.name} className="flex items-center justify-between text-xs bg-muted/10 rounded px-2 py-1">
                      <span className="font-mono text-cyan-400 w-10">{lvl.name}</span>
                      <span className="text-muted-foreground w-16">{lvl.sizeLabel}</span>
                      <span className="text-muted-foreground w-20">
                        {lvl.ways > 0 ? `${lvl.ways}-way` : "—"}
                      </span>
                      <span className="text-muted-foreground w-16">{lvl.latency} cyc</span>
                      <span className={`w-12 text-right ${hr > 0.85 ? "text-green-400" : hr > 0.6 ? "text-yellow-400" : "text-red-400"}`}>
                        {(hr * 100).toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>

              <FormulaCard
                label="Average Memory Access Time"
                formula="AMAT = T₁ + (1−H₁)·[T₂ + (1−H₂)·[T₃ + (1−H₃)·T_DRAM]]"
                explanation="Each cache miss penalty accumulates multiplicatively through the hierarchy."
              />
            </div>

            {/* AMAT breakdown bars */}
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">AMAT Contribution by Level</p>
              {[
                { name: "L1", pct: l1Pct, contrib: l1Contrib, color: "bg-cyan-500" },
                { name: "L2", pct: l2Pct, contrib: l2Contrib, color: "bg-blue-500" },
                { name: "L3", pct: l3Pct, contrib: l3Contrib, color: "bg-purple-500" },
                { name: "DRAM", pct: dramPct, contrib: dramContrib, color: "bg-red-500" },
              ].map((row) => (
                <div key={row.name}>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span className="font-mono">{row.name}</span>
                    <span>{row.contrib.toFixed(2)} cyc ({row.pct.toFixed(1)}%)</span>
                  </div>
                  <div className="h-5 bg-muted/20 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${row.color} rounded-full`}
                      animate={{ width: `${clamp(row.pct, 0, 100)}%` }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    />
                  </div>
                </div>
              ))}

              {/* Working set regions */}
              <div className="mt-4 space-y-1">
                {[
                  { label: "L1 region", limit: "≤ 32 KB", active: wsKB <= 32 },
                  { label: "L2 region", limit: "≤ 256 KB", active: wsKB > 32 && wsKB <= 256 },
                  { label: "L3 region", limit: "≤ 8 MB", active: wsKB > 256 && wsKB <= 8192 },
                  { label: "DRAM region", limit: "> 8 MB", active: wsKB > 8192 },
                ].map((r) => (
                  <div key={r.label} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${r.active ? "bg-cyan-500/20 text-cyan-400" : "text-muted-foreground"}`}>
                    <ChevronRight className="w-3 h-3" />
                    <span>{r.label}</span>
                    <span className="ml-auto">{r.limit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            Section 3: DRAM Refresh Energy
        ══════════════════════════════════════════════ */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold">DRAM Refresh Energy</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground flex justify-between mb-1">
                  <span>Refresh Interval t_REF</span>
                  <span className="font-mono text-foreground">{tRefMs} ms</span>
                </label>
                <input
                  type="range"
                  min={5}
                  max={8}
                  step={1}
                  value={tRefSlider}
                  onChange={(e) => setTRefSlider(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>32 ms</span>
                  <span>64 ms</span>
                  <span>128 ms</span>
                  <span>256 ms</span>
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground flex justify-between mb-1">
                  <span>Row Count</span>
                  <span className="font-mono text-foreground">{rowCount.toLocaleString()}</span>
                </label>
                <input
                  type="range"
                  min={4096}
                  max={65536}
                  step={4096}
                  value={rowCount}
                  onChange={(e) => setRowCount(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground flex justify-between mb-1">
                  <span>Temperature</span>
                  <span className="font-mono text-foreground">{tempDram} °C</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={85}
                  step={1}
                  value={tempDram}
                  onChange={(e) => setTempDram(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Refresh Power</p>
                  <p className="text-xl font-mono font-bold text-cyan-400">{pRefUw.toFixed(2)} µW</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Refresh Overhead</p>
                  <p className="text-xl font-mono font-bold text-purple-400">{refreshOverheadPct.toFixed(2)}%</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Retention τ</p>
                  <p className="text-xl font-mono font-bold text-blue-400">{tau.toFixed(1)} ms</p>
                </div>
                <div
                  className={`rounded-lg p-3 border ${retentionOk ? "border-green-500/40 bg-green-500/10" : "border-red-500/40 bg-red-500/10"}`}
                >
                  <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Retention</p>
                  <div className="flex items-center gap-1.5">
                    {retentionOk ? (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    )}
                    <span className={`text-sm font-semibold ${retentionOk ? "text-green-400" : "text-red-400"}`}>
                      {retentionOk ? "OK" : "Fail"}
                    </span>
                  </div>
                </div>
              </div>

              <FormulaCard
                label="DRAM Refresh Power"
                formula="P_ref = N_rows · I_cell · V_dd · (t_RAS / t_REF)"
                explanation="Retention halves every ~10°C. Longer t_REF reduces power but requires sufficient cell retention."
              />
            </div>

            {/* Charge decay SVG */}
            <div className="flex flex-col items-center">
              <p className="text-xs text-muted-foreground mb-2">Charge Decay: Q(t) = Q₀·e^(−t/τ)</p>
              {(() => {
                const svgW = 300;
                const svgH = 200;
                const padL = 40;
                const padR = 20;
                const padT = 15;
                const padB = 30;
                const plotW = svgW - padL - padR;
                const plotH = svgH - padT - padB;

                const tMax = Math.max(tRefMs * 1.5, 10);

                function toSvgX(t: number): number {
                  return padL + (t / tMax) * plotW;
                }
                function toSvgY(q: number): number {
                  return padT + plotH - q * plotH;
                }

                // Build decay path points
                const nPts = 80;
                const pathPts: string[] = [];
                for (let i = 0; i <= nPts; i++) {
                  const t = (i / nPts) * tMax;
                  const q = Math.exp(-t / tau);
                  const x = toSvgX(t);
                  const y = toSvgY(q);
                  pathPts.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
                }
                const decayPath = pathPts.join(" ");

                const tRefX = toSvgX(tRefMs);
                const qAtTRef = Math.exp(-tRefMs / tau);
                const tRefY = toSvgY(qAtTRef);
                const halfY = toSvgY(0.5);

                return (
                  <svg
                    viewBox={`0 0 ${svgW} ${svgH}`}
                    className="w-full max-w-sm border border-border rounded-lg bg-muted/10"
                  >
                    {/* Axes */}
                    <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#6b7280" strokeWidth="1" />
                    <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#6b7280" strokeWidth="1" />

                    {/* Y axis labels */}
                    <text x={padL - 4} y={padT + 4} textAnchor="end" fontSize="8" fill="#9ca3af">Q₀</text>
                    <text x={padL - 4} y={halfY + 3} textAnchor="end" fontSize="8" fill="#9ca3af">0.5</text>
                    <text x={padL - 4} y={padT + plotH + 3} textAnchor="end" fontSize="8" fill="#9ca3af">0</text>

                    {/* X axis label */}
                    <text x={padL + plotW / 2} y={svgH - 2} textAnchor="middle" fontSize="8" fill="#9ca3af">
                      Time (ms)
                    </text>

                    {/* 0.5 Q₀ threshold line */}
                    <line
                      x1={padL}
                      y1={halfY}
                      x2={padL + plotW}
                      y2={halfY}
                      stroke="#6b7280"
                      strokeWidth="1"
                      strokeDasharray="4,3"
                    />

                    {/* Decay curve */}
                    <path d={decayPath} stroke="#22d3ee" strokeWidth="2" fill="none" />

                    {/* t_REF vertical dashed line */}
                    <line
                      x1={tRefX}
                      y1={padT}
                      x2={tRefX}
                      y2={padT + plotH}
                      stroke="#fb923c"
                      strokeWidth="1.5"
                      strokeDasharray="4,3"
                    />
                    <text x={tRefX} y={padT + 10} textAnchor="middle" fontSize="8" fill="#fb923c">
                      t_REF
                    </text>

                    {/* Dot at Q(t_REF) */}
                    <circle
                      cx={tRefX}
                      cy={tRefY}
                      r="4"
                      fill={retentionOk ? "#22c55e" : "#ef4444"}
                    />
                    <text x={tRefX + 6} y={tRefY - 4} fontSize="8" fill={retentionOk ? "#22c55e" : "#ef4444"}>
                      {retentionOk ? "OK" : "FAIL"}
                    </text>
                  </svg>
                );
              })()}
              <p className="text-xs text-muted-foreground mt-2">
                Orange = t_REF · Dot = Q(t_REF) · {retentionOk ? "Above 50% threshold ✓" : "Below 50% threshold ✗"}
              </p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            Section 4: Memory Bandwidth Calculator
        ══════════════════════════════════════════════ */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold">Memory Bandwidth Calculator</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              {/* Bus width toggle */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Bus Width</p>
                <div className="flex gap-2">
                  {([32, 64, 128] as const).map((w) => (
                    <button
                      key={w}
                      onClick={() => setBusWidth(w)}
                      className={`flex-1 py-2 rounded-lg text-sm font-mono font-medium border transition-colors ${
                        busWidth === w
                          ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400"
                          : "bg-card border-border text-muted-foreground hover:border-cyan-500/30"
                      }`}
                    >
                      {w}-bit
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-muted-foreground flex justify-between mb-1">
                  <span>Memory Frequency</span>
                  <span className="font-mono text-foreground">{fMemMHz} MHz</span>
                </label>
                <input
                  type="range"
                  min={800}
                  max={6400}
                  step={200}
                  value={fMemMHz}
                  onChange={(e) => setFMemMHz(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground flex justify-between mb-1">
                  <span>Channels</span>
                  <span className="font-mono text-foreground">{channels}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={channels}
                  onChange={(e) => setChannels(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground flex justify-between mb-1">
                  <span>Efficiency</span>
                  <span className="font-mono text-foreground">{efficiency}%</span>
                </label>
                <input
                  type="range"
                  min={50}
                  max={90}
                  step={5}
                  value={efficiency}
                  onChange={(e) => setEfficiency(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>

              {/* BW result */}
              <div
                className={`rounded-lg border p-4 ${
                  bwGBs > 192
                    ? "border-green-500/40 bg-green-500/10"
                    : bwGBs > 68
                    ? "border-yellow-500/40 bg-yellow-500/10"
                    : "border-red-500/40 bg-red-500/10"
                }`}
              >
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Bandwidth</p>
                <p
                  className={`text-3xl font-mono font-bold ${
                    bwGBs > 192 ? "text-green-400" : bwGBs > 68 ? "text-yellow-400" : "text-red-400"
                  }`}
                >
                  {bwGBs.toFixed(1)} GB/s
                </p>
                <p className="text-xs text-muted-foreground">
                  {bwGBs > 192 ? "Above DDR5 peak" : bwGBs > 68 ? "Above LPDDR4 peak" : "Below LPDDR4 peak"}
                </p>
              </div>

              <FormulaCard
                label="Memory Bandwidth"
                formula="BW = (bus_width/8) · f_mem · 2 · n_channels · η"
                explanation="DDR doubles the data rate. η accounts for row-open overhead, command overhead, and refresh pauses."
              />
            </div>

            {/* Bandwidth SVG bar chart */}
            <div className="flex flex-col items-center">
              <p className="text-xs text-muted-foreground mb-2">Bandwidth vs. Reference Points</p>
              {(() => {
                const svgW = 320;
                const svgH = 200;
                const padL = 50;
                const padR = 15;
                const padT = 15;
                const padB = 30;
                const plotH = svgH - padT - padB;
                const plotW = svgW - padL - padR;
                const maxY = 1500;

                function toSvgX2(fraction: number): number {
                  return padL + fraction * plotW;
                }
                function toSvgY2(val: number): number {
                  return padT + plotH - (val / maxY) * plotH;
                }

                const refs = [
                  { label: "LPDDR4", val: 68, color: "#f59e0b" },
                  { label: "DDR5", val: 192, color: "#3b82f6" },
                  { label: "HBM3", val: 1229, color: "#8b5cf6" },
                ];

                const barColor = bwGBs > 192 ? "#22c55e" : bwGBs > 68 ? "#f59e0b" : "#ef4444";
                const barTopY = toSvgY2(Math.min(bwGBs, maxY));
                const barBottomY = toSvgY2(0);

                // Y axis ticks
                const yTicks = [0, 200, 400, 600, 800, 1000, 1200, 1500];

                return (
                  <svg
                    viewBox={`0 0 ${svgW} ${svgH}`}
                    className="w-full max-w-sm border border-border rounded-lg bg-muted/10"
                  >
                    {/* Y axis */}
                    <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#6b7280" strokeWidth="1" />
                    <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#6b7280" strokeWidth="1" />

                    {/* Y ticks */}
                    {yTicks.map((v) => (
                      <g key={v}>
                        <line x1={padL - 3} y1={toSvgY2(v)} x2={padL} y2={toSvgY2(v)} stroke="#6b7280" strokeWidth="1" />
                        <text x={padL - 5} y={toSvgY2(v) + 3} textAnchor="end" fontSize="7" fill="#9ca3af">{v}</text>
                      </g>
                    ))}

                    {/* Y axis label */}
                    <text
                      x={10}
                      y={padT + plotH / 2}
                      textAnchor="middle"
                      fontSize="8"
                      fill="#9ca3af"
                      transform={`rotate(-90, 10, ${padT + plotH / 2})`}
                    >
                      GB/s
                    </text>

                    {/* Reference dashed lines */}
                    {refs.map((r) => {
                      const y = toSvgY2(r.val);
                      return (
                        <g key={r.label}>
                          <line
                            x1={padL}
                            y1={y}
                            x2={padL + plotW}
                            y2={y}
                            stroke={r.color}
                            strokeWidth="1"
                            strokeDasharray="5,3"
                            opacity="0.7"
                          />
                          <text x={padL + plotW - 2} y={y - 2} textAnchor="end" fontSize="7" fill={r.color}>
                            {r.label} {r.val}
                          </text>
                        </g>
                      );
                    })}

                    {/* Our BW bar */}
                    <rect
                      x={toSvgX2(0.15)}
                      y={barTopY}
                      width={plotW * 0.4}
                      height={barBottomY - barTopY}
                      fill={barColor}
                      opacity="0.8"
                      rx="3"
                    />

                    {/* Bar label */}
                    <text
                      x={toSvgX2(0.15) + (plotW * 0.4) / 2}
                      y={barTopY - 4}
                      textAnchor="middle"
                      fontSize="9"
                      fill={barColor}
                      fontWeight="bold"
                    >
                      {bwGBs.toFixed(0)}
                    </text>
                    <text
                      x={toSvgX2(0.15) + (plotW * 0.4) / 2}
                      y={barBottomY + 12}
                      textAnchor="middle"
                      fontSize="8"
                      fill="#9ca3af"
                    >
                      Your BW
                    </text>
                  </svg>
                );
              })()}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            Section 5: Roofline Model
        ══════════════════════════════════════════════ */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold">Roofline Model</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground flex justify-between mb-1">
                  <span>Peak Compute</span>
                  <span className="font-mono text-foreground">{peakGflops} GFLOP/s</span>
                </label>
                <input
                  type="range"
                  min={10}
                  max={1000}
                  step={10}
                  value={peakGflops}
                  onChange={(e) => setPeakGflops(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground flex justify-between mb-1">
                  <span>Peak Bandwidth</span>
                  <span className="font-mono text-foreground">{peakBwGBs} GB/s</span>
                </label>
                <input
                  type="range"
                  min={10}
                  max={2000}
                  step={10}
                  value={peakBwGBs}
                  onChange={(e) => setPeakBwGBs(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>

              {/* Ridge point */}
              <div className="bg-muted/20 rounded-lg p-4">
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Ridge Point (I*)</p>
                <p className="text-2xl font-mono font-bold text-cyan-400">
                  {ridgeOI.toFixed(3)} FLOP/byte
                </p>
                <p className="text-xs text-muted-foreground">
                  Kernels with OI &gt; I* are compute-bound; OI &lt; I* are memory-bound
                </p>
              </div>

              {/* Workload table */}
              <div className="space-y-2">
                {WORKLOADS.map((w) => {
                  const perf = Math.min(peakBwGBs * w.oi, peakGflops);
                  const isBound = w.oi < ridgeOI ? "Memory" : "Compute";
                  return (
                    <div key={w.label} className="flex items-center gap-3 bg-muted/10 rounded-lg px-3 py-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: w.color }} />
                      <span className="font-mono text-sm w-20">{w.label}</span>
                      <span className="text-xs text-muted-foreground w-20">OI={w.oi} F/B</span>
                      <span className="text-xs font-mono w-24">{perf.toFixed(1)} GFLOP/s</span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded text-xs ${
                          isBound === "Memory"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-green-500/20 text-green-400"
                        }`}
                      >
                        {isBound}
                      </span>
                    </div>
                  );
                })}
              </div>

              <FormulaCard
                label="Roofline Model"
                formula="Perf = min(I · BW, Peak_FLOPS)"
                explanation="I = arithmetic intensity (FLOP/byte). Ridge point I* = Peak_FLOPS / BW separates memory and compute bound regions."
              />
            </div>

            {/* Roofline SVG */}
            <div className="flex flex-col items-center">
              <p className="text-xs text-muted-foreground mb-2">Roofline Chart (log-log scale)</p>
              {(() => {
                function logX(oi: number): number {
                  return 40 + (Math.log10(oi / 0.01) / Math.log10(100 / 0.01)) * 260;
                }
                function logY(gflops: number): number {
                  return 180 - (Math.log10(gflops / 1) / Math.log10(10000 / 1)) * 170;
                }

                const oiMin = 0.01;
                const oiMax = 100;
                const perfMin = 1;

                // Memory roof: from oiMin to ridge
                const memRoofPts: string[] = [];
                const nRoofPts = 50;
                for (let i = 0; i <= nRoofPts; i++) {
                  const oi = oiMin * Math.pow(oiMax / oiMin, i / nRoofPts);
                  if (oi > ridgeOI) break;
                  const perf = clamp(peakBwGBs * oi, perfMin, peakGflops);
                  memRoofPts.push(`${i === 0 ? "M" : "L"} ${logX(oi)} ${logY(perf)}`);
                }
                // Complete to ridge
                memRoofPts.push(`L ${logX(ridgeOI)} ${logY(peakGflops)}`);

                // Compute roof: from ridge to oiMax
                const compRoofPath = `M ${logX(ridgeOI)} ${logY(peakGflops)} L ${logX(oiMax)} ${logY(peakGflops)}`;

                // X axis ticks (log)
                const xTicks = [0.01, 0.1, 1, 10, 100];
                // Y axis ticks (log)
                const yTicks = [1, 10, 100, 1000, 10000];

                return (
                  <svg
                    viewBox="0 0 320 200"
                    className="w-full max-w-sm border border-border rounded-lg bg-muted/10"
                  >
                    {/* Axes */}
                    <line x1="40" y1="10" x2="40" y2="185" stroke="#6b7280" strokeWidth="1" />
                    <line x1="40" y1="185" x2="305" y2="185" stroke="#6b7280" strokeWidth="1" />

                    {/* X ticks */}
                    {xTicks.map((v) => {
                      const x = logX(v);
                      return (
                        <g key={v}>
                          <line x1={x} y1="185" x2={x} y2="188" stroke="#6b7280" strokeWidth="1" />
                          <text x={x} y="196" textAnchor="middle" fontSize="7" fill="#9ca3af">{v}</text>
                        </g>
                      );
                    })}

                    {/* Y ticks */}
                    {yTicks.map((v) => {
                      const y = logY(v);
                      return (
                        <g key={v}>
                          <line x1="37" y1={y} x2="40" y2={y} stroke="#6b7280" strokeWidth="1" />
                          <text x="35" y={y + 3} textAnchor="end" fontSize="7" fill="#9ca3af">{v}</text>
                        </g>
                      );
                    })}

                    {/* Axis labels */}
                    <text x="175" y="208" textAnchor="middle" fontSize="8" fill="#9ca3af">
                      Arithmetic Intensity (FLOP/byte)
                    </text>

                    {/* Memory-bound region label */}
                    <text x="70" y="170" textAnchor="middle" fontSize="8" fill="#6b7280" opacity="0.8">
                      mem-bound
                    </text>

                    {/* Compute-bound region label */}
                    <text x="230" y="30" textAnchor="middle" fontSize="8" fill="#6b7280" opacity="0.8">
                      compute-bound
                    </text>

                    {/* Memory roof */}
                    <path d={memRoofPts.join(" ")} stroke="#22d3ee" strokeWidth="2" fill="none" />

                    {/* Compute roof */}
                    <path d={compRoofPath} stroke="#f97316" strokeWidth="2" fill="none" />

                    {/* Ridge point marker */}
                    <circle cx={logX(ridgeOI)} cy={logY(peakGflops)} r="4" fill="#fbbf24" />
                    <text x={logX(ridgeOI)} y={logY(peakGflops) - 6} textAnchor="middle" fontSize="7" fill="#fbbf24">
                      I*
                    </text>

                    {/* Peak FLOPS label */}
                    <text x={logX(50)} y={logY(peakGflops) - 5} textAnchor="middle" fontSize="7" fill="#f97316">
                      {peakGflops} GFLOP/s
                    </text>

                    {/* Workload dots */}
                    {WORKLOADS.map((w) => {
                      const perf = Math.min(peakBwGBs * w.oi, peakGflops);
                      const cx = logX(w.oi);
                      const cy = logY(perf);
                      const isMem = w.oi < ridgeOI;
                      return (
                        <g key={w.label}>
                          <circle cx={cx} cy={cy} r="5" fill={w.color} />
                          <text x={cx} y={cy - 8} textAnchor="middle" fontSize="8" fill={w.color} fontWeight="bold">
                            {w.label}
                          </text>
                          <text x={cx} y={cy + 16} textAnchor="middle" fontSize="7" fill="#9ca3af">
                            {isMem ? "mem" : "cmp"}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                );
              })()}
              <p className="text-xs text-muted-foreground mt-2">
                Cyan = memory roof · Orange = compute roof · Yellow = ridge point I*
              </p>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            Bottom Formula Reference Card
        ══════════════════════════════════════════════ */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold">Formula Reference</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FormulaCard
              label="Static Noise Margin"
              formula="SNM ≈ (VDD−Vth)·(1−√(α/(1+β)))"
              explanation="SRAM read stability metric; increases with β (cell ratio)"
            />
            <FormulaCard
              label="Cache AMAT"
              formula="AMAT = T₁ + (1−H₁)·[T₂ + (1−H₂)·[T₃ + (1−H₃)·T_DRAM]]"
              explanation="Recursive miss-penalty formulation across all cache levels"
            />
            <FormulaCard
              label="DRAM Refresh Power"
              formula="P_ref = N_rows · I_cell · V_dd · t_RAS / t_REF"
              explanation="Higher temperature or longer t_REF interval reduces refresh power"
            />
            <FormulaCard
              label="Roofline Performance"
              formula="Perf = min(I · BW_peak, FLOPS_peak)"
              explanation="Arithmetic intensity I (FLOP/byte) determines compute vs. memory bottleneck"
            />
          </div>
        </div>

      </div>
    </main>
  );
}
