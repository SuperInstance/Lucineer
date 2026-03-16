"use client";

import { useState, useEffect, useCallback } from "react";
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
  Zap,
} from "lucide-react";

// ─── Physics / Math Constants ───────────────────────────────────────────────

const WAFER_RADIUS_MM = 150;
const WAFER_COST_USD = 300;

// ─── Typed Helpers ───────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function calcFaultCoverage(
  detectableFaults: number,
  iterations: number,
  totalFaults: number
): number {
  const detected = detectableFaults * (1 - Math.exp(-iterations * 0.35));
  return (detected / totalFaults) * 100;
}

function calcYieldNegBinom(D0: number, alpha: number): number {
  return Math.pow(1 + D0 / alpha, -alpha);
}

function calcDiesPerWafer(dieAreaMm2: number): number {
  const r = WAFER_RADIUS_MM;
  return Math.floor(
    (Math.PI * r * r) / dieAreaMm2 - (Math.PI * r) / Math.sqrt(dieAreaMm2)
  );
}

function formatSci(val: number, decimals = 2): string {
  if (val === 0) return "0";
  const exp = Math.floor(Math.log10(Math.abs(val)));
  const mantissa = val / Math.pow(10, exp);
  return `${mantissa.toFixed(decimals)}×10^${exp}`;
}

type ScanMode = "shift" | "capture";
type JtagInstr = "SAMPLE" | "PRELOAD" | "EXTEST" | "BYPASS";

const JTAG_CELLS: string[] = [
  "VDD_SENSE",
  "CLK_IN",
  "RESET_N",
  "DATA_IN[7:0]",
  "DATA_OUT[7:0]",
  "IRQ",
  "SPI_MOSI",
  "SPI_MISO",
];

// ─── Sub-components (SVG helpers) ────────────────────────────────────────────

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
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
        {label}
      </p>
      <p className="font-mono text-sm">{formula}</p>
      <p className="text-xs text-muted-foreground mt-1">{explanation}</p>
    </div>
  );
}

// ─── Section 1: Scan Chain SVG ───────────────────────────────────────────────

function ScanChainSVG({
  chainCount,
  ffsPerChain,
  scanMode,
  tick,
}: {
  chainCount: number;
  ffsPerChain: number;
  scanMode: ScanMode;
  tick: number;
}) {
  const visibleChains = Math.min(chainCount, 4);
  const visibleFFs = Math.min(ffsPerChain, 8);
  const rowH = 140 / visibleChains;
  const ffW = 18;
  const ffH = 14;
  const startX = 40;
  const endX = 300;
  const ffSpacing = (endX - startX - 20) / Math.max(visibleFFs - 1, 1);

  // Animate position: 0..visibleFFs-1
  const shiftPos = tick % (visibleFFs + 1);

  return (
    <svg viewBox="0 0 340 160" className="w-full" style={{ maxHeight: 180 }}>
      {Array.from({ length: visibleChains }).map((_, ci) => {
        const cy = 20 + ci * rowH + rowH / 2;
        return (
          <g key={ci}>
            {/* SDI label */}
            <text x={4} y={cy + 4} fontSize={8} fill="#94a3b8" fontFamily="monospace">
              SDI{ci}
            </text>
            {/* SDO label */}
            <text x={308} y={cy + 4} fontSize={8} fill="#94a3b8" fontFamily="monospace">
              SDO{ci}
            </text>
            {/* Chain line */}
            <line x1={startX} y1={cy} x2={endX} y2={cy} stroke="#334155" strokeWidth={1} />
            {/* Flip-flops */}
            {Array.from({ length: visibleFFs }).map((_, fi) => {
              const fx = startX + fi * ffSpacing;
              const isActive =
                scanMode === "capture"
                  ? true
                  : fi === shiftPos - 1;
              return (
                <g key={fi}>
                  {/* Multiplexer triangle at D-input */}
                  <polygon
                    points={`${fx - 10},${cy - 5} ${fx - 10},${cy + 5} ${fx - 4},${cy}`}
                    fill="#1e3a5f"
                    stroke="#38bdf8"
                    strokeWidth={0.5}
                  />
                  {/* FF box */}
                  <rect
                    x={fx - ffW / 2}
                    y={cy - ffH / 2}
                    width={ffW}
                    height={ffH}
                    rx={2}
                    fill={isActive ? "#0ea5e9" : "#1e293b"}
                    stroke={isActive ? "#38bdf8" : "#475569"}
                    strokeWidth={1}
                  />
                  <text
                    x={fx}
                    y={cy + 3}
                    textAnchor="middle"
                    fontSize={6}
                    fill={isActive ? "#fff" : "#94a3b8"}
                    fontFamily="monospace"
                  >
                    FF
                  </text>
                </g>
              );
            })}
            {/* chain length label */}
            <text x={170} y={cy - rowH / 2 + 8} textAnchor="middle" fontSize={7} fill="#64748b">
              {ffsPerChain} FFs
            </text>
          </g>
        );
      })}
      {/* Mode indicator */}
      <text x={170} y={155} textAnchor="middle" fontSize={8} fill="#38bdf8" fontFamily="monospace">
        MODE: {scanMode.toUpperCase()} — {scanMode === "shift" ? "shifting data..." : "capturing..."}
      </text>
    </svg>
  );
}

// ─── Section 2: BIST SVG ─────────────────────────────────────────────────────

function BISTSVG({
  lfsrBits,
  misrBits,
}: {
  lfsrBits: number;
  misrBits: number;
}) {
  return (
    <svg viewBox="0 0 340 160" className="w-full" style={{ maxHeight: 180 }}>
      {/* BIST Controller */}
      <rect x={110} y={4} width={120} height={24} rx={4} fill="#1e293b" stroke="#475569" />
      <text x={170} y={20} textAnchor="middle" fontSize={9} fill="#94a3b8" fontFamily="monospace">
        BIST Controller
      </text>

      {/* Arrow down from controller */}
      <line x1={170} y1={28} x2={170} y2={44} stroke="#475569" strokeWidth={1} markerEnd="url(#arr)" />

      {/* LFSR block */}
      <rect x={20} y={50} width={80} height={40} rx={4} fill="#0c1a2e" stroke="#0ea5e9" strokeWidth={1.5} />
      <text x={60} y={68} textAnchor="middle" fontSize={10} fill="#38bdf8" fontFamily="monospace" fontWeight="bold">
        LFSR
      </text>
      <text x={60} y={81} textAnchor="middle" fontSize={8} fill="#64748b" fontFamily="monospace">
        {lfsrBits}-bit
      </text>
      {/* XOR feedback circle */}
      <circle cx={60} cy={100} r={8} fill="none" stroke="#0ea5e9" strokeWidth={1.5} />
      <text x={60} y={104} textAnchor="middle" fontSize={10} fill="#0ea5e9">⊕</text>
      <line x1={60} y1={90} x2={60} y2={92} stroke="#0ea5e9" strokeWidth={1} />
      <line x1={20} y1={100} x2={52} y2={100} stroke="#0ea5e9" strokeWidth={1} />
      <line x1={68} y1={100} x2={100} y2={100} stroke="#0ea5e9" strokeWidth={1} />
      <line x1={20} y1={70} x2={20} y2={100} stroke="#0ea5e9" strokeWidth={1} />

      {/* Arrow LFSR → CUT */}
      <line x1={100} y1={70} x2={120} y2={70} stroke="#38bdf8" strokeWidth={1.5} />
      <polygon points="118,66 126,70 118,74" fill="#38bdf8" />

      {/* CUT block */}
      <rect x={126} y={50} width={88} height={40} rx={4} fill="#0f172a" stroke="#64748b" strokeWidth={1.5} />
      <text x={170} y={68} textAnchor="middle" fontSize={10} fill="#cbd5e1" fontFamily="monospace" fontWeight="bold">
        CUT
      </text>
      <text x={170} y={81} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily="monospace">
        Circuit Under Test
      </text>

      {/* Arrow CUT → MISR */}
      <line x1={214} y1={70} x2={232} y2={70} stroke="#38bdf8" strokeWidth={1.5} />
      <polygon points="230,66 238,70 230,74" fill="#38bdf8" />

      {/* MISR block */}
      <rect x={238} y={50} width={80} height={40} rx={4} fill="#0c1a2e" stroke="#22c55e" strokeWidth={1.5} />
      <text x={278} y={68} textAnchor="middle" fontSize={10} fill="#4ade80" fontFamily="monospace" fontWeight="bold">
        MISR
      </text>
      <text x={278} y={81} textAnchor="middle" fontSize={8} fill="#64748b" fontFamily="monospace">
        {misrBits}-bit
      </text>
      {/* XOR feedback */}
      <circle cx={278} cy={100} r={8} fill="none" stroke="#22c55e" strokeWidth={1.5} />
      <text x={278} y={104} textAnchor="middle" fontSize={10} fill="#22c55e">⊕</text>
      <line x1={278} y1={90} x2={278} y2={92} stroke="#22c55e" strokeWidth={1} />
      <line x1={238} y1={100} x2={270} y2={100} stroke="#22c55e" strokeWidth={1} />
      <line x1={286} y1={100} x2={318} y2={100} stroke="#22c55e" strokeWidth={1} />
      <line x1={318} y1={70} x2={318} y2={100} stroke="#22c55e" strokeWidth={1} />

      {/* Signature labels */}
      <text x={278} y={118} textAnchor="middle" fontSize={7} fill="#4ade80" fontFamily="monospace">
        GOOD sig ✓
      </text>
      <text x={278} y={128} textAnchor="middle" fontSize={7} fill="#ef4444" fontFamily="monospace">
        FAIL sig ✗
      </text>

      {/* Arrow def */}
      <defs>
        <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <polygon points="0,0 6,3 0,6" fill="#475569" />
        </marker>
      </defs>
    </svg>
  );
}

// ─── Section 3: ATPG SVG ─────────────────────────────────────────────────────

function ATPGFaultSVG({
  totalFaults,
  detectableFaults,
  detectedFaults,
  redundantFaults,
  atpgIterations,
}: {
  totalFaults: number;
  detectableFaults: number;
  detectedFaults: number;
  redundantFaults: number;
  atpgIterations: number;
}) {
  // Bar chart: single wide bar broken into segments
  const barY = 20;
  const barH = 30;
  const barW = 300;
  const detectedW = (detectedFaults / totalFaults) * barW;
  const detectableW = (detectableFaults / totalFaults) * barW;
  const redundantW = (redundantFaults / totalFaults) * barW;

  // Convergence curve (20 iterations)
  const curvePoints: string = Array.from({ length: 21 }, (_, i) => {
    const coverage =
      i === 0
        ? 0
        : (detectableFaults * (1 - Math.exp(-i * 0.35)) / totalFaults) * 100;
    const cx = 10 + (i / 20) * 300;
    const cy = 180 - (coverage / 100) * 70;
    return `${cx.toFixed(1)},${cy.toFixed(1)}`;
  }).join(" ");

  // Mark current iteration
  const curCoverage =
    atpgIterations === 0
      ? 0
      : (detectableFaults * (1 - Math.exp(-atpgIterations * 0.35)) /
          totalFaults) *
        100;
  const curX = 10 + (atpgIterations / 20) * 300;
  const curY = 180 - (curCoverage / 100) * 70;

  return (
    <svg viewBox="0 0 320 200" className="w-full" style={{ maxHeight: 210 }}>
      {/* Bar background */}
      <rect x={10} y={barY} width={barW} height={barH} rx={4} fill="#1e293b" />
      {/* Detected (bright blue) */}
      <rect x={10} y={barY} width={Math.max(0, detectedW)} height={barH} rx={4} fill="#0ea5e9" />
      {/* Detectable outline */}
      <rect
        x={10}
        y={barY}
        width={Math.max(0, detectableW)}
        height={barH}
        rx={4}
        fill="none"
        stroke="#38bdf8"
        strokeWidth={1.5}
        strokeDasharray="4 2"
      />
      {/* Redundant (red, at end) */}
      <rect
        x={10 + detectableW}
        y={barY}
        width={Math.max(0, redundantW)}
        height={barH}
        rx={0}
        fill="#ef4444"
        opacity={0.7}
      />
      {/* Labels */}
      <text x={10 + detectedW / 2} y={barY + barH / 2 + 4} textAnchor="middle" fontSize={8} fill="#fff" fontFamily="monospace">
        Detected
      </text>
      <text x={10 + detectableW + redundantW / 2} y={barY + barH / 2 + 4} textAnchor="middle" fontSize={7} fill="#fca5a5" fontFamily="monospace">
        Redund.
      </text>

      {/* Bar legend */}
      <text x={10} y={barY + barH + 12} fontSize={7} fill="#64748b">
        ■ Detected: {detectedFaults.toFixed(0)}
      </text>
      <text x={120} y={barY + barH + 12} fontSize={7} fill="#38bdf8">
        ─ ─ Detectable: {detectableFaults.toFixed(0)}
      </text>
      <text x={240} y={barY + barH + 12} fontSize={7} fill="#ef4444">
        ■ Redund.: {redundantFaults.toFixed(0)}
      </text>

      {/* Convergence curve */}
      <text x={160} y={95} textAnchor="middle" fontSize={8} fill="#64748b">
        Coverage Convergence
      </text>
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map((pct) => {
        const gy = 180 - (pct / 100) * 70;
        return (
          <g key={pct}>
            <line x1={10} y1={gy} x2={310} y2={gy} stroke="#1e293b" strokeWidth={0.5} />
            <text x={6} y={gy + 3} fontSize={6} fill="#475569" textAnchor="end">
              {pct}%
            </text>
          </g>
        );
      })}
      <polyline points={curvePoints} fill="none" stroke="#38bdf8" strokeWidth={2} />
      {/* Current iteration dot */}
      <circle cx={curX} cy={curY} r={4} fill="#f59e0b" stroke="#fff" strokeWidth={1} />
      <text x={curX + 6} y={curY - 4} fontSize={7} fill="#f59e0b" fontFamily="monospace">
        iter {atpgIterations}
      </text>
      {/* X axis */}
      <line x1={10} y1={180} x2={310} y2={180} stroke="#334155" strokeWidth={1} />
      <text x={160} y={196} textAnchor="middle" fontSize={7} fill="#64748b">
        ATPG Iterations (0–20)
      </text>
    </svg>
  );
}

// ─── Section 4: JTAG SVG ─────────────────────────────────────────────────────

function JTAGBoundaryScanSVG({
  instrReg,
  capturedBits,
  tick,
}: {
  instrReg: JtagInstr;
  capturedBits: boolean[];
  tick: number;
}) {
  // Chip outline: center 170,100, size 100x100
  const chipX = 120;
  const chipY = 50;
  const chipW = 100;
  const chipH = 100;

  // 8 pins: 2 per side (top, right, bottom, left)
  interface PinDef {
    name: string;
    x: number;
    y: number;
    side: "top" | "right" | "bottom" | "left";
  }

  const pins: PinDef[] = [
    { name: JTAG_CELLS[0], x: chipX + 25, y: chipY - 12, side: "top" },
    { name: JTAG_CELLS[1], x: chipX + 75, y: chipY - 12, side: "top" },
    { name: JTAG_CELLS[2], x: chipX + chipW + 12, y: chipY + 25, side: "right" },
    { name: JTAG_CELLS[3], x: chipX + chipW + 12, y: chipY + 75, side: "right" },
    { name: JTAG_CELLS[4], x: chipX + 75, y: chipY + chipH + 12, side: "bottom" },
    { name: JTAG_CELLS[5], x: chipX + 25, y: chipY + chipH + 12, side: "bottom" },
    { name: JTAG_CELLS[6], x: chipX - 12, y: chipY + 75, side: "left" },
    { name: JTAG_CELLS[7], x: chipX - 12, y: chipY + 25, side: "left" },
  ];

  const isBypass = instrReg === "BYPASS";
  const isExtest = instrReg === "EXTEST";

  // Chain path (order: top-left → top-right → right-top → right-bottom → bottom-right → bottom-left → left-bottom → left-top)
  const chainOrder = [0, 1, 2, 3, 4, 5, 6, 7];
  const shiftPos = tick % 9;

  return (
    <svg viewBox="0 0 340 200" className="w-full" style={{ maxHeight: 210 }}>
      {/* Chip body */}
      <rect x={chipX} y={chipY} width={chipW} height={chipH} rx={6} fill="#0f172a" stroke="#475569" strokeWidth={2} />
      <text x={chipX + chipW / 2} y={chipY + chipH / 2 - 8} textAnchor="middle" fontSize={10} fill="#64748b" fontFamily="monospace">
        IC Die
      </text>
      <text x={chipX + chipW / 2} y={chipY + chipH / 2 + 6} textAnchor="middle" fontSize={8} fill="#475569" fontFamily="monospace">
        {instrReg}
      </text>

      {/* Pins + BS cells */}
      {pins.map((pin, i) => {
        const isActive = isExtest || (instrReg === "SAMPLE" && capturedBits[i]);
        const isShifting = !isBypass && shiftPos - 1 === chainOrder.indexOf(i);
        const cellColor = isShifting
          ? "#f59e0b"
          : isActive
          ? "#0ea5e9"
          : "#1e293b";
        const cellStroke = isShifting ? "#fbbf24" : isActive ? "#38bdf8" : "#475569";

        return (
          <g key={i}>
            {/* BS cell box at pin */}
            <rect
              x={pin.x - 9}
              y={pin.y - 7}
              width={18}
              height={14}
              rx={2}
              fill={cellColor}
              stroke={cellStroke}
              strokeWidth={1}
            />
            <text x={pin.x} y={pin.y + 3} textAnchor="middle" fontSize={5} fill="#fff" fontFamily="monospace">
              BSC
            </text>
            {/* Pin name */}
            {pin.side === "top" && (
              <text x={pin.x} y={pin.y - 10} textAnchor="middle" fontSize={5} fill="#64748b" fontFamily="monospace">
                {pin.name.substring(0, 8)}
              </text>
            )}
            {pin.side === "bottom" && (
              <text x={pin.x} y={pin.y + 20} textAnchor="middle" fontSize={5} fill="#64748b" fontFamily="monospace">
                {pin.name.substring(0, 8)}
              </text>
            )}
            {pin.side === "right" && (
              <text x={pin.x + 14} y={pin.y + 3} fontSize={5} fill="#64748b" fontFamily="monospace">
                {pin.name.substring(0, 8)}
              </text>
            )}
            {pin.side === "left" && (
              <text x={pin.x - 14} y={pin.y + 3} textAnchor="end" fontSize={5} fill="#64748b" fontFamily="monospace">
                {pin.name.substring(0, 8)}
              </text>
            )}
          </g>
        );
      })}

      {/* Daisy-chain connections (simplified ring) */}
      {!isBypass ? (
        <g>
          {/* top row */}
          <line x1={pins[0].x} y1={pins[0].y} x2={pins[1].x} y2={pins[1].y} stroke={isExtest ? "#0ea5e9" : "#334155"} strokeWidth={1.5} />
          {/* right col */}
          <line x1={pins[2].x} y1={pins[2].y} x2={pins[3].x} y2={pins[3].y} stroke={isExtest ? "#0ea5e9" : "#334155"} strokeWidth={1.5} />
          {/* bottom row */}
          <line x1={pins[4].x} y1={pins[4].y} x2={pins[5].x} y2={pins[5].y} stroke={isExtest ? "#0ea5e9" : "#334155"} strokeWidth={1.5} />
          {/* left col */}
          <line x1={pins[6].x} y1={pins[6].y} x2={pins[7].x} y2={pins[7].y} stroke={isExtest ? "#0ea5e9" : "#334155"} strokeWidth={1.5} />
        </g>
      ) : (
        /* BYPASS line */
        <line x1={10} y1={100} x2={330} y2={100} stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 3" />
      )}

      {/* TDI, TDO, TCK, TMS labels */}
      <text x={6} y={30} fontSize={8} fill="#38bdf8" fontFamily="monospace">TDI</text>
      <text x={306} y={30} fontSize={8} fill="#38bdf8" fontFamily="monospace">TDO</text>
      <text x={6} y={170} fontSize={8} fill="#94a3b8" fontFamily="monospace">TCK</text>
      <text x={298} y={170} fontSize={8} fill="#94a3b8" fontFamily="monospace">TMS</text>

      {/* BYPASS label */}
      {isBypass && (
        <text x={170} y={95} textAnchor="middle" fontSize={8} fill="#f59e0b" fontFamily="monospace">
          BYPASS — 1-bit shift
        </text>
      )}
    </svg>
  );
}

// ─── Section 5: Yield SVG ────────────────────────────────────────────────────

function YieldWaferSVG({
  yield_frac,
  diesPerWafer,
  goodDies,
  defectDensity,
}: {
  yield_frac: number;
  diesPerWafer: number;
  goodDies: number;
  defectDensity: number;
}) {
  const cx = 160;
  const cy = 100;
  const r = 90;

  // Grid of dies to display (representative sample, max ~48)
  const displayCount = Math.min(diesPerWafer, 48);
  const gridN = Math.ceil(Math.sqrt(displayCount));
  const cellSize = (r * 1.6) / gridN;

  interface DieDot {
    x: number;
    y: number;
    good: boolean;
  }

  const dies: DieDot[] = [];
  let placed = 0;
  for (let row = 0; row < gridN && placed < displayCount; row++) {
    for (let col = 0; col < gridN && placed < displayCount; col++) {
      const dx = (col - gridN / 2 + 0.5) * cellSize;
      const dy = (row - gridN / 2 + 0.5) * cellSize;
      // Only place if inside wafer circle
      if (Math.sqrt(dx * dx + dy * dy) < r - cellSize / 2) {
        const isGood = placed < Math.floor(displayCount * yield_frac);
        dies.push({ x: cx + dx, y: cy + dy, good: isGood });
        placed++;
      }
    }
  }

  // Random defect clusters (seeded by defect density band)
  const defectCount = Math.floor(defectDensity * 3);
  const defectClusters: { x: number; y: number }[] = Array.from(
    { length: Math.min(defectCount, 8) },
    (_, i) => {
      const angle = (i / Math.max(defectCount, 1)) * Math.PI * 2;
      const rad = 20 + (i % 3) * 20;
      return {
        x: cx + Math.cos(angle) * rad,
        y: cy + Math.sin(angle) * rad,
      };
    }
  );

  return (
    <svg viewBox="0 0 320 200" className="w-full" style={{ maxHeight: 210 }}>
      {/* Wafer circle */}
      <circle cx={cx} cy={cy} r={r} fill="#0f172a" stroke="#334155" strokeWidth={2} />
      {/* Dies */}
      {dies.map((d, i) => (
        <rect
          key={i}
          x={d.x - cellSize / 2 + 0.5}
          y={d.y - cellSize / 2 + 0.5}
          width={cellSize - 1}
          height={cellSize - 1}
          rx={1}
          fill={d.good ? "#166534" : "#7f1d1d"}
          stroke={d.good ? "#22c55e" : "#ef4444"}
          strokeWidth={0.5}
          opacity={0.85}
        />
      ))}
      {/* Defect clusters */}
      {defectClusters.map((dc, i) => (
        <circle
          key={i}
          cx={dc.x}
          cy={dc.y}
          r={5 + (i % 3) * 2}
          fill="#ef4444"
          opacity={0.25}
        />
      ))}
      {/* Flat */}
      <line x1={cx - r * 0.8} y1={cy + r} x2={cx + r * 0.8} y2={cy + r} stroke="#475569" strokeWidth={2} />
      {/* Legend */}
      <rect x={4} y={8} width={10} height={10} rx={1} fill="#166534" stroke="#22c55e" strokeWidth={0.5} />
      <text x={18} y={17} fontSize={8} fill="#4ade80" fontFamily="monospace">
        Good ({goodDies})
      </text>
      <rect x={4} y={22} width={10} height={10} rx={1} fill="#7f1d1d" stroke="#ef4444" strokeWidth={0.5} />
      <text x={18} y={31} fontSize={8} fill="#f87171" fontFamily="monospace">
        Defective ({diesPerWafer - goodDies})
      </text>
      <text x={cx} y={195} textAnchor="middle" fontSize={8} fill="#64748b">
        300mm wafer · {diesPerWafer} total dies
      </text>
    </svg>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function DFTPage() {
  // Section 1: Scan Chain
  const [flipFlopCount, setFlipFlopCount] = useState<number>(100);
  const [chainCount, setChainCount] = useState<number>(4);
  const [scanMode, setScanMode] = useState<ScanMode>("shift");

  // Section 2: BIST
  const [lfsrBits, setLfsrBits] = useState<number>(16);
  const [misrBits, setMisrBits] = useState<number>(16);
  const [bistCycles, setBistCycles] = useState<number>(10000);

  // Section 3: ATPG
  const [totalFaults, setTotalFaults] = useState<number>(5000);
  const [atpgIterations, setAtpgIterations] = useState<number>(10);
  const [redundantFaultPct, setRedundantFaultPct] = useState<number>(5);

  // Section 4: JTAG
  const [instrReg, setInstrReg] = useState<JtagInstr>("SAMPLE");
  const [capturedBits, setCapturedBits] = useState<boolean[]>([
    true, false, true, false, true, true, false, true,
  ]);

  // Section 5: Yield
  const [dieAreaMm2, setDieAreaMm2] = useState<number>(100);
  const [defectDensity, setDefectDensity] = useState<number>(0.5);
  const [criticalLayers, setCriticalLayers] = useState<number>(8);

  // Animation tick
  const [tick, setTick] = useState<number>(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 600);
    return () => clearInterval(id);
  }, []);

  // ── Section 1 Derived ──────────────────────────────────────────────────────
  const ffsPerChain = Math.ceil(flipFlopCount / chainCount);
  const scanShiftCycles = ffsPerChain;
  const testTimePerPattern = (ffsPerChain + 2) * 1e-9;
  const scanMuxOverhead = chainCount * 2;

  // ── Section 2 Derived ──────────────────────────────────────────────────────
  const lfsrPeriodExp = lfsrBits; // 2^N - 1, shown symbolically
  const bistPatternCoverage =
    1 - Math.exp(-bistCycles / Math.pow(2, lfsrBits));
  const misrAliasingProb = Math.pow(2, -misrBits);
  const bistHwOverhead = (lfsrBits + misrBits) * 6;

  // ── Section 3 Derived ──────────────────────────────────────────────────────
  const detectableFaults = totalFaults * (1 - redundantFaultPct / 100);
  const redundantFaults = totalFaults * (redundantFaultPct / 100);
  const detectedFaults =
    detectableFaults * (1 - Math.exp(-atpgIterations * 0.35));
  const finalFaultCoverage = calcFaultCoverage(
    detectableFaults,
    atpgIterations,
    totalFaults
  );
  const atpgPatterns = Math.round(
    detectableFaults * 0.01 * atpgIterations
  );
  const atpgTestTime = atpgPatterns * ffsPerChain * 10e-9;

  // ── Section 4 Derived ──────────────────────────────────────────────────────
  const shiftRegLength = instrReg === "BYPASS" ? 1 : 8;
  const jtagPinCoverage =
    instrReg === "EXTEST" ? 100 : instrReg === "SAMPLE" ? 75 : instrReg === "PRELOAD" ? 50 : 12.5;

  // ── Section 5 Derived ──────────────────────────────────────────────────────
  const alpha = 0.5 * criticalLayers;
  const D0 = (defectDensity * dieAreaMm2) / 100;
  const yieldNB = calcYieldNegBinom(D0, alpha);
  const yieldPoisson = Math.exp(-D0);
  const diesPerWafer = calcDiesPerWafer(dieAreaMm2);
  const goodDies = Math.floor(diesPerWafer * yieldNB);
  const costPerGoodDie = WAFER_COST_USD / Math.max(1, goodDies);

  const randomizeCapturedBits = useCallback(() => {
    setCapturedBits(Array.from({ length: 8 }, () => Math.random() > 0.5));
  }, []);

  const jtagInstructions: JtagInstr[] = ["SAMPLE", "PRELOAD", "EXTEST", "BYPASS"];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="bg-sky-500/20 rounded-xl border border-sky-500/30 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-sky-400" />
            <h1 className="text-3xl font-bold text-sky-400">Design for Test (DFT)</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Scan chain insertion, BIST architecture, ATPG fault coverage, JTAG boundary scan, and yield modeling
          </p>
        </div>

        {/* ── Section 1: Scan Chain Visualizer ──────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-sky-400" />
            <h2 className="text-xl font-semibold">Scan Chain Visualizer</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-5">
              {/* Sliders */}
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Flip-Flop Count</span>
                  <span className="font-mono text-sky-400">{flipFlopCount}</span>
                </label>
                <input
                  type="range"
                  min={10}
                  max={1000}
                  step={10}
                  value={flipFlopCount}
                  onChange={(e) => setFlipFlopCount(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Chain Count</span>
                  <span className="font-mono text-sky-400">{chainCount}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={chainCount}
                  onChange={(e) => setChainCount(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
              </div>

              {/* Scan Mode Toggle */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Scan Mode</p>
                <div className="flex gap-2">
                  {(["shift", "capture"] as ScanMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setScanMode(m)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        scanMode === m
                          ? "bg-sky-500 text-white"
                          : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">FFs per Chain</p>
                  <p className="font-mono text-sky-400 text-lg font-bold">{ffsPerChain}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Shift Cycles</p>
                  <p className="font-mono text-sky-400 text-lg font-bold">{scanShiftCycles}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Time/Pattern</p>
                  <p className="font-mono text-sky-400 text-sm font-bold">{formatSci(testTimePerPattern)} s</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Mux Overhead</p>
                  <p className="font-mono text-sky-400 text-lg font-bold">{scanMuxOverhead}%</p>
                </div>
              </div>

              <FormulaCard
                label="Scan Test Time"
                formula="T_test = (N_FF/N_chains + overhead) × t_clk"
                explanation="Shift register depth determines minimum test cycles at clock frequency"
              />
            </div>

            <div>
              <ScanChainSVG
                chainCount={chainCount}
                ffsPerChain={ffsPerChain}
                scanMode={scanMode}
                tick={tick}
              />
            </div>
          </div>
        </div>

        {/* ── Section 2: BIST Architecture ──────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-green-400" />
            <h2 className="text-xl font-semibold">Built-In Self Test (BIST) Architecture</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-5">
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">LFSR Width (bits)</span>
                  <span className="font-mono text-green-400">{lfsrBits}</span>
                </label>
                <input
                  type="range"
                  min={8}
                  max={32}
                  step={4}
                  value={lfsrBits}
                  onChange={(e) => setLfsrBits(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">MISR Width (bits)</span>
                  <span className="font-mono text-green-400">{misrBits}</span>
                </label>
                <input
                  type="range"
                  min={8}
                  max={32}
                  step={4}
                  value={misrBits}
                  onChange={(e) => setMisrBits(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">BIST Cycles</span>
                  <span className="font-mono text-green-400">{bistCycles.toLocaleString()}</span>
                </label>
                <input
                  type="range"
                  min={100}
                  max={100000}
                  step={100}
                  value={bistCycles}
                  onChange={(e) => setBistCycles(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">LFSR Period</p>
                  <p className="font-mono text-green-400 text-sm font-bold">2^{lfsrPeriodExp} − 1</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Pattern Coverage</p>
                  <p className="font-mono text-green-400 text-sm font-bold">
                    {(bistPatternCoverage * 100).toFixed(2)}%
                  </p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Alias Prob.</p>
                  <p className="font-mono text-green-400 text-sm font-bold">2^−{misrBits}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">HW Overhead</p>
                  <p className="font-mono text-green-400 text-sm font-bold">~{bistHwOverhead} gates</p>
                </div>
              </div>

              {/* Coverage animated bar */}
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Pattern Coverage</span>
                  <span>{(bistPatternCoverage * 100).toFixed(1)}%</span>
                </div>
                <div className="h-3 bg-muted/20 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-green-500 rounded-full"
                    animate={{ width: `${bistPatternCoverage * 100}%` }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  />
                </div>
              </div>

              <FormulaCard
                label="MISR Aliasing"
                formula="P_alias = 2^(−M)"
                explanation="Probability that a faulty circuit produces the same signature as a good one"
              />
            </div>

            <div>
              <BISTSVG lfsrBits={lfsrBits} misrBits={misrBits} />
            </div>
          </div>
        </div>

        {/* ── Section 3: ATPG Fault Coverage ────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-semibold">ATPG Fault Coverage</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-5">
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Total Faults</span>
                  <span className="font-mono text-amber-400">{totalFaults.toLocaleString()}</span>
                </label>
                <input
                  type="range"
                  min={100}
                  max={100000}
                  step={100}
                  value={totalFaults}
                  onChange={(e) => setTotalFaults(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">ATPG Iterations</span>
                  <span className="font-mono text-amber-400">{atpgIterations}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={atpgIterations}
                  onChange={(e) => setAtpgIterations(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Redundant Fault %</span>
                  <span className="font-mono text-amber-400">{redundantFaultPct}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={1}
                  value={redundantFaultPct}
                  onChange={(e) => setRedundantFaultPct(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Detectable</p>
                  <p className="font-mono text-amber-400 text-lg font-bold">
                    {detectableFaults.toFixed(0)}
                  </p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">ATPG Patterns</p>
                  <p className="font-mono text-amber-400 text-lg font-bold">{atpgPatterns}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Test Time</p>
                  <p className="font-mono text-amber-400 text-sm font-bold">{formatSci(atpgTestTime)} s</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Final FC</p>
                  <p className="font-mono text-amber-400 text-lg font-bold">{finalFaultCoverage.toFixed(1)}%</p>
                </div>
              </div>

              {/* Fault coverage bar */}
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Fault Coverage</span>
                  <span>{finalFaultCoverage.toFixed(1)}%</span>
                </div>
                <div className="h-3 bg-muted/20 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background:
                        finalFaultCoverage >= 99
                          ? "#22c55e"
                          : finalFaultCoverage >= 95
                          ? "#f59e0b"
                          : "#ef4444",
                    }}
                    animate={{ width: `${clamp(finalFaultCoverage, 0, 100)}%` }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  />
                </div>
              </div>

              {/* Status badge */}
              {finalFaultCoverage >= 99 ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-500/40 bg-green-500/10">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-400">Excellent coverage ≥ 99%</span>
                </div>
              ) : finalFaultCoverage < 95 ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400">Low coverage &lt; 95% — increase iterations</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10">
                  <Info className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-amber-400">Acceptable coverage 95–98%</span>
                </div>
              )}

              <FormulaCard
                label="ATPG Fault Coverage"
                formula="FC = N_detected / (N_total − N_redundant) × 100%"
                explanation="Fraction of detectable stuck-at faults covered by generated test patterns"
              />
            </div>

            <div>
              <ATPGFaultSVG
                totalFaults={totalFaults}
                detectableFaults={detectableFaults}
                detectedFaults={detectedFaults}
                redundantFaults={redundantFaults}
                atpgIterations={atpgIterations}
              />
            </div>
          </div>
        </div>

        {/* ── Section 4: JTAG Boundary Scan ─────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold">JTAG Boundary Scan</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-5">
              {/* Instruction register */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Instruction Register</p>
                <div className="grid grid-cols-2 gap-2">
                  {jtagInstructions.map((instr) => (
                    <button
                      key={instr}
                      onClick={() => setInstrReg(instr)}
                      className={`px-3 py-2 rounded-lg text-sm font-mono font-medium transition-colors ${
                        instrReg === instr
                          ? "bg-purple-500 text-white"
                          : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {instr}
                    </button>
                  ))}
                </div>
              </div>

              {/* Captured bits */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Captured Bits (BSR)</p>
                  <button
                    onClick={randomizeCapturedBits}
                    className="text-xs px-2 py-1 rounded bg-muted/30 hover:bg-muted/50 text-muted-foreground transition-colors"
                  >
                    Randomize
                  </button>
                </div>
                <div className="flex gap-1">
                  {capturedBits.map((bit, i) => (
                    <button
                      key={i}
                      onClick={() =>
                        setCapturedBits((prev) => {
                          const next = [...prev];
                          next[i] = !next[i];
                          return next;
                        })
                      }
                      className={`flex-1 py-2 rounded text-xs font-mono font-bold transition-colors ${
                        bit
                          ? "bg-sky-500/30 text-sky-300 border border-sky-500/50"
                          : "bg-muted/20 text-muted-foreground border border-border"
                      }`}
                    >
                      {bit ? "1" : "0"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Click bits to toggle</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Shift Reg Length</p>
                  <p className="font-mono text-purple-400 text-lg font-bold">{shiftRegLength} bit{shiftRegLength > 1 ? "s" : ""}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Pin Coverage</p>
                  <p className="font-mono text-purple-400 text-lg font-bold">{jtagPinCoverage}%</p>
                </div>
              </div>

              {/* Instruction description */}
              <div className="bg-muted/20 rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">{instrReg} Description</p>
                <p className="text-sm text-foreground">
                  {instrReg === "SAMPLE" && "Capture current pin values non-intrusively without affecting circuit operation."}
                  {instrReg === "PRELOAD" && "Load test data into BSR cells before switching to EXTEST mode."}
                  {instrReg === "EXTEST" && "Drive BSR contents onto chip pins to test board interconnects."}
                  {instrReg === "BYPASS" && "Single-bit bypass register — 1 cycle shift instead of 8. Fast scan-through."}
                </p>
              </div>

              <FormulaCard
                label="JTAG TAP"
                formula="TAP: TDI → IR/DR → TDO"
                explanation="Test Access Port state machine — 16 states controlled by TMS signal"
              />
            </div>

            <div>
              <JTAGBoundaryScanSVG
                instrReg={instrReg}
                capturedBits={capturedBits}
                tick={tick}
              />
            </div>
          </div>
        </div>

        {/* ── Section 5: Yield & Defect Density ─────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-5 h-5 text-rose-400" />
            <h2 className="text-xl font-semibold">Yield & Defect Density</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-5">
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Die Area (mm²)</span>
                  <span className="font-mono text-rose-400">{dieAreaMm2} mm²</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={600}
                  step={5}
                  value={dieAreaMm2}
                  onChange={(e) => setDieAreaMm2(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Defect Density (def/cm²)</span>
                  <span className="font-mono text-rose-400">{defectDensity.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min={0.01}
                  max={5.0}
                  step={0.01}
                  value={defectDensity}
                  onChange={(e) => setDefectDensity(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Critical Layers</span>
                  <span className="font-mono text-rose-400">{criticalLayers}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={15}
                  step={1}
                  value={criticalLayers}
                  onChange={(e) => setCriticalLayers(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Yield (NB model)</p>
                  <p className="font-mono text-rose-400 text-lg font-bold">{(yieldNB * 100).toFixed(1)}%</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Yield (Poisson)</p>
                  <p className="font-mono text-rose-400 text-lg font-bold">{(yieldPoisson * 100).toFixed(1)}%</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Good Dies/Wafer</p>
                  <p className="font-mono text-rose-400 text-lg font-bold">{goodDies}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Cost/Good Die</p>
                  <p className="font-mono text-rose-400 text-lg font-bold">${costPerGoodDie.toFixed(2)}</p>
                </div>
              </div>

              {/* Yield bar */}
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Wafer Yield</span>
                  <span>{(yieldNB * 100).toFixed(1)}%</span>
                </div>
                <div className="h-3 bg-muted/20 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{
                      background:
                        yieldNB >= 0.9
                          ? "#22c55e"
                          : yieldNB >= 0.5
                          ? "#f59e0b"
                          : "#ef4444",
                    }}
                    animate={{ width: `${yieldNB * 100}%` }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  />
                </div>
              </div>

              {/* Derived params display */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-muted/20 rounded p-2">
                  <p className="text-muted-foreground">D₀</p>
                  <p className="font-mono text-foreground">{D0.toFixed(3)}</p>
                </div>
                <div className="bg-muted/20 rounded p-2">
                  <p className="text-muted-foreground">α</p>
                  <p className="font-mono text-foreground">{alpha.toFixed(1)}</p>
                </div>
                <div className="bg-muted/20 rounded p-2">
                  <p className="text-muted-foreground">Dies/Wafer</p>
                  <p className="font-mono text-foreground">{diesPerWafer}</p>
                </div>
              </div>

              {/* Status badge */}
              {yieldNB >= 0.9 ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-500/40 bg-green-500/10">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-400">High yield ≥ 90% — production ready</span>
                </div>
              ) : yieldNB < 0.5 ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400">Low yield &lt; 50% — process optimization needed</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/40 bg-amber-500/10">
                  <Info className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-amber-400">Moderate yield 50–89%</span>
                </div>
              )}

              <FormulaCard
                label="Negative Binomial Yield"
                formula="Y = (1 + D₀/α)^(−α)"
                explanation="D₀ = defect density × die area; α = clustering parameter (0.5 × critical layers)"
              />
            </div>

            <div>
              <YieldWaferSVG
                yield_frac={yieldNB}
                diesPerWafer={diesPerWafer}
                goodDies={goodDies}
                defectDensity={defectDensity}
              />
            </div>
          </div>
        </div>

        {/* ── Bottom Formula Reference Card ─────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-sky-400" />
            <h2 className="text-xl font-semibold">DFT Formula Reference</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FormulaCard
              label="Scan Test Time"
              formula="T_test = (N_FF/N_chains)·t_clk"
              explanation="Shift register depth sets minimum test application time at 1/t_clk frequency"
            />
            <FormulaCard
              label="ATPG Coverage"
              formula="FC = N_det/(N_total−N_redund) × 100%"
              explanation="Percentage of detectable stuck-at faults covered by ATPG-generated patterns"
            />
            <FormulaCard
              label="MISR Aliasing"
              formula="P_alias = 2^(−M)"
              explanation="Probability of a fault escaping BIST detection due to MISR signature collision"
            />
            <FormulaCard
              label="Yield Model"
              formula="Y = (1 + D₀/α)^(−α)"
              explanation="Negative binomial model accounts for spatial clustering of defects on wafer"
            />
          </div>
        </div>

      </div>
    </main>
  );
}
