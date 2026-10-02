import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import { 
  TrendingUp, 
  HelpCircle, 
  Eye, 
  EyeOff, 
  Layers, 
  Info,
  Calendar,
  Sparkles,
  Sliders,
  Maximize2,
  Minimize2
} from 'lucide-react';

export interface FanChartDataPoint {
  year: string | number;
  actual?: number | null;
  baseline: number;
  p5: number;   // 90% CI Lower
  p25: number;  // 50% CI Lower
  p75: number;  // 50% CI Upper
  p95: number;  // 90% CI Upper
  isForecast?: boolean;
}

export interface FanChartProps {
  data?: FanChartDataPoint[];
  title?: string;
  subtitle?: string;
  unit?: string;
  height?: number;
  primaryColor?: string; // Hex color for baseline
  bandColor?: string;    // Base color for confidence bands
  currentYear?: number | string;
  onYearSelect?: (yearData: FanChartDataPoint) => void;
}

// Realistic default sample data for ISGP Water Stress & Economic Projection (1400 - 1412)
export const DEFAULT_FAN_DATA: FanChartDataPoint[] = [
  { year: '۱۴۰۰', actual: 42.5, baseline: 42.5, p5: 42.5, p25: 42.5, p75: 42.5, p95: 42.5, isForecast: false },
  { year: '۱۴۰۱', actual: 41.2, baseline: 41.2, p5: 41.2, p25: 41.2, p75: 41.2, p95: 41.2, isForecast: false },
  { year: '۱۴۰۲', actual: 39.8, baseline: 39.8, p5: 39.8, p25: 39.8, p75: 39.8, p95: 39.8, isForecast: false },
  { year: '۱۴۰۳', actual: 38.5, baseline: 38.5, p5: 38.5, p25: 38.5, p75: 38.5, p95: 38.5, isForecast: false },
  // Projection Starts
  { year: '۱۴۰۴ (پیش‌بینی)', actual: null, baseline: 41.0, p5: 36.0, p25: 38.8, p75: 43.2, p95: 46.5, isForecast: true },
  { year: '۱۴۰۵', actual: null, baseline: 43.8, p5: 37.2, p25: 40.5, p75: 46.8, p95: 50.4, isForecast: true },
  { year: '۱۴۰۶', actual: null, baseline: 46.5, p5: 38.1, p25: 42.2, p75: 50.1, p95: 55.2, isForecast: true },
  { year: '۱۴۰۷', actual: null, baseline: 49.2, p5: 39.0, p25: 44.0, p75: 53.8, p95: 60.1, isForecast: true },
  { year: '۱۴۰۸', actual: null, baseline: 52.0, p5: 40.2, p25: 45.8, p75: 57.5, p95: 65.8, isForecast: true },
  { year: '۱۴۰۹', actual: null, baseline: 55.4, p5: 41.5, p25: 47.9, p75: 61.8, p95: 71.5, isForecast: true },
  { year: '۱۴۱۰', actual: null, baseline: 58.8, p5: 42.8, p25: 50.0, p75: 66.2, p95: 77.2, isForecast: true },
  { year: '۱۴۱۱', actual: null, baseline: 62.1, p5: 44.0, p25: 52.2, p75: 70.5, p95: 83.0, isForecast: true },
  { year: '۱۴۱۲', actual: null, baseline: 65.5, p5: 45.2, p25: 54.5, p75: 75.0, p95: 89.0, isForecast: true },
];

export default function FanChart({
  data = DEFAULT_FAN_DATA,
  title = 'نمودار بادبزنی پیش‌بینی شاخص',
  subtitle = 'نمایش خط پایه هدف همراه با فواصل اطمینان ۵۰٪ و ۹۰٪ عدم‌قطعیت آینده',
  unit = 'میلیون مترمکعب / سال',
  height = 380,
  primaryColor = '#1E4841',
  bandColor = '#10B981',
  currentYear = '۱۴۰۳',
  onYearSelect
}: FanChartProps) {
  const [show90Band, setShow90Band] = useState<boolean>(true);
  const [show50Band, setShow50Band] = useState<boolean>(true);
  const [showActuals, setShowActuals] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // تمام‌صفحه: بستن با کلید Escape + قفل اسکرول صفحه (بازگردانی مقدار قبلی)
  useEffect(() => {
    if (!isFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen]);

  // Transform data for Recharts interval rendering:
  // Recharts Area with dataKey array e.g. [lower, upper] renders a range band
  const formattedData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      // Range tuples for Recharts Area
      ci90: [item.p5, item.p95],
      ci50: [item.p25, item.p75],
    }));
  }, [data]);

  // Selected Data Stats Summary
  const forecastEnd = formattedData[formattedData.length - 1];

  return (
    <div
      className={`w-full bg-surface border border-line rounded-2xl p-4 flex flex-col gap-3 shadow-xs text-right transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 overflow-y-auto' : ''
      }`}
    >
      
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-ok-soft border border-ok/40 text-ok flex items-center justify-center font-bold">
            <TrendingUp size={20} />
          </div>
          <div>
            <h3 className="text-xs font-black text-brand-800 flex items-center gap-2">
              <span>{title}</span>
              <span className="text-[10px] bg-ok-soft text-ok border border-ok/40 px-2 py-0.5 rounded-full font-bold">
                تحلیل عدم‌قطعیت Monte Carlo
              </span>
            </h3>
            <p className="text-[10.5px] text-ink-500 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* Band Toggle Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShow90Band(!show90Band)}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
              show90Band 
                ? 'bg-ok-soft text-ok border-ok/40 shadow-2xs' 
                : 'bg-paper text-ink-300 border-line'
            }`}
          >
            {show90Band ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>بازه اطمینان ۹۰٪ (p5 - p95)</span>
          </button>

          <button
            onClick={() => setShow50Band(!show50Band)}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
              show50Band 
                ? 'bg-ok-soft text-brand-950 border-signal-400 shadow-2xs font-black' 
                : 'bg-paper text-ink-300 border-line'
            }`}
          >
            {show50Band ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>بازه اطمینان ۵۰٪ (p25 - p75)</span>
          </button>

          <button
            onClick={() => setShowActuals(!showActuals)}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
              showActuals 
                ? 'bg-paper text-brand-800 border-line-strong' 
                : 'bg-paper text-ink-300 border-line'
            }`}
          >
            {showActuals ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>عملکرد واقعی گذشته</span>
          </button>

          <span className="w-px h-5 bg-line hidden sm:block" />

          <button
            onClick={() => setIsFullscreen((f) => !f)}
            aria-pressed={isFullscreen}
            aria-label={isFullscreen ? 'خروج از تمام‌صفحه' : 'نمایش تمام‌صفحه'}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
              isFullscreen
                ? 'bg-brand-800 text-signal-400 border-brand-800 shadow-2xs'
                : 'bg-surface text-ink-700 border-line-strong hover:bg-paper'
            }`}
            title={isFullscreen ? 'خروج از تمام‌صفحه (Esc)' : 'نمایش تمام‌صفحه'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span>{isFullscreen ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}</span>
          </button>
        </div>
      </div>

      {/* Main Chart Container */}
      <div
        style={{ height: isFullscreen ? 'calc(100vh - 230px)' : `${height}px` }}
        className="w-full relative pt-2 transition-all duration-300"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={formattedData}
            margin={{ top: 15, right: 10, left: 10, bottom: 5 }}
            onClick={(e: any) => {
              if (e && e.activePayload && e.activePayload[0] && onYearSelect) {
                onYearSelect(e.activePayload[0].payload);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E6E6" vertical={false} />
            <XAxis 
              dataKey="year" 
              tick={{ fontSize: 11, fill: '#6B7271', fontWeight: 'bold' }}
              tickLine={false}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: '#6B7271', fontWeight: 'bold' }}
              tickLine={false}
              axisLine={false}
              unit={` ${unit.split('/')[0]}`}
            />
            
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const dataObj = payload[0].payload as FanChartDataPoint;
                  return (
                    <div className="bg-surface border border-line rounded-xl p-3 shadow-lg text-right font-sans text-xs flex flex-col gap-1.5 max-w-[240px]">
                      <div className="flex items-center justify-between border-b border-line pb-1 font-black text-brand-800">
                        <span>سال {label}</span>
                        <span className="text-[10px] text-ink-400 font-mono">
                          {dataObj.isForecast ? 'پیش‌بینی' : 'ثبت واقعی'}
                        </span>
                      </div>

                      {dataObj.actual !== null && dataObj.actual !== undefined && (
                        <div className="flex items-center justify-between text-gray-800">
                          <span className="font-bold">عملکرد واقعی:</span>
                          <span className="font-mono font-black text-gray-900">{dataObj.actual} {unit}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-brand-800">
                        <span className="font-bold">خط پایه هدف:</span>
                        <span className="font-mono font-black">{dataObj.baseline} {unit}</span>
                      </div>

                      {dataObj.isForecast && (
                        <div className="mt-1 pt-1 border-t border-gray-100 flex flex-col gap-1 text-[10.5px]">
                          <div className="flex items-center justify-between text-ok">
                            <span>بازه ۵۰٪ (p25 - p75):</span>
                            <span className="font-mono font-bold">{dataObj.p25} تا {dataObj.p75}</span>
                          </div>
                          <div className="flex items-center justify-between text-brand-950">
                            <span>بازه ۹۰٪ (p5 - p95):</span>
                            <span className="font-mono font-bold">{dataObj.p5} تا {dataObj.p95}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />

            {/* Reference Line for Present Year */}
            {currentYear && (
              <ReferenceLine 
                x={currentYear} 
                stroke="#6366F1" 
                strokeDasharray="4 4" 
                strokeWidth={2}
                label={{ 
                  value: 'شروع پیش‌بینی', 
                  position: 'top', 
                  fill: '#6366F1', 
                  fontSize: 10, 
                  fontWeight: 'bold' 
                }} 
              />
            )}

            {/* 90% Confidence Interval Band (Widest) */}
            {show90Band && (
              <Area
                type="monotone"
                dataKey="ci90"
                stroke="none"
                fill={bandColor}
                fillOpacity={0.15}
                name="بازه اطمینان ۹۰٪"
                isAnimationActive={true}
              />
            )}

            {/* 50% Confidence Interval Band (Narrower) */}
            {show50Band && (
              <Area
                type="monotone"
                dataKey="ci50"
                stroke="none"
                fill={bandColor}
                fillOpacity={0.35}
                name="بازه اطمینان ۵۰٪"
                isAnimationActive={true}
              />
            )}

            {/* Primary Baseline Forecast Line */}
            <Line
              type="monotone"
              dataKey="baseline"
              stroke={primaryColor}
              strokeWidth={3}
              dot={{ r: 3, fill: primaryColor }}
              activeDot={{ r: 6, fill: '#BBF49C', stroke: primaryColor, strokeWidth: 2 }}
              name="خط پایه"
            />

            {/* Historical Actuals Line */}
            {showActuals && (
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#374151"
                strokeWidth={2.5}
                strokeDasharray="2 2"
                dot={{ r: 4, fill: '#374151' }}
                name="عملکرد واقعی"
                connectNulls={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Info & Legend Key */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-line text-[11px]">
        
        {/* Legend Indicators */}
        <div className="flex items-center gap-4 flex-wrap text-ink-700">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="w-4 h-1 bg-brand-800 rounded-full inline-block" />
            <span>خط پایه هدف</span>
          </div>

          <div className="flex items-center gap-1.5 font-bold">
            <span className="w-3 h-3 rounded bg-ok-soft/40 inline-block border border-ok/60" />
            <span>محدوده اطمینان ۵۰٪ (p25-p75)</span>
          </div>

          <div className="flex items-center gap-1.5 font-bold">
            <span className="w-3 h-3 rounded bg-ok-soft/15 inline-block border border-ok/30" />
            <span>محدوده اطمینان ۹۰٪ (p5-p95)</span>
          </div>

          <div className="flex items-center gap-1.5 font-bold">
            <span className="w-4 h-0.5 bg-gray-700 border-b border-dashed border-gray-700 inline-block" />
            <span>آمار ثبت‌شده واقعی</span>
          </div>
        </div>

        {/* Forecast End Target Badge */}
        {forecastEnd && (
          <div className="flex items-center gap-1.5 text-xs font-bold bg-brand-100 text-brand-800 px-2.5 py-1 rounded-xl border border-signal-400">
            <Sparkles size={13} />
            <span>پیش‌بینی انتها ({forecastEnd.year}):</span>
            <span className="font-mono font-black">{forecastEnd.baseline} {unit}</span>
            <span className="text-[10px] text-ok font-mono">({forecastEnd.p5} ~ {forecastEnd.p95})</span>
          </div>
        )}

      </div>

    </div>
  );
}
