import { useState, FormEvent } from 'react';
import { AlertTriangle, Cpu, Sun, Plus, Heart, Hammer, Landmark, Gem, Palette, Users } from 'lucide-react';
import { NationalProject } from '../types';

interface SavingPlansProps {
  plans: NationalProject[];
  onAddPlan: (title: string, target: number, category: 'energy' | 'digital' | 'infrastructure' | 'welfare' | 'cultural' | 'mining' | 'social') => void;
  onContribute: (planId: string, amount: number) => void;
  totalBalance: number;
}

export default function SavingPlans({ plans, onAddPlan, onContribute, totalBalance }: SavingPlansProps) {
  const [isModalOpen, setIsOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [newCategory, setNewCategory] = useState<'energy' | 'digital' | 'infrastructure' | 'welfare' | 'cultural' | 'mining' | 'social'>('digital');

  const [activeContributePlanId, setActiveContributeId] = useState<string | null>(null);
  const [contribAmount, setContribAmount] = useState('');

  const handleAddSubmit = (e: FormEvent) => {
    e.preventDefault();
    const tgt = parseFloat(newTarget);
    if (newTitle.trim() && !isNaN(tgt) && tgt > 0) {
      onAddPlan(newTitle, tgt, newCategory);
      setNewTitle('');
      setNewTarget('');
      setNewCategory('digital');
      setIsOpen(false);
    }
  };

  const handleContribSubmit = (e: FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(contribAmount);
    if (!isNaN(amt) && amt > 0 && activeContributePlanId) {
      if (amt > totalBalance) {
        alert('موجودی نقدی خزانه متمرکز برای تخصیص این رقم کافی نیست.');
        return;
      }
      onContribute(activeContributePlanId, amt);
      setContribAmount('');
      setActiveContributeId(null);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'digital': return <Cpu size={15} className="text-brand-800" />;
      case 'energy': return <Sun size={15} className="text-brand-800" />;
      case 'welfare': return <Heart size={15} className="text-brand-800" />;
      case 'infrastructure': return <Hammer size={15} className="text-brand-800" />;
      case 'mining': return <Gem size={15} className="text-brand-800" />;
      case 'cultural': return <Palette size={15} className="text-brand-800" />;
      case 'social': return <Users size={15} className="text-brand-800" />;
      default: return <Landmark size={15} className="text-brand-800" />;
    }
  };

  return (
    <div id="saving-plans-section" className="border border-line bg-surface rounded-2xl p-5 w-full flex flex-col gap-4 shadow-sm select-none text-right">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink-800">پایش کلان‌پروژه‌های ملی و پیشرفت فیزیکی</h2>
        <button
          id="btn-add-plan"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1 text-[11px] font-bold text-brand-800 hover:text-brand-700 cursor-pointer"
        >
          <span>تعریف پروژه ملی جدید</span>
          <Plus size={14} />
        </button>
      </div>

      {/* Plan list layout */}
      <div id="plans-list" className="flex flex-col gap-3.5">
        {plans.map((plan) => (
          <div 
            key={plan.id}
            id={`plan-card-${plan.id}`}
            className="border border-line rounded-xl p-3.5 flex flex-col gap-3 hover:border-signal-400 transition-colors relative"
          >
            {/* Header info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-brand-100 flex items-center justify-center">
                  {getCategoryIcon(plan.category)}
                </div>
                <span className="text-[11px] font-bold text-ink-800">{plan.title}</span>
              </div>
              <button 
                onClick={() => setActiveContributeId(plan.id)}
                className="text-[10px] bg-brand-100 text-brand-800 hover:bg-signal-400 px-2 py-1 rounded-md font-bold cursor-pointer transition-colors"
              >
                تخصیص بودجه
              </button>
            </div>

            {/* Progress segment */}
            <div className="flex flex-col gap-2">
              <div className="w-full h-1.5 bg-signal-400 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-brand-800 rounded-full transition-all duration-500"
                  style={{ width: `${plan.percentage}%` }}
                />
              </div>
              
              {/* Amounts and label ratios */}
              <div className="flex items-center justify-between text-[10px] text-ink-500">
                <div className="flex items-baseline gap-1 font-mono font-semibold">
                  <span className="text-ink-800">{plan.savedAmount.toLocaleString()}</span>
                  <span>/</span>
                  <span>{plan.targetAmount.toLocaleString()} میلیون دلار</span>
                </div>
                <span className="font-mono font-bold text-brand-800">{plan.percentage}٪ فیزیکی</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 1. Modal Dialog: Create Plan */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-5 w-full max-w-sm border border-line shadow-xl animate-fade-in text-right">
            <h3 className="text-sm font-bold text-brand-800 mb-3">ثبت و تعریف کلان‌پروژه راهبردی جدید</h3>
            <form onSubmit={handleAddSubmit} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-ink-500">عنوان پروژه ملی</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: راه‌اندازی دیتاسنتر ملی مکران"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="bg-paper border border-line rounded-lg p-2.5 text-xs text-ink-800 focus:outline-none"
                />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-ink-500">کل بودجه مورد نیاز (میلیون دلار)</label>
                <input
                  type="number"
                  required
                  placeholder="مثال: ۱۲۰۰"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  className="bg-paper border border-line rounded-lg p-2.5 text-xs text-ink-800 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-ink-500">حوزه تخصصی و راهبردی</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="bg-paper border border-line rounded-lg p-2.5 text-xs text-ink-800 focus:outline-none cursor-pointer"
                >
                  <option value="digital">ارتباطات و زیرساخت دیجیتال</option>
                  <option value="energy">انرژی‌های تجدیدپذیر و سبز</option>
                  <option value="welfare">سلامت و بهداشت عمومی</option>
                  <option value="infrastructure">زیرساخت‌های عمرانی و مهندسی</option>
                  <option value="mining">توسعه صنعتی و معادن</option>
                  <option value="cultural">صنایع خلاق و فرهنگی</option>
                  <option value="social">توسعه اجتماعی و نخبگان</option>
                </select>
              </div>

              <div className="flex gap-2.5 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-xs bg-paper hover:bg-line text-ink-500 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs bg-brand-800 hover:bg-brand-700 text-white rounded-lg font-bold cursor-pointer"
                >
                  ثبت رسمی پروژه
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal Dialog: Add funds (Contribution) */}
      {activeContributePlanId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-5 w-full max-w-sm border border-line shadow-xl animate-fade-in text-right">
            <h3 className="text-sm font-bold text-brand-800 mb-1">تخصیص علی‌الحساب بودجه به پروژه راهبردی</h3>
            <p className="text-[9px] text-ink-500 mb-3">مبلغ تعیین شده از خزانه کل کسر و به ردیف بودجه اختصاصی پروژه منتقل می‌گردد.</p>
            <form onSubmit={handleContribSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-ink-500">مبلغ بودجه انتقالی (میلیون دلار)</label>
                <input
                  type="number"
                  required
                  placeholder="مثال: ۲۵۰"
                  value={contribAmount}
                  onChange={(e) => setContribAmount(e.target.value)}
                  className="bg-paper border border-line rounded-lg p-2.5 text-xs text-ink-800 focus:outline-none"
                />
              </div>
              <div className="flex gap-2.5 justify-end mt-1">
                <button
                  type="button"
                  onClick={() => setActiveContributeId(null)}
                  className="px-4 py-2 text-xs bg-paper hover:bg-line text-ink-500 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs bg-brand-800 hover:bg-brand-700 text-white rounded-lg font-bold cursor-pointer"
                >
                  تأیید و تخصیص سند
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
