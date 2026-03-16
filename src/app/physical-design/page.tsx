"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Grid3X3,
  Layers,
  Cpu,
  AlertTriangle,
  CheckCircle,
  Info,
  Activity,
  Zap,
} from "lucide-react";

// ─── Physics / math helpers ───────────────────────────────────────────────────

function seededRand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function formatNum(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function fmtSI(val: number, unit: string): string {
  if (val >= 1e9) return `${(val / 1e9).toFixed(2)} G${unit}`;
  if (val >= 1e6) return `${(val / 1e6).toFixed(2)} M${unit}`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(2)} k${unit}`;
  return `${val.toFixed(2)} ${unit}`;
}

// ─── DRC rule definitions ─────────────────────────────────────────────────────

interface DrcRule {
  rule: string;
  violations: number;
  maxOk: number;
}

const DRC_RULES_BASE: DrcRule[] = [
  { rule: "Min Spacing",   violations: 0, maxOk: 0 },
  { rule: "Min Width",     violations: 0, maxOk: 0 },
  { rule: "Min Enclosure", violations: 0, maxOk: 0 },
  { rule: "End-of-Line",   violations: 0, maxOk: 0 },
  { rule: "Corner Fill",   violations: 0, maxOk: 0 },
  { rule: "Density",       violations: 0, maxOk: 0 },
];

const SIZE_FACTORS = [10, 7, 5, 3, 2, 1];
const BASE_COUNTS  = [240, 180, 120, 80, 50, 30];
const FEATURE_SIZES = [3, 5, 7, 10, 14, 28];

function computeDrcViolations(ruleIdx: number, featureIdx: number, iteration: number): number {
  return Math.round(
    BASE_COUNTS[ruleIdx] * SIZE_FACTORS[featureIdx] / 5 * Math.exp(-iteration * 0.3)
  );
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function densityColor(d: number): string {
  if (d < 0.6)  return "rgba(34,197,94,0.40)";
  if (d < 0.8)  return "rgba(234,179,8,0.60)";
  if (d < 0.9)  return "rgba(249,115,22,0.80)";
  return "rgba(239,68,68,1.00)";
}

function congestionColor(c: number): string {
  if (c < 0.7)  return "rgba(34,197,94,0.55)";
  if (c < 0.9)  return "rgba(234,179,8,0.65)";
  if (c < 1.0)  return "rgba(249,115,22,0.85)";
  return "rgba(239,68,68,1.00)";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface FormulaCardProps {
  label: string;
  formula: string;
  explanation: string;
}
function FormulaCard({ label, formula, explanation }: FormulaCardProps) {
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{label}</p>
      <p className="font-mono text-sm">{formula}</p>
      <p className="text-xs text-muted-foreground mt-1">{explanation}</p>
    </div>
  );
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  display?: string;
}
function SliderRow({ label, value, min, max, step, unit = "", onChange, display }: SliderRowProps) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">{display ?? `${value}${unit}`}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-rose-500"
      />
    </div>
  );
}

// ─── Section 1: Floorplan Density Map ────────────────────────────────────────

function FloorplanSection() {
  const [gridSize, setGridSize] = useState<4 | 8 | 16>(8);
  const [utilizationTarget, setUtilizationTarget] = useState(75);

  const SVG_W = 320;
  const SVG_H = 320;
  const cellW = SVG_W / gridSize;
  const cellH = SVG_H / gridSize;

  const densities: number[][] = [];
  let totalDensity = 0;
  let maxDensity = 0;
  let hotspotCount = 0;

  for (let i = 0; i < gridSize; i++) {
    densities[i] = [];
    for (let j = 0; j < gridSize; j++) {
      const d = clamp(utilizationTarget / 100 + (seededRand(i * gridSize + j) - 0.5) * 0.4, 0, 1);
      densities[i][j] = d;
      totalDensity += d;
      if (d > maxDensity) maxDensity = d;
      if (d > 0.9) hotspotCount++;
    }
  }

  const avgDensity = totalDensity / (gridSize * gridSize);
  const hotspotPct = ((hotspotCount / (gridSize * gridSize)) * 100).toFixed(1);

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Grid3X3 className="text-rose-400" size={20} />
        <h2 className="text-lg font-semibold">Floorplan Density Map</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Grid Size</p>
            <div className="flex gap-2">
              {([4, 8, 16] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setGridSize(s)}
                  className={`px-3 py-1 rounded text-sm font-mono border transition-colors ${
                    gridSize === s
                      ? "bg-rose-500/20 border-rose-500/50 text-rose-400"
                      : "border-border text-muted-foreground hover:border-rose-500/30"
                  }`}
                >
                  {s}×{s}
                </button>
              ))}
            </div>
          </div>

          <SliderRow
            label="Utilization Target"
            value={utilizationTarget}
            min={50}
            max={90}
            step={5}
            unit="%"
            onChange={setUtilizationTarget}
          />

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="bg-muted/20 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Avg Density</p>
              <p className="font-mono text-sm font-semibold">{(avgDensity * 100).toFixed(1)}%</p>
            </div>
            <div className="bg-muted/20 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Max Density</p>
              <p className="font-mono text-sm font-semibold">{(maxDensity * 100).toFixed(1)}%</p>
            </div>
            <div className="bg-muted/20 rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Hotspots</p>
              <p className="font-mono text-sm font-semibold text-red-400">{hotspotPct}%</p>
            </div>
          </div>

          <FormulaCard
            label="Utilization"
            formula="Utilization = placed_area / total_area × 100%"
            explanation="Ratio of cell area to total floorplan area; high values risk routing congestion"
          />
        </div>

        {/* SVG Grid */}
        <div>
          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full rounded border border-border">
            <rect width={SVG_W} height={SVG_H} fill="#0f0f0f" />
            {densities.map((row, i) =>
              row.map((d, j) => (
                <rect
                  key={`${i}-${j}`}
                  x={j * cellW}
                  y={i * cellH}
                  width={cellW - 1}
                  height={cellH - 1}
                  fill={densityColor(d)}
                  rx={1}
                />
              ))
            )}
          </svg>
          {/* Legend */}
          <div className="flex gap-3 mt-2 flex-wrap">
            {[
              { color: "rgba(34,197,94,0.40)",   label: "<60%" },
              { color: "rgba(234,179,8,0.60)",   label: "60–80%" },
              { color: "rgba(249,115,22,0.80)",  label: "80–90%" },
              { color: "rgba(239,68,68,1.00)",   label: ">90%" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: color }} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section 2: Wirelength Estimation ────────────────────────────────────────

function WirelengthSection() {
  const [cellCount, setCellCount]       = useState(5000);
  const [avgNetDegree, setAvgNetDegree] = useState(3);
  const [dieWidthUm, setDieWidthUm]     = useState(2000);
  const [routingLayers, setRoutingLayers] = useState(8);

  const netCount     = cellCount * avgNetDegree / 2;
  const hpwlAvg      = 0.5 * dieWidthUm * Math.pow(cellCount, -0.3);
  const totalWlUm    = netCount * hpwlAvg;
  const routingCap   = (dieWidthUm * dieWidthUm) / 0.5;
  const routingDemand = netCount * hpwlAvg / routingLayers;
  const congestionRatio = routingDemand / (routingCap * routingLayers);

  // Bucket nets: short <10µm, medium 10–100µm, long >100µm
  const shortThresh  = 10;
  const medThresh    = 100;
  // Approximate distribution using exponential model
  const fracShort  = clamp(1 - Math.exp(-shortThresh / hpwlAvg), 0, 1);
  const fracLong   = clamp(Math.exp(-medThresh / hpwlAvg), 0, 1);
  const fracMed    = clamp(1 - fracShort - fracLong, 0, 1);

  const shortCount  = Math.round(netCount * fracShort);
  const medCount    = Math.round(netCount * fracMed);
  const longCount   = Math.round(netCount * fracLong);
  const maxCount    = Math.max(shortCount, medCount, longCount, 1);

  const SVG_W = 320;
  const SVG_H = 200;
  const BAR_H = 40;
  const BAR_GAP = 20;
  const LEFT_PAD = 10;
  const RIGHT_PAD = 10;
  const TOP_PAD = 10;
  const CHART_W = SVG_W - LEFT_PAD - RIGHT_PAD;
  const buckets = [
    { label: "Short <10µm", count: shortCount, color: "#22c55e" },
    { label: "Med 10–100µm", count: medCount,  color: "#eab308" },
    { label: "Long >100µm", count: longCount,  color: "#ef4444" },
  ];

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="text-rose-400" size={20} />
        <h2 className="text-lg font-semibold">Wirelength Estimation</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-3">
          <SliderRow
            label="Cell Count"
            value={cellCount}
            min={100}
            max={100000}
            step={100}
            onChange={setCellCount}
            display={fmtSI(cellCount, "cells")}
          />
          <SliderRow
            label="Avg Net Degree"
            value={avgNetDegree}
            min={2}
            max={8}
            step={0.5}
            onChange={setAvgNetDegree}
          />
          <SliderRow
            label="Die Width"
            value={dieWidthUm}
            min={500}
            max={5000}
            step={100}
            unit="µm"
            onChange={setDieWidthUm}
          />
          <SliderRow
            label="Routing Layers"
            value={routingLayers}
            min={4}
            max={16}
            step={2}
            onChange={setRoutingLayers}
          />

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="bg-muted/20 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">Net Count</p>
              <p className="font-mono text-xs font-semibold">{fmtSI(netCount, "nets")}</p>
            </div>
            <div className="bg-muted/20 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">Total WL</p>
              <p className="font-mono text-xs font-semibold">{fmtSI(totalWlUm / 1e6, "m")}</p>
            </div>
            <div className="bg-muted/20 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">Avg HPWL</p>
              <p className="font-mono text-xs font-semibold">{hpwlAvg.toFixed(1)} µm</p>
            </div>
            <div className={`rounded-lg p-2 text-center border ${congestionRatio > 1 ? "border-red-500/40 bg-red-500/10" : "border-green-500/40 bg-green-500/10"}`}>
              <p className="text-xs text-muted-foreground">Congestion</p>
              <p className="font-mono text-xs font-semibold">{(congestionRatio * 100).toFixed(1)}%</p>
            </div>
          </div>

          <FormulaCard
            label="HPWL"
            formula="HPWL = Σ(x_max−x_min + y_max−y_min)"
            explanation="Half-perimeter wirelength per net — fast, accurate placement metric"
          />
        </div>

        {/* Bar Chart */}
        <div>
          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full">
            <rect width={SVG_W} height={SVG_H} fill="transparent" />
            {buckets.map((b, idx) => {
              const y = TOP_PAD + idx * (BAR_H + BAR_GAP);
              const barW = (b.count / maxCount) * CHART_W;
              return (
                <g key={b.label}>
                  {/* background track */}
                  <rect x={LEFT_PAD} y={y} width={CHART_W} height={BAR_H} fill="#1f1f1f" rx={4} />
                  {/* animated fill */}
                  <motion.rect
                    x={LEFT_PAD}
                    y={y}
                    width={barW}
                    height={BAR_H}
                    fill={b.color}
                    rx={4}
                    animate={{ width: barW }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    fillOpacity={0.75}
                  />
                  <text x={LEFT_PAD + 6} y={y + BAR_H / 2 + 5} fill="#e2e8f0" fontSize={11} fontFamily="monospace">
                    {b.label}
                  </text>
                  <text x={SVG_W - RIGHT_PAD - 4} y={y + BAR_H / 2 + 5} fill="#94a3b8" fontSize={10} fontFamily="monospace" textAnchor="end">
                    {fmtSI(b.count, "")}
                  </text>
                </g>
              );
            })}
            {/* X-axis label */}
            <text x={SVG_W / 2} y={SVG_H - 4} fill="#64748b" fontSize={9} textAnchor="middle" fontFamily="monospace">
              Net count by length bucket
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─── Section 3: Routing Congestion Heatmap ───────────────────────────────────

function CongestionSection() {
  const [congestionSeed, setCongestionSeed] = useState(3);
  const [routingPitch, setRoutingPitch]     = useState(0.4);
  const [metalLayers, setMetalLayers]       = useState(10);

  const GRID = 8;
  const SVG_W = 320;
  const SVG_H = 320;
  const cellW = SVG_W / GRID;
  const cellH = SVG_H / GRID;

  const grid: number[][] = [];
  let maxCong = 0;
  let overflowCount = 0;

  for (let i = 0; i < GRID; i++) {
    grid[i] = [];
    for (let j = 0; j < GRID; j++) {
      const c = seededRand(congestionSeed * 100 + i * 8 + j) * 1.2;
      grid[i][j] = c;
      if (c > maxCong) maxCong = c;
      if (c > 1.0) overflowCount++;
    }
  }

  const routingCapacity = (metalLayers * 1000) / routingPitch;
  const hasOverflow = overflowCount > 0;
  const isClean = maxCong < 0.9;

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Layers className="text-rose-400" size={20} />
        <h2 className="text-lg font-semibold">Routing Congestion Heatmap</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-3">
          <SliderRow
            label="Congestion Pattern Seed"
            value={congestionSeed}
            min={1}
            max={10}
            step={1}
            onChange={setCongestionSeed}
          />
          <SliderRow
            label="Routing Pitch"
            value={routingPitch}
            min={0.1}
            max={1.0}
            step={0.1}
            unit="µm"
            onChange={setRoutingPitch}
          />
          <SliderRow
            label="Metal Layers"
            value={metalLayers}
            min={4}
            max={16}
            step={2}
            onChange={setMetalLayers}
          />

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="bg-muted/20 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">Routing Cap</p>
              <p className="font-mono text-xs font-semibold">{fmtSI(routingCapacity, "trk/mm")}</p>
            </div>
            <div className="bg-muted/20 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">Overflow Tiles</p>
              <p className={`font-mono text-xs font-semibold ${overflowCount > 0 ? "text-red-400" : "text-green-400"}`}>
                {overflowCount}
              </p>
            </div>
          </div>

          {hasOverflow && (
            <div className="flex items-center gap-2 border border-red-500/40 bg-red-500/10 rounded-lg p-2 text-xs text-red-300">
              <AlertTriangle size={14} />
              {overflowCount} overflow tile{overflowCount > 1 ? "s" : ""} detected — routing may fail
            </div>
          )}
          {isClean && (
            <div className="flex items-center gap-2 border border-green-500/40 bg-green-500/10 rounded-lg p-2 text-xs text-green-300">
              <CheckCircle size={14} />
              No congestion hotspots — max congestion {(maxCong * 100).toFixed(0)}%
            </div>
          )}

          <FormulaCard
            label="Congestion"
            formula="Congestion = routing_demand / routing_capacity"
            explanation=">1.0 means overflow; unroutable without detour or layer addition"
          />
        </div>

        {/* SVG Heatmap */}
        <div>
          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full rounded border border-border">
            <rect width={SVG_W} height={SVG_H} fill="#0f0f0f" />
            {grid.map((row, i) =>
              row.map((c, j) => {
                const x = j * cellW;
                const y = i * cellH;
                const isOverflow = c > 1.0;
                return (
                  <g key={`${i}-${j}`}>
                    <rect
                      x={x}
                      y={y}
                      width={cellW - 1}
                      height={cellH - 1}
                      fill={congestionColor(c)}
                      rx={2}
                    />
                    {isOverflow && (
                      <>
                        <line
                          x1={x + 4} y1={y + 4}
                          x2={x + cellW - 5} y2={y + cellH - 5}
                          stroke="white" strokeWidth={1.5} opacity={0.8}
                        />
                        <line
                          x1={x + cellW - 5} y1={y + 4}
                          x2={x + 4} y2={y + cellH - 5}
                          stroke="white" strokeWidth={1.5} opacity={0.8}
                        />
                      </>
                    )}
                  </g>
                );
              })
            )}
          </svg>
          <div className="flex gap-3 mt-2 flex-wrap">
            {[
              { color: "rgba(34,197,94,0.55)",  label: "<70%" },
              { color: "rgba(234,179,8,0.65)",  label: "70–90%" },
              { color: "rgba(249,115,22,0.85)", label: "90–100%" },
              { color: "rgba(239,68,68,1.00)",  label: ">100% ✕" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: color }} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Section 4: Via Optimization ─────────────────────────────────────────────

function ViaSection() {
  const [netCount2, setNetCount2]         = useState(10000);
  const [avgViaPerNet, setAvgViaPerNet]   = useState(4);
  const [viaResistance, setViaResistance] = useState(2);
  const [viaCap, setViaCap]               = useState(1.5);

  const totalVias       = netCount2 * avgViaPerNet;
  const viaRcDelay      = avgViaPerNet * viaResistance * viaCap * 1e-15 * 1e9; // ps (converted correctly: R*C gives seconds, ×1e12 for ps)
  const viaRcDelayPs    = avgViaPerNet * viaResistance * (viaCap * 1e-15) * 1e12; // ps
  const delaySavingsPct = 20; // reducing vias by 20%
  const delayIfReduced  = viaRcDelayPs * 0.8;
  const areaOverhead    = 0.5; // % for via doubling

  // Metal layer cross-section constants
  const SVG_W = 320;
  const SVG_H = 180;
  const LAYERS = 6;
  const layerH = 20;
  const layerGap = 8;
  const startY = 14;
  const metalColors = ["#60a5fa","#818cf8","#a78bfa","#c084fc","#e879f9","#fb7185"];

  // via x positions for a "critical path" through M1->M2->M4->M6
  const critPath = [1, 2, 4, 6]; // 1-indexed layers
  const cpX = SVG_W / 2;

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Zap className="text-rose-400" size={20} />
        <h2 className="text-lg font-semibold">Via Optimization</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-3">
          <SliderRow
            label="Net Count"
            value={netCount2}
            min={100}
            max={50000}
            step={500}
            onChange={setNetCount2}
            display={fmtSI(netCount2, "nets")}
          />
          <SliderRow
            label="Avg Vias per Net"
            value={avgViaPerNet}
            min={1}
            max={10}
            step={0.5}
            onChange={setAvgViaPerNet}
          />
          <SliderRow
            label="Via Resistance"
            value={viaResistance}
            min={0.5}
            max={10}
            step={0.5}
            unit=" Ω"
            onChange={setViaResistance}
          />
          <SliderRow
            label="Via Capacitance"
            value={viaCap}
            min={0.5}
            max={5}
            step={0.5}
            unit=" fF"
            onChange={setViaCap}
          />

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="bg-muted/20 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">Total Vias</p>
              <p className="font-mono text-xs font-semibold">{fmtSI(totalVias, "")}</p>
            </div>
            <div className="bg-muted/20 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">Via RC Delay</p>
              <p className="font-mono text-xs font-semibold">{viaRcDelayPs.toFixed(2)} ps</p>
            </div>
            <div className="bg-muted/20 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">Via-Double OH</p>
              <p className="font-mono text-xs font-semibold">{areaOverhead}% area</p>
            </div>
            <div className="bg-muted/20 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">-20% Via Saving</p>
              <p className="font-mono text-xs font-semibold text-green-400">{(viaRcDelayPs - delayIfReduced).toFixed(2)} ps</p>
            </div>
          </div>

          <FormulaCard
            label="Via RC Delay"
            formula="t_via = N_via · R_via · C_load"
            explanation="Stacked via delay is linear in via count, resistance, and load capacitance"
          />
        </div>

        {/* SVG Metal Stack Cross-Section */}
        <div>
          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full rounded border border-border bg-[#0f0f0f]">
            {Array.from({ length: LAYERS }, (_, idx) => {
              const layerNum = LAYERS - idx; // M6 at top, M1 at bottom
              const y = startY + idx * (layerH + layerGap);
              const isCrit = critPath.includes(layerNum);
              return (
                <g key={layerNum}>
                  {/* layer bar */}
                  <rect x={20} y={y} width={SVG_W - 40} height={layerH} fill={metalColors[idx]} fillOpacity={0.25} rx={3} />
                  {isCrit && (
                    <rect x={20} y={y} width={SVG_W - 40} height={layerH} fill={metalColors[idx]} fillOpacity={0.15} rx={3}
                      stroke={metalColors[idx]} strokeWidth={1} />
                  )}
                  <text x={28} y={y + 13} fill={metalColors[idx]} fontSize={10} fontFamily="monospace">
                    M{layerNum}
                  </text>
                  {/* vias between layers */}
                  {idx < LAYERS - 1 && (
                    <>
                      {/* scattered vias */}
                      {[60, 110, 160, 210, 260].map((vx) => (
                        <rect key={vx} x={vx} y={y + layerH} width={5} height={layerGap} fill="#94a3b8" fillOpacity={0.5} rx={1} />
                      ))}
                      {/* critical path via */}
                      {critPath.includes(layerNum) && critPath.includes(layerNum - 1) && (
                        <motion.rect
                          x={cpX - 3}
                          y={y + layerH}
                          width={6}
                          height={layerGap}
                          fill="#fb7185"
                          rx={1}
                          animate={{ opacity: [0.6, 1, 0.6] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        />
                      )}
                    </>
                  )}
                </g>
              );
            })}
            {/* critical path line */}
            <motion.line
              x1={cpX} y1={startY}
              x2={cpX} y2={startY + LAYERS * (layerH + layerGap) - layerGap}
              stroke="#fb7185" strokeWidth={1.5} strokeDasharray="3 3"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
            <text x={cpX + 8} y={startY + 8} fill="#fb7185" fontSize={9} fontFamily="monospace">Critical Path</text>
          </svg>
          <p className="text-xs text-muted-foreground mt-1">Metal layer cross-section — red dashed = critical path</p>
        </div>
      </div>
    </div>
  );
}

// ─── Section 5: DRC Hotspot Density ──────────────────────────────────────────

function DrcSection() {
  const [drcIteration, setDrcIteration] = useState(1);
  const [featureSizeIdx, setFeatureSizeIdx] = useState(2); // default 7nm

  const featureSize = FEATURE_SIZES[featureSizeIdx];

  const rules: DrcRule[] = DRC_RULES_BASE.map((r, ruleIdx) => ({
    ...r,
    violations: computeDrcViolations(ruleIdx, featureSizeIdx, drcIteration),
  }));

  const totalViolations = rules.reduce((sum, r) => sum + r.violations, 0);
  const maxViolations   = Math.max(...rules.map((r) => r.violations), 1);
  const tapeoutReadiness = 100 * (1 - totalViolations / (totalViolations + 100));
  const violationsPerMm2 = totalViolations / ((2 * 2)); // assume 2mm×2mm die

  const SVG_W = 320;
  const SVG_H = 200;
  const BAR_H = 22;
  const LEFT_PAD = 90;
  const RIGHT_PAD = 8;
  const TOP_PAD = 10;
  const CHART_W = SVG_W - LEFT_PAD - RIGHT_PAD;

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Cpu className="text-rose-400" size={20} />
        <h2 className="text-lg font-semibold">DRC Hotspot Density</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-3">
          <SliderRow
            label="DRC Fix Iteration"
            value={drcIteration}
            min={1}
            max={10}
            step={1}
            onChange={setDrcIteration}
          />

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Feature Size</span>
              <span className="font-mono text-foreground">{featureSize} nm</span>
            </div>
            <input
              type="range"
              min={0}
              max={5}
              step={1}
              value={featureSizeIdx}
              onChange={(e) => setFeatureSizeIdx(Number(e.target.value))}
              className="w-full accent-rose-500"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              {FEATURE_SIZES.map((s) => <span key={s}>{s}</span>)}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="bg-muted/20 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">Total Violations</p>
              <p className={`font-mono text-xs font-semibold ${totalViolations > 0 ? "text-red-400" : "text-green-400"}`}>
                {totalViolations}
              </p>
            </div>
            <div className="bg-muted/20 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">Viol/mm²</p>
              <p className="font-mono text-xs font-semibold">{violationsPerMm2.toFixed(0)}</p>
            </div>
            <div className="bg-muted/20 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">Tapeout Ready</p>
              <p className={`font-mono text-xs font-semibold ${tapeoutReadiness > 90 ? "text-green-400" : "text-red-400"}`}>
                {tapeoutReadiness.toFixed(1)}%
              </p>
            </div>
          </div>

          {totalViolations > 0 ? (
            <div className="flex items-center gap-2 border border-red-500/40 bg-red-500/10 rounded-lg p-2 text-xs text-red-300">
              <AlertTriangle size={14} />
              {totalViolations} DRC violations remain — tapeout blocked
            </div>
          ) : (
            <div className="flex items-center gap-2 border border-green-500/40 bg-green-500/10 rounded-lg p-2 text-xs text-green-300">
              <CheckCircle size={14} />
              DRC clean — necessary (not sufficient) for tapeout
            </div>
          )}

          <FormulaCard
            label="DRC Clean"
            formula="DRC clean = necessary (not sufficient) for tapeout"
            explanation="Passing DRC means no rule violations; LVS, timing, and power sign-off also required"
          />
        </div>

        {/* Bar Chart */}
        <div>
          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full">
            <rect width={SVG_W} height={SVG_H} fill="transparent" />
            {rules.map((r, idx) => {
              const y = TOP_PAD + idx * (BAR_H + 6);
              const barW = maxViolations > 0 ? (r.violations / maxViolations) * CHART_W : 0;
              const barColor = r.violations === 0 ? "#22c55e" : "#ef4444";
              return (
                <g key={r.rule}>
                  <text x={LEFT_PAD - 4} y={y + BAR_H / 2 + 4} fill="#94a3b8" fontSize={9} fontFamily="monospace" textAnchor="end">
                    {r.rule}
                  </text>
                  <rect x={LEFT_PAD} y={y} width={CHART_W} height={BAR_H} fill="#1f1f1f" rx={3} />
                  <motion.rect
                    x={LEFT_PAD}
                    y={y}
                    width={barW}
                    height={BAR_H}
                    fill={barColor}
                    rx={3}
                    fillOpacity={0.7}
                    animate={{ width: barW }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  />
                  {r.violations > 0 && (
                    <text x={LEFT_PAD + barW + 3} y={y + BAR_H / 2 + 4} fill="#ef4444" fontSize={9} fontFamily="monospace">
                      {r.violations}
                    </text>
                  )}
                  {r.violations === 0 && (
                    <text x={LEFT_PAD + 4} y={y + BAR_H / 2 + 4} fill="#22c55e" fontSize={9} fontFamily="monospace">
                      clean
                    </text>
                  )}
                </g>
              );
            })}
            <text x={SVG_W / 2} y={SVG_H - 2} fill="#64748b" fontSize={9} textAnchor="middle" fontFamily="monospace">
              Violation count per DRC rule
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PhysicalDesignPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <div className="bg-rose-500/20 rounded-xl border border-rose-500/30 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-rose-500/20 rounded-lg">
              <Grid3X3 className="text-rose-400" size={24} />
            </div>
            <h1 className="text-2xl font-bold text-rose-400">Physical Design</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Floorplanning, placement density, routing congestion, wire-length estimation, and DRC hotspot analysis
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            {["Floorplan", "Wirelength", "Congestion", "Via Opt", "DRC"].map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Info Banner */}
        <div className="flex items-start gap-2 bg-card rounded-xl border border-border p-4 text-sm text-muted-foreground">
          <Info size={16} className="text-rose-400 mt-0.5 shrink-0" />
          <span>
            Interactive physical design tool. All parameters update results in real-time. Values are
            approximations using analytical models (Rent&apos;s Rule, HPWL, seeded density grids).
          </span>
        </div>

        {/* Sections */}
        <FloorplanSection />
        <WirelengthSection />
        <CongestionSection />
        <ViaSection />
        <DrcSection />

        {/* Bottom Formula Reference */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="text-rose-400" size={18} />
            <h2 className="text-base font-semibold">Formula Reference</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <FormulaCard
              label="Utilization"
              formula="Utilization = placed_area / total_area"
              explanation="Fraction of floorplan area occupied by standard cells"
            />
            <FormulaCard
              label="HPWL"
              formula="HPWL = Σ(Δx + Δy)"
              explanation="Half-perimeter wirelength per net — fast wirelength estimate"
            />
            <FormulaCard
              label="Congestion"
              formula="Congestion = demand / capacity"
              explanation="Per routing tile — overflow (>1) causes unroutable segments"
            />
            <FormulaCard
              label="Via RC Delay"
              formula="t_via = N · R_via · C_load"
              explanation="Delay contribution from vias along a critical net"
            />
          </div>
        </div>

      </div>
    </main>
  );
}
