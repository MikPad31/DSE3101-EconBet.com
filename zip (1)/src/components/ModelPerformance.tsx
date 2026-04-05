import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Target, TrendingUp } from 'lucide-react';
import { PerformanceData } from '../types';

const MODEL_COLORS: Record<string, string> = {
  AR:       '#e74c3c',
  ADL:      '#f1c40f',
  RF:       '#9b59b6',
  Ensemble: 'var(--color-brand-success)',
};

const MONO = '"IBM Plex Mono", monospace';

export function ModelPerformance() {
  const [data, setData] = useState<PerformanceData[]>([]);

  useEffect(() => {
    Papa.parse('/performance.csv', {
      download: true,
      header: true,
      dynamicTyping: true,
      complete: (results) => {
        setData(results.data.filter((d: any) => d.Model) as PerformanceData[]);
      },
    });
  }, []);

  if (data.length === 0) {
    return (
      <div className="p-8 text-center text-muted-terminal" style={{ fontFamily: MONO }}>
        Loading performance data...
      </div>
    );
  }

  // Identify leaders per metric
  const bestRMSFE = [...data].sort((a, b) => a.RMSFE - b.RMSFE)[0];
  const bestDir   = [...data].sort((a, b) => b.Directional_Accuracy - a.Directional_Accuracy)[0];

  const rmsfeColor = MODEL_COLORS[bestRMSFE?.Model] ?? 'var(--color-brand-primary)';
  const dirColor   = MODEL_COLORS[bestDir?.Model]   ?? 'var(--color-brand-primary)';

  return (
    <div className="space-y-5">

      {/* ── Summary callout — two separate metric leaders ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* Point accuracy winner */}
        <div
          className="terminal-card flex items-start gap-3 p-4 border-l-[3px]"
          style={{ borderLeftColor: rmsfeColor, backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
            style={{ backgroundColor: `${rmsfeColor}22` }}
          >
            <Target className="w-3.5 h-3.5" style={{ color: rmsfeColor }} />
          </div>
          <div className="min-w-0">
            <p
              className="text-[9px] font-semibold uppercase tracking-[0.2em] mb-1"
              style={{ fontFamily: MONO, color: rmsfeColor }}
            >
              Lowest forecast error
            </p>
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {bestRMSFE?.Model}
              <span className="font-normal text-muted-terminal"> · RMSFE </span>
              <span style={{ fontFamily: MONO, color: rmsfeColor }}>{bestRMSFE?.RMSFE.toFixed(3)}</span>
            </p>
            <p className="text-[10px] text-muted-terminal mt-0.5" style={{ fontFamily: MONO }}>
              Best point accuracy across all models
            </p>
          </div>
        </div>

        {/* Directional accuracy winner */}
        <div
          className="terminal-card flex items-start gap-3 p-4 border-l-[3px]"
          style={{ borderLeftColor: dirColor, backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <div
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
            style={{ backgroundColor: `${dirColor}22` }}
          >
            <TrendingUp className="w-3.5 h-3.5" style={{ color: dirColor }} />
          </div>
          <div className="min-w-0">
            <p
              className="text-[9px] font-semibold uppercase tracking-[0.2em] mb-1"
              style={{ fontFamily: MONO, color: dirColor }}
            >
              Best directional accuracy
            </p>
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {bestDir?.Model}
              <span className="font-normal text-muted-terminal"> · Hit Rate </span>
              <span style={{ fontFamily: MONO, color: dirColor }}>
                {((bestDir?.Directional_Accuracy ?? 0) * 100).toFixed(1)}%
              </span>
            </p>
            <p className="text-[10px] text-muted-terminal mt-0.5" style={{ fontFamily: MONO }}>
              Deployed as headline nowcast model
            </p>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── RMSFE Bar Chart (unchanged) ── */}
        <div
          className="terminal-card p-5"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-0.5"
            style={{ fontFamily: MONO, color: 'var(--color-brand-primary)' }}
          >
            Forecast Error (RMSFE)
          </p>
          <p className="text-[10px] text-muted-terminal mb-5" style={{ fontFamily: MONO }}>
            Lower = better fit · bar labels show inverse-RMSFE ensemble weight
          </p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 4, right: 32, left: 20, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                <XAxis
                  type="number"
                  stroke="var(--border)"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: MONO }}
                />
                <YAxis
                  dataKey="Model"
                  type="category"
                  stroke="var(--border)"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: MONO }}
                  width={72}
                />
                <Tooltip
                  cursor={{ fill: 'var(--border)', opacity: 0.3 }}
                  contentStyle={{
                    backgroundColor: 'var(--sidebar)',
                    borderColor: 'var(--border)',
                    color: 'var(--text)',
                    fontFamily: MONO,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [v.toFixed(3), 'RMSFE']}
                />
                <Bar dataKey="RMSFE" radius={[0, 4, 4, 0]}>
                  {data.map((entry) => (
                    <Cell
                      key={entry.Model}
                      fill={MODEL_COLORS[entry.Model] ?? 'var(--color-brand-primary)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Directional Accuracy — progress bars ── */}
        <div
          className="terminal-card p-5"
          style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-0.5"
            style={{ fontFamily: MONO, color: 'var(--color-brand-primary)' }}
          >
            Directional Accuracy
          </p>
          <p className="text-[10px] text-muted-terminal mb-5" style={{ fontFamily: MONO }}>
            Hit rate on predicting GDP direction of change · 50% = coin-flip baseline
          </p>

          <div className="space-y-5">
            {data.map((model) => {
              const pct  = model.Directional_Accuracy * 100;
              const vs   = pct - 50;
              const color = MODEL_COLORS[model.Model] ?? 'var(--color-brand-primary)';
              const isLeader = model.Model === bestDir.Model;

              return (
                <div key={model.Model}>
                  {/* Label row */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span
                        className="text-sm font-medium"
                        style={{ color: 'var(--text)' }}
                      >
                        {model.Model}
                      </span>
                      {isLeader && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                          style={{
                            backgroundColor: 'rgba(92,184,92,0.12)',
                            color: 'var(--color-brand-success)',
                            fontFamily: MONO,
                          }}
                        >
                          BEST
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-semibold"
                        style={{ color, fontFamily: MONO }}
                      >
                        {pct.toFixed(1)}%
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: vs >= 0 ? 'rgba(92,184,92,0.10)' : 'rgba(231,76,60,0.10)',
                          color: vs >= 0 ? 'var(--color-brand-success)' : '#e74c3c',
                          fontFamily: MONO,
                        }}
                      >
                        {vs >= 0 ? '+' : ''}{vs.toFixed(1)}pp
                      </span>
                    </div>
                  </div>

                  {/* Bar track */}
                  <div
                    className="relative w-full h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--border) 80%, transparent)' }}
                  >
                    {/* Fill */}
                    <div
                      className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: color,
                        opacity: 0.85,
                      }}
                    />
                    {/* 50% baseline marker */}
                    <div
                      className="absolute top-0 bottom-0 w-px"
                      style={{ left: '50%', backgroundColor: 'var(--text)', opacity: 0.4 }}
                    />
                  </div>

                  {/* Baseline label (only on last item to avoid repetition) */}
                  {model === data[data.length - 1] && (
                    <div className="relative mt-0.5">
                      <span
                        className="absolute text-[8px] text-muted-terminal opacity-50"
                        style={{ left: 'calc(50% - 16px)', fontFamily: MONO }}
                      >
                        50% baseline
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
