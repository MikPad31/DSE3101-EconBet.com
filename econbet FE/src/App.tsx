import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { User, FileText, LogIn, X, Activity, Info } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { KPIRibbon } from './components/KPIRibbon';
import { HeroChart } from './components/HeroChart';
import { ModelPerformance } from './components/ModelPerformance';
import { ForwardOutlook } from './components/ForwardOutlook';
import { OnboardingTour } from './components/OnboardingTour';
import { RaggedEdge } from './components/RaggedEdge';
import { ForecastData } from './types';
import { cn } from './lib/utils';

type Tab = 'Overview' | 'Model Performance' | 'Forward Outlook' | 'Ragged Edge';

const SCENARIO_DESCRIPTIONS: Record<string, { title: string, description: string }> = {
  'covid': { title: 'COVID-19 Shock (2020)', description: 'A severe global economic contraction caused by the COVID-19 pandemic and subsequent lockdowns, followed by a rapid, unprecedented rebound.' },
  'gfc': { title: 'Global Financial Crisis (2008)', description: 'A severe worldwide economic crisis triggered by the collapse of the US housing bubble and the ensuing subprime mortgage crisis.' },
  'dotcom': { title: 'Dot-Com Bubble (2001)', description: 'A mild recession following the burst of the dot-com bubble and the September 11 attacks, characterized by a sharp decline in technology stock valuations.' },
  'volcker': { title: 'Volcker Shock (1980-1982)', description: 'A double-dip recession caused by the Federal Reserve raising interest rates to unprecedented levels to combat high inflation.' },
  'oil-shock': { title: 'Oil Crisis (1973)', description: 'An economic shock and period of stagflation triggered by the OAPEC oil embargo, leading to soaring fuel prices and reduced economic output.' },
  '2015-slowdown': { title: 'Industrial Slowdown (2015)', description: 'A period of sluggish growth driven by a strong US dollar, collapsing oil prices, and a slowdown in global manufacturing and trade.' }
};

import { format, parseISO, getQuarter, getYear } from 'date-fns';

export function formatQuarter(dateStr: string) {
  if (!dateStr) return '';
  try {
    const date = parseISO(dateStr);
    return `Q${getQuarter(date)} ${getYear(date)}`;
  } catch (e) {
    return dateStr;
  }
}

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
  const [activeRangeButton, setActiveRangeButton] = useState('10Y');
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Click outside handler for profile dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Check if tour should open on load
  useEffect(() => {
    const hasSeenTour = localStorage.getItem('macrocas_onboarding_done_v1');
    if (!hasSeenTour) {
      setIsTourOpen(true);
    }
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
        
        // Default to 10Y (40 quarters)
        const endIdx = parsedData.length - 1;
        const startIdx = Math.max(0, endIdx - 40);
        setTimeRange([startIdx, endIdx]);
        setActiveRangeButton('10Y');
        
        setLoading(false);
      },
    });
  }, []);

  // Handle Vintage (GDP Shock Events) Change
  useEffect(() => {
    if (data.length === 0) return;
    
    if (vintage === 'live') {
      const endIdx = data.length - 1;
      const startIdx = Math.max(0, endIdx - 40);
      setTimeRange([startIdx, endIdx]);
      setActiveRangeButton('10Y');
    } else if (vintage === 'covid') {
      // Find index for 2020-01-01 to 2021-01-01
      const startIdx = data.findIndex(d => d.date.startsWith('2019-10'));
      const endIdx = data.findIndex(d => d.date.startsWith('2021-04'));
      if (startIdx !== -1 && endIdx !== -1) {
        setTimeRange([startIdx, endIdx]);
        setActiveRangeButton('');
      }
    } else if (vintage === 'gfc') {
      const startIdx = data.findIndex(d => d.date.startsWith('2007-10'));
      const endIdx = data.findIndex(d => d.date.startsWith('2009-10'));
      if (startIdx !== -1 && endIdx !== -1) {
        setTimeRange([startIdx, endIdx]);
        setActiveRangeButton('');
      }
    } else if (vintage === 'dotcom') {
      const startIdx = data.findIndex(d => d.date.startsWith('2000-01'));
      const endIdx = data.findIndex(d => d.date.startsWith('2002-01'));
      if (startIdx !== -1 && endIdx !== -1) {
        setTimeRange([startIdx, endIdx]);
        setActiveRangeButton('');
      }
    } else if (vintage === 'volcker') {
      const startIdx = data.findIndex(d => d.date.startsWith('1979-01'));
      const endIdx = data.findIndex(d => d.date.startsWith('1983-01'));
      if (startIdx !== -1 && endIdx !== -1) {
        setTimeRange([startIdx, endIdx]);
        setActiveRangeButton('');
      }
    } else if (vintage === 'oil-shock') {
      const startIdx = data.findIndex(d => d.date.startsWith('1973-01'));
      const endIdx = data.findIndex(d => d.date.startsWith('1975-04'));
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
    if (processedData.length < 3 || timeRange[1] < 0) return { currentNowcast: 0, prevNowcast: 0, nextForecast: 0, t2Forecast: 0, ciLower: 0, ciUpper: 0, recessionRisk: 0, t0Actual: 0, anchorDate: '', tMinus1Date: '', tPlus1Date: '', tPlus2Date: '' };
    
    // Find the last index in the selected range that has a valid 'actual' value
    let lastOfficialIdx = timeRange[1];
    while (lastOfficialIdx >= 0 && (processedData[lastOfficialIdx].actual === null || processedData[lastOfficialIdx].actual === undefined || processedData[lastOfficialIdx].actual === '')) {
      lastOfficialIdx--;
    }
    
    // If we couldn't find any official data, fallback to the end of the range
    if (lastOfficialIdx < 0) lastOfficialIdx = timeRange[1];

    const t0Row = processedData[lastOfficialIdx];
    
    // T-1 is the quarter before the anchor date
    const tMinus1Row = lastOfficialIdx > 0 ? processedData[lastOfficialIdx - 1] : t0Row;
    
    // T+1 is the quarter after the anchor date (Nowcast)
    const tPlus1Row = lastOfficialIdx < processedData.length - 1 ? processedData[lastOfficialIdx + 1] : t0Row;

    // T+2 is two quarters after the anchor date (Forecast)
    const tPlus2Row = lastOfficialIdx < processedData.length - 2 ? processedData[lastOfficialIdx + 2] : tPlus1Row;

    const currentNowcast = tPlus1Row.forecast_Ensemble; // Nowcast is T+1
    const std = (tPlus1Row.CI_Upper - tPlus1Row.CI_Lower) / (2 * 1.96);
    const recessionRisk = std > 0 ? normalCDF(0, currentNowcast, std) * 100 : (currentNowcast < 0 ? 100 : 0);

    return {
      t0Actual: t0Row.actual,
      currentNowcast,
      prevNowcast: t0Row.forecast_Ensemble, // Previous nowcast is T0's forecast
      nextForecast: tPlus2Row.forecast_Ensemble, // Next forecast is T+2
      t2Forecast: tPlus2Row.forecast_Ensemble,   // t2
      ciLower: tPlus1Row.CI_Lower,
      ciUpper: tPlus1Row.CI_Upper,
      recessionRisk,
      anchorDate: t0Row.date,
      tMinus1Date: tMinus1Row.date,
      tPlus1Date: tPlus1Row.date,
      tPlus2Date: tPlus2Row.date,
    };
  }, [processedData, timeRange]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="flex min-h-screen font-sans transition-colors duration-300">
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
      <div className="flex-1 ml-[16.666667%] lg:ml-[16.666667%] p-6 overflow-y-auto relative">
        
        {/* Top Bar with Profile */}
        <div className="flex justify-between items-start mb-6 border-b pb-4" style={{ borderColor: 'var(--border)' }} data-tour="tour-header">
          <div className="flex flex-col gap-2 font-mono text-xs">
            <div className="flex items-center gap-2 text-[#5dade2] font-bold tracking-widest text-sm uppercase">
              <span className="text-base leading-none" role="img" aria-label="US Flag">🇺🇸</span>
              <span>USA MACROCAST TERMINAL</span>
            </div>
            <div className="text-gray-500 dark:text-gray-400 uppercase">
              VINTAGE: OCT 01, 2025 <span className="mx-2">|</span> FREQ: QUARTERLY
            </div>
            <div className="flex items-center text-gray-500 dark:text-gray-400 uppercase">
              Last updated: Apr 5, 2026 15:22 <span className="mx-2">|</span>
              <div className="flex gap-1">
                <span className={cn("px-1.5 py-0.5 rounded border text-[10px]", models.ar ? "border-gray-400 text-gray-600 dark:border-gray-400 dark:text-gray-200" : "border-transparent text-gray-400 dark:text-gray-500")}>AR</span>
                <span className={cn("px-1.5 py-0.5 rounded border text-[10px]", models.adl ? "border-gray-400 text-gray-600 dark:border-gray-400 dark:text-gray-200" : "border-transparent text-gray-400 dark:text-gray-500")}>ADL</span>
                <span className={cn("px-1.5 py-0.5 rounded border text-[10px]", models.rf ? "border-gray-400 text-gray-600 dark:border-gray-400 dark:text-gray-200" : "border-transparent text-gray-400 dark:text-gray-500")}>RF</span>
                <span className={cn("px-1.5 py-0.5 rounded border text-[10px]", models.ensemble ? "border-gray-400 text-gray-600 dark:border-gray-400 dark:text-gray-200" : "border-transparent text-gray-400 dark:text-gray-500")}>ENS</span>
              </div>
            </div>
          </div>
          
          <div className="relative" ref={profileRef}>
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-gray-500 hover:text-[var(--text)]"
            >
              <User className="w-5 h-5" />
              <span className="text-sm font-medium uppercase tracking-wider">Profile</span>
            </button>
            
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 border z-50"
                   style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <button className="flex items-center w-full px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">
                  <LogIn className="w-4 h-4 mr-2" /> Sign In
                </button>
                <button 
                  onClick={() => { 
                    setIsProfileOpen(false);
                    setIsTourOpen(true);
                  }}
                  className="flex items-center w-full px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <FileText className="w-4 h-4 mr-2" /> User Guide
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto">
          {vintage !== 'live' && SCENARIO_DESCRIPTIONS[vintage] && (
            <div className="mb-6 p-4 rounded-lg border bg-blue-50/50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-700 flex items-start gap-3 transition-colors duration-300">
              <Info className="w-5 h-5 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-blue-900 dark:text-white mb-1">{SCENARIO_DESCRIPTIONS[vintage].title}</h3>
                <p className="text-sm text-blue-800 dark:text-blue-50">{SCENARIO_DESCRIPTIONS[vintage].description}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mb-4 font-mono">
            <div className="text-gray-600 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">
              Headline KPIs
            </div>
            <div className="relative group flex items-center">
              <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help transition-colors" />
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-72 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-md shadow-xl z-50">
                <div className="mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                  <span className="font-bold text-gray-900 dark:text-white">Latest quarter in series:</span> {kpis.anchorDate || '2025 Q3'}
                </div>
                <div>
                  <span className="font-bold text-gray-900 dark:text-white">Units:</span> quarterly real GDP growth rate (approx. annualized % vs prior quarter)
                </div>
              </div>
            </div>
          </div>
          <KPIRibbon {...kpis} />
          
          {/* Tabs */}
          <div className="flex border-b mb-6" style={{ borderColor: 'var(--border)' }} data-tour="tour-tabs">
            {(['Overview', 'Forward Outlook', 'Ragged Edge'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                data-tour={tab === 'Ragged Edge' ? 'tour-ragged-edge' : undefined}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                  activeTab === tab 
                    ? "border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]" 
                    : "border-transparent text-gray-500 hover:text-[var(--text)]"
                )}
              >
                {tab}
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

            {activeTab === 'Ragged Edge' && (
              <motion.div
                key="ragged"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <RaggedEdge activeModels={models} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <OnboardingTour 
        open={isTourOpen} 
        onClose={({ neverAgain }) => {
          setIsTourOpen(false);
          if (neverAgain) {
            localStorage.setItem('macrocas_onboarding_done_v1', 'true');
          }
        }}
        onPrepareStep={(prepare) => {
          if (prepare === 'overview') setActiveTab('Overview');
          if (prepare === 'forward') setActiveTab('Forward Outlook');
        }}
        layoutKey={activeTab}
      />
    </div>
  );
}
