import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { normalCDF } from '../lib/stats';

interface KPIRibbonProps {
  currentNowcast: number;
  prevNowcast: number;
  nextForecast: number;
  ciLower: number;
  ciUpper: number;
  /** Explains whether KPIs are live headline vs end of preset scenario window */
  scopeNote?: string;
}

export function KPIRibbon({ currentNowcast, prevNowcast, nextForecast, ciLower, ciUpper, scopeNote }: KPIRibbonProps) {
  const delta = currentNowcast - prevNowcast;
  const isPositive = currentNowcast > 0;

  const std = (ciUpper - ciLower) / (2 * 1.96);
  const recessionRisk = std > 0 ? normalCDF(0, currentNowcast, std) * 100 : (currentNowcast < 0 ? 100 : 0);

  const riskColor = recessionRisk > 50 ? '#e74c3c' : recessionRisk > 30 ? 'var(--color-brand-warning)' : 'var(--color-brand-success)';

  const ciWidth = ciUpper - ciLower;
  let consensusText = 'Moderate';
  let consensusColor = 'var(--color-brand-warning)';

  if (ciWidth < 3) {
    consensusText = 'High';
    consensusColor = 'var(--color-brand-success)';
  } else if (ciWidth > 6) {
    consensusText = 'Low';
    consensusColor = '#e74c3c';
  }

  return (
    <div className="mb-6">
      {scopeNote ? (
        <p
          className="text-[10px] font-medium text-muted-terminal mb-2 tracking-wide"
          style={{ fontFamily: '"IBM Plex Mono", ui-monospace, monospace' }}
        >
          {scopeNote}
        </p>
      ) : null}
      <p className="text-[9px] leading-snug text-muted-terminal mb-3 max-w-4xl">
        Units: quarterly real GDP <strong className="text-[var(--text)] font-medium">growth rate</strong> (approx. annualized % vs prior quarter)
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div
        className={cn('terminal-card p-5 flex flex-col justify-between min-h-[148px] border-l-[3px]')}
        style={{ borderLeftColor: '#14b8a6', backgroundColor: 'var(--card)' }}
      >
        <h6 className="text-[11px] font-semibold uppercase tracking-wider text-muted-terminal mb-0.5">
          Combined Nowcast
        </h6>
        <p className="text-[9px] text-muted-terminal mb-2 font-tabular-nums-mono">Ensemble · growth rate</p>
        <div className="flex items-baseline gap-2">
          <span
            className="text-4xl font-semibold font-tabular-nums-mono tracking-tight"
            style={{ color: isPositive ? 'var(--color-brand-success)' : 'var(--color-brand-warning)' }}
          >
            {currentNowcast.toFixed(2)}%
          </span>
        </div>
        <div
          className="flex items-center mt-3 text-xs font-medium px-2 py-1 rounded-full w-fit font-tabular-nums-mono"
          style={{
            backgroundColor: delta > 0 ? 'rgba(92, 184, 92, 0.12)' : 'rgba(243, 156, 18, 0.12)',
            color: delta > 0 ? 'var(--color-brand-success)' : 'var(--color-brand-warning)',
          }}
        >
          {delta > 0 ? <ArrowUpRight className="w-3 h-3 mr-1 shrink-0" /> :
           delta < 0 ? <ArrowDownRight className="w-3 h-3 mr-1 shrink-0" /> :
           <Minus className="w-3 h-3 mr-1 shrink-0" />}
          <span>{delta > 0 ? '+' : ''}{delta.toFixed(2)}pp vs prior quarter</span>
        </div>
      </div>

      <div
        className="terminal-card p-5 flex flex-col justify-between min-h-[148px] border-l-[3px]"
        style={{ borderLeftColor: '#f59e0b', backgroundColor: 'var(--card)' }}
      >
        <h6 className="text-[11px] font-semibold uppercase tracking-wider text-muted-terminal mb-2">
          Recession Risk (P(GDP&lt;0))
        </h6>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold font-tabular-nums-mono tracking-tight" style={{ color: 'var(--text)' }}>
            {recessionRisk.toFixed(1)}%
          </span>
        </div>
        <div
          className="flex items-center mt-3 text-xs font-medium px-2 py-1 rounded-full w-fit"
          style={{
            backgroundColor: recessionRisk > 30 ? 'rgba(231, 76, 60, 0.12)' : 'rgba(92, 184, 92, 0.12)',
            color: riskColor,
          }}
        >
          <AlertTriangle className="w-3 h-3 mr-1 shrink-0" />
          <span>{recessionRisk > 50 ? 'High risk' : recessionRisk > 30 ? 'Moderate risk' : 'Low risk'}</span>
        </div>
      </div>

      <div
        className="terminal-card p-5 flex flex-col justify-between min-h-[148px] border-l-[3px]"
        style={{ borderLeftColor: '#3b82f6', backgroundColor: 'var(--card)' }}
      >
        <h6 className="text-[11px] font-semibold uppercase tracking-wider text-muted-terminal mb-2">
          Next Quarter Forecast (T+1)
        </h6>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold font-tabular-nums-mono tracking-tight" style={{ color: 'var(--text)' }}>
            {nextForecast.toFixed(2)}%
          </span>
        </div>
        <div className="flex items-center mt-3 text-xs text-muted-terminal">
          <span>Forward guidance</span>
        </div>
      </div>

      <div
        className="terminal-card p-5 flex flex-col justify-between min-h-[148px] border-l-[3px]"
        style={{ borderLeftColor: '#a78bfa', backgroundColor: 'var(--card)' }}
      >
        <h6 className="text-[11px] font-semibold uppercase tracking-wider text-muted-terminal mb-2">
          Certainty Bracket
        </h6>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold font-tabular-nums-mono tracking-tight" style={{ color: 'var(--text)' }}>
            [{ciLower.toFixed(1)}%, {ciUpper.toFixed(1)}%]
          </span>
        </div>
        <div className="flex items-center mt-3 text-xs font-medium">
          <span className="text-muted-terminal mr-2">Model consensus:</span>
          <span style={{ color: consensusColor }}>{consensusText}</span>
        </div>
      </div>
      </div>
    </div>
  );
}
