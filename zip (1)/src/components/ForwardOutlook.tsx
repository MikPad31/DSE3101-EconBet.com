import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface ForwardOutlookProps {
  t0Actual: number;
  currentNowcast: number;
  nextForecast: number;
  t2Forecast: number;
  recessionRisk: number;
  ciLower: number;
  ciUpper: number;
  isDarkMode?: boolean;
}

export function ForwardOutlook({ t0Actual, currentNowcast, nextForecast, t2Forecast, recessionRisk, ciLower, ciUpper, isDarkMode = true }: ForwardOutlookProps) {
  
  // Ensure recession risk is bounded between 0 and 100
  const safeRisk = Math.min(Math.max(recessionRisk, 0), 100);

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

  const diff = safeRisk - 15;
  const diffText = diff > 0 ? `▲${diff.toFixed(0)}pp vs 15% threshold` : `▼${Math.abs(diff).toFixed(0)}pp vs 15% threshold`;
  const diffColor = diff > 0 ? '#ff4757' : '#2ed573';

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
                    <Cell fill={isDarkMode ? "#1a362a" : "#dcfce7"} /> {/* Green */}
                    <Cell fill={isDarkMode ? "#3d331a" : "#fef08a"} /> {/* Yellow */}
                    <Cell fill={isDarkMode ? "#3d1f24" : "#fee2e2"} /> {/* Red */}
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
                    <Cell fill="#ffa502" /> {/* Bright Orange */}
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
              <div className="text-4xl font-bold" style={{ color: '#ffa502' }}>{safeRisk.toFixed(0)}%</div>
              <div className="flex items-center justify-center mt-1 text-sm font-medium" style={{ color: diffColor }}>
                {diffText}
              </div>
            </div>
          </div>
        </div>

        {/* Forward Trajectory */}
        <div className="p-4 rounded-lg border lg:col-span-2" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <h6 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Forward Trajectory</h6>
          <p className="text-xs text-gray-500 mb-6">Combined nowcast estimates for current and upcoming quarters.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-400 mb-1">t₀ · Last Official</span>
              <span className="text-3xl font-bold mb-1">{t0Actual.toFixed(2)}%</span>
              <span className="text-xs text-gray-500">Published GDP</span>
            </div>
            
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-400 mb-1">t₁ · Nowcast</span>
              <span className="text-3xl font-bold mb-1">{currentNowcast.toFixed(2)}%</span>
              <span className="text-xs text-gray-500">95% CI: [{ciLower.toFixed(1)}%, {ciUpper.toFixed(1)}%]</span>
            </div>

            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-400 mb-1">t₂ · Forecast</span>
              <span className="text-3xl font-bold mb-1">{nextForecast.toFixed(2)}%</span>
              <span className="text-xs text-gray-500">95% CI: [{(nextForecast - 3).toFixed(1)}%, {(nextForecast + 3).toFixed(1)}%]</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
