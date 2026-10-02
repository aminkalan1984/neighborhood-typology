import { useState } from 'react';
import { monthlyBudgetFlow } from '../data';

export default function CashFlowChart() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Find max value in cash flow to scale SVG heights correctly
  const maxVal = Math.max(...monthlyBudgetFlow.map((d) => Math.max(d.income, d.expense)));

  // SVG Dimension Constants
  const width = 586;
  const height = 180;
  const paddingLeft = 32;
  const paddingRight = 8;
  const paddingTop = 20;
  const paddingBottom = 25;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const colWidth = chartWidth / monthlyBudgetFlow.length;
  const barWidth = colWidth * 0.3; // Width of single bar (income/expense)

  return (
    <div id="cash-flow-section" className="panel-card p-5 w-full flex flex-col gap-4 select-none relative text-right">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-sm font-bold text-ink-800">نمودار تراز بودجه حاکمیتی کشور</h2>
          <p className="text-[10px] text-ink-500 mt-0.5">پایش ورودی‌های مالی خزانه در برابر ردیف‌های بودجه تخصیص‌یافته</p>
        </div>

        {/* Chart Legends */}
        <div id="chart-legends" className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-ink-800">
            <span className="w-2.5 h-2.5 bg-brand-800 rounded-sm" />
            <span>ورودی خزانه (درآمد ملی)</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-ink-800">
            <span className="w-2.5 h-2.5 bg-signal-400 rounded-sm" />
            <span>تخصیص پرداختی (هزینه)</span>
          </div>
        </div>
      </div>

      {/* SVG Chart Drawing Canvas */}
      <div id="svg-chart-container" className="relative w-full overflow-x-auto">
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-auto min-w-[500px]"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            // Store mouse position relative to SVG to draw tooltip perfectly
            setTooltipPos({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top
            });
          }}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {/* 1. Grid Lines on Y axis (4 subdivisions) */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = paddingTop + chartHeight * (1 - ratio);
            const gridVal = Math.round(maxVal * ratio);
            return (
              <g key={idx} className="opacity-40">
                <line 
                  x1={paddingLeft} 
                  y1={y} 
                  x2={width - paddingRight} 
                  y2={y} 
                  stroke="#E5E6E6" 
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text 
                  x={paddingLeft - 6} 
                  y={y + 3} 
                  textAnchor="end" 
                  className="font-mono text-[8px] fill-ink-500 font-semibold"
                >
                  {gridVal}
                </text>
              </g>
            );
          })}

          {/* 2. Monthly Columns */}
          {monthlyBudgetFlow.map((data, idx) => {
            const colCenterX = paddingLeft + (idx * colWidth) + (colWidth / 2);
            
            // Income bar sizing
            const incomeBarHeight = (data.income / maxVal) * chartHeight;
            const incomeX = colCenterX - barWidth - 1;
            const incomeY = paddingTop + chartHeight - incomeBarHeight;

            // Expense bar sizing
            const expenseBarHeight = (data.expense / maxVal) * chartHeight;
            const expenseX = colCenterX + 1;
            const expenseY = paddingTop + chartHeight - expenseBarHeight;

            const isHovered = hoveredIndex === idx;

            return (
              <g 
                key={idx} 
                onMouseEnter={() => setHoveredIndex(idx)}
                className="cursor-pointer transition-all duration-200"
              >
                {/* Invisible hover area for easier touch targeting */}
                <rect
                  x={paddingLeft + (idx * colWidth)}
                  y={paddingTop}
                  width={colWidth}
                  height={chartHeight}
                  fill="transparent"
                />

                {/* Monthly X label */}
                <text
                  x={colCenterX}
                  y={height - 6}
                  textAnchor="middle"
                  className={`text-[9px] font-semibold transition-colors duration-200 ${
                    isHovered ? 'fill-brand-800 font-bold' : 'fill-ink-500'
                  }`}
                >
                  {data.month}
                </text>

                {/* Income Bar */}
                <rect
                  x={incomeX}
                  y={incomeY}
                  width={barWidth}
                  height={incomeBarHeight}
                  fill="#1E4841"
                  rx="2"
                  className="transition-all duration-300"
                  style={{
                    opacity: hoveredIndex === null || isHovered ? 1 : 0.6,
                    filter: isHovered ? 'brightness(1.1)' : 'none'
                  }}
                />

                {/* Expense Bar */}
                <rect
                  x={expenseX}
                  y={expenseY}
                  width={barWidth}
                  height={expenseBarHeight}
                  fill="#BBF49C"
                  rx="2"
                  className="transition-all duration-300"
                  style={{
                    opacity: hoveredIndex === null || isHovered ? 1 : 0.6,
                    filter: isHovered ? 'brightness(1.05)' : 'none'
                  }}
                />
              </g>
            );
          })}
        </svg>

        {/* 3. Floating Custom HTML Tooltip matching CSS specs exactly */}
        {hoveredIndex !== null && (
          <div 
            className="absolute bg-surface border border-line p-3 rounded-xl shadow-xl z-30 flex flex-col gap-1.5 pointer-events-none text-right text-[10px]"
            style={{
              left: `${tooltipPos.x + 15}px`,
              top: `${tooltipPos.y - 75}px`,
              animation: 'fadeIn 0.15s ease-out'
            }}
          >
            <span className="font-bold text-brand-800 border-b border-line pb-1 block text-[11px]">
              تراز بودجه {monthlyBudgetFlow[hoveredIndex].month}
            </span>
            <div className="flex flex-col gap-1 mt-1 text-ink-800">
              <div className="flex items-center justify-between gap-6">
                <span className="text-ink-500">درآمد کل خزانه:</span>
                <span className="font-bold text-brand-800 font-mono">
                  {monthlyBudgetFlow[hoveredIndex].income.toLocaleString()} م.$
                </span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span className="text-ink-500">تخصیص پرداختی:</span>
                <span className="font-bold text-danger font-mono">
                  {monthlyBudgetFlow[hoveredIndex].expense.toLocaleString()} م.$
                </span>
              </div>
              <div className="flex items-center justify-between gap-6 border-t border-line pt-1 mt-1">
                <span className="text-ink-500 font-medium">مازاد خالص (تراز):</span>
                <span className="font-extrabold text-brand-800 font-mono">
                  {(monthlyBudgetFlow[hoveredIndex].income - monthlyBudgetFlow[hoveredIndex].expense).toLocaleString()} م.$
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
