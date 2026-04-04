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
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center text-xs text-gray-500 gap-4">
            <span>Data vintage: October 01, 2025</span>
            <span>Frequency: Quarterly</span>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <User className="w-5 h-5" />
            </button>
            
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 border z-50"
                   style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <button className="flex items-center w-full px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">
                  <LogIn className="w-4 h-4 mr-2" /> Sign In
                </button>
                <button 
                  onClick={() => { setIsReadMeOpen(true); setIsProfileOpen(false); }}
                  className="flex items-center w-full px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <FileText className="w-4 h-4 mr-2" /> Read Me
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto">
          <KPIRibbon {...kpis} />
          
          {/* Tabs */}
          <div className="flex border-b mb-6" style={{ borderColor: 'var(--border)' }}>
            {(['Overview', 'Forward Outlook'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
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
          </AnimatePresence>
        </div>
      </div>

      {/* Read Me Modal */}
      {isReadMeOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
               style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
            <div className="flex justify-between items-center p-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-xl font-bold">Read Me: How to use the dashboard</h2>
              <button onClick={() => setIsReadMeOpen(false)} className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto prose dark:prose-invert max-w-none">
              <h3>Overview</h3>
              <p>The MacroCast Terminal is a real-time macroeconomic nowcasting dashboard that visualizes GDP growth predictions using an ensemble of econometric and machine learning models.</p>
              
              <h3>Features</h3>
              <ul>
                <li><strong>Model Selection:</strong> Toggle individual models (AR, ADL, Random Forest) and the Combined Ensemble Nowcast.</li>
                <li><strong>GDP Shock Events:</strong> Use the dropdown in the sidebar to jump to historical periods of high volatility (e.g., COVID-19).</li>
                <li><strong>Interactive Chart:</strong> Zoom in using the timeline buttons (1Y, 5Y, MAX) or the range slider at the bottom.</li>
                <li><strong>Tabs:</strong> Switch between the Overview chart, Model Performance metrics, and Forward Outlook risk gauges.</li>
              </ul>

              <h3>Model Performance Data</h3>
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm text-left border" style={{ borderColor: 'var(--border)' }}>
                  <thead className="bg-black/5 dark:bg-white/5">
                    <tr>
                      <th className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>Model</th>
                      <th className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>RMSFE</th>
                      <th className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>Directional Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>AR</td><td className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>6.56</td><td className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>41.5%</td></tr>
                    <tr><td className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>ADL</td><td className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>1.82</td><td className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>58.5%</td></tr>
                    <tr><td className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>RF</td><td className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>4.96</td><td className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>62.3%</td></tr>
                    <tr><td className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>Ensemble</td><td className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>4.09</td><td className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>64.2%</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
