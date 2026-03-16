"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Layers,
  Cpu,
  Zap,
  AlertTriangle,
  CheckCircle,
  Info,
  Activity,
  Grid3X3,
} from "lucide-react";

// ── Physics constants & typed helpers ─────────────────────────────────────────

const COPPER_RESISTIVITY = 1.7e-8; // Ω·m
const EPSILON_0 = 8.85e-12; // F/m
const EPSILON_R_SIO2 = 3.9;
const T_AMBIENT = 25; // °C

type Topology = "star" | "mesh" | "ring";

interface Chiplet {
  name: string;
  color: string;
  x: number;
  y: number;
}

const CHIPLETS: Chiplet[] = [
  { name: "CPU", color: "#ef4444", x: 160, y: 40 },
  { name: "GPU", color: "#3b82f6", x: 280, y: 120 },
  { name: "Mem", color: "#22c55e", x: 240, y: 220 },
  { name: "I/O", color: "#eab308", x: 80, y: 220 },
  { name: "AI", color: "#a855f7", x: 40, y: 120 },
];

const STAR_CENTER = { x: 160, y: 140 };

// Coordinate helpers for SVG charts
function makeSvgHelpers(
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  svgW: number,
  svgH: number,
  pad: { top: number; right: number; bottom: number; left: number }
) {
  const plotW = svgW - pad.left - pad.right;
  const plotH = svgH - pad.top - pad.bottom;
  const toSvgX = (v: number) =>
    pad.left + ((v - xMin) / (xMax - xMin)) * plotW;
  const toSvgY = (v: number) =>
    pad.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  return { toSvgX, toSvgY, plotW, plotH };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function tempColor(t: number): string {
  if (t < 50) return "#3b82f6";
  if (t < 80) return "#f97316";
  return "#ef4444";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PackagingPage() {
  // Section 1: Flip-Chip Bump Array
  const [pitchUm, setPitchUm] = useState(100);
  const [dieWidthMm, setDieWidthMm] = useState(10);

  // Section 2: TSV Analyzer
  const [tsvDiamUm, setTsvDiamUm] = useState(5);
  const [tsvAspectRatio, setTsvAspectRatio] = useState(10);
  const [tsvCount, setTsvCount] = useState(1000);

  // Section 3: Die-to-Die Bandwidth
  const [bumpPitch, setBumpPitch] = useState(40);
  const [interfaceWidthMm, setInterfaceWidthMm] = useState(5);
  const [freqGHz, setFreqGHz] = useState(8);
  const [encodingEff, setEncodingEff] = useState(0.8);

  // Section 4: Thermal Resistance
  const [thetaJC, setThetaJC] = useState(0.5);
  const [thetaCA, setThetaCA] = useState(15);
  const [thetaTIM, setThetaTIM] = useState(0.3);
  const [powerW, setPowerW] = useState(50);

  // Section 5: Chiplet Topology
  const [topology, setTopology] = useState<Topology>("star");
  const [linkBwGbps, setLinkBwGbps] = useState(100);

  // ── Section 1 Derived ──────────────────────────────────────────────────────
  const bumpsPerRow =
    Math.floor((dieWidthMm * 1000 - pitchUm) / pitchUm) + 1;
  const totalBumps = bumpsPerRow * bumpsPerRow;
  const powerBumps = Math.floor(totalBumps * 0.4);
  const signalBumps = totalBumps - powerBumps;
  const maxCurrentA = powerBumps * 0.1;
  const rBump = 0.001 + (pitchUm / 100) * 0.002;

  // ── Section 2 Derived ──────────────────────────────────────────────────────
  const tsvHeightUm = tsvDiamUm * tsvAspectRatio;
  const tsvH = tsvHeightUm * 1e-6;
  const tsvR = tsvDiamUm / 2;
  const rTsv =
    (COPPER_RESISTIVITY * tsvH) / (Math.PI * (tsvR * 1e-6) ** 2);
  const cTsvF =
    (2 * Math.PI * EPSILON_R_SIO2 * EPSILON_0 * tsvH) /
    Math.log(tsvR + 1);
  const cTsvFF = cTsvF * 1e15;
  const kozPerTsv = Math.PI * (tsvDiamUm * 5) ** 2;
  const totalKozMm2 = (tsvCount * kozPerTsv) / 1e6;

  // ── Section 3 Derived ──────────────────────────────────────────────────────
  const bumpsEdge = Math.floor((interfaceWidthMm * 1000) / bumpPitch);
  const bwRawGbps = bumpsEdge * freqGHz * 2;
  const bwEffGbps = bwRawGbps * encodingEff;

  // ── Section 4 Derived ──────────────────────────────────────────────────────
  const tCase = T_AMBIENT + powerW * thetaCA;
  const tJunction = tCase + powerW * (thetaJC + thetaTIM);
  const thetaJA = thetaJC + thetaTIM + thetaCA;

  // ── Section 5 Derived ──────────────────────────────────────────────────────
  const linkCount = topology === "star" ? 5 : 5;
  const bisectionBw =
    topology === "star"
      ? 2 * linkBwGbps
      : 3 * linkBwGbps;
  const totalBwGbps = linkCount * linkBwGbps;

  // ── SVG: Bump Grid ─────────────────────────────────────────────────────────
  const gridCols = Math.min(bumpsPerRow, 20);
  const gridRows = gridCols;
  const bumpSpacing = 240 / (gridCols + 1);
  const bumpRadius = Math.min(bumpSpacing * 0.35, 8);

  function renderBumpGrid() {
    const bumps: JSX.Element[] = [];
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const idx = r * gridCols + c;
        const isPower = idx < Math.floor(gridRows * gridCols * 0.4);
        const cx = 20 + (c + 0.5) * bumpSpacing;
        const cy = 20 + (r + 0.5) * bumpSpacing;
        bumps.push(
          <circle
            key={`bump-${r}-${c}`}
            cx={cx}
            cy={cy}
            r={bumpRadius}
            fill={isPower ? "#ef4444" : "#22c55e"}
            opacity={0.85}
          />
        );
      }
    }
    return bumps;
  }

  // ── SVG: TSV Cross-Section ─────────────────────────────────────────────────
  const tsvW = 8;
  const tsvPositions = [50, 90, 130, 170, 210, 250];

  // ── SVG: Bandwidth Bar Chart ───────────────────────────────────────────────
  const bwSvgW = 320;
  const bwSvgH = 200;
  const bwPad = { top: 20, right: 20, bottom: 40, left: 60 };
  const bwMax = 2000;
  const { toSvgX: bwToX, toSvgY: bwToY } = makeSvgHelpers(
    0, 1, 0, bwMax, bwSvgW, bwSvgH, bwPad
  );
  const bwBarX = bwPad.left;
  const bwBarWidth = bwSvgW - bwPad.left - bwPad.right;
  const bwBarMaxH = bwSvgH - bwPad.top - bwPad.bottom;

  function bwBarY(gbps: number) {
    return bwPad.top + bwBarMaxH - (clamp(gbps, 0, bwMax) / bwMax) * bwBarMaxH;
  }
  function bwBarH(gbps: number) {
    return (clamp(gbps, 0, bwMax) / bwMax) * bwBarMaxH;
  }

  const references = [
    { label: "UCIe G1", gbps: 16, color: "#f97316" },
    { label: "UCIe G2", gbps: 32, color: "#eab308" },
    { label: "EMIB", gbps: 100, color: "#22c55e" },
    { label: "HBM3", gbps: 1229, color: "#3b82f6" },
  ];

  // ── SVG: Thermal Ladder ────────────────────────────────────────────────────
  const thermalNodes = [
    { label: "Junction", theta: thetaJC, temp: tJunction },
    { label: "TIM", theta: thetaTIM, temp: tJunction - powerW * thetaJC },
    { label: "Case", theta: thetaCA, temp: tCase },
    { label: "Ambient", theta: 0, temp: T_AMBIENT },
  ];

  // ── SVG: Chiplet Topology ──────────────────────────────────────────────────
  function getLinks(): [number, number][] {
    if (topology === "star") {
      return [[0, -1], [1, -1], [2, -1], [3, -1], [4, -1]];
    }
    return [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 0],
    ];
  }

  const links = getLinks();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <div className="bg-orange-500/20 rounded-xl border border-orange-500/30 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Layers className="w-6 h-6 text-orange-400" />
            </div>
            <h1 className="text-2xl font-bold text-orange-400">
              Packaging & Chiplet Integration
            </h1>
          </div>
          <p className="text-muted-foreground">
            Flip-chip bumps, TSV interconnects, die-to-die bandwidth, thermal
            resistance, and chiplet topology
          </p>
        </div>

        {/* ── Section 1: Flip-Chip Bump Array ── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Grid3X3 className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-semibold">Flip-Chip Bump Array</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Controls */}
            <div className="space-y-5">
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Bump Pitch</span>
                  <span className="font-mono font-semibold">{pitchUm} µm</span>
                </label>
                <input
                  type="range"
                  min={50}
                  max={200}
                  step={10}
                  value={pitchUm}
                  onChange={(e) => setPitchUm(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Die Width</span>
                  <span className="font-mono font-semibold">
                    {dieWidthMm} mm
                  </span>
                </label>
                <input
                  type="range"
                  min={5}
                  max={20}
                  step={1}
                  value={dieWidthMm}
                  onChange={(e) => setDieWidthMm(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Bumps/Row</p>
                  <p className="font-mono font-bold text-lg">{bumpsPerRow}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Total Bumps</p>
                  <p className="font-mono font-bold text-lg">
                    {totalBumps.toLocaleString()}
                  </p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Power Bumps</p>
                  <p className="font-mono font-bold text-red-400">
                    {powerBumps.toLocaleString()}
                  </p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Signal Bumps</p>
                  <p className="font-mono font-bold text-green-400">
                    {signalBumps.toLocaleString()}
                  </p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Max Current</p>
                  <p className="font-mono font-bold">
                    {maxCurrentA.toFixed(1)} A
                  </p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">R_bump</p>
                  <p className="font-mono font-bold">
                    {(rBump * 1000).toFixed(1)} mΩ
                  </p>
                </div>
              </div>

              {/* Formula card */}
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                  BUMP COUNT
                </p>
                <p className="font-mono text-sm">
                  N_bumps = ⌊(W_die − p) / p + 1⌋²
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  W_die in µm, p = pitch in µm; 40% allocated to power/ground
                </p>
              </div>
            </div>

            {/* SVG bump grid */}
            <div className="flex flex-col items-center">
              <p className="text-xs text-muted-foreground mb-2">
                Representative {gridCols}×{gridRows} sub-grid
              </p>
              <svg
                viewBox="0 0 280 280"
                width="100%"
                style={{ maxWidth: 280 }}
                className="rounded-lg border border-border"
              >
                {/* Die outline */}
                <rect
                  x={10}
                  y={10}
                  width={260}
                  height={260}
                  rx={4}
                  fill="#1e293b"
                  stroke="#475569"
                  strokeWidth={1.5}
                />
                {renderBumpGrid()}
              </svg>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
                  Power/GND
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
                  Signal
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 2: TSV Analyzer ── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-semibold">Through-Silicon Via (TSV) Analyzer</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Controls */}
            <div className="space-y-5">
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">TSV Diameter</span>
                  <span className="font-mono font-semibold">{tsvDiamUm} µm</span>
                </label>
                <input
                  type="range"
                  min={2}
                  max={20}
                  step={1}
                  value={tsvDiamUm}
                  onChange={(e) => setTsvDiamUm(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Aspect Ratio (h/d)</span>
                  <span className="font-mono font-semibold">{tsvAspectRatio}:1</span>
                </label>
                <input
                  type="range"
                  min={5}
                  max={20}
                  step={1}
                  value={tsvAspectRatio}
                  onChange={(e) => setTsvAspectRatio(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">TSV Count</span>
                  <span className="font-mono font-semibold">
                    {tsvCount.toLocaleString()}
                  </span>
                </label>
                <input
                  type="range"
                  min={100}
                  max={10000}
                  step={100}
                  value={tsvCount}
                  onChange={(e) => setTsvCount(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">TSV Height</p>
                  <p className="font-mono font-bold">{tsvHeightUm} µm</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">R_TSV</p>
                  <p className="font-mono font-bold">{(rTsv * 1000).toFixed(3)} mΩ</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">C_TSV</p>
                  <p className="font-mono font-bold">{cTsvFF.toFixed(2)} fF</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Total KOZ</p>
                  <p className="font-mono font-bold">{totalKozMm2.toFixed(2)} mm²</p>
                </div>
              </div>

              {/* Formula card */}
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                  TSV PARASITICS
                </p>
                <p className="font-mono text-sm">R_TSV = ρ·h / (π·r²)</p>
                <p className="font-mono text-sm">C_TSV = 2πε₀εᵣh / ln(d_out/d_in)</p>
                <p className="text-xs text-muted-foreground mt-1">
                  ρ_Cu = 1.7×10⁻⁸ Ω·m; oxide liner εᵣ ≈ 3.9
                </p>
              </div>
            </div>

            {/* SVG TSV cross-section */}
            <div className="flex flex-col items-center">
              <p className="text-xs text-muted-foreground mb-2">
                Cross-section: stacked dies with TSVs
              </p>
              <svg
                viewBox="0 0 280 200"
                width="100%"
                style={{ maxWidth: 280 }}
                className="rounded-lg border border-border"
              >
                {/* Background */}
                <rect width={280} height={200} fill="#0f172a" />

                {/* Substrate */}
                <rect x={10} y={165} width={260} height={25} rx={2} fill="#334155" />
                <text x={140} y={181} textAnchor="middle" fill="#94a3b8" fontSize={9}>
                  Substrate
                </text>

                {/* Bottom die */}
                <rect x={10} y={100} width={260} height={60} rx={2} fill="#1e3a5f" />
                <text x={140} y={134} textAnchor="middle" fill="#93c5fd" fontSize={9}>
                  Bottom Die (Si)
                </text>

                {/* Top die */}
                <rect x={10} y={30} width={260} height={60} rx={2} fill="#1e4060" />
                <text x={140} y={64} textAnchor="middle" fill="#bfdbfe" fontSize={9}>
                  Top Die (Si)
                </text>

                {/* TSVs */}
                {tsvPositions.map((cx, i) => (
                  <g key={`tsv-${i}`}>
                    {/* Oxide liner */}
                    <rect
                      x={cx - tsvW / 2 - 1.5}
                      y={31}
                      width={tsvW + 3}
                      height={133}
                      fill="white"
                      opacity={0.15}
                    />
                    {/* Copper fill */}
                    <rect
                      x={cx - tsvW / 2}
                      y={32}
                      width={tsvW}
                      height={131}
                      fill="#b87333"
                      opacity={0.9}
                    />
                  </g>
                ))}

                {/* Dimension arrows for first TSV */}
                <line
                  x1={tsvPositions[0] - tsvW / 2 - 6}
                  y1={32}
                  x2={tsvPositions[0] - tsvW / 2 - 6}
                  y2={163}
                  stroke="#94a3b8"
                  strokeWidth={0.8}
                  markerEnd="url(#arrowDown)"
                />
                <text
                  x={tsvPositions[0] - tsvW / 2 - 14}
                  y={100}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize={7}
                  transform={`rotate(-90, ${tsvPositions[0] - tsvW / 2 - 14}, 100)`}
                >
                  h={tsvHeightUm}µm
                </text>

                {/* Diameter label */}
                <line
                  x1={tsvPositions[5] - tsvW / 2}
                  y1={22}
                  x2={tsvPositions[5] + tsvW / 2}
                  y2={22}
                  stroke="#94a3b8"
                  strokeWidth={0.8}
                />
                <text
                  x={tsvPositions[5]}
                  y={19}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize={7}
                >
                  d={tsvDiamUm}µm
                </text>

                {/* Arrow marker */}
                <defs>
                  <marker
                    id="arrowDown"
                    markerWidth={4}
                    markerHeight={4}
                    refX={2}
                    refY={4}
                    orient="auto"
                  >
                    <path d="M0,0 L4,0 L2,4 Z" fill="#94a3b8" />
                  </marker>
                </defs>
              </svg>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#b87333" }} />
                  Cu TSV
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm bg-white/20" />
                  Oxide liner
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 3: Die-to-Die Bandwidth ── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-semibold">Die-to-Die Bandwidth</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Controls */}
            <div className="space-y-5">
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Bump Pitch</span>
                  <span className="font-mono font-semibold">{bumpPitch} µm</span>
                </label>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={bumpPitch}
                  onChange={(e) => setBumpPitch(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Interface Width</span>
                  <span className="font-mono font-semibold">
                    {interfaceWidthMm} mm
                  </span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={0.5}
                  value={interfaceWidthMm}
                  onChange={(e) => setInterfaceWidthMm(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Data Rate</span>
                  <span className="font-mono font-semibold">{freqGHz} GHz</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={32}
                  step={1}
                  value={freqGHz}
                  onChange={(e) => setFreqGHz(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Encoding Efficiency</span>
                  <span className="font-mono font-semibold">
                    {(encodingEff * 100).toFixed(0)}%
                  </span>
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={0.9}
                  step={0.05}
                  value={encodingEff}
                  onChange={(e) => setEncodingEff(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Bumps/Edge</p>
                  <p className="font-mono font-bold">{bumpsEdge}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Raw BW</p>
                  <p className="font-mono font-bold">{bwRawGbps.toFixed(0)} Gb/s</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3 col-span-2">
                  <p className="text-muted-foreground text-xs">Effective BW</p>
                  <p className="font-mono font-bold text-orange-400 text-lg">
                    {bwEffGbps.toFixed(1)} Gb/s
                  </p>
                </div>
              </div>

              {/* Formula card */}
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                  DIE-TO-DIE BANDWIDTH
                </p>
                <p className="font-mono text-sm">BW = N_bumps · f_data · 2 · η</p>
                <p className="text-xs text-muted-foreground mt-1">
                  DDR factor of 2; η = encoding efficiency (e.g. 128b/130b ≈ 0.985)
                </p>
              </div>
            </div>

            {/* SVG bar chart */}
            <div className="flex flex-col items-center">
              <p className="text-xs text-muted-foreground mb-2">
                Bandwidth comparison (Gb/s)
              </p>
              <svg
                viewBox={`0 0 ${bwSvgW} ${bwSvgH}`}
                width="100%"
                style={{ maxWidth: bwSvgW }}
                className="rounded-lg border border-border"
              >
                <rect width={bwSvgW} height={bwSvgH} fill="#0f172a" />

                {/* Y-axis labels */}
                {[0, 500, 1000, 1500, 2000].map((v) => (
                  <g key={`ya-${v}`}>
                    <line
                      x1={bwPad.left}
                      y1={bwBarY(v)}
                      x2={bwSvgW - bwPad.right}
                      y2={bwBarY(v)}
                      stroke="#1e293b"
                      strokeWidth={1}
                    />
                    <text
                      x={bwPad.left - 4}
                      y={bwBarY(v) + 4}
                      textAnchor="end"
                      fill="#64748b"
                      fontSize={8}
                    >
                      {v}
                    </text>
                  </g>
                ))}

                {/* Computed BW bar (animated via motion not available in SVG directly, use inline style) */}
                <rect
                  x={bwBarX + 10}
                  y={bwBarY(bwEffGbps)}
                  width={60}
                  height={bwBarH(bwEffGbps)}
                  fill="#f97316"
                  opacity={0.85}
                  rx={2}
                />
                <text
                  x={bwBarX + 40}
                  y={bwSvgH - bwPad.bottom + 12}
                  textAnchor="middle"
                  fill="#f97316"
                  fontSize={8}
                >
                  Computed
                </text>
                <text
                  x={bwBarX + 40}
                  y={bwBarY(bwEffGbps) - 3}
                  textAnchor="middle"
                  fill="#f97316"
                  fontSize={7}
                >
                  {bwEffGbps.toFixed(0)}
                </text>

                {/* Reference lines */}
                {references.map((ref, i) => {
                  const y = bwBarY(ref.gbps);
                  const xStart = bwBarX + 80;
                  const xEnd = bwSvgW - bwPad.right;
                  const labelX = xStart + (i % 2) * 55;
                  return (
                    <g key={`ref-${ref.label}`}>
                      <line
                        x1={xStart}
                        y1={y}
                        x2={xEnd}
                        y2={y}
                        stroke={ref.color}
                        strokeWidth={1}
                        strokeDasharray="4 3"
                        opacity={0.8}
                      />
                      <text
                        x={labelX + 2}
                        y={y - 2}
                        fill={ref.color}
                        fontSize={7}
                        opacity={0.9}
                      >
                        {ref.label} {ref.gbps}
                      </text>
                    </g>
                  );
                })}

                {/* Axes */}
                <line
                  x1={bwPad.left}
                  y1={bwPad.top}
                  x2={bwPad.left}
                  y2={bwSvgH - bwPad.bottom}
                  stroke="#334155"
                  strokeWidth={1}
                />
                <line
                  x1={bwPad.left}
                  y1={bwSvgH - bwPad.bottom}
                  x2={bwSvgW - bwPad.right}
                  y2={bwSvgH - bwPad.bottom}
                  stroke="#334155"
                  strokeWidth={1}
                />
                <text
                  x={bwPad.left - 30}
                  y={bwSvgH / 2}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize={8}
                  transform={`rotate(-90, ${bwPad.left - 30}, ${bwSvgH / 2})`}
                >
                  Gb/s
                </text>
              </svg>
            </div>
          </div>
        </div>

        {/* ── Section 4: Package Thermal Resistance ── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-semibold">Package Thermal Resistance</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Controls */}
            <div className="space-y-5">
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">θ_JC (junction-to-case)</span>
                  <span className="font-mono font-semibold">{thetaJC} °C/W</span>
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={thetaJC}
                  onChange={(e) => setThetaJC(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">θ_TIM</span>
                  <span className="font-mono font-semibold">{thetaTIM} °C/W</span>
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={2}
                  step={0.1}
                  value={thetaTIM}
                  onChange={(e) => setThetaTIM(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">θ_CA (case-to-ambient)</span>
                  <span className="font-mono font-semibold">{thetaCA} °C/W</span>
                </label>
                <input
                  type="range"
                  min={5}
                  max={30}
                  step={1}
                  value={thetaCA}
                  onChange={(e) => setThetaCA(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Power Dissipation</span>
                  <span className="font-mono font-semibold">{powerW} W</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={300}
                  step={5}
                  value={powerW}
                  onChange={(e) => setPowerW(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>

              {/* Thermal alert */}
              {tJunction > 100 ? (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>
                    T_junction = <strong>{tJunction.toFixed(1)}°C</strong> — exceeds 100°C
                    safe limit!
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/10 p-3 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span>
                    T_junction = <strong>{tJunction.toFixed(1)}°C</strong> — within safe
                    limits
                  </span>
                </div>
              )}

              {/* Formula card */}
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                  THERMAL CHAIN
                </p>
                <p className="font-mono text-sm">
                  T_J = T_amb + P·(θ_JC + θ_TIM + θ_CA)
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  θ_JA = {thetaJA.toFixed(2)} °C/W; T_amb = {T_AMBIENT}°C
                </p>
              </div>
            </div>

            {/* SVG thermal ladder */}
            <div className="flex flex-col items-center">
              <p className="text-xs text-muted-foreground mb-2">
                Thermal resistance ladder
              </p>
              <svg
                viewBox="0 0 320 160"
                width="100%"
                style={{ maxWidth: 320 }}
                className="rounded-lg border border-border"
              >
                <rect width={320} height={160} fill="#0f172a" />

                {/* Heat flow arrow at top */}
                <text x={160} y={14} textAnchor="middle" fill="#f97316" fontSize={8}>
                  Heat Flow →
                </text>

                {/* Nodes */}
                {thermalNodes.map((node, i) => {
                  const x = 10 + i * 76;
                  const y = 30;
                  const w = 70;
                  const h = 70;
                  const col = tempColor(node.temp);
                  return (
                    <g key={`thermal-${i}`}>
                      {/* Connecting line to next node */}
                      {i < thermalNodes.length - 1 && (
                        <line
                          x1={x + w}
                          y1={y + h / 2}
                          x2={x + w + 6}
                          y2={y + h / 2}
                          stroke="#475569"
                          strokeWidth={2}
                        />
                      )}
                      {/* Box */}
                      <rect
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        rx={4}
                        fill={col}
                        opacity={0.2}
                        stroke={col}
                        strokeWidth={1.2}
                      />
                      {/* Label */}
                      <text
                        x={x + w / 2}
                        y={y + 15}
                        textAnchor="middle"
                        fill={col}
                        fontSize={8}
                        fontWeight="bold"
                      >
                        {node.label}
                      </text>
                      {/* Temperature */}
                      <text
                        x={x + w / 2}
                        y={y + 32}
                        textAnchor="middle"
                        fill="#f8fafc"
                        fontSize={10}
                        fontWeight="bold"
                      >
                        {node.temp.toFixed(0)}°C
                      </text>
                      {/* Theta */}
                      {node.theta > 0 && (
                        <text
                          x={x + w / 2}
                          y={y + 46}
                          textAnchor="middle"
                          fill="#94a3b8"
                          fontSize={7}
                        >
                          θ={node.theta}
                        </text>
                      )}
                      {/* Power */}
                      <text
                        x={x + w / 2}
                        y={y + 60}
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize={7}
                      >
                        {powerW}W
                      </text>
                    </g>
                  );
                })}

                {/* θ_JA summary */}
                <text x={160} y={120} textAnchor="middle" fill="#94a3b8" fontSize={9}>
                  θ_JA = {thetaJA.toFixed(2)} °C/W
                </text>
                <text x={160} y={133} textAnchor="middle" fill="#94a3b8" fontSize={9}>
                  ΔT = {(tJunction - T_AMBIENT).toFixed(1)} °C
                </text>
              </svg>
            </div>
          </div>
        </div>

        {/* ── Section 5: Chiplet Topology Simulator ── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-semibold">Chiplet Topology Simulator</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Controls */}
            <div className="space-y-5">
              {/* Topology selector */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Topology</p>
                <div className="flex gap-2">
                  {(["star", "mesh", "ring"] as Topology[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTopology(t)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        topology === t
                          ? "border-orange-500/60 bg-orange-500/20 text-orange-300"
                          : "border-border bg-muted/20 text-muted-foreground hover:border-orange-500/30"
                      }`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Link BW per port</span>
                  <span className="font-mono font-semibold">{linkBwGbps} Gb/s</span>
                </label>
                <input
                  type="range"
                  min={10}
                  max={1000}
                  step={10}
                  value={linkBwGbps}
                  onChange={(e) => setLinkBwGbps(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Link Count</p>
                  <p className="font-mono font-bold">{linkCount}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Total BW</p>
                  <p className="font-mono font-bold">{totalBwGbps.toLocaleString()} Gb/s</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3 col-span-2">
                  <p className="text-muted-foreground text-xs">Bisection BW</p>
                  <p className="font-mono font-bold text-orange-400 text-lg">
                    {bisectionBw.toLocaleString()} Gb/s
                  </p>
                </div>
              </div>

              {/* Chiplet legend */}
              <div className="flex flex-wrap gap-2">
                {CHIPLETS.map((c) => (
                  <span
                    key={c.name}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-border"
                  >
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-sm"
                      style={{ background: c.color }}
                    />
                    {c.name}
                  </span>
                ))}
              </div>

              {/* Formula card */}
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                  BISECTION BANDWIDTH
                </p>
                <p className="font-mono text-sm">
                  BW_bisection = n_cross_links · BW_link
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Star: bottleneck at central switch (2 links); Mesh/Ring: 3 cross-links
                </p>
              </div>
            </div>

            {/* SVG chiplet topology */}
            <div className="flex flex-col items-center">
              <p className="text-xs text-muted-foreground mb-2">
                Topology: {topology}
              </p>
              <svg
                viewBox="0 0 320 260"
                width="100%"
                style={{ maxWidth: 320 }}
                className="rounded-lg border border-border"
              >
                <rect width={320} height={260} fill="#0f172a" />

                {/* Central switch (star only) */}
                {topology === "star" && (
                  <g>
                    <rect
                      x={STAR_CENTER.x - 20}
                      y={STAR_CENTER.y - 12}
                      width={40}
                      height={24}
                      rx={4}
                      fill="#374151"
                      stroke="#6b7280"
                      strokeWidth={1}
                    />
                    <text
                      x={STAR_CENTER.x}
                      y={STAR_CENTER.y + 5}
                      textAnchor="middle"
                      fill="#9ca3af"
                      fontSize={8}
                      fontWeight="bold"
                    >
                      Switch
                    </text>
                  </g>
                )}

                {/* Links */}
                {links.map(([a, b], idx) => {
                  const src = CHIPLETS[a];
                  const dst = b === -1 ? STAR_CENTER : CHIPLETS[b];
                  return (
                    <line
                      key={`link-${idx}`}
                      x1={src.x}
                      y1={src.y + 10}
                      x2={dst.x}
                      y2={dst.y + (b === -1 ? 0 : 10)}
                      stroke="#f97316"
                      strokeWidth={1.5}
                      opacity={0.6}
                      strokeDasharray={topology === "ring" ? "4 2" : "none"}
                    />
                  );
                })}

                {/* Chiplets */}
                {CHIPLETS.map((c) => (
                  <g key={`chiplet-${c.name}`}>
                    <rect
                      x={c.x - 24}
                      y={c.y}
                      width={48}
                      height={24}
                      rx={5}
                      fill={c.color}
                      opacity={0.25}
                      stroke={c.color}
                      strokeWidth={1.5}
                    />
                    <text
                      x={c.x}
                      y={c.y + 15}
                      textAnchor="middle"
                      fill={c.color}
                      fontSize={9}
                      fontWeight="bold"
                    >
                      {c.name}
                    </text>
                  </g>
                ))}

                {/* BW annotation */}
                <text x={160} y={250} textAnchor="middle" fill="#64748b" fontSize={8}>
                  {linkCount} links × {linkBwGbps} Gb/s = {totalBwGbps.toLocaleString()} Gb/s total
                </text>
              </svg>
            </div>
          </div>
        </div>

        {/* ── Bottom Formula Reference Card ── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-orange-400" />
            <h2 className="text-lg font-semibold">Formula Reference</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                FLIP-CHIP ARRAY
              </p>
              <p className="font-mono text-sm">N_bumps = ⌊(W_die−p)/p + 1⌋²</p>
              <p className="text-xs text-muted-foreground mt-1">
                p = pitch; W_die = die width in same units
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                VIA RESISTANCE
              </p>
              <p className="font-mono text-sm">R_TSV = ρ·h / (π·r²)</p>
              <p className="text-xs text-muted-foreground mt-1">
                ρ_Cu = 1.7×10⁻⁸ Ω·m; r = via radius
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                THERMAL CHAIN
              </p>
              <p className="font-mono text-sm">T_J = T_amb + P·(θ_JC + θ_TIM + θ_CA)</p>
              <p className="text-xs text-muted-foreground mt-1">
                θ values in °C/W; P in watts
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                DIE-TO-DIE BANDWIDTH
              </p>
              <p className="font-mono text-sm">BW_d2d = N_bumps·f·2·η</p>
              <p className="text-xs text-muted-foreground mt-1">
                f = data rate; η = encoding efficiency
              </p>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
