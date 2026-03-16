"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Cpu,
  Layers,
  Grid3X3,
  Zap,
  Clock,
  BarChart2,
  GitBranch,
  CheckCircle,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function seededRand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

// ─── SliderRow ────────────────────────────────────────────────────────────────

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  formatValue?: (v: number) => string;
}

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  formatValue,
}: SliderRowProps) {
  const display = formatValue ? formatValue(value) : `${value}${unit ? " " + unit : ""}`;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-300">{label}</span>
        <span className="text-sm font-mono text-amber-400">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber-500 cursor-pointer"
      />
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}

function StatCard({ label, value, sub, highlight }: StatCardProps) {
  return (
    <div
      className={`rounded-lg border p-3 flex flex-col gap-1 ${
        highlight
          ? "bg-amber-500/20 border-amber-500/30"
          : "bg-gray-800/60 border-gray-700/50"
      }`}
    >
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-lg font-mono font-bold text-amber-400">{value}</span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  );
}

// ─── Section 1: LUT Utilization & Packing ────────────────────────────────────

function LutUtilizationSection() {
  const [lutsUsed, setLutsUsed] = useState(40000);
  const [totalLuts, setTotalLuts] = useState(100000);
  const [packingEff, setPackingEff] = useState(72);
  const [ramBlocks, setRamBlocks] = useState(120);

  const calc = useMemo(() => {
    const lutUtil = (lutsUsed / totalLuts) * 100;
    const packedLuts = lutsUsed * (packingEff / 100);
    const sliceUtil = (packedLuts / (totalLuts * 0.5)) * 100;
    const risk =
      lutUtil < 70 ? "LOW" : lutUtil <= 85 ? "MODERATE" : "HIGH";
    return { lutUtil, packedLuts, sliceUtil, risk };
  }, [lutsUsed, totalLuts, packingEff, ramBlocks]);

  const riskColor =
    calc.risk === "LOW"
      ? "text-green-400 bg-green-500/20 border-green-500/30"
      : calc.risk === "MODERATE"
      ? "text-amber-400 bg-amber-500/20 border-amber-500/30"
      : "text-red-400 bg-red-500/20 border-red-500/30";

  const barColor =
    calc.lutUtil < 70
      ? "#f59e0b"
      : calc.lutUtil <= 85
      ? "#f97316"
      : "#ef4444";

  const usedPct = clamp(calc.lutUtil, 0, 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-gray-900/60 border border-amber-500/30 rounded-xl p-6 flex flex-col gap-6"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/20">
          <Layers className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">LUT Utilization &amp; Packing</h2>
          <p className="text-sm text-gray-400">Logic resource consumption and slice packing efficiency</p>
        </div>
        <span className={`ml-auto px-3 py-1 rounded-full text-xs font-bold border ${riskColor}`}>
          {calc.risk}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          <SliderRow label="Logic LUTs Used" value={lutsUsed} min={1000} max={100000} step={1000} onChange={setLutsUsed} />
          <SliderRow label="Total LUTs Available" value={totalLuts} min={50000} max={200000} step={5000} onChange={setTotalLuts} />
          <SliderRow label="LUT Packing Efficiency (%)" value={packingEff} min={40} max={95} step={1} unit="%" onChange={setPackingEff} />
          <SliderRow label="RAM Blocks Used" value={ramBlocks} min={0} max={500} step={5} onChange={setRamBlocks} />
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="LUT Utilization" value={`${calc.lutUtil.toFixed(1)}%`} sub="used / total" highlight />
            <StatCard label="Packed LUTs" value={Math.round(calc.packedLuts).toLocaleString()} sub="after packing" />
            <StatCard label="Slice Utilization" value={`${calc.sliceUtil.toFixed(1)}%`} sub="~2 LUTs/slice" />
            <StatCard label="RAM Blocks" value={ramBlocks.toString()} sub="blocks used" />
          </div>

          {/* SVG Bar */}
          <svg viewBox="0 0 400 80" className="w-full rounded-lg bg-gray-800/50 p-1">
            {/* Background bar */}
            <rect x="20" y="25" width="360" height="28" rx="4" fill="rgba(75,85,99,0.5)" />
            {/* Used bar */}
            <rect
              x="20"
              y="25"
              width={Math.max(0, (usedPct / 100) * 360)}
              height="28"
              rx="4"
              fill={barColor}
              fillOpacity="0.85"
            />
            {/* Grid ticks at 25% intervals */}
            {[25, 50, 75, 100].map((pct) => (
              <g key={pct}>
                <line
                  x1={20 + (pct / 100) * 360}
                  y1="20"
                  x2={20 + (pct / 100) * 360}
                  y2="58"
                  stroke="rgba(156,163,175,0.4)"
                  strokeWidth="1"
                  strokeDasharray="3,2"
                />
                <text
                  x={20 + (pct / 100) * 360}
                  y="70"
                  textAnchor="middle"
                  fontSize="9"
                  fill="rgba(156,163,175,0.7)"
                >
                  {pct === 100 ? "FULL" : `${pct}%`}
                </text>
              </g>
            ))}
            {/* Label */}
            <text x="20" y="16" fontSize="9" fill="rgba(251,191,36,0.9)">
              LUT Utilization
            </text>
            <text x="380" y="16" textAnchor="end" fontSize="9" fill="rgba(251,191,36,0.9)">
              {calc.lutUtil.toFixed(1)}%
            </text>
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Section 2: Timing Closure & Setup Slack ──────────────────────────────────

function TimingClosureSection() {
  const [freq, setFreq] = useState(200);
  const [critPath, setCritPath] = useState(4.5);
  const [clockSkew, setClockSkew] = useState(150);
  const [holdMargin, setHoldMargin] = useState(80);

  const calc = useMemo(() => {
    const clockPeriod = 1000 / freq;
    const setupSlack = clockPeriod - critPath - clockSkew / 1000;
    const holdSlack = holdMargin - clockSkew;
    const timingScore = clamp((setupSlack / clockPeriod) * 100, 0, 100);
    const status =
      setupSlack > 0.2 ? "CLOSED" : setupSlack > 0 ? "MARGINAL" : "FAILING";
    return { clockPeriod, setupSlack, holdSlack, timingScore, status };
  }, [freq, critPath, clockSkew, holdMargin]);

  const statusColor =
    calc.status === "CLOSED"
      ? "text-green-400 bg-green-500/20 border-green-500/30"
      : calc.status === "MARGINAL"
      ? "text-amber-400 bg-amber-500/20 border-amber-500/30"
      : "text-red-400 bg-red-500/20 border-red-500/30";

  // SVG dimensions
  const svgW = 400;
  const barY = 28;
  const barH = 22;
  const xStart = 20;
  const xEnd = 380;
  const barW = xEnd - xStart;

  const critPx = clamp((critPath / calc.clockPeriod) * barW, 0, barW);
  const skewPx = clamp((clockSkew / 1000 / calc.clockPeriod) * barW, 0, barW - critPx);
  const slackPx = clamp(barW - critPx - skewPx, 0, barW);
  const slackColor = calc.setupSlack > 0.2 ? "#22c55e" : calc.setupSlack > 0 ? "#f59e0b" : "#ef4444";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-gray-900/60 border border-amber-500/30 rounded-xl p-6 flex flex-col gap-6"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/20">
          <Clock className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Timing Closure &amp; Setup Slack</h2>
          <p className="text-sm text-gray-400">Clock period budget, critical path, and timing margins</p>
        </div>
        <span className={`ml-auto px-3 py-1 rounded-full text-xs font-bold border ${statusColor}`}>
          {calc.status}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          <SliderRow
            label="Target Clock Frequency (MHz)"
            value={freq}
            min={50}
            max={500}
            step={5}
            unit="MHz"
            onChange={setFreq}
          />
          <SliderRow
            label="Critical Path Delay (ns)"
            value={critPath}
            min={1}
            max={20}
            step={0.1}
            unit="ns"
            onChange={setCritPath}
            formatValue={(v) => `${v.toFixed(1)} ns`}
          />
          <SliderRow
            label="Clock Skew (ps)"
            value={clockSkew}
            min={0}
            max={500}
            step={10}
            unit="ps"
            onChange={setClockSkew}
          />
          <SliderRow
            label="Hold Margin (ps)"
            value={holdMargin}
            min={0}
            max={300}
            step={10}
            unit="ps"
            onChange={setHoldMargin}
          />
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Clock Period"
              value={`${calc.clockPeriod.toFixed(2)} ns`}
              sub={`${freq} MHz`}
              highlight
            />
            <StatCard
              label="Setup Slack"
              value={`${calc.setupSlack.toFixed(3)} ns`}
              sub={calc.setupSlack > 0 ? "timing met" : "violation!"}
            />
            <StatCard
              label="Hold Slack"
              value={`${calc.holdSlack.toFixed(0)} ps`}
              sub="hold margin"
            />
            <StatCard
              label="Timing Score"
              value={`${calc.timingScore.toFixed(1)}`}
              sub="out of 100"
            />
          </div>

          {/* SVG Timeline */}
          <svg viewBox={`0 0 ${svgW} 90`} className="w-full rounded-lg bg-gray-800/50 p-1">
            {/* Clock period bar background */}
            <rect x={xStart} y={barY} width={barW} height={barH} rx="3" fill="rgba(75,85,99,0.5)" />
            {/* Critical path segment */}
            <rect x={xStart} y={barY} width={critPx} height={barH} rx="2" fill="#f59e0b" fillOpacity="0.85" />
            {/* Skew segment */}
            <rect x={xStart + critPx} y={barY} width={skewPx} height={barH} rx="0" fill="#f97316" fillOpacity="0.75" />
            {/* Slack segment */}
            <rect x={xStart + critPx + skewPx} y={barY} width={slackPx} height={barH} rx="2" fill={slackColor} fillOpacity="0.75" />

            {/* Labels */}
            <text x={xStart + critPx / 2} y={barY + 14} textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">
              {critPx > 40 ? `Crit ${critPath.toFixed(1)}ns` : ""}
            </text>
            <text x={xStart + critPx + skewPx / 2} y={barY + 14} textAnchor="middle" fontSize="8" fill="white">
              {skewPx > 30 ? `Skew` : ""}
            </text>
            <text x={xStart + critPx + skewPx + slackPx / 2} y={barY + 14} textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">
              {slackPx > 40 ? `Slack ${calc.setupSlack.toFixed(2)}ns` : ""}
            </text>

            {/* Axis labels */}
            <text x={xStart} y={barY - 5} fontSize="9" fill="rgba(156,163,175,0.8)">0</text>
            <text x={xEnd} y={barY - 5} textAnchor="end" fontSize="9" fill="rgba(156,163,175,0.8)">
              T={calc.clockPeriod.toFixed(2)}ns
            </text>

            {/* Legend */}
            <rect x={xStart} y={70} width={10} height={8} fill="#f59e0b" fillOpacity="0.85" />
            <text x={xStart + 13} y={78} fontSize="8" fill="rgba(156,163,175,0.8)">Critical Path</text>
            <rect x={xStart + 80} y={70} width={10} height={8} fill="#f97316" fillOpacity="0.75" />
            <text x={xStart + 93} y={78} fontSize="8" fill="rgba(156,163,175,0.8)">Skew</text>
            <rect x={xStart + 130} y={70} width={10} height={8} fill={slackColor} fillOpacity="0.75" />
            <text x={xStart + 143} y={78} fontSize="8" fill="rgba(156,163,175,0.8)">Setup Slack</text>
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Section 3: DSP Slice Efficiency ─────────────────────────────────────────

function DspEfficiencySection() {
  const [macOps, setMacOps] = useState(1000);
  const [dspSlices, setDspSlices] = useState(500);
  const [dspFreq, setDspFreq] = useState(300);
  const [pipelineStages, setPipelineStages] = useState(3);

  const calc = useMemo(() => {
    const dspThroughput = (dspSlices * dspFreq) / 1000; // GMAC/s
    const dspUtilNeeded = (macOps / ((dspFreq * dspSlices) / 1000)) * 100;
    const efficiencyFactor = Math.min(pipelineStages * 0.15 + 1, 2.0);
    const effectiveGmacs = dspThroughput * efficiencyFactor;
    const headroom = Math.max(0, effectiveGmacs - macOps / 1000);
    return { dspThroughput, dspUtilNeeded, efficiencyFactor, effectiveGmacs, headroom };
  }, [macOps, dspSlices, dspFreq, pipelineStages]);

  // Bar chart data
  const bars = [
    { label: "Required", value: macOps / 1000, color: "#f97316" },
    { label: "Available", value: calc.dspThroughput, color: "#f59e0b" },
    { label: "Effective", value: calc.effectiveGmacs, color: "#fbbf24" },
    { label: "Headroom", value: calc.headroom, color: "#6b7280" },
  ];

  const maxVal = Math.max(...bars.map((b) => b.value), 1);
  const svgH = 110;
  const barAreaH = 70;
  const barW = 55;
  const gap = 15;
  const xStart = 30;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-gray-900/60 border border-amber-500/30 rounded-xl p-6 flex flex-col gap-6"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/20">
          <BarChart2 className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">DSP Slice Efficiency</h2>
          <p className="text-sm text-gray-400">Multiply-accumulate throughput and pipeline efficiency</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          <SliderRow label="MAC Operations (M/s)" value={macOps} min={1} max={10000} step={50} unit="M/s" onChange={setMacOps} />
          <SliderRow label="DSP Slices Available" value={dspSlices} min={100} max={2000} step={50} onChange={setDspSlices} />
          <SliderRow label="DSP Clock Frequency (MHz)" value={dspFreq} min={100} max={600} step={10} unit="MHz" onChange={setDspFreq} />
          <SliderRow label="Pipeline Stages" value={pipelineStages} min={1} max={6} step={1} onChange={setPipelineStages} />
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="DSP Throughput" value={`${calc.dspThroughput.toFixed(1)} GMAC/s`} sub="base capacity" highlight />
            <StatCard label="DSP Util Needed" value={`${clamp(calc.dspUtilNeeded, 0, 999).toFixed(1)}%`} sub="of available" />
            <StatCard label="Pipeline Bonus" value={`×${calc.efficiencyFactor.toFixed(2)}`} sub={`${pipelineStages} stages`} />
            <StatCard label="Effective GMAC/s" value={`${calc.effectiveGmacs.toFixed(1)}`} sub="with pipeline" />
          </div>

          {/* SVG bar chart */}
          <svg viewBox={`0 0 ${xStart * 2 + bars.length * (barW + gap)} ${svgH}`} className="w-full rounded-lg bg-gray-800/50 p-1">
            {bars.map((bar, i) => {
              const bh = Math.max(2, (bar.value / maxVal) * barAreaH);
              const bx = xStart + i * (barW + gap);
              const by = 5 + barAreaH - bh;
              return (
                <g key={bar.label}>
                  <rect x={bx} y={by} width={barW} height={bh} rx="3" fill={bar.color} fillOpacity="0.85" />
                  <text x={bx + barW / 2} y={by - 3} textAnchor="middle" fontSize="8" fill="rgba(251,191,36,0.9)">
                    {bar.value.toFixed(1)}
                  </text>
                  <text x={bx + barW / 2} y={svgH - 5} textAnchor="middle" fontSize="8" fill="rgba(156,163,175,0.8)">
                    {bar.label}
                  </text>
                </g>
              );
            })}
            <text x={15} y={10} textAnchor="middle" fontSize="8" fill="rgba(156,163,175,0.5)" transform="rotate(-90,15,50)">
              GMAC/s
            </text>
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Section 4: BRAM Configuration ───────────────────────────────────────────

function BramConfigSection() {
  const [dataWidth, setDataWidth] = useState(18);
  const [depthK, setDepthK] = useState(16);
  const [bramBlocks, setBramBlocks] = useState(50);
  const [readLatency, setReadLatency] = useState(2);

  const calc = useMemo(() => {
    const memSizeKb = (dataWidth * depthK * 1024) / 1024; // = dataWidth * depthK bits / 1024 = kb
    const bramsNeeded = Math.ceil(memSizeKb / 18);
    const utilPct = (bramsNeeded / bramBlocks) * 100;
    const readBandwidth = (dataWidth * 200) / 1000; // Gbps at 200 MHz
    return { memSizeKb, bramsNeeded, utilPct, readBandwidth };
  }, [dataWidth, depthK, bramBlocks, readLatency]);

  // Grid of squares: show up to 50 squares
  const gridSize = 50;
  const needed = Math.min(calc.bramsNeeded, gridSize);
  const available = Math.min(bramBlocks, gridSize);
  const cols = 10;
  const rows = Math.ceil(gridSize / cols);
  const sqSize = 22;
  const sqGap = 4;
  const svgW = cols * (sqSize + sqGap) + 20;
  const svgH = rows * (sqSize + sqGap) + 30;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="bg-gray-900/60 border border-amber-500/30 rounded-xl p-6 flex flex-col gap-6"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/20">
          <Grid3X3 className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">BRAM Configuration</h2>
          <p className="text-sm text-gray-400">Block RAM sizing, utilization, and read bandwidth</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          <SliderRow label="Data Width (bits)" value={dataWidth} min={8} max={72} step={1} unit="bits" onChange={setDataWidth} />
          <SliderRow label="Address Depth (k)" value={depthK} min={1} max={128} step={1} unit="k" onChange={setDepthK} />
          <SliderRow label="BRAM Blocks (18kb each)" value={bramBlocks} min={1} max={400} step={5} onChange={setBramBlocks} />
          <SliderRow label="Read Latency (cycles)" value={readLatency} min={1} max={5} step={1} unit="cyc" onChange={setReadLatency} />
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Memory Size" value={`${calc.memSizeKb.toFixed(0)} kb`} sub={`${(calc.memSizeKb / 1024).toFixed(2)} MB`} highlight />
            <StatCard label="BRAMs Needed" value={calc.bramsNeeded.toString()} sub="18kb blocks" />
            <StatCard label="Utilization" value={`${clamp(calc.utilPct, 0, 9999).toFixed(1)}%`} sub="of available" />
            <StatCard label="Read Bandwidth" value={`${calc.readBandwidth.toFixed(2)} Gbps`} sub="@200 MHz" />
          </div>

          {/* Memory map grid */}
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-lg bg-gray-800/50 p-1">
            {Array.from({ length: gridSize }).map((_, idx) => {
              const col = idx % cols;
              const row = Math.floor(idx / cols);
              const x = 10 + col * (sqSize + sqGap);
              const y = 5 + row * (sqSize + sqGap);
              const isFilled = idx < needed;
              const isAvail = idx < available && !isFilled;
              const fill = isFilled
                ? "#f59e0b"
                : isAvail
                ? "rgba(75,85,99,0.6)"
                : "rgba(30,30,30,0.4)";
              return (
                <rect key={idx} x={x} y={y} width={sqSize} height={sqSize} rx="2" fill={fill} />
              );
            })}
            {/* Legend */}
            <rect x={10} y={svgH - 18} width={10} height={10} fill="#f59e0b" rx="1" />
            <text x={23} y={svgH - 8} fontSize="8" fill="rgba(156,163,175,0.8)">Used BRAMs</text>
            <rect x={90} y={svgH - 18} width={10} height={10} fill="rgba(75,85,99,0.6)" rx="1" />
            <text x={103} y={svgH - 8} fontSize="8" fill="rgba(156,163,175,0.8)">Available</text>
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Section 5: Place & Route Congestion ──────────────────────────────────────

function CongestionSection() {
  const [dieArea, setDieArea] = useState(25);
  const [netCount, setNetCount] = useState(30000);
  const [globalChannels, setGlobalChannels] = useState(50);
  const [clockDomains, setClockDomains] = useState(4);

  const calc = useMemo(() => {
    const wireDensity = netCount / dieArea;
    const channelUtil = (netCount / (globalChannels * 1000)) * 100;
    const cdcCrossings = (clockDomains * (clockDomains - 1)) / 2;
    const congestionScore = clamp(channelUtil * 1.2, 0, 100);
    return { wireDensity, channelUtil, cdcCrossings, congestionScore };
  }, [dieArea, netCount, globalChannels, clockDomains]);

  // 8x8 heatmap
  const heatCells = useMemo(() => {
    return Array.from({ length: 64 }).map((_, i) => {
      const seed = i * 7 + Math.round(calc.congestionScore);
      const noise = seededRand(seed) * 30 - 15;
      return clamp(calc.congestionScore + noise, 0, 100);
    });
  }, [calc.congestionScore]);

  function heatColor(val: number): string {
    if (val < 33) {
      const t = val / 33;
      const r = Math.round(34 + t * (251 - 34));
      const g = Math.round(197 + t * (191 - 197));
      const b = Math.round(94 + t * (36 - 94));
      return `rgb(${r},${g},${b})`;
    } else if (val < 66) {
      const t = (val - 33) / 33;
      const r = Math.round(251 + t * (239 - 251));
      const g = Math.round(191 + t * (68 - 191));
      const b = Math.round(36 + t * (68 - 36));
      return `rgb(${r},${g},${b})`;
    } else {
      const t = (val - 66) / 34;
      const r = Math.round(239 + t * (185 - 239));
      const g = Math.round(68 + t * (28 - 68));
      const b = Math.round(68 + t * (28 - 68));
      return `rgb(${r},${g},${b})`;
    }
  }

  const cellSize = 20;
  const svgW = 8 * cellSize + 60;
  const svgH = 8 * cellSize + 20;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-gray-900/60 border border-amber-500/30 rounded-xl p-6 flex flex-col gap-6"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/20">
          <GitBranch className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Place &amp; Route Congestion</h2>
          <p className="text-sm text-gray-400">Wire density, channel utilization, and CDC crossings</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          <SliderRow label="Die Area (mm²)" value={dieArea} min={5} max={100} step={1} unit="mm²" onChange={setDieArea} />
          <SliderRow label="Total Net Count" value={netCount} min={1000} max={100000} step={1000} onChange={setNetCount} />
          <SliderRow label="Global Route Channels" value={globalChannels} min={10} max={100} step={5} onChange={setGlobalChannels} />
          <SliderRow label="Clock Domain Count" value={clockDomains} min={1} max={16} step={1} onChange={setClockDomains} />
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Wire Density" value={`${calc.wireDensity.toFixed(1)}`} sub="nets/mm²" highlight />
            <StatCard label="Channel Util." value={`${calc.channelUtil.toFixed(1)}%`} sub="global routing" />
            <StatCard label="CDC Crossings" value={calc.cdcCrossings.toString()} sub="domain pairs" />
            <StatCard label="Congestion Score" value={`${calc.congestionScore.toFixed(1)}`} sub="/ 100" />
          </div>

          {/* Heatmap */}
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-lg bg-gray-800/50 p-1">
            {heatCells.map((val, i) => {
              const col = i % 8;
              const row = Math.floor(i / 8);
              return (
                <rect
                  key={i}
                  x={col * cellSize + 5}
                  y={row * cellSize + 5}
                  width={cellSize - 2}
                  height={cellSize - 2}
                  rx="1"
                  fill={heatColor(val)}
                  fillOpacity="0.85"
                />
              );
            })}
            {/* Color scale legend */}
            {Array.from({ length: 20 }).map((_, i) => (
              <rect
                key={i}
                x={8 * cellSize + 15}
                y={5 + i * (8 * cellSize / 20)}
                width={12}
                height={8 * cellSize / 20}
                fill={heatColor((i / 19) * 100)}
                fillOpacity="0.9"
              />
            ))}
            <text x={8 * cellSize + 30} y={10} fontSize="8" fill="rgba(156,163,175,0.8)">Hi</text>
            <text x={8 * cellSize + 30} y={8 * cellSize} fontSize="8" fill="rgba(156,163,175,0.8)">Lo</text>
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Formula Cards ────────────────────────────────────────────────────────────

const FORMULA_CARDS = [
  {
    icon: <Layers className="w-4 h-4 text-amber-400" />,
    title: "LUT Utilization",
    formula: "U% = (LUTs_used / LUTs_total) × 100",
    desc: "Percentage of logic resources consumed",
  },
  {
    icon: <Clock className="w-4 h-4 text-amber-400" />,
    title: "Setup Slack",
    formula: "slack = T_clk - T_crit - T_skew",
    desc: "Positive means timing is met",
  },
  {
    icon: <BarChart2 className="w-4 h-4 text-amber-400" />,
    title: "DSP Throughput",
    formula: "GMAC/s = N_DSP × f_DSP(GHz)",
    desc: "Pipeline stages add efficiency multiplier",
  },
  {
    icon: <Grid3X3 className="w-4 h-4 text-amber-400" />,
    title: "BRAM Bandwidth",
    formula: "BW = width_bits × f_clk",
    desc: "Dual-port allows simultaneous read/write",
  },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FpgaArchitecturePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/30">
              <Cpu className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">FPGA Architecture</h1>
              <p className="text-gray-400 text-sm mt-0.5">
                LUT packing, timing closure, DSP efficiency, BRAM configuration, and placement congestion
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { icon: <Layers className="w-3.5 h-3.5" />, label: "LUT Utilization" },
              { icon: <Clock className="w-3.5 h-3.5" />, label: "Timing Closure" },
              { icon: <BarChart2 className="w-3.5 h-3.5" />, label: "DSP Efficiency" },
              { icon: <Grid3X3 className="w-3.5 h-3.5" />, label: "BRAM Config" },
              { icon: <GitBranch className="w-3.5 h-3.5" />, label: "P&R Congestion" },
            ].map(({ icon, label }) => (
              <span
                key={label}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs"
              >
                {icon}
                {label}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Calculator Sections */}
        <LutUtilizationSection />
        <TimingClosureSection />
        <DspEfficiencySection />
        <BramConfigSection />
        <CongestionSection />

        {/* Formula Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Key Formulas</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FORMULA_CARDS.map((card) => (
              <div
                key={card.title}
                className="bg-gray-900/60 border border-amber-500/30 rounded-xl p-4 flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  {card.icon}
                  <span className="text-sm font-semibold text-white">{card.title}</span>
                </div>
                <code className="text-xs font-mono text-amber-400 bg-amber-500/10 rounded px-2 py-1 break-all">
                  {card.formula}
                </code>
                <p className="text-xs text-gray-400">{card.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Footer note */}
        <div className="flex items-center gap-2 text-xs text-gray-600 pb-4">
          <Zap className="w-3.5 h-3.5" />
          <span>All calculations are performed client-side using parameterized models.</span>
        </div>
      </div>
    </div>
  );
}
