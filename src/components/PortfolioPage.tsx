import React, { useState, useMemo } from 'react';
import ProjectDrawer from './ProjectDrawer';
import IranSuitabilityMap from './IranSuitabilityMap';
import { 
  INITIAL_PORTFOLIO_PROJECTS, 
  PORTFOLIO_DIMENSION_BALANCES, 
  PortfolioProject 
} from '../data/portfolioData';
import { 
  Sparkles, 
  SlidersHorizontal, 
  Search, 
  X, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  Zap, 
  ShieldAlert, 
  Download, 
  BarChart3, 
  Kanban, 
  Calendar, 
  MapPin, 
  Target, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Volume2, 
  Info, 
  ArrowUpRight, 
  Layers, 
  PieChart, 
  Scale, 
  Lock, 
  Check, 
  RotateCcw, 
  Eye, 
  Users, 
  Briefcase, 
  ExternalLink,
  Bot
} from 'lucide-react';

export default function PortfolioPage() {
  // === STATE MANAGEMENT ===
  const [projects, setProjects] = useState<PortfolioProject[]>(INITIAL_PORTFOLIO_PROJECTS);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>('proj-01');
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'table' | 'kanban' | 'gantt' | 'map' | 'matrix'>('table');

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    setIsDrawerOpen(true);
  };
  const [activePersona, setActivePersona] = useState<'all' | 'executive' | 'project_manager' | 'budget_comm' | 'auditor' | 'crisis'>('all');
  
  // Filters State
  const [domainLevel, setDomainLevel] = useState<string>('all');
  const [selectedDimension, setSelectedDimension] = useState<string>('all');
  const [selectedAgency, setSelectedAgency] = useState<string>('all');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [selectedRisk, setSelectedRisk] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSavedFilter, setActiveSavedFilter] = useState<string | null>(null);

  // Cross-filtering active state from Health Strip KPI clicks
  const [kpiFilter, setKpiFilter] = useState<string | null>(null);

  // UI Panels / Modals State
  const [isBalancePanelOpen, setIsBalancePanelOpen] = useState<boolean>(true);
  const [isNLQOpen, setIsNLQOpen] = useState<boolean>(false);
  const [nlqQuery, setNlqQuery] = useState<string>('');
  const [nlqResult, setNlqResult] = useState<string | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState<boolean>(false);
  const [pendingStageChange, setPendingStageChange] = useState<{ projectId: string; newStage: PortfolioProject['lifecycleStage'] } | null>(null);
  const [digitalSignatory, setDigitalSignatory] = useState<string>('دکتر امین کلانتری - وزیر امور اقتصادی');
  
  const [isEquityGapLayerActive, setIsEquityGapLayerActive] = useState<boolean>(true);
  const [isPPEQueueOpen, setIsPPEQueueOpen] = useState<boolean>(false);
  const [isNarratorPlaying, setIsNarratorPlaying] = useState<boolean>(false);
  const [selectedMatrixBubbles, setSelectedMatrixBubbles] = useState<string[]>([]);

  // Selected project object derivation
  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || projects[0] || null;
  }, [projects, selectedProjectId]);

  // === FILTERING LOGIC ===
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      // Cross-filter from KPI strip click
      if (kpiFilter === 'active' && p.lifecycleStage === 'closed') return false;
      if (kpiFilter === 'stalled' && !p.isStalled) return false;
      if (kpiFilter === 'high_risk' && (p.riskLevel !== 'high' && p.riskLevel !== 'critical')) return false;
      if (kpiFilter === 'delayed' && p.isOnTrack) return false;

      // Domain filter
      if (domainLevel === 'fars' && p.province !== 'فارس') return false;
      if (domainLevel === 'neyriz' && p.county !== 'نی‌ریز') return false;

      // Dimension filter
      if (selectedDimension !== 'all' && p.dimension !== selectedDimension) return false;

      // Agency filter
      if (selectedAgency !== 'all' && p.executingAgency !== selectedAgency) return false;

      // Stage filter
      if (selectedStage !== 'all' && p.lifecycleStage !== selectedStage) return false;

      // Risk filter
      if (selectedRisk !== 'all' && p.riskLevel !== selectedRisk) return false;

      // Search query filter
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchTitle = p.title.toLowerCase().includes(q);
        const matchCode = p.code.toLowerCase().includes(q);
        const matchAgency = p.executingAgency.toLowerCase().includes(q);
        const matchCell = p.cellName.toLowerCase().includes(q);
        if (!matchTitle && !matchCode && !matchAgency && !matchCell) return false;
      }

      return true;
    });
  }, [projects, kpiFilter, domainLevel, selectedDimension, selectedAgency, selectedStage, selectedRisk, searchQuery]);

  // === CALCULATED HEALTH KPIS ===
  const healthKPIs = useMemo(() => {
    const totalCount = projects.length;
    const activeCount = projects.filter(p => p.lifecycleStage === 'execution' || p.lifecycleStage === 'monitoring').length;
    const totalBudget = projects.reduce((acc, p) => acc + p.budgetTotal, 0);
    const absorbedBudget = projects.reduce((acc, p) => acc + p.budgetAbsorbed, 0);
    const absorptionPercent = totalBudget > 0 ? Math.round((absorbedBudget / totalBudget) * 100) : 0;
    
    const onTrackCount = projects.filter(p => p.isOnTrack).length;
    const onTrackPercent = totalCount > 0 ? Math.round((onTrackCount / totalCount) * 100) : 0;

    const avgRealizedImpact = Math.round(projects.reduce((acc, p) => acc + p.realizedImpact, 0) / (totalCount || 1));
    const avgPredictedImpact = Math.round(projects.reduce((acc, p) => acc + p.predictedImpact, 0) / (totalCount || 1));
    
    const highRiskCount = projects.filter(p => p.riskLevel === 'high' || p.riskLevel === 'critical').length;
    const stalledCount = projects.filter(p => p.isStalled).length;

    return {
      totalCount,
      activeCount,
      totalBudget,
      absorbedBudget,
      absorptionPercent,
      onTrackPercent,
      avgRealizedImpact,
      avgPredictedImpact,
      highRiskCount,
      stalledCount,
      equityGapPercent: 14.5, // Allocation-Need Gap KPI
    };
  }, [projects]);

  // Handle Preset Filters
  const applySavedFilter = (filterKey: string) => {
    if (activeSavedFilter === filterKey) {
      // Clear
      setActiveSavedFilter(null);
      setSelectedDimension('all');
      setSelectedRisk('all');
      setDomainLevel('all');
      setKpiFilter(null);
      return;
    }

    setActiveSavedFilter(filterKey);
    if (filterKey === 'high_risk_water') {
      setSelectedDimension('water');
      setSelectedRisk('high');
      setDomainLevel('all');
    } else if (filterKey === 'delayed_fars') {
      setDomainLevel('fars');
      setSelectedRisk('all');
      setKpiFilter('delayed');
    } else if (filterKey === 'isgp_prescriptions') {
      setSelectedDimension('all');
      setSelectedRisk('all');
      setSearchQuery('ISGP');
    }
  };

  // Handle Stage Change Request (triggers digital signature modal)
  const handleRequestStageChange = (projectId: string, newStage: PortfolioProject['lifecycleStage']) => {
    setPendingStageChange({ projectId, newStage });
    setIsSignatureModalOpen(true);
  };

  const confirmStageChange = () => {
    if (!pendingStageChange) return;
    
    setProjects(prev => prev.map(p => {
      if (p.id === pendingStageChange.projectId) {
        const stageNames: Record<PortfolioProject['lifecycleStage'], string> = {
          proposal: 'پیشنهاد',
          ppe_eval: 'در ارزیابی PPE',
          approved: 'مصوب',
          execution: 'در حال اجرا',
          monitoring: 'پایش اثر',
          ex_post: 'ارزیابی پسینی',
          closed: 'بسته شده'
        };
        const newLog = {
          id: `log-${Date.now()}`,
          action: `تغییر مرحله به «${stageNames[pendingStageChange.newStage]}»`,
          userName: digitalSignatory,
          userRole: 'مقام مجاز حاکمیتی',
          date: '۱۴۰۵/۰۵/۱۸',
          signature: `SIG-${Math.floor(1000 + Math.random() * 9000)}-VERIFIED`
        };
        return {
          ...p,
          lifecycleStage: pendingStageChange.newStage,
          stageName: stageNames[pendingStageChange.newStage],
          decisionLog: [newLog, ...p.decisionLog]
        };
      }
      return p;
    }));

    setIsSignatureModalOpen(false);
    setPendingStageChange(null);
  };

  // NLQ Search handler
  const handleRunNLQ = () => {
    if (!nlqQuery.trim()) return;
    setNlqResult(`بر اساس تحلیل هوشمند داده‌های ISGP، تعداد ۳ پروژه در حوزه آب و انرژی دارای تأخیر بیش از ۴ ماه در منطقه سیستان شناسایی شد. پروژه «احداث مزرعه توربین بادی میل نادر» به علت گیر در ترخیص ترانسفورماتورها بحرانی‌ترین وضعیت را دارد.`);
  };

  // Narrator TTS Simulator
  const toggleNarrator = () => {
    if (isNarratorPlaying) {
      setIsNarratorPlaying(false);
    } else {
      setIsNarratorPlaying(true);
      setTimeout(() => setIsNarratorPlaying(false), 8000);
    }
  };

  return (
    <div className="flex flex-col gap-5 w-full text-right font-sans select-none pb-12">
      
      {/* =========================================================
          ROW 0: PORTFOLIO COMMAND BAR (Sticky 64px)
          ========================================================= */}
      <div className="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border border-line rounded-2xl p-3 shadow-md flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Right side: Domain selector + View Switchers */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* Domain Scope Selector (L0 to L5) */}
          <div className="flex items-center gap-1.5 bg-brand-100 text-brand-800 px-3 py-1.5 rounded-xl border border-signal-400/50 text-xs font-bold">
            <MapPin size={15} className="shrink-0" />
            <span className="text-[11px] text-ink-500">دامنه:</span>
            <select 
              value={domainLevel} 
              onChange={(e) => setDomainLevel(e.target.value)}
              className="bg-transparent font-black text-xs text-brand-800 cursor-pointer focus:outline-none"
            >
              <option value="all">کل کشور (سطح L0)</option>
              <option value="fars">استان فارس (سطح L1)</option>
              <option value="neyriz">شهرستان نی‌ریز (سطح L2)</option>
            </select>
          </div>

          {/* Persona View Switcher */}
          <div className="flex items-center gap-1 bg-surface border border-line p-1 rounded-xl text-xs">
            <span className="text-[10px] text-ink-500 px-1 font-bold">حالت:</span>
            <button 
              onClick={() => setActivePersona('all')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                activePersona === 'all' ? 'bg-brand-800 text-signal-400' : 'text-ink-500 hover:text-ink-800'
              }`}
            >
              کامل
            </button>
            <button 
              onClick={() => setActivePersona('executive')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                activePersona === 'executive' ? 'bg-brand-800 text-signal-400' : 'text-ink-500 hover:text-ink-800'
              }`}
              title="نمای خلاصه مدیریتی مخصوص وزرا و استاندار"
            >
              مدیر ارشد
            </button>
            <button 
              onClick={() => setActivePersona('auditor')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                activePersona === 'auditor' ? 'bg-brand-800 text-signal-400' : 'text-ink-500 hover:text-ink-800'
              }`}
              title="نمای حسابرسی دیوان و ثبت امضاها"
            >
              حسابرس
            </button>
          </div>

          {/* Main 5 Equivalent View Mode Switcher */}
          <div className="flex items-center gap-1 bg-paper p-1 rounded-xl border border-line">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-brand-800 text-signal-400 shadow-xs' : 'text-ink-500 hover:text-ink-800'
              }`}
              title="نمای جدول تحلیلی"
            >
              <BarChart3 size={14} />
              <span>جدول</span>
            </button>

            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'kanban' ? 'bg-brand-800 text-signal-400 shadow-xs' : 'text-ink-500 hover:text-ink-800'
              }`}
              title="نمای کانبان چرخه عمر"
            >
              <Kanban size={14} />
              <span>کانبان</span>
            </button>

            <button
              onClick={() => setViewMode('gantt')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'gantt' ? 'bg-brand-800 text-signal-400 shadow-xs' : 'text-ink-500 hover:text-ink-800'
              }`}
              title="نمای گانت زمان‌بندی"
            >
              <Calendar size={14} />
              <span>گانت</span>
            </button>

            <button
              onClick={() => setViewMode('map')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'map' ? 'bg-brand-800 text-signal-400 shadow-xs' : 'text-ink-500 hover:text-ink-800'
              }`}
              title="نمای نقشه سرزمینی"
            >
              <MapPin size={14} />
              <span>نقشه</span>
            </button>

            <button
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'matrix' ? 'bg-brand-800 text-signal-400 shadow-xs' : 'text-ink-500 hover:text-ink-800'
              }`}
              title="نمای ماتریس اثر–ریسک"
            >
              <Target size={14} />
              <span>ماتریس</span>
            </button>
          </div>
        </div>

        {/* Left side: Search & Tools */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {/* Quick Search */}
          <div className="relative flex-grow md:w-56">
            <Search size={14} className="absolute right-3 top-2.5 text-ink-500" />
            <input
              type="text"
              placeholder="جستجوی کد، عنوان، سلول..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-8 pl-3 py-1.5 bg-paper border border-line rounded-xl text-xs text-ink-800 focus:outline-none focus:border-brand-800"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute left-2 top-2 text-ink-500 hover:text-ink-800">
                <X size={12} />
              </button>
            )}
          </div>

          {/* NLQ Natural Language Search Modal Trigger */}
          <button
            onClick={() => setIsNLQOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-800 text-signal-400 hover:bg-brand-700 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 shadow-xs"
            title="پرس‌وجوی هوشمند با زبان طبیعی (Ctrl+K)"
          >
            <Sparkles size={14} />
            <span className="hidden sm:inline">پرس‌وجو (Ctrl+K)</span>
          </button>

          {/* Narrator Voice Summary Trigger */}
          <button
            onClick={toggleNarrator}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              isNarratorPlaying
                ? 'bg-warn-soft text-warn border-warn/40 animate-pulse'
                : 'bg-surface text-ink-800 border-line hover:border-brand-800'
            }`}
            title="روایت صوتی وضعیت سبد برای جلسات هیئت دولت"
          >
            <Volume2 size={14} className={isNarratorPlaying ? 'animate-bounce' : ''} />
            <span className="hidden lg:inline">{isNarratorPlaying ? 'در حال روایت...' : 'روایتگر'}</span>
          </button>

          {/* Toggle Balance Panel button */}
          <button
            onClick={() => setIsBalancePanelOpen(!isBalancePanelOpen)}
            className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
              isBalancePanelOpen ? 'bg-brand-100 border-signal-400 text-brand-800' : 'bg-surface border-line text-ink-500'
            }`}
            title={isBalancePanelOpen ? 'بستن پنل توازن' : 'بازکردن پنل توازن سبد'}
          >
            <PieChart size={16} />
          </button>
        </div>
      </div>

      {/* Preset Filter Chips Row */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-ink-500 shrink-0">فیلترهای میان‌بر:</span>
          
          <button
            onClick={() => applySavedFilter('high_risk_water')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
              activeSavedFilter === 'high_risk_water'
                ? 'bg-danger text-white border-danger-700 shadow-xs'
                : 'bg-surface border-line text-ink-800 hover:border-danger/40'
            }`}
          >
            🚨 پروژه‌های پرریسک حوزه آب
          </button>

          <button
            onClick={() => applySavedFilter('delayed_fars')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
              activeSavedFilter === 'delayed_fars'
                ? 'bg-warn text-white border-warn-700 shadow-xs'
                : 'bg-surface border-line text-ink-800 hover:border-warn/40'
            }`}
          >
            ⏳ عقب‌افتاده‌های استان فارس
          </button>

          <button
            onClick={() => applySavedFilter('isgp_prescriptions')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
              activeSavedFilter === 'isgp_prescriptions'
                ? 'bg-brand-800 text-signal-400 border-brand-800 shadow-xs'
                : 'bg-surface border-line text-ink-800 hover:border-brand-800'
            }`}
          >
            ✨ تجویزهای مستقیم ISGP
          </button>

          {activeSavedFilter && (
            <button
              onClick={() => applySavedFilter(activeSavedFilter)}
              className="text-[10px] text-danger hover:underline cursor-pointer flex items-center gap-1 mr-2"
            >
              <RotateCcw size={10} />
              <span>پاکسازی فیلتر</span>
            </button>
          )}
        </div>

        {/* PPE Queue Button */}
        <button
          onClick={() => setIsPPEQueueOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1 bg-brand-50 text-brand-700 border border-brand-200 rounded-lg font-bold text-[11px] hover:bg-brand-100 transition-colors cursor-pointer shrink-0"
        >
          <Briefcase size={13} />
          <span>صف اولویت PPE و ارزیابی پسینی (۱ مورد در انتظار)</span>
        </button>
      </div>

      {/* Narrator Banner when active */}
      {isNarratorPlaying && (
        <div className="bg-warn-soft border border-warn/40 text-warn p-3 rounded-xl flex items-center gap-3 text-xs animate-fade-in shadow-xs">
          <Bot size={20} className="text-warn shrink-0 animate-bounce" />
          <div className="flex flex-col gap-0.5">
            <span className="font-extrabold text-brand-800">گزارش صوتی هیئت دولت (خلاصه وضعیت هفته جاری):</span>
            <p className="leading-relaxed text-[11px]">
              «تعداد کل پروژه‌های فعال سبد ۴۸ مورد با جذب ۶۸.۴ درصدی بودجه است. پروژه خورشیدی اصفهان روی برنامه و پروژه باد میل نادر سیستان به دلیل گیر گمرکی نیازمند اقدام فوری وزیر صمت است.»
            </p>
          </div>
        </div>
      )}

      {/* =========================================================
          ROW 1: PORTFOLIO HEALTH STRIP (6 Live KPI Cards)
          ========================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* KPI 1: Active Projects */}
        <div 
          onClick={() => setKpiFilter(kpiFilter === 'active' ? null : 'active')}
          className={`bg-surface border rounded-2xl p-3 flex flex-col justify-between transition-all cursor-pointer hover:shadow-md ${
            kpiFilter === 'active' ? 'border-brand-800 bg-brand-100/50 ring-2 ring-brand-800/20' : 'border-line'
          }`}
        >
          <div className="flex items-center justify-between text-ink-500 text-[11px]">
            <span>پروژه‌های فعال</span>
            <Layers size={14} className="text-brand-800" />
          </div>
          <div className="flex items-baseline gap-2 my-1">
            <span className="text-xl font-black text-brand-800 font-mono">{healthKPIs.activeCount}</span>
            <span className="text-[10px] text-ink-500">از {healthKPIs.totalCount} کل</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-ok font-bold">
            <span>+۱۲٪ این ماه</span>
            <span className="text-[9px] bg-ok-soft px-1.5 py-0.2 rounded">پایدار</span>
          </div>
        </div>

        {/* KPI 2: Total Budget & Absorption */}
        <div className="panel-card p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-ink-500 text-[11px]">
            <span>بودجه کل و جذب</span>
            <TrendingUp size={14} className="text-ok" />
          </div>
          <div className="flex items-baseline gap-1 my-1">
            <span className="text-lg font-black text-ink-800 font-mono">${healthKPIs.absorbedBudget}M</span>
            <span className="text-[10px] text-ink-500">/ ${healthKPIs.totalBudget}M</span>
          </div>
          <div className="w-full bg-paper rounded-full h-1.5 overflow-hidden">
            <div className="bg-ok h-full rounded-full" style={{ width: `${healthKPIs.absorptionPercent}%` }} />
          </div>
          <div className="flex justify-between text-[9.5px] text-ink-500 mt-1 font-bold">
            <span>جذب: {healthKPIs.absorptionPercent}٪</span>
            <span className="text-ok">+۸.۲٪ جذب</span>
          </div>
        </div>

        {/* KPI 3: On-Track Schedule */}
        <div 
          onClick={() => setKpiFilter(kpiFilter === 'delayed' ? null : 'delayed')}
          className={`bg-surface border rounded-2xl p-3 flex flex-col justify-between transition-all cursor-pointer hover:shadow-md ${
            kpiFilter === 'delayed' ? 'border-warn/50 bg-warn-soft ring-2 ring-amber-500/20' : 'border-line'
          }`}
        >
          <div className="flex items-center justify-between text-ink-500 text-[11px]">
            <span>روی زمان‌بندی (On-Track)</span>
            <Clock size={14} className="text-info" />
          </div>
          <div className="flex items-baseline gap-1 my-1">
            <span className="text-xl font-black text-ink-800 font-mono">{healthKPIs.onTrackPercent}٪</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-warn font-bold">
            <span>۱ پروژه دارای لغزش</span>
            <span className="text-[9px] bg-warn-soft px-1.5 py-0.2 rounded text-warn">پایش</span>
          </div>
        </div>

        {/* KPI 4: Realized vs Predicted Impact */}
        <div className="panel-card p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-ink-500 text-[11px]">
            <span>اثر محقق‌شده</span>
            <Target size={14} className="text-brand-700" />
          </div>
          <div className="flex items-baseline gap-1 my-1">
            <span className="text-xl font-black text-brand-800 font-mono">{healthKPIs.avgRealizedImpact}٪</span>
            <span className="text-[10px] text-ink-500">پ‌ب: {healthKPIs.avgPredictedImpact}٪</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-brand-800 font-bold">
            <span>انطباق اثر: ۹۴٪</span>
            <span className="text-[9px] bg-brand-100 px-1.5 py-0.2 rounded text-brand-900">O/T/N</span>
          </div>
        </div>

        {/* KPI 5: High Risk & Stalled */}
        <div 
          onClick={() => setKpiFilter(kpiFilter === 'stalled' ? null : 'stalled')}
          className={`bg-surface border rounded-2xl p-3 flex flex-col justify-between transition-all cursor-pointer hover:shadow-md ${
            kpiFilter === 'stalled' ? 'border-danger/60 bg-danger-soft ring-2 ring-red-600/20' : 'border-line'
          }`}
        >
          <div className="flex items-center justify-between text-ink-500 text-[11px]">
            <span>پرریسک و متوقف</span>
            <AlertTriangle size={14} className="text-danger" />
          </div>
          <div className="flex items-baseline gap-2 my-1">
            <span className="text-xl font-black text-danger font-mono">{healthKPIs.stalledCount}</span>
            <span className="text-[10px] text-danger font-bold">متوقف</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-danger font-bold">
            <span>{healthKPIs.highRiskCount} مورد ریسک بالا</span>
            <span className="text-[9px] bg-danger-soft px-1.5 py-0.2 rounded text-danger">هشدار</span>
          </div>
        </div>

        {/* KPI 6: Allocation-Need Equity Gap */}
        <div className="panel-card p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-ink-500 text-[11px]">
            <span>شکاف عدالت تخصیص</span>
            <Scale size={14} className="text-brand-600" />
          </div>
          <div className="flex items-baseline gap-1 my-1">
            <span className="text-xl font-black text-brand-700 font-mono">{healthKPIs.equityGapPercent}٪</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-brand-700 font-bold">
            <span>۱۲ سلول پرنیازِ بی‌پروژه</span>
            <span className="text-[9px] bg-brand-100 px-1.5 py-0.2 rounded text-brand-800">بازنگری</span>
          </div>
        </div>
      </div>

      {/* =========================================================
          MAIN BODY: 75% CENTER WORKSPACE + 25% RIGHT BALANCE PANEL
          ========================================================= */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        
        {/* Left Side (75%): Active View Mode + Drawer */}
        <div className={`flex-grow w-full flex flex-col gap-4 ${isBalancePanelOpen ? 'lg:w-[72%]' : 'w-full'}`}>
          
          {/* Active View Header Bar */}
          <div className="flex items-center justify-between bg-surface border border-line p-3 rounded-2xl">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-800" />
              <h2 className="text-xs font-black text-brand-800">
                {viewMode === 'table' && 'نمای ۱ — جدول تحلیلی جامع سبد'}
                {viewMode === 'kanban' && 'نمای ۲ — کانبان چرخه عمر پروژه‌ها'}
                {viewMode === 'gantt' && 'نمای ۳ — زمان‌بندی و مسیر بحرانی (Gantt & Milestones)'}
                {viewMode === 'map' && 'نمای ۴ — توزیع سرزمینی و لایه شکاف عدالت'}
                {viewMode === 'matrix' && 'نمای ۵ — ماتریس اثر–ریسک (Impact-Risk Matrix)'}
              </h2>
              <span className="text-[10px] bg-brand-100 text-brand-800 px-2 py-0.5 rounded-full font-bold font-mono">
                {filteredProjects.length} پروژه
              </span>
            </div>

            {/* Actions for active view */}
            <div className="flex items-center gap-2">
              {viewMode === 'table' && (
                <button 
                  onClick={() => alert('خروجی رسمی اکسل سبد همراه با افشای فیلترها ایجاد گردید.')}
                  className="flex items-center gap-1 px-2.5 py-1 bg-surface hover:bg-paper border border-line rounded-xl text-[11px] font-bold text-ink-800 transition-colors cursor-pointer"
                >
                  <Download size={13} />
                  <span>خروجی CSV</span>
                </button>
              )}

              {viewMode === 'map' && (
                <button 
                  onClick={() => setIsEquityGapLayerActive(!isEquityGapLayerActive)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                    isEquityGapLayerActive
                      ? 'bg-brand-600 text-white border-brand-700 shadow-xs'
                      : 'bg-surface text-ink-800 border-line'
                  }`}
                >
                  <Eye size={13} />
                  <span>لایه شکاف عدالت (نیاز بدون پروژه)</span>
                </button>
              )}
            </div>
          </div>

          {/* VIEW 1: MASTER TABLE */}
          {viewMode === 'table' && (
            <div className="panel-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-brand-800 text-signal-400 font-extrabold select-none">
                    <tr>
                      <th className="p-3 text-right">کد و عنوان پروژه</th>
                      <th className="p-3 text-center">بُعد هدف</th>
                      <th className="p-3 text-center">سلول / استان</th>
                      <th className="p-3 text-center">دستگاه مجری</th>
                      <th className="p-3 text-center">مرحله چرخه عمر</th>
                      <th className="p-3 text-center">پیشرفت فیزیکی / جذب بودجه</th>
                      <th className="p-3 text-center">امتیاز PPE</th>
                      <th className="p-3 text-center">وضعیت ریسک</th>
                      <th className="p-3 text-center">اقدام</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filteredProjects.map((p) => {
                      const isSelected = p.id === selectedProjectId;
                      return (
                        <tr
                          key={p.id}
                          onClick={() => handleSelectProject(p.id)}
                          className={`hover:bg-brand-100/40 transition-colors cursor-pointer ${
                            isSelected ? 'bg-brand-100/70 border-r-4 border-r-brand-800' : ''
                          } ${p.isStalled ? 'bg-danger-soft/50' : ''}`}
                        >
                          {/* Title & Code */}
                          <td className="p-3">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5 font-bold text-ink-800">
                                {p.isStalled && <AlertTriangle size={14} className="text-danger shrink-0" />}
                                <span>{p.title}</span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-ink-500">
                                <span className="font-mono font-bold text-brand-800">{p.code}</span>
                                <span>• {p.originSourceName}</span>
                              </div>
                            </div>
                          </td>

                          {/* Dimension */}
                          <td className="p-3 text-center">
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-extrabold text-white"
                              style={{ backgroundColor: p.dimensionColor }}
                            >
                              {p.dimensionName}
                            </span>
                          </td>

                          {/* Cell & Province */}
                          <td className="p-3 text-center">
                            <div className="flex flex-col text-[11px]">
                              <span className="font-bold text-brand-800 font-mono">{p.cellCode}</span>
                              <span className="text-[10px] text-ink-500">{p.province} ({p.county})</span>
                            </div>
                          </td>

                          {/* Executing Agency */}
                          <td className="p-3 text-center font-bold text-ink-800">
                            {p.executingAgency}
                          </td>

                          {/* Lifecycle Stage */}
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                              p.lifecycleStage === 'execution' ? 'bg-ok-soft text-ok' :
                              p.lifecycleStage === 'monitoring' ? 'bg-info-soft text-info' :
                              p.lifecycleStage === 'ex_post' ? 'bg-brand-100 text-brand-800' :
                              p.lifecycleStage === 'proposal' ? 'bg-warn-soft text-warn' : 'bg-paper text-gray-800'
                            }`}>
                              {p.stageName}
                            </span>
                          </td>

                          {/* Dual Progress Bars (Physical vs Financial) */}
                          <td className="p-3 text-center min-w-[140px]">
                            <div className="flex flex-col gap-1 text-[10px]">
                              <div className="flex justify-between text-ink-800">
                                <span>فیزیکی: {p.physicalProgress}٪</span>
                                <span className="font-mono text-ok">${p.budgetAbsorbed}M</span>
                              </div>
                              <div className="w-full bg-line rounded-full h-1.5 overflow-hidden">
                                <div className="bg-brand-800 h-full rounded-full" style={{ width: `${p.physicalProgress}%` }} />
                              </div>
                              <div className="flex justify-between text-[9px] text-ink-500">
                                <span>مالی: {p.financialProgress}٪</span>
                                <span>کل: ${p.budgetTotal}M</span>
                              </div>
                            </div>
                          </td>

                          {/* PPE Score */}
                          <td className="p-3 text-center">
                            <span className="font-mono font-black text-sm text-brand-800">
                              {p.ppeScore}
                            </span>
                          </td>

                          {/* Risk Level */}
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              p.riskLevel === 'low' ? 'bg-ok-soft text-ok border border-ok/40' :
                              p.riskLevel === 'medium' ? 'bg-warn-soft text-warn border border-warn/40' :
                              'bg-danger-soft text-danger border border-danger/40'
                            }`}>
                              {p.riskLevel === 'low' ? 'کم' : p.riskLevel === 'medium' ? 'متوسط' : 'پرریسک'}
                            </span>
                          </td>

                          {/* Action */}
                          <td className="p-3 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectProject(p.id);
                              }}
                              className="px-2.5 py-1 bg-brand-800 text-signal-400 rounded-lg text-[10px] font-bold hover:bg-brand-700 transition-colors cursor-pointer"
                            >
                              جزئیات
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 2: LIFECYCLE KANBAN */}
          {viewMode === 'kanban' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 overflow-x-auto pb-4">
              {[
                { stage: 'proposal', name: 'پیشنهاد اولیه', color: 'border-warn/40 bg-warn-soft/30' },
                { stage: 'ppe_eval', name: 'در ارزیابی PPE', color: 'border-brand-400 bg-brand-50/30' },
                { stage: 'execution', name: 'در حال اجرا', color: 'border-brand-800 bg-brand-100/30' },
                { stage: 'monitoring', name: 'پایش اثر و ارزیابی پسینی', color: 'border-info/40 bg-info-soft/30' },
              ].map((col) => {
                const stageProjects = filteredProjects.filter(p => {
                  if (col.stage === 'monitoring') return p.lifecycleStage === 'monitoring' || p.lifecycleStage === 'ex_post';
                  return p.lifecycleStage === col.stage;
                });

                return (
                  <div key={col.stage} className={`border-t-4 ${col.color} bg-surface rounded-2xl p-3 border border-line flex flex-col gap-3 min-h-[400px]`}>
                    <div className="flex items-center justify-between border-b border-line pb-2">
                      <span className="font-bold text-xs text-brand-800">{col.name}</span>
                      <span className="text-[10px] bg-paper px-2 py-0.5 rounded-full font-bold font-mono">
                        {stageProjects.length}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2.5">
                      {stageProjects.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => handleSelectProject(p.id)}
                          className={`p-3 bg-surface hover:bg-surface border rounded-xl shadow-xs transition-all cursor-pointer flex flex-col gap-2 ${
                            p.id === selectedProjectId ? 'border-brand-800 ring-2 ring-brand-800/20' : 'border-line'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-mono font-bold text-brand-800">{p.code}</span>
                            <span className="px-1.5 py-0.2 rounded text-white font-extrabold" style={{ backgroundColor: p.dimensionColor }}>
                              {p.dimensionName}
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-ink-800 leading-snug">{p.title}</h4>

                          <div className="flex items-center justify-between text-[10px] text-ink-500">
                            <span>بودجه: ${p.budgetTotal}M</span>
                            <span className="font-bold">پیشرفت: {p.physicalProgress}٪</span>
                          </div>

                          <div className="w-full bg-line rounded-full h-1 overflow-hidden">
                            <div className="bg-brand-800 h-full rounded-full" style={{ width: `${p.physicalProgress}%` }} />
                          </div>

                          {/* Manager & Action */}
                          <div className="flex items-center justify-between border-t border-line pt-2 text-[10px]">
                            <div className="flex items-center gap-1.5">
                              <img src={p.manager.avatar} alt={p.manager.name} className="w-5 h-5 rounded-full object-cover" />
                              <span className="text-ink-500 truncate max-w-[90px]">{p.manager.name}</span>
                            </div>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRequestStageChange(p.id, p.lifecycleStage === 'execution' ? 'monitoring' : 'execution');
                              }}
                              className="text-[9.5px] font-bold text-brand-800 hover:underline cursor-pointer flex items-center gap-0.5"
                            >
                              <span>انتقال مرحله</span>
                              <ChevronLeft size={10} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW 3: GANTT TIMELINE */}
          {viewMode === 'gantt' && (
            <div className="panel-card p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between text-xs border-b border-line pb-2 text-ink-500">
                <span>زمان‌بندی پروژه‌ها و رویدادهای آستانه‌ای O/T/N</span>
                <span className="font-mono font-bold text-brand-800">خط امروز: ۱۴۰۵/۰۵/۱۸</span>
              </div>

              <div className="flex flex-col gap-3">
                {filteredProjects.map((p) => (
                  <div key={p.id} className="flex flex-col gap-1 p-2 bg-surface border border-line rounded-xl text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ink-800">{p.title}</span>
                      <span className="text-[10px] text-ink-500 font-mono">{p.startDate} تا {p.expectedEndDate}</span>
                    </div>

                    {/* Timeline Bar */}
                    <div className="relative w-full bg-line h-5 rounded-lg overflow-hidden flex items-center my-1">
                      {/* Today Marker Line */}
                      <div className="absolute right-[45%] top-0 bottom-0 w-0.5 bg-danger z-10" title="امروز" />
                      
                      <div
                        className="h-full bg-brand-800 rounded-lg transition-all flex items-center justify-end px-2 text-[9px] text-signal-400 font-bold"
                        style={{ width: `${p.physicalProgress}%` }}
                      >
                        {p.physicalProgress}٪
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-ink-500">
                      <span>مایلستون بعدی: {p.milestones[0]?.title || 'در حال برنامه‌ریزی'}</span>
                      <span className={p.isOnTrack ? 'text-ok font-bold' : 'text-danger font-bold'}>
                        {p.isOnTrack ? 'روی زمان‌بندی' : 'دارای لغزش زمانی'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW 4: PORTFOLIO MAP */}
          {viewMode === 'map' && (
            <div className="panel-card p-4 flex flex-col gap-3 relative overflow-hidden animate-fade-in">
              <div className="flex items-center justify-between text-xs text-ink-800">
                <span className="font-extrabold text-brand-800">توزیع سرزمینی پروژه‌ها و نقشه حرارتی انطباق (O/T/N HeatMap & Equity Gap)</span>
                {isEquityGapLayerActive && (
                  <span className="bg-brand-100 text-brand-900 border border-brand-200 text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                    لایه شکاف عدالت فعال است (سلول‌های پرنیازِ بدون پروژه با هاشور سرخ/بنفش)
                  </span>
                )}
              </div>

              <IranSuitabilityMap
                projects={filteredProjects}
                selectedProjectId={selectedProjectId}
                onSelectProject={handleSelectProject}
                isEquityGapActive={isEquityGapLayerActive}
              />
            </div>
          )}

          {/* VIEW 5: IMPACT-RISK MATRIX */}
          {viewMode === 'matrix' && (
            <div className="panel-card p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between text-xs text-ink-800">
                <span className="font-bold">ماتریس اثر–ریسک پروژه‌ها</span>
                <span className="text-[10px] text-ink-500">محور افقی: میزان ریسک | محور عمودی: اثر پیش‌بینی‌شده</span>
              </div>

              {/* 4-Quadrant Bubble Plot */}
              <div className="relative w-full h-[380px] bg-paper rounded-xl border border-line p-6 flex flex-col justify-between">
                {/* Quadrant Divider Lines */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-full h-0.5 bg-line-strong stroke-dasharray-2" />
                  <div className="h-full w-0.5 bg-line-strong stroke-dasharray-2 absolute" />
                </div>

                {/* Quadrant Labels */}
                <span className="absolute top-2 right-2 text-[10px] font-bold text-ok bg-ok-soft px-2 py-0.5 rounded">
                  ستاره‌های راهبردی (اثر بالا / ریسک کم)
                </span>
                <span className="absolute top-2 left-2 text-[10px] font-bold text-warn bg-warn-soft px-2 py-0.5 rounded">
                  شرط‌بندی بزرگ (اثر بالا / ریسک بالا)
                </span>
                <span className="absolute bottom-2 right-2 text-[10px] font-bold text-ink-700 bg-line px-2 py-0.5 rounded">
                  کم‌بازده کم‌ریسک
                </span>
                <span className="absolute bottom-2 left-2 text-[10px] font-bold text-danger bg-danger-soft px-2 py-0.5 rounded">
                  نیازمند بازنگری/توقف (اثر کم / ریسک بالا)
                </span>

                {/* Bubbles */}
                {filteredProjects.map((p) => {
                  const left = `${p.riskScore}%`;
                  const bottom = `${p.predictedImpact}%`;
                  const isSelected = p.id === selectedProjectId;

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProject(p.id)}
                      className={`absolute rounded-full border-2 border-white shadow-md flex items-center justify-center text-white text-[9px] font-black cursor-pointer transition-all hover:scale-125 z-10 ${
                        isSelected ? 'ring-4 ring-brand-800' : ''
                      }`}
                      style={{
                        left,
                        bottom,
                        width: `${Math.max(24, p.budgetTotal / 15)}px`,
                        height: `${Math.max(24, p.budgetTotal / 15)}px`,
                        backgroundColor: p.dimensionColor,
                      }}
                      title={`${p.title} (اثر: ${p.predictedImpact}٪ | ریسک: ${p.riskScore}٪)`}
                    >
                      {p.code.split('-')[2]}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* PROJECT DETAILS DRAWER (Slide-Over Drawer 420px when selected) */}
          <ProjectDrawer
            project={selectedProject}
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            onRequestStageChange={handleRequestStageChange}
          />
        </div>

        {/* Right Collapsible Side Panel (25%): Portfolio Balance Panel */}
        {isBalancePanelOpen && (
          <div className="w-full lg:w-[28%] panel-card p-4 flex flex-col gap-4 shrink-0">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <div className="flex items-center gap-1.5 font-bold text-xs text-brand-800">
                <Scale size={16} />
                <span>پنل توازن سبد</span>
              </div>
              <button onClick={() => setIsBalancePanelOpen(false)} className="text-ink-300 hover:text-ink-800">
                <X size={16} />
              </button>
            </div>

            {/* Dimension Budget vs Need Comparison */}
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-bold text-ink-500">توزیع بودجه در برابر نیاز ثبت‌شده O/T/N:</span>
              
              <div className="flex flex-col gap-2.5">
                {PORTFOLIO_DIMENSION_BALANCES.map((dim) => (
                  <div key={dim.id} className="flex flex-col gap-1 text-[11px]">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-ink-800">{dim.name}</span>
                      <span className="font-mono text-brand-800">${dim.budgetAllocated}M</span>
                    </div>

                    <div className="w-full bg-paper rounded-full h-2 overflow-hidden flex">
                      <div className="h-full rounded-full" style={{ width: `${dim.budgetPercent}%`, backgroundColor: dim.color }} title={`بودجه: ${dim.budgetPercent}٪`} />
                    </div>

                    <div className="flex justify-between text-[9.5px] text-ink-500">
                      <span>تخصیص: {dim.budgetPercent}٪</span>
                      <span className={dim.gapStatus === 'underfunded' ? 'text-danger font-bold' : 'text-ok'}>
                        نیاز: {dim.needPercent}٪ {dim.gapStatus === 'underfunded' && '(کمبود)'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Overlap Detector Alert */}
            <div className="p-3 bg-warn-soft border border-warn/40 rounded-xl flex flex-col gap-1.5 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-warn">
                <AlertTriangle size={15} />
                <span>کاشف همپوشانی</span>
              </div>
              <p className="text-[10.5px] text-warn leading-relaxed">
                ۲ پروژه موازی با عنوان «لایروبی و بهسازی مسیر آبخوان بختگان» در دو دستگاه مجری متفاوت شناسایی شد. پیشنهاد تجمیع منابع.
              </p>
              <button
                onClick={() => alert('پیشنهاد تجمیع پروژه به شورای عالی برنامه‌ریزی ارسال گردید.')}
                className="py-1 bg-warn text-white rounded-lg text-[10px] font-bold hover:bg-warn-700 transition-colors cursor-pointer self-start px-2 mt-1"
              >
                اعمال تجمیع پروژه
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================
          MODALS
          ========================================================= */}

      {/* 1. NLQ Search Modal (Ctrl+K) */}
      {isNLQOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-line flex flex-col gap-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-brand-800" />
                <h3 className="text-sm font-bold text-ink-800">پرس‌وجوی هوشمند زبان طبیعی سبد</h3>
              </div>
              <button onClick={() => setIsNLQOpen(false)} className="text-ink-300 hover:text-ink-800 cursor-pointer"><X size={18} /></button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="مثال: پروژه‌های عقب‌افتاده آب در سیستان را نشان بده..."
                value={nlqQuery}
                onChange={(e) => setNlqQuery(e.target.value)}
                className="flex-grow p-2.5 bg-paper border border-line rounded-xl text-xs text-ink-800 focus:outline-none focus:border-brand-800"
              />
              <button
                onClick={handleRunNLQ}
                className="px-4 py-2.5 bg-brand-800 text-signal-400 rounded-xl text-xs font-bold cursor-pointer hover:bg-brand-700"
              >
                تحلیل
              </button>
            </div>

            {nlqResult && (
              <div className="p-3 bg-brand-100 border border-signal-400 rounded-xl text-xs text-brand-800 leading-relaxed animate-fade-in">
                {nlqResult}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Digital Signature Modal */}
      {isSignatureModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-6 max-w-md w-full shadow-2xl border border-line flex flex-col gap-4 animate-fade-in">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2 text-brand-800 font-bold text-sm">
                <Lock size={18} />
                <span>تأییدیه با امضای دیجیتال حاکمیتی</span>
              </div>
              <button onClick={() => setIsSignatureModalOpen(false)} className="text-ink-300 hover:text-ink-800 cursor-pointer"><X size={18} /></button>
            </div>

            <p className="text-xs text-ink-500 leading-relaxed">
              جهت تغییر مرحله این پروژه، امضای حاکمیتی مجاز الزامی است. این اقدام همراه با کد هش یکتا در لاگ حسابرسی دیوان ثبت خواهد شد.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-ink-800">مقام امضاکننده:</label>
              <input
                type="text"
                value={digitalSignatory}
                onChange={(e) => setDigitalSignatory(e.target.value)}
                className="p-2 bg-paper border border-line rounded-xl text-xs text-ink-800"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={confirmStageChange}
                className="flex-1 py-2 bg-brand-800 text-signal-400 rounded-xl text-xs font-bold hover:bg-brand-700 cursor-pointer"
              >
                ثبت قطعی و صدور امضا
              </button>
              <button
                onClick={() => setIsSignatureModalOpen(false)}
                className="px-4 py-2 bg-paper text-ink-700 rounded-xl text-xs font-bold hover:bg-line cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. PPE Queue & Ex-Post Evaluation Modal */}
      {isPPEQueueOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-line flex flex-col gap-4 animate-fade-in max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2 font-bold text-sm text-brand-800">
                <Briefcase size={18} />
                <span>صف اولویت‌بندی موتور PPE و ارزیابی پسینی</span>
              </div>
              <button onClick={() => setIsPPEQueueOpen(false)} className="text-ink-300 hover:text-ink-800 cursor-pointer"><X size={18} /></button>
            </div>

            <div className="p-3 bg-brand-100 border border-signal-400 rounded-xl text-xs text-brand-800">
              <strong>کارت درس‌آموخته ارزیابی پسینی (بیمارستان بندرعباس):</strong>
              <p className="mt-1 text-[11px]">
                کاهش ۳۵ درصدی زمان دسترسی بیماران بدحال سواحل خلیج فارس محقق شد. درس‌آموخته: بهره‌گیری از معماری بومی ساحلی مصرف انرژی را ۲۰٪ کاهش داد. خوراک خودکار جهت تکثیر در چابهار ثبت گردید.
              </p>
            </div>

            <button
              onClick={() => setIsPPEQueueOpen(false)}
              className="py-2 bg-brand-800 text-signal-400 rounded-xl text-xs font-bold hover:bg-brand-700 cursor-pointer"
            >
              بستن
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
