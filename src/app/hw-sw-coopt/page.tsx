"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Cpu,
  Activity,
  Database,
  Zap,
  AlertTriangle,
  CheckCircle,
  Info,
  BarChart2,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────────

const T_SETUP = 0.2; // ns
const T_HOLD = 0.1; // ns

const PIPELINE_STAGES = [
  { name: "Fetch", defaultDelay: 0.8 },
  { name: "Decode", defaultDelay: 1.2 },
  { name: "Execute", defaultDelay: 2.4 },
  { name: "Memory", defaultDelay: 1.1 },
  { name: "Writeback", defaultDelay: 0.7 },
];

const MEMORY_HIERARCHY = [
  { name: "Register", cycles: 1, bwTBs: 3.0, bwLabel: "3 TB/s" },
  { name: "L1 Cache", cycles: 4, bwTBs: 2.0, bwLabel: "2 TB/s" },
  { name: "L2 Cache", cycles: 12, bwTBs: 0.8, bwLabel: "800 GB/s" },
  { name: "L3 Cache", cycles: 40, bwTBs: 0.3, bwLabel: "300 GB/s" },
  { name: "HBM2e", cycles: 200, bwTBs: 0.46, bwLabel: "460 GB/s" },
  { name: "LPDDR5", cycles: 150, bwTBs: 0.068, bwLabel: "68 GB/s" },
];

// Approximate on-chip capacity thresholds (GB)
const MEMORY_CAPACITY_GB = [
  { name: "Register", capGB: 0.000001 },
  { name: "L1 Cache", capGB: 0.0005 },
  { name: "L2 Cache", capGB: 0.004 },
  { name: "L3 Cache", capGB: 0.032 },
  { name: "HBM2e", capGB: 80 },
  { name: "LPDDR5", capGB: 256 },
];

const PRECISION_OPTIONS = [
  { label: "FP32", bytesPerParam: 4, accuracyDrop: "0%", speedup: 1.0, highlight: false },
  { label: "FP16", bytesPerParam: 2, accuracyDrop: "~0.1%", speedup: 1.8, highlight: false },
  { label: "INT8", bytesPerParam: 1, accuracyDrop: "~0.5%", speedup: 3.5, highlight: true },
  { label: "INT4", bytesPerParam: 0.5, accuracyDrop: "2–4%", speedup: 6.0, highlight: false },
];

const F_MAX_GHZ = 1.2; // max frequency in GHz

function vfCurve(fGHz: number, corner: "TT" | "SS" | "FF"): number {
  const v_tt = 0.6 + 0.4 * Math.pow(fGHz / F_MAX_GHZ, 0.7);
  if (corner === "SS") return v_tt * 1.15;
  if (corner === "FF") return v_tt * 0.9;
  return v_tt;
}

// Normalised dynamic power (relative to TT at f_max)
function normPower(fGHz: number, corner: "TT" | "SS" | "FF"): number {
  const v = vfCurve(fGHz, corner);
  const v_ref = vfCurve(F_MAX_GHZ, "TT");
  return (v * v * fGHz) / (v_ref * v_ref * F_MAX_GHZ);
}

// ── Waveform helpers ─────────────────────────────────────────────────────────

function buildWaveformPath(
  transitions: number[], // timestamps (ns) where signal toggles, starting low
  tTotal: number,
  svgW: number,
  svgH: number,
  yHigh: number,
  yLow: number
): string {
  const scaleX = svgW / tTotal;
  let d = "";
  let level = 0; // start low
  let prevX = 0;

  for (const t of transitions) {
    const x = t * scaleX;
    const y = level === 0 ? yLow : yHigh;
    if (d === "") {
      d = `M 0 ${y}`;
    } else {
      d += ` L ${x} ${y}`;
    }
    // Toggle
    level = 1 - level;
    const yNext = level === 0 ? yLow : yHigh;
    d += ` L ${x} ${yNext}`;
    prevX = x;
  }
  // Extend to end
  const yFinal = level === 0 ? yLow : yHigh;
  d += ` L ${svgW} ${yFinal}`;
  return d;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HWSWCoOptPage() {
  const [activeTab, setActiveTab] = useState<"waveform" | "pipeline" | "memory" | "vf" | "quant">(
    "waveform"
  );

  // --- Waveform state ---
  const [clkPeriod, setClkPeriod] = useState(4); // ns
  const [tComb, setTComb] = useState(3.0); // ns

  // --- Pipeline state ---
  const [stageDelays, setStageDelays] = useState(
    PIPELINE_STAGES.map((s) => s.defaultDelay)
  );

  // --- Memory state ---
  const [modelSizeGB, setModelSizeGB] = useState(7); // GB
  const [batchSize, setBatchSize] = useState(1);
  const [workingSetGB, setWorkingSetGB] = useState(1);

  // --- VF curve state ---
  const [targetFreqGHz, setTargetFreqGHz] = useState(0.8);
  const [vfHover, setVfHover] = useState<{ x: number; y: number; fGHz: number } | null>(null);

  // --- Quantization state ---
  const [paramMillions, setParamMillions] = useState(7000);
  const [inferenceMsStr, setInferenceMsStr] = useState("1");

  // ── Waveform computations ─────────────────────────────────────────────────

  const slack = clkPeriod - (tComb + T_SETUP);
  const hasViolation = slack < 0;

  // Waveform SVG dimensions
  const WF_W = 600;
  const WF_H = 180;
  const CHAN_H = WF_H / 4;

  // Generate 4 clock cycles
  const numCycles = 4;
  const tTotal = numCycles * clkPeriod;

  // CLK transitions
  const clkTransitions: number[] = [];
  for (let i = 0; i <= numCycles * 2; i++) {
    clkTransitions.push((i * clkPeriod) / 2);
  }

  // DATA transitions (aligned to clock, valid after tComb from rising edge)
  const dataTransitions: number[] = [];
  for (let c = 0; c < numCycles; c++) {
    const rising = c * clkPeriod;
    dataTransitions.push(rising + tComb * 0.3);
    dataTransitions.push(rising + clkPeriod * 0.8);
  }

  // VALID: goes high after tComb from rising edge
  const validTransitions: number[] = [];
  for (let c = 0; c < numCycles; c++) {
    validTransitions.push(c * clkPeriod + tComb);
    validTransitions.push(c * clkPeriod + clkPeriod * 0.9);
  }

  // READY: static high for simplicity
  const readyTransitions: number[] = [0.5];

  // ── Pipeline computations ─────────────────────────────────────────────────

  const maxDelay = Math.max(...stageDelays);
  const criticalIdx = stageDelays.indexOf(maxDelay);
  const maxFreqGHz = 1 / (maxDelay + T_SETUP);
  const maxFreqMHz = maxFreqGHz * 1000;

  function balanceStages() {
    const mean = stageDelays.reduce((a, b) => a + b, 0) / stageDelays.length;
    setStageDelays(
      stageDelays.map((d) => {
        const delta = (mean - d) * 0.3;
        return Math.max(0.3, Math.round((d + delta) * 100) / 100);
      })
    );
  }

  // ── Memory computations ───────────────────────────────────────────────────

  const clkFreqGHz = 1.0; // assume 1GHz clock for latency
  const modelBytes = modelSizeGB * 1e9;

  let memLevel = "LPDDR5";
  for (const cap of MEMORY_CAPACITY_GB) {
    if (modelSizeGB <= cap.capGB) {
      memLevel = cap.name;
      break;
    }
  }

  const memEntry = MEMORY_HIERARCHY.find((m) => m.name === memLevel) ?? MEMORY_HIERARCHY[5];
  const inferenceLatencyNs = (memEntry.cycles / clkFreqGHz) * (modelSizeGB / workingSetGB);
  const inferenceLatencyUs = inferenceLatencyNs / 1000;

  // Roofline: arithmetic intensity = (2 * params * batch) / (params * 2 bytes)
  // = batch (dimensionless ratio simplifies to batch for FP16)
  const arithmeticIntensity = batchSize; // FLOPs/byte simplified
  const peakComputeTOPS = 100; // assumed chip peak (TOPS)
  const memBWTBs = memEntry.bwTBs;
  const rooflineLimit = Math.min(peakComputeTOPS, memBWTBs * arithmeticIntensity);
  const isComputeBound = memBWTBs * arithmeticIntensity > peakComputeTOPS;

  // ── VF curve data ─────────────────────────────────────────────────────────

  const vfPoints = Array.from({ length: 50 }, (_, i) => {
    const fGHz = 0.3 + (i / 49) * (F_MAX_GHZ - 0.3);
    return {
      fGHz,
      vTT: vfCurve(fGHz, "TT"),
      vSS: vfCurve(fGHz, "SS"),
      vFF: vfCurve(fGHz, "FF"),
      pTT: normPower(fGHz, "TT"),
    };
  });

  const VF_W = 500;
  const VF_H = 220;
  const VF_PAD = { left: 48, right: 16, top: 12, bottom: 36 };
  const vfInnerW = VF_W - VF_PAD.left - VF_PAD.right;
  const vfInnerH = VF_H - VF_PAD.top - VF_PAD.bottom;
  const V_MIN = 0.5;
  const V_MAX = 1.45;

  function vfToSvg(fGHz: number, v: number) {
    const x = VF_PAD.left + ((fGHz - 0.3) / (F_MAX_GHZ - 0.3)) * vfInnerW;
    const y = VF_PAD.top + (1 - (v - V_MIN) / (V_MAX - V_MIN)) * vfInnerH;
    return { x, y };
  }

  function buildVFPath(corner: "TT" | "SS" | "FF") {
    return vfPoints
      .map(({ fGHz }) => {
        const v = vfCurve(fGHz, corner);
        const { x, y } = vfToSvg(fGHz, v);
        return `${x},${y}`;
      })
      .join(" L ");
  }

  const targetVfSvg = vfToSvg(targetFreqGHz, vfCurve(targetFreqGHz, "TT"));

  // ── Quantization computations ─────────────────────────────────────────────

  const inferenceMs = parseFloat(inferenceMsStr) || 1;
  const paramCount = paramMillions * 1e6;

  const quantRows = PRECISION_OPTIONS.map((opt) => {
    const storageGB = (paramCount * opt.bytesPerParam) / 1e9;
    const bwRequiredGBs = storageGB / (inferenceMs / 1000);
    return { ...opt, storageGB, bwRequiredGBs };
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Cpu className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  Round 7
                </span>
                <h1 className="text-3xl font-bold">HW-SW Co-Optimization</h1>
              </div>
              <p className="text-muted-foreground mt-1">
                Timing analysis, waveform visualization, and hardware-software co-design for
                inference chips
              </p>
              <div className="flex gap-6 mt-3 text-sm flex-wrap">
                <span className="text-muted-foreground">
                  Slack:{" "}
                  <span className={`font-mono font-medium ${hasViolation ? "text-red-400" : "text-green-400"}`}>
                    {slack.toFixed(2)} ns
                  </span>
                </span>
                <span className="text-muted-foreground">
                  Max freq:{" "}
                  <span className="text-foreground font-mono font-medium">
                    {maxFreqMHz.toFixed(0)} MHz
                  </span>
                </span>
                <span className="text-muted-foreground">
                  Model fits in:{" "}
                  <span className="text-blue-300 font-mono font-medium">{memLevel}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {(
            [
              ["waveform", "Waveform Viewer"],
              ["pipeline", "Critical Path"],
              ["memory", "Memory Hierarchy"],
              ["vf", "V-F Scaling"],
              ["quant", "Quantization"],
            ] as const
          ).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? "border-blue-400 text-blue-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── WAVEFORM VIEWER ── */}
        {activeTab === "waveform" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Controls */}
              <div className="space-y-4">
                <div className="bg-card rounded-2xl border border-border p-5">
                  <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
                    <Activity className="w-4 h-4 text-blue-400" />
                    Timing Parameters
                  </h2>

                  <div className="space-y-5">
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Clock Period (T_clk)</span>
                        <span className="font-mono text-foreground">{clkPeriod.toFixed(1)} ns</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={0.1}
                        value={clkPeriod}
                        onChange={(e) => setClkPeriod(parseFloat(e.target.value))}
                        className="w-full accent-blue-400"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>1 ns</span>
                        <span>10 ns</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Combinational Delay (t_comb)</span>
                        <span className="font-mono text-foreground">{tComb.toFixed(1)} ns</span>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={9}
                        step={0.1}
                        value={tComb}
                        onChange={(e) => setTComb(parseFloat(e.target.value))}
                        className="w-full accent-purple-400"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>0.5 ns</span>
                        <span>9 ns</span>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Setup time (t_su)</span>
                        <span className="font-mono">{T_SETUP} ns</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Hold time (t_h)</span>
                        <span className="font-mono">{T_HOLD} ns</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Slack status */}
                <div
                  className={`rounded-2xl border p-5 ${
                    hasViolation
                      ? "border-red-500/40 bg-red-500/10"
                      : "border-green-500/40 bg-green-500/10"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {hasViolation ? (
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    )}
                    <span className={`text-sm font-bold ${hasViolation ? "text-red-400" : "text-green-400"}`}>
                      {hasViolation ? "TIMING VIOLATION" : "Timing OK"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Slack = T_clk − (t_comb + t_su)
                  </p>
                  <div className="font-mono text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">T_clk</span>
                      <span>{clkPeriod.toFixed(1)} ns</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">t_comb + t_su</span>
                      <span>{(tComb + T_SETUP).toFixed(2)} ns</span>
                    </div>
                    <div className={`flex justify-between font-bold border-t border-border pt-1 mt-1 ${hasViolation ? "text-red-400" : "text-green-400"}`}>
                      <span>Slack</span>
                      <span>{slack.toFixed(2)} ns</span>
                    </div>
                  </div>
                </div>

                {/* Formula */}
                <div className="bg-card rounded-2xl border border-border p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    Setup Constraint
                  </p>
                  <code className="text-sm block leading-relaxed">
                    Slack = T_clk − t_comb − t_su
                  </code>
                  <p className="text-xs text-muted-foreground mt-2">
                    Negative slack means data arrives too late for the flip-flop to sample reliably.
                  </p>
                </div>
              </div>

              {/* SVG Waveform */}
              <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-5">
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
                  <Activity className="w-4 h-4 text-green-400" />
                  Digital Signal Waveforms
                </h2>

                <div className="overflow-x-auto">
                  <svg
                    width={WF_W}
                    height={WF_H + 20}
                    viewBox={`0 0 ${WF_W} ${WF_H + 20}`}
                    className="w-full"
                    style={{ minWidth: 400 }}
                  >
                    {/* Background grid */}
                    {Array.from({ length: numCycles + 1 }, (_, i) => {
                      const x = (i * clkPeriod * WF_W) / tTotal;
                      return (
                        <line
                          key={i}
                          x1={x}
                          y1={0}
                          x2={x}
                          y2={WF_H}
                          stroke="#334155"
                          strokeWidth={1}
                          strokeDasharray="3,3"
                        />
                      );
                    })}

                    {/* Setup/Hold shading around rising clock edges */}
                    {Array.from({ length: numCycles }, (_, c) => {
                      const rEdge = ((c + 1) * clkPeriod * WF_W) / tTotal;
                      const suStart = rEdge - (T_SETUP * WF_W) / tTotal;
                      const hEnd = rEdge + (T_HOLD * WF_W) / tTotal;
                      const suW = (T_SETUP * WF_W) / tTotal;
                      const hW = (T_HOLD * WF_W) / tTotal;
                      const setupOk = clkPeriod - tComb > T_SETUP;
                      return (
                        <g key={c}>
                          {/* Setup window */}
                          <rect
                            x={Math.max(0, suStart)}
                            y={0}
                            width={suW}
                            height={WF_H}
                            fill={setupOk ? "#22c55e22" : "#ef444433"}
                          />
                          {/* Hold window */}
                          <rect
                            x={rEdge}
                            y={0}
                            width={hW}
                            height={WF_H}
                            fill="#f59e0b22"
                          />
                        </g>
                      );
                    })}

                    {/* Channel labels */}
                    {["CLK", "DATA", "VALID", "READY"].map((label, i) => (
                      <text
                        key={label}
                        x={4}
                        y={i * CHAN_H + CHAN_H / 2 + 4}
                        fontSize={9}
                        fill="#94a3b8"
                        fontFamily="monospace"
                      >
                        {label}
                      </text>
                    ))}

                    {/* CLK waveform */}
                    <path
                      d={buildWaveformPath(
                        clkTransitions,
                        tTotal,
                        WF_W,
                        CHAN_H,
                        4,
                        CHAN_H - 6,
                      )}
                      fill="none"
                      stroke="#60a5fa"
                      strokeWidth={1.5}
                    />

                    {/* DATA waveform */}
                    <path
                      d={buildWaveformPath(
                        dataTransitions,
                        tTotal,
                        WF_W,
                        CHAN_H,
                        CHAN_H + 4,
                        CHAN_H * 2 - 6,
                      )}
                      fill="none"
                      stroke="#a78bfa"
                      strokeWidth={1.5}
                    />

                    {/* VALID waveform */}
                    <path
                      d={buildWaveformPath(
                        validTransitions,
                        tTotal,
                        WF_W,
                        CHAN_H,
                        CHAN_H * 2 + 4,
                        CHAN_H * 3 - 6,
                      )}
                      fill="none"
                      stroke={hasViolation ? "#f87171" : "#34d399"}
                      strokeWidth={1.5}
                    />

                    {/* READY waveform */}
                    <path
                      d={buildWaveformPath(
                        readyTransitions,
                        tTotal,
                        WF_W,
                        CHAN_H,
                        CHAN_H * 3 + 4,
                        CHAN_H * 4 - 6,
                      )}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth={1.5}
                    />

                    {/* Axis */}
                    <line x1={0} y1={WF_H} x2={WF_W} y2={WF_H} stroke="#334155" strokeWidth={1} />

                    {/* Time labels */}
                    {Array.from({ length: numCycles + 1 }, (_, i) => {
                      const x = (i * clkPeriod * WF_W) / tTotal;
                      return (
                        <text key={i} x={x + 2} y={WF_H + 14} fontSize={8} fill="#64748b" fontFamily="monospace">
                          {(i * clkPeriod).toFixed(1)}ns
                        </text>
                      );
                    })}
                  </svg>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-blue-400" />
                    <span>CLK</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-violet-400" />
                    <span>DATA</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5" style={{ backgroundColor: hasViolation ? "#f87171" : "#34d399" }} />
                    <span>VALID</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-amber-400" />
                    <span>READY</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#22c55e22", border: "1px solid #22c55e" }} />
                    <span>Setup window</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#f59e0b22", border: "1px solid #f59e0b" }} />
                    <span>Hold window</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CRITICAL PATH ANALYZER ── */}
        {activeTab === "pipeline" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pipeline diagram + controls */}
              <div className="bg-card rounded-2xl border border-border p-5 space-y-5">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-orange-400" />
                  5-Stage Pipeline — Stage Delays
                </h2>

                <div className="space-y-3">
                  {PIPELINE_STAGES.map((stage, i) => {
                    const isCritical = i === criticalIdx;
                    return (
                      <div key={stage.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span
                            className={`font-medium ${isCritical ? "text-red-400" : "text-muted-foreground"}`}
                          >
                            {stage.name} {isCritical && "(critical)"}
                          </span>
                          <span className="font-mono">{stageDelays[i].toFixed(2)} ns</span>
                        </div>
                        <input
                          type="range"
                          min={0.3}
                          max={5}
                          step={0.05}
                          value={stageDelays[i]}
                          onChange={(e) => {
                            const next = [...stageDelays];
                            next[i] = parseFloat(e.target.value);
                            setStageDelays(next);
                          }}
                          className={`w-full ${isCritical ? "accent-red-400" : "accent-blue-400"}`}
                        />
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={balanceStages}
                  className="w-full py-2 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-colors"
                >
                  Balance Pipeline (±0.1 ns)
                </button>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-1">Max Frequency</p>
                    <p className="font-mono font-bold text-green-400">{maxFreqMHz.toFixed(0)} MHz</p>
                  </div>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-xs text-muted-foreground mb-1">Critical Stage</p>
                    <p className="font-mono font-bold text-red-400">
                      {PIPELINE_STAGES[criticalIdx].name} ({maxDelay.toFixed(2)} ns)
                    </p>
                  </div>
                </div>

                <div className="bg-card rounded-xl border border-border p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Formula</p>
                  <code className="text-xs block leading-relaxed">
                    f_max = 1 / (t_critical + t_su)
                  </code>
                  <p className="text-xs text-muted-foreground mt-1">
                    = 1 / ({maxDelay.toFixed(2)} + {T_SETUP}) ns = {maxFreqMHz.toFixed(0)} MHz
                  </p>
                </div>
              </div>

              {/* Bar chart */}
              <div className="bg-card rounded-2xl border border-border p-5">
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
                  <BarChart2 className="w-4 h-4 text-blue-400" />
                  Stage Delay Comparison
                </h2>

                <div className="flex items-end gap-2 h-52">
                  {PIPELINE_STAGES.map((stage, i) => {
                    const isCritical = i === criticalIdx;
                    const pct = (stageDelays[i] / 5) * 100;
                    return (
                      <div key={stage.name} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {stageDelays[i].toFixed(2)}
                        </span>
                        <div className="w-full flex flex-col justify-end" style={{ height: 160 }}>
                          <motion.div
                            className="w-full rounded-t"
                            style={{
                              backgroundColor: isCritical ? "#ef4444" : "#3b82f6",
                              opacity: isCritical ? 1 : 0.65,
                            }}
                            animate={{ height: `${pct}%` }}
                            transition={{ type: "spring", stiffness: 200 }}
                          />
                        </div>
                        <span
                          className={`text-[10px] font-medium ${isCritical ? "text-red-400" : "text-muted-foreground"}`}
                        >
                          {stage.name}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Pipeline diagram */}
                <div className="mt-4 flex items-center gap-0.5 overflow-x-auto">
                  {PIPELINE_STAGES.map((stage, i) => {
                    const isCritical = i === criticalIdx;
                    return (
                      <div key={stage.name} className="flex items-center">
                        <div
                          className={`px-3 py-2 rounded text-xs font-medium whitespace-nowrap ${
                            isCritical
                              ? "bg-red-500/20 border border-red-500/50 text-red-300"
                              : "bg-muted/60 border border-border text-muted-foreground"
                          }`}
                        >
                          {stage.name}
                        </div>
                        {i < PIPELINE_STAGES.length - 1 && (
                          <div className="text-muted-foreground text-xs px-0.5">→</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="text-xs text-muted-foreground mt-3">
                  The critical path limits the entire pipeline. Reducing the Execute stage delay
                  (e.g. via pipelining the ALU) directly increases max frequency.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── MEMORY HIERARCHY ── */}
        {activeTab === "memory" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Controls */}
              <div className="space-y-4">
                <div className="bg-card rounded-2xl border border-border p-5">
                  <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
                    <Database className="w-4 h-4 text-purple-400" />
                    Workload Parameters
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Model Size</span>
                        <span className="font-mono text-foreground">{modelSizeGB} GB</span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={200}
                        step={0.5}
                        value={modelSizeGB}
                        onChange={(e) => setModelSizeGB(parseFloat(e.target.value))}
                        className="w-full accent-purple-400"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>0.1 GB</span>
                        <span>200 GB</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Batch Size</span>
                        <span className="font-mono text-foreground">{batchSize}</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={128}
                        step={1}
                        value={batchSize}
                        onChange={(e) => setBatchSize(parseInt(e.target.value))}
                        className="w-full accent-blue-400"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>1</span>
                        <span>128</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Working Set</span>
                        <span className="font-mono text-foreground">{workingSetGB} GB</span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={Math.max(modelSizeGB, 1)}
                        step={0.1}
                        value={Math.min(workingSetGB, Math.max(modelSizeGB, 0.1))}
                        onChange={(e) => setWorkingSetGB(parseFloat(e.target.value))}
                        className="w-full accent-green-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Result cards */}
                <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Results</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Model fits in</span>
                      <span className="font-mono text-blue-300">{memLevel}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Access latency</span>
                      <span className="font-mono">{memEntry.cycles} cycles</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Bandwidth</span>
                      <span className="font-mono">{memEntry.bwLabel}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Arith. intensity</span>
                      <span className="font-mono">{arithmeticIntensity.toFixed(1)} FLOPs/B</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2">
                      <span className="text-muted-foreground">Bound by</span>
                      <span className={`font-mono font-bold ${isComputeBound ? "text-orange-400" : "text-cyan-400"}`}>
                        {isComputeBound ? "Compute" : "Memory BW"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-card rounded-xl border border-border p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Roofline</p>
                  <code className="text-xs block leading-relaxed">
                    AI = (2 × params × batch) / (params × 2 bytes)
                    {"\n"}   = batch
                  </code>
                  <p className="text-xs text-muted-foreground mt-1">
                    Performance limited by min(peak_compute, BW × AI)
                  </p>
                </div>
              </div>

              {/* Memory hierarchy table */}
              <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-5">
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
                  <Database className="w-4 h-4 text-cyan-400" />
                  Memory Hierarchy Reference
                </h2>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left pb-2 font-medium">Level</th>
                        <th className="text-right pb-2 font-medium">Latency</th>
                        <th className="text-right pb-2 font-medium">Bandwidth</th>
                        <th className="text-right pb-2 font-medium">Capacity</th>
                        <th className="text-center pb-2 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MEMORY_HIERARCHY.map((mem, i) => {
                        const isActive = mem.name === memLevel;
                        const cap = MEMORY_CAPACITY_GB[i];
                        return (
                          <tr
                            key={mem.name}
                            className={`border-b border-border/50 ${isActive ? "bg-blue-500/10" : ""}`}
                          >
                            <td className={`py-2.5 font-medium ${isActive ? "text-blue-300" : ""}`}>
                              {mem.name}
                              {isActive && (
                                <span className="ml-2 text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                                  active
                                </span>
                              )}
                            </td>
                            <td className="text-right font-mono text-muted-foreground py-2.5">
                              {mem.cycles} cyc
                            </td>
                            <td className="text-right font-mono py-2.5">{mem.bwLabel}</td>
                            <td className="text-right font-mono text-muted-foreground py-2.5 text-xs">
                              {cap.capGB < 0.001
                                ? `${(cap.capGB * 1e6).toFixed(0)} KB`
                                : cap.capGB < 1
                                ? `${(cap.capGB * 1000).toFixed(0)} MB`
                                : `${cap.capGB} GB`}
                            </td>
                            <td className="text-center py-2.5">
                              {isActive ? (
                                <CheckCircle className="w-4 h-4 text-blue-400 mx-auto" />
                              ) : (
                                <span className="text-muted-foreground/30 text-xs">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Roofline SVG */}
                <div className="mt-6">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    Roofline Model
                  </p>
                  <svg width="100%" viewBox="0 0 400 160" className="w-full">
                    {/* Grid */}
                    {[0, 40, 80, 120].map((y) => (
                      <line key={y} x1={40} y1={y + 10} x2={390} y2={y + 10} stroke="#334155" strokeWidth={0.5} strokeDasharray="3,3" />
                    ))}
                    {/* Axes */}
                    <line x1={40} y1={10} x2={40} y2={150} stroke="#64748b" strokeWidth={1} />
                    <line x1={40} y1={150} x2={390} y2={150} stroke="#64748b" strokeWidth={1} />

                    {/* Memory BW roof (diagonal) */}
                    <line
                      x1={40}
                      y1={150}
                      x2={200}
                      y2={10}
                      stroke="#60a5fa"
                      strokeWidth={1.5}
                      strokeDasharray="4,2"
                    />
                    {/* Compute roof (flat) */}
                    <line x1={200} y1={10} x2={390} y2={10} stroke="#f59e0b" strokeWidth={1.5} />

                    {/* Operating point */}
                    {(() => {
                      const aiNorm = Math.min(arithmeticIntensity / 128, 1);
                      const px = 40 + aiNorm * 350;
                      const perfNorm = isComputeBound ? 1 : aiNorm;
                      const py = 150 - perfNorm * 140;
                      return (
                        <g>
                          <circle cx={px} cy={py} r={5} fill={isComputeBound ? "#f97316" : "#22c55e"} />
                          <text x={px + 7} y={py + 4} fontSize={9} fill={isComputeBound ? "#f97316" : "#22c55e"} fontFamily="monospace">
                            {isComputeBound ? "Compute-bound" : "Memory-bound"}
                          </text>
                        </g>
                      );
                    })()}

                    {/* Labels */}
                    <text x={42} y={22} fontSize={8} fill="#60a5fa" fontFamily="monospace">Memory BW limit</text>
                    <text x={220} y={22} fontSize={8} fill="#f59e0b" fontFamily="monospace">Peak compute</text>
                    <text x={42} y={160} fontSize={8} fill="#64748b" fontFamily="monospace">Arithmetic Intensity (FLOPs/byte) →</text>
                    <text x={8} y={80} fontSize={8} fill="#64748b" fontFamily="monospace" transform="rotate(-90,8,80)">Performance →</text>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── V-F SCALING ── */}
        {activeTab === "vf" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Controls */}
              <div className="space-y-4">
                <div className="bg-card rounded-2xl border border-border p-5">
                  <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    Target Frequency
                  </h2>

                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>f_target</span>
                      <span className="font-mono text-foreground">{targetFreqGHz.toFixed(2)} GHz</span>
                    </div>
                    <input
                      type="range"
                      min={0.3}
                      max={F_MAX_GHZ}
                      step={0.01}
                      value={targetFreqGHz}
                      onChange={(e) => setTargetFreqGHz(parseFloat(e.target.value))}
                      className="w-full accent-yellow-400"
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>300 MHz</span>
                      <span>1.2 GHz</span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {(["TT", "SS", "FF"] as const).map((corner) => {
                      const v = vfCurve(targetFreqGHz, corner);
                      const p = normPower(targetFreqGHz, corner);
                      return (
                        <div key={corner} className="bg-muted/50 rounded-xl p-3">
                          <div className="flex justify-between items-center mb-1">
                            <span
                              className={`text-xs font-bold ${
                                corner === "TT" ? "text-blue-400" : corner === "SS" ? "text-orange-400" : "text-green-400"
                              }`}
                            >
                              {corner === "TT" ? "Nominal (TT)" : corner === "SS" ? "Slow (SS)" : "Fast (FF)"}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-xs font-mono">
                            <span className="text-muted-foreground">V_dd</span>
                            <span className="text-right">{v.toFixed(3)} V</span>
                            <span className="text-muted-foreground">P_norm</span>
                            <span className="text-right">{p.toFixed(3)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-card rounded-2xl border border-border p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    V-F Model (TT)
                  </p>
                  <code className="text-xs block leading-relaxed">
                    V = 0.6 + 0.4 × (f/f_max)^0.7
                  </code>
                  <p className="text-xs text-muted-foreground mt-2">
                    SS: +15% voltage overhead (slower transistors need more drive current)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    FF: −10% voltage (faster transistors switch at lower V_dd)
                  </p>
                </div>

                <div className="bg-card rounded-2xl border border-border p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    Dynamic Power
                  </p>
                  <code className="text-xs block leading-relaxed">
                    P = α · C · V² · f
                  </code>
                  <p className="text-xs text-muted-foreground mt-2">
                    P_norm = (V/V_ref)² × (f/f_ref) relative to TT at 1.2 GHz
                  </p>
                </div>
              </div>

              {/* V-F Chart */}
              <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-5">
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  Voltage-Frequency Curves (Process Corners)
                </h2>

                <div className="overflow-x-auto">
                  <svg
                    width={VF_W}
                    height={VF_H}
                    viewBox={`0 0 ${VF_W} ${VF_H}`}
                    className="w-full"
                    style={{ minWidth: 360 }}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const svgX = ((e.clientX - rect.left) / rect.width) * VF_W;
                      const innerX = svgX - VF_PAD.left;
                      if (innerX >= 0 && innerX <= vfInnerW) {
                        const fGHz = 0.3 + (innerX / vfInnerW) * (F_MAX_GHZ - 0.3);
                        setVfHover({ x: svgX, y: e.clientY - rect.top, fGHz });
                      } else {
                        setVfHover(null);
                      }
                    }}
                    onMouseLeave={() => setVfHover(null)}
                  >
                    {/* Grid lines */}
                    {[0.6, 0.8, 1.0, 1.2, 1.4].map((v) => {
                      const { y } = vfToSvg(0.3, v);
                      return (
                        <g key={v}>
                          <line
                            x1={VF_PAD.left}
                            y1={y}
                            x2={VF_W - VF_PAD.right}
                            y2={y}
                            stroke="#334155"
                            strokeWidth={0.5}
                            strokeDasharray="3,3"
                          />
                          <text x={VF_PAD.left - 4} y={y + 4} fontSize={8} fill="#64748b" textAnchor="end" fontFamily="monospace">
                            {v.toFixed(1)}V
                          </text>
                        </g>
                      );
                    })}
                    {[0.3, 0.6, 0.9, 1.2].map((f) => {
                      const { x } = vfToSvg(f, V_MIN);
                      return (
                        <g key={f}>
                          <line
                            x1={x}
                            y1={VF_PAD.top}
                            x2={x}
                            y2={VF_H - VF_PAD.bottom}
                            stroke="#334155"
                            strokeWidth={0.5}
                            strokeDasharray="3,3"
                          />
                          <text x={x} y={VF_H - VF_PAD.bottom + 14} fontSize={8} fill="#64748b" textAnchor="middle" fontFamily="monospace">
                            {f.toFixed(1)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Axes */}
                    <line
                      x1={VF_PAD.left}
                      y1={VF_PAD.top}
                      x2={VF_PAD.left}
                      y2={VF_H - VF_PAD.bottom}
                      stroke="#64748b"
                      strokeWidth={1}
                    />
                    <line
                      x1={VF_PAD.left}
                      y1={VF_H - VF_PAD.bottom}
                      x2={VF_W - VF_PAD.right}
                      y2={VF_H - VF_PAD.bottom}
                      stroke="#64748b"
                      strokeWidth={1}
                    />

                    {/* Curves */}
                    {(
                      [
                        { corner: "SS" as const, color: "#f97316", label: "SS (+15%)" },
                        { corner: "TT" as const, color: "#60a5fa", label: "TT (nominal)" },
                        { corner: "FF" as const, color: "#34d399", label: "FF (−10%)" },
                      ]
                    ).map(({ corner, color, label }) => (
                      <g key={corner}>
                        <polyline
                          points={buildVFPath(corner)}
                          fill="none"
                          stroke={color}
                          strokeWidth={2}
                        />
                        <text
                          x={VF_W - VF_PAD.right - 4}
                          y={vfToSvg(F_MAX_GHZ, vfCurve(F_MAX_GHZ, corner)).y}
                          fontSize={8}
                          fill={color}
                          textAnchor="end"
                          fontFamily="monospace"
                        >
                          {label}
                        </text>
                      </g>
                    ))}

                    {/* Target frequency vertical line */}
                    <line
                      x1={targetVfSvg.x}
                      y1={VF_PAD.top}
                      x2={targetVfSvg.x}
                      y2={VF_H - VF_PAD.bottom}
                      stroke="#fbbf24"
                      strokeWidth={1.5}
                      strokeDasharray="5,3"
                    />

                    {/* Target dots */}
                    {(["TT", "SS", "FF"] as const).map((corner) => {
                      const v = vfCurve(targetFreqGHz, corner);
                      const { x, y } = vfToSvg(targetFreqGHz, v);
                      const color = corner === "TT" ? "#60a5fa" : corner === "SS" ? "#f97316" : "#34d399";
                      return <circle key={corner} cx={x} cy={y} r={4} fill={color} />;
                    })}

                    {/* Hover tooltip */}
                    {vfHover && (() => {
                      const { x, fGHz } = vfHover;
                      const vTT = vfCurve(fGHz, "TT");
                      const pTT = normPower(fGHz, "TT");
                      const { y } = vfToSvg(fGHz, vTT);
                      return (
                        <g>
                          <line x1={x} y1={VF_PAD.top} x2={x} y2={VF_H - VF_PAD.bottom} stroke="#ffffff30" strokeWidth={1} />
                          <rect x={x + 6} y={Math.max(VF_PAD.top, y - 30)} width={96} height={50} rx={4} fill="#0f172a" stroke="#334155" strokeWidth={1} />
                          <text x={x + 10} y={Math.max(VF_PAD.top, y - 30) + 14} fontSize={8} fill="#94a3b8" fontFamily="monospace">
                            f = {fGHz.toFixed(2)} GHz
                          </text>
                          <text x={x + 10} y={Math.max(VF_PAD.top, y - 30) + 26} fontSize={8} fill="#60a5fa" fontFamily="monospace">
                            V_TT = {vTT.toFixed(3)} V
                          </text>
                          <text x={x + 10} y={Math.max(VF_PAD.top, y - 30) + 38} fontSize={8} fill="#fbbf24" fontFamily="monospace">
                            P_norm = {pTT.toFixed(3)}
                          </text>
                        </g>
                      );
                    })()}

                    {/* Axis labels */}
                    <text x={VF_W / 2} y={VF_H - 2} fontSize={9} fill="#64748b" textAnchor="middle" fontFamily="monospace">
                      Frequency (GHz)
                    </text>
                    <text
                      x={10}
                      y={VF_H / 2}
                      fontSize={9}
                      fill="#64748b"
                      textAnchor="middle"
                      fontFamily="monospace"
                      transform={`rotate(-90,10,${VF_H / 2})`}
                    >
                      Voltage (V)
                    </text>
                  </svg>
                </div>

                <p className="text-xs text-muted-foreground mt-3">
                  Hover over the chart to see V, f, and normalized power at cursor. The yellow dashed line marks your target frequency.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── QUANTIZATION CALCULATOR ── */}
        {activeTab === "quant" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Controls */}
              <div className="space-y-4">
                <div className="bg-card rounded-2xl border border-border p-5">
                  <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
                    <BarChart2 className="w-4 h-4 text-green-400" />
                    Model Parameters
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Parameter Count</span>
                        <span className="font-mono text-foreground">
                          {paramMillions >= 1000
                            ? `${(paramMillions / 1000).toFixed(1)}B`
                            : `${paramMillions}M`}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={100}
                        max={70000}
                        step={100}
                        value={paramMillions}
                        onChange={(e) => setParamMillions(parseInt(e.target.value))}
                        className="w-full accent-green-400"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>100M</span>
                        <span>70B</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Assumed Inference Time</span>
                        <span className="font-mono text-foreground">{inferenceMsStr} ms</span>
                      </div>
                      <input
                        type="number"
                        min={0.1}
                        max={1000}
                        step={0.1}
                        value={inferenceMsStr}
                        onChange={(e) => setInferenceMsStr(e.target.value)}
                        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-card rounded-2xl border border-border p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    Precision Reference
                  </p>
                  {PRECISION_OPTIONS.map((opt) => (
                    <div key={opt.label} className="flex justify-between text-xs">
                      <span className={`font-mono ${opt.highlight ? "text-green-400 font-bold" : "text-muted-foreground"}`}>
                        {opt.label}
                      </span>
                      <span className="font-mono text-muted-foreground">
                        {opt.bytesPerParam} B/param
                      </span>
                    </div>
                  ))}
                </div>

                <div className="bg-card rounded-2xl border border-border p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                    Formulas
                  </p>
                  <code className="text-xs block leading-relaxed space-y-1">
                    <span className="block">Storage = params × bytes</span>
                    <span className="block">BW_req = storage / t_infer</span>
                    <span className="block">Speedup vs FP32 (typical):</span>
                    <span className="block pl-2">FP16 → 1.8×</span>
                    <span className="block pl-2">INT8 → 3.5×</span>
                    <span className="block pl-2">INT4 → 6.0×</span>
                  </code>
                </div>
              </div>

              {/* Comparison table */}
              <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-5">
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
                  <Info className="w-4 h-4 text-green-400" />
                  Precision Comparison — {paramMillions >= 1000 ? `${(paramMillions / 1000).toFixed(1)}B` : `${paramMillions}M`} params
                </h2>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="text-left pb-3 font-medium">Precision</th>
                        <th className="text-right pb-3 font-medium">Storage</th>
                        <th className="text-right pb-3 font-medium">BW Req.</th>
                        <th className="text-right pb-3 font-medium">Accuracy Drop</th>
                        <th className="text-right pb-3 font-medium">Speedup</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quantRows.map((row) => (
                        <tr
                          key={row.label}
                          className={`border-b border-border/50 ${
                            row.highlight
                              ? "bg-green-500/10 border-green-500/20"
                              : ""
                          }`}
                        >
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <span className={`font-mono font-bold ${row.highlight ? "text-green-400" : ""}`}>
                                {row.label}
                              </span>
                              {row.highlight && (
                                <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-medium">
                                  sweet spot
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="text-right font-mono py-3">
                            {row.storageGB >= 1
                              ? `${row.storageGB.toFixed(1)} GB`
                              : `${(row.storageGB * 1000).toFixed(0)} MB`}
                          </td>
                          <td className="text-right font-mono py-3 text-muted-foreground">
                            {row.bwRequiredGBs >= 1000
                              ? `${(row.bwRequiredGBs / 1000).toFixed(1)} TB/s`
                              : `${row.bwRequiredGBs.toFixed(0)} GB/s`}
                          </td>
                          <td className={`text-right font-mono py-3 ${row.accuracyDrop === "0%" ? "text-green-400" : row.label === "INT4" ? "text-red-400" : "text-yellow-400"}`}>
                            {row.accuracyDrop}
                          </td>
                          <td className="text-right font-mono py-3 text-blue-300">
                            {row.speedup.toFixed(1)}×
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Storage bar chart */}
                <div className="mt-6">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">
                    Storage Comparison
                  </p>
                  <div className="space-y-2">
                    {quantRows.map((row) => {
                      const fp32Storage = quantRows[0].storageGB;
                      const pct = (row.storageGB / fp32Storage) * 100;
                      return (
                        <div key={row.label} className="flex items-center gap-3">
                          <span className="text-xs font-mono w-10 text-right text-muted-foreground">
                            {row.label}
                          </span>
                          <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                            <motion.div
                              className="h-full rounded-full flex items-center justify-end pr-2"
                              style={{
                                backgroundColor: row.highlight
                                  ? "#22c55e"
                                  : row.label === "FP32"
                                  ? "#ef4444"
                                  : "#3b82f6",
                                minWidth: "2%",
                              }}
                              animate={{ width: `${pct}%` }}
                              transition={{ type: "spring", stiffness: 150 }}
                            >
                              <span className="text-[10px] font-mono text-white font-bold">
                                {pct.toFixed(0)}%
                              </span>
                            </motion.div>
                          </div>
                          <span className="text-xs font-mono w-20 text-right">
                            {row.storageGB >= 1
                              ? `${row.storageGB.toFixed(1)} GB`
                              : `${(row.storageGB * 1000).toFixed(0)} MB`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-green-300">
                      <strong>INT8</strong> is the sweet spot: 4× storage reduction and 3.5× speedup
                      with only ~0.5% accuracy drop. Most inference hardware (TPUs, NPUs) has
                      dedicated INT8 execution units making this the industry standard for
                      production deployment.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
