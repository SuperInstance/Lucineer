"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  Zap,
  Activity,
  Cpu,
  Shield,
  AlertTriangle,
  CheckCircle,
  Layers,
  Info,
  ChevronRight,
} from "lucide-react";

// ── Physics constants ──────────────────────────────────────────────────────────
const R_BUF_BASE = 50; // Ω
const C_WIRE_PER_UM = 0.2e-15; // F/µm
const T_BUF_BASE = 50e-12; // s

const BASE_DELAYS_NS: number[] = [
  1.2, 0.8, 1.5, 0.9, 1.8, 1.1, 0.7, 1.6, 1.3, 0.6, 1.9, 1.0, 1.4, 0.8,
  2.0, 0.9, 1.7, 1.2, 1.1, 1.5,
];

const GATE_C_PF: number[] = [50, 30, 80, 45]; // pF per block
const GATE_NAMES: string[] = ["ALU", "Cache", "Datapath", "Controller"];

const DOMAIN_NAMES: string[] = ["CPU Core", "GPU", "Memory Ctrl", "I/O Ring", "Always-On"];
const DOMAIN_C_PF: number[] = [200, 150, 80, 60, 20];
const DOMAIN_ACTIVITY: number[] = [0.7, 0.9, 0.5, 0.6, 0.3];

// ── Typed helpers ──────────────────────────────────────────────────────────────
interface PathSlack {
  index: number;
  delay: number;
  slack: number;
}

function clampPct(val: number, max: number): number {
  if (max === 0) return 0;
  return Math.max(0, Math.min(100, (val / max) * 100));
}

function polarToXY(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polarToXY(cx, cy, r, startDeg);
  const end = polarToXY(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function logScale(val: number, minVal: number, maxVal: number, width: number): number {
  return ((Math.log10(val) - Math.log10(minVal)) / (Math.log10(maxVal) - Math.log10(minVal))) * width;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ClockPowerPage() {
  // Section 1: Clock Tree Synthesis
  const [bufDrive, setBufDrive] = useState<number>(5);
  const [wireLenUm, setWireLenUm] = useState<number>(200);

  // Section 2: Setup/Hold Slack
  const [tClkNs, setTClkNs] = useState<number>(2.0);

  // Section 3: Clock Gating
  const [blockEnabled, setBlockEnabled] = useState<boolean[]>([true, true, true, true]);
  const [toggleRates, setToggleRates] = useState<number[]>([80, 40, 20, 60]);
  const [vddGate, setVddGate] = useState<number>(1.0);

  // Section 4: PLL
  const [fRefMHz, setFRefMHz] = useState<number>(50);
  const [divN, setDivN] = useState<number>(20);
  const [loopBwMHz, setLoopBwMHz] = useState<number>(1.0);

  // Section 5: Power Domains
  const [domainVdds, setDomainVdds] = useState<number[]>([1.0, 0.8, 1.1, 0.9, 0.7]);

  // ── Section 1 Derivations ──────────────────────────────────────────────────
  const R_buf = R_BUF_BASE / bufDrive;
  const C_wire = C_WIRE_PER_UM * wireLenUm;
  const t_level_s = R_buf * C_wire + T_BUF_BASE / bufDrive;
  const totalDelayNs = t_level_s * 3 * 1e9;
  const skewNs = 0.05 * totalDelayNs;

  const skewColor =
    skewNs < 0.1 ? "#22c55e" : skewNs < 0.3 ? "#eab308" : "#ef4444";

  // CTS binary tree node positions for SVG 320×200
  // Level 0: root at top center
  // Level 1: 2 nodes
  // Level 2: 4 nodes
  // Level 3 (leaves): 8 nodes
  const treeNodes: { x: number; y: number; level: number }[] = [];
  const treeEdges: { x1: number; y1: number; x2: number; y2: number }[] = [];

  const yPositions = [20, 65, 110, 160];
  const xSpacings = [160, 80, 40, 20];

  for (let level = 0; level < 4; level++) {
    const count = Math.pow(2, level);
    const spacing = (320 - 40) / (count + 1);
    for (let i = 0; i < count; i++) {
      const x = 20 + spacing * (i + 1);
      const y = yPositions[level];
      treeNodes.push({ x, y, level });

      if (level > 0) {
        const parentCount = Math.pow(2, level - 1);
        const parentSpacing = (320 - 40) / (parentCount + 1);
        const parentIndex = Math.floor(i / 2);
        const parentX = 20 + parentSpacing * (parentIndex + 1);
        const parentY = yPositions[level - 1];
        treeEdges.push({ x1: parentX, y1: parentY, x2: x, y2: y });
      }
    }
  }

  // ── Section 2 Derivations ──────────────────────────────────────────────────
  const T_SETUP = 0.2;
  const T_SKEW = 0.05;

  const pathSlacks: PathSlack[] = BASE_DELAYS_NS.map((d, i) => ({
    index: i,
    delay: d,
    slack: tClkNs - d - T_SETUP - T_SKEW,
  })).sort((a, b) => a.slack - b.slack);

  const failingPaths = pathSlacks.filter((p) => p.slack < 0).length;
  const worstSlack = pathSlacks[0].slack;
  const maxAbsSlack = Math.max(...pathSlacks.map((p) => Math.abs(p.slack)));

  // ── Section 3 Derivations ──────────────────────────────────────────────────
  const FREQ_GHZ = 1e9;
  const gatedPowers: number[] = GATE_C_PF.map((c, i) =>
    blockEnabled[i]
      ? (toggleRates[i] / 100) * c * 1e-12 * vddGate * vddGate * FREQ_GHZ
      : 0
  );
  const ungatedPower = GATE_C_PF.reduce(
    (sum, c) => sum + c * 1e-12 * vddGate * vddGate * FREQ_GHZ,
    0
  );
  const gatedTotal = gatedPowers.reduce((a, b) => a + b, 0);
  const savings = ungatedPower > 0 ? (1 - gatedTotal / ungatedPower) * 100 : 0;

  // Donut chart angles
  const savingsAngle = (savings / 100) * 360;
  const activeAngle = 360 - savingsAngle;

  // ── Section 4 Derivations ──────────────────────────────────────────────────
  const fOutMHz = divN * fRefMHz;
  const phaseNoiseDbc =
    -140 + 10 * Math.log10(fRefMHz / loopBwMHz);

  // Phase noise curve points for SVG 320×180
  // x: log scale 10kHz to 100MHz → SVG x: 40 to 300
  // y: -80 to -160 dBc/Hz → SVG y: 10 to 160
  const pnPoints: string[] = [];
  const freqPoints = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100]; // MHz
  freqPoints.forEach((fMHz) => {
    const svgX = 40 + logScale(fMHz, 0.01, 100, 260);
    let pnVal: number;
    if (fMHz < loopBwMHz) {
      // -20 dB/dec slope region (dominated by reference noise)
      pnVal = phaseNoiseDbc - 20 * Math.log10(fMHz / loopBwMHz);
    } else {
      // Flat region (VCO noise floor — simplified)
      pnVal = phaseNoiseDbc;
    }
    const svgY = 10 + ((pnVal - (-80)) / (-160 - -80)) * 150;
    pnPoints.push(`${svgX},${Math.max(10, Math.min(160, svgY))}`);
  });

  const loopBwX = 40 + logScale(loopBwMHz, 0.01, 100, 260);

  // ── Section 5 Derivations ──────────────────────────────────────────────────
  const dynPowers: number[] = DOMAIN_C_PF.map(
    (c, i) => DOMAIN_ACTIVITY[i] * c * 1e-12 * domainVdds[i] ** 2 * 1e9
  );
  const leakPowers: number[] = DOMAIN_C_PF.map(
    (c, i) => 0.01 * domainVdds[i] * c * 1e-12
  );
  const totalDynPower = dynPowers.reduce((a, b) => a + b, 0);
  const totalLeakPower = leakPowers.reduce((a, b) => a + b, 0);
  const totalPower = totalDynPower + totalLeakPower;

  let levelShifterCount = 0;
  for (let i = 0; i < domainVdds.length - 1; i++) {
    if (Math.abs(domainVdds[i] - domainVdds[i + 1]) > 0.1) levelShifterCount++;
  }

  const hasHighVdd = domainVdds.some((v) => v > 1.1);

  // Floor plan rectangles for 5 domains in SVG 320×200
  const floorPlanRects: { x: number; y: number; w: number; h: number; color: string }[] = [
    { x: 10, y: 10, w: 130, h: 90, color: "#f59e0b" },
    { x: 150, y: 10, w: 160, h: 90, color: "#8b5cf6" },
    { x: 10, y: 110, w: 90, h: 80, color: "#06b6d4" },
    { x: 110, y: 110, w: 110, h: 80, color: "#10b981" },
    { x: 230, y: 110, w: 80, h: 80, color: "#ef4444" },
  ];

  const maxDomainPower = Math.max(...dynPowers.map((d, i) => d + leakPowers[i]));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="bg-amber-500/20 rounded-xl border border-amber-500/30 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Clock className="w-6 h-6 text-amber-400" />
            </div>
            <h1 className="text-2xl font-bold text-amber-400">
              Clock Distribution &amp; Timing
            </h1>
          </div>
          <p className="text-muted-foreground">
            Clock tree synthesis, setup/hold slack, clock gating, PLL design,
            and power domains
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {[
              { icon: Activity, label: "Clock Tree" },
              { icon: Shield, label: "Slack Analysis" },
              { icon: Zap, label: "Clock Gating" },
              { icon: Cpu, label: "PLL Design" },
              { icon: Layers, label: "Power Domains" },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="flex items-center gap-1 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-full px-3 py-1"
              >
                <Icon className="w-3 h-3" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Section 1: Clock Tree Synthesis ── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold">Clock Tree Synthesis</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Controls */}
            <div className="space-y-5">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-muted-foreground">
                    Buffer Drive Strength
                  </label>
                  <span className="text-sm font-mono text-amber-400">
                    {bufDrive}x
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={bufDrive}
                  onChange={(e) => setBufDrive(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>1x (weak)</span>
                  <span>10x (strong)</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-muted-foreground">
                    Wire Length per Level
                  </label>
                  <span className="text-sm font-mono text-amber-400">
                    {wireLenUm} µm
                  </span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={500}
                  step={50}
                  value={wireLenUm}
                  onChange={(e) => setWireLenUm(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>50 µm</span>
                  <span>500 µm</span>
                </div>
              </div>

              {/* Results */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    Insertion Delay
                  </p>
                  <p className="text-lg font-mono text-amber-400">
                    {totalDelayNs.toFixed(3)}
                    <span className="text-xs ml-1">ns</span>
                  </p>
                </div>
                <div
                  className="rounded-lg p-3"
                  style={{
                    background:
                      skewNs < 0.1
                        ? "rgba(34,197,94,0.1)"
                        : skewNs < 0.3
                        ? "rgba(234,179,8,0.1)"
                        : "rgba(239,68,68,0.1)",
                    border: `1px solid ${skewColor}40`,
                  }}
                >
                  <p className="text-xs text-muted-foreground mb-1">
                    Skew Estimate
                  </p>
                  <p
                    className="text-lg font-mono"
                    style={{ color: skewColor }}
                  >
                    {skewNs.toFixed(4)}
                    <span className="text-xs ml-1">ns</span>
                  </p>
                </div>
              </div>

              {/* Formula card */}
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                  DELAY PER LEVEL
                </p>
                <p className="font-mono text-sm">
                  t_d = R_buf · C_wire + t_buf
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  R_buf = {R_BUF_BASE}/drive · C_wire = C/µm × len
                </p>
              </div>
            </div>

            {/* SVG Tree */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                Binary tree — 3 levels → 8 leaf clocks
              </p>
              <svg
                viewBox="0 0 320 200"
                className="w-full border border-border rounded-lg bg-muted/10"
              >
                {treeEdges.map((e, i) => (
                  <line
                    key={i}
                    x1={e.x1}
                    y1={e.y1}
                    x2={e.x2}
                    y2={e.y2}
                    stroke="#4b5563"
                    strokeWidth={1.5}
                  />
                ))}
                {treeNodes.map((n, i) => {
                  const isLeaf = n.level === 3;
                  const fill = isLeaf ? skewColor : "#f59e0b";
                  return (
                    <circle
                      key={i}
                      cx={n.x}
                      cy={n.y}
                      r={isLeaf ? 5 : 7}
                      fill={fill}
                      stroke="#1e293b"
                      strokeWidth={1}
                      opacity={0.9}
                    />
                  );
                })}
                {/* Level labels */}
                <text x={4} y={24} fontSize={9} fill="#6b7280">
                  Root
                </text>
                <text x={4} y={69} fontSize={9} fill="#6b7280">
                  L1
                </text>
                <text x={4} y={114} fontSize={9} fill="#6b7280">
                  L2
                </text>
                <text x={4} y={164} fontSize={9} fill="#6b7280">
                  Leaf
                </text>
                {/* Summary */}
                <text
                  x={160}
                  y={190}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#9ca3af"
                >
                  Delay: {totalDelayNs.toFixed(3)} ns | Skew:{" "}
                  {skewNs.toFixed(4)} ns
                </text>
              </svg>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ background: "#22c55e" }}
                  />{" "}
                  &lt;0.1ns
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ background: "#eab308" }}
                  />{" "}
                  &lt;0.3ns
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ background: "#ef4444" }}
                  />{" "}
                  ≥0.3ns
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 2: Setup/Hold Slack Waterfall ── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold">Setup/Hold Slack Waterfall</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-5">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-muted-foreground">
                    Clock Period
                  </label>
                  <span className="text-sm font-mono text-amber-400">
                    {tClkNs.toFixed(1)} ns
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={5.0}
                  step={0.1}
                  value={tClkNs}
                  onChange={(e) => setTClkNs(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0.5 ns (2GHz)</span>
                  <span>5.0 ns (200MHz)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Worst Slack</p>
                  <p
                    className={`text-lg font-mono ${
                      worstSlack >= 0 ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {worstSlack >= 0 ? "+" : ""}
                    {worstSlack.toFixed(3)} ns
                  </p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">
                    Failing Paths
                  </p>
                  <p
                    className={`text-lg font-mono ${
                      failingPaths > 0 ? "text-red-400" : "text-green-400"
                    }`}
                  >
                    {failingPaths} / 20
                  </p>
                </div>
              </div>

              {failingPaths > 0 ? (
                <div className="flex items-center gap-2 border border-red-500/40 bg-red-500/10 rounded-lg p-3 text-sm text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {failingPaths} path{failingPaths > 1 ? "s" : ""} violating
                    setup
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 border border-green-500/40 bg-green-500/10 rounded-lg p-3 text-sm text-green-400">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>All paths meet timing</span>
                </div>
              )}

              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                  SETUP SLACK
                </p>
                <p className="font-mono text-sm">
                  slack = T_clk − t_comb − t_setup − t_skew
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  t_setup = 0.2ns · t_skew = 0.05ns fixed
                </p>
              </div>
            </div>

            {/* Waterfall chart */}
            <div className="md:col-span-2">
              <p className="text-xs text-muted-foreground mb-2">
                20 paths sorted by slack (ascending)
              </p>
              <div className="relative space-y-1">
                {/* Zero line reference */}
                <div className="absolute top-0 bottom-0 left-1/2 w-px border-l border-dashed border-border z-10" />

                {pathSlacks.map((path, idx) => {
                  const absPct =
                    maxAbsSlack > 0
                      ? (Math.abs(path.slack) / maxAbsSlack) * 47
                      : 0;
                  const isNeg = path.slack < 0;
                  return (
                    <div
                      key={path.index}
                      className="flex items-center h-6 relative"
                    >
                      <span className="w-6 text-xs text-muted-foreground text-right pr-1 shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 relative h-4">
                        {isNeg ? (
                          <motion.div
                            className="absolute right-1/2 top-0 h-full bg-red-500 rounded-sm origin-right"
                            animate={{ width: `${absPct}%` }}
                            transition={{
                              type: "spring",
                              stiffness: 200,
                              damping: 20,
                              delay: idx * 0.02,
                            }}
                          />
                        ) : (
                          <motion.div
                            className="absolute left-1/2 top-0 h-full bg-green-500 rounded-sm origin-left"
                            animate={{ width: `${absPct}%` }}
                            transition={{
                              type: "spring",
                              stiffness: 200,
                              damping: 20,
                              delay: idx * 0.02,
                            }}
                          />
                        )}
                      </div>
                      <span
                        className={`w-16 text-xs font-mono text-right shrink-0 ${
                          isNeg ? "text-red-400" : "text-green-400"
                        }`}
                      >
                        {path.slack >= 0 ? "+" : ""}
                        {path.slack.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span className="text-red-400">← Failing (negative slack)</span>
                <span>zero</span>
                <span className="text-green-400">Passing (positive slack) →</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 3: Clock Gating Efficiency ── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold">Clock Gating Efficiency</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Donut chart */}
            <div className="flex flex-col items-center">
              <svg viewBox="0 0 200 200" className="w-48 h-48">
                {/* Background circle */}
                <circle
                  cx={100}
                  cy={100}
                  r={70}
                  fill="none"
                  stroke="#374151"
                  strokeWidth={28}
                />
                {/* Active arc (amber) — starts at top */}
                {activeAngle > 0 && (
                  <path
                    d={describeArc(100, 100, 70, 0, Math.min(activeAngle, 359.9))}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={28}
                    strokeLinecap="butt"
                  />
                )}
                {/* Savings arc (green) — starts where active ends */}
                {savingsAngle > 0 && (
                  <path
                    d={describeArc(
                      100,
                      100,
                      70,
                      activeAngle,
                      activeAngle + Math.min(savingsAngle, 359.9 - activeAngle)
                    )}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth={28}
                    strokeLinecap="butt"
                  />
                )}
                {/* Center text */}
                <text
                  x={100}
                  y={95}
                  textAnchor="middle"
                  fontSize={22}
                  fontWeight="bold"
                  fill="#f59e0b"
                >
                  {savings.toFixed(0)}%
                </text>
                <text
                  x={100}
                  y={115}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#9ca3af"
                >
                  power saved
                </text>
              </svg>
              <div className="flex gap-4 text-xs mt-2">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-2 bg-amber-500 rounded-sm" />
                  Active: {(gatedTotal * 1000).toFixed(1)} mW
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-2 bg-green-500 rounded-sm" />
                  Saved: {((ungatedPower - gatedTotal) * 1000).toFixed(1)} mW
                </span>
              </div>

              {/* VDD slider */}
              <div className="w-full mt-4">
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-muted-foreground">
                    Supply Voltage
                  </label>
                  <span className="text-sm font-mono text-amber-400">
                    {vddGate.toFixed(2)} V
                  </span>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={1.2}
                  step={0.05}
                  value={vddGate}
                  onChange={(e) => setVddGate(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              <div className="bg-muted/30 rounded-lg p-3 w-full mt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                  DYNAMIC POWER
                </p>
                <p className="font-mono text-sm">P_dyn = α·C·V²·f</p>
                <p className="text-xs text-muted-foreground mt-1">
                  α = activity (toggle rate), f = 1 GHz
                </p>
              </div>
            </div>

            {/* Block cards */}
            <div className="space-y-3">
              {GATE_NAMES.map((name, i) => (
                <div
                  key={i}
                  className="bg-muted/20 rounded-lg p-3 border border-border"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={blockEnabled[i]}
                        onChange={(e) => {
                          const next = [...blockEnabled];
                          next[i] = e.target.checked;
                          setBlockEnabled(next);
                        }}
                        className="accent-amber-500"
                      />
                      <span className="text-sm font-medium">{name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({GATE_C_PF[i]} pF)
                      </span>
                    </div>
                    <span className="text-xs font-mono text-amber-400">
                      {(gatedPowers[i] * 1000).toFixed(2)} mW
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-12">
                      {toggleRates[i]}%
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={toggleRates[i]}
                      disabled={!blockEnabled[i]}
                      onChange={(e) => {
                        const next = [...toggleRates];
                        next[i] = Number(e.target.value);
                        setToggleRates(next);
                      }}
                      className="flex-1 accent-amber-500 disabled:opacity-40"
                    />
                    <span className="text-xs text-muted-foreground w-10 text-right">
                      activity
                    </span>
                  </div>
                  {/* Power bar */}
                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-amber-500 rounded-full"
                      animate={{
                        width: `${clampPct(gatedPowers[i], ungatedPower / GATE_C_PF.length * Math.max(...GATE_C_PF) / GATE_C_PF[i] * (toggleRates[i] / 100))}%`,
                      }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      style={{
                        width: `${clampPct(gatedPowers[i], Math.max(...gatedPowers.filter(Boolean), 1e-12))}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Section 4: Phase-Locked Loop (PLL) ── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold">Phase-Locked Loop (PLL)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Controls */}
            <div className="space-y-5">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-muted-foreground">
                    Reference Frequency
                  </label>
                  <span className="text-sm font-mono text-amber-400">
                    {fRefMHz} MHz
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={fRefMHz}
                  onChange={(e) => setFRefMHz(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-muted-foreground">
                    Divide Ratio N
                  </label>
                  <span className="text-sm font-mono text-amber-400">
                    ÷{divN}
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={1}
                  value={divN}
                  onChange={(e) => setDivN(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-muted-foreground">
                    Loop Bandwidth
                  </label>
                  <span className="text-sm font-mono text-amber-400">
                    {loopBwMHz.toFixed(1)} MHz
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={loopBwMHz}
                  onChange={(e) => setLoopBwMHz(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    Output Frequency
                  </p>
                  <p className="text-lg font-mono text-amber-400">
                    {fOutMHz >= 1000
                      ? `${(fOutMHz / 1000).toFixed(2)} GHz`
                      : `${fOutMHz} MHz`}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    Phase Noise (1MHz)
                  </p>
                  <p className="text-lg font-mono text-amber-400">
                    {phaseNoiseDbc.toFixed(0)} dBc
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                    PLL OUTPUT
                  </p>
                  <p className="font-mono text-sm">f_out = N · f_ref</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {divN} × {fRefMHz} MHz = {fOutMHz} MHz
                  </p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                    PHASE NOISE
                  </p>
                  <p className="font-mono text-sm">
                    L(Δf) ≈ FkT/(2P_s)·(f_n/Δf)²
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    −20 dB/dec inside loop BW
                  </p>
                </div>
              </div>
            </div>

            {/* SVG diagrams */}
            <div className="space-y-4">
              {/* Block diagram */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  PLL block diagram
                </p>
                <svg
                  viewBox="0 0 380 120"
                  className="w-full border border-border rounded-lg bg-muted/10"
                >
                  {/* REF input */}
                  <text x={8} y={48} fontSize={11} fill="#f59e0b" fontWeight="bold">
                    REF
                  </text>
                  <text x={4} y={60} fontSize={9} fill="#9ca3af">
                    {fRefMHz}MHz
                  </text>
                  <line x1={38} y1={52} x2={55} y2={52} stroke="#f59e0b" strokeWidth={1.5} />

                  {/* Phase Detector box */}
                  <rect x={55} y={36} width={72} height={32} rx={4} fill="#1e293b" stroke="#f59e0b" strokeWidth={1.5} />
                  <text x={91} y={53} textAnchor="middle" fontSize={9} fill="#ffffff">Phase Det.</text>
                  <line x1={127} y1={52} x2={144} y2={52} stroke="#f59e0b" strokeWidth={1.5} />

                  {/* Loop Filter box */}
                  <rect x={144} y={36} width={68} height={32} rx={4} fill="#1e293b" stroke="#f59e0b" strokeWidth={1.5} />
                  <text x={178} y={53} textAnchor="middle" fontSize={9} fill="#ffffff">Loop Filter</text>
                  <line x1={212} y1={52} x2={228} y2={52} stroke="#f59e0b" strokeWidth={1.5} />

                  {/* VCO box */}
                  <rect x={228} y={36} width={56} height={32} rx={4} fill="#1e293b" stroke="#f59e0b" strokeWidth={1.5} />
                  <text x={256} y={53} textAnchor="middle" fontSize={9} fill="#ffffff">VCO</text>
                  <line x1={284} y1={52} x2={310} y2={52} stroke="#f59e0b" strokeWidth={1.5} />

                  {/* Output arrow */}
                  <polygon points="310,48 322,52 310,56" fill="#f59e0b" />
                  <text x={326} y={48} fontSize={9} fill="#f59e0b">f_out</text>
                  <text x={326} y={59} fontSize={8} fill="#9ca3af">
                    {fOutMHz >= 1000 ? `${(fOutMHz / 1000).toFixed(1)}GHz` : `${fOutMHz}MHz`}
                  </text>

                  {/* Feedback path */}
                  <line x1={310} y1={52} x2={310} y2={90} stroke="#9ca3af" strokeWidth={1} strokeDasharray="3,2" />
                  <line x1={310} y1={90} x2={91} y2={90} stroke="#9ca3af" strokeWidth={1} strokeDasharray="3,2" />
                  <line x1={91} y1={90} x2={91} y2={68} stroke="#9ca3af" strokeWidth={1} strokeDasharray="3,2" />

                  {/* Divider block */}
                  <rect x={155} y={80} width={46} height={18} rx={3} fill="#1e293b" stroke="#9ca3af" strokeWidth={1} />
                  <text x={178} y={93} textAnchor="middle" fontSize={9} fill="#d1d5db">÷{divN}</text>
                </svg>
              </div>

              {/* Phase noise plot */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Phase noise profile L(f)
                </p>
                <svg
                  viewBox="0 0 320 180"
                  className="w-full border border-border rounded-lg bg-muted/10"
                >
                  {/* Axes */}
                  <line x1={40} y1={10} x2={40} y2={165} stroke="#4b5563" strokeWidth={1} />
                  <line x1={40} y1={165} x2={305} y2={165} stroke="#4b5563" strokeWidth={1} />

                  {/* Y-axis labels */}
                  {[-80, -100, -120, -140, -160].map((v) => {
                    const sy = 10 + ((v - -80) / (-160 - -80)) * 155;
                    return (
                      <g key={v}>
                        <line x1={36} y1={sy} x2={305} y2={sy} stroke="#374151" strokeWidth={0.5} />
                        <text x={34} y={sy + 3} fontSize={8} fill="#6b7280" textAnchor="end">
                          {v}
                        </text>
                      </g>
                    );
                  })}

                  {/* X-axis labels (log) */}
                  {[0.01, 0.1, 1, 10, 100].map((fMHz) => {
                    const sx = 40 + logScale(fMHz, 0.01, 100, 265);
                    const label =
                      fMHz < 1 ? `${fMHz * 1000}k` : fMHz < 1000 ? `${fMHz}M` : "100M";
                    return (
                      <g key={fMHz}>
                        <line x1={sx} y1={162} x2={sx} y2={168} stroke="#4b5563" strokeWidth={1} />
                        <text x={sx} y={176} fontSize={7} fill="#6b7280" textAnchor="middle">
                          {label}Hz
                        </text>
                      </g>
                    );
                  })}

                  {/* Phase noise curve */}
                  <polyline
                    points={pnPoints.join(" ")}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={2}
                  />

                  {/* Loop BW marker */}
                  <line
                    x1={loopBwX}
                    y1={10}
                    x2={loopBwX}
                    y2={165}
                    stroke="#60a5fa"
                    strokeWidth={1}
                    strokeDasharray="3,2"
                  />
                  <text x={loopBwX + 2} y={22} fontSize={7} fill="#60a5fa">
                    BW={loopBwMHz}MHz
                  </text>

                  {/* Axis titles */}
                  <text x={172} y={178} textAnchor="middle" fontSize={8} fill="#6b7280">
                    Offset Frequency
                  </text>
                  <text
                    x={8}
                    y={90}
                    textAnchor="middle"
                    fontSize={8}
                    fill="#6b7280"
                    transform="rotate(-90,8,90)"
                  >
                    L(f) dBc/Hz
                  </text>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 5: Power Domain Partitioning ── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold">Power Domain Partitioning</h2>
          </div>

          {hasHighVdd && (
            <div className="flex items-center gap-2 border border-red-500/40 bg-red-500/10 rounded-lg p-3 text-sm text-red-400 mb-4">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                One or more domains exceed 1.1V — possible reliability concern
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Controls + bars */}
            <div className="space-y-4">
              {DOMAIN_NAMES.map((name, i) => {
                const totalDomainP = dynPowers[i] + leakPowers[i];
                const pct = clampPct(totalDomainP, maxDomainPower + 1e-15);
                const isHigh = domainVdds[i] > 1.1;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-3 h-3 rounded-sm"
                          style={{ background: floorPlanRects[i].color }}
                        />
                        <span className="text-sm font-medium">{name}</span>
                        {isHigh && (
                          <AlertTriangle className="w-3 h-3 text-red-400" />
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-amber-400">
                          {domainVdds[i].toFixed(2)}V
                        </span>
                        <span className="text-xs font-mono text-muted-foreground w-16 text-right">
                          {(totalDomainP * 1000).toFixed(2)} mW
                        </span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0.7}
                      max={1.2}
                      step={0.05}
                      value={domainVdds[i]}
                      onChange={(e) => {
                        const next = [...domainVdds];
                        next[i] = Number(e.target.value);
                        setDomainVdds(next);
                      }}
                      className="w-full accent-amber-500"
                    />
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: floorPlanRects[i].color }}
                        animate={{ width: `${pct}%` }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="bg-muted/30 rounded-lg p-3 mt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Dynamic</span>
                  <span className="font-mono text-amber-400">
                    {(totalDynPower * 1000).toFixed(2)} mW
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Total Leakage</span>
                  <span className="font-mono text-muted-foreground">
                    {(totalLeakPower * 1000000).toFixed(2)} µW
                  </span>
                </div>
                <div className="flex justify-between text-sm font-semibold mt-2 pt-2 border-t border-border">
                  <span>Total Power</span>
                  <span className="font-mono text-amber-400">
                    {(totalPower * 1000).toFixed(2)} mW
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Level Shifters</span>
                  <span className="font-mono text-muted-foreground">
                    {levelShifterCount} pairs
                  </span>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                  TOTAL POWER
                </p>
                <p className="font-mono text-sm">
                  P_total = Σ(α_i·C_i·V_i²·f + I_leak_i·V_i)
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Level shifters needed when |ΔV| &gt; 0.1V between adjacent
                  domains
                </p>
              </div>
            </div>

            {/* SVG floor plan */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">
                Die floor plan — border intensity ∝ V_dd
              </p>
              <svg
                viewBox="0 0 320 200"
                className="w-full border border-border rounded-lg bg-muted/10"
              >
                {floorPlanRects.map((r, i) => {
                  const normV =
                    (domainVdds[i] - 0.7) / (1.2 - 0.7);
                  const alpha = 0.3 + normV * 0.7;
                  return (
                    <g key={i}>
                      <rect
                        x={r.x}
                        y={r.y}
                        width={r.w}
                        height={r.h}
                        rx={4}
                        fill={r.color}
                        fillOpacity={0.15 + normV * 0.15}
                        stroke={r.color}
                        strokeWidth={2}
                        strokeOpacity={alpha}
                      />
                      <text
                        x={r.x + r.w / 2}
                        y={r.y + r.h / 2 - 6}
                        textAnchor="middle"
                        fontSize={10}
                        fill={r.color}
                        fontWeight="bold"
                      >
                        {DOMAIN_NAMES[i]}
                      </text>
                      <text
                        x={r.x + r.w / 2}
                        y={r.y + r.h / 2 + 8}
                        textAnchor="middle"
                        fontSize={9}
                        fill="#9ca3af"
                      >
                        {domainVdds[i].toFixed(2)}V
                      </text>
                      <text
                        x={r.x + r.w / 2}
                        y={r.y + r.h / 2 + 20}
                        textAnchor="middle"
                        fontSize={8}
                        fill="#6b7280"
                      >
                        {((dynPowers[i] + leakPowers[i]) * 1000).toFixed(1)} mW
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>

        {/* ── Bottom Formula Reference Card ── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold">Formula Reference</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                INSERTION DELAY
              </p>
              <p className="font-mono text-sm">
                t_ins = Σ(R_buf·C_wire + t_buf)
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Summed per level in clock tree
              </p>
            </div>

            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                SETUP SLACK
              </p>
              <p className="font-mono text-sm">
                slack = T_clk − t_comb − t_setup − t_skew
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Must be ≥ 0 for timing closure
              </p>
            </div>

            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                DYNAMIC POWER
              </p>
              <p className="font-mono text-sm">P_dyn = α·C·V²·f</p>
              <p className="text-xs text-muted-foreground mt-1">
                activity × capacitance × voltage² × frequency
              </p>
            </div>

            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                PLL OUTPUT
              </p>
              <p className="font-mono text-sm">f_out = N · f_ref</p>
              <p className="text-xs text-muted-foreground mt-1">
                PLL output = divide ratio × reference
              </p>
            </div>
          </div>

          {/* Footer nav hint */}
          <div className="flex items-center gap-1 mt-4 text-xs text-muted-foreground">
            <ChevronRight className="w-3 h-3" />
            <span>
              All values update in real-time. Adjust sliders above to explore
              trade-offs.
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
