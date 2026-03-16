"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Radio,
  Zap,
  Activity,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Clock,
  Waves,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

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
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">{label}</p>
      <p className="font-mono text-sm">{formula}</p>
      <p className="text-xs text-muted-foreground mt-1">{explanation}</p>
    </div>
  );
}

type FecType = "RS(255,239)" | "RS(255,223)" | "LDPC(0.8)" | "LDPC(0.93)";
type Encoding = "NRZ" | "PAM4";

// ─── Section 1: SerDes Link Budget SVG ───────────────────────────────────────

function LinkBudgetSVG({
  traceLoss,
  viaLoss,
  connectorLoss,
  linkMargin,
}: {
  traceLoss: number;
  viaLoss: number;
  connectorLoss: number;
  linkMargin: number;
}) {
  const totalBudget = 24;
  const w = 380;
  const barH = 28;
  const barY = 50;

  const tracePx = clamp((traceLoss / totalBudget) * w, 0, w);
  const viaPx = clamp((viaLoss / totalBudget) * w, 0, w - tracePx);
  const connPx = clamp((connectorLoss / totalBudget) * w, 0, w - tracePx - viaPx);
  const marginPx = clamp((Math.abs(linkMargin) / totalBudget) * w, 0, w - tracePx - viaPx - connPx);

  const marginColor = linkMargin > 3 ? "#22c55e" : linkMargin > 0 ? "#f59e0b" : "#ef4444";

  return (
    <svg viewBox="0 0 400 160" className="w-full" style={{ maxHeight: 180 }}>
      {/* Background bar */}
      <rect x={10} y={barY} width={w} height={barH} rx={4} fill="#1e293b" stroke="#334155" strokeWidth={1} />

      {/* Budget label */}
      <text x={10} y={barY - 8} fontSize={8} fill="#94a3b8" fontFamily="monospace">
        Link Budget: {totalBudget} dB
      </text>

      {/* Trace loss segment */}
      <rect x={10} y={barY} width={tracePx} height={barH} rx={2} fill="#f97316" />
      {tracePx > 20 && (
        <text x={10 + tracePx / 2} y={barY + barH / 2 + 4} textAnchor="middle" fontSize={7} fill="#fff" fontFamily="monospace">
          Trace
        </text>
      )}

      {/* Via loss segment */}
      <rect x={10 + tracePx} y={barY} width={viaPx} height={barH} fill="#eab308" />
      {viaPx > 20 && (
        <text x={10 + tracePx + viaPx / 2} y={barY + barH / 2 + 4} textAnchor="middle" fontSize={7} fill="#fff" fontFamily="monospace">
          Via
        </text>
      )}

      {/* Connector loss segment */}
      <rect x={10 + tracePx + viaPx} y={barY} width={connPx} height={barH} fill="#a78bfa" />
      {connPx > 20 && (
        <text x={10 + tracePx + viaPx + connPx / 2} y={barY + barH / 2 + 4} textAnchor="middle" fontSize={7} fill="#fff" fontFamily="monospace">
          Conn
        </text>
      )}

      {/* Margin segment */}
      <rect x={10 + tracePx + viaPx + connPx} y={barY} width={marginPx} height={barH} fill={marginColor} />
      {marginPx > 20 && (
        <text x={10 + tracePx + viaPx + connPx + marginPx / 2} y={barY + barH / 2 + 4} textAnchor="middle" fontSize={7} fill="#fff" fontFamily="monospace">
          {linkMargin > 0 ? "Margin" : "OVER"}
        </text>
      )}

      {/* Legend */}
      {[
        { color: "#f97316", label: `Trace: ${traceLoss.toFixed(1)} dB` },
        { color: "#eab308", label: `Via: ${viaLoss.toFixed(1)} dB` },
        { color: "#a78bfa", label: `Conn: ${connectorLoss.toFixed(1)} dB` },
        { color: marginColor, label: `Margin: ${linkMargin.toFixed(1)} dB` },
      ].map((item, i) => (
        <g key={i}>
          <rect x={10 + i * 95} y={100} width={10} height={10} rx={2} fill={item.color} />
          <text x={24 + i * 95} y={109} fontSize={7} fill="#94a3b8" fontFamily="monospace">
            {item.label}
          </text>
        </g>
      ))}

      {/* dB tick marks */}
      {[0, 6, 12, 18, 24].map((db) => {
        const x = 10 + (db / totalBudget) * w;
        return (
          <g key={db}>
            <line x1={x} y1={barY + barH} x2={x} y2={barY + barH + 6} stroke="#475569" strokeWidth={1} />
            <text x={x} y={barY + barH + 16} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily="monospace">
              {db}
            </text>
          </g>
        );
      })}
      <text x={200} y={155} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily="monospace">
        dB loss
      </text>
    </svg>
  );
}

// ─── Section 2: Eye Diagram SVG ───────────────────────────────────────────────

function EyeDiagramSVG({
  eyeOpening,
  noisePowerdBm,
}: {
  eyeOpening: number;
  noisePowerdBm: number;
}) {
  const cx = 200;
  const cy = 80;
  const eyeW = 120;
  const eyeHalf = (eyeOpening / 100) * 50;
  const noiseH = clamp(Math.pow(10, (noisePowerdBm + 60) / 20), 2, 20);

  // Eye color based on opening
  const eyeColor = eyeOpening > 50 ? "#22c55e" : eyeOpening > 20 ? "#f59e0b" : "#ef4444";

  return (
    <svg viewBox="0 0 400 160" className="w-full" style={{ maxHeight: 180 }}>
      {/* Background */}
      <rect x={0} y={0} width={400} height={160} fill="#0f172a" rx={4} />

      {/* Grid lines */}
      {[40, 80, 120].map((y) => (
        <line key={y} x1={20} y1={y} x2={380} y2={y} stroke="#1e293b" strokeWidth={1} />
      ))}
      {[80, 160, 240, 320].map((x) => (
        <line key={x} x1={x} y1={10} x2={x} y2={150} stroke="#1e293b" strokeWidth={1} />
      ))}

      {/* Eye traces — 3 overlapping NRZ-style eyes */}
      {[-1, 0, 1].map((offset) => {
        const ox = cx + offset * 130;
        // Upper envelope
        return (
          <g key={offset}>
            <path
              d={`M ${ox - eyeW / 2} ${cy - 45} Q ${ox} ${cy - eyeHalf} ${ox + eyeW / 2} ${cy - 45}`}
              fill="none"
              stroke="#64748b"
              strokeWidth={1.5}
            />
            {/* Lower envelope */}
            <path
              d={`M ${ox - eyeW / 2} ${cy + 45} Q ${ox} ${cy + eyeHalf} ${ox + eyeW / 2} ${cy + 45}`}
              fill="none"
              stroke="#64748b"
              strokeWidth={1.5}
            />
            {/* Crossing lines */}
            <line x1={ox - eyeW / 2} y1={cy - 45} x2={ox - eyeW / 2} y2={cy + 45} stroke="#475569" strokeWidth={1} />
            <line x1={ox + eyeW / 2} y1={cy - 45} x2={ox + eyeW / 2} y2={cy + 45} stroke="#475569" strokeWidth={1} />
          </g>
        );
      })}

      {/* Eye opening area (center) */}
      <ellipse cx={cx} cy={cy} rx={eyeW / 2 - 8} ry={Math.max(2, eyeHalf - noiseH)} fill={eyeColor} opacity={0.25} />
      <ellipse cx={cx} cy={cy} rx={eyeW / 2 - 8} ry={Math.max(2, eyeHalf - noiseH)} fill="none" stroke={eyeColor} strokeWidth={1.5} />

      {/* Noise band */}
      <rect x={cx - eyeW / 2} y={cy - noiseH / 2} width={eyeW} height={noiseH} fill="#ef4444" opacity={0.2} />

      {/* Labels */}
      <text x={200} y={14} textAnchor="middle" fontSize={8} fill="#94a3b8" fontFamily="monospace">
        Eye Diagram — Opening: {eyeOpening.toFixed(0)}%
      </text>
      <text x={200} y={150} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily="monospace">
        Time →
      </text>
      <text x={14} y={84} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily="monospace" transform="rotate(-90, 14, 84)">
        Amp
      </text>
    </svg>
  );
}

// ─── Section 3: Jitter Budget SVG ────────────────────────────────────────────

function JitterBudgetSVG({
  djTx,
  djCh,
  rjContrib,
  totalJitter,
  UIps,
}: {
  djTx: number;
  djCh: number;
  rjContrib: number;
  totalJitter: number;
  UIps: number;
}) {
  const barW = 320;
  const barH = 22;
  const scale = barW / (UIps * 1.2);

  const djTxPx = clamp(djTx * scale, 0, barW);
  const djChPx = clamp(djCh * scale, 0, barW - djTxPx);
  const rjPx = clamp(rjContrib * scale, 0, barW - djTxPx - djChPx);
  const uiX = 40 + UIps * scale;

  return (
    <svg viewBox="0 0 400 160" className="w-full" style={{ maxHeight: 180 }}>
      {/* DJ_tx bar */}
      <text x={40} y={38} fontSize={8} fill="#94a3b8" fontFamily="monospace">Jitter Components (ps)</text>

      <rect x={40} y={45} width={djTxPx} height={barH} rx={2} fill="#8b5cf6" />
      {djTxPx > 20 && (
        <text x={40 + djTxPx / 2} y={45 + barH / 2 + 4} textAnchor="middle" fontSize={7} fill="#fff" fontFamily="monospace">
          DJ_tx
        </text>
      )}

      {/* DJ_ch bar */}
      <rect x={40 + djTxPx} y={45} width={djChPx} height={barH} rx={2} fill="#3b82f6" />
      {djChPx > 20 && (
        <text x={40 + djTxPx + djChPx / 2} y={45 + barH / 2 + 4} textAnchor="middle" fontSize={7} fill="#fff" fontFamily="monospace">
          DJ_ch
        </text>
      )}

      {/* RJ contribution bar (dashed style via pattern) */}
      <rect x={40 + djTxPx + djChPx} y={45} width={rjPx} height={barH} rx={2} fill="#06b6d4" opacity={0.7} />
      {rjPx > 24 && (
        <text x={40 + djTxPx + djChPx + rjPx / 2} y={45 + barH / 2 + 4} textAnchor="middle" fontSize={7} fill="#fff" fontFamily="monospace">
          RJ
        </text>
      )}

      {/* Remaining safe region */}
      <rect x={40 + djTxPx + djChPx + rjPx} y={45} width={Math.max(0, uiX - 40 - djTxPx - djChPx - rjPx)} height={barH} rx={2} fill="#1e293b" />

      {/* UI limit line */}
      {uiX < 380 && (
        <>
          <line x1={uiX} y1={35} x2={uiX} y2={80} stroke="#ef4444" strokeWidth={2} strokeDasharray="4,2" />
          <text x={uiX} y={30} textAnchor="middle" fontSize={7} fill="#ef4444" fontFamily="monospace">
            UI={UIps.toFixed(0)}ps
          </text>
        </>
      )}

      {/* Total jitter line */}
      {(() => {
        const tjX = 40 + clamp(totalJitter * scale, 0, barW);
        return (
          <line x1={tjX} y1={40} x2={tjX} y2={75} stroke="#f59e0b" strokeWidth={1.5} />
        );
      })()}

      {/* Legend */}
      {[
        { color: "#8b5cf6", label: `DJ_tx: ${djTx.toFixed(0)} ps` },
        { color: "#3b82f6", label: `DJ_ch: ${djCh.toFixed(0)} ps` },
        { color: "#06b6d4", label: `RJ@BER-12: ${rjContrib.toFixed(0)} ps` },
      ].map((item, i) => (
        <g key={i}>
          <rect x={40 + i * 110} y={90} width={10} height={10} rx={2} fill={item.color} />
          <text x={54 + i * 110} y={99} fontSize={7} fill="#94a3b8" fontFamily="monospace">
            {item.label}
          </text>
        </g>
      ))}

      <text x={200} y={130} textAnchor="middle" fontSize={7} fill="#f59e0b" fontFamily="monospace">
        TJ@BER=1e-12: {totalJitter.toFixed(1)} ps
      </text>
      <text x={200} y={150} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily="monospace">
        Time (ps) →
      </text>
    </svg>
  );
}

// ─── Section 4: FEC Waterfall SVG ────────────────────────────────────────────

function FECWaterfallSVG({
  rawBER,
  correctedBER,
}: {
  rawBER: number;
  correctedBER: number;
}) {
  const W = 360;
  const H = 110;
  const padL = 30;
  const padB = 20;

  // x-axis: log10(BER) from -3 to -12 → left to right as rawBER gets better
  const berToX = (ber: number) => {
    const log = Math.log10(Math.max(ber, 1e-15));
    return padL + ((log + 3) / (-12 + 3)) * W;
  };
  const berToY = (ber: number) => {
    const log = Math.log10(Math.max(ber, 1e-15));
    return H - padB - ((log + 15) / (-3 + 15)) * (H - padB - 10);
  };

  // Uncoded: corrected = raw
  const uncodedPts = Array.from({ length: 10 }, (_, i) => {
    const rawLog = -3 - i;
    const ber = Math.pow(10, rawLog);
    return `${berToX(ber)},${berToY(ber)}`;
  }).join(" ");

  // Coded: steep drop
  const codedPts = Array.from({ length: 10 }, (_, i) => {
    const rawLog = -3 - i;
    const raw = Math.pow(10, rawLog);
    const coded = Math.min(raw, Math.pow(raw, 2.5) * 1e9);
    return `${berToX(raw)},${berToY(Math.max(coded, 1e-15))}`;
  }).join(" ");

  const dotX = berToX(rawBER);
  const dotY = berToY(correctedBER);

  return (
    <svg viewBox="0 0 400 140" className="w-full" style={{ maxHeight: 160 }}>
      <rect x={0} y={0} width={400} height={140} fill="#0f172a" rx={4} />

      {/* Axes */}
      <line x1={padL} y1={10} x2={padL} y2={H - padB} stroke="#334155" strokeWidth={1} />
      <line x1={padL} y1={H - padB} x2={padL + W} y2={H - padB} stroke="#334155" strokeWidth={1} />

      {/* X ticks (raw BER) */}
      {[-3, -6, -9, -12].map((exp) => {
        const x = berToX(Math.pow(10, exp));
        return (
          <g key={exp}>
            <line x1={x} y1={H - padB} x2={x} y2={H - padB + 4} stroke="#475569" strokeWidth={1} />
            <text x={x} y={H - padB + 12} textAnchor="middle" fontSize={6} fill="#64748b" fontFamily="monospace">
              1e{exp}
            </text>
          </g>
        );
      })}

      {/* Uncoded line */}
      <polyline points={uncodedPts} fill="none" stroke="#475569" strokeWidth={1.5} strokeDasharray="4,2" />

      {/* Coded line */}
      <polyline points={codedPts} fill="none" stroke="#8b5cf6" strokeWidth={2} />

      {/* Operating point */}
      <circle cx={dotX} cy={clamp(dotY, 10, H - padB)} r={4} fill="#f59e0b" stroke="#fff" strokeWidth={1} />

      {/* Labels */}
      <text x={padL + W / 2} y={H + 8} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily="monospace">
        Raw BER →
      </text>
      <text x={370} y={30} textAnchor="end" fontSize={7} fill="#8b5cf6" fontFamily="monospace">Coded</text>
      <text x={370} y={60} textAnchor="end" fontSize={7} fill="#475569" fontFamily="monospace">Uncoded</text>
      <text x={40} y={18} fontSize={7} fill="#94a3b8" fontFamily="monospace">Post-FEC BER</text>
    </svg>
  );
}

// ─── Section 5: PAM4 vs NRZ Eye Diagram SVG ──────────────────────────────────

function PAM4NRZEyeSVG({
  encoding,
  eyeHeight_NRZ,
  eyeHeight_PAM4,
}: {
  encoding: Encoding;
  eyeHeight_NRZ: number;
  eyeHeight_PAM4: number;
}) {
  const nrzColor = encoding === "NRZ" ? "#8b5cf6" : "#334155";
  const pam4Color = encoding === "PAM4" ? "#8b5cf6" : "#334155";

  // NRZ: single eye, left half
  // PAM4: 3 stacked eyes, right half
  const eyeW = 70;

  return (
    <svg viewBox="0 0 400 160" className="w-full" style={{ maxHeight: 180 }}>
      <rect x={0} y={0} width={400} height={160} fill="#0f172a" rx={4} />

      {/* Divider */}
      <line x1={200} y1={10} x2={200} y2={150} stroke="#1e293b" strokeWidth={1} strokeDasharray="4,2" />

      {/* NRZ label */}
      <text x={100} y={18} textAnchor="middle" fontSize={8} fill={nrzColor} fontFamily="monospace" fontWeight="bold">
        NRZ
      </text>

      {/* NRZ eye */}
      {(() => {
        const cx = 100;
        const cy = 80;
        const eyeHalf = (eyeHeight_NRZ / 100) * 50;
        return (
          <>
            <path d={`M ${cx - eyeW / 2} ${cy - 50} Q ${cx} ${cy - eyeHalf} ${cx + eyeW / 2} ${cy - 50}`} fill="none" stroke={nrzColor} strokeWidth={2} />
            <path d={`M ${cx - eyeW / 2} ${cy + 50} Q ${cx} ${cy + eyeHalf} ${cx + eyeW / 2} ${cy + 50}`} fill="none" stroke={nrzColor} strokeWidth={2} />
            <line x1={cx - eyeW / 2} y1={cy - 50} x2={cx - eyeW / 2} y2={cy + 50} stroke={nrzColor} strokeWidth={1.5} />
            <line x1={cx + eyeW / 2} y1={cy - 50} x2={cx + eyeW / 2} y2={cy + 50} stroke={nrzColor} strokeWidth={1.5} />
            <ellipse cx={cx} cy={cy} rx={eyeW / 2 - 6} ry={Math.max(2, eyeHalf - 4)} fill={nrzColor} opacity={encoding === "NRZ" ? 0.2 : 0.05} />
          </>
        );
      })()}

      {/* PAM4 label */}
      <text x={300} y={18} textAnchor="middle" fontSize={8} fill={pam4Color} fontFamily="monospace" fontWeight="bold">
        PAM4
      </text>

      {/* PAM4: 3 stacked eyes */}
      {[0, 1, 2].map((eyeIdx) => {
        const cx = 300;
        const totalH = 120;
        const perEyeH = totalH / 3;
        const cy = 20 + perEyeH * eyeIdx + perEyeH / 2;
        const eyeHalf = (eyeHeight_PAM4 / 100) * (perEyeH / 2 - 2);
        const ew = 60;
        return (
          <g key={eyeIdx}>
            <path d={`M ${cx - ew / 2} ${cy - perEyeH / 2 + 2} Q ${cx} ${cy - Math.max(1, eyeHalf)} ${cx + ew / 2} ${cy - perEyeH / 2 + 2}`} fill="none" stroke={pam4Color} strokeWidth={1.5} />
            <path d={`M ${cx - ew / 2} ${cy + perEyeH / 2 - 2} Q ${cx} ${cy + Math.max(1, eyeHalf)} ${cx + ew / 2} ${cy + perEyeH / 2 - 2}`} fill="none" stroke={pam4Color} strokeWidth={1.5} />
            <line x1={cx - ew / 2} y1={cy - perEyeH / 2 + 2} x2={cx - ew / 2} y2={cy + perEyeH / 2 - 2} stroke={pam4Color} strokeWidth={1} />
            <line x1={cx + ew / 2} y1={cy - perEyeH / 2 + 2} x2={cx + ew / 2} y2={cy + perEyeH / 2 - 2} stroke={pam4Color} strokeWidth={1} />
            <ellipse cx={cx} cy={cy} rx={ew / 2 - 5} ry={Math.max(1, eyeHalf - 2)} fill={pam4Color} opacity={encoding === "PAM4" ? 0.2 : 0.05} />
          </g>
        );
      })}

      <text x={100} y={152} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily="monospace">1 eye opening</text>
      <text x={300} y={152} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily="monospace">3 eye openings (1/3 height)</text>
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HighSpeedIOPage() {
  // ── Section 1: SerDes Link Budget ──────────────────────────────────────────
  const [dataRate, setDataRate] = useState(10);
  const [traceLengthInch, setTraceLengthInch] = useState(10);
  const [viaCount, setViaCount] = useState(4);
  const [connectors, setConnectors] = useState(1);

  // ── Section 2: CTLE / DFE ─────────────────────────────────────────────────
  const [channelLossdB, setChannelLossdB] = useState(15);
  const [ctleBoostdB, setCtleBoostdB] = useState(8);
  const [dfeTaps, setDfeTaps] = useState(4);
  const [noisePowerdBm, setNoisePowerdBm] = useState(-60);

  // ── Section 3: Jitter Budget ─────────────────────────────────────────────
  const [txDeterministicJitter, setTxDeterministicJitter] = useState(20);
  const [txRandomJitter, setTxRandomJitter] = useState(1.0);
  const [channelJitter, setChannelJitter] = useState(10);
  const [rxRefClockJitter, setRxRefClockJitter] = useState(0.5);

  // ── Section 4: FEC ────────────────────────────────────────────────────────
  const [rawBer_exp, setRawBer_exp] = useState(6);
  const [codeRate, setCodeRate] = useState(0.8);
  const [blockLength, setBlockLength] = useState(512);
  const [fecType, setFecType] = useState<FecType>("RS(255,239)");

  // ── Section 5: PAM4 vs NRZ ────────────────────────────────────────────────
  const [symbolRate, setSymbolRate] = useState(28);
  const [txFIRTaps, setTxFIRTaps] = useState(3);
  const [snrRequireddB, setSnrRequireddB] = useState(25);
  const [encoding, setEncoding] = useState<Encoding>("PAM4");

  // ── Derived: Section 1 ────────────────────────────────────────────────────
  const link = useMemo(() => {
    const traceLoss = traceLengthInch * dataRate * 0.05;
    const viaLoss = viaCount * 0.1;
    const connectorLoss = connectors * 0.5;
    const totalChannelLoss = traceLoss + viaLoss + connectorLoss;
    const txSwing = 800;
    const rxSensitivity = 50;
    const linkBudgetdB = 20 * Math.log10(txSwing / rxSensitivity);
    const linkMargin = linkBudgetdB - totalChannelLoss;
    const maxDataRate = linkBudgetdB / (traceLengthInch * 0.05 + (viaCount * 0.1 + connectors * 0.5) / 10);
    return { traceLoss, viaLoss, connectorLoss, totalChannelLoss, linkMargin, maxDataRate, linkBudgetdB };
  }, [dataRate, traceLengthInch, viaCount, connectors]);

  // ── Derived: Section 2 ────────────────────────────────────────────────────
  const eq = useMemo(() => {
    const residualISI = Math.max(0, channelLossdB - ctleBoostdB - dfeTaps * 1.5);
    const snrAfterEQ = -noisePowerdBm - residualISI;
    const snr_linear = Math.pow(10, snrAfterEQ / 10);
    const berRaw = 0.5 * Math.exp(-snr_linear / 2);
    const berLog10 = Math.log10(Math.max(1e-15, berRaw));
    const eyeOpening = clamp(100 - residualISI * 5 - Math.pow(10, (noisePowerdBm + 60) / 10), 0, 100);
    return { residualISI, snrAfterEQ, berLog10, eyeOpening };
  }, [channelLossdB, ctleBoostdB, dfeTaps, noisePowerdBm]);

  // ── Derived: Section 3 ────────────────────────────────────────────────────
  const jitter = useMemo(() => {
    const dataRate_fixed = 10;
    const UIps = 1e6 / dataRate_fixed;
    const totalDeterministicJitter = txDeterministicJitter + channelJitter;
    const totalRandomJitter_rms = Math.sqrt(txRandomJitter ** 2 + rxRefClockJitter ** 2);
    const rjContrib = 14.069 * totalRandomJitter_rms;
    const totalJitter_BER12 = totalDeterministicJitter + rjContrib;
    const jitterMargin = UIps - totalJitter_BER12;
    const jitterRatio = (totalJitter_BER12 / UIps) * 100;
    return { UIps, totalDeterministicJitter, totalRandomJitter_rms, rjContrib, totalJitter_BER12, jitterMargin, jitterRatio };
  }, [txDeterministicJitter, txRandomJitter, channelJitter, rxRefClockJitter]);

  // ── Derived: Section 4 ────────────────────────────────────────────────────
  const fec = useMemo(() => {
    const rawBER = Math.pow(10, -rawBer_exp);
    const fecParams: Record<FecType, { n: number; k: number; t: number | null }> = {
      "RS(255,239)": { n: 255, k: 239, t: 8 },
      "RS(255,223)": { n: 255, k: 223, t: 16 },
      "LDPC(0.8)": { n: blockLength, k: Math.floor(blockLength * 0.8), t: null },
      "LDPC(0.93)": { n: blockLength, k: Math.floor(blockLength * 0.93), t: null },
    };
    const params = fecParams[fecType];
    let correctedBER: number;
    if (params.t !== null) {
      correctedBER = 255 * Math.pow(rawBER, params.t + 1);
    } else {
      correctedBER = rawBER > 0.01 ? rawBER : Math.pow(rawBER, 3) * 1e6;
    }
    correctedBER = Math.max(correctedBER, 1e-15);
    const codingGain = Math.log10(rawBER / correctedBER) * 10;
    const overhead = (1 - codeRate) * 100;
    const effectiveBandwidth = codeRate * 100;
    return { rawBER, correctedBER, codingGain, overhead, effectiveBandwidth, params };
  }, [rawBer_exp, codeRate, blockLength, fecType]);

  // ── Derived: Section 5 ────────────────────────────────────────────────────
  const pam = useMemo(() => {
    const bitRate_NRZ = symbolRate;
    const bitRate_PAM4 = 2 * symbolRate;
    const firBenefit = txFIRTaps * 1.2;
    const snrNeeded_NRZ = snrRequireddB;
    const snrNeeded_PAM4 = snrRequireddB + 9.5;
    const effectiveSNR_NRZ = snrNeeded_NRZ - firBenefit;
    const effectiveSNR_PAM4 = snrNeeded_PAM4 - firBenefit;
    const eyeHeight_NRZ = 100;
    const eyeHeight_PAM4 = 33;
    return { bitRate_NRZ, bitRate_PAM4, firBenefit, snrNeeded_NRZ, snrNeeded_PAM4, effectiveSNR_NRZ, effectiveSNR_PAM4, eyeHeight_NRZ, eyeHeight_PAM4 };
  }, [symbolRate, txFIRTaps, snrRequireddB]);

  // ── Status badge helpers ──────────────────────────────────────────────────
  const linkBadge =
    link.linkMargin > 3
      ? { label: "LINK OK", cls: "bg-green-500/20 text-green-400 border-green-500/30" }
      : link.linkMargin > 0
      ? { label: "MARGINAL", cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" }
      : { label: "FAILED", cls: "bg-red-500/20 text-red-400 border-red-500/30" };

  const berBadge =
    eq.berLog10 > -9
      ? { label: `BER > 1e-9`, cls: "bg-red-500/20 text-red-400 border-red-500/30" }
      : { label: `BER = 10^${eq.berLog10.toFixed(1)}`, cls: "bg-green-500/20 text-green-400 border-green-500/30" };

  const jitterBadge =
    jitter.jitterMargin > jitter.UIps * 0.2
      ? { label: "PASS", cls: "bg-green-500/20 text-green-400 border-green-500/30" }
      : jitter.jitterMargin > 0
      ? { label: "MARGINAL", cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" }
      : { label: "FAIL", cls: "bg-red-500/20 text-red-400 border-red-500/30" };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="bg-violet-500/20 rounded-xl border border-violet-500/30 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Radio className="w-8 h-8 text-violet-400" />
            <h1 className="text-3xl font-bold text-violet-400">High-Speed I/O</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            SerDes link budget, CTLE/DFE equalization, jitter analysis, FEC performance, and PAM4 vs NRZ comparison
          </p>
        </div>

        {/* ── Section 1: SerDes Link Budget ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-card rounded-xl border border-border p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-violet-400" />
            <h2 className="text-xl font-semibold">SerDes Link Budget</h2>
            <span className={`ml-auto text-xs font-bold px-3 py-1 rounded-full border ${linkBadge.cls}`}>
              {linkBadge.label}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {[
                { label: "Data Rate", value: dataRate, unit: "Gbps", min: 1, max: 56, step: 1, set: setDataRate, color: "text-violet-400" },
                { label: "Trace Length", value: traceLengthInch, unit: "in", min: 1, max: 40, step: 1, set: setTraceLengthInch, color: "text-violet-400" },
                { label: "Via Count", value: viaCount, unit: "", min: 0, max: 20, step: 1, set: setViaCount, color: "text-violet-400" },
                { label: "Connectors", value: connectors, unit: "", min: 0, max: 4, step: 1, set: setConnectors, color: "text-violet-400" },
              ].map(({ label, value, unit, min, max, step, set, color }) => (
                <div key={label}>
                  <label className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={`font-mono ${color}`}>{value}{unit}</span>
                  </label>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => set(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Trace Loss</p>
                  <p className="font-mono text-orange-400 text-lg font-bold">{link.traceLoss.toFixed(1)} dB</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Total Channel Loss</p>
                  <p className="font-mono text-violet-400 text-lg font-bold">{link.totalChannelLoss.toFixed(1)} dB</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Link Margin</p>
                  <p className={`font-mono text-lg font-bold ${link.linkMargin > 0 ? "text-green-400" : "text-red-400"}`}>
                    {link.linkMargin.toFixed(1)} dB
                  </p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Max Data Rate</p>
                  <p className="font-mono text-violet-400 text-lg font-bold">{link.maxDataRate.toFixed(1)} Gbps</p>
                </div>
              </div>
            </div>

            <div>
              <LinkBudgetSVG
                traceLoss={link.traceLoss}
                viaLoss={link.viaLoss}
                connectorLoss={link.connectorLoss}
                linkMargin={link.linkMargin}
              />
              <FormulaCard
                label="Link Budget"
                formula="Margin = 20·log₁₀(Vtx/Vrx) − IL_trace − IL_via − IL_conn"
                explanation="IL_trace = α·l·f where α≈0.05 dB/inch/GHz for FR4 at mid-frequency"
              />
            </div>
          </div>
        </motion.div>

        {/* ── Section 2: CTLE / DFE Equalization ───────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-xl border border-border p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-violet-400" />
            <h2 className="text-xl font-semibold">CTLE / DFE Equalization</h2>
            <span className={`ml-auto text-xs font-bold px-3 py-1 rounded-full border ${berBadge.cls}`}>
              {berBadge.label}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {[
                { label: "Channel Loss", value: channelLossdB, unit: " dB", min: 0, max: 30, step: 1, set: setChannelLossdB },
                { label: "CTLE Boost", value: ctleBoostdB, unit: " dB", min: 0, max: 20, step: 1, set: setCtleBoostdB },
                { label: "DFE Taps", value: dfeTaps, unit: "", min: 0, max: 8, step: 1, set: setDfeTaps },
                { label: "Noise Power", value: noisePowerdBm, unit: " dBm", min: -80, max: -40, step: 1, set: setNoisePowerdBm },
              ].map(({ label, value, unit, min, max, step, set }) => (
                <div key={label}>
                  <label className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono text-violet-400">{value}{unit}</span>
                  </label>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => set(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Residual ISI</p>
                  <p className="font-mono text-amber-400 text-lg font-bold">{eq.residualISI.toFixed(1)} dB</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">SNR after EQ</p>
                  <p className="font-mono text-violet-400 text-lg font-bold">{eq.snrAfterEQ.toFixed(1)} dB</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Eye Opening</p>
                  <p className={`font-mono text-lg font-bold ${eq.eyeOpening > 50 ? "text-green-400" : eq.eyeOpening > 20 ? "text-amber-400" : "text-red-400"}`}>
                    {eq.eyeOpening.toFixed(0)}%
                  </p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Post-EQ BER</p>
                  <p className={`font-mono text-sm font-bold ${eq.berLog10 > -9 ? "text-red-400" : "text-green-400"}`}>
                    10^{eq.berLog10.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <EyeDiagramSVG eyeOpening={eq.eyeOpening} noisePowerdBm={noisePowerdBm} />
              <div className="mt-3">
                <FormulaCard
                  label="Equalization"
                  formula="ISI_residual = max(0, IL − CTLE_boost − DFE_taps × 1.5 dB)"
                  explanation="CTLE compensates frequency-dependent loss; DFE cancels post-cursor ISI with each tap"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Section 3: Jitter Budget ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card rounded-xl border border-border p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-violet-400" />
            <h2 className="text-xl font-semibold">Jitter Budget</h2>
            <span className={`ml-auto text-xs font-bold px-3 py-1 rounded-full border ${jitterBadge.cls}`}>
              {jitterBadge.label}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {[
                { label: "TX Deterministic Jitter", value: txDeterministicJitter, unit: " ps", min: 0, max: 100, step: 1, set: setTxDeterministicJitter },
                { label: "TX Random Jitter (RMS)", value: txRandomJitter, unit: " ps", min: 0.1, max: 10, step: 0.1, set: setTxRandomJitter },
                { label: "Channel Jitter", value: channelJitter, unit: " ps", min: 0, max: 50, step: 1, set: setChannelJitter },
                { label: "Ref Clock Jitter (RMS)", value: rxRefClockJitter, unit: " ps", min: 0.01, max: 5, step: 0.01, set: setRxRefClockJitter },
              ].map(({ label, value, unit, min, max, step, set }) => (
                <div key={label}>
                  <label className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono text-violet-400">{value.toFixed(2)}{unit}</span>
                  </label>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => set(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Total DJ</p>
                  <p className="font-mono text-blue-400 text-lg font-bold">{jitter.totalDeterministicJitter.toFixed(0)} ps</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">RJ @ BER=1e-12</p>
                  <p className="font-mono text-cyan-400 text-lg font-bold">{jitter.rjContrib.toFixed(1)} ps</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Total Jitter</p>
                  <p className={`font-mono text-lg font-bold ${jitter.jitterMargin > 0 ? "text-green-400" : "text-red-400"}`}>
                    {jitter.totalJitter_BER12.toFixed(1)} ps
                  </p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">UI at 10 Gbps</p>
                  <p className="font-mono text-violet-400 text-lg font-bold">{jitter.UIps.toFixed(0)} ps</p>
                </div>
              </div>
            </div>

            <div>
              <JitterBudgetSVG
                djTx={txDeterministicJitter}
                djCh={channelJitter}
                rjContrib={jitter.rjContrib}
                totalJitter={jitter.totalJitter_BER12}
                UIps={jitter.UIps}
              />
              <div className="mt-3">
                <FormulaCard
                  label="Jitter Budget"
                  formula="TJ@BER=1e-12 = DJ + 14.069 · σ_RJ"
                  explanation="Jitter ratio = TJ / UI × 100%. Must be < 100% to open eye. 14.069σ = ±7.034σ at BER=1e-12"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Section 4: FEC Performance ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-xl border border-border p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-violet-400" />
            <h2 className="text-xl font-semibold">FEC Performance (Reed-Solomon / LDPC)</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Raw BER Exponent</span>
                  <span className="font-mono text-violet-400">1e-{rawBer_exp}</span>
                </label>
                <input
                  type="range"
                  min={3}
                  max={12}
                  step={1}
                  value={rawBer_exp}
                  onChange={(e) => setRawBer_exp(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Code Rate</span>
                  <span className="font-mono text-violet-400">{codeRate.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={0.99}
                  step={0.01}
                  value={codeRate}
                  onChange={(e) => setCodeRate(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
              </div>
              <div>
                <label className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Block Length</span>
                  <span className="font-mono text-violet-400">{blockLength}</span>
                </label>
                <input
                  type="range"
                  min={64}
                  max={4096}
                  step={64}
                  value={blockLength}
                  onChange={(e) => setBlockLength(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
              </div>

              {/* FEC Type dropdown */}
              <div>
                <label className="block text-sm text-muted-foreground mb-1">FEC Type</label>
                <select
                  value={fecType}
                  onChange={(e) => setFecType(e.target.value as FecType)}
                  className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-violet-500"
                >
                  {(["RS(255,239)", "RS(255,223)", "LDPC(0.8)", "LDPC(0.93)"] as FecType[]).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Raw BER</p>
                  <p className="font-mono text-red-400 text-sm font-bold">1e-{rawBer_exp}</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Corrected BER</p>
                  <p className="font-mono text-green-400 text-sm font-bold">
                    {fec.correctedBER < 1e-14 ? "<1e-14" : `${fec.correctedBER.toExponential(1)}`}
                  </p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Coding Gain</p>
                  <p className="font-mono text-violet-400 text-lg font-bold">{fec.codingGain.toFixed(1)} dB</p>
                </div>
                <div className="bg-muted/20 rounded-lg p-3">
                  <p className="text-muted-foreground text-xs">Overhead</p>
                  <p className="font-mono text-amber-400 text-lg font-bold">{fec.overhead.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            <div>
              <FECWaterfallSVG rawBER={fec.rawBER} correctedBER={fec.correctedBER} />
              <div className="mt-3">
                <FormulaCard
                  label="FEC Coding Gain"
                  formula="Post-FEC BER ≈ n · p^(t+1) for RS(n,k,t)"
                  explanation="RS corrects t symbol errors per block. LDPC uses iterative belief-propagation decoding for near-Shannon performance"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Section 5: PAM4 vs NRZ ────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card rounded-xl border border-border p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Waves className="w-5 h-5 text-violet-400" />
            <h2 className="text-xl font-semibold">PAM4 vs NRZ Comparison</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {[
                { label: "Symbol Rate", value: symbolRate, unit: " GBaud", min: 1, max: 56, step: 1, set: setSymbolRate },
                { label: "TX FIR Taps", value: txFIRTaps, unit: "", min: 0, max: 7, step: 1, set: setTxFIRTaps },
                { label: "Required SNR", value: snrRequireddB, unit: " dB", min: 15, max: 40, step: 1, set: setSnrRequireddB },
              ].map(({ label, value, unit, min, max, step, set }) => (
                <div key={label}>
                  <label className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-mono text-violet-400">{value}{unit}</span>
                  </label>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => set(Number(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                </div>
              ))}

              {/* Encoding toggle */}
              <div>
                <p className="text-sm text-muted-foreground mb-2">Modulation</p>
                <div className="flex gap-2">
                  {(["NRZ", "PAM4"] as Encoding[]).map((enc) => (
                    <button
                      key={enc}
                      onClick={() => setEncoding(enc)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        encoding === enc
                          ? "bg-violet-500 text-white"
                          : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {enc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comparison table */}
              <div className="rounded-lg border border-border overflow-hidden text-sm">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/20">
                      <th className="text-left px-3 py-2 text-muted-foreground text-xs font-medium">Metric</th>
                      <th className={`px-3 py-2 text-xs font-medium ${encoding === "NRZ" ? "text-violet-400" : "text-muted-foreground"}`}>NRZ</th>
                      <th className={`px-3 py-2 text-xs font-medium ${encoding === "PAM4" ? "text-violet-400" : "text-muted-foreground"}`}>PAM4</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Bit Rate", nrz: `${pam.bitRate_NRZ} Gbps`, pam4: `${pam.bitRate_PAM4} Gbps` },
                      { label: "SNR Required", nrz: `${pam.snrNeeded_NRZ} dB`, pam4: `${pam.snrNeeded_PAM4.toFixed(1)} dB` },
                      { label: "Eff. SNR (w/ FIR)", nrz: `${pam.effectiveSNR_NRZ.toFixed(1)} dB`, pam4: `${pam.effectiveSNR_PAM4.toFixed(1)} dB` },
                      { label: "Eye Count", nrz: "1", pam4: "3" },
                      { label: "Eye Height", nrz: "100%", pam4: "33%" },
                      { label: "FIR Benefit", nrz: `${pam.firBenefit.toFixed(1)} dB`, pam4: `${pam.firBenefit.toFixed(1)} dB` },
                    ].map(({ label, nrz, pam4 }) => (
                      <tr key={label} className="border-t border-border">
                        <td className="px-3 py-2 text-muted-foreground text-xs">{label}</td>
                        <td className={`px-3 py-2 font-mono text-xs text-center ${encoding === "NRZ" ? "text-violet-400 font-bold" : "text-muted-foreground"}`}>{nrz}</td>
                        <td className={`px-3 py-2 font-mono text-xs text-center ${encoding === "PAM4" ? "text-violet-400 font-bold" : "text-muted-foreground"}`}>{pam4}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <PAM4NRZEyeSVG
                encoding={encoding}
                eyeHeight_NRZ={pam.eyeHeight_NRZ}
                eyeHeight_PAM4={pam.eyeHeight_PAM4}
              />
              <div className="mt-3">
                <FormulaCard
                  label="PAM4 SNR Penalty"
                  formula="SNR_PAM4 = SNR_NRZ + 9.54 dB; Bit Rate = 2 × Symbol Rate"
                  explanation="PAM4 carries 2 bits/symbol (4 levels) but each eye is 1/3 the height → ~9.5 dB SNR penalty at same BER"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Formula Cards ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card rounded-xl border border-border p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-violet-400" />
            <h2 className="text-xl font-semibold">Reference Formulas</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FormulaCard
              label="Channel Loss"
              formula="IL(f) = α·l·√f dB"
              explanation="Link margin = Tx swing (dB) − IL − sensitivity (dB). α ≈ 0.05 dB/inch/GHz on FR4"
            />
            <FormulaCard
              label="Jitter Budget"
              formula="TJ@BER = DJ + 14.07·σ_RJ"
              explanation="TJ = DJ + 2N·RJ_rms; N = 7.03 at BER = 1e-12 (±7.03σ covers 1 − 1e-12 of Gaussian)"
            />
            <FormulaCard
              label="FEC Coding Gain"
              formula="BER_post ≈ n·p^(t+1)/(t+1)"
              explanation="RS(n,k,t) corrects t symbol errors per codeword. Coding gain = 10·log₁₀(BER_raw / BER_post)"
            />
            <FormulaCard
              label="PAM4 SNR Penalty"
              formula="ΔSNRₚₐₘ₄ = 20·log₁₀(3) ≈ 9.54 dB"
              explanation="PAM4 carries 2 bits/symbol but each of 3 eyes is 1/3 the NRZ eye height, requiring ~9.5 dB more SNR"
            />
          </div>
        </motion.div>

      </div>
    </main>
  );
}
