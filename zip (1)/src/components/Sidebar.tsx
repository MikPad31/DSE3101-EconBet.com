import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Sun,
  Moon,
  Activity,
  BarChart2,
  Layers,
  SlidersHorizontal,
  Zap,
  TrendingUp,
  Cpu,
  LineChart,
  Percent,
  AreaChart,
} from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  isDarkMode: boolean;
  toggleTheme: () => void;
  models: {
    ar: boolean;
    rf: boolean;
    adl: boolean;
    ensemble: boolean;
    showCI: boolean;
  };
  toggleModel: (model: keyof SidebarProps['models']) => void;
  vintage: string;
  setVintage: (vintage: string) => void;
  activeTab?: string;
  setActiveTab?: (tab: any) => void;
  useCustomWeights: boolean;
  setUseCustomWeights: (val: boolean) => void;
  weights: { ar: number; adl: number; rf: number };
  setWeights: (weights: { ar: number; adl: number; rf: number }) => void;
}

function SidebarSection({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3 px-0.5">
        <Icon className="w-3.5 h-3.5 shrink-0 text-muted-terminal" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-terminal">{title}</span>
      </div>
      {children}
    </div>
  );
}

export function Sidebar({
  isDarkMode,
  toggleTheme,
  models,
  toggleModel,
  vintage,
  setVintage,
  activeTab,
  setActiveTab,
  useCustomWeights,
  setUseCustomWeights,
  weights,
  setWeights,
}: SidebarProps) {
  return (
    <div
      className="w-full md:w-1/6 lg:w-2/12 h-screen fixed flex flex-col p-4 border-r transition-colors duration-300"
      style={{ backgroundColor: 'var(--sidebar)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-center mb-4 w-full">
        {isDarkMode ? (
          <>
            <img
              src="/logo-dark.png"
              alt="EconBet Logo"
              className="w-full max-w-[180px] object-contain"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = document.getElementById('logo-fallback-dark');
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div id="logo-fallback-dark" className="hidden items-center gap-3">
              <Activity className="w-8 h-8" style={{ color: 'var(--color-brand-primary)' }} />
              <h5 className="font-bold text-lg leading-tight">EconBet Terminal</h5>
            </div>
          </>
        ) : (
          <>
            <img
              src="/logo-light.png"
              alt="EconBet Logo"
              className="w-full max-w-[180px] object-contain"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = document.getElementById('logo-fallback-light');
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div id="logo-fallback-light" className="hidden items-center gap-3">
              <Activity className="w-8 h-8" style={{ color: 'var(--color-brand-primary)' }} />
              <h5 className="font-bold text-lg leading-tight">EconBet Terminal</h5>
            </div>
          </>
        )}
      </div>
      <hr className="mb-5 border-t" style={{ borderColor: 'var(--border)' }} />

      <div data-tour="tour-sidebar-models" className="mb-6 scroll-mt-4 rounded-md">
      <SidebarSection icon={Layers} title="Models">
        <div className="space-y-1">
          <ToggleSwitch label="AR Benchmark" checked={models.ar} onChange={() => toggleModel('ar')} icon={TrendingUp} />
          <ToggleSwitch label="Random Forest Bridge" checked={models.rf} onChange={() => toggleModel('rf')} icon={Cpu} />
          <ToggleSwitch label="ADL Model" checked={models.adl} onChange={() => toggleModel('adl')} icon={LineChart} />
          <ToggleSwitch label="Combined Nowcast" checked={models.ensemble} onChange={() => toggleModel('ensemble')} icon={Percent} />
          <div className="pt-2">
            <ToggleSwitch label="Show Confidence Interval" checked={models.showCI} onChange={() => toggleModel('showCI')} icon={AreaChart} />
          </div>
        </div>
      </SidebarSection>
      </div>

      <div data-tour="tour-sidebar-mix" className="mb-6 scroll-mt-4 rounded-md">
      <SidebarSection icon={SlidersHorizontal} title="Ensemble mix">
        <div className="flex items-center justify-between mb-3 px-0.5">
          <span className="text-xs font-medium text-muted-terminal">Custom weights</span>
          <ToggleSwitch label="" checked={useCustomWeights} onChange={() => setUseCustomWeights(!useCustomWeights)} />
        </div>
        {useCustomWeights && (
          <div className="space-y-4 rounded-md border p-3 transition-colors" style={{ borderColor: 'var(--border)', backgroundColor: 'color-mix(in srgb, var(--border) 25%, transparent)' }}>
            <WeightSlider label="AR Model" value={weights.ar} onChange={(val) => setWeights({ ...weights, ar: val })} color="#ff4757" />
            <WeightSlider label="ADL Model" value={weights.adl} onChange={(val) => setWeights({ ...weights, adl: val })} color="#ffa502" />
            <WeightSlider label="Random Forest" value={weights.rf} onChange={(val) => setWeights({ ...weights, rf: val })} color="#a55eea" />
            <div className="text-[10px] text-muted-terminal text-center">Weights normalize to 100%</div>
          </div>
        )}
      </SidebarSection>
      </div>

      <div data-tour="tour-sidebar-scenario" className="mb-6 scroll-mt-4 rounded-md">
      <SidebarSection icon={Zap} title="Scenario">
        <select
          value={vintage}
          onChange={(e) => setVintage(e.target.value)}
          className="w-full p-2.5 rounded-md border outline-none transition-colors text-sm hover:border-[var(--color-brand-primary)]/40"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          <option value="live">Live (Latest)</option>
          <option value="covid">COVID-19 Shock (2020)</option>
          <option value="2015-slowdown">2015 Slowdown</option>
        </select>
      </SidebarSection>
      </div>

      <div data-tour="tour-sidebar-footer" className="mt-auto flex flex-col gap-3 pt-4 border-t scroll-mt-4 rounded-md" style={{ borderColor: 'var(--border)' }}>
        {setActiveTab && (
          <button
            type="button"
            onClick={() => setActiveTab('Model Performance')}
            className={cn(
              'flex items-center gap-2 px-3 py-2.5 rounded-md transition-colors w-full text-sm',
              activeTab === 'Model Performance'
                ? 'bg-[var(--color-brand-primary)] text-white shadow-md'
                : 'text-muted-terminal hover:text-[var(--text)] hover:bg-black/5 dark:hover:bg-white/5'
            )}
          >
            <BarChart2 size={18} className="shrink-0 opacity-90" />
            <span className="font-medium">Model Performance</span>
          </button>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center justify-between w-full p-1 rounded-full border transition-colors duration-300 relative"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-center w-1/2 z-10 py-1">
            <Sun className={cn('w-4 h-4', !isDarkMode ? 'text-yellow-500' : 'text-gray-400')} />
          </div>
          <div className="flex items-center justify-center w-1/2 z-10 py-1">
            <Moon className={cn('w-4 h-4', isDarkMode ? 'text-blue-400' : 'text-gray-400')} />
          </div>
          <div
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full transition-transform duration-300 shadow-sm"
            style={{
              backgroundColor: 'var(--card)',
              transform: isDarkMode ? 'translateX(calc(100% + 4px))' : 'translateX(4px)',
            }}
          />
        </button>
      </div>
    </div>
  );
}

function ToggleSwitch({
  label,
  checked,
  onChange,
  icon: Icon,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  icon?: LucideIcon;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer group rounded-md px-1.5 py-2 -mx-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5">
      <span className="flex items-center gap-2 min-w-0 mr-2">
        {Icon && <Icon className="w-3.5 h-3.5 shrink-0 opacity-60 text-muted-terminal" aria-hidden />}
        {label ? <span className="text-sm font-medium group-hover:opacity-90 transition-opacity truncate">{label}</span> : null}
      </span>
      <div className="relative shrink-0">
        <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
        <div className={cn('block w-10 h-6 rounded-full transition-colors duration-300', checked ? 'bg-[var(--color-brand-primary)]' : 'bg-gray-400 dark:bg-gray-600')} />
        <div className={cn('dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-300', checked ? 'translate-x-4' : '')} />
      </div>
    </label>
  );
}

function WeightSlider({ label, value, onChange, color }: { label: string; value: number; onChange: (val: number) => void; color: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs font-medium">
        <span style={{ color }}>{label}</span>
        <span className="font-tabular-nums-mono">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
        style={{ accentColor: color }}
      />
    </div>
  );
}
