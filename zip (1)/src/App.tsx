import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { format, parseISO, getQuarter, getYear } from 'date-fns';
import { User, LogIn, Activity, GraduationCap } from 'lucide-react';
import { OnboardingTour, ONBOARDING_STORAGE_KEY } from './components/OnboardingTour';
import { Sidebar } from './components/Sidebar';
import { KPIRibbon } from './components/KPIRibbon';
import { HeroChart } from './components/HeroChart';
import { ModelPerformance } from './components/ModelPerformance';
import { ForwardOutlook } from './components/ForwardOutlook';
import { MacroSignalPanel } from './components/MacroSignalPanel';
import { ForecastData } from './types';
import { cn } from './lib/utils';
import { normalCDF } from './lib/stats';

type Tab = 'Overview' | 'Model Performance' | 'Forward Outlook' | 'Macro Signals';

const SCENARIO_CONTEXT: Record<
  string,
  { title: string; summary: string; storyTags: string }
> = {
  covid: {
    title: 'COVID-19 shock (preset)',
    summary:
      'The COVID-19 crisis triggered a sharp global contraction as lockdowns halted activity, oil demand collapsed, and uncertainty spiked, followed by aggressive fiscal stimulus and unprecedented central bank intervention that drove a rapid rebound.',
    storyTags: 'Health policy · Energy · Fiscal · Central bank',
  },
  '2015-slowdown': {
    title: '2015 slowdown (preset)',
    summary:
      'The 2015 slowdown was driven by growth deceleration and yuan devaluation in China, which amplified global uncertainty, weakened manufacturing activity, and triggered a broad downturn in commodity markets.',
    storyTags: 'FX · Manufacturing · Commodities',
  },
};

function scenarioIndexRange(rows: ForecastData[], vintage: string): [number, number] | null {
  if (vintage === 'covid') {
    const startIdx = rows.findIndex(d => d.date.startsWith('2019-10'));
    const endIdx = rows.findIndex(d => d.date.startsWith('2021-04'));
    if (startIdx === -1 || endIdx === -1) return null;
    return [startIdx, endIdx];
  }
  if (vintage === '2015-slowdown') {
    const startIdx = rows.findIndex(d => d.date.startsWith('2014-07'));
    const endIdx = rows.findIndex(d => d.date.startsWith('2016-07'));
    if (startIdx === -1 || endIdx === -1) return null;
    return [startIdx, endIdx];
  }
  return null;
}

function formatDataQuarter(dateStr: string) {
  const d = parseISO(dateStr);
  return `${getYear(d)} Q${getQuarter(d)}`;
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [statusClock, setStatusClock] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setStatusClock(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

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

  useEffect(() => {
    if (loading) return;
    try {
      if (localStorage.getItem(ONBOARDING_STORAGE_KEY) !== '1') setShowOnboarding(true);
    } catch {
      setShowOnboarding(true);
    }
  }, [loading]);

  const handleOnboardingClose = ({ neverAgain }: { neverAgain: boolean }) => {
    setShowOnboarding(false);
    if (neverAgain) {
      try {
        localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
      } catch {
        /* ignore */
      }
    }
  };

  // Handle Vintage (GDP Shock Events) Change — same index logic as KPI preset windows
  useEffect(() => {
    if (data.length === 0) return;

    if (vintage === 'live') {
      setTimeRange([0, data.length - 1]);
      setActiveRangeButton('MAX');
      return;
    }
    const bounds = scenarioIndexRange(data, vintage);
    if (bounds) {
      setTimeRange(bounds);
      setActiveRangeButton('');
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

  const kpiSourceRows = useMemo(() => {
    if (processedData.length < 3) return processedData;
    if (vintage === 'live') return processedData;
    const bounds = scenarioIndexRange(processedData, vintage);
    if (!bounds) return processedData;
    const [a, b] = bounds;
    const slice = processedData.slice(a, b + 1);
    return slice.length >= 3 ? slice : processedData;
  }, [processedData, vintage]);

  const kpis = useMemo(() => {
    const empty = {
      t0Actual: 0,
      currentNowcast: 0,
      prevNowcast: 0,
      nextForecast: 0,
      t2Forecast: 0,
      ciLower: 0,
      ciUpper: 0,
      recessionRisk: 0,
    };
    if (kpiSourceRows.length < 3) return empty;

    const t0Row = kpiSourceRows[kpiSourceRows.length - 3];
    const t1Row = kpiSourceRows[kpiSourceRows.length - 2];
    const t2Row = kpiSourceRows[kpiSourceRows.length - 1];

    const currentNowcast = t1Row.forecast_Ensemble;
    const std = (t1Row.CI_Upper - t1Row.CI_Lower) / (2 * 1.96);
    const recessionRisk = std > 0 ? normalCDF(0, currentNowcast, std) * 100 : (currentNowcast < 0 ? 100 : 0);

    return {
      t0Actual: t0Row.actual,
      currentNowcast,
      prevNowcast: t0Row.forecast_Ensemble,
      nextForecast: t1Row.forecast_Ensemble,
      t2Forecast: t2Row.forecast_Ensemble,
      ciLower: t1Row.CI_Lower,
      ciUpper: t1Row.CI_Upper,
      recessionRisk,
    };
  }, [kpiSourceRows]);

  const kpiRibbonNote = useMemo(() => {
    if (processedData.length < 3) return '';
    if (vintage === 'live') {
      const tail = processedData[processedData.length - 2];
      return `Headline KPIs · latest quarter in series (${formatDataQuarter(tail.date)})`;
    }
    const t1 = kpiSourceRows[kpiSourceRows.length - 2];
    if (!t1?.date) return 'Preset window · KPIs at end of selected scenario range';
    return `Preset window · KPIs at end of scenario range (as of ${formatDataQuarter(t1.date)})`;
  }, [processedData, kpiSourceRows, vintage]);

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
      <OnboardingTour
        open={showOnboarding && !loading}
        onClose={handleOnboardingClose}
        layoutKey={activeTab}
        onPrepareStep={(p) => {
          if (p === 'overview') setActiveTab('Overview');
          if (p === 'forward') setActiveTab('Forward Outlook');
        }}
      />

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
        <div
          data-tour="tour-header"
          className="sticky top-0 z-30 flex justify-between items-center px-8 py-4 border-b backdrop-blur-sm"
          style={{ borderColor: 'var(--border)', backgroundColor: 'color-mix(in srgb, var(--bg) 90%, transparent)' }}
        >
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold tracking-[0.35em] uppercase"
                  style={{ fontFamily: '"IBM Plex Mono", monospace', color: 'var(--color-brand-primary)' }}>
              EconBet · MacroCast Terminal
            </span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500"
                 style={{ fontFamily: '"IBM Plex Mono", monospace' }}>
              <span>VINTAGE: OCT 01, 2025</span>
              <span className="opacity-30">|</span>
              <span>FREQ: QUARTERLY</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-muted-terminal"
                 style={{ fontFamily: '"IBM Plex Mono", monospace' }}>
              <span>Last updated: {format(statusClock, 'MMM d, yyyy HH:mm')}</span>
              <span className="opacity-30 hidden sm:inline">|</span>
              <span className="opacity-30 hidden sm:inline"></span>
              <span className="flex flex-wrap gap-1.5">
                {(['AR', 'ADL', 'RF', 'ENS'] as const).map((b) => (
                  <span
                    key={b}
                    className="px-1.5 py-0.5 rounded border font-semibold tracking-wide"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                  >
                    {b}
                  </span>
                ))}
              </span>
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
              <div className="terminal-card absolute right-0 mt-2 w-48 rounded-lg py-1 z-50"
                   style={{ backgroundColor: 'var(--sidebar)', borderColor: 'var(--border)' }}>
                <button className="flex items-center w-full px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <LogIn className="w-4 h-4 mr-2.5 opacity-60" /> Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowOnboarding(true);
                    setIsProfileOpen(false);
                  }}
                  className="flex items-center w-full px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <GraduationCap className="w-4 h-4 mr-2.5 opacity-60" /> User guide
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-8 py-6">
          {vintage !== 'live' && SCENARIO_CONTEXT[vintage] && (
            <div
              className="terminal-card mb-4 p-4 rounded-lg border-l-[3px]"
              style={{ borderLeftColor: 'var(--color-brand-primary)', backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-1"
                style={{ fontFamily: '"IBM Plex Mono", monospace', color: 'var(--color-brand-primary)' }}
              >
                {SCENARIO_CONTEXT[vintage].title}
              </p>
              <p className="text-sm text-muted-terminal leading-relaxed">{SCENARIO_CONTEXT[vintage].summary}</p>
              <p
                className="text-[10px] mt-2 text-muted-terminal"
                style={{ fontFamily: '"IBM Plex Mono", monospace' }}
              >
                Story tags: {SCENARIO_CONTEXT[vintage].storyTags}
              </p>
            </div>
          )}

          <div data-tour="tour-kpi" className="scroll-mt-6">
            <KPIRibbon {...kpis} scopeNote={kpiRibbonNote} />
          </div>

          {/* Tabs */}
          <div data-tour="tour-tabs" className="flex gap-1 border-b mb-6" style={{ borderColor: 'var(--border)' }}>
            {(['Overview', 'Forward Outlook', 'Macro Signals'] as Tab[]).map((tab) => (
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
                <div data-tour="tour-chart">
                  <HeroChart
                    data={processedData}
                    models={models}
                    timeRange={timeRange}
                    setTimeRange={setTimeRange}
                    onRangeButtonClick={handleRangeButtonClick}
                    activeRangeButton={activeRangeButton}
                  />
                </div>
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

            {activeTab === 'Macro Signals' && (
              <motion.div
                key="macro-signals"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <MacroSignalPanel />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

    </div>
  );
}
