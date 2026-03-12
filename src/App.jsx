import { useState, useEffect, useCallback, useRef } from "react";
import {
  ComposedChart, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Area, AreaChart
} from "recharts";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ─── ASX STOCK LIST ───────────────────────────────────────────────────────────
const ASX_STOCKS = [
  { code: "BHP",    name: "BHP Group",                  sector: "Materials" },
  { code: "CSL",    name: "CSL Limited",                 sector: "Healthcare" },
  { code: "WES",    name: "Wesfarmers",                  sector: "Consumer" },
  { code: "RIO",    name: "Rio Tinto",                   sector: "Materials" },
  { code: "TLS",    name: "Telstra",                     sector: "Telecom" },
  { code: "FMG",    name: "Fortescue Metals",            sector: "Materials" },
  { code: "TCL",    name: "Transurban",                  sector: "Infrastructure" },
  { code: "STO",    name: "Santos",                      sector: "Energy" },
  { code: "WTC",    name: "WiseTech Global",             sector: "Technology" },
  { code: "NXT",    name: "NextDC",                      sector: "Technology" },
  { code: "MP1",    name: "Megaport",                    sector: "Technology" },
  { code: "WDS",    name: "Woodside Energy",             sector: "Energy" },
  { code: "ORG",    name: "Origin Energy",               sector: "Energy" },
  { code: "MIN",    name: "Mineral Resources",           sector: "Materials" },
  { code: "PLS",    name: "Pilbara Minerals",            sector: "Materials" },
  { code: "CQR",    name: "Charter Hall Retail REIT",    sector: "Property" },
  { code: "CLW",    name: "Charter Hall Long WALE REIT", sector: "Property" },
  { code: "NHC",    name: "New Hope Corporation",        sector: "Energy" },
  { code: "WHC",    name: "Whitehaven Coal",             sector: "Energy" },
  { code: "S32",    name: "South32",                     sector: "Materials" },
  { code: "APA",    name: "APA Group",                   sector: "Infrastructure" },
  { code: "ADH",    name: "Adairs",                      sector: "Consumer" },
  { code: "PMGOLD", name: "Perth Mint Gold",             sector: "Materials" },
  { code: "TLX",    name: "Telix Pharmaceuticals",       sector: "Healthcare" },
  { code: "VUL",    name: "Vulcan Energy Resources",     sector: "Materials" },
  { code: "SLC",    name: "Superloop",                   sector: "Technology" },
  { code: "AGL",    name: "AGL Energy",                  sector: "Energy" },
  { code: "SSG",    name: "Shaver Shop Group",           sector: "Consumer" },
  { code: "DSK",    name: "Dusk Group",                  sector: "Consumer" },
  { code: "HVN",    name: "Harvey Norman",               sector: "Consumer" },
];

// ─── THEME ───────────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    bg:        "#070a0f",
    surface:   "#0a0d14",
    surface2:  "#0f1117",
    border:    "#1a1f2e",
    border2:   "#252b3b",
    text:      "#e2e8f0",
    textMid:   "#94a3b8",
    textDim:   "#475569",
    textFaint: "#2d3748",
    accent:    "#3b82f6",
    green:     "#10b981",
    red:       "#ef4444",
    amber:     "#f59e0b",
    purple:    "#a78bfa",
    teal:      "#6ee7b7",
  },
  light: {
    bg:        "#f0f4f8",
    surface:   "#ffffff",
    surface2:  "#f8fafc",
    border:    "#e2e8f0",
    border2:   "#cbd5e1",
    text:      "#0f172a",
    textMid:   "#334155",
    textDim:   "#64748b",
    textFaint: "#cbd5e1",
    accent:    "#2563eb",
    green:     "#059669",
    red:       "#dc2626",
    amber:     "#d97706",
    purple:    "#7c3aed",
    teal:      "#0d9488",
  },
};

// ─── TECHNICAL INDICATORS ─────────────────────────────────────────────────────
function calcSMA(data, period) {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    return +(data.slice(i - period + 1, i + 1).reduce((s, d) => s + d.close, 0) / period).toFixed(4);
  });
}

function calcEMA(data, period) {
  const k = 2 / (period + 1);
  const result = [];
  let ema = null;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    if (ema === null) ema = data.slice(0, period).reduce((s, d) => s + d.close, 0) / period;
    else ema = data[i].close * k + ema * (1 - k);
    result.push(+ema.toFixed(4));
  }
  return result;
}

function calcRSI(data, period = 14) {
  if (data.length < period + 1) return data.map(() => null);
  const result = Array(period).fill(null);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = data[i].close - data[i - 1].close;
    if (d > 0) gains += d; else losses -= d;
  }
  let ag = gains / period, al = losses / period;
  result.push(al === 0 ? 100 : +(100 - 100 / (1 + ag / al)).toFixed(2));
  for (let i = period + 1; i < data.length; i++) {
    const d = data[i].close - data[i - 1].close;
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
    result.push(al === 0 ? 100 : +(100 - 100 / (1 + ag / al)).toFixed(2));
  }
  return result;
}

function calcMACD(data) {
  const ema12 = calcEMA(data, 12);
  const ema26 = calcEMA(data, 26);
  const macdLine = data.map((_, i) =>
    ema12[i] !== null && ema26[i] !== null ? +(ema12[i] - ema26[i]).toFixed(4) : null
  );
  const validOnly = macdLine.map((v, i) => ({ close: v ?? 0, _v: v !== null })).filter(d => d._v);
  const sigRaw = calcEMA(validOnly, 9);
  const signal = Array(data.length).fill(null);
  let si = 0;
  macdLine.forEach((v, i) => { if (v !== null) signal[i] = sigRaw[si++]; });
  const histogram = data.map((_, i) =>
    macdLine[i] !== null && signal[i] !== null ? +(macdLine[i] - signal[i]).toFixed(4) : null
  );
  return { macdLine, signal, histogram };
}

function calcBollingerBands(data, period = 20, sd = 2) {
  const sma = calcSMA(data, period);
  return data.map((_, i) => {
    if (sma[i] === null) return { upper: null, middle: null, lower: null };
    const slice = data.slice(i - period + 1, i + 1).map(d => d.close);
    const mean = sma[i];
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
    return { upper: +(mean + sd * std).toFixed(4), middle: +mean.toFixed(4), lower: +(mean - sd * std).toFixed(4) };
  });
}

function calcATR(data, period = 14) {
  const tr = data.map((d, i) => {
    if (i === 0) return d.high - d.low;
    const prev = data[i - 1].close;
    return Math.max(d.high - d.low, Math.abs(d.high - prev), Math.abs(d.low - prev));
  });
  return tr.map((_, i) => {
    if (i < period - 1) return null;
    return +(tr.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0) / period).toFixed(4);
  });
}

function calcStochastic(data, kPeriod = 14, dPeriod = 3) {
  const kLine = data.map((_, i) => {
    if (i < kPeriod - 1) return null;
    const slice = data.slice(i - kPeriod + 1, i + 1);
    const highest = Math.max(...slice.map(d => d.high));
    const lowest  = Math.min(...slice.map(d => d.low));
    return highest === lowest ? 50 : +((data[i].close - lowest) / (highest - lowest) * 100).toFixed(2);
  });
  const dLine = kLine.map((_, i) => {
    if (i < kPeriod + dPeriod - 2) return null;
    const vals = kLine.slice(i - dPeriod + 1, i + 1).filter(v => v !== null);
    return vals.length < dPeriod ? null : +(vals.reduce((s, v) => s + v, 0) / dPeriod).toFixed(2);
  });
  return { kLine, dLine };
}

function calcVWAP(data) {
  let cumVolPrice = 0, cumVol = 0;
  return data.map(d => {
    const typical = (d.high + d.low + d.close) / 3;
    cumVolPrice += typical * d.volume;
    cumVol += d.volume;
    return cumVol > 0 ? +(cumVolPrice / cumVol).toFixed(4) : null;
  });
}

// ─── SIGNAL ENGINE ────────────────────────────────────────────────────────────
function generateSignals(data, indicators) {
  const { ema9, ema21, ema50, ema200, rsi, macd, bb, stoch } = indicators;
  const signals = [];
  const last = data.length - 1;
  const prev = data.length - 2;
  let bullish = 0, bearish = 0;

  // EMA 50/200 Golden/Death Cross
  if (ema50[last] && ema200[last] && ema50[prev] && ema200[prev]) {
    if (ema50[prev] < ema200[prev] && ema50[last] > ema200[last]) {
      signals.push({ type: "BUY", indicator: "Golden Cross", detail: "EMA50 crossed above EMA200 — major bullish trend signal", strength: "Strong" });
      bullish += 3;
    } else if (ema50[prev] > ema200[prev] && ema50[last] < ema200[last]) {
      signals.push({ type: "SELL", indicator: "Death Cross", detail: "EMA50 crossed below EMA200 — major bearish trend signal", strength: "Strong" });
      bearish += 3;
    } else { ema50[last] > ema200[last] ? bullish++ : bearish++; }
  }

  // Price vs EMA200 (long-term trend)
  if (ema200[last]) {
    const close = data[last].close;
    if (close > ema200[last] * 1.02) {
      signals.push({ type: "BUY", indicator: "EMA200 Trend", detail: `Price ${((close/ema200[last]-1)*100).toFixed(1)}% above EMA200 — long-term uptrend confirmed`, strength: "Moderate" });
      bullish += 2;
    } else if (close < ema200[last] * 0.98) {
      signals.push({ type: "SELL", indicator: "EMA200 Trend", detail: `Price ${((1-close/ema200[last])*100).toFixed(1)}% below EMA200 — long-term downtrend`, strength: "Moderate" });
      bearish += 2;
    }
  }

  // EMA 9/21 cross
  if (ema9[last] && ema21[last] && ema9[prev] && ema21[prev]) {
    if (ema9[prev] < ema21[prev] && ema9[last] > ema21[last]) {
      signals.push({ type: "BUY", indicator: "EMA Cross", detail: "EMA9 crossed above EMA21 — short-term momentum bullish", strength: "Moderate" });
      bullish += 2;
    } else if (ema9[prev] > ema21[prev] && ema9[last] < ema21[last]) {
      signals.push({ type: "SELL", indicator: "EMA Cross", detail: "EMA9 crossed below EMA21 — short-term momentum bearish", strength: "Moderate" });
      bearish += 2;
    } else { ema9[last] > ema21[last] ? bullish++ : bearish++; }
  }

  // RSI
  const rsiVal = rsi[last];
  if (rsiVal !== null) {
    if (rsiVal < 30) { signals.push({ type: "BUY", indicator: "RSI", detail: `RSI ${rsiVal.toFixed(1)} — deeply oversold, high probability reversal zone`, strength: "Strong" }); bullish += 3; }
    else if (rsiVal < 40) { signals.push({ type: "BUY", indicator: "RSI", detail: `RSI ${rsiVal.toFixed(1)} — approaching oversold levels`, strength: "Weak" }); bullish++; }
    else if (rsiVal > 70) { signals.push({ type: "SELL", indicator: "RSI", detail: `RSI ${rsiVal.toFixed(1)} — overbought, momentum exhaustion likely`, strength: "Strong" }); bearish += 3; }
    else if (rsiVal > 60) { signals.push({ type: "SELL", indicator: "RSI", detail: `RSI ${rsiVal.toFixed(1)} — approaching overbought territory`, strength: "Weak" }); bearish++; }
    else { rsiVal > 50 ? bullish++ : bearish++; }
  }

  // MACD
  const { histogram, macdLine, signal } = macd;
  if (histogram[last] !== null && histogram[prev] !== null) {
    if (histogram[prev] < 0 && histogram[last] > 0) { signals.push({ type: "BUY", indicator: "MACD", detail: "MACD histogram crossed above zero — bullish momentum crossover", strength: "Moderate" }); bullish += 2; }
    else if (histogram[prev] > 0 && histogram[last] < 0) { signals.push({ type: "SELL", indicator: "MACD", detail: "MACD histogram crossed below zero — bearish momentum crossover", strength: "Moderate" }); bearish += 2; }
    else { macdLine[last] > signal[last] ? bullish++ : bearish++; }
  }

  // Bollinger Bands
  const bbL = bb[last];
  const close = data[last].close;
  if (bbL?.upper && bbL?.lower) {
    if (close < bbL.lower) { signals.push({ type: "BUY", indicator: "Bollinger Bands", detail: "Price below lower band — statistically oversold, mean reversion expected", strength: "Moderate" }); bullish += 2; }
    else if (close > bbL.upper) { signals.push({ type: "SELL", indicator: "Bollinger Bands", detail: "Price above upper band — statistically overbought, potential reversal", strength: "Moderate" }); bearish += 2; }
  }

  // Stochastic
  const { kLine, dLine } = stoch;
  if (kLine[last] !== null && dLine[last] !== null) {
    if (kLine[last] < 20 && dLine[last] < 20) { signals.push({ type: "BUY", indicator: "Stochastic", detail: `Stoch %K ${kLine[last].toFixed(1)} — oversold zone, watch for crossover`, strength: "Moderate" }); bullish += 2; }
    else if (kLine[last] > 80 && dLine[last] > 80) { signals.push({ type: "SELL", indicator: "Stochastic", detail: `Stoch %K ${kLine[last].toFixed(1)} — overbought zone, watch for crossover`, strength: "Moderate" }); bearish += 2; }
    if (kLine[prev] !== null && dLine[prev] !== null) {
      if (kLine[prev] < dLine[prev] && kLine[last] > dLine[last] && kLine[last] < 50) { signals.push({ type: "BUY", indicator: "Stochastic Cross", detail: "Stoch %K crossed above %D in oversold — bullish signal", strength: "Strong" }); bullish += 2; }
      else if (kLine[prev] > dLine[prev] && kLine[last] < dLine[last] && kLine[last] > 50) { signals.push({ type: "SELL", indicator: "Stochastic Cross", detail: "Stoch %K crossed below %D in overbought — bearish signal", strength: "Strong" }); bearish += 2; }
    }
  }

  const total = bullish + bearish;
  const score = total > 0 ? Math.round((bullish / total) * 100) : 50;
  let recommendation = "HOLD", recColor = "#f59e0b";
  if (score >= 65) { recommendation = "BUY"; recColor = "#10b981"; }
  else if (score <= 35) { recommendation = "SELL"; recColor = "#ef4444"; }

  return { signals, bullish, bearish, score, recommendation, recColor };
}

// ─── FETCH ────────────────────────────────────────────────────────────────────
async function fetchStockData(code, period = "6mo") {
  const res = await fetch(`${API_BASE_URL}/stock/${code}?period=${period}`, {
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  const json = await res.json();
  if (!json.data?.length) throw new Error("No data returned");
  return json;
}

// Mock news generator (replace with a real news API like NewsAPI or Yahoo Finance news)
function getMockNews(code, name) {
  const headlines = [
    { title: `${name} reports strong quarterly earnings, beats analyst expectations`, time: "2h ago", sentiment: "positive", source: "AFR" },
    { title: `ASX ${code} shares under pressure amid sector rotation`, time: "4h ago", sentiment: "negative", source: "SMH" },
    { title: `${name} announces new strategic partnership to expand operations`, time: "1d ago", sentiment: "positive", source: "Reuters" },
    { title: `Analysts upgrade ${code} to Buy with A$${(Math.random()*20+40).toFixed(2)} price target`, time: "1d ago", sentiment: "positive", source: "Macquarie" },
    { title: `${name} faces regulatory scrutiny over recent acquisition plans`, time: "2d ago", sentiment: "negative", source: "Bloomberg" },
    { title: `${code} dividend yield remains attractive for income investors`, time: "3d ago", sentiment: "neutral", source: "Morningstar" },
  ];
  return headlines;
}

// ─── CANDLESTICK ──────────────────────────────────────────────────────────────
// Pure SVG candlestick chart rendered inside a useRef container.
// We measure the container then compute all coords ourselves — no Recharts internals needed.
const CandleChart = ({ data, ema9, ema50, ema200, bbUpper, bbLower, vwap, theme: th }) => {
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const PAD = { left: 64, right: 12, top: 12, bottom: 28 };

  const plotW = dims.w - PAD.left - PAD.right;
  const plotH = dims.h - PAD.top  - PAD.bottom;

  const highs = data.map(d => d.high);
  const lows  = data.map(d => d.low);
  const dMax  = Math.max(...highs, ...ema9.filter(Boolean), ...ema50.filter(Boolean), ...bbUpper.filter(Boolean));
  const dMin  = Math.min(...lows,  ...ema9.filter(Boolean), ...ema50.filter(Boolean), ...bbLower.filter(Boolean));
  const pad   = (dMax - dMin) * 0.06;
  const yMax  = dMax + pad;
  const yMin  = dMin - pad;

  const toX = i   => PAD.left + (i + 0.5) * (plotW / data.length);
  const toY = val => PAD.top  + plotH - ((val - yMin) / (yMax - yMin)) * plotH;

  const n    = data.length;
  const bandW = plotW / n;
  const bodyW = Math.max(1, bandW * 0.65);

  // Y axis ticks
  const tickCount = 6;
  const ticks = Array.from({ length: tickCount }, (_, i) => yMin + (yMax - yMin) * i / (tickCount - 1));
  const fmtPrice = v => {
    if (v >= 1000) return `$${(v/1000).toFixed(1)}k`;
    if (v >= 100)  return `$${v.toFixed(0)}`;
    if (v >= 10)   return `$${v.toFixed(2)}`;
    if (v >= 1)    return `$${v.toFixed(2)}`;
    return `$${v.toFixed(4)}`;
  };

  // X axis labels
  const xLabelInterval = Math.max(1, Math.floor(n / 6));
  const xLabels = data.map((d, i) => i % xLabelInterval === 0 ? { i, label: d.date?.slice(5) } : null).filter(Boolean);

  // Line path helper
  const linePath = (values) => {
    const pts = values.map((v, i) => v != null ? `${toX(i)},${toY(v)}` : null);
    let d = '', inSeg = false;
    pts.forEach(p => {
      if (p) { d += (inSeg ? ' L' : 'M') + p; inSeg = true; }
      else { inSeg = false; }
    });
    return d;
  };

  if (!dims.w || !plotH || plotH <= 0) {
    return <div ref={containerRef} style={{ width: '100%', height: 300 }} />;
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: 300 }}>
      <svg width={dims.w} height={dims.h}>
        {/* Grid lines */}
        {ticks.map((tick, i) => (
          <line key={i} x1={PAD.left} y1={toY(tick)} x2={PAD.left + plotW} y2={toY(tick)}
            stroke={th.border} strokeWidth={1} strokeDasharray="3 3" />
        ))}
        {/* Y axis labels */}
        {ticks.map((tick, i) => (
          <text key={i} x={PAD.left - 4} y={toY(tick) + 3.5} textAnchor="end"
            fontSize={9} fill={th.textDim}>{fmtPrice(tick)}</text>
        ))}
        {/* X axis labels */}
        {xLabels.map(({ i, label }) => (
          <text key={i} x={toX(i)} y={PAD.top + plotH + 16} textAnchor="middle"
            fontSize={9} fill={th.textDim}>{label}</text>
        ))}
        {/* BB bands */}
        <path d={linePath(bbUpper)} fill="none" stroke={th.purple} strokeWidth={1} strokeDasharray="2 4" opacity={0.7} />
        <path d={linePath(bbLower)} fill="none" stroke={th.purple} strokeWidth={1} strokeDasharray="2 4" opacity={0.7} />
        {/* MAs */}
        <path d={linePath(ema9)}   fill="none" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4 2" />
        <path d={linePath(ema50)}  fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 3" />
        <path d={linePath(ema200)} fill="none" stroke="#f97316" strokeWidth={1.5} strokeDasharray="5 3" />
        <path d={linePath(vwap)}   fill="none" stroke="#6ee7b7" strokeWidth={1.5} strokeDasharray="3 2" />
        {/* Candles */}
        {data.map((d, i) => {
          if (!d || d.high == null) return null;
          const isBull = d.close >= d.open;
          const color  = isBull ? th.green : th.red;
          const cx     = toX(i);
          const left   = cx - bodyW / 2;
          const yH  = toY(d.high);
          const yL  = toY(d.low);
          const yO  = toY(d.open);
          const yC  = toY(d.close);
          const bodyTop = Math.min(yO, yC);
          const bodyH   = Math.max(1, Math.abs(yC - yO));
          return (
            <g key={i}>
              <line x1={cx} y1={yH} x2={cx} y2={bodyTop}         stroke={color} strokeWidth={1} />
              <line x1={cx} y1={bodyTop + bodyH} x2={cx} y2={yL} stroke={color} strokeWidth={1} />
              <rect x={left} y={bodyTop} width={bodyW} height={bodyH}
                fill={color} stroke={color} strokeWidth={0.5} opacity={0.85} />
            </g>
          );
        })}
        {/* Border */}
        <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH}
          fill="none" stroke={th.border} strokeWidth={1} />
      </svg>
    </div>
  );
};

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────
const SignalBadge = ({ type, strength, t }) => {
  const c = type === "BUY"
    ? { bg: t.green + "15", border: t.green + "60", text: t.green }
    : { bg: t.red   + "15", border: t.red   + "60", text: t.red };
  const dot = strength === "Strong" ? "●●●" : strength === "Moderate" ? "●●○" : "●○○";
  return (
    <span style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text, padding: "2px 10px", borderRadius: 4, fontSize: 11, fontFamily: "monospace", display: "inline-flex", gap: 6, alignItems: "center" }}>
      {type} <span style={{ opacity: 0.6, letterSpacing: 1 }}>{dot}</span>
    </span>
  );
};

const ChartTooltip = ({ active, payload, label, t }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 6, padding: "10px 14px", fontSize: 11, maxWidth: 220 }}>
      <div style={{ color: t.text, marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {payload.filter(p => p.value != null).map((p, i) => (
        <div key={i} style={{ color: p.color || t.textMid, marginTop: 2 }}>
          {p.name}: <span style={{ color: t.text }}>{typeof p.value === "number" ? p.value.toFixed(3) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

const StatCard = ({ label, value, sub, color, t }) => (
  <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8, padding: "12px 14px" }}>
    <div style={{ fontSize: 10, color: t.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
    <div style={{ fontFamily: "monospace", fontSize: 14, color: color || t.text, fontWeight: 500 }}>{value ?? "—"}</div>
    {sub && <div style={{ fontSize: 10, color: t.textDim, marginTop: 3 }}>{sub}</div>}
  </div>
);

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function ASXAnalyzer() {
  const [themeKey,    setThemeKey]    = useState("dark");
  const [selected,    setSelected]    = useState(ASX_STOCKS[0]);
  const [search,      setSearch]      = useState("");
  const [customCode,  setCustomCode]  = useState("");
  const [data,        setData]        = useState([]);
  const [indicators,  setIndicators]  = useState(null);
  const [analysis,    setAnalysis]    = useState(null);
  const [stockInfo,   setStockInfo]   = useState(null);
  const [activeTab,   setActiveTab]   = useState("price");
  const [period,      setPeriod]      = useState("6mo");
  const [chartMode,   setChartMode]   = useState("line");  // "line" | "candle" | "area"
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [apiStatus,   setApiStatus]   = useState("checking");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [view,        setView]        = useState("chart");  // "chart" | "portfolio" | "alerts"
  const [portfolio,   setPortfolio]   = useState([]);       // [{code, name, qty, buyPrice}]
  const [alerts,      setAlerts]      = useState([]);       // [{code, type, price, triggered}]
  const [alertForm,   setAlertForm]   = useState({ type: "above", price: "" });
  const [news,        setNews]        = useState([]);
  const [sectorFilter,setSectorFilter]= useState("All");

  const t = THEMES[themeKey];

  const sectors = ["All", ...Array.from(new Set(ASX_STOCKS.map(s => s.sector))).sort()];
  const filtered = ASX_STOCKS.filter(s =>
    (sectorFilter === "All" || s.sector === sectorFilter) &&
    (s.code.includes(search.toUpperCase()) || s.name.toUpperCase().includes(search.toUpperCase()))
  );

  // Health check
  useEffect(() => {
    fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(6000) })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(() => setApiStatus("ok"))
      .catch(() => setApiStatus("error"));
  }, []);

  const loadStock = useCallback(async (stock, per = period) => {
    setLoading(true);
    setError(null);
    setNews(getMockNews(stock.code, stock.name));
    try {
      const json = await fetchStockData(stock.code, per);
      const raw  = json.data;
      const ema9   = calcEMA(raw, 9);
      const ema21  = calcEMA(raw, 21);
      const ema50  = calcEMA(raw, 50);
      const ema200 = calcEMA(raw, 200);
      const rsi    = calcRSI(raw);
      const macd   = calcMACD(raw);
      const bb     = calcBollingerBands(raw);
      const atr    = calcATR(raw);
      const stoch  = calcStochastic(raw);
      const vwap   = calcVWAP(raw);
      const inds   = { ema9, ema21, ema50, ema200, rsi, macd, bb, atr, stoch, vwap };
      setData(raw);
      setIndicators(inds);
      setAnalysis(generateSignals(raw, inds));
      setStockInfo(json.info);
      setLastUpdated(new Date());

      // Check price alerts
      const lastClose = raw[raw.length - 1].close;
      setAlerts(prev => prev.map(a =>
        a.code === stock.code && !a.triggered
          ? { ...a, triggered: (a.type === "above" && lastClose >= a.price) || (a.type === "below" && lastClose <= a.price) }
          : a
      ));
    } catch (err) {
      setError(err.message);
      setData([]); setIndicators(null); setAnalysis(null); setStockInfo(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { loadStock(selected); }, [selected, period]);

// Chart data merged — show all data for selected period
  const display = data;

  const chartData = display.map((d, i) => {
    const gi = i;
    return {
      ...d,
      ema9:     indicators?.ema9[gi],
      ema21:    indicators?.ema21[gi],
      ema50:    indicators?.ema50[gi],
      ema200:   indicators?.ema200[gi],
      bb_upper: indicators?.bb[gi]?.upper,
      bb_lower: indicators?.bb[gi]?.lower,
      bb_mid:   indicators?.bb[gi]?.middle,
      rsi:      indicators?.rsi[gi],
      macd:     indicators?.macd.macdLine[gi],
      signal:   indicators?.macd.signal[gi],
      histogram:indicators?.macd.histogram[gi],
      atr:      indicators?.atr[gi],
      stoch_k:  indicators?.stoch.kLine[gi],
      stoch_d:  indicators?.stoch.dLine[gi],
      vwap:     indicators?.vwap[gi],
    };
  });

  const lastPrice = data[data.length - 1]?.close;
  const prevPrice = data[data.length - 2]?.close;
  const priceChg  = lastPrice && prevPrice ? lastPrice - prevPrice : 0;
  const pctChg    = prevPrice ? (priceChg / prevPrice) * 100 : 0;

  // Portfolio helpers
  const addToPortfolio = () => {
    if (!lastPrice) return;
    const existing = portfolio.findIndex(p => p.code === selected.code);
    if (existing >= 0) return;
    setPortfolio(prev => [...prev, { code: selected.code, name: selected.name, qty: 100, buyPrice: lastPrice, currentPrice: lastPrice }]);
  };

  const removeFromPortfolio = (code) => setPortfolio(prev => prev.filter(p => p.code !== code));

  const totalValue    = portfolio.reduce((s, p) => s + p.qty * (p.currentPrice || p.buyPrice), 0);
  const totalCost     = portfolio.reduce((s, p) => s + p.qty * p.buyPrice, 0);
  const totalGainLoss = totalValue - totalCost;

  // Alert helpers
  const addAlert = () => {
    const price = parseFloat(alertForm.price);
    if (!price || isNaN(price)) return;
    setAlerts(prev => [...prev, { code: selected.code, name: selected.name, type: alertForm.type, price, triggered: false, id: Date.now() }]);
    setAlertForm({ type: "above", price: "" });
  };

  const periods = ["1mo","3mo","6mo","1y","2y","5y"];
  const tabs = [
    { id: "price",   label: "📈 Price" },
    { id: "rsi",     label: "📊 RSI" },
    { id: "macd",    label: "〰 MACD" },
    { id: "stoch",   label: "🎲 Stoch" },
    { id: "signals", label: "🎯 Signals" },
    { id: "news",    label: "📰 News" },
    { id: "fundamentals", label: "📋 Fundamentals" },
  ];

  const S = {
    app:      { minHeight: "100vh", background: t.bg, color: t.text, fontFamily: "'IBM Plex Sans', 'Segoe UI', sans-serif", transition: "background 0.3s, color 0.3s" },
    header:   { borderBottom: `1px solid ${t.border}`, padding: "12px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", background: t.surface, gap: 12, flexWrap: "wrap" },
    sidebar:  { width: 215, borderRight: `1px solid ${t.border}`, background: t.surface, overflow: "auto", flexShrink: 0, display: "flex", flexDirection: "column" },
    main:     { flex: 1, overflow: "auto", padding: "18px 20px" },
    card:     { background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 16 },
    btn:      (active) => ({ background: active ? t.accent : "transparent", border: `1px solid ${active ? t.accent : t.border}`, borderRadius: 6, padding: "6px 13px", color: active ? "#fff" : t.textDim, cursor: "pointer", fontSize: 12, fontWeight: active ? 500 : 400, transition: "all 0.15s" }),
    input:    { background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 6, padding: "7px 10px", color: t.text, fontSize: 12, outline: "none", width: "100%", boxSizing: "border-box" },
    tab:      (active) => ({ background: active ? t.surface2 : "transparent", border: active ? `1px solid ${t.border2}` : "1px solid transparent", borderRadius: 6, padding: "6px 12px", color: active ? t.text : t.textDim, cursor: "pointer", fontSize: 12, fontWeight: active ? 500 : 400 }),
  };

  return (
    <div style={S.app}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* ── HEADER ── */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: "linear-gradient(135deg,#1d4ed8,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "#fff" }}>A</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.3px" }}>ASX Analyzer</div>
            <div style={{ fontSize: 10, color: t.textDim }}>Technical Analysis · Yahoo Finance</div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ display: "flex", gap: 4 }}>
          {[["chart","📊 Charts"],["portfolio","💼 Portfolio"],["alerts","🔔 Alerts"]].map(([v,l]) => (
            <button key={v} onClick={() => setView(v)} style={S.btn(view === v)}>{l}
              {v === "alerts" && alerts.filter(a => a.triggered).length > 0 &&
                <span style={{ background: t.red, color: "#fff", borderRadius: "50%", fontSize: 9, padding: "1px 5px", marginLeft: 4 }}>{alerts.filter(a => a.triggered).length}</span>}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* API Status */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 20, padding: "4px 10px" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: apiStatus === "ok" ? t.green : apiStatus === "error" ? t.red : t.amber, boxShadow: `0 0 6px ${apiStatus === "ok" ? t.green : t.red}` }} />
            <span style={{ fontSize: 10, color: t.textDim, fontFamily: "monospace" }}>{apiStatus === "ok" ? "Live" : apiStatus === "error" ? "Offline" : "..."}</span>
          </div>
          {/* Theme toggle */}
          <button onClick={() => setThemeKey(k => k === "dark" ? "light" : "dark")} style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 20, padding: "5px 12px", color: t.textMid, cursor: "pointer", fontSize: 12 }}>
            {themeKey === "dark" ? "☀ Light" : "🌙 Dark"}
          </button>
          {lastUpdated && <span style={{ fontSize: 10, color: t.textFaint, fontFamily: "monospace" }}>{lastUpdated.toLocaleTimeString("en-AU")}</span>}
        </div>
      </div>

      {/* API Offline Banner */}
      {apiStatus === "error" && (
        <div style={{ background: t.red + "20", borderBottom: `1px solid ${t.red}50`, padding: "9px 22px", fontSize: 12, color: t.red }}>
          ⚠ Backend offline — run: <code style={{ fontFamily: "monospace", background: t.surface, padding: "1px 6px", borderRadius: 3 }}>uvicorn server:app --reload</code>
        </div>
      )}

      <div style={{ display: "flex", height: `calc(100vh - ${apiStatus === "error" ? 107 : 65}px)` }}>

        {/* ── SIDEBAR ── */}
        <div style={S.sidebar}>
          <div style={{ padding: "10px 10px 6px" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search stocks…" style={S.input} />
          </div>
          {/* Sector filter */}
          <div style={{ padding: "4px 10px 8px", display: "flex", gap: 4, flexWrap: "wrap" }}>
            {sectors.slice(0, 5).map(s => (
              <button key={s} onClick={() => setSectorFilter(s)} style={{ ...S.btn(sectorFilter === s), fontSize: 9, padding: "2px 7px" }}>{s}</button>
            ))}
          </div>
          <div style={{ flex: 1, overflow: "auto" }}>
            {filtered.map(s => (
              <div key={s.code} onClick={() => setSelected(s)} style={{ padding: "8px 12px", cursor: "pointer", background: selected.code === s.code ? t.surface2 : "transparent", borderLeft: `2px solid ${selected.code === s.code ? t.accent : "transparent"}`, transition: "all 0.12s" }}>
                <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 500, color: selected.code === s.code ? t.accent : t.text }}>{s.code}.ASX</div>
                <div style={{ fontSize: 10, color: t.textDim, marginTop: 1 }}>{s.name}</div>
                <div style={{ fontSize: 9, color: t.textFaint, marginTop: 1 }}>{s.sector}</div>
              </div>
            ))}
          </div>
          {/* Custom ticker */}
          <div style={{ padding: "10px", borderTop: `1px solid ${t.border}` }}>
            <div style={{ fontSize: 10, color: t.textDim, marginBottom: 5, textTransform: "uppercase", letterSpacing: 1 }}>Custom</div>
            <div style={{ display: "flex", gap: 5 }}>
              <input value={customCode} onChange={e => setCustomCode(e.target.value.toUpperCase())} placeholder="e.g. XRO" maxLength={6} style={{ ...S.input, flex: 1 }} />
              <button onClick={() => { if (customCode.trim()) { setSelected({ code: customCode.trim(), name: customCode.trim(), sector: "Custom" }); setCustomCode(""); } }} style={{ background: t.accent, border: "none", borderRadius: 6, color: "#fff", fontSize: 11, padding: "0 10px", cursor: "pointer" }}>Go</button>
            </div>
          </div>
        </div>

        {/* ── MAIN ── */}
        <div style={S.main}>

          {/* ══ PORTFOLIO VIEW ══ */}
          {view === "portfolio" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>💼 Portfolio Tracker</h2>
                <button onClick={addToPortfolio} style={{ background: t.accent, border: "none", borderRadius: 6, color: "#fff", padding: "8px 16px", cursor: "pointer", fontSize: 12 }}>+ Add {selected.code}</button>
              </div>
              {portfolio.length === 0 ? (
                <div style={{ ...S.card, textAlign: "center", padding: 40, color: t.textDim }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                  <div>No stocks in portfolio yet.</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>Select a stock from the sidebar and click "+ Add"</div>
                </div>
              ) : (
                <>
                  {/* Summary */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
                    <StatCard label="Total Value"  value={`A$${totalValue.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} t={t} />
                    <StatCard label="Total Cost"   value={`A$${totalCost.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} t={t} />
                    <StatCard label="Gain / Loss"  value={`${totalGainLoss >= 0 ? "+" : ""}A$${Math.abs(totalGainLoss).toFixed(2)}`} color={totalGainLoss >= 0 ? t.green : t.red} sub={`${totalCost > 0 ? ((totalGainLoss/totalCost)*100).toFixed(2) : 0}% total return`} t={t} />
                    <StatCard label="Holdings"     value={`${portfolio.length} stocks`} t={t} />
                  </div>
                  {/* Holdings table */}
                  <div style={{ ...S.card, overflow: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                          {["Code","Company","Qty","Buy Price","Current","Value","P&L","Action"].map(h => (
                            <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: t.textDim, fontSize: 11, fontWeight: 500 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {portfolio.map(p => {
                          const curr  = p.currentPrice || p.buyPrice;
                          const pnl   = (curr - p.buyPrice) * p.qty;
                          const pnlPct= ((curr - p.buyPrice) / p.buyPrice * 100).toFixed(2);
                          return (
                            <tr key={p.code} style={{ borderBottom: `1px solid ${t.border}` }}>
                              <td style={{ padding: "10px 12px", fontFamily: "monospace", color: t.accent, fontWeight: 600 }}>{p.code}</td>
                              <td style={{ padding: "10px 12px", color: t.textMid, fontSize: 12 }}>{p.name}</td>
                              <td style={{ padding: "10px 12px" }}>
                                <input type="number" value={p.qty} onChange={e => setPortfolio(prev => prev.map(x => x.code === p.code ? {...x, qty: +e.target.value} : x))}
                                  style={{ ...S.input, width: 70, fontFamily: "monospace" }} />
                              </td>
                              <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>A${p.buyPrice.toFixed(3)}</td>
                              <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>A${curr.toFixed(3)}</td>
                              <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>A${(curr * p.qty).toFixed(2)}</td>
                              <td style={{ padding: "10px 12px", fontFamily: "monospace", color: pnl >= 0 ? t.green : t.red }}>
                                {pnl >= 0 ? "+" : ""}A${pnl.toFixed(2)}<br/>
                                <span style={{ fontSize: 10 }}>{pnlPct}%</span>
                              </td>
                              <td style={{ padding: "10px 12px" }}>
                                <button onClick={() => removeFromPortfolio(p.code)} style={{ background: t.red + "20", border: `1px solid ${t.red}40`, borderRadius: 4, color: t.red, padding: "3px 10px", cursor: "pointer", fontSize: 11 }}>Remove</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ══ ALERTS VIEW ══ */}
          {view === "alerts" && (
            <div>
              <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 600 }}>🔔 Price Alerts</h2>
              {/* Add alert form */}
              <div style={{ ...S.card, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: 11, color: t.textDim, marginBottom: 4 }}>Stock</div>
                  <div style={{ fontFamily: "monospace", fontSize: 14, color: t.accent, fontWeight: 600 }}>{selected.code}.ASX</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: t.textDim, marginBottom: 4 }}>Alert Type</div>
                  <select value={alertForm.type} onChange={e => setAlertForm(f => ({...f, type: e.target.value}))} style={{ ...S.input, width: 120 }}>
                    <option value="above">Price Above</option>
                    <option value="below">Price Below</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: t.textDim, marginBottom: 4 }}>Target Price (A$)</div>
                  <input type="number" value={alertForm.price} onChange={e => setAlertForm(f => ({...f, price: e.target.value}))} placeholder={lastPrice?.toFixed(2)} step="0.01" style={{ ...S.input, width: 120 }} />
                </div>
                <button onClick={addAlert} style={{ background: t.accent, border: "none", borderRadius: 6, color: "#fff", padding: "8px 18px", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>+ Set Alert</button>
              </div>

              {alerts.length === 0 ? (
                <div style={{ ...S.card, textAlign: "center", padding: 40, color: t.textDim }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
                  <div>No alerts set yet.</div>
                  <div style={{ fontSize: 12, marginTop: 6 }}>Select a stock, set a target price and click "+ Set Alert"</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {alerts.map(a => (
                    <div key={a.id} style={{ ...S.card, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, borderLeft: `3px solid ${a.triggered ? t.green : t.border2}` }}>
                      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                        <span style={{ fontFamily: "monospace", color: t.accent, fontWeight: 600, fontSize: 14 }}>{a.code}</span>
                        <span style={{ color: t.textMid, fontSize: 13 }}>Price {a.type} <strong style={{ color: t.text }}>A${a.price.toFixed(3)}</strong></span>
                        {a.triggered
                          ? <span style={{ background: t.green + "20", border: `1px solid ${t.green}50`, color: t.green, borderRadius: 4, padding: "2px 8px", fontSize: 11 }}>✓ Triggered</span>
                          : <span style={{ background: t.amber + "20", border: `1px solid ${t.amber}50`, color: t.amber, borderRadius: 4, padding: "2px 8px", fontSize: 11 }}>⏳ Watching</span>}
                      </div>
                      <button onClick={() => setAlerts(prev => prev.filter(x => x.id !== a.id))} style={{ background: t.red + "15", border: `1px solid ${t.red}30`, borderRadius: 4, color: t.red, padding: "3px 10px", cursor: "pointer", fontSize: 11 }}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ══ CHART VIEW ══ */}
          {view === "chart" && (
            <>
              {loading && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: t.textDim }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 28, marginBottom: 8, display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</div>
                    <div style={{ fontFamily: "monospace", fontSize: 13 }}>Fetching {selected.code} from Yahoo Finance…</div>
                  </div>
                </div>
              )}

              {!loading && error && (
                <div style={{ ...S.card, textAlign: "center", padding: 30, borderColor: t.red + "50" }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>⚠</div>
                  <div style={{ color: t.red, fontSize: 14, marginBottom: 6 }}>Failed to load {selected.code}.ASX</div>
                  <div style={{ color: t.textDim, fontSize: 12, marginBottom: 14 }}>{error}</div>
                  <button onClick={() => loadStock(selected)} style={{ background: t.accent, border: "none", borderRadius: 6, color: "#fff", padding: "8px 18px", cursor: "pointer" }}>Retry</button>
                </div>
              )}

              {!loading && !error && data.length > 0 && (
                <>
                  {/* Stock Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: "-0.4px" }}>{selected.code}.ASX</h1>
                        <span style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 4, padding: "2px 8px", fontSize: 10, color: t.textDim }}>Yahoo Finance · Live</span>
                        <span style={{ background: t.accent + "20", border: `1px solid ${t.accent}40`, borderRadius: 4, padding: "2px 8px", fontSize: 10, color: t.accent }}>{selected.sector || stockInfo?.sector || ""}</span>
                      </div>
                      <div style={{ color: t.textDim, fontSize: 12, marginTop: 3 }}>{stockInfo?.name || selected.name}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {lastPrice && (
                        <>
                          <div style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 600 }}>A${lastPrice.toFixed(3)}</div>
                          <div style={{ fontFamily: "monospace", fontSize: 12, color: priceChg >= 0 ? t.green : t.red }}>
                            {priceChg >= 0 ? "▲" : "▼"} {Math.abs(priceChg).toFixed(3)} ({Math.abs(pctChg).toFixed(2)}%)
                          </div>
                        </>
                      )}
                      <div style={{ display: "flex", gap: 3, marginTop: 6, justifyContent: "flex-end" }}>
                        {periods.map(p => (
                          <button key={p} onClick={() => setPeriod(p)} style={{ ...S.btn(period === p), fontSize: 10, padding: "3px 8px", fontFamily: "monospace" }}>{p}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Signal Summary */}
                  {analysis && (
                    <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                      <div style={{ textAlign: "center", minWidth: 70 }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: analysis.recColor, fontFamily: "monospace", letterSpacing: "-1px" }}>{analysis.recommendation}</div>
                        <div style={{ fontSize: 9, color: t.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Signal</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: t.textDim, marginBottom: 5 }}>
                          <span style={{ color: t.red }}>▼ Sell {analysis.bearish}</span>
                          <span style={{ color: analysis.recColor }}>Score {analysis.score}%</span>
                          <span style={{ color: t.green }}>▲ Buy {analysis.bullish}</span>
                        </div>
                        <div style={{ height: 5, background: t.surface2, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${analysis.score}%`, background: `linear-gradient(90deg,${t.red},${t.amber} 50%,${t.green})`, transition: "width 0.5s" }} />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 16 }}>
                        {[
                          { l: "RSI",    v: indicators?.rsi[data.length-1]?.toFixed(1) },
                          { l: "ATR",    v: indicators?.atr[data.length-1]?.toFixed(3) },
                          { l: "Signals",v: `${analysis.signals.length} active` },
                        ].map(({ l, v }) => (
                          <div key={l} style={{ fontSize: 11 }}>
                            <div style={{ color: t.textDim, fontSize: 9, textTransform: "uppercase", marginBottom: 2 }}>{l}</div>
                            <div style={{ fontFamily: "monospace", color: t.text }}>{v ?? "—"}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => loadStock(selected)} style={{ ...S.btn(false), fontSize: 11 }}>↻ Refresh</button>
                        <button onClick={addToPortfolio} style={{ ...S.btn(false), fontSize: 11, color: t.green, borderColor: t.green + "50" }}>+ Portfolio</button>
                      </div>
                    </div>
                  )}

                  {/* Chart mode + tabs */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {tabs.map(tb => (
                        <button key={tb.id} onClick={() => setActiveTab(tb.id)} style={S.tab(activeTab === tb.id)}>{tb.label}</button>
                      ))}
                    </div>
                    {(activeTab === "price") && (
                      <div style={{ display: "flex", gap: 4 }}>
                        {[["line","〜 Line"],["candle","🕯 Candle"],["area","◿ Area"]].map(([m,l]) => (
                          <button key={m} onClick={() => setChartMode(m)} style={{ ...S.btn(chartMode === m), fontSize: 11, padding: "4px 10px" }}>{l}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Chart panel */}
                  <div style={{ ...S.card, padding: "14px 6px 10px" }}>

                    {/* PRICE TAB */}
                    {activeTab === "price" && (
                      <>
                        <div style={{ fontSize: 10, color: t.textDim, padding: "0 12px 10px", display: "flex", gap: 14, flexWrap: "wrap" }}>
                          <span style={{ color: "#60a5fa" }}>— Close/OHLC</span>
                          <span style={{ color: "#60a5fa" }}>- EMA9</span>
                          <span style={{ color: t.amber }}>- EMA50</span>
                          <span style={{ color: "#f97316" }}>- EMA200</span>
                          <span style={{ color: t.purple }}>· BB Bands</span>
                          <span style={{ color: t.teal }}>· VWAP</span>
                        </div>

                        {/* Candlestick chart */}
                        {chartMode === "candle" && (
                          <CandleChart
                            data={chartData}
                            ema9={chartData.map(d => d.ema9)}
                            ema50={chartData.map(d => d.ema50)}
                            ema200={chartData.map(d => d.ema200)}
                            bbUpper={chartData.map(d => d.bb_upper)}
                            bbLower={chartData.map(d => d.bb_lower)}
                            vwap={chartData.map(d => d.vwap)}
                            theme={t}
                          />
                        )}

                        {/* Line chart */}
                        {chartMode === "line" && (
                          <ResponsiveContainer width="100%" height={300}>
                            <ComposedChart data={chartData} margin={{ left: 0, right: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
                              <XAxis dataKey="date" tick={{ fontSize: 9, fill: t.textDim }} tickFormatter={d => d.slice(5)} interval={Math.floor(chartData.length / 6)} />
                              <YAxis tick={{ fontSize: 9, fill: t.textDim }} domain={([min, max]) => { const p = (max-min)*0.05; return [+(min-p).toFixed(4), +(max+p).toFixed(4)]; }} width={62} tickFormatter={v => { if (v>=1000) return `$${(v/1000).toFixed(1)}k`; if (v>=100) return `$${v.toFixed(0)}`; if (v>=10) return `$${v.toFixed(2)}`; if (v>=1) return `$${v.toFixed(2)}`; return `$${v.toFixed(4)}`; }} />
                              <Tooltip content={<ChartTooltip t={t} />} />
                              <Line dataKey="close"  stroke="#60a5fa" dot={false} strokeWidth={2}   name="Close" />
                              <Line dataKey="ema9"   stroke="#60a5fa" dot={false} strokeWidth={1.2} strokeDasharray="4 2" name="EMA9" opacity={0.7} />
                              <Line dataKey="ema50"  stroke={t.amber} dot={false} strokeWidth={1.5} strokeDasharray="5 3" name="EMA50" />
                              <Line dataKey="ema200" stroke="#f97316" dot={false} strokeWidth={1.5} strokeDasharray="5 3" name="EMA200" />
                              <Line dataKey="bb_upper" stroke={t.purple} dot={false} strokeWidth={1} strokeDasharray="2 4" name="BB Upper" />
                              <Line dataKey="bb_lower" stroke={t.purple} dot={false} strokeWidth={1} strokeDasharray="2 4" name="BB Lower" />
                              <Line dataKey="vwap"   stroke={t.teal}  dot={false} strokeWidth={1.5} strokeDasharray="3 2" name="VWAP" />
                            </ComposedChart>
                          </ResponsiveContainer>
                        )}

                        {/* Area chart */}
                        {chartMode === "area" && (
                          <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={chartData} margin={{ left: 0, right: 8 }}>
                              <defs>
                                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
                              <XAxis dataKey="date" tick={{ fontSize: 9, fill: t.textDim }} tickFormatter={d => d.slice(5)} interval={Math.floor(chartData.length / 6)} />
                              <YAxis tick={{ fontSize: 9, fill: t.textDim }} domain={([min, max]) => { const p = (max-min)*0.05; return [+(min-p).toFixed(4), +(max+p).toFixed(4)]; }} width={62} tickFormatter={v => { if (v>=1000) return `$${(v/1000).toFixed(1)}k`; if (v>=100) return `$${v.toFixed(0)}`; if (v>=10) return `$${v.toFixed(2)}`; if (v>=1) return `$${v.toFixed(2)}`; return `$${v.toFixed(4)}`; }} />
                              <Tooltip content={<ChartTooltip t={t} />} />
                              <Area type="monotone" dataKey="close" stroke="#3b82f6" fill="url(#priceGrad)" strokeWidth={2} dot={false} name="Close" />
                            </AreaChart>
                          </ResponsiveContainer>
                        )}

                        {/* Volume bar */}
                        <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 6, paddingTop: 6 }}>
                          <div style={{ fontSize: 10, color: t.textDim, padding: "0 12px 3px" }}>Volume</div>
                          <ResponsiveContainer width="100%" height={55}>
                            <BarChart data={chartData} margin={{ left: 0, right: 8 }}>
                              <Bar dataKey="volume" fill={t.accent + "50"} radius={[1,1,0,0]}
                                shape={({ x, y, width, height, index }) => {
                                  const d = chartData[index];
                                  const color = d?.close >= d?.open ? t.green : t.red;
                                  return <rect x={x} y={y} width={width} height={height} fill={color + "60"} />;
                                }}
                              />
                              <XAxis hide /><YAxis hide />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    )}

                    {/* RSI TAB */}
                    {activeTab === "rsi" && (
                      <>
                        <div style={{ fontSize: 10, color: t.textDim, padding: "0 12px 10px" }}>RSI (14) — Below 30: Oversold · Above 70: Overbought</div>
                        <ResponsiveContainer width="100%" height={280}>
                          <ComposedChart data={chartData} margin={{ left: 0, right: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
                            <XAxis dataKey="date" tick={{ fontSize: 9, fill: t.textDim }} tickFormatter={d => d.slice(5)} interval={Math.floor(chartData.length / 6)} />
                            <YAxis tick={{ fontSize: 9, fill: t.textDim }} domain={[0,100]} width={32} />
                            <Tooltip content={<ChartTooltip t={t} />} />
                            <ReferenceLine y={70} stroke={t.red}   strokeDasharray="4 2" label={{ value:"70 OB", fill: t.red,   fontSize: 9, position:"insideRight" }} />
                            <ReferenceLine y={50} stroke={t.border2} strokeDasharray="2 4" />
                            <ReferenceLine y={30} stroke={t.green} strokeDasharray="4 2" label={{ value:"30 OS", fill: t.green, fontSize: 9, position:"insideRight" }} />
                            <Area type="monotone" dataKey="rsi" stroke={t.purple} fill={t.purple + "20"} dot={false} strokeWidth={2} name="RSI" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </>
                    )}

                    {/* MACD TAB */}
                    {activeTab === "macd" && (
                      <>
                        <div style={{ fontSize: 10, color: t.textDim, padding: "0 12px 10px" }}>MACD (12,26,9) — Blue: MACD · Amber: Signal · Histogram: divergence</div>
                        <ResponsiveContainer width="100%" height={170}>
                          <ComposedChart data={chartData} margin={{ left: 0, right: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
                            <XAxis dataKey="date" tick={{ fontSize: 9, fill: t.textDim }} tickFormatter={d => d.slice(5)} interval={Math.floor(chartData.length / 6)} />
                            <YAxis tick={{ fontSize: 9, fill: t.textDim }} width={45} />
                            <Tooltip content={<ChartTooltip t={t} />} />
                            <ReferenceLine y={0} stroke={t.border2} />
                            <Line dataKey="macd"   stroke="#60a5fa" dot={false} strokeWidth={1.5} name="MACD" />
                            <Line dataKey="signal" stroke={t.amber} dot={false} strokeWidth={1.5} name="Signal" />
                          </ComposedChart>
                        </ResponsiveContainer>
                        <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 4 }}>
                          <div style={{ fontSize: 10, color: t.textDim, padding: "5px 12px 3px" }}>Histogram</div>
                          <ResponsiveContainer width="100%" height={80}>
                            <BarChart data={chartData} margin={{ left: 0, right: 8 }}>
                              <Bar dataKey="histogram" shape={({ x, y, width, height, value }) => (
                                <rect x={x} y={value >= 0 ? y : y + height} width={width} height={Math.abs(height)}
                                  fill={value >= 0 ? t.green : t.red} opacity={0.8} />
                              )} />
                              <ReferenceLine y={0} stroke={t.border2} />
                              <XAxis hide /><YAxis hide />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    )}

                    {/* STOCHASTIC TAB */}
                    {activeTab === "stoch" && (
                      <>
                        <div style={{ fontSize: 10, color: t.textDim, padding: "0 12px 10px" }}>Stochastic (14,3) — %K: Blue · %D: Amber · &lt;20 Oversold · &gt;80 Overbought</div>
                        <ResponsiveContainer width="100%" height={280}>
                          <ComposedChart data={chartData} margin={{ left: 0, right: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
                            <XAxis dataKey="date" tick={{ fontSize: 9, fill: t.textDim }} tickFormatter={d => d.slice(5)} interval={Math.floor(chartData.length / 6)} />
                            <YAxis tick={{ fontSize: 9, fill: t.textDim }} domain={[0,100]} width={32} />
                            <Tooltip content={<ChartTooltip t={t} />} />
                            <ReferenceLine y={80} stroke={t.red}     strokeDasharray="4 2" label={{ value:"80", fill: t.red,   fontSize: 9, position:"insideRight" }} />
                            <ReferenceLine y={50} stroke={t.border2} strokeDasharray="2 4" />
                            <ReferenceLine y={20} stroke={t.green}   strokeDasharray="4 2" label={{ value:"20", fill: t.green, fontSize: 9, position:"insideRight" }} />
                            <Line dataKey="stoch_k" stroke="#60a5fa" dot={false} strokeWidth={2}   name="%K" />
                            <Line dataKey="stoch_d" stroke={t.amber} dot={false} strokeWidth={1.5} name="%D" strokeDasharray="4 2" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </>
                    )}

                    {/* SIGNALS TAB */}
                    {activeTab === "signals" && analysis && (
                      <div style={{ padding: "4px 12px 8px" }}>
                        <div style={{ fontSize: 11, color: t.textDim, marginBottom: 14 }}>
                          {analysis.signals.length} signal{analysis.signals.length !== 1 ? "s" : ""} detected · {data.length} trading days analysed
                        </div>
                        {analysis.signals.length === 0 ? (
                          <div style={{ color: t.textDim, fontSize: 13, textAlign: "center", padding: "20px 0" }}>No clear signals — market may be consolidating.</div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {analysis.signals.map((sig, i) => (
                              <div key={i} style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "10px 13px", borderLeft: `3px solid ${sig.type === "BUY" ? t.green : t.red}` }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                                  <SignalBadge type={sig.type} strength={sig.strength} t={t} />
                                  <span style={{ fontSize: 11, color: t.textDim, fontFamily: "monospace" }}>{sig.indicator}</span>
                                </div>
                                <div style={{ fontSize: 12, color: t.textMid, lineHeight: 1.5 }}>{sig.detail}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ marginTop: 14, padding: "12px 13px", background: t.red + "08", border: `1px solid ${t.red}20`, borderRadius: 8 }}>
                          <div style={{ fontSize: 10, color: t.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>⚠ Disclaimer</div>
                          <div style={{ fontSize: 11, color: t.textDim, lineHeight: 1.7 }}>For educational purposes only. Not financial advice. Always consult a licensed financial advisor before making investment decisions.</div>
                        </div>
                      </div>
                    )}

                    {/* NEWS TAB */}
                    {activeTab === "news" && (
                      <div style={{ padding: "4px 12px 8px" }}>
                        <div style={{ fontSize: 11, color: t.textDim, marginBottom: 14 }}>
                          Recent news for {selected.code}.ASX · {selected.name}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {news.map((n, i) => (
                            <div key={i} style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: "12px 14px", borderLeft: `3px solid ${n.sentiment === "positive" ? t.green : n.sentiment === "negative" ? t.red : t.border2}` }}>
                              <div style={{ fontSize: 13, color: t.text, lineHeight: 1.4, marginBottom: 6 }}>{n.title}</div>
                              <div style={{ display: "flex", gap: 10, fontSize: 10, color: t.textDim }}>
                                <span style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 3, padding: "1px 6px" }}>{n.source}</span>
                                <span>{n.time}</span>
                                <span style={{ color: n.sentiment === "positive" ? t.green : n.sentiment === "negative" ? t.red : t.textDim }}>
                                  {n.sentiment === "positive" ? "▲ Positive" : n.sentiment === "negative" ? "▼ Negative" : "● Neutral"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: 12, padding: "10px 12px", background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 11, color: t.textDim }}>
                          💡 News is simulated for demonstration. Connect a real news API (e.g. NewsAPI.org or Yahoo Finance news) for live headlines.
                        </div>
                      </div>
                    )}

                    {/* FUNDAMENTALS TAB */}
                    {activeTab === "fundamentals" && stockInfo && (
                      <div style={{ padding: "4px 12px 8px" }}>
                        <div style={{ fontSize: 11, color: t.textDim, marginBottom: 14 }}>Fundamental data for {selected.code}.ASX · Source: Yahoo Finance</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
                          {[
                            { label: "Company",      value: stockInfo.name },
                            { label: "Sector",       value: stockInfo.sector || "—" },
                            { label: "Industry",     value: stockInfo.industry || "—" },
                            { label: "Currency",     value: stockInfo.currency || "AUD" },
                            { label: "Market Cap",   value: stockInfo.market_cap ? `A$${(stockInfo.market_cap / 1e9).toFixed(2)}B` : "—" },
                            { label: "Last Price",   value: stockInfo.last_price ? `A$${stockInfo.last_price.toFixed(3)}` : "—" },
                            { label: "P/E Ratio",    value: stockInfo.pe_ratio ? stockInfo.pe_ratio.toFixed(2) + "x" : "—" },
                            { label: "52W High",     value: stockInfo["52w_high"] ? `A$${stockInfo["52w_high"].toFixed(3)}` : "—" },
                            { label: "52W Low",      value: stockInfo["52w_low"]  ? `A$${stockInfo["52w_low"].toFixed(3)}`  : "—" },
                            { label: "Avg Volume",   value: stockInfo.volume ? `${(stockInfo.volume / 1e6).toFixed(2)}M` : "—" },
                          ].map(({ label, value }) => <StatCard key={label} label={label} value={value} t={t} />)}
                        </div>
                        <div style={{ padding: "12px 13px", background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, fontSize: 11, color: t.textDim }}>
                          💡 Fundamental data sourced from Yahoo Finance. Some fields may be delayed or unavailable for all stocks.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Key Stats Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
                    {[
                      { label: "Close",      value: `A$${lastPrice?.toFixed(3)}`, sub: `${priceChg >= 0 ? "+" : ""}${pctChg.toFixed(2)}% today`, color: priceChg >= 0 ? t.green : t.red },
                      { label: "52W High",   value: `A$${Math.max(...data.map(d => d.high)).toFixed(3)}` },
                      { label: "52W Low",    value: `A$${Math.min(...data.map(d => d.low)).toFixed(3)}` },
                      { label: "Avg Vol",    value: `${(data.reduce((s,d) => s + d.volume, 0) / data.length / 1e6).toFixed(2)}M` },
                      { label: "RSI (14)",   value: indicators?.rsi[data.length-1]?.toFixed(2) ?? "—", sub: (v => v > 70 ? "Overbought" : v < 30 ? "Oversold" : "Neutral")(indicators?.rsi[data.length-1] ?? 50), color: (v => v > 70 ? t.red : v < 30 ? t.green : t.textMid)(indicators?.rsi[data.length-1] ?? 50) },
                      { label: "ATR (14)",   value: indicators?.atr[data.length-1]?.toFixed(3) ?? "—", sub: "Avg True Range" },
                      { label: "EMA 50",     value: indicators?.ema50[data.length-1] ? `A$${indicators.ema50[data.length-1].toFixed(3)}` : "—" },
                      { label: "EMA 200",    value: indicators?.ema200[data.length-1] ? `A$${indicators.ema200[data.length-1].toFixed(3)}` : "—" },
                    ].map(({ label, value, sub, color }) => (
                      <StatCard key={label} label={label} value={value} sub={sub} color={color} t={t} />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${t.border2}; border-radius: 2px; }
      `}</style>
    </div>
  );
}
