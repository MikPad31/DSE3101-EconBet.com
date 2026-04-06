import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion } from 'motion/react';
import { PerformanceData } from '../types';

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

  if (data.length === 0) return <div className="p-8 text-center text-gray-500">Loading performance data...</div>;

  const colors = {
    AR: '#e74c3c',
    ADL: '#f1c40f',
    RF: '#9b59b6',
    Ensemble: 'var(--color-brand-success)'
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RMSFE Chart */}
        <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <h6 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Forecast Error (RMSFE)</h6>
          <p className="text-xs text-gray-500 mb-6">Lower RMSFE = better fit. Bar labels show inverse-RMSFE ensemble weight.</p>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                <XAxis type="number" stroke="var(--border)" tick={{ fill: 'var(--text)', fontSize: 12 }} />
                <YAxis dataKey="Model" type="category" stroke="var(--border)" tick={{ fill: 'var(--text)', fontSize: 12 }} width={80} />
                <Tooltip 
                  cursor={{ fill: 'var(--border)', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: 'var(--sidebar)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  itemStyle={{ color: 'var(--text)' }}
                />
                <Bar dataKey="RMSFE" radius={[0, 4, 4, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[entry.Model as keyof typeof colors] || 'var(--color-brand-primary)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Directional Accuracy */}
        <div className="p-4 rounded-lg border flex flex-col" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <h6 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Directional Accuracy</h6>
          <p className="text-xs text-gray-500 mb-6">Hit rate on predicting GDP direction of change. Baseline: 50% (coin flip).</p>
          
          <div className="flex-1 flex flex-col justify-center space-y-6">
            {data.map((model) => {
              const accuracy = model.Directional_Accuracy * 100;
              const vsBaseline = accuracy - 50;
              const color = colors[model.Model as keyof typeof colors] || 'var(--color-brand-primary)';
              return (
                <div key={model.Model} className="flex flex-col gap-2">
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-medium text-gray-400">{model.Model}</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold">{accuracy.toFixed(1)}%</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ 
                              backgroundColor: vsBaseline > 0 ? 'rgba(92, 184, 92, 0.1)' : 'rgba(231, 76, 60, 0.1)', 
                              color: vsBaseline > 0 ? 'var(--color-brand-success)' : '#e74c3c' 
                            }}>
                        {vsBaseline > 0 ? '+' : ''}{vsBaseline.toFixed(1)}pp
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden relative">
                    {/* 50% baseline marker */}
                    <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gray-400 dark:bg-gray-500 z-10" />
                    <motion.div 
                      className="h-full rounded-full"
                      style={{ backgroundColor: color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${accuracy}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
