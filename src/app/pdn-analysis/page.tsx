"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Zap,
  Activity,
  BarChart2,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Settings,
  Battery,
} from "lucide-react";

// ── Reusable Components ────────────────────────────────────────────────────────

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="text-cyan-400 font-mono font-semibold">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-cyan-500 h-2 rounded-lg"
      />
      <div className="flex justify-between text-xs text-slate-500">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
}) {
  return (
    <div className="bg-slate-800/60 rounded-lg p-3 border border-cyan-500/30">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="text-lg font-bold text-cyan-400 font-mono">
        {value}
        {unit && <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

// ── Section 1: Target Impedance & VRM Response ────────────────────────────────

function Section1() {
  const [supplyVoltage, setSupplyVoltage] = useState(1.0);
  const [maxCurrent, setMaxCurrent] = useState(20);
  const [ripplePct, setRipplePct] = useState(3);
  const [vrmBandwidth, setVrmBandwidth] = useState(100);

  const calc = useMemo(() => {
    const rippleVoltage_mV = (supplyVoltage * ripplePct) / 100 * 1000;
    const targetImpedance_mOhm = rippleVoltage_mV / maxCurrent;
    const vrmResponseTime_us = 1000 / vrmBandwidth;
    const impedanceMargin = targetImpedance_mOhm / 5;
    return { rippleVoltage_mV, targetImpedance_mOhm, vrmResponseTime_us, impedanceMargin };
  }, [supplyVoltage, maxCurrent, ripplePct, vrmBandwidth]);

  const badge = useMemo(() => {
    if (calc.targetImpedance_mOhm > 10) return { label: "ADEQUATE", color: "text-green-400" };
    if (calc.targetImpedance_mOhm > 5) return { label: "MARGINAL", color: "text-yellow-400" };
    return { label: "INSUFFICIENT", color: "text-red-400" };
  }, [calc.targetImpedance_mOhm]);

  // SVG: Log-frequency impedance profile
  const svgWidth = 500;
  const svgHeight = 160;
  const padL = 50;
  const padR = 20;
  const padT = 15;
  const padB = 30;
  const plotW = svgWidth - padL - padR;
  const plotH = svgHeight - padT - padB;

  // X: 1kHz to 1GHz (7 decades, log scale)
  const freqMin = 1e3;
  const freqMax = 1e9;
  const logX = (f: number) => ((Math.log10(f) - Math.log10(freqMin)) / (Math.log10(freqMax) - Math.log10(freqMin))) * plotW + padL;
  // Y: 0–100 mΩ
  const yMax = 100;
  const linY = (mOhm: number) => padT + plotH - (Math.min(mOhm, yMax) / yMax) * plotH;

  const vrmBwHz = vrmBandwidth * 1e3;
  const target = calc.targetImpedance_mOhm;

  // PDN impedance curve points
  const curvePoints: [number, number][] = [
    [1e3, 50],
    [vrmBwHz * 0.5, 50],
    [vrmBwHz, target * 1.5],
    [vrmBwHz * 10, target],
    [1e7, target],
    [5e7, target * 2],
    [1e8, target * 6],
    [5e8, target * 20],
    [1e9, target * 40],
  ];

  const curvePath = curvePoints
    .map(([f, z], i) => `${i === 0 ? "M" : "L"} ${logX(f).toFixed(1)} ${linY(z).toFixed(1)}`)
    .join(" ");

  // Shading region (operating region)
  const shadeLeft = logX(1e3);
  const shadeRight = logX(vrmBwHz * 10);
  const shadeTop = linY(target * 1.05);
  const shadeBottom = linY(0);

  const xTickFreqs = [1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9];
  const xTickLabels = ["1k", "10k", "100k", "1M", "10M", "100M", "1G"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-slate-900/80 border border-cyan-500/30 rounded-xl p-6"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-cyan-500/20 rounded-lg">
          <Zap className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Target Impedance & VRM Response</h2>
          <p className="text-sm text-slate-400">PDN impedance vs frequency profile</p>
        </div>
        <span className={`ml-auto text-xs font-bold px-3 py-1 rounded-full border ${badge.color} border-current bg-current/10`}>
          {badge.label}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          <SliderRow label="Supply Voltage" value={supplyVoltage} min={0.5} max={1.8} step={0.05} unit="V" onChange={setSupplyVoltage} />
          <SliderRow label="Max Current" value={maxCurrent} min={1} max={100} step={1} unit="A" onChange={setMaxCurrent} />
          <SliderRow label="Voltage Ripple Budget" value={ripplePct} min={1} max={10} step={1} unit="%" onChange={setRipplePct} />
          <SliderRow label="VRM Bandwidth" value={vrmBandwidth} min={10} max={500} step={10} unit="kHz" onChange={setVrmBandwidth} />

          <div className="grid grid-cols-2 gap-3 mt-2">
            <StatCard label="Ripple Voltage" value={calc.rippleVoltage_mV.toFixed(1)} unit="mV" />
            <StatCard label="Target Impedance" value={calc.targetImpedance_mOhm.toFixed(2)} unit="mΩ" />
            <StatCard label="VRM Response Time" value={calc.vrmResponseTime_us.toFixed(2)} unit="µs" />
            <StatCard label="Impedance Margin" value={calc.impedanceMargin.toFixed(2)} unit="×" sub="vs 5 mΩ baseline" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs text-slate-400 mb-1">Impedance vs Frequency (Log Scale)</div>
          <svg width="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="bg-slate-800/60 rounded-lg border border-slate-700">
            {/* Cyan operating region shading */}
            <rect
              x={shadeLeft}
              y={shadeTop}
              width={shadeRight - shadeLeft}
              height={shadeBottom - shadeTop}
              fill="#06b6d430"
            />

            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((mOhm) => (
              <g key={mOhm}>
                <line x1={padL} x2={padL + plotW} y1={linY(mOhm)} y2={linY(mOhm)} stroke="#334155" strokeWidth="0.5" />
                <text x={padL - 4} y={linY(mOhm) + 3} textAnchor="end" fontSize="8" fill="#64748b">{mOhm}</text>
              </g>
            ))}

            {/* X axis ticks */}
            {xTickFreqs.map((f, i) => (
              <g key={f}>
                <line x1={logX(f)} x2={logX(f)} y1={padT} y2={padT + plotH} stroke="#334155" strokeWidth="0.5" />
                <text x={logX(f)} y={padT + plotH + 12} textAnchor="middle" fontSize="8" fill="#64748b">{xTickLabels[i]}</text>
              </g>
            ))}

            {/* Target impedance line */}
            <line
              x1={padL}
              x2={padL + plotW}
              y1={linY(target)}
              y2={linY(target)}
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeDasharray="5,3"
            />
            <text x={padL + 2} y={linY(target) - 3} fontSize="8" fill="#ef4444">Z_target={target.toFixed(2)}mΩ</text>

            {/* PDN impedance curve */}
            <path d={curvePath} fill="none" stroke="#22d3ee" strokeWidth="2" />

            {/* Axis labels */}
            <text x={padL + plotW / 2} y={svgHeight - 2} textAnchor="middle" fontSize="8" fill="#94a3b8">Frequency (Hz)</text>
            <text x={10} y={padT + plotH / 2} textAnchor="middle" fontSize="8" fill="#94a3b8" transform={`rotate(-90, 10, ${padT + plotH / 2})`}>Z (mΩ)</text>
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

// ── Section 2: Decoupling Capacitor Placement ────────────────────────────────

function Section2() {
  const [onDieCap, setOnDieCap] = useState(50);
  const [packageCap, setPackageCap] = useState(5);
  const [bulkCap, setBulkCap] = useState(500);
  const [mountingInductance, setMountingInductance] = useState(100);

  const calc = useMemo(() => {
    const esl_pH = 50e-12; // 50 pH on-die ESL
    const pkg_esl_pH = mountingInductance * 1e-12;
    const bulk_esl_pH = mountingInductance * 10e-12;

    const onDieResonant_MHz = (1 / (2 * Math.PI * Math.sqrt(onDieCap * 1e-9 * esl_pH))) / 1e6;
    const packageResonant_MHz = (1 / (2 * Math.PI * Math.sqrt(packageCap * 1e-9 * pkg_esl_pH))) / 1e6;
    const pcbResonant_kHz = (1 / (2 * Math.PI * Math.sqrt(bulkCap * 1e-6 * bulk_esl_pH))) / 1e3;
    const totalCap_uF = onDieCap / 1000 + packageCap / 1000 + bulkCap;

    return { onDieResonant_MHz, packageResonant_MHz, pcbResonant_kHz, totalCap_uF };
  }, [onDieCap, packageCap, bulkCap, mountingInductance]);

  const svgWidth = 500;
  const svgHeight = 160;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 }}
      className="bg-slate-900/80 border border-cyan-500/30 rounded-xl p-6"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-cyan-500/20 rounded-lg">
          <Battery className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Decoupling Capacitor Placement</h2>
          <p className="text-sm text-slate-400">Three-tier capacitor hierarchy and resonant frequencies</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          <SliderRow label="On-Die Capacitance" value={onDieCap} min={1} max={500} step={1} unit="nF" onChange={setOnDieCap} />
          <SliderRow label="Package Capacitance" value={packageCap} min={0.1} max={50} step={0.1} unit="nF" onChange={setPackageCap} />
          <SliderRow label="PCB Bulk Capacitance" value={bulkCap} min={10} max={10000} step={10} unit="µF" onChange={setBulkCap} />
          <SliderRow label="Mounting Inductance" value={mountingInductance} min={10} max={500} step={10} unit="pH" onChange={setMountingInductance} />

          <div className="grid grid-cols-2 gap-3 mt-2">
            <StatCard label="On-Die Resonant Freq" value={calc.onDieResonant_MHz > 1000 ? (calc.onDieResonant_MHz / 1000).toFixed(1) : calc.onDieResonant_MHz.toFixed(0)} unit={calc.onDieResonant_MHz > 1000 ? "GHz" : "MHz"} />
            <StatCard label="Package Resonant Freq" value={calc.packageResonant_MHz.toFixed(0)} unit="MHz" />
            <StatCard label="PCB Resonant Freq" value={calc.pcbResonant_kHz.toFixed(1)} unit="kHz" />
            <StatCard label="Total Capacitance" value={calc.totalCap_uF.toFixed(2)} unit="µF" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs text-slate-400 mb-1">Capacitor Hierarchy (Frequency Bands)</div>
          <svg width="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="bg-slate-800/60 rounded-lg border border-slate-700">
            {/* PCB band */}
            <rect x={10} y={110} width={480} height={38} rx={4} fill="#0e7490" fillOpacity={0.4} stroke="#0891b2" strokeWidth={1} />
            <text x={20} y={126} fontSize="9" fill="#67e8f9" fontWeight="bold">PCB Bulk</text>
            <text x={20} y={138} fontSize="8" fill="#a5f3fc">{bulkCap} µF  |  f_r = {calc.pcbResonant_kHz.toFixed(1)} kHz  |  &lt;10 MHz band</text>

            {/* Package band */}
            <rect x={10} y={62} width={480} height={38} rx={4} fill="#0d9488" fillOpacity={0.4} stroke="#0f766e" strokeWidth={1} />
            <text x={20} y={78} fontSize="9" fill="#5eead4" fontWeight="bold">Package</text>
            <text x={20} y={90} fontSize="8" fill="#99f6e4">{packageCap} nF  |  f_r = {calc.packageResonant_MHz.toFixed(0)} MHz  |  10–100 MHz band</text>

            {/* On-die band */}
            <rect x={10} y={12} width={480} height={38} rx={4} fill="#155e75" fillOpacity={0.5} stroke="#164e63" strokeWidth={1} />
            <text x={20} y={28} fontSize="9" fill="#22d3ee" fontWeight="bold">On-Die</text>
            <text x={20} y={40} fontSize="8" fill="#67e8f9">{onDieCap} nF  |  f_r = {calc.onDieResonant_MHz.toFixed(0)} MHz  |  100 MHz+ band</text>

            {/* Energy flow arrows */}
            <line x1={460} x2={460} y1={118} y2={96} stroke="#94a3b8" strokeWidth={1.5} markerEnd="url(#arrow)" />
            <line x1={460} x2={460} y1={70} y2={46} stroke="#94a3b8" strokeWidth={1.5} markerEnd="url(#arrow)" />

            <defs>
              <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#94a3b8" />
              </marker>
            </defs>

            <text x={465} y={110} fontSize="7" fill="#94a3b8">energy</text>
            <text x={465} y={63} fontSize="7" fill="#94a3b8">flow</text>
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

// ── Section 3: IR Drop Analysis ───────────────────────────────────────────────

function Section3() {
  const [supplyCurrent, setSupplyCurrent] = useState(50);
  const [planeResistance, setPlaneResistance] = useState(3);
  const [viaResistance, setViaResistance] = useState(0.8);
  const [packageResistance, setPackageResistance] = useState(2);

  const calc = useMemo(() => {
    const planeDrop_mV = supplyCurrent * planeResistance;
    const viaDrop_mV = supplyCurrent * viaResistance;
    const packageDrop_mV = supplyCurrent * packageResistance;
    const totalDrop_mV = planeDrop_mV + viaDrop_mV + packageDrop_mV;
    const budgetPct = (totalDrop_mV / (1.0 * 1000)) * 100;
    return { planeDrop_mV, viaDrop_mV, packageDrop_mV, totalDrop_mV, budgetPct };
  }, [supplyCurrent, planeResistance, viaResistance, packageResistance]);

  const badge = useMemo(() => {
    if (calc.budgetPct <= 3) return { label: "WITHIN BUDGET", color: "text-green-400" };
    if (calc.budgetPct <= 5) return { label: "MARGINAL", color: "text-yellow-400" };
    return { label: "EXCEEDS BUDGET", color: "text-red-400" };
  }, [calc.budgetPct]);

  const svgWidth = 500;
  const svgHeight = 130;
  const padL = 80;
  const padR = 20;
  const barY = 35;
  const barH = 36;
  const plotW = svgWidth - padL - padR;
  const maxDrop = Math.max(calc.totalDrop_mV * 1.2, 100);

  const planeW = (calc.planeDrop_mV / maxDrop) * plotW;
  const viaW = (calc.viaDrop_mV / maxDrop) * plotW;
  const pkgW = (calc.packageDrop_mV / maxDrop) * plotW;
  const budgetX = padL + (50 / maxDrop) * plotW; // 50mV = 5% of 1V

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="bg-slate-900/80 border border-cyan-500/30 rounded-xl p-6"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-cyan-500/20 rounded-lg">
          <TrendingDown className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">IR Drop Analysis</h2>
          <p className="text-sm text-slate-400">Voltage loss through power delivery path</p>
        </div>
        <span className={`ml-auto text-xs font-bold px-3 py-1 rounded-full border ${badge.color} border-current bg-current/10`}>
          {badge.label}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          <SliderRow label="Supply Current" value={supplyCurrent} min={1} max={200} step={1} unit="A" onChange={setSupplyCurrent} />
          <SliderRow label="Power Plane Resistance" value={planeResistance} min={0.5} max={20} step={0.5} unit="mΩ" onChange={setPlaneResistance} />
          <SliderRow label="Via Resistance" value={viaResistance} min={0.1} max={5} step={0.1} unit="mΩ" onChange={setViaResistance} />
          <SliderRow label="Package Resistance" value={packageResistance} min={0.5} max={10} step={0.5} unit="mΩ" onChange={setPackageResistance} />

          <div className="grid grid-cols-2 gap-3 mt-2">
            <StatCard label="Plane IR Drop" value={calc.planeDrop_mV.toFixed(1)} unit="mV" />
            <StatCard label="Via IR Drop" value={calc.viaDrop_mV.toFixed(1)} unit="mV" />
            <StatCard label="Package IR Drop" value={calc.packageDrop_mV.toFixed(1)} unit="mV" />
            <StatCard label="Total IR Drop" value={calc.totalDrop_mV.toFixed(1)} unit="mV" sub={`${calc.budgetPct.toFixed(1)}% of supply`} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs text-slate-400 mb-1">IR Drop Waterfall (mV)</div>
          <svg width="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="bg-slate-800/60 rounded-lg border border-slate-700">
            {/* Plane bar */}
            <rect x={padL} y={barY} width={planeW} height={barH} fill="#06b6d4" fillOpacity={0.8} rx={2} />
            <text x={padL - 4} y={barY + barH / 2 + 4} textAnchor="end" fontSize="8" fill="#94a3b8">Plane</text>
            <text x={padL + planeW + 3} y={barY + barH / 2 + 4} fontSize="8" fill="#67e8f9">{calc.planeDrop_mV.toFixed(1)}mV</text>

            {/* Via bar */}
            <rect x={padL} y={barY + barH + 6} width={viaW} height={barH * 0.7} fill="#0d9488" fillOpacity={0.8} rx={2} />
            <text x={padL - 4} y={barY + barH + 6 + barH * 0.35 + 4} textAnchor="end" fontSize="8" fill="#94a3b8">Via</text>
            <text x={padL + viaW + 3} y={barY + barH + 6 + barH * 0.35 + 4} fontSize="8" fill="#5eead4">{calc.viaDrop_mV.toFixed(1)}mV</text>

            {/* Package bar */}
            <rect x={padL} y={barY + barH * 1.7 + 12} width={pkgW} height={barH * 0.7} fill="#2563eb" fillOpacity={0.7} rx={2} />
            <text x={padL - 4} y={barY + barH * 1.7 + 12 + barH * 0.35 + 4} textAnchor="end" fontSize="8" fill="#94a3b8">Package</text>
            <text x={padL + pkgW + 3} y={barY + barH * 1.7 + 12 + barH * 0.35 + 4} fontSize="8" fill="#93c5fd">{calc.packageDrop_mV.toFixed(1)}mV</text>

            {/* Budget line */}
            {budgetX <= svgWidth - padR && (
              <>
                <line x1={budgetX} x2={budgetX} y1={barY - 8} y2={barY + barH * 2.4 + 16} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4,2" />
                <text x={budgetX + 2} y={barY - 2} fontSize="7" fill="#ef4444">5% budget (50mV)</text>
              </>
            )}
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

// ── Section 4: Power Rail Noise ───────────────────────────────────────────────

function Section4() {
  const [switchingFreq, setSwitchingFreq] = useState(10);
  const [peakRipple, setPeakRipple] = useState(20);
  const [qFactor, setQFactor] = useState(2);
  const [noiseCoupling, setNoiseCoupling] = useState(0.1);

  const calc = useMemo(() => {
    const bulkCap_uF = 500;
    const rippleEnergy_uJ = 0.5 * bulkCap_uF * Math.pow(peakRipple / 1000, 2);
    const resonantAmplitude_mV = peakRipple * qFactor;
    const coupledNoise_mV = resonantAmplitude_mV * noiseCoupling;
    const supplyV_mV = 1000;
    const snr_dB = 20 * Math.log10(supplyV_mV / Math.max(coupledNoise_mV, 0.001));
    return { rippleEnergy_uJ, resonantAmplitude_mV, coupledNoise_mV, snr_dB };
  }, [peakRipple, qFactor, noiseCoupling]);

  const svgWidth = 500;
  const svgHeight = 140;
  const padL = 40;
  const padR = 10;
  const padT = 15;
  const padB = 25;
  const plotW = svgWidth - padL - padR;
  const plotH = svgHeight - padT - padB;

  const dcLevel = 1000; // mV (1V supply)
  const yRange = Math.max(calc.resonantAmplitude_mV * 2.5, peakRipple * 4, 100);
  const yMid = padT + plotH / 2;
  const yScale = plotH / yRange;

  const numPoints = 100;
  const wavePoints = Array.from({ length: numPoints }, (_, i) => {
    const t = i / (numPoints - 1);
    const x = padL + t * plotW;
    const rippleMv = peakRipple * Math.sin(2 * Math.PI * t);
    const y = yMid - rippleMv * yScale;
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");

  const envelopeTop = yMid - (calc.resonantAmplitude_mV / 2) * yScale;
  const envelopeBot = yMid + (calc.resonantAmplitude_mV / 2) * yScale;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className="bg-slate-900/80 border border-cyan-500/30 rounded-xl p-6"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-cyan-500/20 rounded-lg">
          <Activity className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Power Rail Noise</h2>
          <p className="text-sm text-slate-400">Ripple, resonant noise, and SNR analysis</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          <SliderRow label="Switching Frequency" value={switchingFreq} min={1} max={100} step={1} unit="MHz" onChange={setSwitchingFreq} />
          <SliderRow label="Peak-to-Peak Ripple" value={peakRipple} min={1} max={100} step={1} unit="mV" onChange={setPeakRipple} />
          <SliderRow label="Q Factor (Resonance)" value={qFactor} min={0.5} max={10} step={0.5} unit="" onChange={setQFactor} />
          <SliderRow label="Noise Coupling Factor" value={noiseCoupling} min={0.01} max={1.0} step={0.01} unit="" onChange={setNoiseCoupling} />

          <div className="grid grid-cols-2 gap-3 mt-2">
            <StatCard label="Ripple Energy" value={calc.rippleEnergy_uJ.toFixed(3)} unit="µJ" />
            <StatCard label="Resonant Amplitude" value={calc.resonantAmplitude_mV.toFixed(1)} unit="mV" />
            <StatCard label="Coupled Noise" value={calc.coupledNoise_mV.toFixed(2)} unit="mV" />
            <StatCard label="SNR" value={calc.snr_dB.toFixed(1)} unit="dB" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs text-slate-400 mb-1">Power Rail Waveform (one period)</div>
          <svg width="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="bg-slate-800/60 rounded-lg border border-slate-700">
            {/* Nominal voltage line */}
            <line x1={padL} x2={padL + plotW} y1={yMid} y2={yMid} stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="6,3" />
            <text x={padL + 2} y={yMid - 4} fontSize="8" fill="#22d3ee">V_nominal = {dcLevel}mV</text>

            {/* Noise envelope */}
            {envelopeTop >= padT && envelopeTop <= padT + plotH && (
              <line x1={padL} x2={padL + plotW} y1={envelopeTop} y2={envelopeTop} stroke="#ef4444" strokeWidth={1} strokeDasharray="3,2" />
            )}
            {envelopeBot >= padT && envelopeBot <= padT + plotH && (
              <line x1={padL} x2={padL + plotW} y1={envelopeBot} y2={envelopeBot} stroke="#ef4444" strokeWidth={1} strokeDasharray="3,2" />
            )}
            {envelopeTop >= padT && (
              <text x={padL + plotW - 2} y={Math.max(envelopeTop - 2, padT + 10)} textAnchor="end" fontSize="7" fill="#ef4444">
                ±{(calc.resonantAmplitude_mV / 2).toFixed(1)}mV envelope
              </text>
            )}

            {/* Ripple waveform */}
            <path d={wavePoints} fill="none" stroke="#f8fafc" strokeWidth={1.5} />

            {/* X axis label */}
            <text x={padL + plotW / 2} y={svgHeight - 5} textAnchor="middle" fontSize="8" fill="#94a3b8">
              Time (1 period @ {switchingFreq} MHz = {(1000 / switchingFreq).toFixed(0)} ns)
            </text>

            {/* Y axis label */}
            <text x={10} y={padT + plotH / 2} textAnchor="middle" fontSize="8" fill="#94a3b8" transform={`rotate(-90, 10, ${padT + plotH / 2})`}>mV</text>
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

// ── Section 5: Thermal-Electrical Co-Analysis ─────────────────────────────────

function Section5() {
  const [junctionTemp, setJunctionTemp] = useState(75);
  const [thetaJA, setThetaJA] = useState(15);
  const [powerDissipation, setPowerDissipation] = useState(10);
  const [tempCoeff, setTempCoeff] = useState(500);

  const calc = useMemo(() => {
    const caseTemp = junctionTemp - powerDissipation * thetaJA / 3;
    const ambientTemp = junctionTemp - powerDissipation * thetaJA;
    const resistanceIncrease_pct = ((junctionTemp - 25) * tempCoeff) / 1e6 * 100;
    const deratingFactor = 1 / (1 + resistanceIncrease_pct / 100);
    return { caseTemp, ambientTemp, resistanceIncrease_pct, deratingFactor };
  }, [junctionTemp, thetaJA, powerDissipation, tempCoeff]);

  const badge = useMemo(() => {
    if (calc.ambientTemp < 50) return { label: "NORMAL", color: "text-green-400" };
    if (calc.ambientTemp < 80) return { label: "ELEVATED", color: "text-yellow-400" };
    return { label: "CRITICAL", color: "text-red-400" };
  }, [calc.ambientTemp]);

  const svgWidth = 500;
  const svgHeight = 140;
  const padL = 30;
  const padR = 30;
  const padT = 20;
  const barH = 60;
  const plotW = svgWidth - padL - padR;

  const ambientClamped = Math.max(calc.ambientTemp, -40);
  const junctionClamped = Math.min(junctionTemp, 150);
  const tempRange = junctionClamped - ambientClamped;

  const ambientX = padL;
  const caseX = tempRange > 0
    ? padL + ((calc.caseTemp - ambientClamped) / tempRange) * plotW
    : padL + plotW * 0.5;
  const junctionX = padL + plotW;

  const clampedCaseX = Math.max(padL + 10, Math.min(junctionX - 10, caseX));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="bg-slate-900/80 border border-cyan-500/30 rounded-xl p-6"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-cyan-500/20 rounded-lg">
          <Settings className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Thermal-Electrical Co-Analysis</h2>
          <p className="text-sm text-slate-400">Junction-to-ambient temperature gradient and resistance derating</p>
        </div>
        <span className={`ml-auto text-xs font-bold px-3 py-1 rounded-full border ${badge.color} border-current bg-current/10`}>
          {badge.label}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-4">
          <SliderRow label="Junction Temperature" value={junctionTemp} min={25} max={125} step={1} unit="°C" onChange={setJunctionTemp} />
          <SliderRow label="Thermal Resistance θJA" value={thetaJA} min={1} max={50} step={1} unit="°C/W" onChange={setThetaJA} />
          <SliderRow label="Power Dissipation" value={powerDissipation} min={0.1} max={50} step={0.1} unit="W" onChange={setPowerDissipation} />
          <SliderRow label="Temperature Coefficient" value={tempCoeff} min={100} max={3000} step={100} unit="ppm/°C" onChange={setTempCoeff} />

          <div className="grid grid-cols-2 gap-3 mt-2">
            <StatCard label="Case Temperature" value={calc.caseTemp.toFixed(1)} unit="°C" />
            <StatCard label="Ambient Temperature" value={calc.ambientTemp.toFixed(1)} unit="°C" />
            <StatCard label="Resistance Increase" value={calc.resistanceIncrease_pct.toFixed(3)} unit="%" />
            <StatCard label="Derating Factor" value={calc.deratingFactor.toFixed(4)} sub="1 = no derating" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs text-slate-400 mb-1">Temperature Gradient (Ambient → Case → Junction)</div>
          <svg width="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="bg-slate-800/60 rounded-lg border border-slate-700">
            <defs>
              <linearGradient id="thermalGrad" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="50%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#dc2626" />
              </linearGradient>
            </defs>

            {/* Temperature bar */}
            <rect x={padL} y={padT} width={plotW} height={barH} rx={6} fill="url(#thermalGrad)" fillOpacity={0.7} />

            {/* Boundary lines */}
            <line x1={clampedCaseX} x2={clampedCaseX} y1={padT} y2={padT + barH} stroke="#f8fafc" strokeWidth={2} strokeDasharray="4,2" />

            {/* Boundary labels */}
            <text x={ambientX} y={padT - 5} textAnchor="middle" fontSize="8" fill="#93c5fd">Ambient</text>
            <text x={ambientX} y={padT + barH + 12} textAnchor="middle" fontSize="9" fill="#60a5fa" fontWeight="bold">{calc.ambientTemp.toFixed(1)}°C</text>

            <text x={clampedCaseX} y={padT - 5} textAnchor="middle" fontSize="8" fill="#fcd34d">Case</text>
            <text x={clampedCaseX} y={padT + barH + 12} textAnchor="middle" fontSize="9" fill="#fbbf24" fontWeight="bold">{calc.caseTemp.toFixed(1)}°C</text>

            <text x={junctionX} y={padT - 5} textAnchor="middle" fontSize="8" fill="#fca5a5">Junction</text>
            <text x={junctionX} y={padT + barH + 12} textAnchor="middle" fontSize="9" fill="#f87171" fontWeight="bold">{junctionTemp}°C</text>

            {/* Die symbol + power arrow */}
            <rect x={junctionX - 18} y={padT + barH / 2 - 10} width={16} height={20} rx={2} fill="#ef4444" fillOpacity={0.3} stroke="#ef4444" strokeWidth={1} />
            <text x={junctionX - 10} y={padT + barH / 2 + 4} textAnchor="middle" fontSize="7" fill="#fca5a5">DIE</text>

            {/* Power dissipation label */}
            <text x={junctionX - 10} y={padT + barH + 24} textAnchor="middle" fontSize="7" fill="#fb923c">{powerDissipation}W</text>
            <text x={junctionX - 10} y={padT + barH + 33} textAnchor="middle" fontSize="7" fill="#94a3b8">dissipated</text>
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

// ── Formula Cards ─────────────────────────────────────────────────────────────

const FORMULA_CARDS = [
  {
    icon: Zap,
    title: "Target Impedance",
    formula: "Z_target = ΔV / ΔI",
    description: "Must stay below this across all frequencies",
  },
  {
    icon: TrendingDown,
    title: "IR Drop",
    formula: "V_drop = I × R_total",
    description: "Sum of plane, via, and package resistances",
  },
  {
    icon: BarChart2,
    title: "Resonant Frequency",
    formula: "f_r = 1 / (2π√LC)",
    description: "Capacitor + parasitic inductance sets resonance",
  },
  {
    icon: AlertTriangle,
    title: "Thermal Derating",
    formula: "R(T) = R₀(1 + α·ΔT)",
    description: "Resistance rises with temperature, increasing IR drop",
  },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PDNAnalysisPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-cyan-500/20 rounded-xl border border-cyan-500/30">
              <Zap className="w-7 h-7 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">PDN Analysis</h1>
              <p className="text-slate-400 mt-1">
                Target impedance, decoupling capacitors, IR drop, power rail noise, and thermal-electrical co-analysis
              </p>
            </div>
          </div>

          {/* Stat badges */}
          <div className="flex flex-wrap gap-3 mt-4">
            {[
              { icon: Zap, label: "Impedance" },
              { icon: Battery, label: "Decoupling" },
              { icon: TrendingDown, label: "IR Drop" },
              { icon: Activity, label: "Rail Noise" },
              { icon: Settings, label: "Thermal" },
              { icon: BarChart2, label: "Frequency" },
              { icon: CheckCircle, label: "Validated" },
              { icon: AlertTriangle, label: "Margins" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 bg-cyan-500/20 border border-cyan-500/30 rounded-full px-3 py-1 text-xs text-cyan-400">
                <Icon className="w-3 h-3" />
                {label}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Sections */}
        <div className="flex flex-col gap-6">
          <Section1 />
          <Section2 />
          <Section3 />
          <Section4 />
          <Section5 />
        </div>

        {/* Formula Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-8"
        >
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-cyan-400" />
            Key Formulas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FORMULA_CARDS.map(({ icon: Icon, title, formula, description }) => (
              <div
                key={title}
                className="bg-slate-900/80 border border-cyan-500/30 rounded-xl p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-cyan-500/20 rounded-lg">
                    <Icon className="w-4 h-4 text-cyan-400" />
                  </div>
                  <span className="text-sm font-semibold text-white">{title}</span>
                </div>
                <div className="font-mono text-cyan-400 text-sm bg-slate-800/80 rounded-lg px-3 py-2 mb-2 border border-slate-700">
                  {formula}
                </div>
                <p className="text-xs text-slate-400">{description}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
