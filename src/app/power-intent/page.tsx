"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Zap,
  Layers,
  Shield,
  AlertTriangle,
  CheckCircle,
  Info,
  Activity,
  Lock,
  Unlock,
} from "lucide-react";

// ── Physics constants ──────────────────────────────────────────────────────────
const DOMAINS = [
  { name: "CPU Core",    cap: 200, act: 0.7, color: "#6366f1" },
  { name: "GPU",         cap: 150, act: 0.9, color: "#8b5cf6" },
  { name: "Memory Ctrl", cap: 80,  act: 0.5, color: "#06b6d4" },
  { name: "I/O Ring",    cap: 60,  act: 0.6, color: "#f59e0b" },
  { name: "Always-On",   cap: 20,  act: 0.3, color: "#10b981" },
];

const POWER_STATE_LEVELS: Record<string, number> = {
  ON: 100,
  SLEEP: 5,
  SHUTDOWN: 0.1,
  HIBERNATE: 0,
};

const TRANSITION_TIMES: Record<string, string> = {
  "ON→SLEEP": "10µs",
  "SLEEP→ON": "25µs",
  "ON→SHUTDOWN": "50µs",
  "SHUTDOWN→ON": "500µs",
  "ON→HIBERNATE": "10ms",
  "HIBERNATE→ON": "100ms",
};

// ── Typed helpers ──────────────────────────────────────────────────────────────
interface DomainPower {
  pDyn: number;
  pLeak: number;
  total: number;
}

type IsoStrategy = "AND" | "OR" | "LATCH";
type EnablePolarity = "HIGH" | "LOW";
type PowerState = "ON" | "SLEEP" | "SHUTDOWN" | "HIBERNATE";

function calcDomainPower(vdd: number, cap: number, act: number, freq: number): DomainPower {
  const pDyn = act * cap * 1e-12 * vdd * vdd * freq * 1e9;
  const pLeak = 0.005 * vdd * cap * 1e-12 * 1e9;
  return { pDyn, pLeak, total: pDyn + pLeak };
}

function clampPct(val: number, max: number): number {
  if (max === 0) return 0;
  return Math.max(0, Math.min(100, (val / max) * 100));
}

function formatW(w: number): string {
  if (w >= 1) return w.toFixed(3) + " W";
  if (w >= 1e-3) return (w * 1e3).toFixed(2) + " mW";
  return (w * 1e6).toFixed(2) + " µW";
}

function formatJ(j: number): string {
  if (j >= 1e-6) return (j * 1e6).toFixed(3) + " µJ";
  if (j >= 1e-9) return (j * 1e9).toFixed(3) + " nJ";
  return (j * 1e12).toFixed(3) + " pJ";
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function PowerIntentPage() {
  // Section 1: Voltage Island Floorplan
  const [domainVdds, setDomainVdds] = useState<number[]>([1.0, 0.8, 1.1, 0.9, 0.7]);
  const [freq, setFreq] = useState<number>(2.0);

  // Section 2: Retention Register Analysis
  const [retentionCells, setRetentionCells] = useState<number>(1000);
  const [retentionVdd, setRetentionVdd] = useState<number>(0.7);
  const [saveRestoreCycles, setSaveRestoreCycles] = useState<number>(10);
  const [sleepSlider, setSleepSlider] = useState<number>(10);

  // Section 3: Isolation Cell Requirements
  const [signalCount, setSignalCount] = useState<number>(500);
  const [isoStrategy, setIsoStrategy] = useState<IsoStrategy>("AND");
  const [enablePolarity, setEnablePolarity] = useState<EnablePolarity>("HIGH");

  // Section 4: Power State Transition
  const [currentState, setCurrentState] = useState<PowerState>("ON");

  // Section 5: DVFS
  const [workload, setWorkload] = useState<number>(60);
  const [vddMin, setVddMin] = useState<number>(0.7);
  const [vddMax, setVddMax] = useState<number>(1.0);
  const [fMin, setFMin] = useState<number>(0.5);
  const [fMax, setFMax] = useState<number>(2.0);

  // ── Section 1 Derived ────────────────────────────────────────────────────────
  const domainPowers = useMemo<DomainPower[]>(() =>
    DOMAINS.map((d, i) => calcDomainPower(domainVdds[i], d.cap, d.act, freq)),
    [domainVdds, freq]
  );

  const totalPower = useMemo<number>(() =>
    domainPowers.reduce((s, dp) => s + dp.total, 0),
    [domainPowers]
  );

  const maxDomainPower = useMemo<number>(() =>
    Math.max(...domainPowers.map((dp) => dp.total)),
    [domainPowers]
  );

  const levelShifterCount = useMemo<number>(() => {
    const adjacentPairs: [number, number][] = [[0, 2], [0, 1], [1, 2], [0, 3], [2, 4]];
    return adjacentPairs.filter(
      ([i, j]) => Math.abs(domainVdds[i] - domainVdds[j]) > 0.1
    ).length;
  }, [domainVdds]);

  // ── Section 2 Derived ────────────────────────────────────────────────────────
  const sleepDurationMs = useMemo<number>(() => Math.pow(10, sleepSlider / 10), [sleepSlider]);

  const pRetention = useMemo<number>(() =>
    retentionCells * 2e-9 * retentionVdd,
    [retentionCells, retentionVdd]
  );

  const eSaveRestore = useMemo<number>(() =>
    retentionCells * 0.5e-15 * 1.0 * saveRestoreCycles,
    [retentionCells, saveRestoreCycles]
  );

  const pBeforeSleep = 0.05; // 50mW estimate
  const tBreakevenSec = useMemo<number>(() => eSaveRestore / pBeforeSleep, [eSaveRestore]);
  const tBreakevenMs = tBreakevenSec * 1000;
  const sleepBeneficial = sleepDurationMs > tBreakevenMs;

  // ── Section 3 Derived ────────────────────────────────────────────────────────
  const isoAreaUm2 = useMemo<number>(() =>
    isoStrategy === "LATCH" ? signalCount * 8 : signalCount * 4,
    [isoStrategy, signalCount]
  );

  const isoClampValue = isoStrategy === "AND" ? "0" : isoStrategy === "OR" ? "1" : "last";
  const isoGlitchRisk = isoStrategy === "LATCH";
  const isoPreservesValue = isoStrategy === "LATCH";

  // ── Section 5 Derived ────────────────────────────────────────────────────────
  const t = workload / 100;
  const vddOp = vddMin + t * (vddMax - vddMin);
  const fOp = fMin + t * (fMax - fMin);
  const pOp = 0.5 * 200e-12 * vddOp * vddOp * fOp * 1e9;
  const pMax = 0.5 * 200e-12 * vddMax * vddMax * fMax * 1e9;
  const powerSavingsPct = (1 - pOp / pMax) * 100;
  const perfRetentionPct = (fOp / fMax) * 100;

  // ── SVG helpers ──────────────────────────────────────────────────────────────
  const floorplanRects = [
    { x: 10,  y: 10,  w: 130, h: 130, domainIdx: 0 }, // CPU Core — large center-left
    { x: 150, y: 10,  w: 120, h: 90,  domainIdx: 1 }, // GPU — right
    { x: 150, y: 110, w: 75,  h: 40,  domainIdx: 2 }, // Memory Ctrl
    { x: 10,  y: 150, w: 260, h: 40,  domainIdx: 3 }, // I/O Ring — bottom strip
    { x: 235, y: 110, w: 35,  h: 40,  domainIdx: 4 }, // Always-On — small
  ];

  function dvfsChartX(f: number): number {
    return 30 + ((f - 0.3) / (fMax + 0.3 - 0.3)) * 260;
  }

  function dvfsChartY(v: number): number {
    return 170 - ((v - 0.5) / 0.85) * 140;
  }

  const dvfsRegionPoints = [
    dvfsChartX(fMin), dvfsChartY(vddMin),
    dvfsChartX(fMax), dvfsChartY(vddMin),
    dvfsChartX(fMax), dvfsChartY(vddMax),
    dvfsChartX(fMin), dvfsChartY(vddMax),
  ].join(",");

  function isoPowerCurvePoints(pFrac: number): string {
    const p = pMax * pFrac;
    const pts: string[] = [];
    for (let fi = fMin; fi <= fMax + 0.01; fi += (fMax - fMin) / 20) {
      if (fi <= 0) continue;
      const v = Math.sqrt(p / (0.5 * 200e-12 * fi * 1e9));
      if (v >= 0.5 && v <= 1.35) {
        pts.push(`${dvfsChartX(fi)},${dvfsChartY(v)}`);
      }
    }
    return pts.join(" ");
  }

  const powerStateNodes: { id: PowerState; cx: number; cy: number; label: string }[] = [
    { id: "ON",        cx: 85,  cy: 50,  label: "ON" },
    { id: "SLEEP",     cx: 255, cy: 50,  label: "SLEEP" },
    { id: "SHUTDOWN",  cx: 85,  cy: 160, label: "SHUTDOWN" },
    { id: "HIBERNATE", cx: 255, cy: 160, label: "HIBERNATE" },
  ];

  const stateTransitions: { from: PowerState; to: PowerState; label: string; cx: number; cy: number }[] = [
    { from: "ON",        to: "SLEEP",     label: "10µs",  cx: 170, cy: 40  },
    { from: "SLEEP",     to: "ON",        label: "25µs",  cx: 170, cy: 62  },
    { from: "ON",        to: "SHUTDOWN",  label: "50µs",  cx: 65,  cy: 105 },
    { from: "SHUTDOWN",  to: "ON",        label: "500µs", cx: 105, cy: 105 },
    { from: "ON",        to: "HIBERNATE", label: "10ms",  cx: 170, cy: 145 },
    { from: "HIBERNATE", to: "ON",        label: "100ms", cx: 170, cy: 165 },
  ];

  const currentPowerPct = POWER_STATE_LEVELS[currentState];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="bg-indigo-500/20 rounded-xl border border-indigo-500/30 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-indigo-500/30">
              <Zap className="w-6 h-6 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-indigo-400">Power Intent &amp; Low-Power Design</h1>
          </div>
          <p className="text-muted-foreground ml-14">
            UPF voltage islands, retention registers, isolation cells, level shifters, and power state transitions
          </p>
        </div>

        {/* ══ Section 1: Voltage Island Floorplan ═══════════════════════════════ */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-5">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold">Voltage Island Floorplan</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Controls */}
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground flex justify-between mb-1">
                  <span>Clock Frequency</span>
                  <span className="font-mono text-foreground">{freq.toFixed(1)} GHz</span>
                </label>
                <input
                  type="range" min={0.5} max={4.0} step={0.5} value={freq}
                  onChange={(e) => setFreq(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>

              {DOMAINS.map((d, i) => (
                <div key={d.name}>
                  <label className="text-sm text-muted-foreground flex justify-between mb-1">
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: d.color }} />
                      {d.name}
                    </span>
                    <span className="font-mono text-foreground">{domainVdds[i].toFixed(2)} V</span>
                  </label>
                  <input
                    type="range" min={0.6} max={1.2} step={0.05} value={domainVdds[i]}
                    onChange={(e) => {
                      const next = [...domainVdds];
                      next[i] = Number(e.target.value);
                      setDomainVdds(next);
                    }}
                    className="w-full accent-indigo-500"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                    <span>P_dyn={formatW(domainPowers[i].pDyn)}</span>
                    <span>P_leak={formatW(domainPowers[i].pLeak)}</span>
                    <span className="font-semibold" style={{ color: d.color }}>
                      {formatW(domainPowers[i].total)}
                    </span>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-sm text-muted-foreground">Total Power</span>
                <span className="font-mono font-bold text-indigo-400">{formatW(totalPower)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Level Shifters Required</span>
                <span className="font-mono font-bold text-amber-400">{levelShifterCount}</span>
              </div>
            </div>

            {/* SVG Floorplan */}
            <div className="space-y-4">
              <svg viewBox="0 0 340 220" className="w-full border border-border rounded-lg bg-muted/10">
                {/* Background grid */}
                <defs>
                  <pattern id="fp-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#ffffff08" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="340" height="220" fill="url(#fp-grid)" />

                {/* Domain rectangles */}
                {floorplanRects.map(({ x, y, w, h, domainIdx }) => {
                  const d = DOMAINS[domainIdx];
                  const pw = domainPowers[domainIdx];
                  const borderW = 1 + (pw.total / (maxDomainPower || 1)) * 3;
                  return (
                    <g key={domainIdx}>
                      <rect
                        x={x} y={y} width={w} height={h}
                        fill={d.color + "22"}
                        stroke={d.color}
                        strokeWidth={borderW}
                        rx={3}
                      />
                      <text
                        x={x + w / 2} y={y + h / 2 - 7}
                        textAnchor="middle" fontSize={domainIdx === 3 ? 8 : 9}
                        fill={d.color} fontWeight="600"
                      >
                        {d.name}
                      </text>
                      <text
                        x={x + w / 2} y={y + h / 2 + 5}
                        textAnchor="middle" fontSize={8}
                        fill="#ffffff99"
                      >
                        {domainVdds[domainIdx].toFixed(2)}V
                      </text>
                      <text
                        x={x + w / 2} y={y + h / 2 + 16}
                        textAnchor="middle" fontSize={7}
                        fill="#ffffff66"
                      >
                        {formatW(pw.total)}
                      </text>
                    </g>
                  );
                })}

                {/* Level shifter indicators between CPU-GPU */}
                {Math.abs(domainVdds[0] - domainVdds[1]) > 0.1 && (
                  <g>
                    <circle cx={148} cy={55} r={5} fill="#f59e0b" opacity={0.9} />
                    <text x={148} y={58} textAnchor="middle" fontSize={6} fill="#000" fontWeight="bold">LS</text>
                  </g>
                )}
                {Math.abs(domainVdds[0] - domainVdds[2]) > 0.1 && (
                  <g>
                    <circle cx={148} cy={130} r={5} fill="#f59e0b" opacity={0.9} />
                    <text x={148} y={133} textAnchor="middle" fontSize={6} fill="#000" fontWeight="bold">LS</text>
                  </g>
                )}

                {/* Legend */}
                <text x={170} y={210} textAnchor="middle" fontSize={7} fill="#ffffff55">
                  Border thickness ∝ power dissipation  |  LS = Level Shifter
                </text>
              </svg>

              {/* Power bars */}
              <div className="space-y-2">
                {DOMAINS.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="text-xs w-24 text-muted-foreground truncate">{d.name}</span>
                    <div className="flex-1 bg-muted/20 rounded-full h-2 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: d.color }}
                        animate={{ width: `${clampPct(domainPowers[i].total, maxDomainPower)}%` }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      />
                    </div>
                    <span className="text-xs font-mono w-16 text-right" style={{ color: d.color }}>
                      {formatW(domainPowers[i].total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Formula card */}
          <div className="mt-4 bg-muted/30 rounded-lg p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Dynamic + Leakage Power</p>
            <p className="font-mono text-sm">P_total = Σ(α_i · C_i · V_i² · f + I_leak_i · V_i)</p>
            <p className="text-xs text-muted-foreground mt-1">
              α = activity factor, C = load capacitance, V = supply voltage, f = clock frequency
            </p>
          </div>
        </div>

        {/* ══ Section 2: Retention Register Analysis ════════════════════════════ */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-5">
            <Lock className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold">Retention Register Analysis</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Controls */}
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground flex justify-between mb-1">
                  <span>Retention Cells</span>
                  <span className="font-mono text-foreground">{retentionCells.toLocaleString()}</span>
                </label>
                <input
                  type="range" min={0} max={10000} step={100} value={retentionCells}
                  onChange={(e) => setRetentionCells(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground flex justify-between mb-1">
                  <span>Shadow Latch VDD</span>
                  <span className="font-mono text-foreground">{retentionVdd.toFixed(2)} V</span>
                </label>
                <input
                  type="range" min={0.5} max={1.0} step={0.05} value={retentionVdd}
                  onChange={(e) => setRetentionVdd(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground flex justify-between mb-1">
                  <span>Save/Restore Cycles</span>
                  <span className="font-mono text-foreground">{saveRestoreCycles}</span>
                </label>
                <input
                  type="range" min={1} max={100} step={1} value={saveRestoreCycles}
                  onChange={(e) => setSaveRestoreCycles(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <label className="text-sm text-muted-foreground flex justify-between mb-1">
                  <span>Sleep Duration</span>
                  <span className="font-mono text-foreground">{sleepDurationMs.toFixed(2)} ms</span>
                </label>
                <input
                  type="range" min={0} max={30} step={1} value={sleepSlider}
                  onChange={(e) => setSleepSlider(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>

              {/* Results */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shadow Latch Leakage</span>
                  <span className="font-mono">{formatW(pRetention)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Save/Restore Energy</span>
                  <span className="font-mono">{formatJ(eSaveRestore)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Breakeven Sleep Time</span>
                  <span className="font-mono">{tBreakevenMs.toFixed(3)} ms</span>
                </div>
              </div>

              {/* Sleep benefit badge */}
              {sleepBeneficial ? (
                <div className="flex items-center gap-2 border border-green-500/40 bg-green-500/10 rounded-lg px-3 py-2">
                  <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                  <span className="text-sm text-green-400">Sleep is beneficial — energy savings positive</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 border border-red-500/40 bg-red-500/10 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="text-sm text-red-400">Sleep too short — save/restore overhead dominates</span>
                </div>
              )}
            </div>

            {/* SVG Retention diagram */}
            <div className="space-y-3">
              <svg viewBox="0 0 320 160" className="w-full border border-border rounded-lg bg-muted/10">
                {/* Main flip-flop */}
                <rect x={30} y={20} width={80} height={60} rx={4} fill="#6366f133" stroke="#6366f1" strokeWidth={2} />
                <text x={70} y={45} textAnchor="middle" fontSize={9} fill="#a5b4fc" fontWeight="600">Main FF</text>
                <text x={70} y={58} textAnchor="middle" fontSize={8} fill="#818cf8">VDD_MAIN</text>
                <text x={70} y={70} textAnchor="middle" fontSize={7} fill="#ffffff66">D Q</text>

                {/* Shadow latch */}
                <rect x={30} y={95} width={80} height={35} rx={4}
                  fill={`#10b98133`}
                  stroke="#10b981"
                  strokeWidth={1.5}
                />
                <text x={70} y={113} textAnchor="middle" fontSize={9} fill="#6ee7b7" fontWeight="600">Shadow Latch</text>
                <text x={70} y={124} textAnchor="middle" fontSize={7} fill="#34d399">{retentionVdd.toFixed(2)}V</text>

                {/* SAVE arrow */}
                <line x1={70} y1={80} x2={70} y2={95} stroke="#10b981" strokeWidth={1.5} markerEnd="url(#arr-g)" />
                <text x={75} y={89} fontSize={7} fill="#10b981">SAVE</text>

                {/* Arrow defs */}
                <defs>
                  <marker id="arr-g" markerWidth={6} markerHeight={6} refX={3} refY={3} orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="#10b981" />
                  </marker>
                  <marker id="arr-w" markerWidth={6} markerHeight={6} refX={3} refY={3} orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="#ffffff88" />
                  </marker>
                  <marker id="arr-b" markerWidth={6} markerHeight={6} refX={3} refY={3} orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="#6366f1" />
                  </marker>
                </defs>

                {/* VDD supply lines */}
                <line x1={10} y1={50} x2={30} y2={50} stroke="#6366f1" strokeWidth={2} />
                <text x={5} y={48} fontSize={7} fill="#818cf8" textAnchor="middle">VDD</text>

                <line x1={10} y1={112} x2={30} y2={112} stroke="#10b981" strokeWidth={2} />
                <text x={5} y={110} fontSize={7} fill="#34d399" textAnchor="middle">RET</text>

                {/* Timeline strip */}
                <rect x={10} y={145} width={300} height={10} rx={2} fill="#ffffff0a" />

                {/* Active phase */}
                <rect x={10} y={145} width={60} height={10} rx={2} fill="#6366f133" stroke="#6366f1" strokeWidth={1} />
                <text x={40} y={153} textAnchor="middle" fontSize={6} fill="#818cf8">Active</text>

                {/* Save phase */}
                <rect x={72} y={145} width={30} height={10} rx={1} fill="#f59e0b33" stroke="#f59e0b" strokeWidth={1} />
                <text x={87} y={153} textAnchor="middle" fontSize={6} fill="#fbbf24">Save</text>

                {/* Sleep phase */}
                <rect x={104} y={145} width={90} height={10} rx={1} fill="#10b98133" stroke="#10b981" strokeWidth={1} />
                <text x={149} y={153} textAnchor="middle" fontSize={6} fill="#34d399">Sleep (shadow on)</text>

                {/* Restore phase */}
                <rect x={196} y={145} width={30} height={10} rx={1} fill="#f59e0b33" stroke="#f59e0b" strokeWidth={1} />
                <text x={211} y={153} textAnchor="middle" fontSize={6} fill="#fbbf24">Restore</text>

                {/* Active again */}
                <rect x={228} y={145} width={82} height={10} rx={2} fill="#6366f133" stroke="#6366f1" strokeWidth={1} />
                <text x={269} y={153} textAnchor="middle" fontSize={6} fill="#818cf8">Active</text>

                {/* Annotation */}
                <rect x={140} y={20} width={160} height={85} rx={4} fill="#ffffff06" stroke="#ffffff11" />
                <text x={220} y={36} textAnchor="middle" fontSize={8} fill="#ffffff88" fontWeight="600">During Sleep:</text>
                <circle cx={160} cy={52} r={4} fill={sleepBeneficial ? "#10b981" : "#ef4444"} />
                <text x={170} y={55} fontSize={8} fill="#ffffff99">Shadow VDD on</text>
                <circle cx={160} cy={68} r={4} fill="#ffffff22" stroke="#ffffff44" />
                <text x={170} y={71} fontSize={8} fill="#ffffff66">Main VDD off</text>
                <text x={220} y={88} textAnchor="middle" fontSize={7} fill={sleepBeneficial ? "#10b981" : "#f87171"}>
                  {sleepBeneficial ? "✓ Energy positive" : "✗ Overhead too high"}
                </text>
                <text x={220} y={100} textAnchor="middle" fontSize={7} fill="#ffffff55">
                  Breakeven: {tBreakevenMs.toFixed(2)}ms
                </text>
              </svg>

              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Breakeven Energy</p>
                <p className="font-mono text-sm">E_breakeven = E_save_restore / P_active_domain</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sleep is only worthwhile if the sleep duration exceeds the breakeven time
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ══ Section 3: Isolation Cell Requirements ════════════════════════════ */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-5">
            <Shield className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold">Isolation Cell Requirements</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Controls */}
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground flex justify-between mb-1">
                  <span>Signal Count</span>
                  <span className="font-mono text-foreground">{signalCount.toLocaleString()}</span>
                </label>
                <input
                  type="range" min={10} max={10000} step={50} value={signalCount}
                  onChange={(e) => setSignalCount(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>

              {/* Strategy toggle */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Isolation Strategy</p>
                <div className="flex gap-2">
                  {(["AND", "OR", "LATCH"] as IsoStrategy[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setIsoStrategy(s)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        isoStrategy === s
                          ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                          : "border-border bg-muted/10 text-muted-foreground hover:border-indigo-500/50"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Enable polarity toggle */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Enable Polarity</p>
                <div className="flex gap-2">
                  {(["HIGH", "LOW"] as EnablePolarity[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setEnablePolarity(p)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        enablePolarity === p
                          ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                          : "border-border bg-muted/10 text-muted-foreground hover:border-indigo-500/50"
                      }`}
                    >
                      ISO_EN {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Results */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Area Overhead</span>
                  <span className="font-mono">{(isoAreaUm2 / 1000).toFixed(1)} k µm²</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Output When Shutdown</span>
                  <span className="font-mono text-amber-400">Clamped to {isoClampValue}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Glitch Risk</span>
                  {isoGlitchRisk ? (
                    <span className="text-red-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Possible
                    </span>
                  ) : (
                    <span className="text-green-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> None
                    </span>
                  )}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Preserves Last Value</span>
                  {isoPreservesValue ? (
                    <span className="text-green-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Yes
                    </span>
                  ) : (
                    <span className="text-muted-foreground">No — forced clamp</span>
                  )}
                </div>
              </div>
            </div>

            {/* SVG Isolation cell diagram */}
            <div className="space-y-3">
              <svg viewBox="0 0 320 160" className="w-full border border-border rounded-lg bg-muted/10">
                {/* AND gate */}
                {(() => {
                  const active = isoStrategy === "AND";
                  const col = active ? "#6366f1" : "#ffffff33";
                  const textCol = active ? "#a5b4fc" : "#ffffff44";
                  return (
                    <g>
                      <text x={53} y={14} textAnchor="middle" fontSize={8} fill={textCol} fontWeight={active ? "700" : "400"}>AND Gate</text>
                      {/* Body */}
                      <path d="M20,20 L20,55 L38,55 Q60,55 60,37.5 Q60,20 38,20 Z" fill={col + "22"} stroke={col} strokeWidth={active ? 2 : 1} />
                      {/* Inputs */}
                      <line x1={5} y1={30} x2={20} y2={30} stroke={col} strokeWidth={1.5} />
                      <line x1={5} y1={45} x2={20} y2={45} strokeDasharray="3,2" stroke={col} strokeWidth={1.5} />
                      {/* Output */}
                      <line x1={60} y1={37.5} x2={80} y2={37.5} stroke={col} strokeWidth={1.5} />
                      <text x={2} y={32} fontSize={6} fill={textCol}>IN</text>
                      <text x={2} y={47} fontSize={6} fill={textCol}>EN</text>
                      <text x={64} y={36} fontSize={6} fill={textCol}>OUT=0</text>
                      {/* ISO_EN label */}
                      <text x={53} y={68} textAnchor="middle" fontSize={6} fill={textCol}>ISO_EN {enablePolarity}</text>
                    </g>
                  );
                })()}

                {/* OR gate */}
                {(() => {
                  const active = isoStrategy === "OR";
                  const col = active ? "#6366f1" : "#ffffff33";
                  const textCol = active ? "#a5b4fc" : "#ffffff44";
                  return (
                    <g transform="translate(105,0)">
                      <text x={53} y={14} textAnchor="middle" fontSize={8} fill={textCol} fontWeight={active ? "700" : "400"}>OR Gate</text>
                      <path d="M20,20 Q30,37.5 20,55 Q40,55 55,37.5 Q40,20 20,20 Z" fill={col + "22"} stroke={col} strokeWidth={active ? 2 : 1} />
                      <line x1={5} y1={30} x2={23} y2={30} stroke={col} strokeWidth={1.5} />
                      <line x1={5} y1={45} x2={23} y2={45} strokeDasharray="3,2" stroke={col} strokeWidth={1.5} />
                      <line x1={55} y1={37.5} x2={75} y2={37.5} stroke={col} strokeWidth={1.5} />
                      <text x={2} y={32} fontSize={6} fill={textCol}>IN</text>
                      <text x={2} y={47} fontSize={6} fill={textCol}>EN</text>
                      <text x={58} y={36} fontSize={6} fill={textCol}>OUT=1</text>
                      <text x={53} y={68} textAnchor="middle" fontSize={6} fill={textCol}>ISO_EN {enablePolarity}</text>
                    </g>
                  );
                })()}

                {/* LATCH type */}
                {(() => {
                  const active = isoStrategy === "LATCH";
                  const col = active ? "#6366f1" : "#ffffff33";
                  const textCol = active ? "#a5b4fc" : "#ffffff44";
                  return (
                    <g transform="translate(215,0)">
                      <text x={47} y={14} textAnchor="middle" fontSize={8} fill={textCol} fontWeight={active ? "700" : "400"}>LATCH</text>
                      <rect x={15} y={20} width={60} height={35} rx={3} fill={col + "22"} stroke={col} strokeWidth={active ? 2 : 1} />
                      <text x={45} y={35} textAnchor="middle" fontSize={8} fill={textCol} fontWeight="600">D-LATCH</text>
                      <text x={45} y={48} textAnchor="middle" fontSize={6} fill={textCol}>holds last val</text>
                      <line x1={0} y1={28} x2={15} y2={28} stroke={col} strokeWidth={1.5} />
                      <line x1={0} y1={45} x2={15} y2={45} strokeDasharray="3,2" stroke={col} strokeWidth={1.5} />
                      <line x1={75} y1={37.5} x2={90} y2={37.5} stroke={col} strokeWidth={1.5} />
                      <text x={-3} y={30} fontSize={6} fill={textCol}>D</text>
                      <text x={-3} y={47} fontSize={6} fill={textCol}>EN</text>
                      <text x={68} y={36} fontSize={6} fill={textCol}>Q</text>
                      <text x={45} y={68} textAnchor="middle" fontSize={6} fill={textCol}>ISO_EN {enablePolarity}</text>
                    </g>
                  );
                })()}

                {/* Downstream domain arrow */}
                <line x1={155} y1={90} x2={265} y2={90} stroke="#ffffff33" strokeWidth={1} markerEnd="url(#arr-w2)" />
                <text x={210} y={85} textAnchor="middle" fontSize={7} fill="#ffffff55">drives downstream domain</text>

                <defs>
                  <marker id="arr-w2" markerWidth={6} markerHeight={6} refX={3} refY={3} orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="#ffffff33" />
                  </marker>
                </defs>

                {/* Area comparison bars */}
                <text x={10} y={108} fontSize={7} fill="#ffffff66">Area overhead:</text>
                {(["AND", "OR", "LATCH"] as IsoStrategy[]).map((s, idx) => {
                  const area = s === "LATCH" ? signalCount * 8 : signalCount * 4;
                  const maxArea = signalCount * 8;
                  const barW = (area / maxArea) * 200;
                  const active = isoStrategy === s;
                  return (
                    <g key={s} transform={`translate(10,${116 + idx * 14})`}>
                      <text x={0} y={9} fontSize={7} fill={active ? "#a5b4fc" : "#ffffff44"} width={25}>{s}</text>
                      <rect x={30} y={1} width={200} height={9} rx={2} fill="#ffffff08" />
                      <rect x={30} y={1} width={barW} height={9} rx={2} fill={active ? "#6366f166" : "#ffffff22"} />
                      <text x={235} y={9} fontSize={6} fill={active ? "#a5b4fc" : "#ffffff44"}>
                        {(area / 1000).toFixed(1)}k µm²
                      </text>
                    </g>
                  );
                })}
              </svg>

              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Isolation Cell Function</p>
                <p className="font-mono text-sm">ISO: output = (enable ? input : clamp_value)</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Prevents floating inputs to powered domain when source domain is shut down
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ══ Section 4: Power State Transition Diagram ═════════════════════════ */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-5">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold">Power State Transition Diagram</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* State selector buttons */}
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Select active power state:</p>
              <div className="grid grid-cols-2 gap-3">
                {(["ON", "SLEEP", "SHUTDOWN", "HIBERNATE"] as PowerState[]).map((s) => {
                  const pct = POWER_STATE_LEVELS[s];
                  const isActive = currentState === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setCurrentState(s)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        isActive
                          ? "border-indigo-500 bg-indigo-500/20"
                          : "border-border bg-muted/10 hover:border-indigo-500/40"
                      }`}
                    >
                      <div className={`text-sm font-bold mb-1 ${isActive ? "text-indigo-300" : "text-muted-foreground"}`}>
                        {s}
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {s === "ON" && "Full operation"}
                        {s === "SLEEP" && "Clock off, retention"}
                        {s === "SHUTDOWN" && "Power off"}
                        {s === "HIBERNATE" && "Disk save"}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted/20 rounded-full h-1.5 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-indigo-500"
                            animate={{ width: `${pct}%` }}
                            transition={{ type: "spring", stiffness: 200, damping: 20 }}
                          />
                        </div>
                        <span className="text-xs font-mono text-indigo-400">{pct}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Current state info */}
              <div className="bg-muted/20 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current State</span>
                  <span className="font-mono text-indigo-400 font-bold">{currentState}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Power Consumption</span>
                  <span className="font-mono">{currentPowerPct}% of max</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex-1 bg-muted/30 rounded-full h-3 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-green-500 to-indigo-500"
                      animate={{ width: `${currentPowerPct}%` }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    />
                  </div>
                </div>

                {/* Wakeup time from current state */}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground font-semibold uppercase mb-1">Wakeup Latency to ON</p>
                  {currentState !== "ON" ? (
                    <p className="font-mono text-amber-400 text-sm">
                      {TRANSITION_TIMES[`${currentState}→ON`]}
                    </p>
                  ) : (
                    <p className="text-sm text-green-400">Already active</p>
                  )}
                </div>
              </div>

              {/* Transition time table */}
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="bg-muted/20 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
                  Transition Times
                </div>
                <div className="divide-y divide-border">
                  {Object.entries(TRANSITION_TIMES).map(([key, val]) => (
                    <div key={key} className="flex justify-between px-3 py-1.5 text-sm">
                      <span className="font-mono text-muted-foreground">{key}</span>
                      <span className="font-mono text-amber-400">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* SVG State machine */}
            <div className="space-y-3">
              <svg viewBox="0 0 340 200" className="w-full border border-border rounded-lg bg-muted/10">
                <defs>
                  <marker id="arr-state" markerWidth={8} markerHeight={8} refX={4} refY={4} orient="auto">
                    <path d="M0,0 L8,4 L0,8 Z" fill="#ffffff44" />
                  </marker>
                  <marker id="arr-state-active" markerWidth={8} markerHeight={8} refX={4} refY={4} orient="auto">
                    <path d="M0,0 L8,4 L0,8 Z" fill="#6366f1" />
                  </marker>
                </defs>

                {/* ON → SLEEP (right) */}
                <path d="M140,50 Q170,38 225,50" fill="none" stroke="#ffffff33" strokeWidth={1} markerEnd="url(#arr-state)" />
                <text x={183} y={37} textAnchor="middle" fontSize={7} fill="#ffffff55">10µs</text>

                {/* SLEEP → ON (left) */}
                <path d="M225,58 Q195,70 140,58" fill="none" stroke="#ffffff33" strokeWidth={1} markerEnd="url(#arr-state)" />
                <text x={183} y={73} textAnchor="middle" fontSize={7} fill="#ffffff55">25µs</text>

                {/* ON → SHUTDOWN (down) */}
                <path d="M82,75 Q68,108 82,143" fill="none" stroke="#ffffff33" strokeWidth={1} markerEnd="url(#arr-state)" />
                <text x={52} y={112} textAnchor="middle" fontSize={6} fill="#ffffff55">50µs</text>

                {/* SHUTDOWN → ON (right-up) */}
                <path d="M92,143 Q108,110 92,75" fill="none" stroke="#ffffff33" strokeWidth={1} markerEnd="url(#arr-state)" />
                <text x={120} y={112} textAnchor="middle" fontSize={6} fill="#ffffff55">500µs</text>

                {/* ON → HIBERNATE (diagonal) */}
                <path d="M112,62 Q185,115 228,148" fill="none" stroke="#ffffff33" strokeWidth={1} markerEnd="url(#arr-state)" />
                <text x={178} y={118} textAnchor="middle" fontSize={6} fill="#ffffff55">10ms</text>

                {/* HIBERNATE → ON (other diagonal) */}
                <path d="M238,148 Q205,100 100,62" fill="none" stroke="#ffffff22" strokeWidth={1} markerEnd="url(#arr-state)" />
                <text x={152} y={95} textAnchor="middle" fontSize={6} fill="#ffffff33">100ms</text>

                {/* SLEEP → HIBERNATE */}
                <path d="M255,75 Q268,115 255,148" fill="none" stroke="#ffffff22" strokeWidth={1} markerEnd="url(#arr-state)" />
                <text x={285} y={113} textAnchor="middle" fontSize={6} fill="#ffffff33">20ms</text>

                {/* State nodes */}
                {powerStateNodes.map(({ id, cx, cy, label }) => {
                  const isActive = currentState === id;
                  const pct = POWER_STATE_LEVELS[id];
                  return (
                    <g key={id} onClick={() => setCurrentState(id)} style={{ cursor: "pointer" }}>
                      <circle
                        cx={cx} cy={cy} r={28}
                        fill={isActive ? "#6366f133" : "#ffffff08"}
                        stroke={isActive ? "#6366f1" : "#ffffff33"}
                        strokeWidth={isActive ? 2.5 : 1.5}
                      />
                      {isActive && (
                        <circle cx={cx} cy={cy} r={32} fill="none" stroke="#6366f1" strokeWidth={1} opacity={0.4} />
                      )}
                      <text
                        x={cx} y={cy - 6}
                        textAnchor="middle" fontSize={9}
                        fill={isActive ? "#a5b4fc" : "#ffffff88"}
                        fontWeight={isActive ? "700" : "400"}
                      >
                        {label}
                      </text>
                      <text
                        x={cx} y={cy + 6}
                        textAnchor="middle" fontSize={7}
                        fill={isActive ? "#818cf8" : "#ffffff55"}
                      >
                        {pct}%
                      </text>
                      <text
                        x={cx} y={cy + 16}
                        textAnchor="middle" fontSize={6}
                        fill={isActive ? "#6366f1" : "#ffffff33"}
                      >
                        {id === "ON" ? "100mW" : id === "SLEEP" ? "5mW" : id === "SHUTDOWN" ? "0.1mW" : "0mW"}
                      </text>
                    </g>
                  );
                })}
              </svg>

              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Wakeup Latency vs Power Saving</p>
                <p className="font-mono text-sm">Wakeup latency vs power saving trade-off</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Deeper sleep states save more power but incur longer wakeup latency and higher restore energy
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ══ Section 5: Dynamic Voltage & Frequency Scaling ═══════════════════ */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-5">
            <Zap className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold">Dynamic Voltage &amp; Frequency Scaling (DVFS)</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Controls */}
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground flex justify-between mb-1">
                  <span>Workload / Target Utilization</span>
                  <span className="font-mono text-foreground">{workload}%</span>
                </label>
                <input
                  type="range" min={0} max={100} step={5} value={workload}
                  onChange={(e) => setWorkload(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground flex justify-between mb-1">
                    <span>Vdd Min</span>
                    <span className="font-mono text-foreground">{vddMin.toFixed(2)}V</span>
                  </label>
                  <input
                    type="range" min={0.6} max={0.9} step={0.05} value={vddMin}
                    onChange={(e) => setVddMin(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground flex justify-between mb-1">
                    <span>Vdd Max</span>
                    <span className="font-mono text-foreground">{vddMax.toFixed(2)}V</span>
                  </label>
                  <input
                    type="range" min={0.9} max={1.2} step={0.05} value={vddMax}
                    onChange={(e) => setVddMax(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground flex justify-between mb-1">
                    <span>F Min</span>
                    <span className="font-mono text-foreground">{fMin.toFixed(1)} GHz</span>
                  </label>
                  <input
                    type="range" min={0.5} max={1.0} step={0.1} value={fMin}
                    onChange={(e) => setFMin(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground flex justify-between mb-1">
                    <span>F Max</span>
                    <span className="font-mono text-foreground">{fMax.toFixed(1)} GHz</span>
                  </label>
                  <input
                    type="range" min={1.0} max={4.0} step={0.5} value={fMax}
                    onChange={(e) => setFMax(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
              </div>

              {/* Operating point results */}
              <div className="bg-muted/20 rounded-lg p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Operating Vdd</span>
                  <span className="font-mono text-indigo-400">{vddOp.toFixed(3)} V</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Operating Frequency</span>
                  <span className="font-mono text-indigo-400">{fOp.toFixed(2)} GHz</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Operating Power</span>
                  <span className="font-mono text-indigo-400">{formatW(pOp)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Max Power</span>
                  <span className="font-mono">{formatW(pMax)}</span>
                </div>
                <div className="pt-2 border-t border-border space-y-2">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Power Savings</span>
                      <span className="font-mono text-green-400">{powerSavingsPct.toFixed(1)}%</span>
                    </div>
                    <div className="bg-muted/20 rounded-full h-2 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-green-500"
                        animate={{ width: `${powerSavingsPct}%` }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Performance Retention</span>
                      <span className="font-mono text-indigo-400">{perfRetentionPct.toFixed(1)}%</span>
                    </div>
                    <div className="bg-muted/20 rounded-full h-2 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-indigo-500"
                        animate={{ width: `${perfRetentionPct}%` }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SVG DVFS operating point chart */}
            <div className="space-y-3">
              <svg viewBox="0 0 320 200" className="w-full border border-border rounded-lg bg-muted/10">
                {/* Axes */}
                <line x1={30} y1={10} x2={30} y2={175} stroke="#ffffff44" strokeWidth={1} />
                <line x1={25} y1={175} x2={305} y2={175} stroke="#ffffff44" strokeWidth={1} />

                {/* Axis labels */}
                <text x={168} y={196} textAnchor="middle" fontSize={8} fill="#ffffff66">Frequency (GHz)</text>
                <text x={10} y={100} textAnchor="middle" fontSize={8} fill="#ffffff66" transform="rotate(-90,10,100)">Voltage (V)</text>

                {/* Y-axis tick marks */}
                {[0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2].map((v) => {
                  const y = dvfsChartY(v);
                  if (y < 10 || y > 175) return null;
                  return (
                    <g key={v}>
                      <line x1={26} y1={y} x2={30} y2={y} stroke="#ffffff44" strokeWidth={1} />
                      <text x={22} y={y + 3} textAnchor="end" fontSize={6} fill="#ffffff55">{v.toFixed(1)}</text>
                    </g>
                  );
                })}

                {/* X-axis tick marks */}
                {[0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0].filter(f => f >= fMin - 0.1 && f <= fMax + 0.1).map((f) => {
                  const x = dvfsChartX(f);
                  if (x < 30 || x > 300) return null;
                  return (
                    <g key={f}>
                      <line x1={x} y1={175} x2={x} y2={179} stroke="#ffffff44" strokeWidth={1} />
                      <text x={x} y={187} textAnchor="middle" fontSize={6} fill="#ffffff55">{f.toFixed(1)}</text>
                    </g>
                  );
                })}

                {/* DVFS valid region */}
                <polygon
                  points={dvfsRegionPoints}
                  fill="#6366f115"
                  stroke="#6366f155"
                  strokeWidth={1.5}
                  strokeDasharray="4,3"
                />

                {/* Iso-power curves */}
                {[0.25, 0.5, 0.75].map((frac) => {
                  const pts = isoPowerCurvePoints(frac);
                  if (!pts) return null;
                  return (
                    <polyline
                      key={frac}
                      points={pts}
                      fill="none"
                      stroke="#ffffff22"
                      strokeWidth={1}
                      strokeDasharray="3,3"
                    />
                  );
                })}

                {/* Iso-power labels */}
                <text x={290} y={dvfsChartY(vddMin) - 4} fontSize={6} fill="#ffffff33" textAnchor="end">P=0.25·P_max</text>
                <text x={290} y={dvfsChartY((vddMin + vddMax) / 2) - 4} fontSize={6} fill="#ffffff33" textAnchor="end">P=0.50·P_max</text>
                <text x={290} y={dvfsChartY(vddMax) - 4} fontSize={6} fill="#ffffff33" textAnchor="end">P=0.75·P_max</text>

                {/* Operating point dot */}
                <motion.circle
                  cx={dvfsChartX(fOp)}
                  cy={dvfsChartY(vddOp)}
                  r={6}
                  fill="#6366f1"
                  stroke="#a5b4fc"
                  strokeWidth={2}
                  animate={{ cx: dvfsChartX(fOp), cy: dvfsChartY(vddOp) }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                />

                {/* Operating point crosshairs */}
                <line
                  x1={30} y1={dvfsChartY(vddOp)}
                  x2={dvfsChartX(fOp)} y2={dvfsChartY(vddOp)}
                  stroke="#6366f144" strokeWidth={1} strokeDasharray="2,2"
                />
                <line
                  x1={dvfsChartX(fOp)} y1={dvfsChartY(vddOp)}
                  x2={dvfsChartX(fOp)} y2={175}
                  stroke="#6366f144" strokeWidth={1} strokeDasharray="2,2"
                />

                {/* Label for op point */}
                <text
                  x={dvfsChartX(fOp) + 8}
                  y={dvfsChartY(vddOp) - 6}
                  fontSize={7} fill="#a5b4fc"
                >
                  {fOp.toFixed(1)}GHz, {vddOp.toFixed(2)}V
                </text>

                {/* Region label */}
                <text
                  x={(dvfsChartX(fMin) + dvfsChartX(fMax)) / 2}
                  y={(dvfsChartY(vddMin) + dvfsChartY(vddMax)) / 2}
                  textAnchor="middle" fontSize={7} fill="#6366f188"
                >
                  DVFS Region
                </text>
              </svg>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">DVFS Power Law</p>
                  <p className="font-mono text-sm">P_dyn ∝ V²·f</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cubic savings possible since V and f scale together
                  </p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Full Form</p>
                  <p className="font-mono text-sm">P(V,f) = α·C·V²·f</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    α=activity, C=capacitance, V=voltage, f=frequency
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══ Bottom Formula Reference Card ════════════════════════════════════ */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold">Formula Reference</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Dynamic Power</p>
              <p className="font-mono text-sm">P_dyn = α·C·V²·f</p>
              <p className="text-xs text-muted-foreground mt-1">
                Switching power proportional to frequency and square of voltage
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Retention Breakeven</p>
              <p className="font-mono text-sm">E_breakeven = E_save / P_domain</p>
              <p className="text-xs text-muted-foreground mt-1">
                Minimum sleep time for retention registers to be worth using
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Isolation Cell</p>
              <p className="font-mono text-sm">ISO: out = enable ? in : clamp</p>
              <p className="text-xs text-muted-foreground mt-1">
                Clamps outputs to known-good value when source domain powers off
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">DVFS Cube Law</p>
              <p className="font-mono text-sm">DVFS: P ∝ V²·f</p>
              <p className="text-xs text-muted-foreground mt-1">
                Linked V/f scaling yields near-cubic power reduction at lower workloads
              </p>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
