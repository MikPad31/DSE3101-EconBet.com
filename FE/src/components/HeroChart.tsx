import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart
} from 'recharts';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { format, parseISO, getQuarter, getYear } from 'date-fns';
import { ForecastData } from '../types';
import { cn } from '../lib/utils';

interface HeroChartProps {
  data: ForecastData[];
  models: {
    ar: boolean;
    rf: boolean;
    adl: boolean;
    ensemble: boolean;
    showCI: boolean;
  };
  timeRange: [number, number];
  setTimeRange: (range: [number, number]) => void;
  onRangeButtonClick: (range: string) => void;
  activeRangeButton: string;
}

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
        <div className="p-3 rounded border shadow-lg" style={{ backgroundColor: 'var(--sidebar)', borderColor: 'var(--border)', color: 'var(--text)' }}>
          <p className="font-bold mb-2">{formatQuarter(label)}</p>
          {payload.map((entry: any, index: number) => {
            // Hide the CI Area from tooltip if we want, or format it properly
            if (entry.name === 'Confidence Interval') {
              return (
                <div key={index} className="flex items-center gap-2 text-sm mb-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                  <span className="font-medium">{entry.name}:</span>
                  <span>[{Number(entry.value[0]).toFixed(2)}%, {Number(entry.value[1]).toFixed(2)}%]</span>
                </div>
              );
            }
            return (
              <div key={index} className="flex items-center gap-2 text-sm mb-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
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

  const rangeButtons = ["1Y", "5Y", "10Y", "MAX"];

  return (
    <div className="p-4 rounded-lg border mb-6 transition-colors duration-300 flex flex-col"
         style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
         data-tour="tour-chart">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h5 className="font-bold text-lg">Real-Time GDP Growth Path</h5>
        <div className="flex gap-2">
          {rangeButtons.map(btn => (
            <button
              key={btn}
              onClick={() => onRangeButtonClick(btn)}
              className={cn(
                "px-3 py-1 text-sm font-medium rounded transition-colors",
                activeRangeButton === btn 
                  ? "bg-[var(--color-brand-primary)] text-white" 
                  : "hover:bg-[var(--color-brand-primary)] hover:text-white text-gray-500"
              )}
            >
              {btn}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Area */}
      <div className="w-full h-[500px] mb-8">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={slicedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatQuarter}
              stroke="var(--border)"
              tick={{ fill: 'var(--text)', fontSize: 12 }}
              dy={10}
            />
            <YAxis 
              stroke="var(--border)"
              tick={{ fill: 'var(--text)', fontSize: 12 }}
              tickFormatter={(tick) => `${tick}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />

            {models.showCI && (
              <Area 
                type="monotone" 
                dataKey="CI_Range"
                stroke="none" 
                fill="#808080" 
                fillOpacity={0.15} 
                name="Confidence Interval"
              />
            )}

            <Line 
              type="monotone" 
              dataKey="actual" 
              name="Official GDP" 
              stroke="#00bfff" 
              strokeWidth={3} 
              dot={{ r: 3, fill: '#00bfff', strokeWidth: 0 }} 
              activeDot={{ r: 6 }}
              connectNulls
            />

            {models.ar && (
              <Line type="monotone" dataKey="forecast_AR" name="AR Benchmark" stroke="#ff4757" strokeDasharray="5 5" dot={false} />
            )}
            {models.rf && (
              <Line type="monotone" dataKey="forecast_RF" name="Random Forest" stroke="#a55eea" strokeDasharray="3 3" dot={false} />
            )}
            {models.adl && (
              <Line type="monotone" dataKey="forecast_ADL" name="ADL Model" stroke="#ffa502" strokeDasharray="4 4" dot={false} />
            )}
            {models.ensemble && (
              <Line 
                type="monotone" 
                dataKey="forecast_Ensemble" 
                name="Combined Nowcast" 
                stroke="#2ed573" 
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 2, fill: '#2ed573' }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Range Slider */}
      <div className="px-4 pb-2">
        <Slider
          range
          min={minIndex}
          max={maxIndex}
          value={timeRange}
          onChange={(val) => setTimeRange(val as [number, number])}
          allowCross={false}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span>{data[timeRange[0]] ? formatQuarter(data[timeRange[0]].date) : ''}</span>
          <span>{data[timeRange[1]] ? formatQuarter(data[timeRange[1]].date) : ''}</span>
        </div>
      </div>
    </div>
  );
}
