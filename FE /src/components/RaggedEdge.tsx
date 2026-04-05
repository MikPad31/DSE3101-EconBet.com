import React, { useState, useMemo } from 'react';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { cn } from '../lib/utils';

const RELEASE_SCHEDULE: Record<string, number> = {
  // Financials (Instant)
  BAA: 1, AAA: 1, GS10: 1, TB3MS: 1,
  // Jobs Report
  UNRATE: 7,
  // Mid-Month Data
  CPIAUSCL: 15, INDPRO: 15, HOUST: 15,
  // Late Anchors
  RPI: 28, INVEST: 28, GDPC1: 28
};

const MODEL_DEPENDENCIES: Record<string, string[]> = {
  AR: ['GDPC1'],
  ADL: Object.keys(RELEASE_SCHEDULE), // Needs everything
  RandomForest: ['BAA', 'AAA', 'GS10', 'TB3MS', 'UNRATE', 'INDPRO', 'INVEST', 'HOUST'],
  Ensemble: Object.keys(RELEASE_SCHEDULE) // Ensemble uses all models, so it depends on all features
};

const VARIABLES_INFO: Record<string, { name: string, category: string }> = {
  BAA: { name: 'Moody\'s Baa Corporate Bond Yield', category: 'Financials' },
  AAA: { name: 'Moody\'s Aaa Corporate Bond Yield', category: 'Financials' },
  GS10: { name: '10-Year Treasury Constant Maturity Rate', category: 'Financials' },
  TB3MS: { name: '3-Month Treasury Bill', category: 'Financials' },
  UNRATE: { name: 'Unemployment Rate', category: 'Labor Market' },
  CPIAUSCL: { name: 'Consumer Price Index', category: 'Inflation' },
  INDPRO: { name: 'Industrial Production', category: 'Production' },
  HOUST: { name: 'Housing Starts', category: 'Housing' },
  RPI: { name: 'Real Personal Income', category: 'Income' },
  INVEST: { name: 'Real Private Domestic Investment', category: 'Investment' },
  GDPC1: { name: 'Real Gross Domestic Product', category: 'National Accounts' }
};

export function RaggedEdge({ activeModels }: { activeModels: any }) {
  const [currentDay, setCurrentDay] = useState<number>(new Date().getDate());

  const { featureStatuses, modelHealth } = useMemo(() => {
    const statuses = Object.entries(RELEASE_SCHEDULE).reduce((acc, [feature, releaseDay]) => {
      acc[feature] = {
        isReady: currentDay >= releaseDay,
        expectedDay: releaseDay
      };
      return acc;
    }, {} as Record<string, { isReady: boolean, expectedDay: number }>);

    const health = Object.entries(MODEL_DEPENDENCIES).reduce((acc, [model, deps]) => {
      const readyCount = deps.filter(dep => statuses[dep].isReady).length;
      acc[model] = {
        score: Math.round((readyCount / deps.length) * 100),
        isActionable: readyCount === deps.length,
        readyCount,
        totalCount: deps.length
      };
      return acc;
    }, {} as Record<string, { score: number, isActionable: boolean, readyCount: number, totalCount: number }>);

    return { featureStatuses: statuses, modelHealth: health };
  }, [currentDay]);

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-lg border" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <h3 className="text-lg font-bold mb-2">Model Health & Ragged Edge</h3>
        <p className="text-sm text-gray-500 mb-6">
          Macroeconomic data arrives at different times throughout the month. Adjust the slider below to simulate the current day of the month and see how data availability impacts model readiness.
        </p>

        {/* Slider Section */}
        <div className="mb-8 px-2">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Current Day of the Month</span>
            <span className="text-xl font-bold text-[var(--color-brand-primary)]">Day {currentDay}</span>
          </div>
          <Slider
            min={1}
            max={31}
            value={currentDay}
            onChange={(val) => setCurrentDay(val as number)}
            marks={{
              1: '1st',
              7: '7th',
              15: '15th',
              28: '28th',
              31: '31st'
            }}
            step={1}
          />
        </div>

        {/* Top Section: Model Health Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { id: 'AR', name: 'AR Benchmark', active: activeModels.ar, color: '#ff4757' },
            { id: 'ADL', name: 'ADL Model', active: activeModels.adl, color: '#ffa502' },
            { id: 'RandomForest', name: 'Random Forest', active: activeModels.rf, color: '#a55eea' },
            { id: 'Ensemble', name: 'Combined Nowcast', active: activeModels.ensemble, color: '#2ed573' }
          ].map(model => {
            const health = modelHealth[model.id];
            return (
              <div key={model.id} className={cn("p-4 rounded-lg border transition-opacity", !model.active && "opacity-50")} style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}>
                <div className="flex justify-between items-start mb-2">
                  <h6 className="text-sm font-bold">{model.name}</h6>
                  {health.isActionable ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Clock className="w-5 h-5 text-orange-500" />
                  )}
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-bold">{health.score}%</span>
                  <span className="text-xs text-gray-500">Ready</span>
                </div>
                <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
                  <div 
                    className="h-full rounded-full transition-all duration-500" 
                    style={{ width: `${health.score}%`, backgroundColor: model.color }}
                  />
                </div>
                <div className="text-xs text-gray-500">
                  {health.readyCount} of {health.totalCount} required features available
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Bottom Section: Data Availability Table */}
        <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4">Data Availability Schedule</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-black/5 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Status</th>
                <th className="px-4 py-3">Variable</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Expected Release</th>
                <th className="px-4 py-3 rounded-tr-lg">Used In</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(RELEASE_SCHEDULE).sort((a, b) => a[1] - b[1]).map(([feature, releaseDay]) => {
                const info = VARIABLES_INFO[feature];
                const status = featureStatuses[feature];
                const usedIn = Object.entries(MODEL_DEPENDENCIES)
                  .filter(([model, deps]) => deps.includes(feature))
                  .map(([model]) => {
                    if (model === 'RandomForest') return 'RF';
                    if (model === 'Ensemble') return 'ENS';
                    return model;
                  });

                return (
                  <tr key={feature} className="border-b last:border-0 transition-colors" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-3">
                      {status.isReady ? (
                        <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium">
                          <CheckCircle2 className="w-4 h-4" /> Ready
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-medium">
                          <Clock className="w-4 h-4" /> Pending
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex flex-col">
                        <span>{feature}</span>
                        <span className="text-xs text-gray-500 font-normal">{info.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{info.category}</td>
                    <td className="px-4 py-3">
                      Day {releaseDay}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {usedIn.map(m => (
                          <span key={m} className="px-2 py-0.5 text-[10px] uppercase border rounded" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>{m}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

