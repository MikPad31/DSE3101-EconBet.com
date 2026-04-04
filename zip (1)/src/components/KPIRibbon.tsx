import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, AlertTriangle } from 'lucide-react';

interface KPIRibbonProps {
  currentNowcast: number;
  prevNowcast: number;
  nextForecast: number;
  ciLower: number;
  ciUpper: number;
}

// Simple approximation for normal CDF
function normalCDF(x: number, mean: number, std: number) {
  const z = (x - mean) / std;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

export function KPIRibbon({ currentNowcast, prevNowcast, nextForecast, ciLower, ciUpper }: KPIRibbonProps) {
  const delta = currentNowcast - prevNowcast;
  const isPositive = currentNowcast > 0;
  
  // Calculate Recession Risk
  // 95% CI is roughly mean +/- 1.96 * std
  const std = (ciUpper - ciLower) / (2 * 1.96);
  const recessionRisk = std > 0 ? normalCDF(0, currentNowcast, std) * 100 : (currentNowcast < 0 ? 100 : 0);
  
  const riskColor = recessionRisk > 30 ? 'var(--color-brand-warning)' : (recessionRisk > 50 ? '#e74c3c' : 'var(--color-brand-success)');

  // Certainty Bracket
  const ciWidth = ciUpper - ciLower;
  let consensusText = "Moderate";
  let consensusColor = "var(--color-brand-warning)"; // Yellow
  
  if (ciWidth < 3) {
    consensusText = "High";
    consensusColor = "var(--color-brand-success)"; // Green
  } else if (ciWidth > 6) {
    consensusText = "Low";
    consensusColor = "#e74c3c"; // Red
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Card 1: Combined Nowcast */}
      <div className="p-4 rounded-lg border transition-colors duration-300 flex flex-col justify-between"
           style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <h6 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Combined Nowcast</h6>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold" style={{ color: isPositive ? 'var(--color-brand-success)' : 'var(--color-brand-warning)' }}>
            {currentNowcast.toFixed(2)}%
          </span>
        </div>
        <div className="flex items-center mt-2 text-xs font-medium px-2 py-1 rounded-full w-fit" 
             style={{ backgroundColor: delta > 0 ? 'rgba(92, 184, 92, 0.1)' : 'rgba(243, 156, 18, 0.1)', color: delta > 0 ? 'var(--color-brand-success)' : 'var(--color-brand-warning)' }}>
          {delta > 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : 
           delta < 0 ? <ArrowDownRight className="w-3 h-3 mr-1" /> :
           <Minus className="w-3 h-3 mr-1" />}
          <span>{delta > 0 ? '+' : ''}{delta.toFixed(2)}pp vs prior quarter</span>
        </div>
      </div>

      {/* Card 2: Recession Risk */}
      <div className="p-4 rounded-lg border transition-colors duration-300 flex flex-col justify-between"
           style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <h6 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recession Risk (P(GDP&lt;0))</h6>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold" style={{ color: 'var(--text)' }}>
            {recessionRisk.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center mt-2 text-xs font-medium px-2 py-1 rounded-full w-fit"
             style={{ backgroundColor: recessionRisk > 30 ? 'rgba(231, 76, 60, 0.1)' : 'rgba(92, 184, 92, 0.1)', color: riskColor }}>
          <AlertTriangle className="w-3 h-3 mr-1" />
          <span>{recessionRisk > 50 ? 'High risk' : recessionRisk > 30 ? 'Moderate risk' : 'Low risk'}</span>
        </div>
      </div>

      {/* Card 3: Next Quarter Forecast */}
      <div className="p-4 rounded-lg border transition-colors duration-300 flex flex-col justify-between"
           style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <h6 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Next Quarter Forecast (T+1)</h6>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold" style={{ color: 'var(--text)' }}>
            {nextForecast.toFixed(2)}%
          </span>
        </div>
        <div className="flex items-center mt-2 text-xs text-gray-500">
          <span>Forward Guidance</span>
        </div>
      </div>

      {/* Card 4: Certainty Bracket */}
      <div className="p-4 rounded-lg border transition-colors duration-300 flex flex-col justify-between"
           style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <h6 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Certainty Bracket</h6>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            [{ciLower.toFixed(1)}%, {ciUpper.toFixed(1)}%]
          </span>
        </div>
        <div className="flex items-center mt-2 text-xs font-medium">
          <span className="text-gray-500 mr-2">Model Consensus:</span>
          <span style={{ color: consensusColor }}>{consensusText}</span>
        </div>
      </div>
    </div>
  );
}
