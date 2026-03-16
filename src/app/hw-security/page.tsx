"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  Lock,
  Eye,
  Zap,
  AlertTriangle,
  CheckCircle,
  Activity,
  Key,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function fmt(val: number, decimals = 2): string {
  return val.toFixed(decimals);
}

// ─── FormulaCard ─────────────────────────────────────────────────────────────

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

// ─── Section 1 SVG: Trojan Bar Chart ─────────────────────────────────────────

function TrojanBarSVG({
  trojanRisk,
  detectionCoverage,
  residualRisk,
  falsePositiveRate,
}: {
  trojanRisk: number;
  detectionCoverage: number;
  residualRisk: number;
  falsePositiveRate: number;
}) {
  const bars = [
    { label: "Trojan Risk", value: trojanRisk, color: "#ef4444" },
    {
      label: "Detection",
      value: (detectionCoverage * trojanRisk) / 100,
      color: "#f59e0b",
    },
    { label: "Residual", value: residualRisk, color: "#22c55e" },
    { label: "False Pos", value: falsePositiveRate * 100, color: "#a78bfa" },
  ];

  const maxVal = 100;
  const chartH = 100;
  const chartY = 10;
  const barW = 60;
  const gap = 30;
  const startX = 30;

  return (
    <svg viewBox="0 0 400 160" className="w-full" style={{ maxHeight: 180 }}>
      {/* Y-axis */}
      <line x1={25} y1={chartY} x2={25} y2={chartY + chartH} stroke="#334155" strokeWidth={1} />
      {/* X-axis */}
      <line x1={25} y1={chartY + chartH} x2={380} y2={chartY + chartH} stroke="#334155" strokeWidth={1} />
      {/* Y labels */}
      {[0, 25, 50, 75, 100].map((tick) => {
        const y = chartY + chartH - (tick / maxVal) * chartH;
        return (
          <g key={tick}>
            <line x1={22} y1={y} x2={25} y2={y} stroke="#475569" strokeWidth={1} />
            <text x={19} y={y + 3} textAnchor="end" fontSize={7} fill="#64748b" fontFamily="monospace">
              {tick}
            </text>
          </g>
        );
      })}
      {bars.map((bar, i) => {
        const x = startX + i * (barW + gap);
        const barH = (clamp(bar.value, 0, 100) / maxVal) * chartH;
        const y = chartY + chartH - barH;
        return (
          <g key={bar.label}>
            <rect x={x} y={y} width={barW} height={barH} rx={3} fill={bar.color} opacity={0.8} />
            <text x={x + barW / 2} y={chartY + chartH + 12} textAnchor="middle" fontSize={7} fill="#94a3b8" fontFamily="monospace">
              {bar.label}
            </text>
            <text x={x + barW / 2} y={Math.max(y - 3, chartY + 8)} textAnchor="middle" fontSize={8} fill={bar.color} fontFamily="monospace" fontWeight="bold">
              {fmt(bar.value, 1)}
            </text>
          </g>
        );
      })}
      {/* Title */}
      <text x={200} y={155} textAnchor="middle" fontSize={8} fill="#64748b" fontFamily="monospace">
        Hardware Trojan Risk Metrics (0–100 normalized)
      </text>
    </svg>
  );
}

// ─── Section 2 SVG: DPA Line Plot ────────────────────────────────────────────

function DPALineSVG({
  currentMeasurements,
  noiseStdDev,
  keyBits,
  cmFactor,
}: {
  currentMeasurements: number;
  noiseStdDev: number;
  keyBits: number;
  cmFactor: number;
}) {
  const W = 360;
  const H = 120;
  const padL = 32;
  const padB = 20;
  const padT = 10;
  const plotW = W - padL - 10;
  const plotH = H - padB - padT;
  const steps = 20;
  const xMin = 100;
  const xMax = 10000;

  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const m = xMin + (i / steps) * (xMax - xMin);
    const snr = m / (noiseStdDev * keyBits / 8);
    const attackSuccess = 1 - Math.exp(-snr / 50);
    const eff = attackSuccess * cmFactor * 100;
    const x = padL + (i / steps) * plotW;
    const y = padT + plotH - (clamp(eff, 0, 100) / 100) * plotH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  // Current measurement x position
  const curX = padL + ((currentMeasurements - xMin) / (xMax - xMin)) * plotW;

  // 50% line y position
  const fiftyY = padT + plotH - 0.5 * plotH;

  return (
    <svg viewBox="0 0 400 160" className="w-full" style={{ maxHeight: 180 }}>
      {/* Axes */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#334155" strokeWidth={1} />
      <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#334155" strokeWidth={1} />
      {/* Y ticks */}
      {[0, 25, 50, 75, 100].map((tick) => {
        const y = padT + plotH - (tick / 100) * plotH;
        return (
          <g key={tick}>
            <line x1={padL - 3} y1={y} x2={padL} y2={y} stroke="#475569" strokeWidth={1} />
            <text x={padL - 5} y={y + 3} textAnchor="end" fontSize={7} fill="#64748b" fontFamily="monospace">{tick}</text>
          </g>
        );
      })}
      {/* X ticks */}
      {[100, 2500, 5000, 7500, 10000].map((tick) => {
        const x = padL + ((tick - xMin) / (xMax - xMin)) * plotW;
        return (
          <g key={tick}>
            <line x1={x} y1={padT + plotH} x2={x} y2={padT + plotH + 3} stroke="#475569" strokeWidth={1} />
            <text x={x} y={padT + plotH + 11} textAnchor="middle" fontSize={6} fill="#64748b" fontFamily="monospace">{tick >= 1000 ? `${tick / 1000}k` : tick}</text>
          </g>
        );
      })}
      {/* 50% dashed horizontal */}
      <line x1={padL} y1={fiftyY} x2={padL + plotW} y2={fiftyY} stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
      <text x={padL + plotW + 2} y={fiftyY + 3} fontSize={7} fill="#f59e0b" fontFamily="monospace">50%</text>
      {/* Line plot */}
      <polyline points={points.join(" ")} fill="none" stroke="#ef4444" strokeWidth={1.5} />
      {/* Vertical dashed at current measurements */}
      <line x1={curX} y1={padT} x2={curX} y2={padT + plotH} stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4 3" />
      <text x={curX + 2} y={padT + 8} fontSize={7} fill="#60a5fa" fontFamily="monospace">N={currentMeasurements}</text>
      {/* Axis labels */}
      <text x={padL + plotW / 2} y={padT + plotH + 20} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily="monospace">Measurements</text>
      <text x={8} y={padT + plotH / 2} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily="monospace" transform={`rotate(-90, 8, ${padT + plotH / 2})`}>Success %</text>
    </svg>
  );
}

// ─── Section 3 SVG: Secure Boot Chain ────────────────────────────────────────

function SecureBootSVG({
  chainLength,
  securityLevel,
}: {
  chainLength: number;
  securityLevel: number;
}) {
  const labels = ["ROM", "BL1", "BL2", "BL3", "TEE", "OS"];
  const boxColor = securityLevel > 200 ? "#22c55e" : securityLevel > 100 ? "#f59e0b" : "#ef4444";
  const boxStroke = securityLevel > 200 ? "#4ade80" : securityLevel > 100 ? "#fbbf24" : "#f87171";

  const totalW = 380;
  const boxW = Math.min(55, (totalW - 20) / chainLength - 10);
  const spacing = (totalW - 20 - boxW) / Math.max(chainLength - 1, 1);
  const startX = 10 + boxW / 2;
  const cy = 55;

  return (
    <svg viewBox="0 0 400 120" className="w-full" style={{ maxHeight: 140 }}>
      {/* Lock icon circle at start */}
      <circle cx={startX - boxW / 2 - 4} cy={cy} r={6} fill="none" stroke="#94a3b8" strokeWidth={1} />
      {Array.from({ length: chainLength }).map((_, i) => {
        const cx = startX + i * spacing;
        return (
          <g key={i}>
            {/* Arrow connector */}
            {i > 0 && (
              <>
                <line
                  x1={cx - spacing + boxW / 2 + 2}
                  y1={cy}
                  x2={cx - boxW / 2 - 6}
                  y2={cy}
                  stroke="#475569"
                  strokeWidth={1.5}
                />
                <polygon
                  points={`${cx - boxW / 2 - 8},${cy - 3} ${cx - boxW / 2 - 2},${cy} ${cx - boxW / 2 - 8},${cy + 3}`}
                  fill="#475569"
                />
              </>
            )}
            {/* Box */}
            <rect
              x={cx - boxW / 2}
              y={cy - 16}
              width={boxW}
              height={32}
              rx={4}
              fill={boxColor + "33"}
              stroke={boxStroke}
              strokeWidth={1.5}
            />
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize={9} fill={boxStroke} fontFamily="monospace" fontWeight="bold">
              {labels[i] || `BL${i}`}
            </text>
            {/* Stage number */}
            <text x={cx} y={cy + 26} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily="monospace">
              Stage {i + 1}
            </text>
          </g>
        );
      })}
      {/* Verify arrows below */}
      {Array.from({ length: chainLength }).map((_, i) => {
        const cx = startX + i * spacing;
        return (
          <g key={`v${i}`}>
            <line x1={cx} y1={cy + 16} x2={cx} y2={cy + 34} stroke={boxStroke} strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />
            <text x={cx} y={cy + 44} textAnchor="middle" fontSize={6} fill="#64748b" fontFamily="monospace">verify</text>
          </g>
        );
      })}
      {/* Legend */}
      <text x={200} y={112} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily="monospace">
        Secure Boot Chain — {chainLength} stage{chainLength > 1 ? "s" : ""} — color: {securityLevel > 200 ? "HIGH" : securityLevel > 100 ? "MED" : "LOW"} security
      </text>
    </svg>
  );
}

// ─── Section 4 SVG: PUF Scatter Plot ─────────────────────────────────────────

function PUFScatterSVG({
  challengeBits,
  uniqueness,
}: {
  challengeBits: number;
  uniqueness: number;
}) {
  const W = 360;
  const H = 130;
  const padL = 30;
  const padB = 20;
  const padT = 10;
  const plotW = W - padL - 10;
  const plotH = H - padB - padT;

  // Deterministic dots seeded from challengeBits
  const dots = useMemo(() => {
    const pts = [];
    for (let i = 0; i < 64; i++) {
      // Simple deterministic pseudo-random using challenge bits as seed
      const seed = challengeBits * 7919 + i * 1031;
      const x = ((seed * 1234567 + i * 999983) % 1000) / 1000;
      const y = ((seed * 7654321 + i * 888887) % 1000) / 1000;
      const dist = Math.abs(y - 0.5); // distance from ideal 50%
      pts.push({ x, y, dist });
    }
    return pts;
  }, [challengeBits]);

  return (
    <svg viewBox="0 0 400 160" className="w-full" style={{ maxHeight: 180 }}>
      {/* Border */}
      <rect x={padL} y={padT} width={plotW} height={plotH} rx={3} fill="#0f172a" stroke="#334155" strokeWidth={1} />
      {/* 50% ideal line */}
      <line
        x1={padL}
        y1={padT + plotH / 2}
        x2={padL + plotW}
        y2={padT + plotH / 2}
        stroke="#22c55e"
        strokeWidth={1}
        strokeDasharray="4 3"
        opacity={0.5}
      />
      <text x={padL + plotW + 2} y={padT + plotH / 2 + 3} fontSize={7} fill="#22c55e" fontFamily="monospace">50%</text>
      {/* Dots */}
      {dots.map((d, i) => {
        const cx = padL + d.x * plotW;
        const cy = padT + d.y * plotH;
        const r = 2.5;
        const color = d.dist < 0.1 ? "#22c55e" : d.dist < 0.25 ? "#f59e0b" : "#ef4444";
        return <circle key={i} cx={cx} cy={cy} r={r} fill={color} opacity={0.7} />;
      })}
      {/* Axes */}
      <text x={padL + plotW / 2} y={padT + plotH + 14} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily="monospace">Challenge Index</text>
      <text x={10} y={padT + plotH / 2} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily="monospace" transform={`rotate(-90, 10, ${padT + plotH / 2})`}>Response</text>
      {/* Current uniqueness */}
      <text x={padL + plotW / 2} y={152} textAnchor="middle" fontSize={8} fill="#a78bfa" fontFamily="monospace">
        Uniqueness ≈ {fmt(uniqueness, 1)}% (ideal: 50%)
      </text>
    </svg>
  );
}

// ─── Section 5 SVG: Fault Injection Radar ────────────────────────────────────

function FaultRadarSVG({
  clockFaultProb,
  voltageFaultProb,
  laserFaultProb,
  emsFaultProb,
}: {
  clockFaultProb: number;
  voltageFaultProb: number;
  laserFaultProb: number;
  emsFaultProb: number;
}) {
  const cx = 200;
  const cy = 80;
  const r = 60;

  // 4 axes at 0°, 90°, 180°, 270° (top, right, bottom, left)
  const angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  const labels = ["Clock", "Voltage", "Laser", "EMS"];
  const values = [
    clockFaultProb / 100,
    voltageFaultProb / 100,
    laserFaultProb / 100,
    emsFaultProb / 100,
  ];

  // Outer reference polygon points
  const outerPts = angles.map((a) => ({
    x: cx + r * Math.cos(a),
    y: cy + r * Math.sin(a),
  }));

  // Inner polygon at 50% reference
  const midPts = angles.map((a) => ({
    x: cx + r * 0.5 * Math.cos(a),
    y: cy + r * 0.5 * Math.sin(a),
  }));

  // Data polygon
  const dataPts = angles.map((a, i) => ({
    x: cx + r * values[i] * Math.cos(a),
    y: cy + r * values[i] * Math.sin(a),
  }));

  const ptStr = (pts: { x: number; y: number }[]) =>
    pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <svg viewBox="0 0 400 160" className="w-full" style={{ maxHeight: 180 }}>
      {/* Outer reference */}
      <polygon points={ptStr(outerPts)} fill="none" stroke="#334155" strokeWidth={1.5} />
      {/* Mid reference */}
      <polygon points={ptStr(midPts)} fill="none" stroke="#334155" strokeWidth={1} strokeDasharray="3 3" />
      {/* Axes */}
      {angles.map((a, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={outerPts[i].x}
          y2={outerPts[i].y}
          stroke="#475569"
          strokeWidth={1}
        />
      ))}
      {/* Data polygon */}
      <polygon points={ptStr(dataPts)} fill="#ef4444" fillOpacity={0.3} stroke="#ef4444" strokeWidth={1.5} />
      {/* Data dots */}
      {dataPts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#ef4444" />
      ))}
      {/* Labels */}
      {angles.map((a, i) => {
        const lx = cx + (r + 16) * Math.cos(a);
        const ly = cy + (r + 16) * Math.sin(a);
        return (
          <g key={i}>
            <text x={lx} y={ly + 3} textAnchor="middle" fontSize={8} fill="#94a3b8" fontFamily="monospace">
              {labels[i]}
            </text>
            <text x={lx} y={ly + 12} textAnchor="middle" fontSize={7} fill="#ef4444" fontFamily="monospace">
              {fmt(values[i] * 100, 0)}%
            </text>
          </g>
        );
      })}
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={2} fill="#64748b" />
      {/* Title */}
      <text x={200} y={152} textAnchor="middle" fontSize={8} fill="#64748b" fontFamily="monospace">
        Fault Injection Attack Surface — Radar Chart
      </text>
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HWSecurityPage() {
  // ── Section 1: Hardware Trojan Detection ──────────────────────────────────
  const [activationProbability, setActivationProbability] = useState(0.1);
  const [payloadSeverity, setPayloadSeverity] = useState(5);
  const [triggerRarity, setTriggerRarity] = useState(100);
  const [redundancyOverhead, setRedundancyOverhead] = useState(30);

  // ── Section 2: Side-Channel Power Analysis ────────────────────────────────
  const [keyBits, setKeyBits] = useState(128);
  const [measurements, setMeasurements] = useState(1000);
  const [noiseStdDev, setNoiseStdDev] = useState(0.1);
  const [countermeasures, setCountermeasures] = useState(0);

  // ── Section 3: Secure Boot Chain ─────────────────────────────────────────
  const [chainLength, setChainLength] = useState(3);
  const [hashBits, setHashBits] = useState(256);
  const [signatureBits, setSignatureBits] = useState(2048);
  const [rollbackProtection, setRollbackProtection] = useState(true);
  const [debugLock, setDebugLock] = useState(true);
  const [encryptedStorage, setEncryptedStorage] = useState(false);

  // ── Section 4: PUF ───────────────────────────────────────────────────────
  const [challengeBits, setChallengeBits] = useState(8);
  const [pufResponses, setPufResponses] = useState(256);
  const [temperature, setTemperature] = useState(25);
  const [supplyVariation, setSupplyVariation] = useState(2);

  // ── Section 5: Fault Injection ───────────────────────────────────────────
  const [clockGlitchWidth, setClockGlitchWidth] = useState(10);
  const [voltageGlitch, setVoltageGlitch] = useState(100);
  const [laserPower, setLaserPower] = useState(20);
  const [emsDistance, setEmsDistance] = useState(50);

  // ── Section 1 Derived ─────────────────────────────────────────────────────
  const trojanMetrics = useMemo(() => {
    const trojanRisk = clamp(
      (activationProbability * payloadSeverity) / triggerRarity * 1000,
      0,
      100
    );
    const detectionCoverage = (1 - Math.exp(-redundancyOverhead / 30)) * 100;
    const falsePositiveRate = 0.05 * (1 - redundancyOverhead / 100);
    const residualRisk = trojanRisk * (1 - detectionCoverage / 100);
    return { trojanRisk, detectionCoverage, falsePositiveRate, residualRisk };
  }, [activationProbability, payloadSeverity, triggerRarity, redundancyOverhead]);

  // ── Section 2 Derived ─────────────────────────────────────────────────────
  const dpaMetrics = useMemo(() => {
    const snr = measurements / (noiseStdDev * keyBits / 8);
    const attackSuccess = 1 - Math.exp(-snr / 50);
    const cmFactorArr = [1, 0.3, 0.25, 0.2, 0.05];
    const cmFactor = cmFactorArr[countermeasures] ?? 1;
    const effectiveSuccess = attackSuccess * cmFactor * 100;
    const theoreticalMeasurements = noiseStdDev * noiseStdDev * keyBits / 8 * 50;
    return { snr, attackSuccess, cmFactor, effectiveSuccess, theoreticalMeasurements };
  }, [keyBits, measurements, noiseStdDev, countermeasures]);

  // ── Section 3 Derived ─────────────────────────────────────────────────────
  const bootMetrics = useMemo(() => {
    const bootTime =
      chainLength * (hashBits / 256 * 10 + signatureBits / 2048 * 50);
    const securityLevel =
      hashBits / 8 +
      signatureBits / 64 +
      (rollbackProtection ? 40 : 0) +
      (debugLock ? 30 : 0) +
      (encryptedStorage ? 20 : 0);
    const attackSurface = 100 / securityLevel * 500;
    const chainIntegrity =
      (1 - Math.pow(1 - Math.pow(2, -hashBits), chainLength)) * 100;
    return { bootTime, securityLevel, attackSurface, chainIntegrity };
  }, [chainLength, hashBits, signatureBits, rollbackProtection, debugLock, encryptedStorage]);

  // ── Section 4 Derived ─────────────────────────────────────────────────────
  const pufMetrics = useMemo(() => {
    const uniqueness = 50 + Math.sin(challengeBits * 1.3) * 5;
    const reliability = 99.9 - temperature * 0.05 - supplyVariation * 0.8;
    const deterministicOffset =
      ((challengeBits * 31 + pufResponses * 17 + temperature) % 100) / 5000 - 0.01;
    const bitAliasing = clamp(0.5 + deterministicOffset, 0.48, 0.52);
    const entropy = challengeBits * (reliability / 100);
    const cloningDifficulty = Math.pow(2, entropy);
    return { uniqueness, reliability, bitAliasing, entropy, cloningDifficulty };
  }, [challengeBits, pufResponses, temperature, supplyVariation]);

  // ── Section 5 Derived ─────────────────────────────────────────────────────
  const faultMetrics = useMemo(() => {
    const clockFaultProb = clamp(clockGlitchWidth * 2, 0, 100);
    const voltageFaultProb = clamp(voltageGlitch / 5, 0, 100);
    const laserFaultProb = laserPower * 0.9;
    const emsFaultProb = clamp(100 - emsDistance * 1.5, 0, 100);
    let combinedRisk =
      1 -
      ((1 - clockFaultProb / 100) *
        (1 - voltageFaultProb / 100) *
        (1 - laserFaultProb / 100) *
        (1 - emsFaultProb / 100));
    combinedRisk *= 100;
    return { clockFaultProb, voltageFaultProb, laserFaultProb, emsFaultProb, combinedRisk };
  }, [clockGlitchWidth, voltageGlitch, laserPower, emsDistance]);

  const cmLabels = ["None", "Masking", "Hiding", "Shuffling", "All"];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="bg-red-500/20 rounded-xl border border-red-500/30 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-red-400" />
            <h1 className="text-3xl font-bold text-red-400">Hardware Security</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Hardware Trojan detection, side-channel analysis, secure boot chains, PUF reliability, and fault injection modeling
          </p>
        </div>

        {/* ── Section 1: Hardware Trojan Detection ────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-card rounded-xl border border-border p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h2 className="text-xl font-semibold">Hardware Trojan Detection</h2>
            {/* Badge */}
            <span
              className={`ml-auto px-3 py-0.5 rounded-full text-xs font-bold ${
                trojanMetrics.residualRisk > 50
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : trojanMetrics.residualRisk > 20
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "bg-green-500/20 text-green-400 border border-green-500/30"
              }`}
            >
              {trojanMetrics.residualRisk > 50
                ? "HIGH RISK"
                : trojanMetrics.residualRisk > 20
                ? "MODERATE"
                : "LOW RISK"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Activation Probability</span>
                  <span className="font-mono text-red-400">{activationProbability.toFixed(2)}</span>
                </label>
                <input type="range" min={0.01} max={0.99} step={0.01} value={activationProbability}
                  onChange={(e) => setActivationProbability(Number(e.target.value))}
                  className="w-full accent-red-500" />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Payload Severity (1–10)</span>
                  <span className="font-mono text-red-400">{payloadSeverity}</span>
                </label>
                <input type="range" min={1} max={10} step={1} value={payloadSeverity}
                  onChange={(e) => setPayloadSeverity(Number(e.target.value))}
                  className="w-full accent-red-500" />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Trigger Rarity (cycles)</span>
                  <span className="font-mono text-red-400">{triggerRarity}</span>
                </label>
                <input type="range" min={1} max={1000} step={1} value={triggerRarity}
                  onChange={(e) => setTriggerRarity(Number(e.target.value))}
                  className="w-full accent-red-500" />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Redundancy Overhead (%)</span>
                  <span className="font-mono text-red-400">{redundancyOverhead}%</span>
                </label>
                <input type="range" min={0} max={100} step={1} value={redundancyOverhead}
                  onChange={(e) => setRedundancyOverhead(Number(e.target.value))}
                  className="w-full accent-red-500" />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Trojan Risk</p>
                  <p className="font-mono text-red-400 text-lg font-bold">{fmt(trojanMetrics.trojanRisk, 1)}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Detection Coverage</p>
                  <p className="font-mono text-green-400 text-lg font-bold">{fmt(trojanMetrics.detectionCoverage, 1)}%</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Residual Risk</p>
                  <p className="font-mono text-amber-400 text-lg font-bold">{fmt(trojanMetrics.residualRisk, 1)}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">False Positive Rate</p>
                  <p className="font-mono text-purple-400 text-lg font-bold">{fmt(trojanMetrics.falsePositiveRate * 100, 1)}%</p>
                </div>
              </div>
            </div>
            <div>
              <TrojanBarSVG
                trojanRisk={trojanMetrics.trojanRisk}
                detectionCoverage={trojanMetrics.detectionCoverage}
                residualRisk={trojanMetrics.residualRisk}
                falsePositiveRate={trojanMetrics.falsePositiveRate}
              />
            </div>
          </div>
        </motion.div>

        {/* ── Section 2: Side-Channel Power Analysis ──────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-xl border border-border p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-orange-400" />
            <h2 className="text-xl font-semibold">Side-Channel Power Analysis (SPA/DPA)</h2>
            <span
              className={`ml-auto px-3 py-0.5 rounded-full text-xs font-bold ${
                dpaMetrics.effectiveSuccess > 50
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-green-500/20 text-green-400 border border-green-500/30"
              }`}
            >
              {dpaMetrics.effectiveSuccess > 50 ? "VULNERABLE" : "HARDENED"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Key Size (bits)</span>
                  <span className="font-mono text-orange-400">{keyBits}</span>
                </label>
                <input type="range" min={64} max={256} step={8} value={keyBits}
                  onChange={(e) => setKeyBits(Number(e.target.value))}
                  className="w-full accent-orange-500" />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Measurements</span>
                  <span className="font-mono text-orange-400">{measurements.toLocaleString()}</span>
                </label>
                <input type="range" min={100} max={10000} step={100} value={measurements}
                  onChange={(e) => setMeasurements(Number(e.target.value))}
                  className="w-full accent-orange-500" />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Noise Std Dev (σ)</span>
                  <span className="font-mono text-orange-400">{noiseStdDev.toFixed(2)}</span>
                </label>
                <input type="range" min={0.01} max={1.0} step={0.01} value={noiseStdDev}
                  onChange={(e) => setNoiseStdDev(Number(e.target.value))}
                  className="w-full accent-orange-500" />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Countermeasures</span>
                  <span className="font-mono text-orange-400">{cmLabels[countermeasures]}</span>
                </label>
                <input type="range" min={0} max={4} step={1} value={countermeasures}
                  onChange={(e) => setCountermeasures(Number(e.target.value))}
                  className="w-full accent-orange-500" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  {cmLabels.map((l) => <span key={l}>{l}</span>)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">SNR</p>
                  <p className="font-mono text-orange-400 text-lg font-bold">{fmt(dpaMetrics.snr, 1)}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Attack Success</p>
                  <p className={`font-mono text-lg font-bold ${dpaMetrics.effectiveSuccess > 50 ? "text-red-400" : "text-green-400"}`}>
                    {fmt(dpaMetrics.effectiveSuccess, 1)}%
                  </p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3 col-span-2">
                  <p className="text-muted-foreground text-xs">Measurements for 63% success (no countermeasures)</p>
                  <p className="font-mono text-amber-400 text-sm font-bold">{fmt(dpaMetrics.theoreticalMeasurements, 0)}</p>
                </div>
              </div>
            </div>
            <div>
              <DPALineSVG
                currentMeasurements={measurements}
                noiseStdDev={noiseStdDev}
                keyBits={keyBits}
                cmFactor={dpaMetrics.cmFactor}
              />
            </div>
          </div>
        </motion.div>

        {/* ── Section 3: Secure Boot Chain ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card rounded-xl border border-border p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-semibold">Secure Boot Chain</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Chain Length (stages)</span>
                  <span className="font-mono text-blue-400">{chainLength}</span>
                </label>
                <input type="range" min={1} max={6} step={1} value={chainLength}
                  onChange={(e) => setChainLength(Number(e.target.value))}
                  className="w-full accent-blue-500" />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Hash Size (bits)</span>
                  <span className="font-mono text-blue-400">{hashBits}</span>
                </label>
                <input type="range" min={128} max={512} step={64} value={hashBits}
                  onChange={(e) => setHashBits(Number(e.target.value))}
                  className="w-full accent-blue-500" />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Signature Size (bits)</span>
                  <span className="font-mono text-blue-400">{signatureBits}</span>
                </label>
                <input type="range" min={1024} max={4096} step={256} value={signatureBits}
                  onChange={(e) => setSignatureBits(Number(e.target.value))}
                  className="w-full accent-blue-500" />
              </div>
              {/* Toggles */}
              <div className="space-y-2">
                {[
                  { label: "Rollback Protection", value: rollbackProtection, setter: setRollbackProtection },
                  { label: "Debug Lock", value: debugLock, setter: setDebugLock },
                  { label: "Encrypted Storage", value: encryptedStorage, setter: setEncryptedStorage },
                ].map(({ label, value, setter }) => (
                  <label key={label} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => setter(e.target.checked)}
                      className="w-4 h-4 accent-blue-500"
                    />
                    <span className="text-sm text-muted-foreground">{label}</span>
                    {value && <CheckCircle className="w-4 h-4 text-green-400 ml-auto" />}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Boot Time</p>
                  <p className="font-mono text-blue-400 font-bold">{fmt(bootMetrics.bootTime, 0)} ms</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Security Lvl</p>
                  <p className="font-mono text-green-400 font-bold">{fmt(bootMetrics.securityLevel, 0)}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Attack Surface</p>
                  <p className="font-mono text-amber-400 font-bold">{fmt(bootMetrics.attackSurface, 1)}</p>
                </div>
              </div>
            </div>
            <div>
              <SecureBootSVG chainLength={chainLength} securityLevel={bootMetrics.securityLevel} />
              <div className="mt-3 bg-muted/20 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Chain Integrity</p>
                <p className="font-mono text-blue-400 font-bold">{fmt(bootMetrics.chainIntegrity, 8)}%</p>
                <p className="text-xs text-muted-foreground mt-1">≈ 100% — collision resistance of {hashBits}-bit hash across {chainLength} stages</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Section 4: PUF ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-xl border border-border p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold">Physical Unclonable Function (PUF)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Challenge Bits</span>
                  <span className="font-mono text-purple-400">{challengeBits}</span>
                </label>
                <input type="range" min={4} max={12} step={1} value={challengeBits}
                  onChange={(e) => setChallengeBits(Number(e.target.value))}
                  className="w-full accent-purple-500" />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">CRP Count</span>
                  <span className="font-mono text-purple-400">{pufResponses}</span>
                </label>
                <input type="range" min={16} max={1024} step={16} value={pufResponses}
                  onChange={(e) => setPufResponses(Number(e.target.value))}
                  className="w-full accent-purple-500" />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Temperature (°C)</span>
                  <span className="font-mono text-purple-400">{temperature}°C</span>
                </label>
                <input type="range" min={-40} max={125} step={1} value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="w-full accent-purple-500" />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Supply Variation (%)</span>
                  <span className="font-mono text-purple-400">{supplyVariation}%</span>
                </label>
                <input type="range" min={0} max={10} step={0.1} value={supplyVariation}
                  onChange={(e) => setSupplyVariation(Number(e.target.value))}
                  className="w-full accent-purple-500" />
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Uniqueness</p>
                  <p className="font-mono text-purple-400 font-bold">{fmt(pufMetrics.uniqueness, 2)}%</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Reliability</p>
                  <p className={`font-mono font-bold ${pufMetrics.reliability > 95 ? "text-green-400" : "text-amber-400"}`}>
                    {fmt(pufMetrics.reliability, 2)}%
                  </p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Entropy</p>
                  <p className="font-mono text-blue-400 font-bold">{fmt(pufMetrics.entropy, 2)} b</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3 col-span-2">
                  <p className="text-muted-foreground text-xs">Bit Aliasing</p>
                  <p className="font-mono text-amber-400 font-bold">{fmt(pufMetrics.bitAliasing, 4)}%</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Cloning Ops</p>
                  <p className="font-mono text-red-400 font-bold text-xs">2^{fmt(pufMetrics.entropy, 1)}</p>
                </div>
              </div>
            </div>
            <div>
              <PUFScatterSVG
                challengeBits={challengeBits}
                uniqueness={pufMetrics.uniqueness}
              />
            </div>
          </div>
        </motion.div>

        {/* ── Section 5: Fault Injection Analysis ─────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card rounded-xl border border-border p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-yellow-400" />
            <h2 className="text-xl font-semibold">Fault Injection Analysis</h2>
            <span
              className={`ml-auto px-3 py-0.5 rounded-full text-xs font-bold ${
                faultMetrics.combinedRisk > 70
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : faultMetrics.combinedRisk > 30
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "bg-green-500/20 text-green-400 border border-green-500/30"
              }`}
            >
              {faultMetrics.combinedRisk > 70
                ? "HIGH EXPOSURE"
                : faultMetrics.combinedRisk > 30
                ? "MODERATE"
                : "LOW EXPOSURE"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Clock Glitch Width (ns)</span>
                  <span className="font-mono text-yellow-400">{clockGlitchWidth} ns</span>
                </label>
                <input type="range" min={1} max={50} step={1} value={clockGlitchWidth}
                  onChange={(e) => setClockGlitchWidth(Number(e.target.value))}
                  className="w-full accent-yellow-500" />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Voltage Glitch (mV)</span>
                  <span className="font-mono text-yellow-400">{voltageGlitch} mV</span>
                </label>
                <input type="range" min={0} max={500} step={10} value={voltageGlitch}
                  onChange={(e) => setVoltageGlitch(Number(e.target.value))}
                  className="w-full accent-yellow-500" />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Laser Power (%)</span>
                  <span className="font-mono text-yellow-400">{laserPower}%</span>
                </label>
                <input type="range" min={0} max={100} step={1} value={laserPower}
                  onChange={(e) => setLaserPower(Number(e.target.value))}
                  className="w-full accent-yellow-500" />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">EMS Distance (mm)</span>
                  <span className="font-mono text-yellow-400">{emsDistance} mm</span>
                </label>
                <input type="range" min={1} max={100} step={1} value={emsDistance}
                  onChange={(e) => setEmsDistance(Number(e.target.value))}
                  className="w-full accent-yellow-500" />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "Clock Fault", value: faultMetrics.clockFaultProb },
                  { label: "Voltage Fault", value: faultMetrics.voltageFaultProb },
                  { label: "Laser Fault", value: faultMetrics.laserFaultProb },
                  { label: "EMS Fault", value: faultMetrics.emsFaultProb },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-muted/20 rounded-lg p-3">
                    <p className="text-muted-foreground text-xs">{label}</p>
                    <p className={`font-mono font-bold ${value > 50 ? "text-red-400" : value > 20 ? "text-amber-400" : "text-green-400"}`}>
                      {fmt(value, 1)}%
                    </p>
                  </div>
                ))}
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 col-span-2">
                  <p className="text-muted-foreground text-xs">Combined Risk</p>
                  <p className="font-mono text-red-400 text-xl font-bold">{fmt(faultMetrics.combinedRisk, 1)}%</p>
                </div>
              </div>
            </div>
            <div>
              <FaultRadarSVG
                clockFaultProb={faultMetrics.clockFaultProb}
                voltageFaultProb={faultMetrics.voltageFaultProb}
                laserFaultProb={faultMetrics.laserFaultProb}
                emsFaultProb={faultMetrics.emsFaultProb}
              />
            </div>
          </div>
        </motion.div>

        {/* ── Formula Reference ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-xl border border-border p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-5 h-5 text-red-400" />
            <h2 className="text-xl font-semibold">Formula Reference</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormulaCard
              label="DPA SNR"
              formula="SNR = N_meas / (σ²_noise × key_bytes); P_success ∝ 1−e^{−SNR/50}"
              explanation="More measurements and lower noise increase DPA attack success probability exponentially"
            />
            <FormulaCard
              label="PUF Uniqueness"
              formula="HD(R_i, R_j) / n ≈ 50%; reliability: 1 − Pr[bit flip | ΔT, ΔV]"
              explanation="Ideal PUF responses differ in exactly 50% of bits; reliability degrades with temperature and voltage variation"
            />
            <FormulaCard
              label="Secure Boot"
              formula="chain_integrity = 1−(1−2^{−h})^k; where h=hash bits, k=chain length"
              explanation="Each stage verifies the next using a hash chain; collision resistance compounds across all stages"
            />
            <FormulaCard
              label="Fault Model"
              formula="P_combined = 1 − ∏(1 − p_i) across all injection vectors"
              explanation="Combined fault probability compounds independently across clock, voltage, laser, and EMS attack vectors"
            />
          </div>
        </motion.div>

      </div>
    </main>
  );
}
