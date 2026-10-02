import { useState } from 'react';
import { sectorExpenditures } from '../data';

interface CategoryDonutProps {
  totalExpenses: number;
}

export default function CategoryDonut({ totalExpenses }: CategoryDonutProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // SVG parameters for standard concentric circular arcs or donut sector
  const size = 150;
  const radius = 60;
  const strokeWidth = 16;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Compute absolute cumulative offsets
  let accumulatedPercentage = 0;

  return (
    <div id="category-donut-section" className="border border-line bg-surface rounded-2xl p-5 w-full flex flex-col gap-4 shadow-sm select-none text-right">
      {/* Header */}
      <div className="flex flex-col">
        <h2 className="text-sm font-bold text-ink-800">سهم مصارف بودجه حاکمیتی</h2>
        <p className="text-[10px] text-ink-500 mt-0.5">پایش بلادرنگ درصد تسهیم ردیف‌های بودجه ملی کشور</p>
      </div>

      {/* Donut Chart Visual */}
      <div id="donut-wrapper" className="relative flex justify-center py-2">
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Base circle background */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#F5F6F6"
            strokeWidth={strokeWidth}
          />

          {sectorExpenditures.map((expense, idx) => {
            const strokeDasharray = `${(expense.percentage / 100) * circumference} ${circumference}`;
            const strokeDashoffset = -((accumulatedPercentage / 100) * circumference);
            
            // Advance cumulative count
            accumulatedPercentage += expense.percentage;

            const isHovered = hoveredIdx === idx;

            return (
              <circle
                key={idx}
                cx={center}
                cy={center}
                r={radius}
                fill="transparent"
                stroke={expense.color}
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="transition-all duration-300 cursor-pointer origin-center"
                style={{
                  transformBox: 'fill-box',
                  filter: isHovered ? 'drop-shadow(0px 2px 4px rgba(0,0,0,0.1))' : 'none'
                }}
              />
            );
          })}
        </svg>

        {/* Center overlay label */}
        <div 
          id="donut-center-label" 
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center"
        >
          {hoveredIdx !== null ? (
            <>
              <span className="text-[9px] text-brand-800 font-bold">
                {sectorExpenditures[hoveredIdx].name.slice(0, 15)}...
              </span>
              <span className="text-sm font-bold text-ink-800 font-mono mt-0.5">
                {sectorExpenditures[hoveredIdx].percentage}٪
              </span>
            </>
          ) : (
            <>
              <span className="text-[8px] text-ink-500 font-semibold">کل مصارف</span>
              <span className="text-xs font-extrabold text-brand-800 font-mono mt-0.5">
                {totalExpenses.toLocaleString()} م.$
              </span>
            </>
          )}
        </div>
      </div>

      {/* Details List */}
      <div id="donut-details" className="flex flex-col gap-2.5 mt-1">
        {sectorExpenditures.map((expense, idx) => {
          const isHovered = hoveredIdx === idx;
          const actualAmount = Math.round((expense.percentage / 100) * totalExpenses);

          return (
            <div 
              key={idx}
              className={`flex items-center justify-between p-2 rounded-xl transition-all duration-200 ${
                isHovered ? 'bg-brand-100' : 'bg-transparent'
              }`}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="flex items-center gap-2">
                {/* Colored percentage pill */}
                <div 
                  className="px-2 py-0.5 rounded-md text-[9px] font-bold text-center flex items-center justify-center min-w-8"
                  style={{ 
                    backgroundColor: expense.color === '#E5E6E6' ? '#BBF49C' : expense.color, 
                    color: expense.color === '#1E4841' ? '#ECF4E9' : '#242E2C' 
                  }}
                >
                  {expense.percentage}٪
                </div>
                <span className="text-[11px] text-ink-800 font-semibold">{expense.name}</span>
              </div>
              <span className="text-[11px] font-mono font-bold text-ink-800">
                {actualAmount.toLocaleString()} میلیون دلار
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
