"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Network,
  Cpu,
  Activity,
  Zap,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Clock,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ─── Formula Card ─────────────────────────────────────────────────────────────

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

// ─── Section 1: Mesh Topology SVG ────────────────────────────────────────────

function MeshTopologySVG({
  meshRows,
  meshCols,
}: {
  meshRows: number;
  meshCols: number;
}) {
  const W = 400;
  const H = 200;
  const padX = 36;
  const padY = 28;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const spacingX = meshCols > 1 ? innerW / (meshCols - 1) : 0;
  const spacingY = meshRows > 1 ? innerH / (meshRows - 1) : 0;

  const cx = (col: number) =>
    meshCols === 1 ? W / 2 : padX + col * spacingX;
  const cy = (row: number) =>
    meshRows === 1 ? H / 2 : padY + row * spacingY;

  // bisection cut x position
  const bisectX = W / 2;

  // link intensity: distance from center (normalized)
  const maxDist = Math.sqrt(
    ((meshCols - 1) / 2) ** 2 + ((meshRows - 1) / 2) ** 2
  ) || 1;
  const linkOpacity = (r1: number, c1: number, r2: number, c2: number) => {
    const midR = (r1 + r2) / 2 - (meshRows - 1) / 2;
    const midC = (c1 + c2) / 2 - (meshCols - 1) / 2;
    const dist = Math.sqrt(midR ** 2 + midC ** 2);
    return 0.35 + 0.55 * (1 - dist / maxDist);
  };

  const cornerNodes = [
    { r: 0, c: 0, label: "N0,0" },
    { r: 0, c: meshCols - 1, label: `N0,${meshCols - 1}` },
    { r: meshRows - 1, c: 0, label: `N${meshRows - 1},0` },
    { r: meshRows - 1, c: meshCols - 1, label: `N${meshRows - 1},${meshCols - 1}` },
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 210 }}>
      <defs>
        <radialGradient id="nodeCyan" cx="50%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#0891b2" />
        </radialGradient>
      </defs>

      {/* Bisection cut */}
      <line
        x1={bisectX}
        y1={padY - 10}
        x2={bisectX}
        y2={H - padY + 10}
        stroke="#ef4444"
        strokeWidth={1.5}
        strokeDasharray="5,4"
        opacity={0.7}
      />
      <text x={bisectX + 4} y={padY - 2} fontSize={7} fill="#ef4444" fontFamily="monospace">
        bisection
      </text>

      {/* Horizontal links */}
      {Array.from({ length: meshRows }).map((_, r) =>
        Array.from({ length: meshCols - 1 }).map((_, c) => (
          <line
            key={`h-${r}-${c}`}
            x1={cx(c)}
            y1={cy(r)}
            x2={cx(c + 1)}
            y2={cy(r)}
            stroke="#22d3ee"
            strokeWidth={1.5}
            opacity={linkOpacity(r, c, r, c + 1)}
          />
        ))
      )}

      {/* Vertical links */}
      {Array.from({ length: meshRows - 1 }).map((_, r) =>
        Array.from({ length: meshCols }).map((_, c) => (
          <line
            key={`v-${r}-${c}`}
            x1={cx(c)}
            y1={cy(r)}
            x2={cx(c)}
            y2={cy(r + 1)}
            stroke="#22d3ee"
            strokeWidth={1.5}
            opacity={linkOpacity(r, c, r + 1, c)}
          />
        ))
      )}

      {/* Nodes */}
      {Array.from({ length: meshRows }).map((_, r) =>
        Array.from({ length: meshCols }).map((_, c) => (
          <circle
            key={`node-${r}-${c}`}
            cx={cx(c)}
            cy={cy(r)}
            r={meshRows <= 4 && meshCols <= 4 ? 7 : 5}
            fill="url(#nodeCyan)"
            stroke="#0e7490"
            strokeWidth={1}
          />
        ))
      )}

      {/* Corner labels */}
      {cornerNodes.map(({ r, c, label }) => {
        const nx = cx(c);
        const ny = cy(r);
        const dx = c === 0 ? -2 : 2;
        const dy = r === 0 ? -10 : 10;
        return (
          <text
            key={label}
            x={nx + dx}
            y={ny + dy}
            textAnchor={c === 0 ? "end" : "start"}
            fontSize={7}
            fill="#67e8f9"
            fontFamily="monospace"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Section 2: Latency vs Load SVG ──────────────────────────────────────────

function LatencyLoadSVG({
  baseLatency,
  operatingLoad,
  routerPipelineStages,
  routingOverhead,
}: {
  baseLatency: number;
  operatingLoad: number;
  routerPipelineStages: number;
  routingOverhead: number;
}) {
  const W = 400;
  const H = 160;
  const padL = 44;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const loads = Array.from({ length: 20 }, (_, i) => (i / 19) * 95);
  const latencies = loads.map((ld) => {
    const cf = 1 / (1 - (ld / 100) * 0.9);
    return (baseLatency + routingOverhead) * cf;
  });

  const maxLat = Math.max(...latencies, baseLatency * 4);
  const toX = (ld: number) => padL + (ld / 95) * plotW;
  const toY = (lat: number) => padT + plotH - (lat / maxLat) * plotH;

  const polyline = loads
    .map((ld, i) => `${toX(ld)},${toY(latencies[i])}`)
    .join(" ");

  // Current operating point
  const opCF = 1 / (1 - (operatingLoad / 100) * 0.9);
  const opLat = (baseLatency + routingOverhead) * opCF;
  const opX = toX(Math.min(operatingLoad, 95));
  const opY = toY(Math.min(opLat, maxLat));

  const idealY = toY(baseLatency);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 170 }}>
      {/* Axes */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#475569" strokeWidth={1} />
      <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#475569" strokeWidth={1} />

      {/* Y-axis ticks */}
      {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
        const yv = padT + plotH - frac * plotH;
        const val = Math.round(maxLat * frac);
        return (
          <g key={frac}>
            <line x1={padL - 3} y1={yv} x2={padL} y2={yv} stroke="#475569" strokeWidth={1} />
            <text x={padL - 5} y={yv + 3} textAnchor="end" fontSize={7} fill="#64748b" fontFamily="monospace">
              {val}
            </text>
          </g>
        );
      })}

      {/* X-axis label */}
      <text x={padL + plotW / 2} y={H - 2} textAnchor="middle" fontSize={8} fill="#64748b">
        Network Load (%)
      </text>
      <text
        x={8}
        y={padT + plotH / 2}
        textAnchor="middle"
        fontSize={8}
        fill="#64748b"
        transform={`rotate(-90, 8, ${padT + plotH / 2})`}
      >
        Latency (cyc)
      </text>

      {/* Ideal flat line */}
      <line
        x1={padL}
        y1={idealY}
        x2={padL + plotW}
        y2={idealY}
        stroke="#22d3ee"
        strokeWidth={1}
        strokeDasharray="4,3"
        opacity={0.5}
      />
      <text x={padL + plotW - 2} y={idealY - 3} textAnchor="end" fontSize={7} fill="#22d3ee" opacity={0.7}>
        ideal
      </text>

      {/* Saturation line at ~90% load */}
      <line
        x1={toX(90)}
        y1={padT}
        x2={toX(90)}
        y2={padT + plotH}
        stroke="#ef4444"
        strokeWidth={1.5}
        strokeDasharray="4,3"
        opacity={0.7}
      />
      <text x={toX(90) + 3} y={padT + 10} fontSize={7} fill="#ef4444" fontFamily="monospace">
        sat.
      </text>

      {/* Latency curve */}
      <polyline
        points={polyline}
        fill="none"
        stroke="#22d3ee"
        strokeWidth={2}
      />

      {/* Operating point dot */}
      <circle cx={opX} cy={opY} r={5} fill="#f59e0b" stroke="#fff" strokeWidth={1.5} />
      <text x={opX + 7} y={opY + 4} fontSize={8} fill="#f59e0b" fontFamily="monospace">
        op
      </text>
    </svg>
  );
}

// ─── Section 3: Deadlock Bar Chart SVG ───────────────────────────────────────

function DeadlockBarSVG({
  deadlockProbability,
  livelock,
  bufferUtilization,
  creditStalls,
}: {
  deadlockProbability: number;
  livelock: number;
  bufferUtilization: number;
  creditStalls: number;
}) {
  const W = 400;
  const H = 160;
  const padL = 60;
  const padR = 20;
  const padT = 16;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const bars = [
    { label: "Deadlock", value: deadlockProbability * 100, color: "#ef4444", max: 100 },
    { label: "Livelock", value: livelock * 100, color: "#f97316", max: 100 },
    { label: "Buf Util", value: bufferUtilization, color: "#22d3ee", max: 100 },
    { label: "Cr Stalls", value: creditStalls, color: "#a78bfa", max: 100 },
  ];

  const barW = plotW / bars.length - 12;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 170 }}>
      {/* Axes */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#475569" strokeWidth={1} />
      <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#475569" strokeWidth={1} />

      {/* Y ticks */}
      {[0, 25, 50, 75, 100].map((pct) => {
        const yv = padT + plotH - (pct / 100) * plotH;
        return (
          <g key={pct}>
            <line x1={padL - 3} y1={yv} x2={padL} y2={yv} stroke="#475569" strokeWidth={1} />
            <text x={padL - 5} y={yv + 3} textAnchor="end" fontSize={7} fill="#64748b" fontFamily="monospace">
              {pct}%
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {bars.map((bar, i) => {
        const bx = padL + i * (barW + 12) + 6;
        const bh = (bar.value / 100) * plotH;
        const by = padT + plotH - bh;
        return (
          <g key={bar.label}>
            <rect
              x={bx}
              y={by}
              width={barW}
              height={bh}
              rx={2}
              fill={bar.color}
              opacity={0.8}
            />
            <text
              x={bx + barW / 2}
              y={padT + plotH + 12}
              textAnchor="middle"
              fontSize={7}
              fill="#94a3b8"
              fontFamily="monospace"
            >
              {bar.label}
            </text>
            <text
              x={bx + barW / 2}
              y={Math.max(by - 3, padT + 8)}
              textAnchor="middle"
              fontSize={7}
              fill={bar.color}
              fontFamily="monospace"
            >
              {bar.value < 1 ? bar.value.toFixed(3) : bar.value.toFixed(1)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Section 4: Power Stacked Bar SVG ────────────────────────────────────────

function PowerBarSVG({
  dynamicPower,
  leakagePower,
  nodeCount,
  operatingFreq,
  activityFactor,
  supplyVoltage,
}: {
  dynamicPower: number;
  leakagePower: number;
  nodeCount: number;
  operatingFreq: number;
  activityFactor: number;
  supplyVoltage: number;
}) {
  const W = 400;
  const H = 160;
  const padL = 52;
  const padR = 20;
  const padT = 16;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // 4 grouped bars at 25/50/75/100% of nodeCount
  const fracs = [0.25, 0.5, 0.75, 1.0];
  const barGroups = fracs.map((f) => {
    const n = Math.round(nodeCount * f);
    const dyn = activityFactor * n * supplyVoltage ** 2 * operatingFreq * 0.05;
    const leak = n * supplyVoltage * 0.01;
    return { n, dyn, leak, total: dyn + leak, frac: f };
  });

  const maxTotal = Math.max(...barGroups.map((g) => g.total), 1);
  const barW = plotW / barGroups.length - 14;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 170 }}>
      {/* Axes */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#475569" strokeWidth={1} />
      <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#475569" strokeWidth={1} />

      {/* Y ticks */}
      {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
        const yv = padT + plotH - frac * plotH;
        const val = (maxTotal * frac).toFixed(1);
        return (
          <g key={frac}>
            <line x1={padL - 3} y1={yv} x2={padL} y2={yv} stroke="#475569" strokeWidth={1} />
            <text x={padL - 5} y={yv + 3} textAnchor="end" fontSize={7} fill="#64748b" fontFamily="monospace">
              {val}
            </text>
          </g>
        );
      })}

      {/* Y axis label */}
      <text
        x={10}
        y={padT + plotH / 2}
        textAnchor="middle"
        fontSize={8}
        fill="#64748b"
        transform={`rotate(-90, 10, ${padT + plotH / 2})`}
      >
        Power (mW)
      </text>

      {/* Bars */}
      {barGroups.map((g, i) => {
        const bx = padL + i * (barW + 14) + 7;
        const totalH = (g.total / maxTotal) * plotH;
        const dynH = (g.dyn / maxTotal) * plotH;
        const leakH = (g.leak / maxTotal) * plotH;
        const totalY = padT + plotH - totalH;
        const isActive = g.frac === 1.0;

        return (
          <g key={i}>
            {/* Leakage (bottom) */}
            <rect
              x={bx}
              y={padT + plotH - leakH}
              width={barW}
              height={leakH}
              rx={2}
              fill="#a78bfa"
              opacity={0.8}
            />
            {/* Dynamic (on top) */}
            <rect
              x={bx}
              y={totalY}
              width={barW}
              height={dynH}
              rx={2}
              fill="#22d3ee"
              opacity={0.85}
            />
            {/* Cyan outline for current nodeCount */}
            {isActive && (
              <rect
                x={bx - 2}
                y={totalY - 2}
                width={barW + 4}
                height={totalH + 4}
                rx={3}
                fill="none"
                stroke="#22d3ee"
                strokeWidth={2}
              />
            )}
            <text
              x={bx + barW / 2}
              y={padT + plotH + 12}
              textAnchor="middle"
              fontSize={7}
              fill={isActive ? "#22d3ee" : "#64748b"}
              fontFamily="monospace"
            >
              {g.n}n
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <rect x={padL + 4} y={padT + 2} width={8} height={6} rx={1} fill="#22d3ee" opacity={0.85} />
      <text x={padL + 15} y={padT + 8} fontSize={7} fill="#22d3ee" fontFamily="monospace">Dynamic</text>
      <rect x={padL + 60} y={padT + 2} width={8} height={6} rx={1} fill="#a78bfa" opacity={0.8} />
      <text x={padL + 71} y={padT + 8} fontSize={7} fill="#a78bfa" fontFamily="monospace">Leakage</text>
    </svg>
  );
}

// ─── Section 5: Torus vs Mesh Bar SVG ────────────────────────────────────────

function TorusMeshSVG({
  meshLatency,
  torusLatency,
  meshBisection,
  torusBisection,
}: {
  meshLatency: number;
  torusLatency: number;
  meshBisection: number;
  torusBisection: number;
}) {
  const W = 400;
  const H = 160;
  const padL = 52;
  const padR = 20;
  const padT = 16;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Two groups: Latency and Bisection BW
  const maxLat = Math.max(meshLatency, torusLatency, 1);
  const maxBW = Math.max(meshBisection, torusBisection, 1);

  const groupW = plotW / 2 - 10;
  const barW = groupW / 2 - 4;

  const groups = [
    {
      label: "Latency (cyc)",
      x: padL + 5,
      meshVal: meshLatency,
      torusVal: torusLatency,
      max: maxLat,
      unit: "cyc",
    },
    {
      label: "Bisection BW",
      x: padL + plotW / 2 + 5,
      meshVal: meshBisection,
      torusVal: torusBisection,
      max: maxBW,
      unit: "lk",
    },
  ];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 170 }}>
      {/* Axes */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#475569" strokeWidth={1} />
      <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#475569" strokeWidth={1} />

      {/* Divider */}
      <line
        x1={padL + plotW / 2}
        y1={padT}
        x2={padL + plotW / 2}
        y2={padT + plotH}
        stroke="#1e293b"
        strokeWidth={1}
        strokeDasharray="3,3"
      />

      {/* Groups */}
      {groups.map((g) => {
        const meshH = (g.meshVal / g.max) * plotH;
        const torusH = (g.torusVal / g.max) * plotH;
        const meshX = g.x;
        const torusX = g.x + barW + 4;

        return (
          <g key={g.label}>
            {/* Mesh bar (amber) */}
            <rect
              x={meshX}
              y={padT + plotH - meshH}
              width={barW}
              height={meshH}
              rx={2}
              fill="#f59e0b"
              opacity={0.8}
            />
            <text
              x={meshX + barW / 2}
              y={padT + plotH - meshH - 3}
              textAnchor="middle"
              fontSize={7}
              fill="#f59e0b"
              fontFamily="monospace"
            >
              {g.meshVal.toFixed(1)}
            </text>

            {/* Torus bar (cyan) */}
            <rect
              x={torusX}
              y={padT + plotH - torusH}
              width={barW}
              height={torusH}
              rx={2}
              fill="#22d3ee"
              opacity={0.8}
            />
            <text
              x={torusX + barW / 2}
              y={padT + plotH - torusH - 3}
              textAnchor="middle"
              fontSize={7}
              fill="#22d3ee"
              fontFamily="monospace"
            >
              {g.torusVal.toFixed(1)}
            </text>

            {/* Group label */}
            <text
              x={g.x + groupW / 2 - 4}
              y={padT + plotH + 13}
              textAnchor="middle"
              fontSize={7}
              fill="#94a3b8"
              fontFamily="monospace"
            >
              {g.label}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <rect x={padL + 4} y={padT + 2} width={8} height={6} rx={1} fill="#f59e0b" opacity={0.8} />
      <text x={padL + 15} y={padT + 8} fontSize={7} fill="#f59e0b" fontFamily="monospace">Mesh</text>
      <rect x={padL + 50} y={padT + 2} width={8} height={6} rx={1} fill="#22d3ee" opacity={0.8} />
      <text x={padL + 61} y={padT + 8} fontSize={7} fill="#22d3ee" fontFamily="monospace">Torus</text>
    </svg>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function NetworkOnChipPage() {
  // Section 1: Mesh Topology
  const [meshRows, setMeshRows] = useState(4);
  const [meshCols, setMeshCols] = useState(4);
  const [flitSize, setFlitSize] = useState(64);
  const [linkBandwidth, setLinkBandwidth] = useState(16);

  // Section 2: Flit Routing
  const [packetSize, setPacketSize] = useState(4);
  const [networkLoad, setNetworkLoad] = useState(50);
  const [routerPipelineStages, setRouterPipelineStages] = useState(3);
  const [virtualChannels, setVirtualChannels] = useState(2);
  const [routingAlgorithm, setRoutingAlgorithm] = useState<"XY" | "Adaptive" | "Minimal">("XY");

  // Section 3: Deadlock Analysis
  const [deadlockVCs, setDeadlockVCs] = useState(2);
  const [bufferDepth, setBufferDepth] = useState(8);
  const [trafficPattern, setTrafficPattern] = useState(0);
  const [creditBasedFlow, setCreditBasedFlow] = useState(true);

  // Section 4: NoC Power
  const [operatingFreq, setOperatingFreq] = useState(2.0);
  const [supplyVoltage, setSupplyVoltage] = useState(0.9);
  const [activityFactor, setActivityFactor] = useState(0.3);
  const [nodeCount, setNodeCount] = useState(16);

  // Section 5: Torus vs Mesh
  const [dimension, setDimension] = useState(4);
  const [linkLatency, setLinkLatency] = useState(4);
  const [injectionRate, setInjectionRate] = useState(40);
  const [wrapAroundLinks, setWrapAroundLinks] = useState(false);

  // ── Section 1 Derived ────────────────────────────────────────────────────────
  const mesh1 = useMemo(() => {
    const totalNodes = meshRows * meshCols;
    const totalLinks =
      meshRows * (meshCols - 1) + meshCols * (meshRows - 1);
    const avgHops = ((meshRows + meshCols) / 3) * 1.2;
    const bisectionBW = Math.min(meshRows, meshCols) * linkBandwidth;
    const diameter = meshRows - 1 + meshCols - 1;
    return { totalNodes, totalLinks, avgHops, bisectionBW, diameter };
  }, [meshRows, meshCols, linkBandwidth]);

  // ── Section 2 Derived ────────────────────────────────────────────────────────
  const flit2 = useMemo(() => {
    const linkBW_fixed = 16;
    const avgHops_val = 4;
    const serLatency = packetSize * 1;
    const baseLatency =
      avgHops_val * routerPipelineStages + serLatency;
    const congestionFactor =
      networkLoad >= 100
        ? 1000
        : 1 / (1 - (networkLoad / 100) * 0.9);
    const routingOverhead: Record<string, number> = {
      XY: 0,
      Adaptive: 2,
      Minimal: 1,
    };
    const overhead = routingOverhead[routingAlgorithm] ?? 0;
    const totalLatency = (baseLatency + overhead) * congestionFactor;
    const throughput =
      linkBW_fixed * virtualChannels * (1 - networkLoad / 100);
    return {
      baseLatency,
      congestionFactor,
      totalLatency,
      throughput,
      overhead,
    };
  }, [packetSize, networkLoad, routerPipelineStages, virtualChannels, routingAlgorithm]);

  // ── Section 3 Derived ────────────────────────────────────────────────────────
  const deadlock3 = useMemo(() => {
    const patternNames = ["Uniform", "Hotspot", "Tornado", "Transpose"];
    const trafficSkew = [1.0, 2.5, 1.8, 1.5][trafficPattern];
    let deadlockProbability: number;
    if (deadlockVCs >= 2) {
      deadlockProbability = 0.001 / deadlockVCs;
    } else {
      deadlockProbability = (0.1 * trafficSkew) / bufferDepth;
    }
    deadlockProbability *= creditBasedFlow ? 0.1 : 1.0;
    deadlockProbability = clamp(deadlockProbability, 0, 1);
    const livelock = deadlockProbability * 0.3;
    const bufferUtilization = clamp(
      (trafficSkew * 60) / deadlockVCs,
      0,
      99
    );
    const creditStalls = creditBasedFlow
      ? bufferUtilization * 0.05
      : bufferUtilization * 0.2;
    return {
      patternNames,
      trafficSkew,
      deadlockProbability,
      livelock,
      bufferUtilization,
      creditStalls,
    };
  }, [deadlockVCs, bufferDepth, trafficPattern, creditBasedFlow]);

  // ── Section 4 Derived ────────────────────────────────────────────────────────
  const power4 = useMemo(() => {
    const dynamicPower =
      activityFactor *
      nodeCount *
      supplyVoltage ** 2 *
      operatingFreq *
      0.05;
    const leakagePower = nodeCount * supplyVoltage * 0.01;
    const totalPower = dynamicPower + leakagePower;
    const powerEfficiency = (nodeCount * operatingFreq) / totalPower;
    const thermalDensity = totalPower / (nodeCount * 0.01);
    return {
      dynamicPower,
      leakagePower,
      totalPower,
      powerEfficiency,
      thermalDensity,
    };
  }, [operatingFreq, supplyVoltage, activityFactor, nodeCount]);

  // ── Section 5 Derived ────────────────────────────────────────────────────────
  const torus5 = useMemo(() => {
    const meshDiameter = 2 * (dimension - 1);
    const meshAvgHops = (2 * (dimension - 1)) / 3;
    const meshBisection = dimension;
    const torusDiameter = dimension;
    const torusAvgHops = dimension / 2;
    const torusBisection = 2 * dimension;
    const meshLatency =
      meshAvgHops * linkLatency * (1 + injectionRate / 100);
    const torusLatency =
      torusAvgHops * linkLatency * (1 + (injectionRate / 100) * 0.7);
    const torusWireOverhead = dimension * dimension * 0.3;
    const recommendation =
      wrapAroundLinks && dimension >= 4 ? "TORUS" : "MESH";
    return {
      meshDiameter,
      meshAvgHops,
      meshBisection,
      torusDiameter,
      torusAvgHops,
      torusBisection,
      meshLatency,
      torusLatency,
      torusWireOverhead,
      recommendation,
    };
  }, [dimension, linkLatency, injectionRate, wrapAroundLinks]);

  // Deadlock status badge
  const deadlockStatus =
    deadlock3.deadlockProbability < 0.01
      ? "DEADLOCK FREE"
      : deadlock3.deadlockProbability < 0.05
      ? "RISK"
      : "DEADLOCK";
  const deadlockBadgeColor =
    deadlockStatus === "DEADLOCK FREE"
      ? "bg-green-500/20 text-green-400 border-green-500/30"
      : deadlockStatus === "RISK"
      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
      : "bg-red-500/20 text-red-400 border-red-500/30";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-cyan-500/20 rounded-xl border border-cyan-500/30 p-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <Network className="w-8 h-8 text-cyan-400" />
            <h1 className="text-3xl font-bold text-cyan-400">Network-on-Chip (NoC)</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Mesh topology analysis, flit routing latency, deadlock detection, power modeling, and torus vs. mesh comparison
          </p>
        </motion.div>

        {/* ── Section 1: Mesh Topology Analyzer ────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-semibold">Mesh Topology Analyzer</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-5">
              {/* Sliders */}
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Mesh Rows</span>
                  <span className="font-mono text-cyan-400">{meshRows}</span>
                </label>
                <input
                  type="range"
                  min={2}
                  max={8}
                  step={1}
                  value={meshRows}
                  onChange={(e) => setMeshRows(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Mesh Cols</span>
                  <span className="font-mono text-cyan-400">{meshCols}</span>
                </label>
                <input
                  type="range"
                  min={2}
                  max={8}
                  step={1}
                  value={meshCols}
                  onChange={(e) => setMeshCols(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Flit Size (bits)</span>
                  <span className="font-mono text-cyan-400">{flitSize}</span>
                </label>
                <input
                  type="range"
                  min={16}
                  max={256}
                  step={16}
                  value={flitSize}
                  onChange={(e) => setFlitSize(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Link Bandwidth (Gbps)</span>
                  <span className="font-mono text-cyan-400">{linkBandwidth}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={64}
                  step={1}
                  value={linkBandwidth}
                  onChange={(e) => setLinkBandwidth(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>

              {/* Metric cards */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Total Nodes</p>
                  <p className="font-mono text-cyan-400 text-lg font-bold">{mesh1.totalNodes}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Total Links</p>
                  <p className="font-mono text-cyan-400 text-lg font-bold">{mesh1.totalLinks}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Diameter</p>
                  <p className="font-mono text-cyan-400 text-lg font-bold">{mesh1.diameter}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Bisection BW</p>
                  <p className="font-mono text-cyan-400 text-sm font-bold">{mesh1.bisectionBW} Gbps</p>
                </div>
              </div>
            </div>

            <div>
              <MeshTopologySVG meshRows={meshRows} meshCols={meshCols} />
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-center">
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-muted-foreground">Avg Hops</span>
                  <p className="font-mono text-cyan-400">{mesh1.avgHops.toFixed(2)}</p>
                </div>
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-muted-foreground">Node Radix</span>
                  <p className="font-mono text-cyan-400">4</p>
                </div>
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-muted-foreground">Flit</span>
                  <p className="font-mono text-cyan-400">{flitSize}b</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 2: Flit Routing & Latency ────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <ArrowRight className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-semibold">Flit Routing &amp; Latency</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-5">
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Packet Size (flits)</span>
                  <span className="font-mono text-cyan-400">{packetSize}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={16}
                  step={1}
                  value={packetSize}
                  onChange={(e) => setPacketSize(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Network Load (%)</span>
                  <span className="font-mono text-cyan-400">{networkLoad}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={networkLoad}
                  onChange={(e) => setNetworkLoad(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Router Pipeline Stages</span>
                  <span className="font-mono text-cyan-400">{routerPipelineStages}</span>
                </label>
                <input
                  type="range"
                  min={2}
                  max={5}
                  step={1}
                  value={routerPipelineStages}
                  onChange={(e) => setRouterPipelineStages(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Virtual Channels</span>
                  <span className="font-mono text-cyan-400">{virtualChannels}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={1}
                  value={virtualChannels}
                  onChange={(e) => setVirtualChannels(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>

              {/* Routing algorithm dropdown */}
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Routing Algorithm</label>
                <select
                  value={routingAlgorithm}
                  onChange={(e) => setRoutingAlgorithm(e.target.value as "XY" | "Adaptive" | "Minimal")}
                  className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                >
                  <option value="XY">XY (Deterministic)</option>
                  <option value="Adaptive">Adaptive</option>
                  <option value="Minimal">Minimal</option>
                </select>
              </div>

              {/* Metric cards */}
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Base Latency</p>
                  <p className="font-mono text-cyan-400 font-bold">{flit2.baseLatency} cyc</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Congestion</p>
                  <p className="font-mono text-cyan-400 font-bold">{flit2.congestionFactor.toFixed(2)}×</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Throughput</p>
                  <p className="font-mono text-cyan-400 font-bold">{flit2.throughput.toFixed(1)} G</p>
                </div>
              </div>
              <div className="bg-muted/20 rounded-lg p-3">
                <p className="text-muted-foreground text-xs mb-1">Total Latency</p>
                <p className="font-mono text-cyan-400 text-xl font-bold">{flit2.totalLatency.toFixed(1)} cycles</p>
              </div>
            </div>

            <div>
              <LatencyLoadSVG
                baseLatency={flit2.baseLatency}
                operatingLoad={networkLoad}
                routerPipelineStages={routerPipelineStages}
                routingOverhead={flit2.overhead}
              />
            </div>
          </div>
        </div>

        {/* ── Section 3: Deadlock Analysis ──────────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-semibold">Deadlock Analysis (Wormhole Routing)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-5">
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Virtual Channels</span>
                  <span className="font-mono text-cyan-400">{deadlockVCs}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={1}
                  value={deadlockVCs}
                  onChange={(e) => setDeadlockVCs(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Buffer Depth (flits)</span>
                  <span className="font-mono text-cyan-400">{bufferDepth}</span>
                </label>
                <input
                  type="range"
                  min={2}
                  max={16}
                  step={1}
                  value={bufferDepth}
                  onChange={(e) => setBufferDepth(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">
                    Traffic Pattern:{" "}
                    <span className="text-cyan-400">
                      {deadlock3.patternNames[trafficPattern]}
                    </span>
                  </span>
                  <span className="font-mono text-cyan-400">{trafficPattern}</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={1}
                  value={trafficPattern}
                  onChange={(e) => setTrafficPattern(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  {deadlock3.patternNames.map((n) => (
                    <span key={n}>{n}</span>
                  ))}
                </div>
              </div>

              {/* Credit-based flow toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={creditBasedFlow}
                  onChange={(e) => setCreditBasedFlow(e.target.checked)}
                  className="w-4 h-4 accent-cyan-500"
                />
                <span className="text-sm">Credit-Based Flow Control</span>
              </label>

              {/* Status badge */}
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border font-semibold text-sm ${deadlockBadgeColor}`}
              >
                {deadlockStatus === "DEADLOCK FREE" ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                {deadlockStatus}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Deadlock Prob</p>
                  <p className="font-mono text-red-400 font-bold">
                    {(deadlock3.deadlockProbability * 100).toFixed(4)}%
                  </p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Buffer Util</p>
                  <p className="font-mono text-cyan-400 font-bold">
                    {deadlock3.bufferUtilization.toFixed(1)}%
                  </p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Livelock Prob</p>
                  <p className="font-mono text-amber-400 font-bold">
                    {(deadlock3.livelock * 100).toFixed(4)}%
                  </p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Credit Stalls</p>
                  <p className="font-mono text-purple-400 font-bold">
                    {deadlock3.creditStalls.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            <div>
              <DeadlockBarSVG
                deadlockProbability={deadlock3.deadlockProbability}
                livelock={deadlock3.livelock}
                bufferUtilization={deadlock3.bufferUtilization}
                creditStalls={deadlock3.creditStalls}
              />
            </div>
          </div>
        </div>

        {/* ── Section 4: NoC Power Model ────────────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-semibold">NoC Power Model</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-5">
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Operating Frequency (GHz)</span>
                  <span className="font-mono text-cyan-400">{operatingFreq.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={4.0}
                  step={0.1}
                  value={operatingFreq}
                  onChange={(e) => setOperatingFreq(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Supply Voltage (V)</span>
                  <span className="font-mono text-cyan-400">{supplyVoltage.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min={0.6}
                  max={1.2}
                  step={0.01}
                  value={supplyVoltage}
                  onChange={(e) => setSupplyVoltage(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Activity Factor</span>
                  <span className="font-mono text-cyan-400">{activityFactor.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min={0.01}
                  max={1.0}
                  step={0.01}
                  value={activityFactor}
                  onChange={(e) => setActivityFactor(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Node Count</span>
                  <span className="font-mono text-cyan-400">{nodeCount}</span>
                </label>
                <input
                  type="range"
                  min={4}
                  max={64}
                  step={4}
                  value={nodeCount}
                  onChange={(e) => setNodeCount(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>

              {/* Metric cards */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Dynamic Power</p>
                  <p className="font-mono text-cyan-400 font-bold">{power4.dynamicPower.toFixed(2)} mW</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Leakage Power</p>
                  <p className="font-mono text-purple-400 font-bold">{power4.leakagePower.toFixed(2)} mW</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Total Power</p>
                  <p className="font-mono text-amber-400 font-bold">{power4.totalPower.toFixed(2)} mW</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Power Efficiency</p>
                  <p className="font-mono text-green-400 font-bold">{power4.powerEfficiency.toFixed(1)} ops/mW</p>
                </div>
              </div>
              <div className="bg-muted/20 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground text-xs">Thermal Density</p>
                <p className="font-mono text-red-400 font-bold">{power4.thermalDensity.toFixed(1)} mW/mm²</p>
              </div>
            </div>

            <div>
              <PowerBarSVG
                dynamicPower={power4.dynamicPower}
                leakagePower={power4.leakagePower}
                nodeCount={nodeCount}
                operatingFreq={operatingFreq}
                activityFactor={activityFactor}
                supplyVoltage={supplyVoltage}
              />
            </div>
          </div>
        </div>

        {/* ── Section 5: Torus vs Mesh Comparison ───────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-semibold">Torus vs Mesh Comparison</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-5">
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Dimension (N×N)</span>
                  <span className="font-mono text-cyan-400">{dimension}×{dimension}</span>
                </label>
                <input
                  type="range"
                  min={2}
                  max={6}
                  step={1}
                  value={dimension}
                  onChange={(e) => setDimension(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Link Latency (cycles)</span>
                  <span className="font-mono text-cyan-400">{linkLatency}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={linkLatency}
                  onChange={(e) => setLinkLatency(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Injection Rate (%)</span>
                  <span className="font-mono text-cyan-400">{injectionRate}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={injectionRate}
                  onChange={(e) => setInjectionRate(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>

              {/* Torus toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={wrapAroundLinks}
                  onChange={(e) => setWrapAroundLinks(e.target.checked)}
                  className="w-4 h-4 accent-cyan-500"
                />
                <span className="text-sm">Wrap-Around Links (Torus)</span>
              </label>

              {/* Recommendation badge */}
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border font-semibold text-sm ${
                  torus5.recommendation === "TORUS"
                    ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                    : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                Recommended: {torus5.recommendation}
              </div>

              {/* Comparison stats */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-2">
                  <p className="font-semibold text-amber-400">Mesh ({dimension}×{dimension})</p>
                  <div className="bg-muted/20 rounded p-2">
                    <span className="text-muted-foreground">Diameter: </span>
                    <span className="font-mono text-amber-400">{torus5.meshDiameter}</span>
                  </div>
                  <div className="bg-muted/20 rounded p-2">
                    <span className="text-muted-foreground">Avg Hops: </span>
                    <span className="font-mono text-amber-400">{torus5.meshAvgHops.toFixed(2)}</span>
                  </div>
                  <div className="bg-muted/20 rounded p-2">
                    <span className="text-muted-foreground">Latency: </span>
                    <span className="font-mono text-amber-400">{torus5.meshLatency.toFixed(1)} cyc</span>
                  </div>
                  <div className="bg-muted/20 rounded p-2">
                    <span className="text-muted-foreground">Bisect BW: </span>
                    <span className="font-mono text-amber-400">{torus5.meshBisection} links</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="font-semibold text-cyan-400">Torus ({dimension}×{dimension})</p>
                  <div className="bg-muted/20 rounded p-2">
                    <span className="text-muted-foreground">Diameter: </span>
                    <span className="font-mono text-cyan-400">{torus5.torusDiameter}</span>
                  </div>
                  <div className="bg-muted/20 rounded p-2">
                    <span className="text-muted-foreground">Avg Hops: </span>
                    <span className="font-mono text-cyan-400">{torus5.torusAvgHops.toFixed(2)}</span>
                  </div>
                  <div className="bg-muted/20 rounded p-2">
                    <span className="text-muted-foreground">Latency: </span>
                    <span className="font-mono text-cyan-400">{torus5.torusLatency.toFixed(1)} cyc</span>
                  </div>
                  <div className="bg-muted/20 rounded p-2">
                    <span className="text-muted-foreground">Bisect BW: </span>
                    <span className="font-mono text-cyan-400">{torus5.torusBisection} links</span>
                  </div>
                </div>
              </div>
              <div className="bg-muted/20 rounded p-2 text-xs">
                <span className="text-muted-foreground">Torus wire overhead: </span>
                <span className="font-mono text-red-400">{torus5.torusWireOverhead.toFixed(1)} extra wires (~30%)</span>
              </div>
            </div>

            <div>
              <TorusMeshSVG
                meshLatency={torus5.meshLatency}
                torusLatency={torus5.torusLatency}
                meshBisection={torus5.meshBisection}
                torusBisection={torus5.torusBisection}
              />
            </div>
          </div>
        </div>

        {/* ── Formula Reference Cards ───────────────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-cyan-400" />
            <h2 className="text-xl font-semibold">Formula Reference</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <FormulaCard
              label="Mesh Diameter"
              formula="D = (kx−1) + (ky−1)"
              explanation="Avg hops ≈ 2(k−1)/3 for k×k mesh. Diameter sets worst-case latency."
            />
            <FormulaCard
              label="Wormhole Latency"
              formula="T = H·(t_r + S·t_w)"
              explanation="H=hops, t_r=router delay, S=flits, t_w=wire delay per flit."
            />
            <FormulaCard
              label="M/M/1 Queue"
              formula="T_wait = ρ/(μ(1−ρ))"
              explanation="ρ = λ/μ is injection/service ratio. Latency blows up as ρ → 1."
            />
            <FormulaCard
              label="Torus vs Mesh"
              formula="D_torus = D_mesh/2"
              explanation="Torus halves diameter and doubles bisection BW at ~30% more wires."
            />
          </div>
        </div>

      </div>
    </main>
  );
}
