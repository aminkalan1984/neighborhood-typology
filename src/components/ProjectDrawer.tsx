import React from 'react';
import { PortfolioProject } from '../data/portfolioData';
import { 
  X, 
  ExternalLink, 
  Target, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  Lock, 
  TrendingUp, 
  FileText, 
  Check, 
  ChevronLeft,
  Users,
  MapPin,
  Calendar,
  Building2,
  Scale,
  Sparkles,
  BarChart3
} from 'lucide-react';

interface ProjectDrawerProps {
  project: PortfolioProject | null;
  isOpen: boolean;
  onClose: () => void;
  onRequestStageChange: (projectId: string, currentStage: PortfolioProject['lifecycleStage']) => void;
}

export default function ProjectDrawer({
  project,
  isOpen,
  onClose,
  onRequestStageChange
}: ProjectDrawerProps) {
  if (!isOpen || !project) return null;

  // Impact Gap Calculation
  const impactGap = project.realizedImpact - project.predictedImpact;
  const isImpactPositive = impactGap >= 0;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden text-right font-sans select-none">
      {/* Backdrop Overlay */}
      <div 
        className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* 420px Width Floating Side Drawer */}
      <div className="fixed top-0 bottom-0 right-0 z-50 w-[420px] max-w-full bg-surface shadow-2xl border-l border-line flex flex-col h-full animate-slide-in-right overflow-hidden">
        
        {/* Drawer Header (Fixed Sticky) */}
        <div className="p-4 bg-surface border-b border-line flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            <span 
              className="px-2 py-0.5 rounded text-white text-[10px] font-black shrink-0" 
              style={{ backgroundColor: project.dimensionColor }}
            >
              {project.dimensionName}
            </span>
            <div className="flex flex-col overflow-hidden">
              <h3 className="text-xs font-extrabold text-brand-800 truncate">{project.title}</h3>
              <span className="font-mono text-[10px] font-bold text-ink-500">{project.code}</span>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl bg-paper hover:bg-line text-ink-500 transition-colors cursor-pointer shrink-0"
            title="بستن پنل جزئیات"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Content Workspace */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          
          {/* Stall Warning Banner if Stalled */}
          {project.isStalled && (
            <div className="p-3 bg-danger-soft border border-danger/40 rounded-xl flex items-start gap-2.5 text-xs text-danger-700">
              <AlertTriangle size={18} className="text-danger shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-black text-danger">پروژه در وضعیت متوقف / دارای اخطار:</span>
                <p className="text-[11px] leading-relaxed text-danger">{project.stallReason || 'تأخیر متناوب به دلیل عدم تامین اعتبار یا فرآیندهای گمرکی.'}</p>
              </div>
            </div>
          )}

          {/* Project Manager & Location Card */}
          <div className="p-3 bg-surface border border-line rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img 
                src={project.manager.avatar} 
                alt={project.manager.name} 
                className="w-10 h-10 rounded-full object-cover border border-line shrink-0" 
              />
              <div className="flex flex-col">
                <span className="font-extrabold text-xs text-ink-800">{project.manager.name}</span>
                <span className="text-[10px] text-ink-500">{project.manager.role}</span>
                <span className="text-[10px] text-brand-800 font-bold mt-0.5">{project.executingAgency}</span>
              </div>
            </div>

            <div className="flex flex-col items-end text-[10px] text-ink-500 border-r border-line pr-3">
              <div className="flex items-center gap-1 font-bold text-ink-800">
                <MapPin size={12} className="text-brand-800" />
                <span>{project.province}</span>
              </div>
              <span>{project.county}</span>
              <span className="font-mono mt-1 text-[9px] bg-paper px-1.5 py-0.2 rounded font-bold">سلول {project.cellCode}</span>
            </div>
          </div>

          {/* 4 Metric Quick Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 bg-brand-100/60 border border-signal-400 rounded-xl flex flex-col justify-between">
              <span className="text-[10px] text-ink-500 font-bold">امتیاز اولویت PPE</span>
              <div className="flex items-baseline gap-1 my-0.5">
                <span className="text-lg font-black text-brand-800 font-mono">{project.ppeScore}</span>
                <span className="text-[9px] text-ink-500">/ ۱۰۰</span>
              </div>
              <span className="text-[9.5px] text-ok font-bold">تأییدشده در خط قیدها</span>
            </div>

            <div className="p-2.5 bg-surface border border-line rounded-xl flex flex-col justify-between">
              <span className="text-[10px] text-ink-500 font-bold">سطح ریسک پروژه</span>
              <div className="flex items-center gap-1.5 my-1">
                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                  project.riskLevel === 'low' ? 'bg-ok-soft text-ok' :
                  project.riskLevel === 'medium' ? 'bg-warn-soft text-warn' : 'bg-danger-soft text-danger'
                }`}>
                  {project.riskLevel === 'low' ? 'کم' : project.riskLevel === 'medium' ? 'متوسط' : 'بسیار بالا'}
                </span>
                <span className="text-xs font-mono font-bold text-ink-500">{project.riskScore}٪</span>
              </div>
              <span className="text-[9.5px] text-ink-500">پایش مداوم دیوان</span>
            </div>

            <div className="p-2.5 bg-surface border border-line rounded-xl flex flex-col justify-between">
              <span className="text-[10px] text-ink-500 font-bold">بودجه کل و جذب</span>
              <div className="flex items-baseline gap-1 my-0.5">
                <span className="text-sm font-black text-ink-800 font-mono">${project.budgetAbsorbed}M</span>
                <span className="text-[9px] text-ink-500">از ${project.budgetTotal}M</span>
              </div>
              <div className="w-full bg-line rounded-full h-1 overflow-hidden my-1">
                <div className="bg-brand-800 h-full rounded-full" style={{ width: `${project.financialProgress}%` }} />
              </div>
              <span className="text-[9.5px] text-ink-500">جذب مالی: {project.financialProgress}٪</span>
            </div>

            <div className="p-2.5 bg-surface border border-line rounded-xl flex flex-col justify-between">
              <span className="text-[10px] text-ink-500 font-bold">پیشرفت فیزیکی</span>
              <div className="flex items-baseline gap-1 my-0.5">
                <span className="text-sm font-black text-brand-800 font-mono">{project.physicalProgress}٪</span>
              </div>
              <div className="w-full bg-line rounded-full h-1 overflow-hidden my-1">
                <div className="bg-ok h-full rounded-full" style={{ width: `${project.physicalProgress}%` }} />
              </div>
              <span className={`text-[9.5px] font-bold ${project.isOnTrack ? 'text-ok' : 'text-danger'}`}>
                {project.isOnTrack ? 'طابق زمان‌بندی' : 'عقب‌تر از برنامه'}
              </span>
            </div>
          </div>

          {/* Decision Lineage Box */}
          <div className="p-3 bg-brand-100/80 border border-signal-400 rounded-xl flex flex-col gap-1.5 text-xs text-brand-800">
            <div className="flex items-center justify-between font-extrabold border-b border-signal-400/60 pb-1.5">
              <div className="flex items-center gap-1.5">
                <ExternalLink size={14} />
                <span>شجره تصمیم و خاستگاه حاکمیتی:</span>
              </div>
              <span className="text-[10px] bg-surface px-2 py-0.5 rounded font-mono font-bold">
                {project.originSourceName}
              </span>
            </div>

            <p className="text-[11px] leading-relaxed">
              منشأ اصلی: <strong className="text-ink-800">{project.scenarioOriginName || 'تجویز مستقیم سامانه ISGP'}</strong>
            </p>
          </div>

          {/* ImpactTracker Chart (Comparing Predicted vs Actual vs Baseline) */}
          <div className="p-3.5 bg-surface border border-line rounded-xl flex flex-col gap-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-line pb-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-ink-800">
                <Target size={15} className="text-brand-800" />
                <span>ردیاب اثر بر بردارهای حالت</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                isImpactPositive ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'
              }`}>
                {isImpactPositive ? `انطباق +${impactGap}٪` : `شکاف ${impactGap}٪`}
              </span>
            </div>

            {/* Visual 3-Bar Comparison Chart */}
            <div className="flex flex-col gap-2.5 my-1">
              {/* 1. Predicted Impact */}
              <div className="flex flex-col gap-1 text-[10px]">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-ok">۱. اثر پیش‌بینی‌شده سناریو:</span>
                  <span className="font-mono text-ok font-black">{project.predictedImpact}٪</span>
                </div>
                <div className="w-full bg-paper rounded-full h-2 overflow-hidden">
                  <div className="bg-ok h-full rounded-full" style={{ width: `${project.predictedImpact}%` }} />
                </div>
              </div>

              {/* 2. Realized Actual Impact */}
              <div className="flex flex-col gap-1 text-[10px]">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-info">۲. اثر واقعی محقق‌شده:</span>
                  <span className="font-mono text-info font-black">{project.realizedImpact}٪</span>
                </div>
                <div className="w-full bg-paper rounded-full h-2 overflow-hidden">
                  <div className="bg-info h-full rounded-full" style={{ width: `${project.realizedImpact}%` }} />
                </div>
              </div>

              {/* 3. Baseline Impact */}
              <div className="flex flex-col gap-1 text-[10px]">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-ink-500">۳. خط پایه عدم مداخله:</span>
                  <span className="font-mono text-ink-700 font-black">{project.baselineImpact}٪</span>
                </div>
                <div className="w-full bg-paper rounded-full h-2 overflow-hidden">
                  <div className="bg-gray-400 h-full rounded-full" style={{ width: `${project.baselineImpact}%` }} />
                </div>
              </div>
            </div>

            <div className="p-2 bg-paper border border-line rounded-lg text-[10.5px] text-ink-500">
              <span className="font-bold text-ink-800">شاخص هدف: </span>
              <span>{project.targetIndicator}</span>
            </div>
          </div>

          {/* Milestones Checklist */}
          <div className="p-3.5 bg-surface border border-line rounded-xl flex flex-col gap-2.5">
            <div className="flex items-center justify-between border-b border-line pb-2 text-xs font-bold text-ink-800">
              <div className="flex items-center gap-1.5">
                <Clock size={15} className="text-info" />
                <span>مایلستون‌ها و گام‌های کلیدی اجرا</span>
              </div>
              <span className="text-[10px] text-ink-500 font-mono">
                {project.milestones.filter(m => m.completed).length} / {project.milestones.length} تکمیل
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {project.milestones.map((m) => (
                <div key={m.id} className="flex items-start justify-between text-xs p-2 bg-surface rounded-lg border border-line">
                  <div className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded flex items-center justify-center text-white text-[10px] ${
                      m.completed ? 'bg-ok' : 'bg-line-strong'
                    }`}>
                      {m.completed && <Check size={12} />}
                    </span>
                    <span className={`text-[11px] font-bold ${m.completed ? 'line-through text-ink-400' : 'text-ink-800'}`}>
                      {m.title}
                    </span>
                  </div>
                  <span className="font-mono text-[9.5px] text-ink-500 shrink-0">{m.dueDate}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Decision Log & Signatures */}
          <div className="p-3.5 bg-surface border border-line rounded-xl flex flex-col gap-2.5">
            <div className="flex items-center justify-between border-b border-line pb-2 text-xs font-bold text-ink-800">
              <div className="flex items-center gap-1.5">
                <ShieldAlert size={15} className="text-brand-600" />
                <span>سجل امضاهای حاکمیتی و لاگ دیوان</span>
              </div>
              <span className="text-[10px] text-brand-700 font-bold bg-brand-50 px-1.5 py-0.2 rounded">ثبت بلاکچینی</span>
            </div>

            <div className="flex flex-col gap-2">
              {project.decisionLog.map((log) => (
                <div key={log.id} className="p-2.5 bg-paper border border-line rounded-lg flex flex-col gap-1 text-[11px]">
                  <div className="flex items-center justify-between font-bold text-brand-800">
                    <span>{log.action}</span>
                    <span className="text-[10px] text-ink-500 font-mono">{log.date}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-ink-500">
                    <span>{log.userName} ({log.userRole})</span>
                    <span className="font-mono text-[9px] text-ok font-bold bg-ok-soft px-1 rounded">{log.signature}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ex-Post Evaluation Box if available */}
          {project.exPostEvaluation && (
            <div className="p-3.5 bg-brand-50 border border-brand-200 rounded-xl flex flex-col gap-2 text-xs text-brand-900">
              <span className="font-black text-brand-800">درس‌آموخته‌های ارزیابی پسینی (Ex-Post):</span>
              <ul className="list-disc list-inside text-[11px] flex flex-col gap-1 leading-relaxed">
                {project.exPostEvaluation.lessonsLearned.map((lesson, i) => (
                  <li key={i}>{lesson}</li>
                ))}
              </ul>
            </div>
          )}

        </div>

        {/* Action Footer (Fixed Sticky Bottom) */}
        <div className="p-4 bg-surface border-t border-line flex flex-col gap-2 shrink-0">
          <button
            onClick={() => onRequestStageChange(project.id, project.lifecycleStage)}
            className="w-full py-2.5 bg-brand-800 hover:bg-brand-700 text-signal-400 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
          >
            <Lock size={14} />
            <span>انتقال مرحله همراه با امضای حاکمیتی</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => alert(`ارسال درخواست گزارش توجیهی تأخیر به دیوان محاسبات و نماینده استانی برای پروژه ${project.code}`)}
              className="py-2 bg-warn-soft text-warn border border-warn/40 hover:bg-warn-soft rounded-xl text-[11px] font-bold transition-all cursor-pointer text-center"
            >
              گزارش تعلل به دیوان
            </button>
            <button
              onClick={() => alert(`انتقال به سناریوساز با داده‌های ورودی ${project.code}`)}
              className="py-2 bg-surface text-ink-800 border border-line hover:bg-paper rounded-xl text-[11px] font-bold transition-all cursor-pointer text-center"
            >
              شبیه‌سازی مجدد
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
