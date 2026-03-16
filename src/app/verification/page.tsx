"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  Activity,
  Layers,
  Cpu,
  Info,
  GitBranch,
  Eye,
} from "lucide-react";

// ─── Physics / Domain Constants ────────────────────────────────────────────────

const FSM_STATES: string[] = ["IDLE", "FETCH", "DECODE", "EXECUTE", "WRITEBACK", "HALT"];
const TOTAL_FSM_STATES = 6;

interface FsmTransition {
  from: string;
  to: string;
  label: string;
}

const FSM_TRANSITIONS: FsmTransition[] = [
  { from: "IDLE",      to: "FETCH",     label: "IDLE→FETCH"      },
  { from: "FETCH",     to: "DECODE",    label: "FETCH→DECODE"    },
  { from: "DECODE",    to: "EXECUTE",   label: "DECODE→EXECUTE"  },
  { from: "EXECUTE",   to: "WRITEBACK", label: "EXECUTE→WRITEBACK"},
  { from: "WRITEBACK", to: "IDLE",      label: "WRITEBACK→IDLE"  },
  { from: "DECODE",    to: "HALT",      label: "DECODE→HALT"     },
  { from: "EXECUTE",   to: "IDLE",      label: "EXECUTE→IDLE"    },
];
const TOTAL_FSM_TRANSITIONS = 7;

interface FsmStatePos {
  x: number;
  y: number;
}

const FSM_STATE_POSITIONS: Record<string, FsmStatePos> = {
  IDLE:      { x: 55,  y: 110 },
  FETCH:     { x: 130, y: 40  },
  DECODE:    { x: 220, y: 40  },
  EXECUTE:   { x: 285, y: 110 },
  WRITEBACK: { x: 220, y: 180 },
  HALT:      { x: 130, y: 180 },
};

interface TimingPath {
  name: string;
  slack: number;
}

const TIMING_PATHS: TimingPath[] = [
  { name: "ALU critical",    slack: -0.30 },
  { name: "MEM read path",   slack: -0.15 },
  { name: "FIFO full flag",  slack:  0.05 },
  { name: "Decode logic",    slack:  0.12 },
  { name: "Mux select",      slack:  0.20 },
  { name: "Clock enable",    slack:  0.35 },
  { name: "Output register", slack:  0.42 },
  { name: "Reset sync",      slack:  0.58 },
];

interface AssertionDef {
  name: string;
  category: string;
}

const ASSERTIONS: AssertionDef[] = [
  { name: "handshake valid-ready",  category: "Protocol"   },
  { name: "no-X propagation",       category: "Protocol"   },
  { name: "back-pressure",          category: "Protocol"   },
  { name: "timeout",                category: "Protocol"   },
  { name: "overflow check",         category: "Arithmetic" },
  { name: "divide-by-zero",         category: "Arithmetic" },
  { name: "saturation",             category: "Arithmetic" },
  { name: "carry correct",          category: "Arithmetic" },
  { name: "address bounds",         category: "Memory"     },
  { name: "write-enable conflict",  category: "Memory"     },
  { name: "bank collision",         category: "Memory"     },
  { name: "refresh timing",         category: "Memory"     },
];

// ─── Typed Helpers ──────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function svgArrow(
  x1: number, y1: number, x2: number, y2: number, r: number = 18
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return "";
  const ux = dx / len;
  const uy = dy / len;
  const sx = x1 + ux * r;
  const sy = y1 + uy * r;
  const ex = x2 - ux * (r + 6);
  const ey = y2 - uy * (r + 6);
  return `M ${sx.toFixed(1)} ${sy.toFixed(1)} L ${ex.toFixed(1)} ${ey.toFixed(1)}`;
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export default function VerificationPage() {

  // ── Section 1: FSM Coverage ──────────────────────────────────────────────────
  const [visitedStates, setVisitedStates] = useState<Set<string>>(
    new Set(["IDLE", "FETCH", "DECODE"])
  );
  const [visitedTransitions, setVisitedTransitions] = useState<Set<string>>(
    new Set(["IDLE→FETCH", "FETCH→DECODE", "DECODE→EXECUTE"])
  );

  const stateCov = (visitedStates.size / TOTAL_FSM_STATES) * 100;
  const transCov = (visitedTransitions.size / TOTAL_FSM_TRANSITIONS) * 100;
  const fsmOverall = (stateCov + transCov) / 2;

  function toggleState(s: string) {
    setVisitedStates((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function toggleTransition(label: string) {
    setVisitedTransitions((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  // ── Section 2: Formal Verification CoI ───────────────────────────────────────
  const [propertyDepth, setPropertyDepth] = useState<number>(20);
  const [coneWidth, setConeWidth]         = useState<number>(100);
  const [solverTimeS, setSolverTimeS]     = useState<number>(60);

  const estMemBytes = coneWidth * propertyDepth * 8;
  const satEfficiency = Math.max(1, 1000 / coneWidth);
  const propsInBudget = Math.floor(satEfficiency * solverTimeS);

  // ── Section 3: Timing Closure ─────────────────────────────────────────────────
  const [fixedPaths, setFixedPaths]       = useState<Set<number>>(new Set());
  const [tClkNs, setTClkNs]             = useState<number>(1.5);
  const [globalSlackAdj, setGlobalSlackAdj] = useState<number>(0);

  function toggleFixedPath(i: number) {
    setFixedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const adjustedSlacks: number[] = TIMING_PATHS.map((p, i) =>
    (p.slack + globalSlackAdj) * (tClkNs / 1.5) + (fixedPaths.has(i) ? 0.5 : 0)
  );

  const sortedTimingIndices = useMemo(
    () => [...TIMING_PATHS.keys()].sort((a, b) => adjustedSlacks[a] - adjustedSlacks[b]),
    [adjustedSlacks]
  );

  const wns = Math.min(...adjustedSlacks);
  const tns = adjustedSlacks.reduce((acc, s) => acc + Math.max(0, -s), 0);
  const timingClean = wns >= 0;

  // ── Section 4: Assertion Coverage ────────────────────────────────────────────
  const [assertionActive, setAssertionActive] = useState<boolean[]>(
    new Array(12).fill(true)
  );
  const [simCyclesMils, setSimCyclesMils] = useState<number>(100);

  function toggleAssertion(i: number) {
    setAssertionActive((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  }

  const baseCoverage = Math.min(99, 60 + simCyclesMils / 50);
  const activeCount = assertionActive.filter(Boolean).length;
  const meanCoverage = activeCount > 0 ? baseCoverage : 0;
  const pEscape = activeCount > 0
    ? Math.pow(1 - meanCoverage / 100, activeCount)
    : 1;
  const assertionDensity = activeCount / 1000;

  // ── Section 5: Coverage Convergence ──────────────────────────────────────────
  const [seedCount, setSeedCount]               = useState<number>(20);
  const [simTimeHrsPerSeed, setSimTimeHrsPerSeed] = useState<number>(2);
  const [constraintTightness, setConstraintTightness] = useState<number>(0.5);

  const maxCov = 95 - (1 - constraintTightness) * 15;
  const k = constraintTightness * 0.15;

  function coverageAtN(n: number): number {
    return maxCov * (1 - Math.exp(-n * k));
  }

  const currentCoverage = coverageAtN(seedCount);
  const totalHours = seedCount * simTimeHrsPerSeed;
  const covPerHour = totalHours > 0 ? currentCoverage / totalHours : 0;

  // Find "knee": first seed where marginal gain < 0.5%/seed
  const kneeN = useMemo(() => {
    for (let n = 1; n <= 100; n++) {
      const gain = coverageAtN(n) - coverageAtN(n - 1);
      if (gain < 0.5) return n;
    }
    return 100;
  }, [constraintTightness, maxCov, k]);

  // Convergence curve points
  const convergenceCurve = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    for (let n = 0; n <= 100; n += 2) {
      pts.push({ x: n, y: coverageAtN(n) });
    }
    return pts;
  }, [constraintTightness, maxCov, k]);

  const svgCurvePoints = convergenceCurve
    .map((p) => {
      const px = 30 + (p.x / 100) * 270;
      const py = 180 - (p.y / 100) * 160;
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(" ");

  const seedLineX = 30 + (seedCount / 100) * 270;
  const seedLineY = 180 - (currentCoverage / 100) * 160;
  const kneeLineX = 30 + (kneeN / 100) * 270;

  // ────────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* ── Header ── */}
        <div className="bg-emerald-500/20 rounded-xl border border-emerald-500/30 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-emerald-400" />
            <h1 className="text-3xl font-bold text-emerald-400">Verification &amp; Coverage</h1>
          </div>
          <p className="text-muted-foreground">
            Simulation coverage, formal verification, timing closure, assertion density, and bug escape modeling
          </p>
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* Section 1: FSM Coverage Visualizer */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-semibold">FSM Coverage Visualizer</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SVG Diagram */}
            <div>
              <svg viewBox="0 0 340 220" className="w-full rounded-lg bg-muted/20 border border-border">
                <defs>
                  <marker id="arrowhead-vis" markerWidth="8" markerHeight="6"
                    refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#6b7280" />
                  </marker>
                  <marker id="arrowhead-vis-active" markerWidth="8" markerHeight="6"
                    refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#10b981" />
                  </marker>
                </defs>

                {/* Transitions */}
                {FSM_TRANSITIONS.map((t) => {
                  const from = FSM_STATE_POSITIONS[t.from];
                  const to   = FSM_STATE_POSITIONS[t.to];
                  const active = visitedTransitions.has(t.label);
                  const d = svgArrow(from.x, from.y, to.x, to.y);
                  return (
                    <path
                      key={t.label}
                      d={d}
                      fill="none"
                      stroke={active ? "#10b981" : "#374151"}
                      strokeWidth={active ? 2 : 1.5}
                      markerEnd={active ? "url(#arrowhead-vis-active)" : "url(#arrowhead-vis)"}
                      strokeDasharray={active ? "none" : "4 3"}
                    />
                  );
                })}

                {/* States */}
                {FSM_STATES.map((s) => {
                  const pos = FSM_STATE_POSITIONS[s];
                  const visited = visitedStates.has(s);
                  return (
                    <g key={s}>
                      <circle
                        cx={pos.x} cy={pos.y} r={18}
                        fill={visited ? "#065f46" : "#1f2937"}
                        stroke={visited ? "#10b981" : "#4b5563"}
                        strokeWidth={visited ? 2 : 1}
                      />
                      <text
                        x={pos.x} y={pos.y}
                        textAnchor="middle" dominantBaseline="middle"
                        fontSize="7" fill={visited ? "#6ee7b7" : "#9ca3af"}
                        fontFamily="monospace"
                      >
                        {s}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Controls + Stats */}
            <div className="space-y-4">
              {/* Coverage Stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "State Cov", val: stateCov },
                  { label: "Trans Cov", val: transCov },
                  { label: "Overall",   val: fsmOverall },
                ].map((m) => (
                  <div key={m.label} className="bg-muted/30 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="text-xl font-bold text-emerald-400">{m.val.toFixed(0)}%</p>
                  </div>
                ))}
              </div>

              {/* State toggles */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Toggle States</p>
                <div className="flex flex-wrap gap-2">
                  {FSM_STATES.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleState(s)}
                      className={`px-2 py-1 text-xs rounded font-mono border transition-colors ${
                        visitedStates.has(s)
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                          : "bg-muted/20 border-border text-muted-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transition toggles */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Toggle Transitions</p>
                <div className="flex flex-wrap gap-2">
                  {FSM_TRANSITIONS.map((t) => (
                    <button
                      key={t.label}
                      onClick={() => toggleTransition(t.label)}
                      className={`px-2 py-1 text-xs rounded font-mono border transition-colors ${
                        visitedTransitions.has(t.label)
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                          : "bg-muted/20 border-border text-muted-foreground"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status badge */}
              {fsmOverall > 90 ? (
                <div className="flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-300">Coverage target met (&gt;90%)</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-300">Coverage below target — {fsmOverall.toFixed(1)}%</span>
                </div>
              )}

              {/* Formula card */}
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Coverage Formula</p>
                <p className="font-mono text-sm">Coverage = (visited / total) × 100%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ratio of visited states and transitions to total possible elements
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* Section 2: Formal Verification Cone-of-Influence */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-semibold">Formal Verification Cone-of-Influence</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Controls */}
            <div className="space-y-4">
              {/* Property Depth */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-muted-foreground">BMC Property Depth</label>
                  <span className="text-sm font-mono text-emerald-400">{propertyDepth} cycles</span>
                </div>
                <input
                  type="range" min={5} max={50} step={5}
                  value={propertyDepth}
                  onChange={(e) => setPropertyDepth(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              {/* Cone Width */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-muted-foreground">Cone Width (state bits)</label>
                  <span className="text-sm font-mono text-emerald-400">{coneWidth} bits</span>
                </div>
                <input
                  type="range" min={10} max={500} step={10}
                  value={coneWidth}
                  onChange={(e) => setConeWidth(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              {/* Solver Time */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-muted-foreground">Solver Time Budget</label>
                  <span className="text-sm font-mono text-emerald-400">{solverTimeS}s</span>
                </div>
                <input
                  type="range" min={1} max={3600} step={1}
                  value={solverTimeS}
                  onChange={(e) => setSolverTimeS(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              {/* Derived metrics */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "State Space",   val: `2^${coneWidth}` },
                  { label: "Est. Memory",   val: formatBytes(estMemBytes) },
                  { label: "SAT eff.",      val: `${satEfficiency.toFixed(1)} prop/s` },
                  { label: "Props/budget",  val: `${propsInBudget}` },
                ].map((m) => (
                  <div key={m.label} className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="text-sm font-mono font-bold text-emerald-400">{m.val}</p>
                  </div>
                ))}
              </div>

              {/* Formula card */}
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">BMC Principle</p>
                <p className="font-mono text-sm">BMC depth k verifies ¬P reachable within k steps</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Bounded model checking unrolls the transition relation k times and queries SAT
                </p>
              </div>
            </div>

            {/* SVG Cone-of-Influence */}
            <div>
              <svg viewBox="0 0 320 200" className="w-full rounded-lg bg-muted/20 border border-border">
                <defs>
                  <linearGradient id="coneGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#374151" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.4" />
                  </linearGradient>
                </defs>

                {/* Cone shape: expands left to right */}
                {/* Property node on right */}
                {/* Cone tip at right (property), wide end at left (state bits) */}
                <polygon
                  points="30,10 30,190 290,110"
                  fill="url(#coneGrad)"
                  stroke="#10b981"
                  strokeWidth="1"
                  strokeOpacity="0.4"
                />

                {/* Depth boundary line */}
                {(() => {
                  const bx = 30 + (propertyDepth / 50) * 260;
                  return (
                    <line
                      x1={bx} y1={10} x2={bx} y2={190}
                      stroke="#f59e0b"
                      strokeWidth={1.5}
                      strokeDasharray="5 3"
                    />
                  );
                })()}

                {/* State bit dots at left edge */}
                {Array.from({ length: 10 }, (_, i) => {
                  const dotY = 20 + (i / 9) * 160;
                  const inCone = i < Math.round((coneWidth / 500) * 10);
                  return (
                    <circle
                      key={i}
                      cx={20} cy={dotY} r={4}
                      fill={inCone ? "#10b981" : "#4b5563"}
                      stroke={inCone ? "#6ee7b7" : "#374151"}
                      strokeWidth={1}
                    />
                  );
                })}

                {/* Property node */}
                <circle cx={290} cy={110} r={14} fill="#065f46" stroke="#10b981" strokeWidth={2} />
                <text x={290} y={110} textAnchor="middle" dominantBaseline="middle"
                  fontSize="7" fill="#6ee7b7" fontFamily="monospace">
                  PROP
                </text>

                {/* Labels */}
                <text x={22} y={207} fontSize="8" fill="#9ca3af" fontFamily="monospace">state bits</text>
                <text x={255} y={207} fontSize="8" fill="#9ca3af" fontFamily="monospace">property</text>
                <text x={30 + (propertyDepth / 50) * 260 + 2} y={8} fontSize="8" fill="#f59e0b" fontFamily="monospace">
                  k={propertyDepth}
                </text>
              </svg>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* Section 3: Timing Closure Progress */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-semibold">Timing Closure Progress</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sliders */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-muted-foreground">Clock Period</label>
                  <span className="text-sm font-mono text-emerald-400">{tClkNs.toFixed(1)} ns</span>
                </div>
                <input
                  type="range" min={0.5} max={3.0} step={0.1}
                  value={tClkNs}
                  onChange={(e) => setTClkNs(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-muted-foreground">Global Slack Adjust</label>
                  <span className="text-sm font-mono text-emerald-400">
                    {globalSlackAdj >= 0 ? "+" : ""}{globalSlackAdj.toFixed(2)} ns
                  </span>
                </div>
                <input
                  type="range" min={-0.3} max={0.3} step={0.05}
                  value={globalSlackAdj}
                  onChange={(e) => setGlobalSlackAdj(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              {/* WNS / TNS / Fixed */}
              <div className="space-y-2">
                <div className="bg-muted/30 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">WNS</span>
                  <span className={`font-mono text-sm font-bold ${wns >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {wns.toFixed(3)} ns
                  </span>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">TNS</span>
                  <span className={`font-mono text-sm font-bold ${tns === 0 ? "text-green-400" : "text-red-400"}`}>
                    {(-tns).toFixed(3)} ns
                  </span>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Fixed paths</span>
                  <span className="font-mono text-sm font-bold text-emerald-400">
                    {fixedPaths.size} / {TIMING_PATHS.length}
                  </span>
                </div>
              </div>

              {timingClean ? (
                <div className="flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-300">Timing closure met</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-300">Timing violations present</span>
                </div>
              )}

              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Timing Formulas</p>
                <p className="font-mono text-sm">WNS = min(slack_i)</p>
                <p className="font-mono text-sm">TNS = Σmax(0, −slack_i)</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Worst and total negative slack measure timing closure quality
                </p>
              </div>
            </div>

            {/* Bar chart — spans 2 columns */}
            <div className="lg:col-span-2 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Slack by Path (click to fix)</p>
              {sortedTimingIndices.map((i) => {
                const path = TIMING_PATHS[i];
                const s = adjustedSlacks[i];
                const maxAbs = 1.2;
                const isFixed = fixedPaths.has(i);
                const pctCenter = 50;
                const pctWidth = Math.abs(s) / maxAbs * 50;
                const positive = s >= 0;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 cursor-pointer group"
                    onClick={() => toggleFixedPath(i)}
                  >
                    <span className={`text-xs font-mono w-32 shrink-0 ${isFixed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {path.name}
                    </span>
                    <div className="flex-1 h-5 relative bg-muted/20 rounded">
                      {/* center line */}
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />
                      <motion.div
                        className={`absolute top-1 bottom-1 rounded-sm ${positive ? "bg-green-500/70" : "bg-red-500/70"}`}
                        style={positive
                          ? { left: `${pctCenter}%`, width: 0 }
                          : { right: `${pctCenter}%`, width: 0 }
                        }
                        animate={positive
                          ? { width: `${pctWidth}%` }
                          : { width: `${pctWidth}%` }
                        }
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      />
                    </div>
                    <span className={`text-xs font-mono w-16 text-right ${positive ? "text-green-400" : "text-red-400"}`}>
                      {s >= 0 ? "+" : ""}{s.toFixed(3)}
                    </span>
                    {isFixed && <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* Section 4: Assertion Coverage Dashboard */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-semibold">Assertion Coverage Dashboard</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Groups */}
            <div className="space-y-4">
              {(["Protocol", "Arithmetic", "Memory"] as const).map((cat) => (
                <div key={cat}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">{cat}</p>
                  <div className="flex flex-wrap gap-2">
                    {ASSERTIONS.map((a, i) => {
                      if (a.category !== cat) return null;
                      const active = assertionActive[i];
                      return (
                        <button
                          key={i}
                          onClick={() => toggleAssertion(i)}
                          className={`flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors ${
                            active
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                              : "bg-muted/10 border-border text-muted-foreground"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full inline-block ${active ? "bg-green-400" : "bg-muted-foreground"}`}
                          />
                          {a.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Sim cycles slider */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-muted-foreground">Simulation Cycles</label>
                  <span className="text-sm font-mono text-emerald-400">{simCyclesMils}M cycles</span>
                </div>
                <input
                  type="range" min={1} max={1000} step={10}
                  value={simCyclesMils}
                  onChange={(e) => setSimCyclesMils(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
            </div>

            {/* Bubble grid + metrics */}
            <div className="space-y-4">
              {/* Bubble grid */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Assertion Status</p>
                <div className="grid grid-cols-4 gap-3">
                  {ASSERTIONS.map((a, i) => {
                    const active = assertionActive[i];
                    return (
                      <div
                        key={i}
                        onClick={() => toggleAssertion(i)}
                        className="cursor-pointer flex flex-col items-center gap-1"
                        title={a.name}
                      >
                        <motion.div
                          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${
                            active
                              ? "bg-green-500/20 border-green-500/60"
                              : "bg-muted/20 border-border"
                          }`}
                          animate={{ scale: active ? 1 : 0.85, opacity: active ? 1 : 0.5 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        >
                          {active
                            ? <CheckCircle className="w-4 h-4 text-green-400" />
                            : <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                          }
                        </motion.div>
                        <span className="text-xs text-center text-muted-foreground leading-tight w-14">
                          {a.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Mean Coverage</p>
                  <p className="text-xl font-bold text-emerald-400">{meanCoverage.toFixed(1)}%</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Active Assertions</p>
                  <p className="text-xl font-bold text-emerald-400">{activeCount}</p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Bug Escape P</p>
                  <p className={`text-xl font-bold ${pEscape < 0.01 ? "text-green-400" : "text-red-400"}`}>
                    {pEscape < 0.001 ? "<0.001" : pEscape.toFixed(4)}
                  </p>
                </div>
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Assert Density</p>
                  <p className="text-xl font-bold text-emerald-400">{assertionDensity.toFixed(3)}/kLOC</p>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Bug Escape Model</p>
                <p className="font-mono text-sm">P_escape = (1 − C̄)^N</p>
                <p className="text-xs text-muted-foreground mt-1">
                  where C̄ = mean coverage ({meanCoverage.toFixed(1)}%), N = active assertions ({activeCount})
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* Section 5: Coverage Convergence Model */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-semibold">Coverage Convergence Model</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Controls */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-muted-foreground">Seed Count</label>
                  <span className="text-sm font-mono text-emerald-400">{seedCount} seeds</span>
                </div>
                <input
                  type="range" min={1} max={100} step={1}
                  value={seedCount}
                  onChange={(e) => setSeedCount(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-muted-foreground">Sim Time per Seed</label>
                  <span className="text-sm font-mono text-emerald-400">{simTimeHrsPerSeed.toFixed(1)} hrs</span>
                </div>
                <input
                  type="range" min={0.1} max={24} step={0.1}
                  value={simTimeHrsPerSeed}
                  onChange={(e) => setSimTimeHrsPerSeed(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-muted-foreground">Constraint Tightness</label>
                  <span className="text-sm font-mono text-emerald-400">{constraintTightness.toFixed(2)}</span>
                </div>
                <input
                  type="range" min={0.1} max={1.0} step={0.05}
                  value={constraintTightness}
                  onChange={(e) => setConstraintTightness(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Max Coverage", val: `${maxCov.toFixed(1)}%` },
                  { label: "Achieved",     val: `${currentCoverage.toFixed(1)}%` },
                  { label: "Total Hours",  val: `${totalHours.toFixed(1)} hrs` },
                  { label: "Cov/Hour",     val: `${covPerHour.toFixed(2)}%/hr` },
                  { label: "Knee Seed",    val: `N=${kneeN}` },
                  { label: "k factor",     val: `${k.toFixed(3)}` },
                ].map((m) => (
                  <div key={m.label} className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="text-sm font-mono font-bold text-emerald-400">{m.val}</p>
                  </div>
                ))}
              </div>

              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Convergence Formula</p>
                <p className="font-mono text-sm">C(N) = C_max·(1 − e^(−N·k))</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Diminishing returns: each new seed contributes less marginal coverage
                </p>
              </div>
            </div>

            {/* Convergence SVG */}
            <div>
              <svg viewBox="0 0 320 200" className="w-full rounded-lg bg-muted/20 border border-border">
                {/* Axes */}
                <line x1={30} y1={10} x2={30} y2={185} stroke="#4b5563" strokeWidth={1} />
                <line x1={30} y1={185} x2={305} y2={185} stroke="#4b5563" strokeWidth={1} />

                {/* Y axis labels */}
                {[0, 25, 50, 75, 100].map((v) => {
                  const py = 180 - (v / 100) * 160;
                  return (
                    <g key={v}>
                      <line x1={27} y1={py} x2={30} y2={py} stroke="#4b5563" strokeWidth={1} />
                      <text x={24} y={py + 3} textAnchor="end" fontSize="7" fill="#6b7280" fontFamily="monospace">
                        {v}%
                      </text>
                    </g>
                  );
                })}

                {/* X axis labels */}
                {[0, 25, 50, 75, 100].map((v) => {
                  const px = 30 + (v / 100) * 270;
                  return (
                    <g key={v}>
                      <line x1={px} y1={185} x2={px} y2={188} stroke="#4b5563" strokeWidth={1} />
                      <text x={px} y={197} textAnchor="middle" fontSize="7" fill="#6b7280" fontFamily="monospace">
                        {v}
                      </text>
                    </g>
                  );
                })}

                {/* Max coverage line */}
                <line
                  x1={30} y1={180 - (maxCov / 100) * 160}
                  x2={300} y2={180 - (maxCov / 100) * 160}
                  stroke="#6b7280" strokeWidth={1} strokeDasharray="4 3"
                />
                <text
                  x={302}
                  y={180 - (maxCov / 100) * 160 + 3}
                  fontSize="7" fill="#9ca3af" fontFamily="monospace"
                >
                  max
                </text>

                {/* Convergence curve */}
                <polyline
                  points={svgCurvePoints}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth={2}
                />

                {/* Knee marker */}
                <line
                  x1={kneeLineX} y1={10} x2={kneeLineX} y2={185}
                  stroke="#f59e0b" strokeWidth={1} strokeDasharray="3 3"
                />
                <text x={kneeLineX + 2} y={20} fontSize="7" fill="#f59e0b" fontFamily="monospace">
                  knee
                </text>

                {/* Current seed marker */}
                <line
                  x1={seedLineX} y1={10} x2={seedLineX} y2={185}
                  stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="5 2"
                />
                <circle
                  cx={seedLineX} cy={seedLineY} r={4}
                  fill="#8b5cf6" stroke="#c4b5fd" strokeWidth={1}
                />
                <text
                  x={clamp(seedLineX + 4, 32, 285)}
                  y={clamp(seedLineY - 6, 12, 175)}
                  fontSize="7" fill="#c4b5fd" fontFamily="monospace"
                >
                  N={seedCount}
                </text>

                {/* Axis titles */}
                <text x={167} y={210} textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="sans-serif">
                  Seeds
                </text>
                <text
                  x={8} y={110}
                  textAnchor="middle" fontSize="8" fill="#9ca3af" fontFamily="sans-serif"
                  transform="rotate(-90, 8, 110)"
                >
                  Coverage %
                </text>
              </svg>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* Bottom Formula Reference Card */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-semibold">Formula Reference</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">FSM Coverage</p>
              <p className="font-mono text-sm">Coverage = visited / total × 100%</p>
              <p className="text-xs text-muted-foreground mt-1">
                Fraction of state machine elements exercised during simulation
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Bug Escape</p>
              <p className="font-mono text-sm">P_escape = (1 − C̄)^N</p>
              <p className="text-xs text-muted-foreground mt-1">
                Probability a bug escapes all N assertions given mean coverage C̄
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Timing Slack</p>
              <p className="font-mono text-sm">WNS = min(slack_i)</p>
              <p className="font-mono text-sm">TNS = Σmax(0, −slack_i)</p>
              <p className="text-xs text-muted-foreground mt-1">
                Worst and total negative slack quantify timing closure margin
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Convergence</p>
              <p className="font-mono text-sm">C(N) = C_max·(1−e^(−N·k))</p>
              <p className="text-xs text-muted-foreground mt-1">
                Diminishing-returns model for coverage growth with additional seeds
              </p>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
