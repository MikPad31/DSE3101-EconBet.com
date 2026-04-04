import React from 'react';
import { Sun, Moon, Activity, BarChart2 } from 'lucide-react';
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
  setWeights
}: SidebarProps) {
  return (
    <div className="w-full md:w-1/6 lg:w-2/12 h-screen fixed flex flex-col p-4 border-r transition-colors duration-300"
         style={{ backgroundColor: 'var(--sidebar)', borderColor: 'var(--border)' }}>
      {/* Brand Header */}
      <div className="flex items-center justify-center mb-4 w-full">
        {isDarkMode ? (
          <>
            {/* Dark Mode Logo */}
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
              <Activity className="w-8 h-8 text-brand-primary" style={{ color: 'var(--color-brand-primary)' }} />
              <h5 className="font-bold text-lg leading-tight">EconBet Terminal</h5>
            </div>
          </>
        ) : (
          <>
            {/* Light Mode Logo */}
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
              <Activity className="w-8 h-8 text-brand-primary" style={{ color: 'var(--color-brand-primary)' }} />
              <h5 className="font-bold text-lg leading-tight">EconBet Terminal</h5>
            </div>
          </>
        )}
      </div>
      <hr className="mb-6 border-t" style={{ borderColor: 'var(--border)' }} />

      {/* Model Selection */}
      <div className="mb-6">
        <label className="block text-sm font-semibold mb-3 text-gray-500 uppercase tracking-wider">Select Forecasting Models:</label>
        <div className="space-y-3">
          <ToggleSwitch label="AR Benchmark" checked={models.ar} onChange={() => toggleModel('ar')} />
          <ToggleSwitch label="Random Forest Bridge" checked={models.rf} onChange={() => toggleModel('rf')} />
          <ToggleSwitch label="ADL Model" checked={models.adl} onChange={() => toggleModel('adl')} />
          <ToggleSwitch label="Combined Nowcast" checked={models.ensemble} onChange={() => toggleModel('ensemble')} />
          <div className="pt-2">
            <ToggleSwitch label="Show Confidence Interval" checked={models.showCI} onChange={() => toggleModel('showCI')} />
          </div>
        </div>
      </div>

      {/* Custom Weights */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-semibold text-gray-500 uppercase tracking-wider">Custom Weights:</label>
          <ToggleSwitch label="" checked={useCustomWeights} onChange={() => setUseCustomWeights(!useCustomWeights)} />
        </div>
        
        {useCustomWeights && (
          <div className="space-y-4 bg-black/5 dark:bg-white/5 p-3 rounded-md">
            <WeightSlider 
              label="AR Model" 
              value={weights.ar} 
              onChange={(val) => setWeights({ ...weights, ar: val })} 
              color="#ff4757"
            />
            <WeightSlider 
              label="ADL Model" 
              value={weights.adl} 
              onChange={(val) => setWeights({ ...weights, adl: val })} 
              color="#ffa502"
            />
            <WeightSlider 
              label="Random Forest" 
              value={weights.rf} 
              onChange={(val) => setWeights({ ...weights, rf: val })} 
              color="#a55eea"
            />
            <div className="text-xs text-gray-500 text-center mt-2">
              Weights are normalized to 100%
            </div>
          </div>
        )}
      </div>

      {/* GDP Shock Events */}
      <div className="mb-6">
        <label className="block text-sm font-semibold mb-3 text-gray-500 uppercase tracking-wider">GDP Shock Events:</label>
        <select 
          value={vintage}
          onChange={(e) => setVintage(e.target.value)}
          className="w-full p-2 rounded border outline-none transition-colors duration-300"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          <option value="live">Live (Latest)</option>
          <option value="covid">COVID-19 Shock (2020)</option>
          <option value="2015-slowdown">2015 Slowdown</option>
        </select>
      </div>

      {/* Bottom Section: Model Performance & Theme Toggle */}
      <div className="mt-auto flex flex-col gap-4">
        {setActiveTab && (
          <button
            onClick={() => setActiveTab('Model Performance')}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md transition-colors w-full",
              activeTab === 'Model Performance' 
                ? "bg-[var(--color-brand-primary)] text-white" 
                : "hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300"
            )}
          >
            <BarChart2 size={18} />
            <span className="font-medium text-sm">Model Performance</span>
          </button>
        )}

        <button 
          onClick={toggleTheme}
          className="flex items-center justify-between w-full p-1 rounded-full border transition-colors duration-300 relative"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-center w-1/2 z-10 py-1">
            <Sun className={cn("w-4 h-4", !isDarkMode ? "text-yellow-500" : "text-gray-400")} />
          </div>
          <div className="flex items-center justify-center w-1/2 z-10 py-1">
            <Moon className={cn("w-4 h-4", isDarkMode ? "text-blue-400" : "text-gray-400")} />
          </div>
          <div 
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full transition-transform duration-300 shadow-sm"
            style={{ 
              backgroundColor: 'var(--card)',
              transform: isDarkMode ? 'translateX(calc(100% + 4px))' : 'translateX(4px)' 
            }}
          />
        </button>
      </div>
    </div>
  );
}

function ToggleSwitch({ label, checked, onChange }: { label: string, checked: boolean, onChange: () => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      {label && <span className="text-sm font-medium group-hover:opacity-80 transition-opacity">{label}</span>}
      <div className="relative">
        <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
        <div className={cn("block w-10 h-6 rounded-full transition-colors duration-300", checked ? "bg-[var(--color-brand-primary)]" : "bg-gray-400 dark:bg-gray-600")}></div>
        <div className={cn("dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-300", checked ? "transform translate-x-4" : "")}></div>
      </div>
    </label>
  );
}

function WeightSlider({ label, value, onChange, color }: { label: string, value: number, onChange: (val: number) => void, color: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs font-medium">
        <span style={{ color }}>{label}</span>
        <span>{value}</span>
      </div>
      <input 
        type="range" 
        min="0" 
        max="100" 
        value={value} 
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
        style={{ accentColor: color }}
      />
    </div>
  );
}
