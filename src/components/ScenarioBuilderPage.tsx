import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Play, 
  Pause, 
  RotateCcw, 
  Save, 
  Copy, 
  GitFork, 
  Share2, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  Sliders, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  MapPin, 
  Calendar, 
  Clock, 
  DollarSign, 
  Target, 
  ShieldAlert, 
  Zap, 
  MessageSquare, 
  Users, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Search, 
  Filter, 
  BarChart3, 
  PieChart, 
  Activity, 
  Cpu, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Lock, 
  Unlock, 
  ExternalLink,
  ArrowLeftRight,
  GitCommit,
  Radio,
  RefreshCw,
  Info
} from 'lucide-react';
import IranSuitabilityMap from './IranSuitabilityMap';
import CausalGraphLive from './CausalGraphLive';
import FanChart from './FanChart';
import { INITIAL_PORTFOLIO_PROJECTS, PortfolioProject } from '../data/portfolioData';

// --- TYPES FOR SCENARIO BUILDER ---

export interface PolicyLever {
  id: string;
  name: string;
  dimensionCode: 'S' | 'E' | 'P' | 'D' | 'I' | 'C' | 'N' | 'F' | 'T' | 'R';
  dimensionName: string;
  dimensionColor: string;
  intensity: number; // 0 to 100%
  startYear: number;
  endYear: number;
  estimatedBudgetM: number;
  historicalEfficacy: number; // 0 to 100%
  prerequisites?: string[];
  conflictWarning?: string;
  synergyNotice?: string;
  description: string;
}

export interface AssumptionItem {
  id: string;
  name: string;
  category: 'climate' | 'economy' | 'demographics' | 'global';
  currentValue: string;
  unit: string;
  uncertaintyBound: string; // e.g. "±15%"
  source: string;
  presetValue: {
    pessimistic: string;
    probable: string;
    optimistic: string;
  };
  lastUpdated: string;
}

export interface ScenarioDefinition {
  id: string;
  title: string;
  version: string;
  parentBranch?: string;
  status: 'draft' | 'running' | 'executed' | 'pending_approval' | 'approved';
  scopeLevel: string; // L0 to L5
  cellCount: number;
  startYear: number;
  endYear: number;
  baselineName: string;
  budgetCapM: number;
  levers: PolicyLever[];
  assumptions: AssumptionItem[];
  outcomes: {
    waterStressDelta: number; // e.g. -26.6%
    gdpGrowthDelta: number; // e.g. +2.7%
    satisfactionDelta: number; // e.g. +19%
    cellsExitedCrisis: number;
    equityGiniDelta: number; // e.g. -0.04
    totalCostM: number;
    discountedBenefitM: number;
    breakevenYear: number;
  };
}

// Default Presets Exogenous Assumptions
const DEFAULT_ASSUMPTIONS: AssumptionItem[] = [
  {
    id: 'asm-1',
    name: 'نرخ میانگین بارش سالانه کشور',
    category: 'climate',
    currentValue: '۲۱۰',
    unit: 'میلی‌متر',
    uncertaintyBound: '±۱۵٪',
    source: 'سازمان هواشناسی کشور (ایستگاه‌های سینوپتیک)',
    presetValue: { pessimistic: '۱۷۵', probable: '۲۱۰', optimistic: '۲۴۵' },
    lastUpdated: '۱۴۰۴/۱۱/۲۰'
  },
  {
    id: 'asm-2',
    name: 'نرخ تورم عمومی ساختار هزینه‌ها',
    category: 'economy',
    currentValue: '۳۲.۵',
    unit: 'درصد',
    uncertaintyBound: '±۴.۵٪',
    source: 'گزارش ناترازی بانک مرکزی جمهوری اسلامی',
    presetValue: { pessimistic: '۴۲.۰', probable: '۳۲.۵', optimistic: '۲۲.۰' },
    lastUpdated: '۱۴۰۴/۱۲/۰۱'
  },
  {
    id: 'asm-3',
    name: 'قیمت متوسط نفت و میعانات گازی',
    category: 'global',
    currentValue: '۷۵',
    unit: 'دلار/بشکه',
    uncertaintyBound: '±۱۲٪',
    source: 'صندوق بین‌المللی پول و اوپک',
    presetValue: { pessimistic: '۵۵', probable: '۷۵', optimistic: '۹۵' },
    lastUpdated: '۱۴۰۵/۰۱/۱۰'
  },
  {
    id: 'asm-4',
    name: 'نرخ خالص رشد و مهاجرت استانی',
    category: 'demographics',
    currentValue: '۱.۱۸',
    unit: 'درصد سالانه',
    uncertaintyBound: '±۰.۳٪',
    source: 'نتایج سرشماری و دوقلوی سرزمینی آرا',
    presetValue: { pessimistic: '۱.۶۵', probable: '۱.۱۸', optimistic: '۰.۸۵' },
    lastUpdated: '۱۴۰۴/۱۰/۱۵'
  }
];

// Default Initial Policy Levers (10 Dimensions)
const INITIAL_LEVERS: PolicyLever[] = [
  {
    id: 'lvr-1',
    name: 'احداث شبکه‌های مجتمع شیرین‌سازی و انتقال آب خلیج فارس',
    dimensionCode: 'I',
    dimensionName: 'زیرساختی',
    dimensionColor: '#6366F1',
    intensity: 75,
    startYear: 1405,
    endYear: 1408,
    estimatedBudgetM: 1200,
    historicalEfficacy: 92,
    description: 'تامین آب شرب و صنعتی استان‌های کرمان، یزد و سیستان و بلوچستان با اولویت خروج از بحران.'
  },
  {
    id: 'lvr-2',
    name: 'انسداد چاه‌های غیرمجاز و نصب کنتورهای هوشمند',
    dimensionCode: 'N',
    dimensionName: 'محیط‌زیست/اقلیم',
    dimensionColor: '#10B981',
    intensity: 60,
    startYear: 1405,
    endYear: 1407,
    estimatedBudgetM: 280,
    historicalEfficacy: 85,
    synergyNotice: 'هم‌افزایی عالی با لایه شیرین‌سازی آب برای ترمیم آبخوان‌ها',
    description: 'مهار فرونشست دشت‌های استان‌های مرودشت، مشهد و اصفهان.'
  },
  {
    id: 'lvr-3',
    name: 'توسعه فیبر نوری و زیرساخت اقتصاد دیجیتال روستایی',
    dimensionCode: 'D',
    dimensionName: 'دیجیتال/فناوری',
    dimensionColor: '#F59E0B',
    intensity: 85,
    startYear: 1405,
    endYear: 1409,
    estimatedBudgetM: 450,
    historicalEfficacy: 88,
    description: 'ایجاد ۵۰ هزار شغل دیجیتال و کاهش انگیزه مهاجرت از سلول‌های محروم مرزی.'
  },
  {
    id: 'lvr-4',
    name: 'مشوق‌های مالیاتی و تسهیلات اشتغال در کریدورهای مرزی',
    dimensionCode: 'E',
    dimensionName: 'اقتصادی',
    dimensionColor: '#10B981',
    intensity: 70,
    startYear: 1406,
    endYear: 1410,
    estimatedBudgetM: 620,
    historicalEfficacy: 79,
    description: 'جذب سرمایه‌گذاری بخش خصوصی در استان‌های ایلام، کردستان و سیستان.'
  }
];

// Pre-configured Scenarios for Comparison (up to 4 scenarios)
const INITIAL_SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'scn-main',
    title: 'سناریوی اولویت‌دار: پایداری آبی و توسعه پایدار مرزی (توصیه سیستم)',
    version: 'v1.3',
    parentBranch: 'برنامه‌ریزی کلان ۱۴۰۵',
    status: 'running',
    scopeLevel: 'L2 (استانی)',
    cellCount: 31,
    startYear: 1405,
    endYear: 1410,
    baselineName: 'روند ۵ سال اخیر (بدون مداخله ساختاری)',
    budgetCapM: 3000,
    levers: INITIAL_LEVERS,
    assumptions: DEFAULT_ASSUMPTIONS,
    outcomes: {
      waterStressDelta: -26.6,
      gdpGrowthDelta: +2.7,
      satisfactionDelta: +19.0,
      cellsExitedCrisis: 28,
      equityGiniDelta: -0.045,
      totalCostM: 2550,
      discountedBenefitM: 4800,
      breakevenYear: 1408
    }
  },
  {
    id: 'scn-02',
    title: 'سناریوی توسعه جهشی اقتصاد دیجیتال و ترانزیت',
    version: 'v2.0',
    parentBranch: 'شاخه‌گیری از v1.0',
    status: 'draft',
    scopeLevel: 'L2 (استانی)',
    cellCount: 31,
    startYear: 1405,
    endYear: 1410,
    baselineName: 'روند ۵ سال اخیر',
    budgetCapM: 3500,
    levers: [
      { ...INITIAL_LEVERS[2], intensity: 95 },
      { ...INITIAL_LEVERS[3], intensity: 90 }
    ],
    assumptions: DEFAULT_ASSUMPTIONS,
    outcomes: {
      waterStressDelta: -8.2,
      gdpGrowthDelta: +4.2,
      satisfactionDelta: +14.5,
      cellsExitedCrisis: 14,
      equityGiniDelta: -0.021,
      totalCostM: 1800,
      discountedBenefitM: 3900,
      breakevenYear: 1407
    }
  },
  {
    id: 'scn-03',
    title: 'سناریوی مهار اضطراری فرونشست و خشکسالی',
    version: 'v1.1',
    parentBranch: 'ستاد بحران اقلیم',
    status: 'pending_approval',
    scopeLevel: 'L2 (استانی)',
    cellCount: 18,
    startYear: 1405,
    endYear: 1408,
    baselineName: 'روند ۵ سال اخیر',
    budgetCapM: 2200,
    levers: [
      { ...INITIAL_LEVERS[0], intensity: 90 },
      { ...INITIAL_LEVERS[1], intensity: 85 }
    ],
    assumptions: DEFAULT_ASSUMPTIONS,
    outcomes: {
      waterStressDelta: -34.0,
      gdpGrowthDelta: +1.1,
      satisfactionDelta: +11.0,
      cellsExitedCrisis: 22,
      equityGiniDelta: -0.015,
      totalCostM: 2100,
      discountedBenefitM: 3200,
      breakevenYear: 1409
    }
  },
  {
    id: 'scn-baseline',
    title: 'خط مبنا: ادامه وضع موجود (عدم مداخله ساختاری)',
    version: 'v0.0',
    status: 'executed',
    scopeLevel: 'L2 (استانی)',
    cellCount: 31,
    startYear: 1405,
    endYear: 1410,
    baselineName: 'بدون تغییر سیاست',
    budgetCapM: 0,
    levers: [],
    assumptions: DEFAULT_ASSUMPTIONS,
    outcomes: {
      waterStressDelta: +12.4, // worsening
      gdpGrowthDelta: +0.8,
      satisfactionDelta: -8.5,
      cellsExitedCrisis: 0,
      equityGiniDelta: +0.032, // worsening
      totalCostM: 0,
      discountedBenefitM: 0,
      breakevenYear: 1410
    }
  }
];

export default function ScenarioBuilderPage() {
  // === STATE MANAGEMENT ===
  const [activeTab, setActiveTab] = useState<'scope' | 'levers' | 'assumptions' | 'canvas' | 'kpi' | 'compare'>('canvas');
  const [activeMode, setActiveMode] = useState<'analyst' | 'presentation' | 'workshop' | 'crisis' | 'auditor'>('analyst');
  
  // Scenarios State
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>(INITIAL_SCENARIOS);
  const [activeScenarioId, setActiveScenarioId] = useState<string>('scn-main');
  
  const currentScenario = useMemo(() => {
    return scenarios.find(s => s.id === activeScenarioId) || scenarios[0];
  }, [scenarios, activeScenarioId]);

  // Active Levers in Editor
  const [levers, setLevers] = useState<PolicyLever[]>(currentScenario.levers);
  const [assumptions, setAssumptions] = useState<AssumptionItem[]>(currentScenario.assumptions);
  const [assumptionPreset, setAssumptionPreset] = useState<'probable' | 'pessimistic' | 'optimistic'>('probable');
  
  // Timeline Control State
  const [selectedYear, setSelectedYear] = useState<number>(1408);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Modals & Floating Tools
  const [isNLQOpen, setIsNLQOpen] = useState<boolean>(false);
  const [nlqQuery, setNlqQuery] = useState<string>('');
  const [isGoalSeekOpen, setIsGoalSeekOpen] = useState<boolean>(false);
  const [goalSeekTarget, setGoalSeekTarget] = useState<number>(30); // Target cells out of crisis
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [isMonteCarloRunning, setIsMonteCarloRunning] = useState<boolean>(false);
  const [mcProgress, setMcProgress] = useState<number>(100);

  // Selected cell/project for map interaction
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Shortcut Listener for Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsNLQOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Timeline Auto Play Loop
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setSelectedYear(prev => {
          if (prev >= 1410) {
            setIsPlaying(false);
            return 1405;
          }
          return prev + 1;
        });
      }, 1500 / playbackSpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  // Recalculate Live Outcomes based on active levers & intensity
  const calculatedOutcomes = useMemo(() => {
    const totalLeverIntensity = levers.reduce((sum, l) => sum + l.intensity, 0);
    const totalBudget = levers.reduce((sum, l) => sum + l.estimatedBudgetM, 0);
    
    // Water stress reduction factor
    const waterLever = levers.find(l => l.dimensionCode === 'N' || l.dimensionCode === 'I');
    const waterFactor = waterLever ? waterLever.intensity * 0.32 : 10;
    
    // GDP growth factor
    const ecoLever = levers.find(l => l.dimensionCode === 'E' || l.dimensionCode === 'D');
    const gdpFactor = ecoLever ? ecoLever.intensity * 0.035 : 0.8;

    return {
      waterStressDelta: Number((-10 - waterFactor).toFixed(1)),
      gdpGrowthDelta: Number((0.8 + gdpFactor).toFixed(1)),
      satisfactionDelta: Number((5 + totalLeverIntensity * 0.08).toFixed(1)),
      cellsExitedCrisis: Math.min(31, Math.round(12 + totalLeverIntensity * 0.06)),
      equityGiniDelta: -0.042,
      totalCostM: totalBudget,
      discountedBenefitM: Math.round(totalBudget * 1.85),
      breakevenYear: 1408
    };
  }, [levers]);

  // Handle Lever Intensity Slider Change
  const handleUpdateLeverIntensity = (id: string, newIntensity: number) => {
    setLevers(prev => prev.map(l => l.id === id ? { ...l, intensity: newIntensity } : l));
  };

  // Run Monte Carlo Simulation Trigger
  const handleRunMonteCarlo = () => {
    setIsMonteCarloRunning(true);
    setMcProgress(0);
    let current = 0;
    const timer = setInterval(() => {
      current += 20;
      setMcProgress(current);
      if (current >= 100) {
        clearInterval(timer);
        setIsMonteCarloRunning(false);
      }
    }, 200);
  };

  // Goal-Seek AI Suggestion Engine
  const handleApplyGoalSeek = () => {
    // Auto adjust sliders to achieve target
    setLevers(prev => prev.map(l => ({ ...l, intensity: Math.min(95, l.intensity + 15) })));
    setIsGoalSeekOpen(false);
    setActiveTab('canvas');
  };

  // Natural Language Query Process
  const handleExecuteNLQ = () => {
    if (!nlqQuery.trim()) return;
    // Mock AI interpretation: Add or boost levers
    setLevers(prev => [
      ...prev,
      {
        id: `lvr-${Date.now()}`,
        name: `مداخله هوشمند: ${nlqQuery.substring(0, 35)}...`,
        dimensionCode: 'N',
        dimensionName: 'محیط‌زیست/اقلیم',
        dimensionColor: '#10B981',
        intensity: 80,
        startYear: 1405,
        endYear: 1409,
        estimatedBudgetM: 350,
        historicalEfficacy: 87,
        description: `تولیدشده خودکار از پرس‌و‌جوی: ${nlqQuery}`
      }
    ]);
    setIsNLQOpen(false);
    setNlqQuery('');
  };

  return (
    <div className={`flex flex-col gap-4 w-full min-h-screen font-sans select-none text-right ${
      activeMode === 'crisis' ? 'bg-brand-950 text-danger-soft' : 'bg-paper text-ink-800'
    }`}>
      
      {/* ========================================================================= */}
      {/* 0. SCENARIO IDENTITY BAND (Sticky Header - 64px)                          */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-surface border-b border-line shadow-sm px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        
        {/* Left Side: Title, Version, Lineage & Status */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-800 text-signal-400 flex items-center justify-center font-bold shrink-0 shadow-xs">
            <Cpu size={20} />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <input
                type="text"
                defaultValue={currentScenario.title}
                className="font-black text-sm text-brand-800 bg-transparent hover:bg-paper focus:bg-surface focus:outline-none focus:ring-1 focus:ring-brand-800 px-1.5 py-0.5 rounded-lg transition-all border-b border-transparent hover:border-line-strong truncate max-w-md"
              />
              <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-paper text-brand-800 border border-line">
                {currentScenario.version}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${
                currentScenario.status === 'running' ? 'bg-ok-soft text-ok border border-ok/40' :
                currentScenario.status === 'pending_approval' ? 'bg-warn-soft text-warn border border-warn/40' :
                'bg-paper text-ink-700'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-ok-soft animate-pulse" />
                <span>{
                  currentScenario.status === 'running' ? 'در حال شبیه‌سازی زنده' :
                  currentScenario.status === 'pending_approval' ? 'در انتظار تأیید حاکمیتی' : 'پیشنویس'
                }</span>
              </span>
            </div>

            <div className="flex items-center gap-3 text-[10.5px] text-ink-500 mt-0.5">
              <span>سطح تجمیع: <strong className="text-ink-800">{currentScenario.scopeLevel}</strong></span>
              <span>•</span>
              <span>پوشش: <strong className="text-ink-800">{currentScenario.cellCount} سلول</strong></span>
              <span>•</span>
              <span>افق: <strong className="text-ink-800 font-mono">{currentScenario.startYear} - {currentScenario.endYear}</strong></span>
              <span>•</span>
              <span className="text-ok font-bold bg-ok-soft px-1.5 py-0.2 rounded border border-ok/40 flex items-center gap-1">
                <CheckCircle2 size={11} />
                <span>داده‌ها به‌روز (۱۰۰٪ پوشش)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Quick Action Buttons & NLQ Trigger */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Natural Language Query Search (Ctrl+K) Button */}
          <button
            onClick={() => setIsNLQOpen(true)}
            className="px-3 py-1.5 bg-brand-100 hover:bg-brand-200 text-brand-800 border border-signal-400 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <Sparkles size={14} className="text-brand-800" />
            <span>پرس‌و‌جوی زنده (Ctrl+K)</span>
            <kbd className="hidden sm:inline-block font-mono text-[9px] bg-surface px-1.5 py-0.5 rounded border border-line-strong shadow-2xs">
              ⌘K
            </kbd>
          </button>

          {/* Goal-Seek Reverse Optimizer Button */}
          <button
            onClick={() => setIsGoalSeekOpen(true)}
            className="px-2.5 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-900 border border-brand-200 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1"
          >
            <Target size={14} className="text-brand-700" />
            <span>بهینه‌ساز معکوس (Goal-Seek)</span>
          </button>

          <div className="h-5 w-px bg-line-strong mx-0.5 hidden sm:block" />

          {/* Save & Fork */}
          <button
            onClick={() => alert('سناریو با موفقیت در پایگاه داده شبیه‌سازی ذخیره گردید.')}
            className="p-2 bg-surface hover:bg-paper border border-line rounded-xl text-ink-800 transition-colors cursor-pointer text-xs font-bold flex items-center gap-1"
            title="ذخیره تغییرات"
          >
            <Save size={15} />
            <span className="hidden md:inline">ذخیره</span>
          </button>

          <button
            onClick={() => alert('انشعاب جدید از این سناریو ایجاد گردید.')}
            className="p-2 bg-surface hover:bg-paper border border-line rounded-xl text-ink-800 transition-colors cursor-pointer text-xs font-bold flex items-center gap-1"
            title="ایجاد انشعاب"
          >
            <GitFork size={15} />
            <span className="hidden md:inline">انشعاب</span>
          </button>

          {/* Convert to Action PPE Button */}
          <button
            onClick={() => alert('سناریوی تأییدشده با موفقیت به کارتابل اولویت‌بندی پروژه تبدیل شد.')}
            className="px-3 py-1.5 bg-brand-800 hover:bg-brand-700 text-signal-400 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <Zap size={14} />
            <span>تبدیل مستقیم به اقدام PPE</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 1. STEPPER & MODE BAR                                                     */}
      {/* ========================================================================= */}
      <div className="px-4 flex flex-wrap items-center justify-between gap-3 bg-surface py-2 border-b border-line">
        
        {/* Stepper Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'scope', label: '۱. تعریف محدوده', icon: MapPin },
            { id: 'levers', label: '۲. اهرم‌های سیاستی', icon: Sliders },
            { id: 'assumptions', label: '۳. دفتر فرض‌ها', icon: FileText },
            { id: 'canvas', label: '۴. بوم شبیه‌سازی', icon: Cpu },
            { id: 'kpi', label: '۵. خروجی‌ها & عدسی عدالت', icon: BarChart3 },
            { id: 'compare', label: '۶. مقایسه سناریوها', icon: ArrowLeftRight },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? 'bg-brand-800 text-signal-400 shadow-xs'
                    : 'bg-paper hover:bg-line text-ink-500'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* View Special Modes Switcher */}
        <div className="flex items-center gap-1 bg-paper p-1 rounded-xl text-[11px] font-bold">
          <span className="text-ink-400 px-2">حالت نمایش:</span>
          <button
            onClick={() => setActiveMode('analyst')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              activeMode === 'analyst' ? 'bg-surface text-brand-800 shadow-2xs font-black' : 'text-ink-500'
            }`}
          >
            تحلیلی
          </button>
          <button
            onClick={() => setActiveMode('presentation')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              activeMode === 'presentation' ? 'bg-surface text-brand-800 shadow-2xs font-black' : 'text-ink-500'
            }`}
          >
            ارائه هیئت دولت
          </button>
          <button
            onClick={() => setActiveMode('crisis')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              activeMode === 'crisis' ? 'bg-danger text-white shadow-2xs font-black' : 'text-ink-500'
            }`}
          >
            ستاد بحران
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN THREE-COLUMN WORKSPACE                                              */}
      {/* ========================================================================= */}
      <div className="px-4 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* ===================================================================== */}
        {/* RIGHT PANEL (~30%): INTERVENTIONS, LEVERS & ASSUMPTIONS               */}
        {/* ===================================================================== */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          
          {/* Policy Levers Card Container */}
          <div className="bg-surface border border-line rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-line pb-2.5">
              <div className="flex items-center gap-2">
                <Sliders size={18} className="text-brand-800" />
                <h3 className="text-xs font-extrabold text-brand-800">اهرم‌های سیاستی مداخله (۱۰ بُعد ISGP)</h3>
              </div>
              <span className="font-mono text-[10px] bg-paper text-ink-500 px-2 py-0.5 rounded font-bold">
                {levers.length} اهرم فعال
              </span>
            </div>

            {/* Total Budget Constraint Bar */}
            <div className="p-2.5 bg-surface border border-line rounded-xl flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between font-bold">
                <span className="text-ink-500">مجموع بودجه متعهد سناریو:</span>
                <span className="font-mono text-brand-800 font-black">
                  ${calculatedOutcomes.totalCostM}M / ${currentScenario.budgetCapM}M
                </span>
              </div>
              <div className="w-full bg-line rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    calculatedOutcomes.totalCostM > currentScenario.budgetCapM ? 'bg-danger' : 'bg-brand-800'
                  }`} 
                  style={{ width: `${Math.min(100, (calculatedOutcomes.totalCostM / currentScenario.budgetCapM) * 100)}%` }} 
                />
              </div>
            </div>

            {/* List of Active Policy Lever Cards */}
            <div className="flex flex-col gap-3 max-h-[480px] overflow-y-auto pr-1">
              {levers.map((lvr) => (
                <div key={lvr.id} className="p-3 bg-surface border border-line rounded-xl flex flex-col gap-2.5 shadow-2xs hover:border-brand-800/40 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span 
                        className="px-1.5 py-0.5 rounded text-white text-[9px] font-black shrink-0"
                        style={{ backgroundColor: lvr.dimensionColor }}
                      >
                        {lvr.dimensionName}
                      </span>
                      <span className="text-xs font-bold text-ink-800 leading-snug">{lvr.name}</span>
                    </div>

                    <button
                      onClick={() => alert(`تحلیل علت و معلولی برای اهرم ${lvr.name}:\n${lvr.description}`)}
                      className="text-[10px] text-info bg-info-soft px-1.5 py-0.5 rounded font-bold hover:bg-info-soft transition-colors shrink-0"
                    >
                      چرا؟
                    </button>
                  </div>

                  <p className="text-[10.5px] text-ink-500 leading-relaxed">{lvr.description}</p>

                  {/* Synergy or Conflict Alert if present */}
                  {lvr.synergyNotice && (
                    <div className="p-1.5 bg-ok-soft border border-ok/40 rounded-lg text-[10px] text-ok font-bold flex items-center gap-1">
                      <Sparkles size={12} className="text-ok shrink-0" />
                      <span>{lvr.synergyNotice}</span>
                    </div>
                  )}

                  {/* Slider Control for Intensity */}
                  <div className="flex flex-col gap-1 text-[10.5px] pt-1 border-t border-line">
                    <div className="flex items-center justify-between font-extrabold">
                      <span className="text-ink-500">شدت اجرا و تخصیص:</span>
                      <span className="font-mono text-brand-800 font-black">{lvr.intensity}٪</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={lvr.intensity}
                      onChange={(e) => handleUpdateLeverIntensity(lvr.id, Number(e.target.value))}
                      className="w-full accent-brand-800 cursor-pointer"
                    />
                    <div className="flex items-center justify-between text-[9.5px] text-ink-500 font-mono">
                      <span>بودجه: ${lvr.estimatedBudgetM}M</span>
                      <span>اثربخشی تاریخی: {lvr.historicalEfficacy}٪</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add New Lever Button */}
            <button
              onClick={() => alert('کتابخانه مداخلات ۱۰ بعدی باز شد. امکان افزودن اهرم جدید از ۵۰ اهرم مصوب.')}
              className="w-full py-2 bg-paper border border-dashed border-line-strong hover:bg-paper rounded-xl text-xs font-bold text-brand-800 transition-all cursor-pointer text-center"
            >
              + افزودن اهرم جدید از کتابخانه مداخلات ISGP
            </button>
          </div>

          {/* Assumption Ledger Box (دفتر شفاف فرض‌ها) */}
          <div className="bg-surface border border-line rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-line pb-2 text-xs font-extrabold text-brand-800">
              <div className="flex items-center gap-2">
                <FileText size={16} />
                <span>دفتر شفاف فرض‌ها و پارامترها</span>
              </div>
              <span className="text-[10px] text-ok bg-ok-soft px-1.5 py-0.5 rounded font-bold">
                افشا ۱۰۰٪
              </span>
            </div>

            {/* Presets Toggle */}
            <div className="flex items-center justify-between bg-paper p-1 rounded-xl text-[10.5px] font-bold">
              <span className="text-ink-500 px-1">پیش‌فرض برون‌زا:</span>
              <div className="flex items-center gap-1">
                {(['pessimistic', 'probable', 'optimistic'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setAssumptionPreset(p)}
                    className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                      assumptionPreset === p ? 'bg-brand-800 text-signal-400 font-black' : 'text-ink-500'
                    }`}
                  >
                    {p === 'pessimistic' ? 'بدبینانه' : p === 'probable' ? 'محتمل' : 'خوش‌بینانه'}
                  </button>
                ))}
              </div>
            </div>

            {/* Assumptions List */}
            <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto">
              {assumptions.map((asm) => (
                <div key={asm.id} className="p-2.5 bg-surface border border-line rounded-xl flex flex-col gap-1 text-[11px]">
                  <div className="flex items-center justify-between font-bold text-ink-800">
                    <span>{asm.name}</span>
                    <span className="font-mono text-brand-800 font-black">
                      {asm.presetValue[assumptionPreset]} {asm.unit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[9.5px] text-ink-500">
                    <span>منبع: {asm.source}</span>
                    <span className="font-mono text-brand-700 bg-brand-50 px-1 rounded font-bold">عدم‌قطعیت: {asm.uncertaintyBound}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ===================================================================== */}
        {/* CENTER PANEL (~45%): SIMULATION CANVAS (MAP + FAN CHART + CAUSAL GRAPH) */}
        {/* ===================================================================== */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          
          {/* Main Simulation Interactive Map & Fan Chart Workspace */}
          <div className="bg-surface border border-line rounded-2xl p-4 flex flex-col gap-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-line pb-2 text-xs">
              <div className="flex items-center gap-2 font-extrabold text-brand-800">
                <Cpu size={18} />
                <span>بوم شبیه‌سازی زنده و سرریزهای سرزمینی (Sim-Canvas)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-brand-100 text-brand-800 px-2 py-0.5 rounded-full font-bold">
                  گام زمانی: {selectedYear}
                </span>
                <span className="text-[10px] text-ink-400 font-mono">دقت مدل: ۹۱.۴٪</span>
              </div>
            </div>

            {/* Integrated Map Component */}
            <div className="w-full">
              <IranSuitabilityMap
                projects={INITIAL_PORTFOLIO_PROJECTS}
                selectedProjectId={selectedProjectId}
                onSelectProject={(id) => setSelectedProjectId(id)}
                isEquityGapActive={true}
              />
            </div>

            {/* Time-Series Fan Chart (Predictive Curve with 50% & 90% Confidence Bands) */}
            <div className="p-4 bg-surface border border-line rounded-xl flex flex-col gap-3 text-xs">
              <div className="flex items-center justify-between border-b border-line pb-2 font-bold text-ink-800">
                <div className="flex items-center gap-2">
                  <Activity size={16} className="text-brand-800" />
                  <span>پیش‌بینی سری زمانی تنش آبی و رشد تولید ناخالص داخلی با باند عدم‌قطعیت</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-normal">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-ok inline-block" />
                    <span>سناریوی جاری</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-gray-400 inline-block" />
                    <span>خط مبنا</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded bg-signal-200 border border-signal-400 inline-block" />
                    <span>باند ۹۰٪ اطمینان</span>
                  </span>
                </div>
              </div>

              {/* Visual Simulated Chart Canvas */}
              <div className="relative w-full h-44 bg-surface border border-line rounded-lg p-2 flex items-end justify-between px-6 pt-6">
                
                {/* Confidence Band Shadow Region */}
                <div className="absolute inset-x-8 top-10 bottom-6 bg-ok-soft/40 rounded-3xl border border-dashed border-ok/40 pointer-events-none" />

                {/* Years Points */}
                {[1405, 1406, 1407, 1408, 1409, 1410].map((yr) => {
                  const isCurrentYear = yr === selectedYear;
                  const scenarioValue = Math.round(79 - (yr - 1405) * 5.2);
                  const baselineValue = Math.round(79 + (yr - 1405) * 1.5);

                  return (
                    <div 
                      key={yr} 
                      onClick={() => setSelectedYear(yr)}
                      className={`flex flex-col items-center gap-2 z-10 cursor-pointer group ${
                        isCurrentYear ? 'scale-110' : ''
                      }`}
                    >
                      {/* Values floating pill */}
                      <div className="flex flex-col items-center font-mono text-[9.5px]">
                        <span className="text-ok font-extrabold bg-ok-soft px-1 rounded border border-ok/40">
                          {scenarioValue}٪
                        </span>
                        <span className="text-ink-400 font-bold">{baselineValue}٪</span>
                      </div>

                      {/* Bar / Dot Visual */}
                      <div className={`w-3.5 rounded-full transition-all ${
                        isCurrentYear ? 'h-24 bg-brand-800 shadow-md ring-2 ring-signal-400' : 'h-16 bg-ok-soft hover:bg-ok'
                      }`} />

                      <span className={`text-[10px] font-mono font-bold ${isCurrentYear ? 'text-brand-800' : 'text-ink-400'}`}>
                        {yr}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Causal Graph & Key KPI Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              
              <div className="p-3 bg-ok-soft/70 border border-ok/40 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] text-ok font-bold">تغییر تنش آبی (در پایان افق)</span>
                <div className="flex items-baseline gap-2 my-1">
                  <span className="text-xl font-black text-ok font-mono">
                    {calculatedOutcomes.waterStressDelta}٪
                  </span>
                  <span className="text-[10px] text-ok font-bold">(از ۷۹٪ به ۵۲.۴٪)</span>
                </div>
                <span className="text-[9.5px] text-ok font-mono">باند اطمینان ۹۰٪: [۴۹٪ تا ۵۵٪]</span>
              </div>

              <div className="p-3 bg-info-soft/70 border border-info/30 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] text-info font-bold">افزایش رشد سالانه GDP</span>
                <div className="flex items-baseline gap-2 my-1">
                  <span className="text-xl font-black text-info font-mono">
                    +{calculatedOutcomes.gdpGrowthDelta}٪
                  </span>
                  <span className="text-[10px] text-info font-bold">(رسیدن به ۶.۸٪)</span>
                </div>
                <span className="text-[9.5px] text-info font-mono">نقطه سر‌به‌سر: سال ۱۴۰۸</span>
              </div>

              <div className="p-3 bg-brand-50/70 border border-brand-200 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] text-brand-800 font-bold">خروج سلول‌ها از ناحیه بحرانی</span>
                <div className="flex items-baseline gap-2 my-1">
                  <span className="text-xl font-black text-brand-900 font-mono">
                    {calculatedOutcomes.cellsExitedCrisis} سلول
                  </span>
                  <span className="text-[10px] text-brand-700 font-bold">از مجموع ۳۱ استان</span>
                </div>
                <span className="text-[9.5px] text-brand-800 font-mono">عدسی عدالت: جینی -۰.۰۴</span>
              </div>

            </div>

            {/* Live Causal Network Graph */}
            <CausalGraphLive 
              levers={levers} 
              onLeverIntensityChange={handleUpdateLeverIntensity} 
              selectedYear={selectedYear} 
            />

            {/* Fan Chart Projections */}
            <FanChart 
              title="پیش‌بینی خط سیر شاخص‌های کلیدی"
              subtitle="نمایش خط مبنا و فواصل عدم‌قطعیت ۵۰٪ و ۹۰٪ بر اساس مداخلات سیاستی فعال"
              unit="میلیون مترمکعب"
              currentYear={selectedYear}
            />

            {/* Scenario Comparison Table if activeTab === 'compare' */}
            {activeTab === 'compare' && (
              <div className="mt-4 p-4 bg-surface border border-line rounded-xl flex flex-col gap-3 shadow-md">
                <div className="flex items-center justify-between border-b pb-2 text-xs font-extrabold text-brand-800">
                  <span>ماتریس مقایسه همزمان سناریوها (تا ۴ سناریو + خط مبنا)</span>
                  <span className="text-[10px] text-ink-400">رنگ سبز: بهترین عملکرد در ردیف</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-paper text-brand-800 font-bold border-b border-line">
                        <th className="p-2">شاخص کلیدی</th>
                        {scenarios.map(s => (
                          <th key={s.id} className="p-2 text-center border-r border-line">{s.title.substring(0, 28)}...</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-gray-100">
                        <td className="p-2 font-bold text-ink-800">تغییر شاخص تنش آبی</td>
                        {scenarios.map(s => (
                          <td key={s.id} className={`p-2 text-center font-mono font-bold border-r border-line ${
                            s.outcomes.waterStressDelta <= -25 ? 'bg-ok-soft text-ok' : ''
                          }`}>
                            {s.outcomes.waterStressDelta}٪
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="p-2 font-bold text-ink-800">افزایش رشد سالانه GDP</td>
                        {scenarios.map(s => (
                          <td key={s.id} className={`p-2 text-center font-mono font-bold border-r border-line ${
                            s.outcomes.gdpGrowthDelta >= 2.5 ? 'bg-ok-soft text-ok' : ''
                          }`}>
                            +{s.outcomes.gdpGrowthDelta}٪
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-gray-100">
                        <td className="p-2 font-bold text-ink-800">بودجه کل متعهد</td>
                        {scenarios.map(s => (
                          <td key={s.id} className="p-2 text-center font-mono border-r border-line">
                            ${s.outcomes.totalCostM}M
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-ink-800">فایده تنزیل‌شده کل</td>
                        {scenarios.map(s => (
                          <td key={s.id} className="p-2 text-center font-mono text-info font-bold border-r border-line">
                            ${s.outcomes.discountedBenefitM}M
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* BOTTOM FIXED TIMELINE & EXECUTION CONSOLE                                 */}
      {/* ========================================================================= */}
      <footer className="sticky bottom-0 z-40 bg-surface border-t border-line p-3 shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs">
        
        {/* Timeline Playback Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 rounded-xl bg-brand-800 text-signal-400 flex items-center justify-center font-bold hover:bg-brand-700 transition-colors cursor-pointer shadow-xs"
            title={isPlaying ? 'توقف پخش زمان' : 'پخش انیمیشن زمان'}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} className="mr-0.5" />}
          </button>

          <button
            onClick={() => setSelectedYear(1405)}
            className="p-1.5 rounded-lg bg-paper hover:bg-line text-ink-700 transition-colors cursor-pointer"
            title="بازنشانی زمان به سال ۱۴۰۵"
          >
            <RotateCcw size={14} />
          </button>

          <div className="flex items-center gap-2 pr-2 border-r border-line">
            <span className="text-ink-500 text-[11px]">سال شبیه‌سازی:</span>
            <span className="font-mono text-base font-black text-brand-800">{selectedYear}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 bg-paper p-0.5 rounded-lg text-[10px]">
            {[1, 2, 5].map((spd) => (
              <button
                key={spd}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                  playbackSpeed === spd ? 'bg-brand-800 text-signal-400' : 'text-ink-500'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Monte Carlo Run Progress & Accuracy Disclaimer */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunMonteCarlo}
            disabled={isMonteCarloRunning}
            className="px-3 py-1.5 bg-brand-100 text-brand-800 border border-signal-400 rounded-xl text-[11px] font-extrabold hover:bg-brand-200 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={isMonteCarloRunning ? 'animate-spin' : ''} />
            <span>اجرای مونت‌کارلو (۵۰۰ نمونه)</span>
          </button>

          <span className="text-[10px] text-warn bg-warn-soft border border-warn/40 px-2 py-1 rounded-lg font-bold hidden md:inline-block">
            ⚠ خروجی شبیه‌سازی است، نه پیشگویی — نیازمند تأیید انسانی
          </span>
        </div>

      </footer>

      {/* ========================================================================= */}
      {/* NATURAL LANGUAGE QUERY (CTRL+K) MODAL                                     */}
      {/* ========================================================================= */}
      {isNLQOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-xl bg-surface rounded-3xl shadow-2xl border border-line p-6 text-right flex flex-col gap-4">
            
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="text-brand-800" size={20} />
                <h3 className="text-sm font-black text-brand-800">پرس‌و‌جوی زبان طبیعی و تولید خودکار سناریو</h3>
              </div>
              <button onClick={() => setIsNLQOpen(false)} className="p-1 rounded-lg hover:bg-paper text-ink-400">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-ink-500">
              سوال یا مداخله مورد نظر خود را به زبان ساده بنویسید؛ موتور هوشمند ISGP خودکار اهرم‌ها، محدوده و فرض‌ها را پیش‌نویس می‌کند.
            </p>

            <textarea
              rows={3}
              value={nlqQuery}
              onChange={(e) => setNlqQuery(e.target.value)}
              placeholder="مثال: اگر بودجه آبرسانی استان کرمان ۲۰٪ افزایش یابد و تعرفه صادرات کرومیت لغو شود، چه تغییری در اشتغال و تنش آبی رخ می‌دهد؟"
              className="w-full p-3 bg-paper border border-line rounded-xl text-xs text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-800"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsNLQOpen(false)}
                className="px-4 py-2 bg-paper hover:bg-line text-ink-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                onClick={handleExecuteNLQ}
                className="px-5 py-2 bg-brand-800 hover:bg-brand-700 text-signal-400 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Sparkles size={14} />
                <span>تولید خودکار سناریو</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* GOAL-SEEK REVERSE OPTIMIZER MODAL                                         */}
      {/* ========================================================================= */}
      {isGoalSeekOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg bg-surface rounded-3xl shadow-2xl border border-line p-6 text-right flex flex-col gap-4">
            
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Target className="text-brand-700" size={20} />
                <h3 className="text-sm font-black text-brand-800">بهینه‌ساز معکوس (Goal-Seek Optimizer)</h3>
              </div>
              <button onClick={() => setIsGoalSeekOpen(false)} className="p-1 rounded-lg hover:bg-paper text-ink-400">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-ink-500">
              هدف حاکمیتی خود را تعیین کنید؛ الگوریتم پارتو کمینه‌ترین بسته اهرم‌های لازم برای تحقق هدف را به همراه تخمین بودجه پیشنهاد می‌کند.
            </p>

            <div className="flex flex-col gap-2 bg-brand-50 p-3.5 rounded-2xl border border-brand-200 text-xs">
              <label className="font-bold text-brand-900">تعداد سلول‌های هدف برای خروج از محرومیت و بحران:</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="5"
                  max="31"
                  value={goalSeekTarget}
                  onChange={(e) => setGoalSeekTarget(Number(e.target.value))}
                  className="w-full accent-brand-700 cursor-pointer"
                />
                <span className="font-mono text-base font-black text-brand-900 shrink-0">{goalSeekTarget} سلول</span>
              </div>
            </div>

            <div className="p-3 bg-paper rounded-xl text-[11px] text-ink-500 flex flex-col gap-1">
              <span className="font-bold text-ink-800">بسته اهرم‌های پیشنهادی موتور:</span>
              <span>• افزایش ۷۵٪ بودجه آبرسانی + ۹۰٪ توسعه فیبر نوری</span>
              <span>• تخمین بودجه کل مورد نیاز: <strong>$۲,۸۵۰ میلیون دلار</strong></span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsGoalSeekOpen(false)}
                className="px-4 py-2 bg-paper hover:bg-line text-ink-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                انصراف
              </button>
              <button
                onClick={handleApplyGoalSeek}
                className="px-5 py-2 bg-brand-900 hover:bg-brand-950 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>اعمال تنظیمات بر روی سناریوی جاری</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
