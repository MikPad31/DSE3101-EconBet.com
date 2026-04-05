import React, { useMemo } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, ComposedChart } from 'recharts';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { parseISO, getQuarter, getYear } from 'date-fns';
import { ForecastData } from '../types';
import { cn } from '../lib/utils';

interface HeroChartProps {
  data: ForecastData[];
  models: { ar: boolean; rf: boolean; adl: boolean; ensemble: boolean; showCI: boolean };
  timeRange: [number, number];
  setTimeRange: (range: [number, number]) => void;
  onRangeButtonClick: (range: string) => void;
  activeRangeButton: string;
}

const OFFICIAL_CYAN = '#22d3ee';
const MODEL_MUTED = 0.5;
const TICK_FONT = '"IBM Plex Mono", ui-monospace, monospace';

export function HeroChart({ data, models, timeRange, setTimeRange, onRangeButtonClick, activeRangeButton }: HeroChartProps) {
  const minIndex = 0;
  const maxIndex = data.length > 0 ? data.length - 1 : 0;

  const slicedData = useMemo(() => {
    if (data.length === 0) return [];
    return data.slice(timeRange[0], timeRange[1] + 1).map(d => ({
      ...d,
      CI_Range: [d.CI_Lower, d.CI_Upper]
    }));
  }, [data, timeRange]);

  const formatQuarter = (dateStr: string) => {
    const date = parseISO(dateStr);
    return `${getYear(date)} Q${getQuarter(date)}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="terminal-card p-3 rounded-md"
          style={{ backgroundColor: 'var(--sidebar)', borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          <p className="font-bold mb-2 font-tabular-nums-mono">{formatQuarter(label)}</p>
          {payload.map((entry: any, index: number) => {
            if (entry.name === 'Confidence Interval') {
              return (
                <div key={index} className="flex items-center gap-2 text-sm mb-1 font-tabular-nums-mono">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="font-medium">{entry.name}:</span>
                  <span>[{Number(entry.value[0]).toFixed(2)}%, {Number(entry.value[1]).toFixed(2)}%]</span>
                </div>
              );
            }
            return (
              <div key={index} className="flex items-center gap-2 text-sm mb-1 font-tabular-nums-mono">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                <span className="font-medium">{entry.name}:</span>
                <span>{Number(entry.value).toFixed(2)}%</span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  const rangeButtons = ['1Y', '5Y', '10Y', 'MAX'];

  return (
    <div
      className="terminal-card terminal-card-hero p-5 rounded-lg mb-6 flex flex-col"
      style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-4">
        <div>
          <h5 className="font-bold text-lg tracking-tight">Real-Time GDP Growth Path</h5>
          <p className="text-xs text-muted-terminal mt-1">Official series vs model tracks · quarterly frequency</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {rangeButtons.map(btn => (
            <button
              key={btn}
              type="button"
              onClick={() => onRangeButtonClick(btn)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-all font-tabular-nums-mono',
                activeRangeButton === btn
                  ? 'bg-[var(--color-brand-primary)] text-white shadow-md'
                  : 'text-muted-terminal hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5'
              )}
            >
              {btn}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full h-[640px] mb-8 min-h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={slicedData} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 6" stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatQuarter}
              stroke="var(--border)"
              tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: TICK_FONT }}
              dy={10}
            />
            <YAxis
              stroke="var(--border)"
              tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: TICK_FONT }}
              tickFormatter={(tick) => `${tick}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: '16px' }} />

            {models.showCI && (
              <Area
                type="monotone"
                dataKey="CI_Range"
                stroke="none"
                fill="var(--color-brand-success)"
                fillOpacity={0.1}
                name="Confidence Interval"
              />
            )}

            <Line
              type="monotone"
              dataKey="actual"
              name="Official GDP"
              stroke={OFFICIAL_CYAN}
              strokeWidth={3.5}
              dot={{ r: 3.5, fill: OFFICIAL_CYAN, strokeWidth: 0 }}
              activeDot={{ r: 7, stroke: OFFICIAL_CYAN, strokeWidth: 2, fill: '#0c4a6e' }}
              connectNulls
            />

            {models.ar && (
              <Line
                type="monotone"
                dataKey="forecast_AR"
                name="AR Benchmark"
                stroke="#ff6b7a"
                strokeOpacity={MODEL_MUTED}
                strokeWidth={1.75}
                strokeDasharray="6 4"
                dot={false}
              />
            )}
            {models.rf && (
              <Line
                type="monotone"
                dataKey="forecast_RF"
                name="Random Forest"
                stroke="#b388f5"
                strokeOpacity={MODEL_MUTED}
                strokeWidth={1.75}
                strokeDasharray="2 4"
                dot={false}
              />
            )}
            {models.adl && (
              <Line
                type="monotone"
                dataKey="forecast_ADL"
                name="ADL Model"
                stroke="#fbbf24"
                strokeOpacity={MODEL_MUTED}
                strokeWidth={1.75}
                strokeDasharray="4 3"
                dot={false}
              />
            )}
            {models.ensemble && (
              <Line
                type="monotone"
                dataKey="forecast_Ensemble"
                name="Combined Nowcast"
                stroke="#4ade80"
                strokeOpacity={0.88}
                strokeWidth={2.25}
                strokeDasharray="6 4"
                dot={{ r: 2.5, fill: '#4ade80', strokeOpacity: 1 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="px-1 pb-1">
        <Slider
          range
          min={minIndex}
          max={maxIndex}
          value={timeRange}
          onChange={(val) => setTimeRange(val as [number, number])}
          allowCross={false}
        />
        <div className="flex justify-between text-xs text-muted-terminal mt-2 font-tabular-nums-mono">
          <span>{data[timeRange[0]] ? formatQuarter(data[timeRange[0]].date) : ''}</span>
          <span>{data[timeRange[1]] ? formatQuarter(data[timeRange[1]].date) : ''}</span>
        </div>
      </div>
    </div>
  );
}
