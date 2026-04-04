import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { User, FileText, LogIn, X, Activity } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { KPIRibbon } from './components/KPIRibbon';
import { HeroChart } from './components/HeroChart';
import { ModelPerformance } from './components/ModelPerformance';
import { ForwardOutlook } from './components/ForwardOutlook';
import { ForecastData } from './types';
import { cn } from './lib/utils';

type Tab = 'Overview' | 'Model Performance' | 'Forward Outlook';

// Simple approximation for normal CDF
function normalCDF(x: number, mean: number, std: number) {
  const z = (x - mean) / std;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [data, setData] = useState<ForecastData[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [models, setModels] = useState({
    ar: true,
    rf: false,
    adl: false,
    ensemble: true,
    showCI: true,
  });
  
  const [useCustomWeights, setUseCustomWeights] = useState(false);
  const [weights, setWeights] = useState({ ar: 33, adl: 33, rf: 34 });
  
  const [vintage, setVintage] = useState('live');
  const [timeRange, setTimeRange] = useState<[number, number]>([0, 0]);
  const [activeRangeButton, setActiveRangeButton] = useState('MAX');
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isReadMeOpen, setIsReadMeOpen] = useState(false);

  // Toggle Theme
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Load Data
  useEffect(() => {
    Papa.parse('/data.csv', {
      download: true,
      header: true,
      dynamicTyping: true,
      complete: (results) => {
        const parsedData = results.data.filter((d: any) => d.date) as ForecastData[];
        setData(parsedData);
        setTimeRange([0, parsedData.length - 1]);
        setLoading(false);
      },
    });
  }, []);

  // Handle Vintage (GDP Shock Events) Change
  useEffect(() => {
    if (data.length === 0) return;
    
    if (vintage === 'live') {
      setTimeRange([0, data.length - 1]);
      setActiveRangeButton('MAX');
    } else if (vintage === 'covid') {
      // Find index for 2020-01-01 to 2021-01-01
      const startIdx = data.findIndex(d => d.date.startsWith('2019-10'));
      const endIdx = data.findIndex(d => d.date.startsWith('2021-04'));
      if (startIdx !== -1 && endIdx !== -1) {
        setTimeRange([startIdx, endIdx]);
        setActiveRangeButton('');
      }
    } else if (vintage === '2015-slowdown') {
      const startIdx = data.findIndex(d => d.date.startsWith('2014-07'));
      const endIdx = data.findIndex(d => d.date.startsWith('2016-07'));
      if (startIdx !== -1 && endIdx !== -1) {
        setTimeRange([startIdx, endIdx]);
        setActiveRangeButton('');
      }
    }
  }, [vintage, data]);

  const toggleModel = (model: keyof typeof models) => {
    setModels(prev => ({ ...prev, [model]: !prev[model] }));
  };

  const handleRangeButtonClick = (range: string) => {
    setActiveRangeButton(range);
    if (data.length === 0) return;
    
    const maxIdx = data.length - 1;
    let startIdx = 0;
    
    if (range === '1Y') startIdx = Math.max(0, maxIdx - 4);
    else if (range === '5Y') startIdx = Math.max(0, maxIdx - 20);
    else if (range === '10Y') startIdx = Math.max(0, maxIdx - 40);
    else if (range === 'MAX') startIdx = 0;

    setTimeRange([startIdx, maxIdx]);
  };

  // Calculate KPIs based on sliced data
  const processedData = useMemo(() => {
    if (data.length === 0) return [];
    return data.map(d => {
      let ensemble = d.forecast_Ensemble;
      if (useCustomWeights) {
        const total = weights.ar + weights.adl + weights.rf;
        const wAr = weights.ar / total;
        const wAdl = weights.adl / total;
        const wRf = weights.rf / total;
        ensemble = (d.forecast_AR * wAr) + (d.forecast_ADL * wAdl) + (d.forecast_RF * wRf);
      }
      return { ...d, forecast_Ensemble: ensemble };
    });
  }, [data, useCustomWeights, weights]);

  const kpis = useMemo(() => {
    if (processedData.length < 3) return { currentNowcast: 0, prevNowcast: 0, nextForecast: 0, t2Forecast: 0, ciLower: 0, ciUpper: 0, recessionRisk: 0, t0Actual: 0 };
    
    // t0 is the last official GDP (we assume the 3rd to last row in our dataset)
    // t1 is the nowcast (2nd to last row)
    // t2 is the forecast (last row)
    const t0Row = processedData[processedData.length - 3];
    const t1Row = processedData[processedData.length - 2];
    const t2Row = processedData[processedData.length - 1];

    const currentNowcast = t1Row.forecast_Ensemble;
    const std = (t1Row.CI_Upper - t1Row.CI_Lower) / (2 * 1.96);
    const recessionRisk = std > 0 ? normalCDF(0, currentNowcast, std) * 100 : (currentNowcast < 0 ? 100 : 0);

    return {
      t0Actual: t0Row.actual,
      currentNowcast,
      prevNowcast: t0Row.forecast_Ensemble,
      nextForecast: t1Row.forecast_Ensemble, // t1
      t2Forecast: t2Row.forecast_Ensemble,   // t2
      ciLower: t1Row.CI_Lower,
      ciUpper: t1Row.CI_Upper,
      recessionRisk
    };
  }, [processedData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-5"
           style={{ backgroundColor: 'var(--color-bg-dark)', color: 'var(--color-text-dark)' }}>
        <div className="flex flex-col items-center gap-2">
          <Activity className="w-8 h-8" style={{ color: 'var(--color-brand-primary)' }} />
          <span className="text-[11px] tracking-[0.4em] uppercase font-medium"
                style={{ fontFamily: '"IBM Plex Mono", monospace', color: 'var(--color-brand-primary)' }}>
            EconBet Terminal
          </span>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full animate-pulse"
                 style={{ backgroundColor: 'var(--color-brand-primary)', animationDelay: `${i * 180}ms` }} />
          ))}
        </div>
        <p className="text-xs text-slate-500" style={{ fontFamily: '"IBM Plex Mono", monospace' }}>
          Initializing macroeconomic models...
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen transition-colors duration-300" style={{ color: 'var(--text)' }}>
      {/* Sidebar - Fixed */}
      <Sidebar
        isDarkMode={isDarkMode}
        toggleTheme={() => setIsDarkMode(!isDarkMode)}
        models={models}
        toggleModel={toggleModel}
        vintage={vintage}
        setVintage={setVintage}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        useCustomWeights={useCustomWeights}
        setUseCustomWeights={setUseCustomWeights}
        weights={weights}
        setWeights={setWeights}
      />

      {/* Main Content - Scrollable */}
      <div className="flex-1 ml-[16.666667%] lg:ml-[16.666667%] overflow-y-auto relative main-grid-bg">

        {/* Sticky Top Bar */}
        <div className="sticky top-0 z-30 flex justify-between items-center px-8 py-4 border-b backdrop-blur-sm"
             style={{ borderColor: 'var(--border)', backgroundColor: 'color-mix(in srgb, var(--bg) 90%, transparent)' }}>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold tracking-[0.35em] uppercase"
                  style={{ fontFamily: '"IBM Plex Mono", monospace', color: 'var(--color-brand-primary)' }}>
              EconBet · MacroCast Terminal
            </span>
            <div className="flex items-center gap-3 text-[11px] text-gray-500"
                 style={{ fontFamily: '"IBM Plex Mono", monospace' }}>
              <span>VINTAGE: OCT 01, 2025</span>
              <span className="opacity-30">|</span>
              <span>FREQ: QUARTERLY</span>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all hover:border-[var(--color-brand-primary)] hover:text-[var(--color-brand-primary)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              <User className="w-3.5 h-3.5" />
              <span>Account</span>
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-xl py-1 border z-50"
                   style={{ backgroundColor: 'var(--sidebar)', borderColor: 'var(--border)' }}>
                <button className="flex items-center w-full px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <LogIn className="w-4 h-4 mr-2.5 opacity-60" /> Sign In
                </button>
                <button
                  onClick={() => { setIsReadMeOpen(true); setIsProfileOpen(false); }}
                  className="flex items-center w-full px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <FileText className="w-4 h-4 mr-2.5 opacity-60" /> Read Me
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-8 py-6">
          <KPIRibbon {...kpis} />

          {/* Tabs */}
          <div className="flex gap-1 border-b mb-6" style={{ borderColor: 'var(--border)' }}>
            {(['Overview', 'Forward Outlook'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "relative px-5 py-3 text-xs font-semibold tracking-widest uppercase transition-colors duration-200",
                  activeTab === tab
                    ? "text-[var(--color-brand-primary)]"
                    : "text-gray-500 hover:text-[var(--text)]"
                )}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-[2px]"
                    style={{ backgroundColor: 'var(--color-brand-primary)' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {activeTab === 'Overview' && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <HeroChart 
                  data={processedData} 
                  models={models} 
                  timeRange={timeRange} 
                  setTimeRange={setTimeRange}
                  onRangeButtonClick={handleRangeButtonClick}
                  activeRangeButton={activeRangeButton}
                />
              </motion.div>
            )}

            {activeTab === 'Model Performance' && (
              <motion.div
                key="performance"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <ModelPerformance />
              </motion.div>
            )}
            
            {activeTab === 'Forward Outlook' && (
              <motion.div
                key="outlook"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <ForwardOutlook {...kpis} isDarkMode={isDarkMode} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Read Me Modal */}
      {isReadMeOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl shadow-2xl border max-w-2xl w-full max-h-[88vh] flex flex-col"
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="flex justify-between items-start px-6 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
              <div>
                <p className="text-[10px] font-semibold tracking-[0.3em] uppercase mb-1"
                   style={{ fontFamily: '"IBM Plex Mono", monospace', color: 'var(--color-brand-primary)' }}>
                  Documentation
                </p>
                <h2 className="text-lg font-bold">Using the Dashboard</h2>
              </div>
              <button onClick={() => setIsReadMeOpen(false)}
                      className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors ml-4 mt-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <section>
                <h3 className="text-[10px] font-semibold tracking-[0.25em] uppercase mb-2"
                    style={{ fontFamily: '"IBM Plex Mono", monospace', color: 'var(--color-brand-primary)' }}>Overview</h3>
                <p className="text-sm leading-relaxed text-gray-500">
                  The MacroCast Terminal is a real-time macroeconomic nowcasting dashboard that visualizes GDP growth predictions using an ensemble of econometric and machine learning models.
                </p>
              </section>

              <section>
                <h3 className="text-[10px] font-semibold tracking-[0.25em] uppercase mb-3"
                    style={{ fontFamily: '"IBM Plex Mono", monospace', color: 'var(--color-brand-primary)' }}>Features</h3>
                <ul className="space-y-2.5">
                  {[
                    { label: 'Model Selection', desc: 'Toggle individual models (AR, ADL, Random Forest) and the Combined Ensemble Nowcast.' },
                    { label: 'GDP Shock Events', desc: 'Use the dropdown in the sidebar to jump to historical periods of high volatility (e.g., COVID-19).' },
                    { label: 'Interactive Chart', desc: 'Zoom in using the timeline buttons (1Y, 5Y, MAX) or the range slider at the bottom.' },
                    { label: 'Tabs', desc: 'Switch between the Overview chart, Model Performance metrics, and Forward Outlook risk gauges.' },
                  ].map(f => (
                    <li key={f.label} className="flex gap-3 text-sm">
                      <span className="shrink-0 font-semibold">{f.label}:</span>
                      <span className="text-gray-500">{f.desc}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="text-[10px] font-semibold tracking-[0.25em] uppercase mb-3"
                    style={{ fontFamily: '"IBM Plex Mono", monospace', color: 'var(--color-brand-primary)' }}>Model Performance</h3>
                <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'color-mix(in srgb, var(--border) 40%, transparent)' }}>
                        {['Model', 'RMSFE', 'Directional Accuracy'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold tracking-wider uppercase text-gray-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { model: 'AR', rmsfe: '6.56', dir: '41.5%' },
                        { model: 'ADL', rmsfe: '1.82', dir: '58.5%' },
                        { model: 'RF', rmsfe: '4.96', dir: '62.3%' },
                        { model: 'Ensemble', rmsfe: '4.09', dir: '64.2%' },
                      ].map(row => (
                        <tr key={row.model} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                          <td className="px-4 py-3 font-medium">{row.model}</td>
                          <td className="px-4 py-3 tabular-nums text-gray-500">{row.rmsfe}</td>
                          <td className="px-4 py-3 tabular-nums font-medium" style={{ color: 'var(--color-brand-success)' }}>{row.dir}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
