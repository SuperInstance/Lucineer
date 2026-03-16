"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Cpu,
  Zap,
  BarChart2,
  TrendingUp,
  Activity,
  Layers,
  Database,
  CheckCircle,
} from "lucide-react";

// ─────────────────────────────────────────────
// SliderRow component
// ─────────────────────────────────────────────
function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  displayValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  displayValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-emerald-400 font-mono font-semibold">
          {displayValue ?? value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-500 h-2 rounded-lg cursor-pointer"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// StatCard component
// ─────────────────────────────────────────────
function StatCard({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-lg p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold uppercase">
        {icon}
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-white">{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Section 1: Systolic Array Sizing
// ─────────────────────────────────────────────
function SystolicArraySection() {
  const [rows, setRows] = useState(64);
  const [cols, setCols] = useState(64);
  const [freqMHz, setFreqMHz] = useState(1000);
  const [bitWidth, setBitWidth] = useState(16);

  const stats = useMemo(() => {
    const totalPEs = rows * cols;
    const peakTOPS = (totalPEs * 2 * freqMHz) / 1e6;
    const dieArea = totalPEs * 0.003;
    const power = totalPEs * freqMHz * bitWidth * 0.00001;
    return { totalPEs, peakTOPS, dieArea, power };
  }, [rows, cols, freqMHz, bitWidth]);

  const gridSize = Math.min(rows, 16);
  const gridSizeCols = Math.min(cols, 16);
  const cellSize = Math.floor(200 / Math.max(gridSize, gridSizeCols));
  const svgWidth = gridSizeCols * cellSize + 60;
  const svgHeight = gridSize * cellSize + 60;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-card border border-border rounded-xl p-6 flex flex-col gap-6"
    >
      <div className="flex items-center gap-2">
        <Cpu className="text-emerald-400" size={20} />
        <h2 className="text-lg font-bold">Systolic Array Sizing</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Controls */}
        <div className="flex flex-col gap-4">
          <SliderRow
            label="Array rows (PEs)"
            value={rows}
            min={4}
            max={256}
            step={4}
            onChange={setRows}
          />
          <SliderRow
            label="Array cols (PEs)"
            value={cols}
            min={4}
            max={256}
            step={4}
            onChange={setCols}
          />
          <SliderRow
            label="Clock frequency (MHz)"
            value={freqMHz}
            min={100}
            max={2000}
            step={100}
            onChange={setFreqMHz}
            displayValue={`${freqMHz} MHz`}
          />
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">MAC bit width</span>
              <span className="text-emerald-400 font-mono font-semibold">{bitWidth}-bit</span>
            </div>
            <div className="flex gap-2">
              {[8, 16, 32].map((b) => (
                <button
                  key={b}
                  onClick={() => setBitWidth(b)}
                  className={`flex-1 py-1.5 rounded text-sm font-semibold transition-colors ${
                    bitWidth === b
                      ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                      : "bg-muted/30 border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {b}-bit
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-2">
            <StatCard
              label="Total PEs"
              value={stats.totalPEs.toLocaleString()}
              icon={<Cpu size={12} />}
            />
            <StatCard
              label="Peak TOPS"
              value={stats.peakTOPS.toFixed(2)}
              unit="TOPS"
              icon={<Zap size={12} />}
            />
            <StatCard
              label="Die Area"
              value={stats.dieArea.toFixed(1)}
              unit="mm²"
              icon={<Layers size={12} />}
            />
            <StatCard
              label="Power"
              value={stats.power.toFixed(1)}
              unit="W"
              icon={<Activity size={12} />}
            />
          </div>
        </div>

        {/* SVG Visualization */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-muted-foreground">
            {rows > 16 || cols > 16 ? `Showing 16×16 of ${rows}×${cols} PEs` : `${rows}×${cols} PE Grid`}
          </p>
          <svg
            width={svgWidth}
            height={svgHeight}
            className="rounded-lg bg-black/20"
          >
            {/* Grid cells */}
            {Array.from({ length: gridSize }, (_, r) =>
              Array.from({ length: gridSizeCols }, (_, c) => {
                const wave = ((r + c) % 4) / 4;
                return (
                  <motion.rect
                    key={`${r}-${c}`}
                    x={c * cellSize + 30}
                    y={r * cellSize + 20}
                    width={cellSize - 2}
                    height={cellSize - 2}
                    rx={1}
                    fill={`rgba(16, 185, 129, ${0.3 + wave * 0.4})`}
                    stroke="rgba(16,185,129,0.3)"
                    strokeWidth={0.5}
                    animate={{ opacity: [0.6 + wave * 0.3, 1, 0.6 + wave * 0.3] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: (r + c) * 0.05,
                    }}
                  />
                );
              })
            )}
            {/* Weight arrows (down) */}
            {Array.from({ length: Math.min(gridSizeCols, 4) }, (_, c) => (
              <g key={`warr-${c}`}>
                <line
                  x1={c * (svgWidth - 60) / 4 + 38}
                  y1={2}
                  x2={c * (svgWidth - 60) / 4 + 38}
                  y2={18}
                  stroke="#34d399"
                  strokeWidth={1.5}
                  markerEnd="url(#arrowDown)"
                />
              </g>
            ))}
            {/* Activation arrows (right) */}
            {Array.from({ length: Math.min(gridSize, 4) }, (_, r) => (
              <g key={`aarr-${r}`}>
                <line
                  x1={2}
                  y1={r * (svgHeight - 40) / 4 + 28}
                  x2={28}
                  y2={r * (svgHeight - 40) / 4 + 28}
                  stroke="#6ee7b7"
                  strokeWidth={1.5}
                  markerEnd="url(#arrowRight)"
                />
              </g>
            ))}
            <defs>
              <marker id="arrowDown" markerWidth="6" markerHeight="6" refX="3" refY="6" orient="auto">
                <path d="M0,0 L6,0 L3,6 Z" fill="#34d399" />
              </marker>
              <marker id="arrowRight" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 Z" fill="#6ee7b7" />
              </marker>
            </defs>
            {/* Labels */}
            <text x={svgWidth / 2} y={svgHeight - 4} textAnchor="middle" fill="#6ee7b7" fontSize={9}>
              Activations →
            </text>
            <text
              x={8}
              y={svgHeight / 2}
              textAnchor="middle"
              fill="#34d399"
              fontSize={9}
              transform={`rotate(-90, 8, ${svgHeight / 2})`}
            >
              Weights ↓
            </text>
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Section 2: Roofline Model Analysis
// ─────────────────────────────────────────────
function RooflineSection() {
  const [peakTFLOPS, setPeakTFLOPS] = useState(100);
  const [memBwGBs, setMemBwGBs] = useState(500);
  const [arithIntensity, setArithIntensity] = useState(50);
  const [batchSize, setBatchSize] = useState(32);

  const stats = useMemo(() => {
    const ridgePoint = (peakTFLOPS * 1e12) / (memBwGBs * 1e9);
    const bottleneck = arithIntensity < ridgePoint ? "Memory-bound" : "Compute-bound";
    const attainableGFLOPS = Math.min(peakTFLOPS * 1000, arithIntensity * memBwGBs);
    const attainableTFLOPS = attainableGFLOPS / 1000;
    const utilization = (attainableTFLOPS / peakTFLOPS) * 100;
    return { ridgePoint, bottleneck, attainableGFLOPS, attainableTFLOPS, utilization };
  }, [peakTFLOPS, memBwGBs, arithIntensity, batchSize]);

  // SVG roofline plot
  const svgW = 400;
  const svgH = 260;
  const padL = 50;
  const padB = 40;
  const padT = 20;
  const padR = 20;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  // Log scale helpers
  const xMin = Math.log10(0.1);
  const xMax = Math.log10(1000);
  const yMin = Math.log10(1);
  const yMax = Math.log10(Math.max(peakTFLOPS * 1200, 100000));

  const toX = (intensity: number) =>
    padL + ((Math.log10(intensity) - xMin) / (xMax - xMin)) * plotW;
  const toY = (gflops: number) =>
    padT + plotH - ((Math.log10(Math.max(gflops, 1)) - yMin) / (yMax - yMin)) * plotH;

  // Roofline points
  const ridgeX = toX(stats.ridgePoint);
  const roofY = toY(peakTFLOPS * 1000);
  const opX = toX(arithIntensity);
  const opY = toY(stats.attainableGFLOPS);

  // Memory bandwidth line: perf = I * BW, from x=0.1 to ridge point
  const memLineStart = { x: toX(0.1), y: toY(0.1 * memBwGBs) };
  const memLineEnd = { x: ridgeX, y: roofY };

  const xTicks = [0.1, 1, 10, 100, 1000];
  const yTicks = [1, 10, 100, 1000, 10000, 100000].filter(
    (v) => Math.log10(v) >= yMin && Math.log10(v) <= yMax
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-card border border-border rounded-xl p-6 flex flex-col gap-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="text-emerald-400" size={20} />
          <h2 className="text-lg font-bold">Roofline Model Analysis</h2>
        </div>
        <div
          className={`px-3 py-1 rounded-full text-xs font-bold border ${
            stats.bottleneck === "Memory-bound"
              ? "bg-blue-500/20 border-blue-500/30 text-blue-400"
              : "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
          }`}
        >
          {stats.bottleneck.toUpperCase()} · {stats.utilization.toFixed(1)}%
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Controls */}
        <div className="flex flex-col gap-4">
          <SliderRow
            label="Peak compute (TFLOPS)"
            value={peakTFLOPS}
            min={1}
            max={1000}
            step={1}
            onChange={setPeakTFLOPS}
            displayValue={`${peakTFLOPS} TFLOPS`}
          />
          <SliderRow
            label="Memory bandwidth (GB/s)"
            value={memBwGBs}
            min={10}
            max={10000}
            step={10}
            onChange={setMemBwGBs}
            displayValue={`${memBwGBs} GB/s`}
          />
          <SliderRow
            label="Arithmetic intensity (FLOP/byte)"
            value={arithIntensity}
            min={1}
            max={1000}
            step={1}
            onChange={setArithIntensity}
            displayValue={`${arithIntensity} FLOP/B`}
          />
          <SliderRow
            label="Batch size"
            value={batchSize}
            min={1}
            max={512}
            step={1}
            onChange={setBatchSize}
          />

          <div className="grid grid-cols-2 gap-3 mt-2">
            <StatCard
              label="Ridge Point"
              value={stats.ridgePoint.toFixed(1)}
              unit="FLOP/B"
              icon={<TrendingUp size={12} />}
            />
            <StatCard
              label="Attainable"
              value={stats.attainableTFLOPS.toFixed(2)}
              unit="TFLOPS"
              icon={<Zap size={12} />}
            />
            <StatCard
              label="Utilization"
              value={stats.utilization.toFixed(1)}
              unit="%"
              icon={<Activity size={12} />}
            />
            <StatCard
              label="Batch Size"
              value={batchSize.toString()}
              icon={<Layers size={12} />}
            />
          </div>
        </div>

        {/* SVG Roofline Plot */}
        <div className="flex flex-col items-center">
          <svg width={svgW} height={svgH} className="rounded-lg bg-black/20">
            {/* Memory-bound region */}
            <polygon
              points={`${padL},${toY(0.1 * memBwGBs)} ${memLineEnd.x},${roofY} ${padL},${roofY}`}
              fill="rgba(59,130,246,0.08)"
            />
            {/* Compute-bound region */}
            <polygon
              points={`${ridgeX},${roofY} ${svgW - padR},${roofY} ${svgW - padR},${padT + plotH} ${ridgeX},${padT + plotH}`}
              fill="rgba(16,185,129,0.08)"
            />
            {/* Grid lines */}
            {xTicks.map((v) => (
              <line
                key={`xg-${v}`}
                x1={toX(v)}
                y1={padT}
                x2={toX(v)}
                y2={padT + plotH}
                stroke="rgba(255,255,255,0.07)"
                strokeWidth={1}
              />
            ))}
            {yTicks.map((v) => (
              <line
                key={`yg-${v}`}
                x1={padL}
                y1={toY(v)}
                x2={padL + plotW}
                y2={toY(v)}
                stroke="rgba(255,255,255,0.07)"
                strokeWidth={1}
              />
            ))}
            {/* Memory bandwidth ceiling */}
            <line
              x1={memLineStart.x}
              y1={memLineStart.y}
              x2={memLineEnd.x}
              y2={memLineEnd.y}
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="4 2"
            />
            <text x={memLineStart.x + 4} y={memLineStart.y - 4} fill="#60a5fa" fontSize={8}>
              Mem BW
            </text>
            {/* Compute ceiling */}
            <line
              x1={ridgeX}
              y1={roofY}
              x2={padL + plotW}
              y2={roofY}
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="4 2"
            />
            <text x={padL + plotW - 60} y={roofY - 4} fill="#34d399" fontSize={8}>
              Compute Roof
            </text>
            {/* Ridge point */}
            <circle cx={ridgeX} cy={roofY} r={4} fill="#f59e0b" />
            <text x={ridgeX + 5} y={roofY - 5} fill="#fbbf24" fontSize={7}>
              Ridge
            </text>
            {/* Operating point */}
            <motion.circle
              cx={opX}
              cy={opY}
              r={6}
              fill="#10b981"
              stroke="#34d399"
              strokeWidth={2}
              animate={{ r: [5, 7, 5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <text x={opX + 8} y={opY} fill="#6ee7b7" fontSize={8}>
              Op. Point
            </text>
            {/* Axes */}
            <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
            <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
            {/* X tick labels */}
            {xTicks.map((v) => (
              <text key={`xl-${v}`} x={toX(v)} y={padT + plotH + 12} textAnchor="middle" fill="#9ca3af" fontSize={8}>
                {v}
              </text>
            ))}
            {/* Y tick labels */}
            {yTicks.map((v) => (
              <text key={`yl-${v}`} x={padL - 4} y={toY(v) + 3} textAnchor="end" fill="#9ca3af" fontSize={8}>
                {v >= 1000 ? `${v / 1000}K` : v}
              </text>
            ))}
            {/* Axis labels */}
            <text x={svgW / 2} y={svgH - 2} textAnchor="middle" fill="#6b7280" fontSize={9}>
              Arithmetic Intensity (FLOP/byte)
            </text>
            <text
              x={10}
              y={svgH / 2}
              textAnchor="middle"
              fill="#6b7280"
              fontSize={9}
              transform={`rotate(-90, 10, ${svgH / 2})`}
            >
              GFLOPS
            </text>
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Section 3: Layer-by-Layer Latency (Transformer)
// ─────────────────────────────────────────────
function TransformerLayerSection() {
  const [seqLen, setSeqLen] = useState(512);
  const [dModel, setDModel] = useState(1024);
  const [numHeads, setNumHeads] = useState(16);
  const [ffMult, setFfMult] = useState(4);

  const stats = useMemo(() => {
    const attnFlops = 4 * seqLen * seqLen * dModel;
    const ffnFlops = 8 * seqLen * dModel * dModel * ffMult;
    const totalFlops = attnFlops + ffnFlops;
    const headDim = dModel / numHeads;
    const kvCacheMB = (2 * seqLen * dModel * 2) / 1e6;

    // Breakdown per operation (in GFLOPs)
    const qkvProj = (3 * seqLen * dModel * dModel) / 1e9;
    const attnScores = (seqLen * seqLen * dModel) / 1e9;
    const attnSoftmax = (seqLen * seqLen * numHeads) / 1e9;
    const outProj = (seqLen * dModel * dModel) / 1e9;
    const ffn1 = (seqLen * dModel * dModel * ffMult) / 1e9;
    const ffn2 = (seqLen * dModel * dModel * ffMult) / 1e9;

    return {
      attnFlops,
      ffnFlops,
      totalFlops,
      headDim,
      kvCacheMB,
      breakdown: [
        { label: "QKV Proj", gflops: qkvProj },
        { label: "Attn Scores", gflops: attnScores },
        { label: "Softmax", gflops: attnSoftmax },
        { label: "Out Proj", gflops: outProj },
        { label: "FFN-1", gflops: ffn1 },
        { label: "FFN-2", gflops: ffn2 },
      ],
    };
  }, [seqLen, dModel, numHeads, ffMult]);

  const svgW = 400;
  const svgH = 240;
  const padL = 55;
  const padB = 55;
  const padT = 20;
  const padR = 15;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;
  const barW = plotW / stats.breakdown.length - 8;
  const maxVal = Math.max(...stats.breakdown.map((b) => b.gflops));

  const emeraldShades = [
    "#064e3b", "#065f46", "#047857", "#059669", "#10b981", "#34d399",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-card border border-border rounded-xl p-6 flex flex-col gap-6"
    >
      <div className="flex items-center gap-2">
        <Layers className="text-emerald-400" size={20} />
        <h2 className="text-lg font-bold">Layer-by-Layer Latency (Transformer)</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Controls */}
        <div className="flex flex-col gap-4">
          <SliderRow
            label="Sequence length (tokens)"
            value={seqLen}
            min={32}
            max={4096}
            step={32}
            onChange={setSeqLen}
            displayValue={`${seqLen} tokens`}
          />
          <SliderRow
            label="Model dimension (d_model)"
            value={dModel}
            min={128}
            max={4096}
            step={128}
            onChange={setDModel}
          />
          <SliderRow
            label="Number of heads"
            value={numHeads}
            min={1}
            max={64}
            step={1}
            onChange={setNumHeads}
          />
          <SliderRow
            label="Feed-forward multiplier"
            value={ffMult}
            min={1}
            max={8}
            step={1}
            onChange={setFfMult}
            displayValue={`${ffMult}×`}
          />

          <div className="grid grid-cols-2 gap-3 mt-2">
            <StatCard
              label="Attention FLOPs"
              value={(stats.attnFlops / 1e9).toFixed(1)}
              unit="GFLOPs"
              icon={<Activity size={12} />}
            />
            <StatCard
              label="FFN FLOPs"
              value={(stats.ffnFlops / 1e9).toFixed(1)}
              unit="GFLOPs"
              icon={<Zap size={12} />}
            />
            <StatCard
              label="Head Dimension"
              value={stats.headDim.toFixed(0)}
              unit="dims"
              icon={<Layers size={12} />}
            />
            <StatCard
              label="KV Cache"
              value={stats.kvCacheMB.toFixed(2)}
              unit="MB"
              icon={<Database size={12} />}
            />
          </div>
        </div>

        {/* SVG Bar Chart */}
        <div className="flex flex-col items-center">
          <svg width={svgW} height={svgH} className="rounded-lg bg-black/20">
            {/* Y grid lines */}
            {[0.25, 0.5, 0.75, 1.0].map((frac) => {
              const y = padT + plotH * (1 - frac);
              return (
                <g key={`yg-${frac}`}>
                  <line x1={padL} y1={y} x2={padL + plotW} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
                  <text x={padL - 4} y={y + 3} textAnchor="end" fill="#9ca3af" fontSize={8}>
                    {(maxVal * frac).toFixed(0)}
                  </text>
                </g>
              );
            })}
            {/* Bars */}
            {stats.breakdown.map((op, i) => {
              const barH = maxVal > 0 ? (op.gflops / maxVal) * plotH : 0;
              const barX = padL + i * (plotW / stats.breakdown.length) + 4;
              const barY = padT + plotH - barH;
              return (
                <g key={op.label}>
                  <motion.rect
                    x={barX}
                    y={barY}
                    width={barW}
                    height={barH}
                    rx={2}
                    fill={emeraldShades[i]}
                    initial={{ height: 0, y: padT + plotH }}
                    animate={{ height: barH, y: barY }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                  />
                  <text
                    x={barX + barW / 2}
                    y={barY - 4}
                    textAnchor="middle"
                    fill="#6ee7b7"
                    fontSize={7}
                  >
                    {op.gflops.toFixed(0)}G
                  </text>
                  <text
                    x={barX + barW / 2}
                    y={padT + plotH + 14}
                    textAnchor="middle"
                    fill="#9ca3af"
                    fontSize={7}
                    transform={`rotate(-30, ${barX + barW / 2}, ${padT + plotH + 14})`}
                  >
                    {op.label}
                  </text>
                </g>
              );
            })}
            {/* Axes */}
            <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
            <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
            <text x={svgW / 2} y={svgH - 2} textAnchor="middle" fill="#6b7280" fontSize={9}>
              Transformer Operation
            </text>
            <text
              x={10}
              y={svgH / 2}
              textAnchor="middle"
              fill="#6b7280"
              fontSize={9}
              transform={`rotate(-90, 10, ${svgH / 2})`}
            >
              GFLOPs
            </text>
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Section 4: Memory Bandwidth Wall
// ─────────────────────────────────────────────
function MemoryBandwidthSection() {
  const [weightGB, setWeightGB] = useState(7);
  const [activationMB, setActivationMB] = useState(100);
  const [sramMB, setSramMB] = useState(16);
  const [hbmBwGBs, setHbmBwGBs] = useState(2000);

  const stats = useMemo(() => {
    const weightLoadMs = (weightGB * 1000) / hbmBwGBs;
    const activationLoadMs = (activationMB / 1000 / hbmBwGBs) * 1000;
    const sramHitRate = Math.min(
      (sramMB / (activationMB + weightGB * 1000)) * 100,
      95
    );
    const effectiveBw =
      hbmBwGBs * (1 - sramHitRate / 100) + sramMB * 20 * (sramHitRate / 100);
    return { weightLoadMs, activationLoadMs, sramHitRate, effectiveBw };
  }, [weightGB, activationMB, sramMB, hbmBwGBs]);

  const svgW = 380;
  const svgH = 240;

  // Memory hierarchy tiers
  const tiers = [
    {
      label: "SRAM",
      size: `${sramMB} MB`,
      bw: "~40 TB/s",
      color: "#10b981",
      hitFill: stats.sramHitRate,
      y: 20,
      h: 50,
    },
    {
      label: "HBM",
      size: "16–128 GB",
      bw: `${hbmBwGBs} GB/s`,
      color: "#6b7280",
      hitFill: 100,
      y: 85,
      h: 50,
    },
    {
      label: "Weight Storage",
      size: `${weightGB} GB`,
      bw: "PCIe ~64 GB/s",
      color: "#374151",
      hitFill: 100,
      y: 150,
      h: 50,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="bg-card border border-border rounded-xl p-6 flex flex-col gap-6"
    >
      <div className="flex items-center gap-2">
        <Database className="text-emerald-400" size={20} />
        <h2 className="text-lg font-bold">Memory Bandwidth Wall</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Controls */}
        <div className="flex flex-col gap-4">
          <SliderRow
            label="Weight size (GB)"
            value={weightGB}
            min={0.1}
            max={1000}
            step={0.1}
            onChange={setWeightGB}
            displayValue={`${weightGB} GB`}
          />
          <SliderRow
            label="Activation size (MB)"
            value={activationMB}
            min={1}
            max={10000}
            step={1}
            onChange={setActivationMB}
            displayValue={`${activationMB} MB`}
          />
          <SliderRow
            label="On-chip SRAM (MB)"
            value={sramMB}
            min={0.1}
            max={256}
            step={0.1}
            onChange={setSramMB}
            displayValue={`${sramMB} MB`}
          />
          <SliderRow
            label="HBM bandwidth (GB/s)"
            value={hbmBwGBs}
            min={100}
            max={10000}
            step={100}
            onChange={setHbmBwGBs}
            displayValue={`${hbmBwGBs} GB/s`}
          />

          <div className="grid grid-cols-2 gap-3 mt-2">
            <StatCard
              label="Weight Load"
              value={stats.weightLoadMs.toFixed(2)}
              unit="ms"
              icon={<Database size={12} />}
            />
            <StatCard
              label="Activation Load"
              value={stats.activationLoadMs.toFixed(3)}
              unit="ms"
              icon={<Activity size={12} />}
            />
            <StatCard
              label="SRAM Hit Rate"
              value={stats.sramHitRate.toFixed(1)}
              unit="%"
              icon={<CheckCircle size={12} />}
            />
            <StatCard
              label="Effective BW"
              value={stats.effectiveBw.toFixed(0)}
              unit="GB/s"
              icon={<Zap size={12} />}
            />
          </div>
        </div>

        {/* SVG Memory Hierarchy */}
        <div className="flex flex-col items-center">
          <svg width={svgW} height={svgH} className="rounded-lg bg-black/20">
            {tiers.map((tier, i) => {
              const tierW = svgW - 60 - i * 40;
              const tierX = 30 + i * 20;
              return (
                <g key={tier.label}>
                  {/* Background tier */}
                  <rect
                    x={tierX}
                    y={tier.y}
                    width={tierW}
                    height={tier.h}
                    rx={6}
                    fill={`${tier.color}22`}
                    stroke={tier.color}
                    strokeWidth={1.5}
                  />
                  {/* Hit rate fill (SRAM only) */}
                  {i === 0 && (
                    <motion.rect
                      x={tierX + 2}
                      y={tier.y + 2}
                      width={Math.max(0, (tierW - 4) * (tier.hitFill / 100))}
                      height={tier.h - 4}
                      rx={4}
                      fill="rgba(16,185,129,0.35)"
                      animate={{ width: Math.max(0, (tierW - 4) * (tier.hitFill / 100)) }}
                      transition={{ duration: 0.4 }}
                    />
                  )}
                  {/* Labels */}
                  <text x={tierX + 10} y={tier.y + 20} fill={tier.color} fontSize={11} fontWeight="bold">
                    {tier.label}
                  </text>
                  <text x={tierX + 10} y={tier.y + 34} fill="#9ca3af" fontSize={9}>
                    {tier.size}
                  </text>
                  <text x={tierX + tierW - 10} y={tier.y + 27} textAnchor="end" fill="#6b7280" fontSize={8}>
                    {tier.bw}
                  </text>
                  {/* Arrows between tiers */}
                  {i < tiers.length - 1 && (
                    <g>
                      <line
                        x1={svgW / 2}
                        y1={tier.y + tier.h + 2}
                        x2={svgW / 2}
                        y2={tier.y + tier.h + 10}
                        stroke="#4b5563"
                        strokeWidth={2}
                        markerEnd="url(#arrowDown2)"
                      />
                    </g>
                  )}
                </g>
              );
            })}
            <defs>
              <marker id="arrowDown2" markerWidth="6" markerHeight="6" refX="3" refY="6" orient="auto">
                <path d="M0,0 L6,0 L3,6 Z" fill="#4b5563" />
              </marker>
            </defs>
            {/* SRAM hit rate label */}
            <text x={svgW / 2} y={svgH - 8} textAnchor="middle" fill="#6ee7b7" fontSize={9}>
              SRAM Hit Rate: {stats.sramHitRate.toFixed(1)}%
            </text>
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Section 5: Quantization Impact
// ─────────────────────────────────────────────
function QuantizationSection() {
  const [fp32Accuracy, setFp32Accuracy] = useState(95);
  const [weightBits, setWeightBits] = useState(8);
  const [actBits, setActBits] = useState(8);
  const [calibK, setCalibK] = useState(1);

  const stats = useMemo(() => {
    const modelSizeReduction = 32 / weightBits;
    const rawDrop =
      Math.max(0, (8 - weightBits) * 0.3 + (8 - actBits) * 0.2) *
      (1 - calibK / 10);
    const accuracyDrop = Math.max(0, rawDrop);
    const quantizedAccuracy = Math.max(0, fp32Accuracy - accuracyDrop);
    const speedupFactor = (32 / weightBits) * (32 / actBits) / ((32 * 32) / 256);
    return { modelSizeReduction, accuracyDrop, quantizedAccuracy, speedupFactor };
  }, [fp32Accuracy, weightBits, actBits, calibK]);

  const bitOptions = [2, 4, 8, 16, 32];

  // Precision levels for visualization
  const precisions = [
    { label: "FP32", bits: 32, color: "#374151" },
    { label: "FP16", bits: 16, color: "#4b5563" },
    { label: "INT8", bits: 8, color: "#059669" },
    { label: "INT4", bits: 4, color: "#10b981" },
    { label: "INT2", bits: 2, color: "#34d399" },
  ];

  const svgW = 380;
  const svgH = 220;
  const padL = 10;
  const padR = 10;
  const barSectionW = (svgW - padL - padR) / 2 - 10;
  const scatterX0 = padL + barSectionW + 20;
  const scatterW = svgW - scatterX0 - padR;
  const padT = 20;
  const padB = 30;
  const plotH = svgH - padT - padB;

  // Bar chart: model sizes
  const fp32SizeGB = 7; // baseline
  const maxBarH = plotH - 10;

  // Scatter plot: accuracy vs model size
  const scatterPoints = precisions.map((p) => {
    const sizeFrac = p.bits / 32; // relative to FP32
    const accDrop = Math.max(0, (8 - Math.min(p.bits, 8)) * 0.3) * 0.8;
    const acc = Math.max(50, fp32Accuracy - accDrop);
    return { ...p, sizeFrac, acc };
  });
  const scatterMinAcc = Math.min(...scatterPoints.map((p) => p.acc)) - 2;
  const scatterMaxAcc = fp32Accuracy + 1;

  const toScX = (sizeFrac: number) => scatterX0 + sizeFrac * (scatterW - 10) + 5;
  const toScY = (acc: number) =>
    padT + plotH - ((acc - scatterMinAcc) / (scatterMaxAcc - scatterMinAcc)) * plotH;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-card border border-border rounded-xl p-6 flex flex-col gap-6"
    >
      <div className="flex items-center gap-2">
        <TrendingUp className="text-emerald-400" size={20} />
        <h2 className="text-lg font-bold">Quantization Impact</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Controls */}
        <div className="flex flex-col gap-4">
          <SliderRow
            label="FP32 baseline accuracy (%)"
            value={fp32Accuracy}
            min={80}
            max={99.9}
            step={0.1}
            onChange={setFp32Accuracy}
            displayValue={`${fp32Accuracy.toFixed(1)}%`}
          />
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Weight bits</span>
              <span className="text-emerald-400 font-mono font-semibold">{weightBits}-bit</span>
            </div>
            <div className="flex gap-2">
              {bitOptions.map((b) => (
                <button
                  key={b}
                  onClick={() => setWeightBits(b)}
                  className={`flex-1 py-1.5 rounded text-xs font-semibold transition-colors ${
                    weightBits === b
                      ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                      : "bg-muted/30 border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Activation bits</span>
              <span className="text-emerald-400 font-mono font-semibold">{actBits}-bit</span>
            </div>
            <div className="flex gap-2">
              {bitOptions.map((b) => (
                <button
                  key={b}
                  onClick={() => setActBits(b)}
                  className={`flex-1 py-1.5 rounded text-xs font-semibold transition-colors ${
                    actBits === b
                      ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                      : "bg-muted/30 border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
          <SliderRow
            label="Calibration dataset (k samples)"
            value={calibK}
            min={0.1}
            max={100}
            step={0.1}
            onChange={setCalibK}
            displayValue={`${calibK.toFixed(1)}k`}
          />

          <div className="grid grid-cols-2 gap-3 mt-2">
            <StatCard
              label="Size Reduction"
              value={`${stats.modelSizeReduction.toFixed(1)}×`}
              icon={<Layers size={12} />}
            />
            <StatCard
              label="Accuracy Drop"
              value={stats.accuracyDrop.toFixed(2)}
              unit="%"
              icon={<TrendingUp size={12} />}
            />
            <StatCard
              label="Quant. Accuracy"
              value={stats.quantizedAccuracy.toFixed(1)}
              unit="%"
              icon={<CheckCircle size={12} />}
            />
            <StatCard
              label="Speedup"
              value={`${stats.speedupFactor.toFixed(2)}×`}
              icon={<Zap size={12} />}
            />
          </div>
        </div>

        {/* SVG Two-panel */}
        <div className="flex flex-col items-center">
          <svg width={svgW} height={svgH} className="rounded-lg bg-black/20">
            {/* Left: bar chart of model sizes */}
            {precisions.map((p, i) => {
              const relSize = p.bits / 32;
              const barH = relSize * maxBarH;
              const barW2 = (barSectionW - 10) / precisions.length - 4;
              const barX = padL + 5 + i * (barW2 + 4);
              const barY = padT + plotH - barH;
              const isSelected = p.bits === weightBits;
              return (
                <g key={p.label}>
                  <motion.rect
                    x={barX}
                    y={barY}
                    width={barW2}
                    height={barH}
                    rx={2}
                    fill={isSelected ? "#10b981" : p.color}
                    stroke={isSelected ? "#34d399" : "transparent"}
                    strokeWidth={1.5}
                    animate={{ height: barH, y: barY }}
                    transition={{ duration: 0.3 }}
                  />
                  <text
                    x={barX + barW2 / 2}
                    y={padT + plotH + 12}
                    textAnchor="middle"
                    fill={isSelected ? "#34d399" : "#9ca3af"}
                    fontSize={8}
                  >
                    {p.label}
                  </text>
                  <text
                    x={barX + barW2 / 2}
                    y={barY - 3}
                    textAnchor="middle"
                    fill={isSelected ? "#6ee7b7" : "#6b7280"}
                    fontSize={7}
                  >
                    {(fp32SizeGB * relSize).toFixed(1)}G
                  </text>
                </g>
              );
            })}
            {/* Left axis */}
            <line x1={padL + 2} y1={padT} x2={padL + 2} y2={padT + plotH} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
            <line x1={padL + 2} y1={padT + plotH} x2={padL + barSectionW} y2={padT + plotH} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
            <text x={(padL + barSectionW) / 2} y={svgH - 4} textAnchor="middle" fill="#6b7280" fontSize={8}>
              Model Size (relative)
            </text>

            {/* Divider */}
            <line
              x1={scatterX0 - 5}
              y1={padT}
              x2={scatterX0 - 5}
              y2={svgH - padB}
              stroke="rgba(255,255,255,0.1)"
              strokeDasharray="3 3"
              strokeWidth={1}
            />

            {/* Right: scatter plot */}
            {/* Pareto curve (rough) */}
            <polyline
              points={scatterPoints
                .map((p) => `${toScX(p.sizeFrac)},${toScY(p.acc)}`)
                .join(" ")}
              fill="none"
              stroke="rgba(16,185,129,0.4)"
              strokeWidth={1.5}
              strokeDasharray="3 2"
            />
            {scatterPoints.map((p) => {
              const isSelected = p.bits === weightBits;
              return (
                <g key={p.label}>
                  <motion.circle
                    cx={toScX(p.sizeFrac)}
                    cy={toScY(p.acc)}
                    r={isSelected ? 7 : 4}
                    fill={isSelected ? "#10b981" : p.color}
                    stroke={isSelected ? "#34d399" : "transparent"}
                    strokeWidth={2}
                    animate={{ r: isSelected ? [6, 8, 6] : 4 }}
                    transition={{ duration: 1.5, repeat: isSelected ? Infinity : 0 }}
                  />
                  <text
                    x={toScX(p.sizeFrac) + (isSelected ? 9 : 6)}
                    y={toScY(p.acc) + 3}
                    fill={isSelected ? "#34d399" : "#6b7280"}
                    fontSize={7}
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}
            {/* Scatter axes */}
            <line x1={scatterX0} y1={padT} x2={scatterX0} y2={padT + plotH} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
            <line x1={scatterX0} y1={padT + plotH} x2={svgW - padR} y2={padT + plotH} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
            <text x={scatterX0 + scatterW / 2} y={svgH - 4} textAnchor="middle" fill="#6b7280" fontSize={8}>
              Accuracy vs Size
            </text>
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────
// Formula Cards
// ─────────────────────────────────────────────
function FormulaCards() {
  const cards = [
    {
      icon: <Cpu size={14} />,
      title: "Systolic Array TOPS",
      formula: "TOPS = N_PE × 2 × f_clk",
      explanation: "Each PE does one MAC (2 ops) per cycle",
    },
    {
      icon: <BarChart2 size={14} />,
      title: "Roofline Limit",
      formula: "Perf = min(π, I × β)",
      explanation: "π=peak compute, I=intensity, β=bandwidth",
    },
    {
      icon: <Layers size={14} />,
      title: "Attention FLOPs",
      formula: "≈ 4 × L² × d",
      explanation: "Quadratic in sequence length L, linear in dimension d",
    },
    {
      icon: <Zap size={14} />,
      title: "Quantization Compression",
      formula: "ratio = b_fp / b_quant",
      explanation: "Integer ops enable wider SIMD parallelism",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-4 flex flex-col gap-2"
        >
          <div className="flex items-center gap-2 text-emerald-400">
            {card.icon}
            <span className="text-xs font-bold uppercase">{card.title}</span>
          </div>
          <code className="font-mono text-sm text-white bg-black/20 px-2 py-1 rounded">
            {card.formula}
          </code>
          <p className="text-xs text-muted-foreground">{card.explanation}</p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function MLAcceleratorPage() {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-6xl mx-auto flex flex-col gap-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg">
            <Cpu className="text-emerald-400" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">ML Accelerator Design</h1>
            <p className="text-sm text-muted-foreground">
              Systolic arrays, roofline model, transformer layer analysis, memory bandwidth wall, and quantization
            </p>
          </div>
        </div>
      </motion.div>

      {/* Sections */}
      <SystolicArraySection />
      <RooflineSection />
      <TransformerLayerSection />
      <MemoryBandwidthSection />
      <QuantizationSection />

      {/* Formula Cards */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <CheckCircle className="text-emerald-400" size={16} />
          <h2 className="text-base font-bold">Key Formulas</h2>
        </div>
        <FormulaCards />
      </div>
    </div>
  );
}
