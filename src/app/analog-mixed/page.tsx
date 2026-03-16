"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Zap,
  Cpu,
  AlertTriangle,
  CheckCircle,
  Info,
  Layers,
  Radio,
} from "lucide-react";

// ── Physics constants ──────────────────────────────────────────────────────────
const I_BIAS_UA = 2; // µA bias current for op-amp slew rate
const CLOCK_FREQ_HZ = 10e6; // 10 MHz pump clock

// ── Typed helpers ──────────────────────────────────────────────────────────────
type ProcessCorner = "TT" | "FF" | "SS" | "FS" | "SF";
type MetricType = "delay" | "power" | "leakage";

interface CornerOffset {
  ptat: number;
  ctat: number;
}

const CORNER_OFFSETS: Record<ProcessCorner, CornerOffset> = {
  TT: { ptat: 0, ctat: 0 },
  FF: { ptat: -0.01, ctat: 0.005 },
  SS: { ptat: 0.01, ctat: -0.005 },
  FS: { ptat: 0, ctat: 0.01 },
  SF: { ptat: 0, ctat: -0.01 },
};

const CORNER_FACTORS: Record<string, number> = {
  "FF-H-Cold": 0.6,
  "FF-H-Hot": 0.65,
  "FF-H-Nom": 0.62,
  "FF-N-Cold": 0.7,
  "FF-N-Hot": 0.75,
  "FF-N-Nom": 0.72,
  "TT-N-Nom": 1.0,
  "TT-N-Cold": 0.9,
  "TT-N-Hot": 1.1,
  "SS-L-Hot": 1.8,
  "SS-L-Cold": 1.6,
  "SS-L-Nom": 1.7,
  "SS-N-Hot": 1.5,
  "SS-N-Nom": 1.3,
  "SS-N-Cold": 1.2,
};

const PVT_PROCESS_ROWS: string[] = ["FF", "TF", "TT", "FT", "SS"];
const PVT_TEMP_COLS: string[] = ["Cold", "Nom", "Hot"];

const PVT_FACTORS: number[][] = [
  [0.7, 0.72, 0.75],
  [0.8, 0.85, 0.92],
  [0.9, 1.0, 1.1],
  [1.1, 1.2, 1.35],
  [1.6, 1.7, 1.8],
];

function logScale(val: number, minVal: number, maxVal: number, width: number): number {
  if (val <= 0 || minVal <= 0 || maxVal <= 0) return 0;
  return (
    ((Math.log10(val) - Math.log10(minVal)) /
      (Math.log10(maxVal) - Math.log10(minVal))) *
    width
  );
}

function clamp(val: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, val));
}

function formatVal(val: number, digits: number = 2): string {
  return val.toFixed(digits);
}

function interpColor(t: number): string {
  // t=0 => green, t=1 => red
  const r = Math.round(clamp(t * 2, 0, 1) * 220 + 35);
  const g = Math.round(clamp(2 - t * 2, 0, 1) * 200 + 35);
  return `rgb(${r},${g},50)`;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function AnalogMixedPage() {
  // Section 1: Op-Amp Stability
  const [gbwMHz, setGbwMHz] = useState<number>(100);
  const [loadCapPf, setLoadCapPf] = useState<number>(10);
  const [feedbackFactor, setFeedbackFactor] = useState<number>(1.0);
  const [compCapPf, setCompCapPf] = useState<number>(5);

  // Section 2: ADC Performance
  const [bits, setBits] = useState<number>(12);
  const [inputFreqMHz, setInputFreqMHz] = useState<number>(1);
  const [sampleRateMSPS, setSampleRateMSPS] = useState<number>(100);
  const [jitterRaw, setJitterRaw] = useState<number>(50);

  // Section 3: Charge Pump
  const [stages, setStages] = useState<number>(4);
  const [vddPump, setVddPump] = useState<number>(1.8);
  const [capPf, setCapPf] = useState<number>(100);
  const [loadUa, setLoadUa] = useState<number>(50);

  // Section 4: Bandgap Reference
  const [tempC, setTempC] = useState<number>(27);
  const [processCorner, setProcessCorner] = useState<ProcessCorner>("TT");
  const [trimBits, setTrimBits] = useState<number>(8);

  // Section 5: PVT Corner
  const [metricType, setMetricType] = useState<MetricType>("delay");
  const [nominalNs, setNominalNs] = useState<number>(1.5);

  // ── Section 1 Derived ────────────────────────────────────────────────────────
  const s1 = useMemo(() => {
    const fUnity = gbwMHz * feedbackFactor;
    const poleFactor = gbwMHz * compCapPf / loadCapPf;
    const pm = 90 - Math.atan(fUnity / poleFactor) * 180 / Math.PI;
    const gm = 20 * Math.log10(gbwMHz / fUnity);
    const sr = (I_BIAS_UA * 1e-6) / (compCapPf * 1e-12) * 1e-6;
    const stable = pm > 45;
    return { fUnity, pm, gm, sr, stable };
  }, [gbwMHz, loadCapPf, feedbackFactor, compCapPf]);

  // ── Section 2 Derived ────────────────────────────────────────────────────────
  const jitterPs = useMemo(() => 0.01 * Math.exp(jitterRaw * 0.04), [jitterRaw]);

  const s2 = useMemo(() => {
    const idealSNR = 6.02 * bits + 1.76;
    const jitterSNR = -20 * Math.log10(2 * Math.PI * inputFreqMHz * 1e6 * jitterPs * 1e-12);
    const effectiveSNR = Math.min(idealSNR, jitterSNR);
    const enob = (effectiveSNR - 1.76) / 6.02;
    const sfdr = 9 * enob;
    const nyquist = sampleRateMSPS / 2;
    const aliased = inputFreqMHz > nyquist;
    return { idealSNR, jitterSNR, effectiveSNR, enob, sfdr, nyquist, aliased };
  }, [bits, inputFreqMHz, jitterPs, sampleRateMSPS]);

  // ── Section 3 Derived ────────────────────────────────────────────────────────
  const s3 = useMemo(() => {
    const voutIdeal = vddPump * (stages + 1);
    const vDrop = (loadUa * 1e-6) / (capPf * 1e-12 * CLOCK_FREQ_HZ);
    const vout = vddPump * (stages + 1) - stages * vDrop - 0.3 * stages;
    const rOut = stages / (capPf * 1e-12 * CLOCK_FREQ_HZ);
    const efficiency = (vout * loadUa) / (vddPump * (stages + 1) * loadUa) * 100;
    return { voutIdeal, vDrop, vout: Math.max(0, vout), rOut, efficiency: clamp(efficiency, 0, 100) };
  }, [stages, vddPump, capPf, loadUa]);

  // ── Section 4 Derived ────────────────────────────────────────────────────────
  const s4 = useMemo(() => {
    const vT = 8.617e-5 * (tempC + 273.15);
    const vPTAT = 18 * vT;
    const vCTAT = 0.65 - 0.002 * (tempC - 27);
    const offsets = CORNER_OFFSETS[processCorner];
    const vRef = vPTAT + vCTAT + offsets.ptat + (trimBits - 8) * 0.001;

    const vT125 = 8.617e-5 * (125 + 273.15);
    const vPTAT125 = 18 * vT125;
    const vCTAT125 = 0.65 - 0.002 * (125 - 27);
    const vRef125 = vPTAT125 + vCTAT125 + offsets.ptat + (trimBits - 8) * 0.001;

    const vTm40 = 8.617e-5 * (-40 + 273.15);
    const vPTATm40 = 18 * vTm40;
    const vCTATm40 = 0.65 - 0.002 * (-40 - 27);
    const vRefm40 = vPTATm40 + vCTATm40 + offsets.ptat + (trimBits - 8) * 0.001;

    const tc = ((vRef125 - vRefm40) / 165) * 1e6;
    return { vT, vPTAT, vCTAT, vRef, tc, vRef125, vRefm40 };
  }, [tempC, processCorner, trimBits]);

  // ── Section 5 Derived ────────────────────────────────────────────────────────
  const s5Grid = useMemo(() => {
    return PVT_PROCESS_ROWS.map((proc, ri) =>
      PVT_TEMP_COLS.map((_col, ci) => {
        const factor = PVT_FACTORS[ri][ci];
        let value = 0;
        if (metricType === "delay") value = nominalNs * factor;
        else if (metricType === "power") value = (50e-3) / factor;
        else value = 1e-3 * Math.pow(factor, 3);
        return value;
      })
    );
  }, [metricType, nominalNs]);

  const s5Min = useMemo(() => Math.min(...s5Grid.flat()), [s5Grid]);
  const s5Max = useMemo(() => Math.max(...s5Grid.flat()), [s5Grid]);

  function s5Unit(): string {
    if (metricType === "delay") return "ns";
    if (metricType === "power") return "mW";
    return "µW";
  }

  function s5Display(val: number): string {
    if (metricType === "delay") return val.toFixed(2);
    if (metricType === "power") return (val * 1000).toFixed(1);
    return (val * 1e6).toFixed(2);
  }

  // ── SVG helpers ──────────────────────────────────────────────────────────────

  // Section 1: Bode Plot
  const bodePoints = useMemo(() => {
    const W = 320;
    const H = 200;
    const padL = 40;
    const padB = 30;
    const plotW = W - padL - 10;
    const plotH = H - padB - 20;

    const fMin = 1e4; // 10 kHz
    const fMax = 1e10; // 10 GHz
    const gainMax = 40; // dB top
    const gainMin = -60; // dB bottom

    function fx(freq: number): number {
      return padL + logScale(freq, fMin, fMax, plotW);
    }
    function fyGain(db: number): number {
      return 20 + plotH - ((db - gainMin) / (gainMax - gainMin)) * plotH;
    }
    function fyPhase(deg: number): number {
      return 20 + plotH - ((deg + 180) / 90) * plotH;
    }

    const fUnityHz = s1.fUnity * 1e6;
    const poleHz = gbwMHz * 1e6 * compCapPf / loadCapPf;

    const gainPts: string[] = [];
    const phasePts: string[] = [];

    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const logF = Math.log10(fMin) + (i / steps) * (Math.log10(fMax) - Math.log10(fMin));
      const f = Math.pow(10, logF);
      let gainDb: number;
      if (f < poleHz) {
        gainDb = 20 * Math.log10(gbwMHz * 1e6 / poleHz);
      } else {
        gainDb = 20 * Math.log10(gbwMHz * 1e6 / f);
      }
      gainDb = clamp(gainDb, gainMin, gainMax);
      const phDeg = -90 - Math.atan(f / poleHz) * 180 / Math.PI;
      const phClamped = clamp(phDeg, -180, -90);

      const px = fx(f);
      gainPts.push(`${px},${fyGain(gainDb)}`);
      phasePts.push(`${px},${fyPhase(phClamped)}`);
    }

    const xUnity = fx(fUnityHz);
    const pmColor = s1.stable ? "#22c55e" : "#ef4444";

    return {
      gainPts: gainPts.join(" "),
      phasePts: phasePts.join(" "),
      xUnity: clamp(xUnity, padL, W - 10),
      pmColor,
      padL,
      plotH,
      W,
      H,
      fyPhase,
      fyGain,
      pmDeg: s1.pm,
    };
  }, [s1, gbwMHz, compCapPf, loadCapPf]);

  // Section 2: SNR vs Frequency
  const adcPoints = useMemo(() => {
    const W = 320;
    const H = 200;
    const padL = 45;
    const padB = 30;
    const plotW = W - padL - 10;
    const plotH = H - padB - 20;

    const fMin = 1e3;
    const fMax = 1e9;
    const snrMax = Math.ceil(s2.idealSNR / 10) * 10 + 10;
    const snrMin = Math.max(0, snrMax - 100);

    function fx(f: number): number {
      return padL + logScale(f, fMin, fMax, plotW);
    }
    function fy(snr: number): number {
      return 20 + plotH - ((snr - snrMin) / (snrMax - snrMin)) * plotH;
    }

    const idealPts: string[] = [];
    const jitterPts: string[] = [];
    const effPts: string[] = [];

    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const logF = Math.log10(fMin) + (i / steps) * (Math.log10(fMax) - Math.log10(fMin));
      const f = Math.pow(10, logF);
      const iSNR = clamp(s2.idealSNR, snrMin, snrMax);
      const jSNR = clamp(-20 * Math.log10(2 * Math.PI * f * jitterPs * 1e-12), snrMin, snrMax);
      const eSNR = clamp(Math.min(iSNR, jSNR), snrMin, snrMax);

      const px = fx(f);
      idealPts.push(`${px},${fy(iSNR)}`);
      jitterPts.push(`${px},${fy(jSNR)}`);
      effPts.push(`${px},${fy(eSNR)}`);
    }

    const dotX = fx(inputFreqMHz * 1e6);
    const dotY = fy(clamp(s2.effectiveSNR, snrMin, snrMax));

    return { idealPts: idealPts.join(" "), jitterPts: jitterPts.join(" "), effPts: effPts.join(" "), dotX, dotY, padL, plotH, H, snrMin, snrMax, fy };
  }, [s2, jitterPs, inputFreqMHz]);

  // Section 4: Bandgap vs Temperature
  const bgPoints = useMemo(() => {
    const W = 320;
    const H = 200;
    const padL = 45;
    const padB = 30;
    const plotW = W - padL - 10;
    const plotH = H - padB - 20;

    const tMin = -40;
    const tMax = 125;
    const vMin = 0.3;
    const vMax = 1.5;

    function fx(t: number): number {
      return padL + ((t - tMin) / (tMax - tMin)) * plotW;
    }
    function fy(v: number): number {
      return 20 + plotH - ((v - vMin) / (vMax - vMin)) * plotH;
    }

    const ptatPts: string[] = [];
    const ctatPts: string[] = [];
    const refPts: string[] = [];
    const refHiPts: string[] = [];
    const refLoPts: string[] = [];

    const steps = 60;
    const offsets = CORNER_OFFSETS[processCorner];
    const trimOff = (trimBits - 8) * 0.001;

    for (let i = 0; i <= steps; i++) {
      const t = tMin + (i / steps) * (tMax - tMin);
      const vt = 8.617e-5 * (t + 273.15);
      const vp = clamp(18 * vt, vMin, vMax);
      const vc = clamp(0.65 - 0.002 * (t - 27), vMin, vMax);
      const vr = clamp(vp + vc + offsets.ptat + trimOff, vMin, vMax);
      const vrHi = clamp(vr + 0.008, vMin, vMax);
      const vrLo = clamp(vr - 0.008, vMin, vMax);

      const px = fx(t);
      ptatPts.push(`${px},${fy(vp)}`);
      ctatPts.push(`${px},${fy(vc)}`);
      refPts.push(`${px},${fy(vr)}`);
      refHiPts.push(`${px},${fy(vrHi)}`);
      refLoPts.push(`${px},${fy(vrLo)}`);
    }

    const xCur = fx(tempC);
    const yCur = fy(clamp(s4.vRef, vMin, vMax));

    const bandPath =
      `M ${refHiPts[0]} ` +
      refHiPts.slice(1).join(" ") +
      ` L ${refLoPts[refLoPts.length - 1]} ` +
      refLoPts.slice(0, -1).reverse().join(" ") +
      " Z";

    return { ptatPts: ptatPts.join(" "), ctatPts: ctatPts.join(" "), refPts: refPts.join(" "), bandPath, xCur, yCur, padL, plotH, H, fx, fy };
  }, [tempC, processCorner, trimBits, s4.vRef]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="bg-pink-500/20 rounded-xl border border-pink-500/30 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-pink-500/20">
              <Activity className="w-6 h-6 text-pink-400" />
            </div>
            <h1 className="text-2xl font-bold text-pink-400">Analog &amp; Mixed-Signal Design</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Op-amp stability, ADC performance, charge pump, bandgap reference, and PVT corner analysis
          </p>
        </div>

        {/* ── Section 1: Op-Amp Stability ──────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-pink-400" />
            <h2 className="text-lg font-semibold">Op-Amp Stability Analyzer</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Controls */}
            <div className="space-y-4">
              {/* GBW */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">GBW Product</span>
                  <span className="font-mono text-pink-400">{gbwMHz} MHz</span>
                </div>
                <input type="range" min={1} max={1000} step={10} value={gbwMHz}
                  onChange={e => setGbwMHz(Number(e.target.value))}
                  className="w-full accent-pink-500" />
              </div>
              {/* Load Cap */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Load Capacitance</span>
                  <span className="font-mono text-pink-400">{loadCapPf} pF</span>
                </div>
                <input type="range" min={1} max={100} step={1} value={loadCapPf}
                  onChange={e => setLoadCapPf(Number(e.target.value))}
                  className="w-full accent-pink-500" />
              </div>
              {/* Feedback Factor */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Feedback Factor β</span>
                  <span className="font-mono text-pink-400">{feedbackFactor.toFixed(2)}</span>
                </div>
                <input type="range" min={0.1} max={1.0} step={0.05} value={feedbackFactor}
                  onChange={e => setFeedbackFactor(Number(e.target.value))}
                  className="w-full accent-pink-500" />
              </div>
              {/* Compensation Cap */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Compensation Cap</span>
                  <span className="font-mono text-pink-400">{compCapPf} pF</span>
                </div>
                <input type="range" min={0.5} max={20} step={0.5} value={compCapPf}
                  onChange={e => setCompCapPf(Number(e.target.value))}
                  className="w-full accent-pink-500" />
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className={`rounded-lg border p-3 ${s1.stable ? "border-green-500/40 bg-green-500/10" : "border-red-500/40 bg-red-500/10"}`}>
                  <div className="flex items-center gap-1 mb-1">
                    {s1.stable ? <CheckCircle className="w-4 h-4 text-green-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Phase Margin</span>
                  </div>
                  <p className={`text-xl font-mono font-bold ${s1.stable ? "text-green-400" : "text-red-400"}`}>
                    {formatVal(s1.pm, 1)}°
                  </p>
                  <p className="text-xs text-muted-foreground">{s1.stable ? "Stable" : "Unstable (<45°)"}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Slew Rate</p>
                  <p className="text-xl font-mono font-bold text-pink-400">{formatVal(s1.sr, 1)} V/µs</p>
                  <p className="text-xs text-muted-foreground">I_bias=2µA</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Unity-Gain Freq</p>
                  <p className="text-xl font-mono font-bold text-blue-400">{formatVal(s1.fUnity, 1)} MHz</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Gain Margin</p>
                  <p className="text-xl font-mono font-bold text-amber-400">{isFinite(s1.gm) ? formatVal(s1.gm, 1) : "∞"} dB</p>
                </div>
              </div>

              {/* Formula card */}
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Phase Margin</p>
                <p className="font-mono text-sm">PM = 180° + ∠H(jω)|&#8203;₍|H|=1₎</p>
                <p className="text-xs text-muted-foreground mt-1">Stable if PM &gt; 45°, ideal PM ≈ 60°</p>
              </div>
            </div>

            {/* Bode Plot SVG */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase">Bode Plot (Gain &amp; Phase)</p>
              <svg viewBox="0 0 320 200" className="w-full bg-muted/10 rounded-lg border border-border">
                {/* Grid lines */}
                {[0, 1, 2, 3].map(i => (
                  <line key={`hg${i}`} x1={bodePoints.padL} x2={310} y1={20 + i * (bodePoints.plotH / 3)} x2_={310}
                    stroke="#ffffff10" strokeWidth={1} />
                ))}
                {/* Gain curve */}
                <polyline points={bodePoints.gainPts} fill="none" stroke="#f472b6" strokeWidth={2} />
                {/* Phase curve */}
                <polyline points={bodePoints.phasePts} fill="none" stroke="#60a5fa" strokeWidth={2} strokeDasharray="4,2" />
                {/* Unity gain vertical */}
                <line x1={bodePoints.xUnity} x2={bodePoints.xUnity} y1={20} y2={20 + bodePoints.plotH}
                  stroke={bodePoints.pmColor} strokeWidth={1.5} strokeDasharray="3,3" />
                {/* PM bracket annotation */}
                <text x={bodePoints.xUnity + 3} y={35} fontSize={9} fill={bodePoints.pmColor} fontFamily="monospace">
                  f_u={formatVal(s1.fUnity, 0)}M
                </text>
                <text x={bodePoints.xUnity + 3} y={47} fontSize={9} fill={bodePoints.pmColor} fontFamily="monospace">
                  PM={formatVal(s1.pm, 1)}°
                </text>
                {/* 0dB line */}
                <line x1={bodePoints.padL} x2={310}
                  y1={bodePoints.plotH * (60 / 100) + 20}
                  y2={bodePoints.plotH * (60 / 100) + 20}
                  stroke="#ffffff20" strokeWidth={1} strokeDasharray="2,2" />
                <text x={bodePoints.padL - 2} y={bodePoints.plotH * (60 / 100) + 23} fontSize={8} fill="#ffffff40" textAnchor="end">0dB</text>
                {/* Labels */}
                <text x={bodePoints.padL + 2} y={195} fontSize={8} fill="#ffffff40">10k</text>
                <text x={200} y={195} fontSize={8} fill="#ffffff40">1G</text>
                <text x={295} y={195} fontSize={8} fill="#ffffff40">10G</text>
                {/* Legend */}
                <line x1={55} x2={75} y1={25} y2={25} stroke="#f472b6" strokeWidth={2} />
                <text x={78} y={28} fontSize={8} fill="#f472b6">Gain</text>
                <line x1={55} x2={75} y1={38} y2={38} stroke="#60a5fa" strokeWidth={2} strokeDasharray="4,2" />
                <text x={78} y={41} fontSize={8} fill="#60a5fa">Phase</text>
              </svg>
            </div>
          </div>
        </div>

        {/* ── Section 2: ADC Performance ────────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Radio className="w-5 h-5 text-pink-400" />
            <h2 className="text-lg font-semibold">ADC Performance (SNR / ENOB)</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              {/* Bits */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Resolution</span>
                  <span className="font-mono text-pink-400">{bits} bits</span>
                </div>
                <input type="range" min={4} max={24} step={1} value={bits}
                  onChange={e => setBits(Number(e.target.value))}
                  className="w-full accent-pink-500" />
              </div>
              {/* Input Freq */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Input Frequency</span>
                  <span className="font-mono text-pink-400">{inputFreqMHz} MHz</span>
                </div>
                <input type="range" min={0.001} max={500} step={0.5} value={inputFreqMHz}
                  onChange={e => setInputFreqMHz(Number(e.target.value))}
                  className="w-full accent-pink-500" />
              </div>
              {/* Sample Rate */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Sample Rate</span>
                  <span className="font-mono text-pink-400">{sampleRateMSPS} MSPS</span>
                </div>
                <input type="range" min={1} max={5000} step={10} value={sampleRateMSPS}
                  onChange={e => setSampleRateMSPS(Number(e.target.value))}
                  className="w-full accent-pink-500" />
              </div>
              {/* Jitter */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Aperture Jitter</span>
                  <span className="font-mono text-pink-400">{jitterPs.toFixed(2)} ps</span>
                </div>
                <input type="range" min={0} max={200} step={1} value={jitterRaw}
                  onChange={e => setJitterRaw(Number(e.target.value))}
                  className="w-full accent-pink-500" />
              </div>

              {/* Nyquist warning */}
              {s2.aliased && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-300">
                    Input {inputFreqMHz} MHz exceeds Nyquist ({s2.nyquist.toFixed(1)} MHz) — aliasing!
                  </p>
                </div>
              )}

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Ideal SNR</p>
                  <p className="text-lg font-mono font-bold text-pink-400">{formatVal(s2.idealSNR, 1)} dB</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Effective SNR</p>
                  <p className="text-lg font-mono font-bold text-amber-400">{formatVal(s2.effectiveSNR, 1)} dB</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">ENOB</p>
                  <p className="text-lg font-mono font-bold text-green-400">{formatVal(s2.enob, 2)} bits</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">SFDR</p>
                  <p className="text-lg font-mono font-bold text-blue-400">{formatVal(s2.sfdr, 1)} dB</p>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">ENOB Formula</p>
                <p className="font-mono text-sm">ENOB = (SNR − 1.76) / 6.02</p>
                <p className="text-xs text-muted-foreground mt-1">SNR_jitter = −20log₁₀(2πf·τ_j)</p>
              </div>
            </div>

            {/* SNR vs Frequency SVG */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase">SNR vs Input Frequency</p>
              <svg viewBox="0 0 320 200" className="w-full bg-muted/10 rounded-lg border border-border">
                {/* Grid */}
                {[0, 1, 2, 3].map(i => (
                  <line key={`ag${i}`} x1={adcPoints.padL} x2={310} y1={20 + i * (adcPoints.plotH / 3)} y2={20 + i * (adcPoints.plotH / 3)}
                    stroke="#ffffff10" strokeWidth={1} />
                ))}
                {/* Ideal SNR dashed */}
                <polyline points={adcPoints.idealPts} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5,3" />
                {/* Jitter SNR */}
                <polyline points={adcPoints.jitterPts} fill="none" stroke="#f472b6" strokeWidth={1.5} strokeDasharray="3,2" />
                {/* Effective SNR */}
                <polyline points={adcPoints.effPts} fill="none" stroke="#22c55e" strokeWidth={2.5} />
                {/* Current operating point */}
                <circle cx={adcPoints.dotX} cy={adcPoints.dotY} r={4} fill="#f59e0b" stroke="#000" strokeWidth={1} />
                {/* Labels */}
                <text x={adcPoints.padL + 2} y={195} fontSize={8} fill="#ffffff40">1k</text>
                <text x={170} y={195} fontSize={8} fill="#ffffff40">1M</text>
                <text x={295} y={195} fontSize={8} fill="#ffffff40">1G</text>
                <text x={adcPoints.padL - 2} y={25} fontSize={8} fill="#ffffff40" textAnchor="end">
                  {adcPoints.snrMax.toFixed(0)}
                </text>
                <text x={adcPoints.padL - 2} y={20 + adcPoints.plotH} fontSize={8} fill="#ffffff40" textAnchor="end">
                  {adcPoints.snrMin.toFixed(0)}
                </text>
                <text x={adcPoints.padL - 2} y={adcPoints.H / 2} fontSize={7} fill="#ffffff50" textAnchor="end" transform={`rotate(-90,${adcPoints.padL - 10},${adcPoints.H / 2})`}>SNR (dB)</text>
                {/* Legend */}
                <line x1={55} x2={75} y1={25} y2={25} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5,3" />
                <text x={78} y={28} fontSize={8} fill="#94a3b8">Ideal</text>
                <line x1={55} x2={75} y1={38} y2={38} stroke="#f472b6" strokeWidth={1.5} strokeDasharray="3,2" />
                <text x={78} y={41} fontSize={8} fill="#f472b6">Jitter</text>
                <line x1={55} x2={75} y1={51} y2={51} stroke="#22c55e" strokeWidth={2} />
                <text x={78} y={54} fontSize={8} fill="#22c55e">Effective</text>
              </svg>
            </div>
          </div>
        </div>

        {/* ── Section 3: Charge Pump ────────────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-pink-400" />
            <h2 className="text-lg font-semibold">Charge Pump Voltage Multiplier</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              {/* Stages */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Pump Stages (N)</span>
                  <span className="font-mono text-pink-400">{stages}</span>
                </div>
                <input type="range" min={1} max={8} step={1} value={stages}
                  onChange={e => setStages(Number(e.target.value))}
                  className="w-full accent-pink-500" />
              </div>
              {/* VDD */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Supply Voltage V_DD</span>
                  <span className="font-mono text-pink-400">{vddPump.toFixed(1)} V</span>
                </div>
                <input type="range" min={1.0} max={3.3} step={0.1} value={vddPump}
                  onChange={e => setVddPump(Number(e.target.value))}
                  className="w-full accent-pink-500" />
              </div>
              {/* Cap */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Pump Capacitor</span>
                  <span className="font-mono text-pink-400">{capPf} pF</span>
                </div>
                <input type="range" min={10} max={1000} step={10} value={capPf}
                  onChange={e => setCapPf(Number(e.target.value))}
                  className="w-full accent-pink-500" />
              </div>
              {/* Load */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Load Current</span>
                  <span className="font-mono text-pink-400">{loadUa} µA</span>
                </div>
                <input type="range" min={1} max={1000} step={10} value={loadUa}
                  onChange={e => setLoadUa(Number(e.target.value))}
                  className="w-full accent-pink-500" />
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Ideal V_out</p>
                  <p className="text-lg font-mono font-bold text-pink-400">{formatVal(s3.voutIdeal, 2)} V</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Actual V_out</p>
                  <p className="text-lg font-mono font-bold text-amber-400">{formatVal(s3.vout, 2)} V</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Output R</p>
                  <p className="text-lg font-mono font-bold text-blue-400">{formatVal(s3.rOut, 0)} Ω</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Efficiency</p>
                  <p className="text-lg font-mono font-bold text-green-400">{formatVal(s3.efficiency, 1)} %</p>
                </div>
              </div>

              {/* Efficiency bar */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Efficiency</p>
                <div className="h-3 bg-muted/20 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-pink-500 to-amber-400 rounded-full"
                    animate={{ width: `${s3.efficiency}%` }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  />
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Dickson Charge Pump</p>
                <p className="font-mono text-sm">V_out = (N+1)·V_DD − N·V_drop</p>
                <p className="text-xs text-muted-foreground mt-1">V_drop = I_load / (C_pump · f_clk)</p>
              </div>
            </div>

            {/* Charge Pump Schematic SVG */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase">Dickson Charge Pump Schematic</p>
              <svg viewBox="0 0 340 160" className="w-full bg-muted/10 rounded-lg border border-border">
                {(() => {
                  const drawStages = Math.min(stages, 5);
                  const stageW = 260 / drawStages;
                  const midY = 80;
                  const clkY = 20;
                  const gndY = 140;

                  const elements: React.ReactNode[] = [];

                  // Clock rails
                  elements.push(
                    <line key="clkrail" x1={30} x2={310} y1={clkY} y2={clkY} stroke="#f472b680" strokeWidth={1} strokeDasharray="4,2" />,
                    <line key="gndrail" x1={30} x2={310} y1={gndY} y2={gndY} stroke="#60a5fa80" strokeWidth={1} strokeDasharray="4,2" />,
                    <text key="clklbl" x={10} y={clkY + 4} fontSize={8} fill="#f472b6" fontFamily="monospace">φ</text>,
                    <text key="gndrbl" x={8} y={gndY + 4} fontSize={8} fill="#60a5fa" fontFamily="monospace">φ̄</text>,
                  );

                  // VDD input
                  elements.push(
                    <text key="vdd" x={25} y={midY + 4} fontSize={9} fill="#a3e635" fontFamily="monospace">VDD</text>,
                    <line key="vddi" x1={42} x2={55} y1={midY} y2={midY} stroke="#ffffff60" strokeWidth={1.5} />,
                  );

                  // Draw stages
                  for (let s = 0; s < drawStages; s++) {
                    const x0 = 55 + s * stageW;
                    const capX = x0 + stageW * 0.35;
                    const dioX = x0 + stageW * 0.65;
                    const phaseClk = s % 2 === 0 ? clkY : gndY;
                    const capColor = s % 2 === 0 ? "#f472b6" : "#60a5fa";

                    // Capacitor (vertical plates)
                    elements.push(
                      <line key={`cl1-${s}`} x1={capX} x2={capX} y1={midY - 10} y2={midY + 10} stroke={capColor} strokeWidth={2.5} />,
                      <line key={`cl2-${s}`} x1={capX + 5} x2={capX + 5} y1={midY - 10} y2={midY + 10} stroke={capColor} strokeWidth={2.5} />,
                      // Wire from horizontal to cap
                      <line key={`cw-${s}`} x1={x0} x2={capX} y1={midY} y2={midY} stroke="#ffffff50" strokeWidth={1.5} />,
                      // Vertical wire to clock rail
                      <line key={`cv-${s}`} x1={capX + 2} x2={capX + 2} y1={midY + 10} y2={phaseClk} stroke={capColor} strokeWidth={1} strokeDasharray="2,2" />,
                    );

                    // Diode (triangle with bar)
                    elements.push(
                      <polygon key={`dt-${s}`} points={`${dioX},${midY - 7} ${dioX},${midY + 7} ${dioX + 12},${midY}`} fill="#f59e0b" opacity={0.8} />,
                      <line key={`db-${s}`} x1={dioX + 12} x2={dioX + 12} y1={midY - 7} y2={midY + 7} stroke="#f59e0b" strokeWidth={2} />,
                      // Wire cap to diode
                      <line key={`dw-${s}`} x1={capX + 5} x2={dioX} y1={midY} y2={midY} stroke="#ffffff50" strokeWidth={1.5} />,
                      // Wire diode to next stage
                      <line key={`dn-${s}`} x1={dioX + 12} x2={x0 + stageW} y1={midY} y2={midY} stroke="#ffffff50" strokeWidth={1.5} />,
                    );
                  }

                  // Vout label
                  const outX = 55 + drawStages * stageW;
                  elements.push(
                    <text key="vout" x={outX + 2} y={midY + 4} fontSize={9} fill="#a3e635" fontFamily="monospace">
                      V_out
                    </text>,
                    <text key="voutn" x={outX + 2} y={midY + 14} fontSize={8} fill="#a3e63590" fontFamily="monospace">
                      {formatVal(s3.vout, 2)}V
                    </text>,
                  );

                  return elements;
                })()}
              </svg>
            </div>
          </div>
        </div>

        {/* ── Section 4: Bandgap Reference ──────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="w-5 h-5 text-pink-400" />
            <h2 className="text-lg font-semibold">Bandgap Reference Circuit</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              {/* Temperature */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Temperature</span>
                  <span className="font-mono text-pink-400">{tempC}°C</span>
                </div>
                <input type="range" min={-40} max={125} step={5} value={tempC}
                  onChange={e => setTempC(Number(e.target.value))}
                  className="w-full accent-pink-500" />
              </div>

              {/* Trim Bits */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Trim DAC (0–15)</span>
                  <span className="font-mono text-pink-400">{trimBits} ({trimBits >= 8 ? "+" : ""}{(trimBits - 8) * 1}mV offset)</span>
                </div>
                <input type="range" min={0} max={15} step={1} value={trimBits}
                  onChange={e => setTrimBits(Number(e.target.value))}
                  className="w-full accent-pink-500" />
              </div>

              {/* Process Corner Toggle */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Process Corner</p>
                <div className="flex gap-2 flex-wrap">
                  {(["TT", "FF", "SS", "FS", "SF"] as ProcessCorner[]).map(c => (
                    <button
                      key={c}
                      onClick={() => setProcessCorner(c)}
                      className={`px-3 py-1 rounded text-xs font-mono font-semibold border transition-colors ${
                        processCorner === c
                          ? "border-pink-500 bg-pink-500/20 text-pink-400"
                          : "border-border bg-muted/20 text-muted-foreground hover:border-pink-500/50"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">V_ref</p>
                  <p className="text-xl font-mono font-bold text-amber-400">{formatVal(s4.vRef, 4)} V</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Temp Coeff</p>
                  <p className="text-xl font-mono font-bold text-blue-400">{formatVal(Math.abs(s4.tc), 1)} ppm/°C</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">V_PTAT</p>
                  <p className="text-xl font-mono font-bold text-pink-400">{formatVal(s4.vPTAT, 4)} V</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">V_CTAT (Vbe)</p>
                  <p className="text-xl font-mono font-bold text-green-400">{formatVal(s4.vCTAT, 4)} V</p>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Bandgap Principle</p>
                <p className="font-mono text-sm">V_bg = V_T·ln(Is2/Is1)·k + V_be ≈ 1.25V</p>
                <p className="text-xs text-muted-foreground mt-1">PTAT cancels CTAT, TC→0 at trim point</p>
              </div>
            </div>

            {/* Bandgap V vs T SVG */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase">V_ref vs Temperature</p>
              <svg viewBox="0 0 320 200" className="w-full bg-muted/10 rounded-lg border border-border">
                {/* Trim band */}
                <path d={bgPoints.bandPath} fill="#f59e0b18" />
                {/* PTAT */}
                <polyline points={bgPoints.ptatPts} fill="none" stroke="#f472b6" strokeWidth={1.5} strokeDasharray="4,2" />
                {/* CTAT */}
                <polyline points={bgPoints.ctatPts} fill="none" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4,2" />
                {/* V_ref */}
                <polyline points={bgPoints.refPts} fill="none" stroke="#fbbf24" strokeWidth={2.5} />
                {/* Current temp vertical */}
                <line x1={bgPoints.xCur} x2={bgPoints.xCur} y1={20} y2={20 + bgPoints.plotH}
                  stroke="#ffffff40" strokeWidth={1} strokeDasharray="3,3" />
                {/* Current point */}
                <circle cx={bgPoints.xCur} cy={bgPoints.yCur} r={4} fill="#fbbf24" stroke="#000" strokeWidth={1} />
                {/* Axis labels */}
                <text x={bgPoints.padL} y={195} fontSize={8} fill="#ffffff40">−40°C</text>
                <text x={220} y={195} fontSize={8} fill="#ffffff40">125°C</text>
                <text x={bgPoints.padL - 2} y={25} fontSize={8} fill="#ffffff40" textAnchor="end">1.5V</text>
                <text x={bgPoints.padL - 2} y={20 + bgPoints.plotH} fontSize={8} fill="#ffffff40" textAnchor="end">0.3V</text>
                {/* Legend */}
                <line x1={55} x2={75} y1={25} y2={25} stroke="#f472b6" strokeWidth={1.5} strokeDasharray="4,2" />
                <text x={78} y={28} fontSize={8} fill="#f472b6">PTAT</text>
                <line x1={55} x2={75} y1={38} y2={38} stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4,2" />
                <text x={78} y={41} fontSize={8} fill="#60a5fa">CTAT</text>
                <line x1={55} x2={75} y1={51} y2={51} stroke="#fbbf24" strokeWidth={2} />
                <text x={78} y={54} fontSize={8} fill="#fbbf24">V_ref</text>
              </svg>
            </div>
          </div>
        </div>

        {/* ── Section 5: PVT Corner Analysis ────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-5 h-5 text-pink-400" />
            <h2 className="text-lg font-semibold">PVT Corner Analysis</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              {/* Metric Toggle */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Metric</p>
                <div className="flex gap-2">
                  {(["delay", "power", "leakage"] as MetricType[]).map(m => (
                    <button
                      key={m}
                      onClick={() => setMetricType(m)}
                      className={`px-3 py-1 rounded text-xs font-mono font-semibold border transition-colors ${
                        metricType === m
                          ? "border-pink-500 bg-pink-500/20 text-pink-400"
                          : "border-border bg-muted/20 text-muted-foreground hover:border-pink-500/50"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nominal NS */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Nominal Delay</span>
                  <span className="font-mono text-pink-400">{nominalNs.toFixed(1)} ns</span>
                </div>
                <input type="range" min={0.5} max={5.0} step={0.1} value={nominalNs}
                  onChange={e => setNominalNs(Number(e.target.value))}
                  className="w-full accent-pink-500" />
              </div>

              {/* Worst case info */}
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3">
                <div className="flex items-center gap-1 mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-semibold text-red-400 uppercase">Worst Setup Corner</span>
                </div>
                <p className="text-xs text-muted-foreground">SS + Low Vdd + Hot temp</p>
                <p className="text-sm font-mono text-red-300 mt-1">
                  {metricType === "delay" && `${(nominalNs * 1.8).toFixed(2)} ns`}
                  {metricType === "power" && `${((50e-3 / 1.8) * 1000).toFixed(1)} mW`}
                  {metricType === "leakage" && `${(1e-3 * Math.pow(1.8, 3) * 1e6).toFixed(2)} µW`}
                </p>
              </div>

              <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-3">
                <div className="flex items-center gap-1 mb-1">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-xs font-semibold text-green-400 uppercase">Best Hold Corner</span>
                </div>
                <p className="text-xs text-muted-foreground">FF + High Vdd + Cold temp</p>
                <p className="text-sm font-mono text-green-300 mt-1">
                  {metricType === "delay" && `${(nominalNs * 0.6).toFixed(2)} ns`}
                  {metricType === "power" && `${((50e-3 / 0.6) * 1000).toFixed(1)} mW`}
                  {metricType === "leakage" && `${(1e-3 * Math.pow(0.6, 3) * 1e6).toFixed(2)} µW`}
                </p>
              </div>

              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Worst-Case Analysis</p>
                <p className="font-mono text-sm">Worst corner = SS + Low Vdd + Hot</p>
                <p className="text-xs text-muted-foreground mt-1">For setup timing violations; FF+Cold for hold</p>
              </div>
            </div>

            {/* PVT Grid SVG */}
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase">
                5×3 PVT Corner Grid ({s5Unit()})
              </p>
              <svg viewBox="0 0 340 200" className="w-full bg-muted/10 rounded-lg border border-border">
                {(() => {
                  const padL = 30;
                  const padT = 25;
                  const cellW = (310 - padL) / 3;
                  const cellH = (180 - padT) / 5;
                  const items: React.ReactNode[] = [];

                  // Column headers
                  PVT_TEMP_COLS.forEach((col, ci) => {
                    items.push(
                      <text key={`ch${ci}`}
                        x={padL + ci * cellW + cellW / 2}
                        y={padT - 5}
                        fontSize={9} fill="#ffffff80" textAnchor="middle" fontFamily="monospace">
                        {col}
                      </text>
                    );
                  });

                  // Row labels
                  PVT_PROCESS_ROWS.forEach((row, ri) => {
                    items.push(
                      <text key={`rl${ri}`}
                        x={padL - 3}
                        y={padT + ri * cellH + cellH / 2 + 4}
                        fontSize={9} fill="#ffffff80" textAnchor="end" fontFamily="monospace">
                        {row}
                      </text>
                    );
                  });

                  // Cells
                  PVT_PROCESS_ROWS.forEach((_row, ri) => {
                    PVT_TEMP_COLS.forEach((_col, ci) => {
                      const val = s5Grid[ri][ci];
                      const t = s5Max === s5Min ? 0.5 : (val - s5Min) / (s5Max - s5Min);
                      const fill = interpColor(metricType === "delay" ? t : 1 - t);
                      const cx = padL + ci * cellW;
                      const cy = padT + ri * cellH;
                      items.push(
                        <rect key={`cell${ri}-${ci}`} x={cx + 1} y={cy + 1} width={cellW - 2} height={cellH - 2}
                          fill={fill} opacity={0.7} rx={2} />,
                        <text key={`cval${ri}-${ci}`}
                          x={cx + cellW / 2} y={cy + cellH / 2 + 4}
                          fontSize={8} fill="#000000cc" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
                          {s5Display(val)}
                        </text>
                      );
                    });
                  });

                  return items;
                })()}
              </svg>
            </div>
          </div>
        </div>

        {/* ── Bottom Formula Reference ───────────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-pink-400" />
            <h2 className="text-lg font-semibold">Formula Reference</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Phase Margin</p>
              <p className="font-mono text-sm">PM = 180° + ∠H(jωu)</p>
              <p className="text-xs text-muted-foreground mt-1">phase margin at unity gain; stable if PM &gt; 45°</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">ENOB</p>
              <p className="font-mono text-sm">ENOB = (SNR − 1.76) / 6.02</p>
              <p className="text-xs text-muted-foreground mt-1">effective number of bits from measured SNR</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Dickson Pump</p>
              <p className="font-mono text-sm">V_out = (N+1)·V_DD − N·ΔV</p>
              <p className="text-xs text-muted-foreground mt-1">N stages, ΔV = I_load / (C·f_clk)</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Bandgap Reference</p>
              <p className="font-mono text-sm">V_bg ≈ 1.25V</p>
              <p className="text-xs text-muted-foreground mt-1">TC≈0 ppm/°C at trim point; PTAT+CTAT cancel</p>
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
