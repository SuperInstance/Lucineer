"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Waves,
  Radio,
  Zap,
  Activity,
  TrendingUp,
  Eye,
  BarChart2,
  CheckCircle,
} from "lucide-react";

// ── Helper components ──────────────────────────────────────────────────────────

function SliderRow({
  label,
  unit,
  min,
  max,
  step,
  value,
  onChange,
  displayValue,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  displayValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1 mb-3">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span className="text-indigo-400 font-mono">
          {displayValue ?? value} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-indigo-500/20 accent-indigo-500 cursor-pointer"
      />
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
  value: string;
  unit?: string;
  sub?: string;
}) {
  return (
    <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-3 flex flex-col gap-0.5">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-lg font-bold text-indigo-400 font-mono">
        {value}
        {unit && <span className="text-sm text-gray-400 ml-1">{unit}</span>}
      </span>
      {sub && <span className="text-xs text-gray-500">{sub}</span>}
    </div>
  );
}

// ── Section 1: Waveguide Optical Loss ─────────────────────────────────────────

function WaveguideLossSection() {
  const [length, setLength] = useState(10);
  const [propLoss, setPropLoss] = useState(1.5);
  const [bendRadius, setBendRadius] = useState(10);
  const [numBends, setNumBends] = useState(10);

  const calc = useMemo(() => {
    const propLossTotal = (length / 10) * propLoss;
    const bendLossPerBend = Math.max(0, 0.1 * Math.exp(-bendRadius / 5));
    const totalBendLoss = bendLossPerBend * numBends;
    const totalInsertionLoss = propLossTotal + totalBendLoss;
    const badge =
      totalInsertionLoss < 3
        ? "EXCELLENT"
        : totalInsertionLoss <= 8
        ? "ACCEPTABLE"
        : "HIGH LOSS";
    const badgeColor =
      totalInsertionLoss < 3
        ? "text-green-400 border-green-500/40 bg-green-500/10"
        : totalInsertionLoss <= 8
        ? "text-yellow-400 border-yellow-500/40 bg-yellow-500/10"
        : "text-red-400 border-red-500/40 bg-red-500/10";
    return { propLossTotal, bendLossPerBend, totalBendLoss, totalInsertionLoss, badge, badgeColor };
  }, [length, propLoss, bendRadius, numBends]);

  // SVG serpentine path
  const svgWidth = 400;
  const svgHeight = 160;
  const marginX = 30;
  const marginY = 20;
  const segW = (svgWidth - marginX * 2) / 1;
  const segH = 28;
  const numSegs = 4;
  const totalPathLen = numSegs * segW + (numSegs - 1) * Math.PI * segH * 0.5;
  const lossRatio = Math.min(calc.totalInsertionLoss / 10, 1);

  const segments: string[] = [];
  let cx = marginX;
  let cy = marginY + segH;
  segments.push(`M ${cx} ${cy}`);
  for (let i = 0; i < numSegs; i++) {
    if (i % 2 === 0) {
      segments.push(`H ${svgWidth - marginX}`);
      if (i < numSegs - 1) {
        segments.push(
          `A ${segH / 2} ${segH / 2} 0 0 1 ${svgWidth - marginX} ${cy + segH}`
        );
        cy += segH;
      }
    } else {
      segments.push(`H ${marginX}`);
      if (i < numSegs - 1) {
        segments.push(
          `A ${segH / 2} ${segH / 2} 0 0 0 ${marginX} ${cy + segH}`
        );
        cy += segH;
      }
    }
  }
  const pathD = segments.join(" ");

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-gray-900/60 border border-indigo-500/30 rounded-2xl p-6 mb-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <Activity className="text-indigo-400" size={20} />
        <h2 className="text-lg font-semibold text-white">Waveguide Optical Loss</h2>
        <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded border ${calc.badgeColor}`}>
          {calc.badge}
        </span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SliderRow label="Waveguide length" unit="mm" min={0.1} max={100} step={0.1} value={length} onChange={setLength} displayValue={length.toFixed(1)} />
          <SliderRow label="Propagation loss" unit="dB/cm" min={0.1} max={5} step={0.1} value={propLoss} onChange={setPropLoss} displayValue={propLoss.toFixed(1)} />
          <SliderRow label="Bend radius" unit="µm" min={1} max={50} step={1} value={bendRadius} onChange={setBendRadius} />
          <SliderRow label="Number of bends" unit="" min={0} max={50} step={1} value={numBends} onChange={setNumBends} />
          <div className="grid grid-cols-2 gap-2 mt-2">
            <StatCard label="Propagation Loss" value={calc.propLossTotal.toFixed(2)} unit="dB" />
            <StatCard label="Bend Loss / Bend" value={calc.bendLossPerBend.toFixed(3)} unit="dB" />
            <StatCard label="Total Bend Loss" value={calc.totalBendLoss.toFixed(2)} unit="dB" />
            <StatCard label="Total Insertion Loss" value={calc.totalInsertionLoss.toFixed(2)} unit="dB" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-500 text-center">Serpentine waveguide — loss accumulation</p>
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full rounded-lg bg-gray-950 border border-indigo-500/20">
            <defs>
              <linearGradient id="wg-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset={`${(1 - lossRatio) * 100}%`} stopColor="#818cf8" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>
            <path d={pathD} fill="none" stroke="url(#wg-grad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <text x="8" y="12" fill="#6366f1" fontSize="9" fontFamily="monospace">
              L={length.toFixed(1)}mm
            </text>
            <text x="8" y="22" fill="#6366f1" fontSize="9" fontFamily="monospace">
              N={numBends} bends
            </text>
            <text x={svgWidth - 8} y="12" fill="#ef4444" fontSize="9" fontFamily="monospace" textAnchor="end">
              {calc.totalInsertionLoss.toFixed(2)} dB loss
            </text>
          </svg>
        </div>
      </div>
    </motion.section>
  );
}

// ── Section 2: Ring Resonator Filter ──────────────────────────────────────────

function RingResonatorSection() {
  const [ringRadius, setRingRadius] = useState(20);
  const [kappa2, setKappa2] = useState(0.1);
  const [roundtripLoss, setRoundtripLoss] = useState(0.3);
  const [wlOffset, setWlOffset] = useState(0);

  const calc = useMemo(() => {
    const lambda_nm = 1550;
    const lambda_um = 1.55;
    const n_eff = 3.5;
    const FSR_nm = (lambda_um * lambda_um) / (2 * Math.PI * n_eff * ringRadius * 1e-3);
    const roundtripLossLinear = 1 - Math.pow(10, -roundtripLoss / 10);
    const Qfactor = Math.max(
      1,
      (2 * Math.PI * n_eff * ringRadius) / (lambda_nm * 1e-9 * roundtripLossLinear * 1000)
    );
    const FWHM_pm = (FSR_nm * 1e3) / (Qfactor / 1e3);
    const a = 1 - roundtripLossLinear;
    const r = Math.sqrt(1 - kappa2);
    const throughAtResonance = Math.pow((r - Math.sqrt(a)) / (1 - r * Math.sqrt(a)), 2);
    return { FSR_nm, Qfactor, FWHM_pm, throughAtResonance };
  }, [ringRadius, kappa2, roundtripLoss, wlOffset]);

  // SVG transmission spectrum
  const svgW = 400;
  const svgH = 160;
  const padL = 40;
  const padR = 10;
  const padT = 10;
  const padB = 30;
  const wlMin = 1545;
  const wlMax = 1555;
  const wlCenter = 1550 + wlOffset / 1000;

  const toX = (wl: number) =>
    padL + ((wl - wlMin) / (wlMax - wlMin)) * (svgW - padL - padR);
  const toY = (t: number) =>
    padT + (1 - t) * (svgH - padT - padB);

  const numPoints = 300;
  const FWHM_nm = calc.FWHM_pm / 1000;

  const transmissionPoints = Array.from({ length: numPoints }, (_, i) => {
    const wl = wlMin + (i / (numPoints - 1)) * (wlMax - wlMin);
    const dWl = wl - wlCenter;
    // Lorentzian at primary resonance
    const t1 = 1 - (1 - calc.throughAtResonance) / (1 + (2 * dWl / FWHM_nm) ** 2);
    // Adjacent resonance dips
    const dWl2p = wl - (wlCenter + calc.FSR_nm);
    const dWl2m = wl - (wlCenter - calc.FSR_nm);
    const t2p = 1 - (1 - calc.throughAtResonance) / (1 + (2 * dWl2p / FWHM_nm) ** 2);
    const t2m = 1 - (1 - calc.throughAtResonance) / (1 + (2 * dWl2m / FWHM_nm) ** 2);
    const t = Math.min(t1, t2p, t2m);
    return { wl, t };
  });

  const polyline = transmissionPoints
    .map(({ wl, t }) => `${toX(wl).toFixed(1)},${toY(t).toFixed(1)}`)
    .join(" ");

  const opX = toX(wlCenter);
  const opY = toY(calc.throughAtResonance);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="bg-gray-900/60 border border-indigo-500/30 rounded-2xl p-6 mb-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <Radio className="text-indigo-400" size={20} />
        <h2 className="text-lg font-semibold text-white">Ring Resonator Filter</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SliderRow label="Ring radius" unit="µm" min={2} max={100} step={1} value={ringRadius} onChange={setRingRadius} />
          <SliderRow label="Coupling coefficient κ²" unit="" min={0.01} max={0.5} step={0.01} value={kappa2} onChange={setKappa2} displayValue={kappa2.toFixed(2)} />
          <SliderRow label="Round-trip loss" unit="dB" min={0.01} max={2} step={0.01} value={roundtripLoss} onChange={setRoundtripLoss} displayValue={roundtripLoss.toFixed(2)} />
          <SliderRow label="Wavelength offset" unit="pm" min={-500} max={500} step={1} value={wlOffset} onChange={setWlOffset} />
          <div className="grid grid-cols-2 gap-2 mt-2">
            <StatCard label="FSR" value={calc.FSR_nm.toFixed(3)} unit="nm" />
            <StatCard label="Q Factor" value={calc.Qfactor >= 1000 ? (calc.Qfactor / 1000).toFixed(1) + "k" : calc.Qfactor.toFixed(0)} />
            <StatCard label="FWHM" value={calc.FWHM_pm.toFixed(1)} unit="pm" />
            <StatCard label="Through @Res" value={(10 * Math.log10(Math.max(calc.throughAtResonance, 1e-10))).toFixed(1)} unit="dB" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-500 text-center">Through-port transmission spectrum</p>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-lg bg-gray-950 border border-indigo-500/20">
            {/* Axes */}
            <line x1={padL} y1={padT} x2={padL} y2={svgH - padB} stroke="#374151" strokeWidth="1" />
            <line x1={padL} y1={svgH - padB} x2={svgW - padR} y2={svgH - padB} stroke="#374151" strokeWidth="1" />
            {/* Y ticks */}
            {[0, 0.5, 1].map((t) => (
              <g key={t}>
                <line x1={padL - 3} y1={toY(t)} x2={padL} y2={toY(t)} stroke="#374151" strokeWidth="1" />
                <text x={padL - 5} y={toY(t) + 3} fill="#6b7280" fontSize="8" textAnchor="end">{t.toFixed(1)}</text>
              </g>
            ))}
            {/* X ticks */}
            {[1545, 1548, 1550, 1552, 1555].map((wl) => (
              <g key={wl}>
                <line x1={toX(wl)} y1={svgH - padB} x2={toX(wl)} y2={svgH - padB + 3} stroke="#374151" strokeWidth="1" />
                <text x={toX(wl)} y={svgH - padB + 12} fill="#6b7280" fontSize="7" textAnchor="middle">{wl}</text>
              </g>
            ))}
            <text x={svgW / 2} y={svgH - 3} fill="#6b7280" fontSize="8" textAnchor="middle">Wavelength (nm)</text>
            <text x={8} y={svgH / 2} fill="#6b7280" fontSize="8" textAnchor="middle" transform={`rotate(-90, 8, ${svgH / 2})`}>Transmission</text>
            {/* Curve */}
            <polyline points={polyline} fill="none" stroke="#6366f1" strokeWidth="1.5" />
            {/* Operating point */}
            <circle cx={opX} cy={opY} r="4" fill="#f59e0b" stroke="#fff" strokeWidth="1" />
            {/* FSR label */}
            <text x={toX(wlCenter) + 4} y={padT + 14} fill="#818cf8" fontSize="8">FSR={calc.FSR_nm.toFixed(2)}nm</text>
          </svg>
        </div>
      </div>
    </motion.section>
  );
}

// ── Section 3: Mach-Zehnder Modulator ─────────────────────────────────────────

function MZMSection() {
  const [vpi, setVpi] = useState(5);
  const [vApplied, setVApplied] = useState(2.5);
  const [insertionLoss, setInsertionLoss] = useState(2);
  const [extinctionRatio, setExtinctionRatio] = useState(20);

  const calc = useMemo(() => {
    const phaseShift = (vApplied / vpi) * 180;
    const throughPower = Math.pow(Math.cos((phaseShift * Math.PI) / 180), 2);
    const outputPower_dBm = 10 * Math.log10(Math.max(throughPower, 1e-10)) - insertionLoss;
    const modDepth = (1 - Math.pow(10, -extinctionRatio / 10)) * 100;
    return { phaseShift, throughPower, outputPower_dBm, modDepth };
  }, [vpi, vApplied, insertionLoss, extinctionRatio]);

  const svgW = 400;
  const svgH = 160;

  // Color based on phase: 0°=blue, 90°=purple, 180°=red
  const phaseNorm = Math.min(calc.phaseShift / 180, 1);
  const armColor =
    phaseNorm < 0.5
      ? `rgb(${Math.round(99 + 57 * phaseNorm * 2)}, ${Math.round(102 - 20 * phaseNorm * 2)}, ${Math.round(241 - 50 * phaseNorm * 2)})`
      : `rgb(${Math.round(156 + 99 * (phaseNorm - 0.5) * 2)}, ${Math.round(82 - 40 * (phaseNorm - 0.5) * 2)}, ${Math.round(191 - 191 * (phaseNorm - 0.5) * 2)})`;

  // Eye diagram points
  const eyeBoxX = 240;
  const eyeBoxY = 10;
  const eyeW = 150;
  const eyeH = 140;
  const highLevel = eyeBoxY + eyeH * (1 - calc.throughPower) * 0.9;
  const lowLevel = eyeBoxY + eyeH * 0.95;
  const erLinear = Math.pow(10, -extinctionRatio / 10);
  const eyeOpeningY = eyeBoxY + eyeH * (1 - erLinear) * 0.45 + 10;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-gray-900/60 border border-indigo-500/30 rounded-2xl p-6 mb-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <Zap className="text-indigo-400" size={20} />
        <h2 className="text-lg font-semibold text-white">Mach-Zehnder Modulator</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SliderRow label="Vπ" unit="V" min={1} max={20} step={0.5} value={vpi} onChange={setVpi} displayValue={vpi.toFixed(1)} />
          <SliderRow label="Applied voltage" unit="V" min={0} max={20} step={0.5} value={vApplied} onChange={setVApplied} displayValue={vApplied.toFixed(1)} />
          <SliderRow label="Optical insertion loss" unit="dB" min={0.5} max={5} step={0.1} value={insertionLoss} onChange={setInsertionLoss} displayValue={insertionLoss.toFixed(1)} />
          <SliderRow label="Extinction ratio" unit="dB" min={5} max={40} step={1} value={extinctionRatio} onChange={setExtinctionRatio} />
          <div className="grid grid-cols-2 gap-2 mt-2">
            <StatCard label="Phase Shift" value={calc.phaseShift.toFixed(1)} unit="°" />
            <StatCard label="Through Power" value={(calc.throughPower * 100).toFixed(1)} unit="%" />
            <StatCard label="Output Power" value={calc.outputPower_dBm.toFixed(1)} unit="dBm" />
            <StatCard label="Modulation Depth" value={calc.modDepth.toFixed(1)} unit="%" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-500 text-center">MZM schematic + eye diagram</p>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-lg bg-gray-950 border border-indigo-500/20">
            {/* MZM schematic */}
            {/* Input waveguide */}
            <line x1="5" y1="80" x2="50" y2="80" stroke="#6366f1" strokeWidth="2.5" />
            {/* Y splitter */}
            <line x1="50" y1="80" x2="90" y2="55" stroke="#6366f1" strokeWidth="2" />
            <line x1="50" y1="80" x2="90" y2="105" stroke="#6366f1" strokeWidth="2" />
            {/* Top arm */}
            <line x1="90" y1="55" x2="170" y2="55" stroke={armColor} strokeWidth="2.5" />
            {/* Bottom arm */}
            <line x1="90" y1="105" x2="170" y2="105" stroke="#6366f1" strokeWidth="2" />
            {/* Electrode bar on top arm */}
            <rect x="100" y="42" width="60" height="8" rx="2" fill="#f59e0b" opacity="0.8" />
            <text x="130" y="38" fill="#f59e0b" fontSize="8" textAnchor="middle">Vπ = {vpi}V</text>
            {/* Combiner */}
            <line x1="170" y1="55" x2="210" y2="80" stroke={armColor} strokeWidth="2" />
            <line x1="170" y1="105" x2="210" y2="80" stroke="#6366f1" strokeWidth="2" />
            {/* Output waveguide */}
            <line x1="210" y1="80" x2="230" y2="80" stroke="#6366f1" strokeWidth="2.5" />
            {/* Labels */}
            <text x="7" y="75" fill="#818cf8" fontSize="8">IN</text>
            <text x="212" y="75" fill="#818cf8" fontSize="8">OUT</text>
            <text x="130" y="68" fill={armColor} fontSize="8" textAnchor="middle">{calc.phaseShift.toFixed(0)}°</text>

            {/* Eye diagram box */}
            <rect x={eyeBoxX} y={eyeBoxY} width={eyeW} height={eyeH} rx="4" fill="#111827" stroke="#374151" strokeWidth="1" />
            <text x={eyeBoxX + eyeW / 2} y={eyeBoxY + 10} fill="#6b7280" fontSize="8" textAnchor="middle">Eye Diagram</text>
            {/* High level */}
            <line x1={eyeBoxX + 10} y1={highLevel} x2={eyeBoxX + eyeW - 10} y2={highLevel} stroke="#6366f1" strokeWidth="1.5" strokeDasharray="4,2" />
            {/* Low level */}
            <line x1={eyeBoxX + 10} y1={lowLevel} x2={eyeBoxX + eyeW - 10} y2={lowLevel} stroke="#374151" strokeWidth="1.5" strokeDasharray="4,2" />
            {/* Eye opening (simplified diamond) */}
            <polygon
              points={`${eyeBoxX + 20},${(highLevel + lowLevel) / 2} ${eyeBoxX + eyeW / 2},${highLevel + 4} ${eyeBoxX + eyeW - 20},${(highLevel + lowLevel) / 2} ${eyeBoxX + eyeW / 2},${lowLevel - 4}`}
              fill="none"
              stroke="#818cf8"
              strokeWidth="1.5"
              opacity="0.7"
            />
            <text x={eyeBoxX + eyeW - 5} y={highLevel - 2} fill="#6366f1" fontSize="7" textAnchor="end">1</text>
            <text x={eyeBoxX + eyeW - 5} y={lowLevel - 2} fill="#374151" fontSize="7" textAnchor="end">0</text>
            <text x={eyeBoxX + eyeW / 2} y={eyeBoxY + eyeH - 3} fill="#6b7280" fontSize="7" textAnchor="middle">ER={extinctionRatio}dB</text>
          </svg>
        </div>
      </div>
    </motion.section>
  );
}

// ── Section 4: Optical Link Budget ────────────────────────────────────────────

function LinkBudgetSection() {
  const [laserPower, setLaserPower] = useState(10);
  const [couplingLoss, setCouplingLoss] = useState(2);
  const [routingLoss, setRoutingLoss] = useState(4);
  const [detSensitivity, setDetSensitivity] = useState(-20);

  const calc = useMemo(() => {
    const availablePower = laserPower - couplingLoss - routingLoss;
    const linkMargin = availablePower - detSensitivity;
    const ber =
      linkMargin > 6
        ? "1×10⁻¹⁵"
        : linkMargin >= 3
        ? "1×10⁻¹²"
        : linkMargin >= 1
        ? "1×10⁻⁹"
        : "1×10⁻⁶";
    const osnr = linkMargin + 3;
    const badge =
      linkMargin > 6
        ? "ROBUST"
        : linkMargin > 1
        ? "MARGINAL"
        : "LINK FAILURE";
    const badgeColor =
      linkMargin > 6
        ? "text-green-400 border-green-500/40 bg-green-500/10"
        : linkMargin > 1
        ? "text-yellow-400 border-yellow-500/40 bg-yellow-500/10"
        : "text-red-400 border-red-500/40 bg-red-500/10";
    return { availablePower, linkMargin, ber, osnr, badge, badgeColor };
  }, [laserPower, couplingLoss, routingLoss, detSensitivity]);

  // Waterfall bar chart SVG
  const svgW = 400;
  const svgH = 160;
  const padL = 50;
  const padR = 10;
  const padT = 15;
  const padB = 25;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;

  const yMin = Math.min(detSensitivity - 5, calc.availablePower - 15);
  const yMax = laserPower + 5;
  const yRange = yMax - yMin;
  const toY2 = (v: number) => padT + ((yMax - v) / yRange) * chartH;

  const barW = 50;
  const bars = [
    { label: "Laser", x: 20, top: laserPower, bot: yMin, color: "#6366f1" },
    { label: "After coupling", x: 90, top: laserPower - couplingLoss, bot: yMin, color: "#818cf8" },
    { label: "After routing", x: 160, top: calc.availablePower, bot: yMin, color: calc.linkMargin > 1 ? "#22c55e" : "#ef4444" },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="bg-gray-900/60 border border-indigo-500/30 rounded-2xl p-6 mb-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="text-indigo-400" size={20} />
        <h2 className="text-lg font-semibold text-white">Optical Link Budget</h2>
        <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded border ${calc.badgeColor}`}>
          {calc.badge}
        </span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SliderRow label="Laser power" unit="dBm" min={0} max={20} step={0.5} value={laserPower} onChange={setLaserPower} displayValue={laserPower.toFixed(1)} />
          <SliderRow label="Fiber coupling loss" unit="dB" min={0.5} max={5} step={0.1} value={couplingLoss} onChange={setCouplingLoss} displayValue={couplingLoss.toFixed(1)} />
          <SliderRow label="On-chip routing loss" unit="dB" min={0.5} max={10} step={0.5} value={routingLoss} onChange={setRoutingLoss} displayValue={routingLoss.toFixed(1)} />
          <SliderRow label="Detector sensitivity" unit="dBm" min={-30} max={-10} step={0.5} value={detSensitivity} onChange={setDetSensitivity} displayValue={detSensitivity.toFixed(1)} />
          <div className="grid grid-cols-2 gap-2 mt-2">
            <StatCard label="Available Power" value={calc.availablePower.toFixed(1)} unit="dBm" />
            <StatCard label="Link Margin" value={calc.linkMargin.toFixed(1)} unit="dB" />
            <StatCard label="BER Estimate" value={calc.ber} />
            <StatCard label="OSNR" value={calc.osnr.toFixed(1)} unit="dB" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-500 text-center">Power waterfall — dBm budget</p>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-lg bg-gray-950 border border-indigo-500/20">
            {/* Y axis */}
            <line x1={padL} y1={padT} x2={padL} y2={svgH - padB} stroke="#374151" strokeWidth="1" />
            {/* Y ticks */}
            {Array.from({ length: 5 }, (_, i) => {
              const v = yMin + (i / 4) * yRange;
              return (
                <g key={i}>
                  <line x1={padL - 3} y1={toY2(v)} x2={padL} y2={toY2(v)} stroke="#374151" strokeWidth="1" />
                  <text x={padL - 5} y={toY2(v) + 3} fill="#6b7280" fontSize="7" textAnchor="end">{v.toFixed(0)}</text>
                </g>
              );
            })}
            <text x={10} y={svgH / 2} fill="#6b7280" fontSize="8" textAnchor="middle" transform={`rotate(-90, 10, ${svgH / 2})`}>dBm</text>
            {/* Bars */}
            {bars.map((bar) => {
              const barTop = toY2(bar.top);
              const barBot = toY2(yMin);
              return (
                <g key={bar.label}>
                  <rect
                    x={padL + bar.x}
                    y={barTop}
                    width={barW}
                    height={barBot - barTop}
                    fill={bar.color}
                    opacity="0.7"
                    rx="2"
                  />
                  <text x={padL + bar.x + barW / 2} y={barTop - 3} fill={bar.color} fontSize="7" textAnchor="middle">{bar.top.toFixed(1)}</text>
                  <text x={padL + bar.x + barW / 2} y={svgH - padB + 12} fill="#6b7280" fontSize="6.5" textAnchor="middle">{bar.label}</text>
                </g>
              );
            })}
            {/* Detector sensitivity dashed line */}
            <line
              x1={padL}
              y1={toY2(detSensitivity)}
              x2={svgW - padR}
              y2={toY2(detSensitivity)}
              stroke="#ef4444"
              strokeWidth="1"
              strokeDasharray="5,3"
            />
            <text x={svgW - padR - 2} y={toY2(detSensitivity) - 3} fill="#ef4444" fontSize="7" textAnchor="end">
              Sensitivity {detSensitivity}dBm
            </text>
          </svg>
        </div>
      </div>
    </motion.section>
  );
}

// ── Section 5: Photodetector Performance ──────────────────────────────────────

function PhotodetectorSection() {
  const [responsivity, setResponsivity] = useState(0.8);
  const [darkCurrent, setDarkCurrent] = useState(1);
  const [bandwidth, setBandwidth] = useState(25);
  const [opticalPower, setOpticalPower] = useState(10);

  const calc = useMemo(() => {
    const photocurrent_uA = responsivity * opticalPower;
    const q = 1.6e-19;
    const kB = 1.38e-23;
    const T = 300;
    const RL = 50;
    const totalCurrentForShot = photocurrent_uA * 1e-6 + darkCurrent * 1e-9;
    const shotNoise_pA = Math.sqrt(2 * q * totalCurrentForShot * 1e6) * 1e12;
    const thermalNoise_pA = Math.sqrt((4 * kB * T) / RL * 1e6) * 1e12;
    const snr_dB = 20 * Math.log10(
      Math.max(
        photocurrent_uA /
          Math.sqrt(shotNoise_pA ** 2 + thermalNoise_pA ** 2 + (darkCurrent * 1e-3) ** 2),
        1e-10
      )
    );
    return { photocurrent_uA, shotNoise_pA, thermalNoise_pA, snr_dB };
  }, [responsivity, darkCurrent, bandwidth, opticalPower]);

  // Log-scale responsivity curve SVG
  const svgW = 400;
  const svgH = 160;
  const padL = 45;
  const padR = 10;
  const padT = 10;
  const padB = 28;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;

  const pMin = 0.1;
  const pMax = 1000;
  const logMin = Math.log10(pMin);
  const logMax = Math.log10(pMax);

  const toXlog = (p: number) =>
    padL + ((Math.log10(Math.max(p, pMin)) - logMin) / (logMax - logMin)) * chartW;

  const iMax = responsivity * pMax;
  const iMin_plot = darkCurrent * 1e-3 * 0.1;
  const iLogMin = Math.log10(Math.max(iMin_plot, 1e-6));
  const iLogMax = Math.log10(iMax + 1);
  const iRange = iLogMax - iLogMin;

  const toYlog = (iuA: number) =>
    padT + ((iLogMax - Math.log10(Math.max(iuA, 1e-6))) / iRange) * chartH;

  const sigPoints = Array.from({ length: 60 }, (_, i) => {
    const p = Math.pow(10, logMin + (i / 59) * (logMax - logMin));
    const iuA = responsivity * p;
    return `${toXlog(p).toFixed(1)},${toYlog(iuA).toFixed(1)}`;
  }).join(" ");

  const shotNoisePoints = Array.from({ length: 60 }, (_, i) => {
    const p = Math.pow(10, logMin + (i / 59) * (logMax - logMin));
    const iuA = responsivity * p;
    const q = 1.6e-19;
    const sn_pA = Math.sqrt(2 * q * (iuA * 1e-6) * 1e6) * 1e12;
    const sn_uA = sn_pA * 1e-6;
    return `${toXlog(p).toFixed(1)},${toYlog(Math.max(sn_uA, 1e-6)).toFixed(1)}`;
  }).join(" ");

  const opX = toXlog(opticalPower);
  const opY = toYlog(calc.photocurrent_uA);
  const darkY = toYlog(darkCurrent * 1e-3);

  // X tick labels
  const xTicks = [0.1, 1, 10, 100, 1000];
  // Y tick labels
  const yTickVals = [iLogMin, iLogMin + iRange / 3, iLogMin + 2 * iRange / 3, iLogMax].map(
    (v) => Math.pow(10, v)
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-gray-900/60 border border-indigo-500/30 rounded-2xl p-6 mb-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <Eye className="text-indigo-400" size={20} />
        <h2 className="text-lg font-semibold text-white">Photodetector Performance</h2>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SliderRow label="Responsivity" unit="A/W" min={0.1} max={1.3} step={0.05} value={responsivity} onChange={setResponsivity} displayValue={responsivity.toFixed(2)} />
          <SliderRow label="Dark current" unit="nA" min={0.01} max={100} step={0.01} value={darkCurrent} onChange={setDarkCurrent} displayValue={darkCurrent.toFixed(2)} />
          <SliderRow label="Bandwidth" unit="GHz" min={1} max={100} step={1} value={bandwidth} onChange={setBandwidth} />
          <SliderRow label="Incident optical power" unit="µW" min={0.1} max={1000} step={0.1} value={opticalPower} onChange={setOpticalPower} displayValue={opticalPower.toFixed(1)} />
          <div className="grid grid-cols-2 gap-2 mt-2">
            <StatCard label="Photocurrent" value={calc.photocurrent_uA.toFixed(2)} unit="µA" />
            <StatCard label="Shot Noise" value={calc.shotNoise_pA.toFixed(2)} unit="pA/√Hz" />
            <StatCard label="Thermal Noise" value={calc.thermalNoise_pA.toFixed(2)} unit="pA/√Hz" />
            <StatCard label="SNR" value={calc.snr_dB.toFixed(1)} unit="dB" />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-500 text-center">Photocurrent vs incident power (log scale)</p>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full rounded-lg bg-gray-950 border border-indigo-500/20">
            {/* Axes */}
            <line x1={padL} y1={padT} x2={padL} y2={svgH - padB} stroke="#374151" strokeWidth="1" />
            <line x1={padL} y1={svgH - padB} x2={svgW - padR} y2={svgH - padB} stroke="#374151" strokeWidth="1" />
            {/* X ticks */}
            {xTicks.map((p) => (
              <g key={p}>
                <line x1={toXlog(p)} y1={svgH - padB} x2={toXlog(p)} y2={svgH - padB + 3} stroke="#374151" strokeWidth="1" />
                <text x={toXlog(p)} y={svgH - padB + 12} fill="#6b7280" fontSize="7" textAnchor="middle">{p >= 1000 ? "1k" : p}</text>
              </g>
            ))}
            <text x={padL + chartW / 2} y={svgH - 3} fill="#6b7280" fontSize="7.5" textAnchor="middle">Optical Power (µW)</text>
            {/* Y ticks */}
            {yTickVals.map((v, idx) => {
              const yy = toYlog(v);
              const label = v < 0.001 ? `${(v * 1000).toFixed(1)}n` : v < 1 ? `${(v * 1000).toFixed(0)}n` : `${v.toFixed(0)}`;
              return (
                <g key={idx}>
                  <line x1={padL - 3} y1={yy} x2={padL} y2={yy} stroke="#374151" strokeWidth="1" />
                  <text x={padL - 5} y={yy + 3} fill="#6b7280" fontSize="6.5" textAnchor="end">{label}µA</text>
                </g>
              );
            })}
            {/* Signal line */}
            <polyline points={sigPoints} fill="none" stroke="#6366f1" strokeWidth="2" />
            {/* Shot noise floor */}
            <polyline points={shotNoisePoints} fill="none" stroke="#6b7280" strokeWidth="1" strokeDasharray="4,3" />
            {/* Dark current floor */}
            <line x1={padL} y1={darkY} x2={svgW - padR} y2={darkY} stroke="#ef4444" strokeWidth="1" strokeDasharray="3,3" />
            {/* Operating point */}
            <circle cx={opX} cy={opY} r="5" fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
            {/* Legend */}
            <line x1={padL + 8} y1={padT + 10} x2={padL + 22} y2={padT + 10} stroke="#6366f1" strokeWidth="2" />
            <text x={padL + 25} y={padT + 14} fill="#6366f1" fontSize="7">Signal</text>
            <line x1={padL + 8} y1={padT + 20} x2={padL + 22} y2={padT + 20} stroke="#6b7280" strokeWidth="1" strokeDasharray="4,3" />
            <text x={padL + 25} y={padT + 24} fill="#6b7280" fontSize="7">Shot noise</text>
            <line x1={padL + 8} y1={padT + 30} x2={padL + 22} y2={padT + 30} stroke="#ef4444" strokeWidth="1" strokeDasharray="3,3" />
            <text x={padL + 25} y={padT + 34} fill="#ef4444" fontSize="7">Dark current</text>
          </svg>
        </div>
      </div>
    </motion.section>
  );
}

// ── Formula Cards ──────────────────────────────────────────────────────────────

const FORMULAS = [
  {
    icon: Activity,
    title: "Waveguide Loss",
    formula: "α_total = α_prop × L + α_bend × N",
    desc: "Propagation and bend contributions to total insertion loss",
  },
  {
    icon: Radio,
    title: "Ring FSR",
    formula: "FSR = λ² / (n_eff × 2πR)",
    desc: "Free spectral range of ring resonator",
  },
  {
    icon: Zap,
    title: "MZM Transfer",
    formula: "P_out = cos²(π·V / 2Vπ)",
    desc: "Power depends on applied voltage phase",
  },
  {
    icon: BarChart2,
    title: "Optical SNR",
    formula: "OSNR = P_signal / P_noise",
    desc: "Ratio of signal to noise optical power",
  },
];

function FormulaCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
      {FORMULAS.map(({ icon: Icon, title, formula, desc }) => (
        <div
          key={title}
          className="bg-gray-900/60 border border-indigo-500/30 rounded-xl p-4 flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <Icon className="text-indigo-400" size={16} />
            <span className="text-sm font-semibold text-white">{title}</span>
          </div>
          <code className="text-xs text-indigo-300 bg-indigo-500/10 rounded px-2 py-1 block break-all">
            {formula}
          </code>
          <p className="text-xs text-gray-500">{desc}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function SiliconPhotonicsPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-8 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30">
            <Waves className="text-indigo-400" size={22} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Silicon Photonics</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Waveguide loss, ring resonators, Mach-Zehnder modulators, optical link budget, and photodetector analysis
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap mt-2">
          {[
            { icon: Activity, label: "Waveguide Loss" },
            { icon: Radio, label: "Ring Resonator" },
            { icon: Zap, label: "MZM" },
            { icon: TrendingUp, label: "Link Budget" },
            { icon: Eye, label: "Photodetector" },
          ].map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-1 text-xs text-indigo-400 border border-indigo-500/30 bg-indigo-500/10 rounded-full px-3 py-1"
            >
              <Icon size={12} />
              {label}
            </span>
          ))}
          <span className="flex items-center gap-1 text-xs text-green-400 border border-green-500/30 bg-green-500/10 rounded-full px-3 py-1">
            <CheckCircle size={12} />
            Interactive Calculators
          </span>
        </div>
      </motion.div>

      {/* Sections */}
      <WaveguideLossSection />
      <RingResonatorSection />
      <MZMSection />
      <LinkBudgetSection />
      <PhotodetectorSection />

      {/* Formula Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="text-indigo-400" size={18} />
          <h2 className="text-base font-semibold text-white">Key Formulas</h2>
        </div>
        <FormulaCards />
      </motion.div>
    </div>
  );
}
