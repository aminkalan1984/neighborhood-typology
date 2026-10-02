import { useState } from 'react';
import { Sliders, TrendingDown, TrendingUp, Sparkles, RefreshCw, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import { toPersianDigits } from './AnimatedCounter';

export interface RiskItem {
  id: string;
  name: string;
  score: number;
  probability: string;
  impact: string;
  region?: string;
}

interface QuickWhatIfSimulatorProps {
  risk: RiskItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function QuickWhatIfSimulator({ risk, isOpen, onClose }: QuickWhatIfSimulatorProps) {
  // Lever Sliders State (0 to 100 %)
  const [wellClosurePercent, setWellClosurePercent] = useState<number>(40); // % closure
  const [tourismBudgetPercent, setTourismBudgetPercent] = useState<number>(60); // % allocation
  const [chromiteTariffPercent, setChromiteTariffPercent] = useState<number>(25); // % tariff

  // Calculated Real-time Predictive Outcomes
  // Baseline Values:
  // Water Stress: 79.0% -> Reduced by wellClosure
  // GDP Growth: 5.4% -> Increased by tourism & chromite processing
  // Public Satisfaction: 69.0% -> Increased by job creation
  const rawWaterStress = 79.0 - (wellClosurePercent * 0.35);
  const calculatedWaterStress = Math.max(45, rawWaterStress).toFixed(1);
  const calculatedGDPGrowth = (5.4 + (tourismBudgetPercent * 0.015) + (chromiteTariffPercent * 0.02)).toFixed(1);
  const rawSatisfaction = 69.0 + (tourismBudgetPercent * 0.12) - (wellClosurePercent * 0.04);
  const calculatedSatisfaction = Math.min(95, rawSatisfaction).toFixed(1);

  // Deltas
  const waterDelta = (Number(calculatedWaterStress) - 79.0).toFixed(1);
  const gdpDelta = (Number(calculatedGDPGrowth) - 5.4).toFixed(1);
  const satDelta = (Number(calculatedSatisfaction) - 69.0).toFixed(1);

  const resetSliders = () => {
    setWellClosurePercent(40);
    setTourismBudgetPercent(60);
    setChromiteTariffPercent(25);
  };

  if (!isOpen || !risk) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      {/* Simulation Modal Box */}
      <div 
        id="quick-whatif-modal" 
        className="w-full max-w-xl bg-surface dark:bg-wall-900 rounded-3xl shadow-2xl border border-line dark:border-wall-700 overflow-hidden text-right flex flex-col gap-0"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-5 border-b border-line dark:border-wall-700 flex items-center justify-between bg-brand-100/40 dark:bg-wall-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-800 text-signal-400 flex items-center justify-center font-bold shadow-md">
              <Zap size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-brand-800 dark:text-signal-400">
                  شبیه‌ساز سریع تغییرات (Quick What-If)
                </h2>
                <span className="text-[10px] bg-ok text-white font-bold px-2 py-0.5 rounded-full">
                  پیش‌بینی لحظه‌ای
                </span>
              </div>
              <p className="text-xs text-ink-500 mt-0.5">
                تغییر پارامترها برای خنثی‌سازی ریسک «{risk.name}»
              </p>
            </div>
          </div>

          <button 
            onClick={resetSliders}
            className="p-2 rounded-xl bg-paper hover:bg-line dark:bg-wall-800 dark:hover:bg-wall-700 text-ink-700 dark:text-ink-300 transition-colors cursor-pointer text-xs font-bold flex items-center gap-1.5"
            title="بازنشانی پارامترها"
          >
            <RefreshCw size={14} />
            <span>بازنشانی</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col gap-6 max-h-[80vh] overflow-y-auto">
          
          {/* Target Risk Banner */}
          <div className="p-3.5 rounded-2xl bg-danger-soft/60 dark:bg-danger-700/20 border border-danger/40 dark:border-danger-700/40 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-danger dark:text-danger font-bold">
              <AlertTriangle size={16} />
              <span>ریسک هدف: {risk.name}</span>
            </div>
            <span className="font-mono font-black text-danger dark:text-danger bg-surface dark:bg-wall-900 px-2.5 py-1 rounded-lg border border-danger/40">
              شدت: {toPersianDigits(risk.score)}٪
            </span>
          </div>

          {/* SECTION 1: Sliders for Strategic Levers */}
          <div className="flex flex-col gap-4">
            <span className="text-xs font-black text-brand-800 dark:text-signal-400 flex items-center gap-1.5">
              <Sliders size={15} />
              اهرم‌های مداخله سیاستی (sliders)
            </span>

            {/* Slider 1: Well Closure */}
            <div className="p-3.5 bg-paper dark:bg-wall-800/80 rounded-2xl border border-line dark:border-wall-700 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-ink-800 dark:text-slate-200">۱. نرخ انسداد چاه‌های غیرمجاز دشت نی‌ریز</span>
                <span className="font-mono font-black text-brand-800 dark:text-signal-400">{toPersianDigits(wellClosurePercent)}٪</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={wellClosurePercent} 
                onChange={(e) => setWellClosurePercent(Number(e.target.value))}
                className="w-full h-2 bg-line dark:bg-wall-700 rounded-lg appearance-none cursor-pointer accent-brand-800 dark:accent-signal-400"
              />
              <div className="flex justify-between text-[10px] text-ink-400 font-mono">
                <span>۰٪ (بدون مداخله)</span>
                <span>۵۰٪ (متوسط)</span>
                <span>۱۰۰٪ (انسداد کامل)</span>
              </div>
            </div>

            {/* Slider 2: Ecotourism & C2B Budget */}
            <div className="p-3.5 bg-paper dark:bg-wall-800/80 rounded-2xl border border-line dark:border-wall-700 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-ink-800 dark:text-slate-200">۲. درصد تخصیص اعتبارات به صنایع دستی و بوم‌گردی</span>
                <span className="font-mono font-black text-ok">{toPersianDigits(tourismBudgetPercent)}٪</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={tourismBudgetPercent} 
                onChange={(e) => setTourismBudgetPercent(Number(e.target.value))}
                className="w-full h-2 bg-line dark:bg-wall-700 rounded-lg appearance-none cursor-pointer accent-ok"
              />
              <div className="flex justify-between text-[10px] text-ink-400 font-mono">
                <span>۰٪ (حداقل)</span>
                <span>۵۰٪ (استاندارد)</span>
                <span>۱۰۰٪ (توسعه حداکثری)</span>
              </div>
            </div>

            {/* Slider 3: Chromite Export Tariff */}
            <div className="p-3.5 bg-paper dark:bg-wall-800/80 rounded-2xl border border-line dark:border-wall-700 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-ink-800 dark:text-slate-200">۳. تعرفه گمرکی بر صادرات خام فرومعدنی</span>
                <span className="font-mono font-black text-warn">{toPersianDigits(chromiteTariffPercent)}٪</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={chromiteTariffPercent} 
                onChange={(e) => setChromiteTariffPercent(Number(e.target.value))}
                className="w-full h-2 bg-line dark:bg-wall-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-ink-400 font-mono">
                <span>۰٪ (آزاد)</span>
                <span>۵۰٪ (بازدارنده)</span>
                <span>۱۰۰٪ (ممنوعیت کامل)</span>
              </div>
            </div>
          </div>

          {/* SECTION 2: Real-time Predictive Impacts */}
          <div className="flex flex-col gap-3 border-t pt-4 border-line dark:border-wall-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-brand-800 dark:text-signal-400 flex items-center gap-1.5">
                <Sparkles size={15} />
                پیش‌بینی اثرات لحظه‌ای بر شاخص‌های کلان کشور
              </span>
              <span className="text-[10px] text-ink-400 font-mono">Real-time Simulation</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Predicted Water Stress */}
              <div className="p-3 bg-surface dark:bg-wall-900 border border-line dark:border-wall-700 rounded-2xl flex flex-col gap-1 text-center shadow-sm">
                <span className="text-[10px] text-ink-500 font-bold">تنش آبی</span>
                <span className="text-lg font-black font-mono text-danger">{toPersianDigits(calculatedWaterStress)}٪</span>
                <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-full ${Number(waterDelta) <= 0 ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger'}`}>
                  {Number(waterDelta) <= 0 ? `▼ ${toPersianDigits(waterDelta)}٪` : `▲ +${toPersianDigits(waterDelta)}٪`}
                </span>
              </div>

              {/* Predicted GDP */}
              <div className="p-3 bg-surface dark:bg-wall-900 border border-line dark:border-wall-700 rounded-2xl flex flex-col gap-1 text-center shadow-sm">
                <span className="text-[10px] text-ink-500 font-bold">رشد اقتصادی</span>
                <span className="text-lg font-black font-mono text-ok">{toPersianDigits(calculatedGDPGrowth)}٪</span>
                <span className="text-[10px] font-bold font-mono bg-ok-soft text-ok px-1.5 py-0.5 rounded-full">
                  ▲ +{toPersianDigits(gdpDelta)}٪
                </span>
              </div>

              {/* Predicted Satisfaction */}
              <div className="p-3 bg-surface dark:bg-wall-900 border border-line dark:border-wall-700 rounded-2xl flex flex-col gap-1 text-center shadow-sm">
                <span className="text-[10px] text-ink-500 font-bold">رضایت عمومی</span>
                <span className="text-lg font-black font-mono text-warn">{toPersianDigits(calculatedSatisfaction)}٪</span>
                <span className="text-[10px] font-bold font-mono bg-ok-soft text-ok px-1.5 py-0.5 rounded-full">
                  ▲ +{toPersianDigits(satDelta)}٪
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-line dark:border-wall-700 bg-surface dark:bg-wall-950 flex items-center justify-between">
          <button 
            onClick={onClose}
            className="px-4 py-2.5 bg-line hover:bg-line-strong dark:bg-wall-800 dark:hover:bg-wall-700 text-ink-800 dark:text-slate-200 rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            انصراف
          </button>
          
          <button 
            onClick={() => {
              alert(`سناریوی جدید شبیه‌سازی با موفقیت بر برنامه اقدام استانی اعمال شد.\nکاهش تنش آبی پیش‌بینی‌شده: ${waterDelta}٪`);
              onClose();
            }}
            className="px-5 py-2.5 bg-brand-800 hover:bg-brand-700 text-signal-400 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md"
          >
            <CheckCircle2 size={16} />
            <span>اعمال سناریو در دستور کار حاکمیتی</span>
          </button>
        </div>
      </div>
    </div>
  );
}
