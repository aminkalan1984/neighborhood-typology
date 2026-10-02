import { useState } from 'react';
import { X, PieChart, Layers, ShieldCheck, ChevronRight, BarChart2, Info, Download, ArrowUpRight, ArrowDownRight, GitCommit } from 'lucide-react';
import { toPersianDigits } from './AnimatedCounter';

export interface KPIMember {
  id: string;
  name: string;
  value: number;
  unit: string;
  status: 'excellent' | 'stable' | 'warning' | 'critical';
  target: number;
  source: string;
  confidence: number;
}

interface SubMetric {
  id: string;
  name: string;
  weight: number; // Percentage weight e.g. 25
  score: number; // Current value/score
  status: 'excellent' | 'stable' | 'warning' | 'critical';
  description: string;
}

interface SectorCategory {
  id: string;
  name: string;
  weight: number; // Percentage of total index e.g. 40
  color: string;
  subMetrics: SubMetric[];
}

interface KPIBreakdownExplorerProps {
  kpi: KPIMember | null;
  isOpen: boolean;
  onClose: () => void;
}

// Generate realistic hierarchical data for each KPI
const getBreakdownData = (kpiId: string): SectorCategory[] => {
  switch (kpiId) {
    case 'gdp-growth':
      return [
        {
          id: 'sec-ind',
          name: 'صنعت، معدن و فرآوری',
          weight: 40,
          color: '#1E4841',
          subMetrics: [
            { id: 'sub-1', name: 'صنایع دانش‌بنیان پیشرفته', weight: 18, score: 7.2, status: 'excellent', description: 'تولیدات با ارزش افزوده بالا در زنجیره معدن' },
            { id: 'sub-2', name: 'صادرات فولادی و آلیاژی', weight: 14, score: 5.8, status: 'stable', description: 'تولید مقاطع فولاد و کرومیت' },
            { id: 'sub-3', name: 'ماشین‌آلات و تجهیزات صنعتی', weight: 8, score: 4.1, status: 'warning', description: 'نوسازی ناوگان تولید کارخانجات' },
          ]
        },
        {
          id: 'sec-serv',
          name: 'خدمات، فناوری و ترانزیت',
          weight: 35,
          color: '#10B981',
          subMetrics: [
            { id: 'sub-4', name: 'پلتفرم‌ها و اقتصاد دیجیتال', weight: 20, score: 8.5, status: 'excellent', description: 'توسعه خدمات C2B و فیبر نوری' },
            { id: 'sub-5', name: 'ترانزیت ریلی و بندری', weight: 15, score: 6.0, status: 'stable', description: 'کریدورهای تجاری شمال-جنوب' },
          ]
        },
        {
          id: 'sec-agri',
          name: 'کشاورزی نوین و صنایع دستی',
          weight: 25,
          color: '#F59E0B',
          subMetrics: [
            { id: 'sub-6', name: 'صنایع دستی و بوم‌گردی', weight: 15, score: 6.8, status: 'excellent', description: 'فرش و گلیم ثبت یونسکو' },
            { id: 'sub-7', name: 'کشاورزی گلخانه‌ای کم‌آب‌بر', weight: 10, score: 3.2, status: 'critical', description: 'کشت‌های صنعتی مدرن' },
          ]
        }
      ];
    case 'water-stress':
      return [
        {
          id: 'sec-agri-water',
          name: 'مصرف کشاورزی و چاه‌ها',
          weight: 55,
          color: '#EF4444',
          subMetrics: [
            { id: 'sub-w1', name: 'اضافه‌برداشت چاه‌های غیرمجاز', weight: 30, score: 88, status: 'critical', description: 'برداشت از آبخوان‌های ممنوعه بختگان' },
            { id: 'sub-w2', name: 'راندمان آبیاری سنتی', weight: 25, score: 75, status: 'warning', description: 'تلفات در کانال‌های انتقال خاکی' },
          ]
        },
        {
          id: 'sec-ind-water',
          name: 'مصارف صنعتی و معدنی',
          weight: 25,
          color: '#F59E0B',
          subMetrics: [
            { id: 'sub-w3', name: 'بازچرخانی پساب صنعتی', weight: 15, score: 62, status: 'stable', description: 'استفاده مجدد آب در فرآوری کرومیت' },
            { id: 'sub-w4', name: 'انتقال آب دریا به صنایع', weight: 10, score: 45, status: 'stable', description: 'پروژه‌های شیرین‌سازی جنوب' },
          ]
        },
        {
          id: 'sec-climate',
          name: 'تغییرات اقلیمی و کاهش بارندگی',
          weight: 20,
          color: '#9333EA',
          subMetrics: [
            { id: 'sub-w5', name: 'کاهش تغذیه طبیعی سفره‌ها', weight: 20, score: 82, status: 'critical', description: 'خشکسالی انباشته زاگرس' },
          ]
        }
      ];
    default:
      return [
        {
          id: 'sec-gen-1',
          name: 'مؤلفه‌های ساختاری و نهادی',
          weight: 50,
          color: '#1E4841',
          subMetrics: [
            { id: 'sub-g1', name: 'قوانین و مصوبات حاکمیتی', weight: 30, score: 72, status: 'stable', description: 'مصوبات دیوان محاسبات و هیئت دولت' },
            { id: 'sub-g2', name: 'شفافیت و پلتفرم‌های داده', weight: 20, score: 85, status: 'excellent', description: 'سامانه شفافیت آرا و بودجه' },
          ]
        },
        {
          id: 'sec-gen-2',
          name: 'عوامل اجرایی و فضایی',
          weight: 50,
          color: '#3B82F6',
          subMetrics: [
            { id: 'sub-g3', name: 'تخصیص اعتبارات استانی', weight: 30, score: 64, status: 'warning', description: 'توزیع متوازن بودجه در استان‌ها' },
            { id: 'sub-g4', name: 'پایش و نظارت میدانی', weight: 20, score: 78, status: 'stable', description: 'بازرسی‌های دوره‌ای هوشمند' },
          ]
        }
      ];
  }
};

export default function KPIBreakdownExplorer({ kpi, isOpen, onClose }: KPIBreakdownExplorerProps) {
  const [activeSegment, setActiveSegment] = useState<{ name: string; weight: number; desc: string } | null>(null);
  const [explorerTab, setExplorerTab] = useState<'sunburst' | 'tree'>('sunburst');

  if (!isOpen || !kpi) return null;

  const sectors = getBreakdownData(kpi.id);

  // Helper math for Sunburst SVG arcs calculation
  let accumulatedAngleSector = 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-fade-in">
      {/* Sliding Drawer Container */}
      <div 
        id="kpi-breakdown-drawer" 
        className="w-full max-w-2xl bg-surface dark:bg-wall-900 h-full shadow-2xl border-r border-line dark:border-wall-700 flex flex-col justify-between overflow-hidden text-right"
        dir="rtl"
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-line dark:border-wall-700 flex items-center justify-between bg-surface dark:bg-wall-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-wall-800 text-brand-800 dark:text-signal-400 flex items-center justify-center font-bold">
              <PieChart size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-brand-800 dark:text-signal-400">
                  کاوشگر شکست و ساختار شاخص
                </h2>
                <span className="text-[10px] bg-brand-800 text-signal-400 font-bold px-2 py-0.5 rounded-full">
                  تحلیل خورشیدی
                </span>
              </div>
              <p className="text-xs text-ink-500 mt-0.5">
                نمایش وزن، مؤلفه‌ها و سهم لایه‌های زیرین شاخص «{kpi.name}»
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-paper hover:bg-line dark:bg-wall-800 dark:hover:bg-wall-700 text-ink-700 dark:text-ink-300 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="p-6 flex-grow overflow-y-auto flex flex-col gap-6">
          
          {/* Main KPI Summary Strip */}
          <div className="p-4 bg-brand-100/50 dark:bg-wall-800/60 border border-brand-800/20 dark:border-wall-700 rounded-2xl flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-ink-500 dark:text-ink-400 font-bold">شاخص مورد کاوش:</span>
              <span className="text-sm font-black text-brand-800 dark:text-signal-400">{kpi.name}</span>
            </div>
            <div className="flex items-baseline gap-1 bg-surface dark:bg-wall-900 px-4 py-2 rounded-xl border border-line dark:border-wall-700 shadow-sm font-mono">
              <span className="text-2xl font-black text-brand-800 dark:text-signal-400">{toPersianDigits(kpi.value)}</span>
              <span className="text-xs text-ink-500 font-semibold">{kpi.unit}</span>
            </div>
          </div>

          {/* View Switcher: Sunburst vs Tree Table */}
          <div className="flex items-center justify-between border-b pb-2 border-line dark:border-wall-700">
            <span className="text-xs font-black text-brand-800 dark:text-signal-400 flex items-center gap-1.5">
              <Layers size={16} />
              نقشه وزن‌دهی ترکیبی
            </span>
            <div className="flex bg-paper dark:bg-wall-800 p-1 rounded-xl text-xs font-bold">
              <button 
                onClick={() => setExplorerTab('sunburst')}
                className={`px-3 py-1 rounded-lg transition-all ${explorerTab === 'sunburst' ? 'bg-surface dark:bg-wall-700 text-brand-800 dark:text-signal-400 shadow-sm' : 'text-ink-500'}`}
              >
                نمودار خورشیدی
              </button>
              <button 
                onClick={() => setExplorerTab('tree')}
                className={`px-3 py-1 rounded-lg transition-all ${explorerTab === 'tree' ? 'bg-surface dark:bg-wall-700 text-brand-800 dark:text-signal-400 shadow-sm' : 'text-ink-500'}`}
              >
                جدول سهم‌بندی
              </button>
            </div>
          </div>

          {/* TAB 1: Interactive Sunburst Chart */}
          {explorerTab === 'sunburst' ? (
            <div className="flex flex-col items-center gap-6">
              {/* Sunburst SVG Container */}
              <div className="relative w-72 h-72 flex items-center justify-center">
                <svg viewBox="0 0 300 300" className="w-full h-full transform -rotate-90 select-none">
                  {/* Center Circle (Total KPI) */}
                  <circle 
                    cx="150" 
                    cy="150" 
                    r="40" 
                    fill="#1E4841" 
                    className="transition-transform hover:scale-105 cursor-pointer"
                  />
                  
                  {/* Render Level 1 Sector Arcs (Inner Ring) */}
                  {sectors.map((sector) => {
                    const sectorAngle = (sector.weight / 100) * 360;
                    const startAngle = accumulatedAngleSector;
                    const endAngle = startAngle + sectorAngle;
                    accumulatedAngleSector = endAngle;

                    // Convert angles to SVG arc coordinates for radius 75 (Inner Ring)
                    const rInner = 48;
                    const rOuter = 82;
                    
                    const startRad = (startAngle * Math.PI) / 180;
                    const endRad = (endAngle * Math.PI) / 180;

                    const x1 = 150 + rInner * Math.cos(startRad);
                    const y1 = 150 + rInner * Math.sin(startRad);
                    const x2 = 150 + rOuter * Math.cos(startRad);
                    const y2 = 150 + rOuter * Math.sin(startRad);
                    const x3 = 150 + rOuter * Math.cos(endRad);
                    const y3 = 150 + rOuter * Math.sin(endRad);
                    const x4 = 150 + rInner * Math.cos(endRad);
                    const y4 = 150 + rInner * Math.sin(endRad);

                    const largeArc = sectorAngle > 180 ? 1 : 0;

                    const pathData = `
                      M ${x1} ${y1}
                      L ${x2} ${y2}
                      A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x3} ${y3}
                      L ${x4} ${y4}
                      A ${rInner} ${rInner} 0 ${largeArc} 0 ${x1} ${y1}
                      Z
                    `;

                    return (
                      <path
                        key={sector.id}
                        d={pathData}
                        fill={sector.color}
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="transition-all hover:opacity-80 cursor-pointer"
                        onMouseEnter={() => setActiveSegment({ name: sector.name, weight: sector.weight, desc: `سهم بخش از کل شاخص: ${sector.weight}٪` })}
                        onMouseLeave={() => setActiveSegment(null)}
                      />
                    );
                  })}

                  {/* Render Level 2 SubMetric Arcs (Outer Ring) */}
                  {(() => {
                    let accAngleSub = 0;
                    return sectors.flatMap((sector) => {
                      return sector.subMetrics.map((sub) => {
                        const subAngle = (sub.weight / 100) * 360;
                        const startAngle = accAngleSub;
                        const endAngle = startAngle + subAngle;
                        accAngleSub = endAngle;

                        const rInner = 86;
                        const rOuter = 125;

                        const startRad = (startAngle * Math.PI) / 180;
                        const endRad = (endAngle * Math.PI) / 180;

                        const x1 = 150 + rInner * Math.cos(startRad);
                        const y1 = 150 + rInner * Math.sin(startRad);
                        const x2 = 150 + rOuter * Math.cos(startRad);
                        const y2 = 150 + rOuter * Math.sin(startRad);
                        const x3 = 150 + rOuter * Math.cos(endRad);
                        const y3 = 150 + rOuter * Math.sin(endRad);
                        const x4 = 150 + rInner * Math.cos(endRad);
                        const y4 = 150 + rInner * Math.sin(endRad);

                        const largeArc = subAngle > 180 ? 1 : 0;

                        const pathData = `
                          M ${x1} ${y1}
                          L ${x2} ${y2}
                          A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x3} ${y3}
                          L ${x4} ${y4}
                          A ${rInner} ${rInner} 0 ${largeArc} 0 ${x1} ${y1}
                          Z
                        `;

                        return (
                          <path
                            key={sub.id}
                            d={pathData}
                            fill={sector.color}
                            fillOpacity="0.75"
                            stroke="#ffffff"
                            strokeWidth="1.5"
                            className="transition-all hover:fill-opacity-100 cursor-pointer"
                            onMouseEnter={() => setActiveSegment({ name: sub.name, weight: sub.weight, desc: sub.description })}
                            onMouseLeave={() => setActiveSegment(null)}
                          />
                        );
                      });
                    });
                  })()}
                </svg>

                {/* Center Overlay Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white pointer-events-none text-center font-mono">
                  <span className="text-[10px] font-bold opacity-80">وزن کل</span>
                  <span className="text-lg font-black">{toPersianDigits(100)}٪</span>
                </div>
              </div>

              {/* Hovered Segment Details Box */}
              <div className="w-full p-3.5 bg-paper dark:bg-wall-800 rounded-2xl border border-line dark:border-wall-700 min-h-[70px] flex items-center justify-between">
                {activeSegment ? (
                  <div className="flex flex-col gap-1 text-right">
                    <span className="text-xs font-black text-brand-800 dark:text-signal-400">{activeSegment.name}</span>
                    <span className="text-[11px] text-ink-700 dark:text-ink-300">{activeSegment.desc}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-ink-400 text-xs mx-auto">
                    <Info size={16} />
                    <span>برای مشاهده جزئیات و وزن دقیق، روی بخش‌های نمودار خورشیدی شناور شوید.</span>
                  </div>
                )}
                {activeSegment && (
                  <span className="text-base font-black font-mono text-brand-800 dark:text-signal-400 bg-surface dark:bg-wall-900 px-3 py-1 rounded-xl border border-line dark:border-wall-700">
                    {toPersianDigits(activeSegment.weight)}٪
                  </span>
                )}
              </div>

              {/* Legend Badges */}
              <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {sectors.map((s) => (
                  <div key={s.id} className="p-2.5 rounded-xl border border-line dark:border-wall-700 flex items-center gap-2.5 bg-surface dark:bg-wall-900 shadow-sm">
                    <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <div className="flex flex-col truncate text-right">
                      <span className="font-bold text-ink-800 dark:text-slate-200 text-[11px] truncate">{s.name}</span>
                      <span className="text-[10px] text-ink-500 font-mono">وزن: {toPersianDigits(s.weight)}٪</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* CONTRIBUTION WATERFALL COMPONENT (آبشار سهم تغییرات) */}
              <div className="w-full mt-2 p-4 bg-paper dark:bg-wall-900/80 rounded-2xl border border-line dark:border-wall-700 flex flex-col gap-3.5">
                <div className="flex items-center justify-between border-b pb-2.5 border-line dark:border-wall-700">
                  <div className="flex items-center gap-2">
                    <GitCommit size={16} className="text-brand-800 dark:text-signal-400" />
                    <h3 className="text-xs font-black text-brand-800 dark:text-signal-400">
                      تحلیل آبشار سهم تغییرات نسبت به دوره قبل
                    </h3>
                  </div>
                  <span className="text-[10px] bg-ok-soft dark:bg-wall-900/60 text-ok dark:text-signal-300 font-extrabold px-2 py-0.5 rounded-full border border-ok/40 dark:border-wall-800">
                    رشد خالص: ۴.۵٪+
                  </span>
                </div>

                <p className="text-[10.5px] text-ink-500 dark:text-ink-400 leading-relaxed text-right">
                  تفکیک سهم هر یک از مؤلفه‌های زیرمجموعه در جابه‌جایی شاخص «{kpi.name}» نسبت به ارزیابی سه‌ماهه گذشته:
                </p>

                {/* Waterfall Item Bars */}
                <div className="flex flex-col gap-2 text-xs">
                  {/* Baseline Step */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-surface dark:bg-wall-800 border border-line dark:border-wall-700/60">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                      <span className="font-bold text-ink-700 dark:text-slate-200 text-[11px]">مقدار پایه دوره قبل (پاییز ۱۴۰۴)</span>
                    </div>
                    <span className="font-mono font-black text-ink-700 dark:text-slate-200">{toPersianDigits(74.5)} {kpi.unit}</span>
                  </div>

                  {/* Waterfall Deltas */}
                  {[
                    { name: 'بازچرخانی پساب صنعتی و شیرین‌سازی جنوب', type: 'positive', delta: 2.8, desc: 'افزایش ظرفیت تصفیه‌خانه‌های صنعتی' },
                    { name: 'انسداد چاه‌های کشاورزی غیرمجاز دشت نی‌ریز', type: 'positive', delta: 2.1, desc: 'کنترل برداشت بی‌رویه سفره زیرزمینی' },
                    { name: 'کاهش نزولات جوی و خشکسالی زاگرس', type: 'negative', delta: -1.9, desc: 'افزایش تبخیر در حوضه‌های آبریز' },
                    { name: 'مصارف اضافه واحد فرآوری کرومیت', type: 'negative', delta: -0.5, desc: 'توسعه فاز جدید تولید معدن' },
                    { name: 'اجرای سامانه آبیاری تحت فشار و مدرن', type: 'positive', delta: 2.0, desc: 'بهینه‌سازی مصرف آب کشاورزی' }
                  ].map((item, idx) => (
                    <div key={idx} className="flex flex-col gap-1 p-2 rounded-xl bg-surface dark:bg-wall-800 border border-line dark:border-wall-700/40">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {item.type === 'positive' ? (
                            <span className="p-1 rounded-md bg-ok-soft dark:bg-wall-900 text-ok dark:text-signal-400">
                              <ArrowUpRight size={13} />
                            </span>
                          ) : (
                            <span className="p-1 rounded-md bg-danger-soft dark:bg-danger-700 text-danger dark:text-danger-soft">
                              <ArrowDownRight size={13} />
                            </span>
                          )}
                          <span className="font-bold text-ink-800 dark:text-slate-200 text-[11px]">{item.name}</span>
                        </div>
                        <span className={`font-mono font-black text-[11px] px-2 py-0.5 rounded-lg ${
                          item.type === 'positive' 
                            ? 'bg-ok-soft dark:bg-wall-900/60 text-ok dark:text-signal-400 border border-ok/40 dark:border-wall-800' 
                            : 'bg-danger-soft dark:bg-danger-700/60 text-danger dark:text-danger-soft border border-danger/40 dark:border-danger-700'
                        }`}>
                          {item.type === 'positive' ? '+' : ''}{toPersianDigits(item.delta)}٪
                        </span>
                      </div>

                      {/* Visual Delta Bar */}
                      <div className="w-full bg-paper dark:bg-wall-700 h-1.5 rounded-full overflow-hidden mt-0.5">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            item.type === 'positive' ? 'bg-ok-soft' : 'bg-danger-soft'
                          }`}
                          style={{ width: `${Math.abs(item.delta) * 20}%` }}
                        />
                      </div>
                      <span className="text-[9.5px] text-ink-400 font-medium text-right">{item.desc}</span>
                    </div>
                  ))}

                  {/* Final Net Total */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-brand-800 text-signal-400 shadow-sm mt-1">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={16} />
                      <span className="font-black text-xs">مقدار کنونی شاخص کلان (ارزیابی فعلی)</span>
                    </div>
                    <span className="font-mono font-black text-sm">{toPersianDigits(kpi.value)} {kpi.unit}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: Detailed Tree Breakdown Table */
            <div className="flex flex-col gap-4 animate-fade-in text-xs">
              {sectors.map((sec) => (
                <div key={sec.id} className="p-4 bg-paper dark:bg-wall-900 rounded-2xl border border-line dark:border-wall-700 flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b pb-2 border-line dark:border-wall-700">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: sec.color }} />
                      <span className="font-black text-sm text-brand-800 dark:text-signal-400">{sec.name}</span>
                    </div>
                    <span className="font-mono font-bold text-ink-700 dark:text-ink-300">وزن کل بخش: {toPersianDigits(sec.weight)}٪</span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    {sec.subMetrics.map((sub) => (
                      <div key={sub.id} className="p-3 bg-surface dark:bg-wall-800 rounded-xl border border-line dark:border-wall-700/60 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-ink-800 dark:text-slate-200 text-xs">{sub.name}</span>
                          <span className="font-mono font-extrabold text-brand-800 dark:text-signal-400 text-xs">وزن: {toPersianDigits(sub.weight)}٪</span>
                        </div>
                        <p className="text-[10.5px] text-ink-500">{sub.description}</p>
                        
                        <div className="w-full bg-paper dark:bg-wall-700 h-1.5 rounded-full overflow-hidden mt-1">
                          <div 
                            className="h-full rounded-full transition-all duration-500" 
                            style={{ width: `${(sub.weight / sec.weight) * 100}%`, backgroundColor: sec.color }} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 border-t border-line dark:border-wall-700 bg-surface dark:bg-wall-950 flex items-center justify-between">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-line hover:bg-line-strong dark:bg-wall-800 dark:hover:bg-wall-700 text-ink-800 dark:text-slate-200 rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            بستن کاوشگر
          </button>
          
          <button 
            onClick={() => alert(`گزارش شکست شاخص ${kpi.name} صادر شد.`)}
            className="px-4 py-2 bg-brand-800 hover:bg-brand-700 text-signal-400 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Download size={15} />
            <span>خروجی گزارش شکست شاخص</span>
          </button>
        </div>
      </div>
    </div>
  );
}
