import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, ArrowDownRight, Minus, Wifi } from 'lucide-react';
import { cn } from '../lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

type SignalStatus = 'hot' | 'warm' | 'neutral' | 'cold' | 'alert';
type Category = 'All' | 'Activity' | 'Prices' | 'Labour' | 'Trade' | 'Financial';

interface MacroSignal {
  id: string;
  name: string;
  shortName: string;
  category: Exclude<Category, 'All'>;
  value: number;
  unit: string;
  unitPosition: 'prefix' | 'suffix';
  delta: number;          // change from prior period
  deltaLabel: string;     // e.g. "vs prior month"
  status: SignalStatus;
  statusLabel: string;
  surprise: number | null; // positive = beat, negative = miss, null = no consensus
  history: number[];       // 8 data points for sparkline (oldest → newest)
  historyLabel: string;    // e.g. "8Q" or "8M"
  source: string;
}

// ── Static signal data (illustrative — swap with live API) ────────────────────

const SIGNALS: MacroSignal[] = [
  {
    id: 'pmi',
    name: 'Manufacturing PMI',
    shortName: 'PMI',
    category: 'Activity',
    value: 50.8,
    unit: '',
    unitPosition: 'suffix',
    delta: 0.6,
    deltaLabel: 'vs prior month',
    status: 'warm',
    statusLabel: 'Expanding',
    surprise: +0.3,
    history: [48.4, 47.9, 49.1, 50.2, 49.8, 50.1, 50.2, 50.8],
    historyLabel: '8M',
    source: 'S&P Global',
  },
  {
    id: 'cpi',
    name: 'CPI Inflation (YoY)',
    shortName: 'CPI',
    category: 'Prices',
    value: 2.4,
    unit: '%',
    unitPosition: 'suffix',
    delta: -0.3,
    deltaLabel: 'vs prior month',
    status: 'warm',
    statusLabel: 'Moderate',
    surprise: -0.1,
    history: [4.1, 3.8, 3.5, 3.1, 2.9, 2.7, 2.7, 2.4],
    historyLabel: '8M',
    source: 'Dept. of Statistics',
  },
  {
    id: 'unemployment',
    name: 'Unemployment Rate',
    shortName: 'U-Rate',
    category: 'Labour',
    value: 2.0,
    unit: '%',
    unitPosition: 'suffix',
    delta: -0.1,
    deltaLabel: 'vs prior quarter',
    status: 'hot',
    statusLabel: 'Tight',
    surprise: 0,
    history: [2.4, 2.3, 2.2, 2.2, 2.1, 2.1, 2.1, 2.0],
    historyLabel: '8Q',
    source: 'MOM',
  },
  {
    id: 'yield-curve',
    name: 'Yield Curve (10Y–3M)',
    shortName: '10Y–3M',
    category: 'Financial',
    value: -0.18,
    unit: '%',
    unitPosition: 'suffix',
    delta: 0.12,
    deltaLabel: 'vs prior month',
    status: 'alert',
    statusLabel: 'Inverted',
    surprise: null,
    history: [0.45, 0.22, 0.08, -0.05, -0.21, -0.30, -0.30, -0.18],
    historyLabel: '8M',
    source: 'MAS',
  },
  {
    id: 'ip',
    name: 'Industrial Production (YoY)',
    shortName: 'Ind. Prod.',
    category: 'Activity',
    value: 1.8,
    unit: '%',
    unitPosition: 'suffix',
    delta: 0.9,
    deltaLabel: 'vs prior month',
    status: 'warm',
    statusLabel: 'Recovering',
    surprise: +1.2,
    history: [-2.1, -1.8, -0.4, 0.2, 0.8, 0.9, 0.9, 1.8],
    historyLabel: '8M',
    source: 'EDB',
  },
  {
    id: 'nodx',
    name: 'NODX (YoY)',
    shortName: 'NODX',
    category: 'Trade',
    value: 2.1,
    unit: '%',
    unitPosition: 'suffix',
    delta: -0.5,
    deltaLabel: 'vs prior month',
    status: 'neutral',
    statusLabel: 'Subdued',
    surprise: -0.8,
    history: [5.2, 3.8, 2.4, 1.1, 0.8, 2.6, 2.6, 2.1],
    historyLabel: '8M',
    source: 'Enterprise SG',
  },
  {
    id: 'retail',
    name: 'Retail Sales (YoY)',
    shortName: 'Retail',
    category: 'Activity',
    value: 3.2,
    unit: '%',
    unitPosition: 'suffix',
    delta: 0.4,
    deltaLabel: 'vs prior month',
    status: 'warm',
    statusLabel: 'Growing',
    surprise: +0.6,
    history: [1.8, 2.1, 2.0, 2.5, 2.8, 2.9, 2.8, 3.2],
    historyLabel: '8M',
    source: 'Dept. of Statistics',
  },
  {
    id: 'biz-expect',
    name: 'Business Expectations',
    shortName: 'Biz. Exp.',
    category: 'Activity',
    value: 12,
    unit: 'net%',
    unitPosition: 'suffix',
    delta: 4,
    deltaLabel: 'vs prior quarter',
    status: 'warm',
    statusLabel: 'Optimistic',
    surprise: null,
    history: [-8, -3, 2, 5, 7, 8, 8, 12],
    historyLabel: '8Q',
    source: 'MTI',
  },
];

// ── Status styling config ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<SignalStatus, { bg: string; text: string; dot: string; border: string }> = {
  hot:     { bg: 'rgba(16,185,129,0.10)', text: '#10b981', dot: '#10b981', border: 'rgba(16,185,129,0.25)' },
  warm:    { bg: 'rgba(251,191,36,0.10)', text: '#f59e0b', dot: '#f59e0b', border: 'rgba(251,191,36,0.25)' },
  neutral: { bg: 'rgba(100,116,139,0.10)', text: '#94a3b8', dot: '#94a3b8', border: 'rgba(100,116,139,0.25)' },
  cold:    { bg: 'rgba(59,130,246,0.10)', text: '#3b82f6', dot: '#3b82f6', border: 'rgba(59,130,246,0.25)' },
  alert:   { bg: 'rgba(239,68,68,0.10)', text: '#ef4444', dot: '#ef4444', border: 'rgba(239,68,68,0.25)' },
};

const CATEGORIES: Category[] = ['All', 'Activity', 'Prices', 'Labour', 'Trade', 'Financial'];

// ── Inline sparkline (SVG) ────────────────────────────────────────────────────

function Sparkline({ data, status }: { data: number[]; status: SignalStatus }) {
  const W = 80;
  const H = 28;
  const PAD = 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pts = data.map((v, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - 2 * PAD);
    const y = H - PAD - ((v - min) / range) * (H - 2 * PAD);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const color = STATUS_CONFIG[status].dot;
  const lastX = parseFloat(pts[pts.length - 1].split(',')[0]);
  const lastY = parseFloat(pts[pts.length - 1].split(',')[1]);

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">
      <polyline
        points={pts.join(' ')}
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.5}
      />
      <circle cx={lastX} cy={lastY} r={2.5} fill={color} opacity={0.9} />
    </svg>
  );
}

// ── Surprise badge ────────────────────────────────────────────────────────────

function SurpriseBadge({ value }: { value: number }) {
  if (value === 0) return null;
  const positive = value > 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wide"
      style={{
        backgroundColor: positive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
        color: positive ? '#10b981' : '#ef4444',
        fontFamily: '"IBM Plex Mono", monospace',
      }}
    >
      {positive ? '▲' : '▼'} {positive ? '+' : ''}{value.toFixed(1)} SURP
    </span>
  );
}

// ── Signal card ───────────────────────────────────────────────────────────────

function SignalCard({ signal, index }: { signal: MacroSignal; index: number }) {
  const sc = STATUS_CONFIG[signal.status];
  const isUp = signal.delta > 0;
  const isDown = signal.delta < 0;

  const formattedValue = signal.unitPosition === 'prefix'
    ? `${signal.unit}${signal.value.toFixed(signal.unit === '' ? 1 : 1)}`
    : `${signal.value % 1 === 0 ? signal.value : signal.value.toFixed(1)}${signal.unit}`;

  return (
    <motion.div
      className="terminal-card p-4 flex flex-col gap-3 relative overflow-hidden group"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04, ease: 'easeOut' }}
    >
      {/* Accent glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-lg"
        style={{ background: `radial-gradient(ellipse at top left, ${sc.bg} 0%, transparent 60%)` }}
      />

      {/* Header row */}
      <div className="flex items-start justify-between gap-2 relative">
        <div className="min-w-0">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-terminal truncate"
            style={{ fontFamily: '"IBM Plex Mono", monospace' }}
          >
            {signal.name}
          </p>
          <p className="text-[9px] text-muted-terminal opacity-60 mt-0.5" style={{ fontFamily: '"IBM Plex Mono", monospace' }}>
            {signal.source} · {signal.historyLabel} history
          </p>
        </div>
        {/* Status badge */}
        <span
          className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wide border"
          style={{ backgroundColor: sc.bg, color: sc.text, borderColor: sc.border, fontFamily: '"IBM Plex Mono", monospace' }}
        >
          {signal.statusLabel}
        </span>
      </div>

      {/* Value + sparkline */}
      <div className="flex items-end justify-between gap-2 relative">
        <div>
          <div
            className="text-2xl font-semibold tracking-tight"
            style={{ fontFamily: '"IBM Plex Mono", monospace', color: sc.text }}
          >
            {formattedValue}
          </div>
          {/* Delta */}
          <div className="flex items-center gap-1 mt-1">
            {isUp ? (
              <ArrowUpRight className="w-3 h-3 shrink-0" style={{ color: sc.text }} />
            ) : isDown ? (
              <ArrowDownRight className="w-3 h-3 shrink-0" style={{ color: sc.text }} />
            ) : (
              <Minus className="w-3 h-3 shrink-0 text-muted-terminal" />
            )}
            <span
              className="text-[10px] font-medium"
              style={{ color: sc.text, fontFamily: '"IBM Plex Mono", monospace' }}
            >
              {isUp ? '+' : ''}{signal.delta.toFixed(signal.delta % 1 === 0 ? 0 : 1)}
            </span>
            <span className="text-[9px] text-muted-terminal opacity-70">{signal.deltaLabel}</span>
          </div>
        </div>
        <Sparkline data={signal.history} status={signal.status} />
      </div>

      {/* Surprise badge */}
      {signal.surprise !== null && (
        <div className="relative">
          <SurpriseBadge value={signal.surprise} />
        </div>
      )}
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MacroSignalPanel() {
  const [activeCategory, setActiveCategory] = useState<Category>('All');

  const filtered = activeCategory === 'All'
    ? SIGNALS
    : SIGNALS.filter(s => s.category === activeCategory);

  const alertCount = SIGNALS.filter(s => s.status === 'alert').length;

  return (
    <div className="space-y-4">
      {/* Panel header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Wifi className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-brand-primary)' }} />
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.28em]"
              style={{ fontFamily: '"IBM Plex Mono", monospace', color: 'var(--color-brand-primary)' }}
            >
              Macro Signal Monitor
            </span>
            <span
              className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase"
              style={{
                backgroundColor: 'rgba(34,211,238,0.12)',
                color: '#22d3ee',
                fontFamily: '"IBM Plex Mono", monospace',
                border: '1px solid rgba(34,211,238,0.2)',
              }}
            >
              Illustrative
            </span>
            {alertCount > 0 && (
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide"
                style={{
                  backgroundColor: 'rgba(239,68,68,0.12)',
                  color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.2)',
                  fontFamily: '"IBM Plex Mono", monospace',
                }}
              >
                {alertCount} ALERT
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-terminal" style={{ fontFamily: '"IBM Plex Mono", monospace' }}>
            Leading &amp; coincident indicators · connect live feed to replace illustrative values
          </p>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'px-2.5 py-1 rounded text-[10px] font-semibold tracking-wide transition-all',
                activeCategory === cat
                  ? 'text-white'
                  : 'text-muted-terminal hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5'
              )}
              style={{
                backgroundColor: activeCategory === cat ? 'var(--color-brand-primary)' : undefined,
                fontFamily: '"IBM Plex Mono", monospace',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Signal grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {filtered.map((signal, i) => (
          <SignalCard key={signal.id} signal={signal} index={i} />
        ))}
      </div>

      {/* Legend row */}
      <div
        className="flex flex-wrap gap-x-4 gap-y-2 pt-3 border-t"
        style={{ borderColor: 'var(--border)' }}
      >
        {(Object.entries(STATUS_CONFIG) as [SignalStatus, typeof STATUS_CONFIG[SignalStatus]][]).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
            <span
              className="text-[9px] capitalize text-muted-terminal"
              style={{ fontFamily: '"IBM Plex Mono", monospace' }}
            >
              {key}
            </span>
          </div>
        ))}
        <span className="text-[9px] text-muted-terminal ml-auto opacity-50" style={{ fontFamily: '"IBM Plex Mono", monospace' }}>
          SURP = actual minus consensus estimate
        </span>
      </div>
    </div>
  );
}
