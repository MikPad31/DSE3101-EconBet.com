import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { formatQuarter } from '../App';

interface ForwardOutlookProps {
  t0Actual: number;
  currentNowcast: number;
  nextForecast: number;
  t2Forecast: number;
  recessionRisk: number;
  ciLower: number;
  ciUpper: number;
  anchorDate: string;
  tPlus1Date: string;
  tPlus2Date: string;
  isDarkMode?: boolean;
}

function formatVal(val: any) {
  if (typeof val === 'number' && !isNaN(val)) return val.toFixed(2);
  return 'N/A';
}

function formatVal0(val: any) {
  if (typeof val === 'number' && !isNaN(val)) return val.toFixed(0);
  return 'N/A';
}

function getEconomicState(prev: number, curr: number) {
  const delta = curr - prev;
  const isPositive = curr >= 0;
  const isIncreasing = delta > 0;

  if (isPositive && isIncreasing) return { label: "Acceleration", desc: "Booming & gaining momentum", color: "text-green-500", deltaColor: "text-green-500" };
  if (isPositive && !isIncreasing) return { label: "Deceleration", desc: "Growing, but cooling off", color: "text-yellow-500", deltaColor: "text-red-500" };
  if (!isPositive && !isIncreasing) return { label: "Deepening Recession", desc: "Shrinking, decline getting worse", color: "text-red-500", deltaColor: "text-red-500" };
  if (!isPositive && isIncreasing) return { label: "Bottoming Out", desc: "Shrinking, but crash slowing down", color: "text-blue-500", deltaColor: "text-green-500" };
  
  return { label: "Stable", desc: "No significant change", color: "text-gray-500", deltaColor: "text-gray-500" };
}

export function ForwardOutlook({ t0Actual, currentNowcast, nextForecast, t2Forecast, recessionRisk, ciLower, ciUpper, anchorDate, tPlus1Date, tPlus2Date, isDarkMode = true }: ForwardOutlookProps) {
  
  // Ensure recession risk is bounded between 0 and 100
  const safeRisk = typeof recessionRisk === 'number' && !isNaN(recessionRisk) ? Math.min(Math.max(recessionRisk, 0), 100) : 0;

  // Needle calculations to ensure total is exactly 100
  const needleWidth = 1;
  let leftValue = safeRisk - needleWidth / 2;
  let rightValue = 100 - safeRisk - needleWidth / 2;

  if (leftValue < 0) {
    rightValue += leftValue;
    leftValue = 0;
  }
  if (rightValue < 0) {
    leftValue += rightValue;
    rightValue = 0;
  }

  const needleData = [
    { value: leftValue },
    { value: needleWidth },
    { value: rightValue }
  ];

  // Custom label renderer for the 0%, 20%, 40%, etc. marks
  const renderLabel = (props: any) => {
    const { cx, cy, outerRadius, startAngle, endAngle, index } = props;
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 15;
    
    const x = cx + radius * Math.cos(-startAngle * RADIAN);
    const y = cy + radius * Math.sin(-startAngle * RADIAN);
    
    const endX = cx + radius * Math.cos(-endAngle * RADIAN);
    const endY = cy + radius * Math.sin(-endAngle * RADIAN);

    const value = index * 20;

    return (
      <g>
        <text x={x} y={y} fill="#6b7280" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold">
          {value}%
        </text>
        {index === 4 && (
          <text x={endX} y={endY} fill="#6b7280" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold">
            100%
          </text>
        )}
      </g>
    );
  };

  const BASELINE_THRESHOLD = 15;
  const ppDelta = safeRisk - BASELINE_THRESHOLD;
  const diffText = ppDelta > 0 ? `▲${ppDelta.toFixed(0)}pp vs 15% threshold` : `▼${Math.abs(ppDelta).toFixed(0)}pp vs 15% threshold`;
  const diffColor = ppDelta > 0 ? '#ff4757' : '#2ed573';

  let activeColor = '#ff4757'; // Red
  if (safeRisk < 20) activeColor = '#2ed573'; // Green
  else if (safeRisk < 40) activeColor = '#ffa502'; // Orange

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recession Risk Gauge */}
        <div className="p-4 rounded-lg border lg:col-span-1 flex flex-col" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <h6 className="text-sm font-bold uppercase tracking-wider mb-1" style={{ color: '#5dade2' }}>Recession Risk Gauge</h6>
          <p className="text-xs text-gray-500 mb-4">P(GDP &lt; 0) derived from 95% CI assuming a normal forecast distribution.</p>
          
          <div className="flex-1 relative min-h-[220px] flex items-end justify-center pb-4">
            <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  {/* Layer 0: Labels (Transparent Pie) */}
                  <Pie
                    data={[{value: 20}, {value: 20}, {value: 20}, {value: 20}, {value: 20}]}
                    cx="50%" cy="80%" startAngle={180} endAngle={0}
                    innerRadius="80%" outerRadius="80%"
                    stroke="none"
                    dataKey="value"
                    labelLine={false}
                    label={renderLabel}
                    isAnimationActive={false}
                  >
                    {[0,1,2,3,4].map((_, index) => <Cell key={`label-${index}`} fill="transparent" />)}
                  </Pie>

                  {/* Layer 1: Background Track */}
                  <Pie
                    data={[{value: 20}, {value: 20}, {value: 60}]}
                    cx="50%" cy="80%" startAngle={180} endAngle={0}
                    innerRadius="60%" outerRadius="80%"
                    stroke="none"
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    <Cell fill={isDarkMode ? "#1a362a" : "#bbf7d0"} /> {/* Green */}
                    <Cell fill={isDarkMode ? "#3d331a" : "#fef08a"} /> {/* Yellow */}
                    <Cell fill={isDarkMode ? "#3d1f24" : "#fecaca"} /> {/* Red */}
                  </Pie>

                  {/* Layer 2: Foreground Fill */}
                  <Pie
                    data={[{value: safeRisk}, {value: 100 - safeRisk}]}
                    cx="50%" cy="80%" startAngle={180} endAngle={0}
                    innerRadius="65%" outerRadius="75%"
                    stroke="none"
                    dataKey="value"
                    isAnimationActive={true}
                  >
                    <Cell fill={activeColor} />
                    <Cell fill="transparent" />
                  </Pie>

                  {/* Layer 3: Needle */}
                  <Pie
                    data={needleData}
                    cx="50%" cy="80%" startAngle={180} endAngle={0}
                    innerRadius="55%" outerRadius="85%"
                    stroke="none"
                    dataKey="value"
                    isAnimationActive={true}
                  >
                    <Cell fill="transparent" />
                    <Cell fill={isDarkMode ? "#ffffff" : "#1f2937"} /> {/* Needle */}
                    <Cell fill="transparent" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center z-10 mb-2">
              <div className="text-4xl font-bold" style={{ color: activeColor }}>{safeRisk.toFixed(0)}%</div>
              <div className="flex items-center justify-center mt-1 text-sm font-medium" style={{ color: diffColor }}>
                {diffText}
              </div>
            </div>
          </div>
        </div>

        {/* Forward Trajectory */}
        <div className="p-4 rounded-lg border lg:col-span-2 flex flex-col" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <h6 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Forward Trajectory</h6>
          <p className="text-xs text-gray-500 mb-6">Combined nowcast estimates for current and upcoming quarters.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-400 mb-1">t₀ ({formatQuarter(anchorDate)}) · Last Official</span>
              <span className="text-3xl font-bold mb-1">{formatVal(t0Actual)}%</span>
              <span className="text-xs text-gray-500">Published GDP</span>
            </div>
            
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-400 mb-1">t₁ ({formatQuarter(tPlus1Date)}) · Nowcast</span>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-bold">{formatVal(currentNowcast)}%</span>
                <span className={`text-sm font-bold ${getEconomicState(t0Actual || 0, currentNowcast || 0).deltaColor}`}>
                  {typeof currentNowcast === 'number' && typeof t0Actual === 'number' ? (currentNowcast - t0Actual > 0 ? '+' : '') + formatVal(currentNowcast - t0Actual) + 'pp' : ''}
                </span>
              </div>
              <span className={`text-xs font-semibold ${getEconomicState(t0Actual || 0, currentNowcast || 0).color}`}>
                {getEconomicState(t0Actual || 0, currentNowcast || 0).label}
              </span>
              <span className="text-[10px] text-gray-500 mt-1">{getEconomicState(t0Actual || 0, currentNowcast || 0).desc}</span>
            </div>

            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-400 mb-1">t₂ ({formatQuarter(tPlus2Date)}) · Forecast</span>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-bold">{formatVal(nextForecast)}%</span>
                <span className={`text-sm font-bold ${getEconomicState(currentNowcast || 0, nextForecast || 0).deltaColor}`}>
                  {typeof nextForecast === 'number' && typeof currentNowcast === 'number' ? (nextForecast - currentNowcast > 0 ? '+' : '') + formatVal(nextForecast - currentNowcast) + 'pp' : ''}
                </span>
              </div>
              <span className={`text-xs font-semibold ${getEconomicState(currentNowcast || 0, nextForecast || 0).color}`}>
                {getEconomicState(currentNowcast || 0, nextForecast || 0).label}
              </span>
              <span className="text-[10px] text-gray-500 mt-1">{getEconomicState(currentNowcast || 0, nextForecast || 0).desc}</span>
            </div>
          </div>

          <div className="flex-1 min-h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[
                { name: `t₀ (${formatQuarter(anchorDate)})`, value: typeof t0Actual === 'number' ? t0Actual : 0 },
                { name: `t₁ (${formatQuarter(tPlus1Date)})`, value: typeof currentNowcast === 'number' ? currentNowcast : 0 },
                { name: `t₂ (${formatQuarter(tPlus2Date)})`, value: typeof nextForecast === 'number' ? nextForecast : 0 }
              ]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--border)" tick={{ fill: 'var(--text)', fontSize: 12 }} />
                <YAxis stroke="var(--border)" tick={{ fill: 'var(--text)', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ stroke: 'var(--border)', strokeWidth: 1, strokeDasharray: '3 3' }}
                  contentStyle={{ backgroundColor: 'var(--sidebar)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  itemStyle={{ color: 'var(--text)' }}
                  formatter={(value: number) => [`${formatVal(value)}%`, 'GDP Growth']}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="var(--color-brand-primary)" 
                  strokeWidth={3}
                  dot={{ r: 6, fill: 'var(--color-brand-primary)', strokeWidth: 2, stroke: 'var(--card)' }}
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
