import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, AlertTriangle } from 'lucide-react';

interface KPIRibbonProps {
  currentNowcast: number;
  prevNowcast: number;
  nextForecast: number;
  ciLower: number;
  ciUpper: number;
  anchorDate: string;
  tMinus1Date: string;
  tPlus1Date: string;
  tPlus2Date: string;
}

// Simple approximation for normal CDF
function normalCDF(x: number, mean: number, std: number) {
  const z = (x - mean) / std;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

import { formatQuarter } from '../App';

function formatVal(val: any) {
  if (typeof val === 'number' && !isNaN(val)) return val.toFixed(2);
  return 'N/A';
}

function formatVal1(val: any) {
  if (typeof val === 'number' && !isNaN(val)) return val.toFixed(1);
  return 'N/A';
}

export function KPIRibbon({ currentNowcast, prevNowcast, nextForecast, ciLower, ciUpper, anchorDate, tMinus1Date, tPlus1Date, tPlus2Date }: KPIRibbonProps) {
  const delta = currentNowcast - prevNowcast;
  const isPositive = currentNowcast > 0;
  
  // Calculate Recession Risk
  // 95% CI is roughly mean +/- 1.96 * std
  const std = (ciUpper - ciLower) / (2 * 1.96);
  const recessionRisk = std > 0 ? normalCDF(0, currentNowcast, std) * 100 : (currentNowcast < 0 ? 100 : 0);
  
  const riskColor = recessionRisk > 50 ? '#e74c3c' : (recessionRisk >= 20 ? 'var(--color-brand-warning)' : 'var(--color-brand-success)');
  const riskBgColor = recessionRisk > 50 ? 'rgba(231, 76, 60, 0.1)' : (recessionRisk >= 20 ? 'rgba(243, 156, 18, 0.1)' : 'rgba(92, 184, 92, 0.1)');
  const riskText = recessionRisk > 50 ? 'High risk' : (recessionRisk >= 20 ? 'Moderate risk' : 'Safe');

  // Certainty Bracket
  const ciWidth = ciUpper - ciLower;
  let consensusText = "Moderate";
  let consensusColor = "var(--color-brand-warning)"; // Yellow
  let consensusBgColor = "rgba(243, 156, 18, 0.1)";
  
  if (ciWidth < 3) {
    consensusText = "High";
    consensusColor = "var(--color-brand-success)"; // Green
    consensusBgColor = "rgba(92, 184, 92, 0.1)";
  } else if (ciWidth > 6) {
    consensusText = "Low";
    consensusColor = "#e74c3c"; // Red
    consensusBgColor = "rgba(231, 76, 60, 0.1)";
  }

  const nextQtrDelta = nextForecast - currentNowcast;
  const nextQtrDeltaText = nextQtrDelta > 0 ? `Expected to rise by +${formatVal(nextQtrDelta)}pp` : (nextQtrDelta < 0 ? `Expected to fall by ${formatVal(nextQtrDelta)}pp` : 'Expected to remain flat');
  const nextQtrColor = nextQtrDelta > 0 ? 'var(--color-brand-success)' : (nextQtrDelta < 0 ? 'var(--color-brand-warning)' : 'var(--text)');
  const nextQtrBgColor = nextQtrDelta > 0 ? 'rgba(92, 184, 92, 0.1)' : (nextQtrDelta < 0 ? 'rgba(243, 156, 18, 0.1)' : 'rgba(128, 128, 128, 0.1)');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-tour="tour-kpi">
      {/* Card 1: Combined Nowcast */}
      <div className="p-4 rounded-lg border transition-colors duration-300 flex flex-col justify-between"
           style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <h6 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Combined Nowcast ({formatQuarter(tPlus1Date)})</h6>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold" style={{ color: isPositive ? 'var(--color-brand-success)' : 'var(--color-brand-warning)' }}>
            {formatVal(currentNowcast)}%
          </span>
        </div>
        <div className="flex items-center mt-2 text-xs font-medium px-2 py-1 rounded-full w-fit" 
             style={{ backgroundColor: delta > 0 ? 'rgba(92, 184, 92, 0.1)' : 'rgba(243, 156, 18, 0.1)', color: delta > 0 ? 'var(--color-brand-success)' : 'var(--color-brand-warning)' }}>
          {delta > 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : 
           delta < 0 ? <ArrowDownRight className="w-3 h-3 mr-1" /> :
           <Minus className="w-3 h-3 mr-1" />}
          <span>{delta > 0 ? '+' : ''}{formatVal(delta)}pp vs prior quarter ({formatQuarter(anchorDate)})</span>
        </div>
      </div>

      {/* Card 2: Recession Risk */}
      <div className="p-4 rounded-lg border transition-colors duration-300 flex flex-col justify-between"
           style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <h6 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recession Risk (P(GDP&lt;0))</h6>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold" style={{ color: 'var(--text)' }}>
            {formatVal1(recessionRisk)}%
          </span>
        </div>
        <div className="flex items-center mt-2 text-xs font-medium px-2 py-1 rounded-full w-fit"
             style={{ backgroundColor: riskBgColor, color: riskColor }}>
          <AlertTriangle className="w-3 h-3 mr-1" />
          <span>{riskText}</span>
        </div>
      </div>

      {/* Card 3: Next Quarter Forecast */}
      <div className="p-4 rounded-lg border transition-colors duration-300 flex flex-col justify-between"
           style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <h6 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Next Quarter Forecast ({formatQuarter(tPlus2Date)})</h6>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold" style={{ color: 'var(--text)' }}>
            {formatVal(nextForecast)}%
          </span>
        </div>
        <div className="flex items-center mt-2 text-xs font-medium px-2 py-1 rounded-full w-fit"
             style={{ backgroundColor: nextQtrBgColor, color: nextQtrColor }}>
          {nextQtrDelta > 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : 
           nextQtrDelta < 0 ? <ArrowDownRight className="w-3 h-3 mr-1" /> :
           <Minus className="w-3 h-3 mr-1" />}
          <span>{nextQtrDeltaText}</span>
        </div>
      </div>

      {/* Card 4: Certainty Bracket */}
      <div className="p-4 rounded-lg border transition-colors duration-300 flex flex-col justify-between"
           style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <h6 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Certainty Bracket</h6>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            [{formatVal1(ciLower)}%, {formatVal1(ciUpper)}%]
          </span>
        </div>
        <div className="flex items-center mt-2 text-xs font-medium px-2 py-1 rounded-full w-fit"
             style={{ backgroundColor: consensusBgColor, color: consensusColor }}>
          <span>Model Consensus: {consensusText}</span>
        </div>
      </div>
    </div>
  );
}
