import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ForwardOutlookProps {
  t0Actual: number;
  currentNowcast: number;
  nextForecast: number;   // kept for API compat (= currentNowcast in App)
  t2Forecast: number;
  recessionRisk: number;
  ciLower: number;
  ciUpper: number;
  isDarkMode?: boolean;
}

// ── Growth regime ─────────────────────────────────────────────────────────────

function getRegime(v: number) {
  if (v >= 3)   return { label: 'Strong Expansion', color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.30)' };
  if (v >= 1.5) return { label: 'Expansion',        color: '#10b981', bg: 'rgba(16,185,129,0.09)',  border: 'rgba(16,185,129,0.22)' };
  if (v >= 0)   return { label: 'Moderate Growth',  color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)' };
  return         { label: 'Contraction',             color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.25)'  };
}

// ── Forward trajectory components ────────────────────────────────────────────

interface NodeProps {
  horizon: string;
  sublabel: string;
  value: number;
  isAnchor?: boolean;
  isNowcast?: boolean;
  ciLower?: number;
  ciUpper?: number;
  regime?: ReturnType<typeof getRegime>;
}

const MONO = '"IBM Plex Mono", monospace';

function TrajectoryNode({ horizon, sublabel, value, isAnchor, isNowcast, ciLower, ciUpper, regime }: NodeProps) {
  const dotColor  = isNowcast && regime ? regime.color : isAnchor ? '#22d3ee' : '#64748b';
  const valueColor = isNowcast && regime ? regime.color : 'var(--text)';

  return (
    <div className="flex flex-col items-center gap-0.5 relative z-10">
      <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-terminal" style={{ fontFamily: MONO }}>
        {horizon}
      </span>
      <span className="text-[9px] text-muted-terminal opacity-55 mb-2" style={{ fontFamily: MONO }}>
        {sublabel}
      </span>

      <div
        className="w-3.5 h-3.5 rounded-full border-2 transition-all duration-500"
        style={{
          borderColor: dotColor,
          backgroundColor: isNowcast ? dotColor : isAnchor ? dotColor : 'var(--bg)',
          boxShadow: isNowcast ? `0 0 12px ${dotColor}55` : 'none',
        }}
      />

      <span className="text-[22px] font-semibold mt-2 leading-none" style={{ color: valueColor, fontFamily: MONO }}>
        {value.toFixed(2)}%
      </span>

      {isNowcast && regime && (
        <span
          className="mt-1.5 px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wide border"
          style={{ backgroundColor: regime.bg, color: regime.color, borderColor: regime.border, fontFamily: MONO }}
        >
          {regime.label}
        </span>
      )}

      {isNowcast && ciLower !== undefined && ciUpper !== undefined && (
        <div className="flex flex-col items-center gap-0.5 mt-2">
          <div className="w-px h-2.5" style={{ backgroundColor: dotColor, opacity: 0.35 }} />
          <span className="text-[9px] text-muted-terminal opacity-60" style={{ fontFamily: MONO }}>95% CI</span>
          <span className="text-[10px] text-muted-terminal whitespace-nowrap" style={{ fontFamily: MONO }}>
            [{ciLower.toFixed(1)}%, {ciUpper.toFixed(1)}%]
          </span>
        </div>
      )}
    </div>
  );
}

function Connector({ delta }: { delta: number }) {
  const up   = delta > 0;
  const flat = Math.abs(delta) < 0.05;
  const color = flat ? '#64748b' : up ? '#10b981' : '#ef4444';
  const Icon  = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-1 pb-10 min-w-0">
      <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
      <span className="text-[9px] font-medium whitespace-nowrap" style={{ color, fontFamily: MONO }}>
        {up ? '+' : ''}{delta.toFixed(2)}pp
      </span>
      <div className="w-full mt-1" style={{ borderTop: `1px dashed ${color}`, opacity: 0.35 }} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ForwardOutlook({
  t0Actual,
  currentNowcast,
  t2Forecast,
  recessionRisk,
  ciLower,
  ciUpper,
  isDarkMode = true,
}: ForwardOutlookProps) {
  const safeRisk = Math.min(Math.max(recessionRisk, 0), 100);
  const regime   = getRegime(currentNowcast);

  // ── Gauge needle calculation (original) ──
  const needleWidth = 1;
  let leftValue  = safeRisk - needleWidth / 2;
  let rightValue = 100 - safeRisk - needleWidth / 2;
  if (leftValue < 0)  { rightValue += leftValue;  leftValue  = 0; }
  if (rightValue < 0) { leftValue  += rightValue; rightValue = 0; }
  const needleData = [{ value: leftValue }, { value: needleWidth }, { value: rightValue }];

  const renderLabel = (props: any) => {
    const { cx, cy, outerRadius, startAngle, endAngle, index } = props;
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 15;
    const x    = cx + radius * Math.cos(-startAngle * RADIAN);
    const y    = cy + radius * Math.sin(-startAngle * RADIAN);
    const endX = cx + radius * Math.cos(-endAngle   * RADIAN);
    const endY = cy + radius * Math.sin(-endAngle   * RADIAN);
    const value = index * 20;
    return (
      <g>
        <text x={x} y={y} fill="#6b7280" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold">
          {value}%
        </text>
        {index === 4 && (
          <text x={endX} y={endY} fill="#6b7280" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold">
            100%
          </text>
        )}
      </g>
    );
  };

  const diff      = safeRisk - 15;
  const diffText  = diff > 0 ? `▲${diff.toFixed(0)}pp vs 15% threshold` : `▼${Math.abs(diff).toFixed(0)}pp vs 15% threshold`;
  const diffColor = diff > 0 ? '#ff4757' : '#2ed573';

  const t1t0Delta = currentNowcast - t0Actual;
  const t2t1Delta = t2Forecast - currentNowcast;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Recession Risk Gauge (original PieChart) ── */}
        <div
          className="terminal-card p-4 lg:col-span-1 flex flex-col"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <h6 className="text-sm font-bold uppercase tracking-wider mb-1" style={{ color: '#5dade2' }}>
            Recession Risk Gauge
          </h6>
          <p className="text-xs text-gray-500 mb-4">
            P(GDP &lt; 0) derived from 95% CI assuming a normal forecast distribution.
          </p>

          <div className="flex-1 relative min-h-[220px] flex items-end justify-center pb-4">
            <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  {/* Layer 0: Labels */}
                  <Pie
                    data={[{value:20},{value:20},{value:20},{value:20},{value:20}]}
                    cx="50%" cy="80%" startAngle={180} endAngle={0}
                    innerRadius="80%" outerRadius="80%"
                    stroke="none" dataKey="value"
                    labelLine={false} label={renderLabel}
                    isAnimationActive={false}
                  >
                    {[0,1,2,3,4].map((_,i) => <Cell key={i} fill="transparent" />)}
                  </Pie>

                  {/* Layer 1: Background track */}
                  <Pie
                    data={[{value:20},{value:20},{value:60}]}
                    cx="50%" cy="80%" startAngle={180} endAngle={0}
                    innerRadius="60%" outerRadius="80%"
                    stroke="none" dataKey="value"
                    isAnimationActive={false}
                  >
                    <Cell fill={isDarkMode ? '#1a362a' : '#dcfce7'} />
                    <Cell fill={isDarkMode ? '#3d331a' : '#fef08a'} />
                    <Cell fill={isDarkMode ? '#3d1f24' : '#fee2e2'} />
                  </Pie>

                  {/* Layer 2: Foreground fill */}
                  <Pie
                    data={[{value: safeRisk},{value: 100 - safeRisk}]}
                    cx="50%" cy="80%" startAngle={180} endAngle={0}
                    innerRadius="65%" outerRadius="75%"
                    stroke="none" dataKey="value"
                    isAnimationActive
                  >
                    <Cell fill="#ffa502" />
                    <Cell fill="transparent" />
                  </Pie>

                  {/* Layer 3: Needle */}
                  <Pie
                    data={needleData}
                    cx="50%" cy="80%" startAngle={180} endAngle={0}
                    innerRadius="55%" outerRadius="85%"
                    stroke="none" dataKey="value"
                    isAnimationActive
                  >
                    <Cell fill="transparent" />
                    <Cell fill={isDarkMode ? '#ffffff' : '#1f2937'} />
                    <Cell fill="transparent" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="text-center z-10 mb-2">
              <div className="text-4xl font-bold" style={{ color: '#ffa502' }}>
                {safeRisk.toFixed(0)}%
              </div>
              <div className="flex items-center justify-center mt-1 text-sm font-medium" style={{ color: diffColor }}>
                {diffText}
              </div>
            </div>
          </div>
        </div>

        {/* ── Forward Trajectory ── */}
        <div
          className="terminal-card p-5 lg:col-span-2 flex flex-col"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div className="mb-5">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-0.5"
              style={{ fontFamily: MONO, color: 'var(--color-brand-primary)' }}
            >
              Forward Trajectory
            </p>
            <p className="text-[10px] text-muted-terminal" style={{ fontFamily: MONO }}>
              Ensemble estimates across current and upcoming quarters
            </p>
          </div>

          <div className="flex items-start justify-between gap-0 flex-1">
            <TrajectoryNode
              horizon="t₀"
              sublabel="Last Official"
              value={t0Actual}
              isAnchor
            />
            <Connector delta={t1t0Delta} />
            <TrajectoryNode
              horizon="t₁"
              sublabel="Nowcast"
              value={currentNowcast}
              isNowcast
              ciLower={ciLower}
              ciUpper={ciUpper}
              regime={regime}
            />
            <Connector delta={t2t1Delta} />
            <TrajectoryNode
              horizon="t₂"
              sublabel="Forecast"
              value={t2Forecast}
            />
          </div>

          <p
            className="text-[9px] text-muted-terminal mt-4 pt-3 border-t opacity-60"
            style={{ borderColor: 'var(--border)', fontFamily: MONO }}
          >
            t₀ = last published official GDP · t₁ = current quarter ensemble nowcast · t₂ = next quarter forward forecast
          </p>
        </div>

      </div>
    </div>
  );
}
