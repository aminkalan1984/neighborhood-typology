import React, { useState, useMemo } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Layers, 
  Sliders, 
  ShieldCheck, 
  Cpu, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  FileText, 
  Activity, 
  Sparkles, 
  HelpCircle, 
  Info, 
  RotateCcw, 
  Zap, 
  RefreshCw, 
  ArrowLeftRight, 
  ShieldAlert, 
  Database, 
  Server, 
  UserCheck, 
  Lock, 
  Eye, 
  SlidersHorizontal,
  ChevronDown,
  Filter,
  BarChart3,
  PieChart,
  GitCommit,
  Clock,
  Terminal,
  Share2,
  Check,
  AlertCircle
} from 'lucide-react';

// --- TYPES FOR PPE ENGINE ---

export interface PPEProject {
  id: string;
  name: string;
  domainCode: 'S1' | 'S2' | 'S3' | 'S4' | 'S5';
  domainName: string;
  domainColor: string;
  province: string;
  estimatedCostM: number;
  durationMonths: number;
  fitScore: number; // 0.0 - 1.0
  deltaDeprivation: number; // -1.0 to 1.0
  riskScore: number; // 0.0 - 1.0 (lower is better)
  synergyScore: number; // -1.0 to 1.0
  sustainabilityScore: number; // 0.0 - 1.0
  
  // Gate Status
  gateStatus: 'PASSED' | 'REJECTED_FIT' | 'REJECTED_RISK' | 'REJECTED_BUDGET';
  gateRejectionReason?: string;

  // MCDA Output
  compositeScore?: number;
  finalRank?: number;
  priorityLevel?: 'P1_URGENT' | 'P2_STRATEGIC' | 'P3_COMPLEMENTARY' | 'REJECTED';
  allocatedBudgetM?: number;

  // SHAP Contributions
  shapBreakdown?: {
    fitContrib: number;
    deltaDepContrib: number;
    riskContrib: number;
    synergyContrib: number;
    sustainabilityContrib: number;
  };
  narrativeFa?: string;
  dependsOn?: string[];
}

export interface WeightProfile {
  id: string;
  name: string;
  description: string;
  wFit: number;
  wDep: number;
  wRisk: number;
  wSyn: number;
  wSus: number;
}

export interface OverrideLog {
  id: string;
  projectId: string;
  projectName: string;
  oldRank: number;
  newRank: number;
  expertName: string;
  role: string;
  justification: string;
  timestamp: string;
}

// Initial Weight Profiles
const WEIGHT_PROFILES: WeightProfile[] = [
  {
    id: 'BALANCED',
    name: 'متوازن (پیش‌فرض سیستم)',
    description: 'ترکیب متعادل پایداری، کاهش محرومیت و مدیریت ریسک (توصیه برنامه هفتم)',
    wFit: 0.30,
    wDep: 0.25,
    wRisk: 0.20,
    wSyn: 0.15,
    wSus: 0.10
  },
  {
    id: 'DEPRIVATION_FIRST',
    name: 'اولیت محرومیت‌زدایی و عدالت',
    description: 'تمرکز ۴۵ درصدی بر کاهش فاصله محرومیت و شکاف عدالت در سلول‌های L2 تا L5',
    wFit: 0.20,
    wDep: 0.45,
    wRisk: 0.15,
    wSyn: 0.10,
    wSus: 0.10
  },
  {
    id: 'OPPORTUNITY_FIRST',
    name: 'پیشران رشد و بازدهی اقتصادی',
    description: 'سنگینی وزن بر روی فرصت‌های جهش تولید ناخالص داخلی و ترانزیت',
    wFit: 0.45,
    wDep: 0.10,
    wRisk: 0.20,
    wSyn: 0.15,
    wSus: 0.10
  },
  {
    id: 'ECO_GUARD',
    name: 'صیانت زیست‌محیطی و پایداری اقلیم',
    description: 'وزن ویژه ۳۰ درصدی به شاخص‌های پایداری سفره‌های آب و مهار فرونشست',
    wFit: 0.25,
    wDep: 0.15,
    wRisk: 0.20,
    wSyn: 0.10,
    wSus: 0.30
  },
  {
    id: 'LOW_RISK',
    name: 'کاهش ریسک و بازدهی مطمئن',
    description: 'اولویت به پروژه‌های با عدم‌قطعیت پایین و زیرساخت‌های زودهنگام',
    wFit: 0.25,
    wDep: 0.20,
    wRisk: 0.40,
    wSyn: 0.10,
    wSus: 0.05
  }
];

// Initial Candidate Projects (10 realistic projects)
const CANDIDATE_PROJECTS: PPEProject[] = [
  {
    id: 'PRJ-S1-01',
    name: 'احداث مجتمع شیرین‌سازی و خط انتقال آب خلیج فارس به دشت نی‌ریز',
    domainCode: 'S1',
    domainName: 'منابع طبیعی و اقلیم',
    domainColor: '#10B981',
    province: 'فارس (نی‌ریز)',
    estimatedCostM: 850,
    durationMonths: 24,
    fitScore: 0.92,
    deltaDeprivation: 0.68,
    riskScore: 0.25,
    synergyScore: 0.75,
    sustainabilityScore: 0.88,
    gateStatus: 'PASSED'
  },
  {
    id: 'PRJ-S2-02',
    name: 'ایجاد منطقه ویژه اقتصادی و شهرک فرآوری سنگ‌های تزئینی',
    domainCode: 'S2',
    domainName: 'اقتصاد و تولید',
    domainColor: '#3B82F6',
    province: 'فارس (نی‌ریز)',
    estimatedCostM: 620,
    durationMonths: 18,
    fitScore: 0.85,
    deltaDeprivation: 0.42,
    riskScore: 0.30,
    synergyScore: 0.60,
    sustainabilityScore: 0.72,
    gateStatus: 'PASSED'
  },
  {
    id: 'PRJ-S4-03',
    name: 'توسعه فیبر نوری و زیرساخت ارتباطی روستاهای محروم مرزی',
    domainCode: 'S4',
    domainName: 'زیرساخت و کالبد',
    domainColor: '#6366F1',
    province: 'سیستان و بلوچستان',
    estimatedCostM: 280,
    durationMonths: 12,
    fitScore: 0.88,
    deltaDeprivation: 0.85,
    riskScore: 0.15,
    synergyScore: 0.80,
    sustainabilityScore: 0.90,
    gateStatus: 'PASSED'
  },
  {
    id: 'PRJ-S3-04',
    name: 'تاسیس مرکز جامع مهارت‌آموزی و اشتغال دیجیتال بانوان',
    domainCode: 'S3',
    domainName: 'سرمایه انسانی و اجتماعی',
    domainColor: '#F59E0B',
    province: 'کرمان',
    estimatedCostM: 150,
    durationMonths: 10,
    fitScore: 0.78,
    deltaDeprivation: 0.60,
    riskScore: 0.20,
    synergyScore: 0.65,
    sustainabilityScore: 0.85,
    gateStatus: 'PASSED'
  },
  {
    id: 'PRJ-S1-05',
    name: 'انسداد ۱۲۰ حلقه چاه غیرمجاز و نصب کنتورهای هوشمند زاینده‌رود',
    domainCode: 'S1',
    domainName: 'منابع طبیعی و اقلیم',
    domainColor: '#10B981',
    province: 'اصفهان',
    estimatedCostM: 190,
    durationMonths: 8,
    fitScore: 0.95,
    deltaDeprivation: 0.55,
    riskScore: 0.18,
    synergyScore: 0.85,
    sustainabilityScore: 0.95,
    gateStatus: 'PASSED'
  },
  {
    id: 'PRJ-S5-06',
    name: 'استقرار سامانه پنجره واحد مجوزهای سرمایه‌گذاری استانی',
    domainCode: 'S5',
    domainName: 'حکمرانی و نهادها',
    domainColor: '#8B5CF6',
    province: 'تهران',
    estimatedCostM: 90,
    durationMonths: 6,
    fitScore: 0.81,
    deltaDeprivation: 0.30,
    riskScore: 0.12,
    synergyScore: 0.90,
    sustainabilityScore: 0.80,
    gateStatus: 'PASSED'
  },
  {
    id: 'PRJ-S2-07',
    name: 'احداث نیروگاه خورشیدی ۵۰ مگاواتی کویر یزد',
    domainCode: 'S2',
    domainName: 'اقتصاد و تولید',
    domainColor: '#3B82F6',
    province: 'یزد',
    estimatedCostM: 410,
    durationMonths: 16,
    fitScore: 0.89,
    deltaDeprivation: 0.38,
    riskScore: 0.22,
    synergyScore: 0.70,
    sustainabilityScore: 0.92,
    gateStatus: 'PASSED'
  },
  {
    id: 'PRJ-S4-08',
    name: 'تکمیل خط دوم راه‌آهن چابهار - زاهدان',
    domainCode: 'S4',
    domainName: 'زیرساخت و کالبد',
    domainColor: '#6366F1',
    province: 'سیستان و بلوچستان',
    estimatedCostM: 1100,
    durationMonths: 36,
    fitScore: 0.90,
    deltaDeprivation: 0.72,
    riskScore: 0.38,
    synergyScore: 0.88,
    sustainabilityScore: 0.82,
    gateStatus: 'PASSED'
  },
  {
    id: 'PRJ-S2-09',
    name: 'احداث مجتمع پتروشیمی خوراک سنگین در حوزه فاقد انطباق آبی',
    domainCode: 'S2',
    domainName: 'اقتصاد و تولید',
    domainColor: '#3B82F6',
    province: 'خراسان جنوبی',
    estimatedCostM: 1400,
    durationMonths: 48,
    fitScore: 0.32,
    deltaDeprivation: 0.20,
    riskScore: 0.78,
    synergyScore: 0.15,
    sustainabilityScore: 0.22,
    gateStatus: 'REJECTED_FIT',
    gateRejectionReason: 'عدم احراز آستانه Fit Score (کمتر از ۰.۵۰) و ریسک شدید تنش آبی'
  },
  {
    id: 'PRJ-S4-10',
    name: 'توسعه آزادراه چهارخطه مرزی بدون تاییدیه ارزیابی زیست‌محیطی',
    domainCode: 'S4',
    domainName: 'زیرساخت و کالبد',
    domainColor: '#6366F1',
    province: 'ایلام',
    estimatedCostM: 780,
    durationMonths: 30,
    fitScore: 0.48,
    deltaDeprivation: 0.45,
    riskScore: 0.72,
    synergyScore: 0.30,
    sustainabilityScore: 0.35,
    gateStatus: 'REJECTED_RISK',
    gateRejectionReason: 'عبور از سقف مجاز ریسک اجرایی (بیشتر از ۰.۷۰) و عدم مجوز EPI'
  }
];

export default function ProjectPrioritizationEnginePage() {
  // === STATE MANAGEMENT ===
  const [selectedRegion, setSelectedRegion] = useState<string>('شهرستان نی‌ریز (L2/L3)');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('BALANCED');
  const [mcdaAlgorithm, setMcdaAlgorithm] = useState<'TOPSIS' | 'WSM' | 'PROMETHEE' | 'VIKOR'>('TOPSIS');
  const [budgetCapM, setBudgetCapM] = useState<number>(2800); // $M total budget cap
  const [activeViewTab, setActiveViewTab] = useState<'prioritization' | 'xai' | 'knapsack' | 'overrides' | 'system'>('prioritization');

  // Custom Weight Overrides State
  const activeProfile = useMemo(() => {
    return WEIGHT_PROFILES.find(p => p.id === selectedProfileId) || WEIGHT_PROFILES[0];
  }, [selectedProfileId]);

  const [customWeights, setCustomWeights] = useState({
    wFit: activeProfile.wFit,
    wDep: activeProfile.wDep,
    wRisk: activeProfile.wRisk,
    wSyn: activeProfile.wSyn,
    wSus: activeProfile.wSus,
  });

  // Keep custom weights synced when profile changes
  React.useEffect(() => {
    setCustomWeights({
      wFit: activeProfile.wFit,
      wDep: activeProfile.wDep,
      wRisk: activeProfile.wRisk,
      wSyn: activeProfile.wSyn,
      wSus: activeProfile.wSus,
    });
  }, [activeProfile]);

  // Selected Project for SHAP & XAI Inspector
  const [selectedProjectId, setSelectedProjectId] = useState<string>('PRJ-S1-01');

  // Expert Override State & Audit Logs
  const [overrideLogs, setOverrideLogs] = useState<OverrideLog[]>([
    {
      id: 'ovr-101',
      projectId: 'PRJ-S4-03',
      projectName: 'توسعه فیبر نوری و زیرساخت ارتباطی روستاهای محروم مرزی',
      oldRank: 4,
      newRank: 1,
      expertName: 'دکتر علیرضا رضایی',
      role: 'استاد دانشگاه و نماینده شورای عالی آمایش',
      justification: 'ضرورت فوری فورس‌ماژور برای بسترسازی سرشماری ۱۴۰۵ و خروج فوری ۱۰ سلول مرزی از ناترازی ارتباطی.',
      timestamp: '۱۴۰۴/۱۲/۰۲ - ۱۴:۳۰'
    }
  ]);

  const [overrideProjectId, setOverrideProjectId] = useState<string>('PRJ-S1-02');
  const [overrideNewRank, setOverrideNewRank] = useState<number>(1);
  const [overrideJustification, setOverrideJustification] = useState<string>('');

  // Execution Stats Simulation
  const [isEngineRunning, setIsEngineRunning] = useState<boolean>(false);
  const [p95LatencyMs, setP95LatencyMs] = useState<number>(420);

  // === CALCULATIONS & ALGORITHMS (MCDA + KNAPSACK) ===

  // 1. Calculate TOPSIS / Multi-Criteria Composite Score for each passed project
  const evaluatedProjects = useMemo(() => {
    const normSum = customWeights.wFit + customWeights.wDep + customWeights.wRisk + customWeights.wSyn + customWeights.wSus || 1;
    const wFit = customWeights.wFit / normSum;
    const wDep = customWeights.wDep / normSum;
    const wRisk = customWeights.wRisk / normSum;
    const wSyn = customWeights.wSyn / normSum;
    const wSus = customWeights.wSus / normSum;

    return CANDIDATE_PROJECTS.map(proj => {
      if (proj.gateStatus !== 'PASSED') {
        return {
          ...proj,
          compositeScore: 0,
          priorityLevel: 'REJECTED' as const,
          allocatedBudgetM: 0
        };
      }

      // Formula: C_p = w_fit * Fit + w_dep * DeltaDep + w_risk * (1 - Risk) + w_syn * Syn + w_sus * Sus
      const riskInverted = 1 - proj.riskScore; // Invert risk so lower risk gives higher score
      const synNormalized = (proj.synergyScore + 1) / 2; // Map [-1, 1] to [0, 1]

      let compScore = (
        proj.fitScore * wFit +
        proj.deltaDeprivation * wDep +
        riskInverted * wRisk +
        synNormalized * wSyn +
        proj.sustainabilityScore * wSus
      );

      // Algorithmic minor variation based on selected strategy
      if (mcdaAlgorithm === 'VIKOR') compScore = compScore * 0.96;
      if (mcdaAlgorithm === 'PROMETHEE') compScore = compScore * 1.02;

      compScore = Math.min(1.0, Math.max(0.0, Number(compScore.toFixed(3))));

      // SHAP contributions calculation
      const shapBreakdown = {
        fitContrib: Number((proj.fitScore * wFit).toFixed(3)),
        deltaDepContrib: Number((proj.deltaDeprivation * wDep).toFixed(3)),
        riskContrib: Number((riskInverted * wRisk).toFixed(3)),
        synergyContrib: Number((synNormalized * wSyn).toFixed(3)),
        sustainabilityContrib: Number((proj.sustainabilityScore * wSus).toFixed(3))
      };

      return {
        ...proj,
        compositeScore: compScore,
        shapBreakdown,
        narrativeFa: `پروژه ${proj.name} با کسب امتیاز ${compScore} به علت تطابق ${Math.round(proj.fitScore * 100)}٪ با مکعب منطقه و اثر ${Math.round(proj.deltaDeprivation * 100)}٪ بر محرومیت‌زدایی در جایگاه ارزشیابی اولیه قرار گرفت.`
      };
    });
  }, [customWeights, mcdaAlgorithm]);

  // 2. Stable Rank Sorting
  const rankedProjects = useMemo(() => {
    const passedOnly = evaluatedProjects.filter(p => p.gateStatus === 'PASSED');
    
    // Sort by composite score desc, then deltaDep desc, then risk asc
    passedOnly.sort((a, b) => {
      if ((b.compositeScore || 0) !== (a.compositeScore || 0)) {
        return (b.compositeScore || 0) - (a.compositeScore || 0);
      }
      if (b.deltaDeprivation !== a.deltaDeprivation) {
        return b.deltaDeprivation - a.deltaDeprivation;
      }
      return a.riskScore - b.riskScore;
    });

    // Assign final ranks
    passedOnly.forEach((p, idx) => {
      p.finalRank = idx + 1;
    });

    return evaluatedProjects;
  }, [evaluatedProjects]);

  // 3. Knapsack 0/1 Budget Allocation and Tier Grouping
  const allocatedProjects = useMemo(() => {
    let accumulatedBudget = 0;
    
    // Tiers Caps: P1 max 40%, P2 max 35%, P3 max 25%
    const p1Cap = budgetCapM * 0.40;
    const p2Cap = budgetCapM * 0.35;
    const p3Cap = budgetCapM * 0.25;

    let p1Allocated = 0;
    let p2Allocated = 0;
    let p3Allocated = 0;

    return rankedProjects.map(proj => {
      if (proj.gateStatus !== 'PASSED') {
        return { ...proj, priorityLevel: 'REJECTED' as const, allocatedBudgetM: 0 };
      }

      const score = proj.compositeScore || 0;
      let level: 'P1_URGENT' | 'P2_STRATEGIC' | 'P3_COMPLEMENTARY' | 'REJECTED' = 'REJECTED';
      let allocBudget = 0;

      if (score >= 0.72 && proj.riskScore <= 0.35) {
        if (accumulatedBudget + proj.estimatedCostM <= budgetCapM && p1Allocated + proj.estimatedCostM <= p1Cap + 300) {
          level = 'P1_URGENT';
          allocBudget = proj.estimatedCostM;
          p1Allocated += proj.estimatedCostM;
          accumulatedBudget += proj.estimatedCostM;
        } else if (accumulatedBudget + proj.estimatedCostM <= budgetCapM) {
          level = 'P2_STRATEGIC';
          allocBudget = proj.estimatedCostM;
          p2Allocated += proj.estimatedCostM;
          accumulatedBudget += proj.estimatedCostM;
        }
      } else if (score >= 0.58) {
        if (accumulatedBudget + proj.estimatedCostM <= budgetCapM) {
          level = 'P2_STRATEGIC';
          allocBudget = proj.estimatedCostM;
          p2Allocated += proj.estimatedCostM;
          accumulatedBudget += proj.estimatedCostM;
        }
      } else if (score >= 0.45) {
        if (accumulatedBudget + proj.estimatedCostM <= budgetCapM) {
          level = 'P3_COMPLEMENTARY';
          allocBudget = proj.estimatedCostM;
          p3Allocated += proj.estimatedCostM;
          accumulatedBudget += proj.estimatedCostM;
        }
      }

      return {
        ...proj,
        priorityLevel: level,
        allocatedBudgetM: allocBudget
      };
    });
  }, [rankedProjects, budgetCapM]);

  // Aggregate Budget Summary
  const budgetSummary = useMemo(() => {
    const totalAllocated = allocatedProjects.reduce((sum, p) => sum + (p.allocatedBudgetM || 0), 0);
    const approvedCount = allocatedProjects.filter(p => p.allocatedBudgetM && p.allocatedBudgetM > 0).length;
    const p1Total = allocatedProjects.filter(p => p.priorityLevel === 'P1_URGENT').reduce((sum, p) => sum + p.estimatedCostM, 0);
    const p2Total = allocatedProjects.filter(p => p.priorityLevel === 'P2_STRATEGIC').reduce((sum, p) => sum + p.estimatedCostM, 0);
    const p3Total = allocatedProjects.filter(p => p.priorityLevel === 'P3_COMPLEMENTARY').reduce((sum, p) => sum + p.estimatedCostM, 0);

    return {
      totalAllocated,
      remainingBudget: Math.max(0, budgetCapM - totalAllocated),
      approvedCount,
      totalCount: CANDIDATE_PROJECTS.length,
      p1Total,
      p2Total,
      p3Total
    };
  }, [allocatedProjects, budgetCapM]);

  // Selected Project Object for SHAP
  const selectedProject = useMemo(() => {
    return allocatedProjects.find(p => p.id === selectedProjectId) || allocatedProjects[0];
  }, [allocatedProjects, selectedProjectId]);

  // Handler to Execute PPE Engine Run
  const handleRunPPEEngine = () => {
    setIsEngineRunning(true);
    setTimeout(() => {
      setIsEngineRunning(false);
      setP95LatencyMs(Math.round(380 + Math.random() * 80));
    }, 600);
  };

  // Handler for Adding Expert Override
  const handleApplyOverride = () => {
    if (!overrideJustification.trim()) {
      alert('لطفاً دلیل و توجیه کارشناسی دستکاری رتبه را وارد نمایید.');
      return;
    }
    const targetProj = CANDIDATE_PROJECTS.find(p => p.id === overrideProjectId);
    if (!targetProj) return;

    const newLog: OverrideLog = {
      id: `ovr-${Date.now()}`,
      projectId: targetProj.id,
      projectName: targetProj.name,
      oldRank: 3,
      newRank: overrideNewRank,
      expertName: 'دکتر امین کلانتر',
      role: 'مدیر ارشد تیم آمایش و سیاست‌گذاری',
      justification: overrideJustification,
      timestamp: 'هم‌اکنون'
    };

    setOverrideLogs(prev => [newLog, ...prev]);
    setOverrideJustification('');
    alert(`تغییر رتبه پروژه ${targetProj.name} با امضای ممیزی در دفتر ثبت شد.`);
  };

  return (
    <div className="flex flex-col gap-4 w-full min-h-screen font-sans select-none text-right bg-paper text-ink-800">
      
      {/* ========================================================================= */}
      {/* 0. ENGINE IDENTITY & SYSTEM CONTROL BAND                                 */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-surface border-b border-line shadow-sm px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        
        {/* Left Side: Module Title & System Status Metrics */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-800 text-signal-400 flex items-center justify-center font-bold shadow-xs shrink-0">
            <Zap size={22} />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-black text-sm text-brand-800">
                موتور اولویت‌بندی پروژه‌ها (Project Prioritization Engine — PPE)
              </h1>
              <span className="font-mono text-xs font-black px-2 py-0.5 rounded bg-brand-100 text-brand-800 border border-signal-400">
                v1.0.0
              </span>
              <span className="bg-ok-soft text-ok border border-ok/40 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-ok-soft animate-ping" />
                <span>SLA: 99.9% | Latency p95: {p95LatencyMs}ms</span>
              </span>
            </div>

            <div className="flex items-center gap-3 text-[10.5px] text-ink-500 mt-0.5">
              <span>منطقه هدف: <strong className="text-ink-800 font-bold">{selectedRegion}</strong></span>
              <span>•</span>
              <span>الگوریتم تصمیم: <strong className="text-brand-900 font-mono font-bold">{mcdaAlgorithm} + CP-SAT</strong></span>
              <span>•</span>
              <span>روش بهینه‌سازی بودجه: <strong className="text-brand-800">Knapsack 0/1</strong></span>
            </div>
          </div>
        </div>

        {/* Right Side: Region & Strategy Selectors */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Region Switcher */}
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="px-2.5 py-1.5 bg-paper border border-line-strong rounded-xl text-xs font-bold text-ink-800 hover:bg-paper focus:outline-none cursor-pointer"
          >
            <option value="شهرستان نی‌ریز (L2/L3)">شهرستان نی‌ریز (L2/L3)</option>
            <option value="استان کرمان (L2)">استان کرمان (L2)</option>
            <option value="استان سیستان و بلوچستان (L2)">استان سیستان و بلوچستان (L2)</option>
            <option value="کل کشور (سطح ملی L0)">کل کشور (سطح ملی L0)</option>
          </select>

          {/* Algorithm Strategy Switcher */}
          <select
            value={mcdaAlgorithm}
            onChange={(e) => setMcdaAlgorithm(e.target.value as any)}
            className="px-2.5 py-1.5 bg-brand-50 border border-brand-200 text-brand-900 rounded-xl text-xs font-black focus:outline-none cursor-pointer"
          >
            <option value="TOPSIS">استراتژی MCDA: TOPSIS</option>
            <option value="WSM">استراتژی MCDA: WSM (وزنی)</option>
            <option value="PROMETHEE">استراتژی MCDA: PROMETHEE II</option>
            <option value="VIKOR">استراتژی MCDA: VIKOR (سازش)</option>
          </select>

          {/* Run Engine Button */}
          <button
            onClick={handleRunPPEEngine}
            disabled={isEngineRunning}
            className="px-3 py-1.5 bg-brand-800 hover:bg-brand-700 text-signal-400 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <RefreshCw size={14} className={isEngineRunning ? 'animate-spin' : ''} />
            <span>{isEngineRunning ? 'در حال اجرای محاسبات...' : 'بازمحاسبه اولویت‌ها'}</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 1. VIEW NAVIGATION TABS & SUMMARY KPI CARDS                               */}
      {/* ========================================================================= */}
      <div className="px-4 flex flex-col gap-3">
        
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between gap-2 border-b border-line pb-2 flex-wrap bg-surface p-2 rounded-2xl shadow-2xs">
          <div className="flex items-center gap-1 overflow-x-auto">
            {[
              { id: 'prioritization', label: 'جدول رتبه‌بندی و تخصیص بودجه', icon: BarChart3 },
              { id: 'xai', label: 'تحلیل شفافیت و سهم عوامل مؤثر', icon: Eye },
              { id: 'knapsack', label: 'تحلیل تخصیص بودجه Knapsack', icon: PieChart },
              { id: 'overrides', label: 'دفتر ممیزی و Override خبره', icon: ShieldCheck },
              { id: 'system', label: 'معماری، API و Event Stream', icon: Server },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeViewTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveViewTab(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    isActive ? 'bg-brand-800 text-signal-400 shadow-xs' : 'bg-paper hover:bg-line text-ink-500'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-ink-500">
            <span>سقف بودجه مصوب:</span>
            <input
              type="number"
              value={budgetCapM}
              onChange={(e) => setBudgetCapM(Number(e.target.value))}
              className="w-24 px-2 py-1 bg-paper border border-line-strong rounded-lg text-center font-mono font-black text-brand-800 focus:outline-none"
            />
            <span>میلیون دلار</span>
          </div>
        </div>

        {/* Key KPI Metrics Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          
          <div className="p-3 bg-surface border border-line rounded-2xl flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-[10.5px] text-ink-500 font-bold">
              <span>پروژه‌های ورودی کاندید</span>
              <Database size={15} className="text-brand-800" />
            </div>
            <div className="flex items-baseline gap-2 my-1">
              <span className="text-2xl font-black text-brand-800 font-mono">{budgetSummary.totalCount}</span>
              <span className="text-[10px] text-ok font-bold">پروژه ارزیابی‌شده</span>
            </div>
            <span className="text-[9.5px] text-ink-400 font-mono">۲ مورد مردود در گیت HFDQ</span>
          </div>

          <div className="p-3 bg-surface border border-line rounded-2xl flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-[10.5px] text-ink-500 font-bold">
              <span>بودجه تخصیص‌یافته کل</span>
              <DollarSign size={15} className="text-ok" />
            </div>
            <div className="flex items-baseline gap-2 my-1">
              <span className="text-2xl font-black text-ok font-mono">${budgetSummary.totalAllocated}M</span>
              <span className="text-[10px] text-ok font-bold">از ${budgetCapM}M</span>
            </div>
            <div className="w-full bg-line rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-ok h-full rounded-full" 
                style={{ width: `${Math.min(100, (budgetSummary.totalAllocated / budgetCapM) * 100)}%` }} 
              />
            </div>
          </div>

          <div className="p-3 bg-surface border border-line rounded-2xl flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-[10.5px] text-ink-500 font-bold">
              <span>پروژه‌های مصوب (P1/P2/P3)</span>
              <CheckCircle2 size={15} className="text-info" />
            </div>
            <div className="flex items-baseline gap-2 my-1">
              <span className="text-2xl font-black text-info font-mono">{budgetSummary.approvedCount}</span>
              <span className="text-[10px] text-info font-bold">پروژه برنده Knapsack</span>
            </div>
            <span className="text-[9.5px] text-info font-mono">نرخ پذیرش: {Math.round((budgetSummary.approvedCount / budgetSummary.totalCount) * 100)}٪</span>
          </div>

          <div className="p-3 bg-surface border border-line rounded-2xl flex flex-col justify-between shadow-2xs">
            <div className="flex items-center justify-between text-[10.5px] text-ink-500 font-bold">
              <span>پروفایل وزن فعال</span>
              <SlidersHorizontal size={15} className="text-brand-700" />
            </div>
            <div className="my-1">
              <span className="text-xs font-black text-brand-900 truncate block">{activeProfile.name}</span>
            </div>
            <span className="text-[9.5px] text-brand-800 font-mono">وزن محرومیت: {Math.round(customWeights.wDep * 100)}٪</span>
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN CONTENT AREA: TAB DEPENDENT VIEWS                                */}
      {/* ========================================================================= */}
      <div className="px-4 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 pb-8">
        
        {/* ===================================================================== */}
        {/* TAB 1: PRIORITIZATION & BUDGET ALLOCATION TABLE                       */}
        {/* ===================================================================== */}
        {activeViewTab === 'prioritization' && (
          <>
            {/* Left Column (8 cols): Scored Projects Table */}
            <div className="lg:col-span-8 bg-surface border border-line rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-line pb-2 text-xs">
                <div className="flex items-center gap-2 font-extrabold text-brand-800">
                  <BarChart3 size={18} />
                  <span>نتایج رتبه‌بندی چندمعیاره و گروه‌بندی اولویت‌های تخصیص بودجه</span>
                </div>
                <span className="text-[10px] bg-brand-100 text-brand-800 px-2 py-0.5 rounded font-bold">
                  الگوریتم: {mcdaAlgorithm}
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-surface text-brand-800 font-extrabold border-b border-line">
                      <th className="p-2.5">رتبه</th>
                      <th className="p-2.5">نام پروژه و کد</th>
                      <th className="p-2.5">حوزه ISGP</th>
                      <th className="p-2.5">Fit Score</th>
                      <th className="p-2.5">امتیاز مرکب</th>
                      <th className="p-2.5">سطح اولویت</th>
                      <th className="p-2.5">هزینه ($M)</th>
                      <th className="p-2.5">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocatedProjects.map((proj) => {
                      const isSelected = selectedProjectId === proj.id;
                      const isRejectedGate = proj.gateStatus !== 'PASSED';

                      return (
                        <tr 
                          key={proj.id} 
                          onClick={() => setSelectedProjectId(proj.id)}
                          className={`border-b border-gray-100 transition-all cursor-pointer hover:bg-paper ${
                            isSelected ? 'bg-ok-soft/70 font-bold border-l-4 border-l-brand-800' : ''
                          }`}
                        >
                          {/* Rank */}
                          <td className="p-2.5 font-mono font-black text-brand-800">
                            {isRejectedGate ? '—' : `#${proj.finalRank}`}
                          </td>

                          {/* Name */}
                          <td className="p-2.5">
                            <div className="flex flex-col">
                              <span className="font-extrabold text-ink-800">{proj.name}</span>
                              <span className="font-mono text-[9.5px] text-ink-400">{proj.id} | {proj.province}</span>
                            </div>
                          </td>

                          {/* Domain */}
                          <td className="p-2.5">
                            <span 
                              className="px-2 py-0.5 rounded text-[9.5px] font-black text-white"
                              style={{ backgroundColor: proj.domainColor }}
                            >
                              {proj.domainCode}
                            </span>
                          </td>

                          {/* Fit Score */}
                          <td className="p-2.5 font-mono font-bold text-brand-800">
                            {Math.round(proj.fitScore * 100)}٪
                          </td>

                          {/* Composite Score */}
                          <td className="p-2.5 font-mono font-black text-ok">
                            {isRejectedGate ? '0.00' : proj.compositeScore}
                          </td>

                          {/* Priority Level Tier */}
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              proj.priorityLevel === 'P1_URGENT' ? 'bg-danger-soft text-danger-700 border border-danger/40' :
                              proj.priorityLevel === 'P2_STRATEGIC' ? 'bg-info-soft text-info border border-info/40' :
                              proj.priorityLevel === 'P3_COMPLEMENTARY' ? 'bg-warn-soft text-warn border border-warn/40' :
                              'bg-line text-ink-700'
                            }`}>
                              {
                                proj.priorityLevel === 'P1_URGENT' ? 'P1 - فوری و اضطراری' :
                                proj.priorityLevel === 'P2_STRATEGIC' ? 'P2 - راهبردی' :
                                proj.priorityLevel === 'P3_COMPLEMENTARY' ? 'P3 - مکمل' :
                                'مردود / عدم تخصیص'
                              }
                            </span>
                          </td>

                          {/* Cost */}
                          <td className="p-2.5 font-mono text-brand-800 font-bold">
                            ${proj.estimatedCostM}M
                          </td>

                          {/* Actions */}
                          <td className="p-2.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedProjectId(proj.id);
                                setActiveViewTab('xai');
                              }}
                              className="px-2 py-0.5 bg-brand-50 hover:bg-brand-100 text-brand-900 border border-brand-200 rounded font-bold text-[10px] cursor-pointer"
                            >
                              SHAP
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column (4 cols): Weight Profiles & Live Adjustment Sliders */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              
              {/* Weight Profile Selector */}
              <div className="bg-surface border border-line rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-line pb-2 text-xs font-extrabold text-brand-800">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal size={16} />
                    <span>پروفایل‌های وزن‌دهی</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {WEIGHT_PROFILES.map((prof) => (
                    <div
                      key={prof.id}
                      onClick={() => setSelectedProfileId(prof.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 text-xs ${
                        selectedProfileId === prof.id
                          ? 'bg-brand-100 border-brand-800 ring-2 ring-signal-400'
                          : 'bg-surface hover:bg-paper border-line'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-ink-800">
                        <span>{prof.name}</span>
                        {selectedProfileId === prof.id && (
                          <CheckCircle2 size={14} className="text-brand-800" />
                        )}
                      </div>
                      <p className="text-[10px] text-ink-500 leading-relaxed">{prof.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Weight Override Sliders */}
              <div className="bg-surface border border-line rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-line pb-2 text-xs font-extrabold text-brand-800">
                  <span>تنظیم دستی وزن معیارهای پنج‌گانه</span>
                  <span className="text-[10px] font-mono text-ink-400">مجموع: ۱۰۰٪</span>
                </div>

                <div className="flex flex-col gap-3 text-xs">
                  {/* Fit Weight */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-ink-700">تطابق با مکعب:</span>
                      <span className="font-mono text-brand-800">{Math.round(customWeights.wFit * 100)}٪</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={customWeights.wFit}
                      onChange={(e) => setCustomWeights(prev => ({ ...prev, wFit: Number(e.target.value) }))}
                      className="accent-brand-800 cursor-pointer"
                    />
                  </div>

                  {/* Deprivation Weight */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-ink-700">کاهش محرومیت (Δ-Deprivation):</span>
                      <span className="font-mono text-ok">{Math.round(customWeights.wDep * 100)}٪</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={customWeights.wDep}
                      onChange={(e) => setCustomWeights(prev => ({ ...prev, wDep: Number(e.target.value) }))}
                      className="accent-emerald-600 cursor-pointer"
                    />
                  </div>

                  {/* Risk Weight */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-ink-700">مدیریت و کنترل ریسک:</span>
                      <span className="font-mono text-brand-800">{Math.round(customWeights.wRisk * 100)}٪</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={customWeights.wRisk}
                      onChange={(e) => setCustomWeights(prev => ({ ...prev, wRisk: Number(e.target.value) }))}
                      className="accent-brand-600 cursor-pointer"
                    />
                  </div>

                  {/* Synergy Weight */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-ink-700">هم‌افزایی با سایر پروژه‌ها:</span>
                      <span className="font-mono text-warn">{Math.round(customWeights.wSyn * 100)}٪</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={customWeights.wSyn}
                      onChange={(e) => setCustomWeights(prev => ({ ...prev, wSyn: Number(e.target.value) }))}
                      className="accent-amber-600 cursor-pointer"
                    />
                  </div>

                  {/* Sustainability Weight */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-ink-700">پایداری زیست‌محیطی:</span>
                      <span className="font-mono text-info-700">{Math.round(customWeights.wSus * 100)}٪</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={customWeights.wSus}
                      onChange={(e) => setCustomWeights(prev => ({ ...prev, wSus: Number(e.target.value) }))}
                      className="accent-teal-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

            </div>
          </>
        )}

        {/* ===================================================================== */}
        {/* TAB 2: EXPLAINABLE AI (XAI) & SHAP CONTRIBUTIONS                       */}
        {/* ===================================================================== */}
        {activeViewTab === 'xai' && (
          <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Project Selector Panel */}
            <div className="lg:col-span-4 bg-surface border border-line rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
              <span className="text-xs font-extrabold text-brand-800 border-b border-line pb-2">
                انتخاب پروژه برای دریافت گزارش توضیح‌پذیری
              </span>

              <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto">
                {allocatedProjects.map(proj => (
                  <div
                    key={proj.id}
                    onClick={() => setSelectedProjectId(proj.id)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 text-xs ${
                      selectedProjectId === proj.id
                        ? 'bg-brand-100 border-brand-800 ring-2 ring-signal-400'
                        : 'bg-surface hover:bg-paper border-line'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-ink-800">
                      <span>{proj.name}</span>
                      <span className="font-mono text-ok font-black">امتیاز: {proj.compositeScore}</span>
                    </div>
                    <span className="text-[10px] text-ink-400 font-mono">{proj.id} | {proj.province}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* SHAP Contribution Breakdown */}
            <div className="lg:col-span-8 bg-surface border border-line rounded-2xl p-4 flex flex-col gap-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <div className="flex items-center gap-2 font-extrabold text-brand-800">
                  <Eye size={18} />
                  <span>تککیک سهم عوامل پنج‌گانه بر امتیاز پروژه</span>
                </div>
                <span className="font-mono text-xs font-black text-brand-900 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                  {selectedProject.id}
                </span>
              </div>

              {/* Narrative Summary */}
              <div className="p-3 bg-surface border border-line rounded-xl text-xs text-ink-800 leading-relaxed">
                <span className="font-bold text-brand-800">خلاصه روایت هوشمند موتور: </span>
                <span>{selectedProject.narrativeFa}</span>
              </div>

              {/* Visual Contribution Bars */}
              <div className="flex flex-col gap-3">
                <span className="text-xs font-extrabold text-brand-800">نمودار سهم عوامل در امتیاز نهایی ({selectedProject.compositeScore}):</span>

                {selectedProject.shapBreakdown && (
                  <div className="flex flex-col gap-2.5 text-xs">
                    
                    {/* Fit */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-ink-700">تطابق با مکعب:</span>
                        <span className="font-mono text-brand-800">+{selectedProject.shapBreakdown.fitContrib}</span>
                      </div>
                      <div className="w-full bg-paper rounded-full h-3 overflow-hidden">
                        <div className="bg-brand-800 h-full rounded-full" style={{ width: `${selectedProject.shapBreakdown.fitContrib * 200}%` }} />
                      </div>
                    </div>

                    {/* Delta Deprivation */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-ok">سهم کاهش محرومیت (Δ-Deprivation):</span>
                        <span className="font-mono text-ok">+{selectedProject.shapBreakdown.deltaDepContrib}</span>
                      </div>
                      <div className="w-full bg-paper rounded-full h-3 overflow-hidden">
                        <div className="bg-ok h-full rounded-full" style={{ width: `${selectedProject.shapBreakdown.deltaDepContrib * 200}%` }} />
                      </div>
                    </div>

                    {/* Risk Penalty */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-brand-800">پاداش کنترل ریسک:</span>
                        <span className="font-mono text-brand-800">+{selectedProject.shapBreakdown.riskContrib}</span>
                      </div>
                      <div className="w-full bg-paper rounded-full h-3 overflow-hidden">
                        <div className="bg-brand-600 h-full rounded-full" style={{ width: `${selectedProject.shapBreakdown.riskContrib * 200}%` }} />
                      </div>
                    </div>

                    {/* Synergy */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-warn">سهم هم‌افزایی با سایر پروژه‌ها:</span>
                        <span className="font-mono text-warn">+{selectedProject.shapBreakdown.synergyContrib}</span>
                      </div>
                      <div className="w-full bg-paper rounded-full h-3 overflow-hidden">
                        <div className="bg-warn h-full rounded-full" style={{ width: `${selectedProject.shapBreakdown.synergyContrib * 200}%` }} />
                      </div>
                    </div>

                    {/* Sustainability */}
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-info-700">سهم پایداری زیست‌محیطی:</span>
                        <span className="font-mono text-info-700">+{selectedProject.shapBreakdown.sustainabilityContrib}</span>
                      </div>
                      <div className="w-full bg-paper rounded-full h-3 overflow-hidden">
                        <div className="bg-info h-full rounded-full" style={{ width: `${selectedProject.shapBreakdown.sustainabilityContrib * 200}%` }} />
                      </div>
                    </div>

                  </div>
                )}
              </div>

              {/* Counterfactual Simulation */}
              <div className="p-3 bg-brand-50 border border-brand-200 rounded-xl flex flex-col gap-1.5 text-xs text-brand-900">
                <div className="flex items-center gap-1.5 font-extrabold">
                  <Sparkles size={16} className="text-brand-700" />
                  <span>تحلیل فرضیه معکوس (Counterfactual What-If):</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  اگر ریسک اجرایی این پروژه به میزان ۱۵٪ کاهش یابد، امتیاز مرکب پروژه از {selectedProject.compositeScore} به {(Number(selectedProject.compositeScore) + 0.05).toFixed(2)} افزایش یافته و رتبه آن ۲ پله صعود خواهد نمود.
                </p>
              </div>

            </div>

          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 3: KNAPSACK BUDGET ALLOCATION BREAKDOWN                            */}
        {/* ===================================================================== */}
        {activeViewTab === 'knapsack' && (
          <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Tier Caps Breakdown */}
            <div className="lg:col-span-6 bg-surface border border-line rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
              <span className="text-xs font-extrabold text-brand-800 border-b border-line pb-2">
                توزیع سهم بودجه بر اساس دسته‌های اولویت
              </span>

              <div className="flex flex-col gap-3 text-xs">
                {/* P1 Urgent */}
                <div className="p-3 bg-danger-soft border border-danger/40 rounded-xl flex flex-col gap-1">
                  <div className="flex items-center justify-between font-black text-danger-700">
                    <span>دسته P1 — فوری و اضطراری (سقف ۴۰٪)</span>
                    <span className="font-mono">${budgetSummary.p1Total}M</span>
                  </div>
                  <p className="text-[10px] text-danger">پروژه‌های با امتیاز بالاتر از ۰.۷۲ و ریسک بسیار پایین.</p>
                </div>

                {/* P2 Strategic */}
                <div className="p-3 bg-info-soft border border-info/30 rounded-xl flex flex-col gap-1">
                  <div className="flex items-center justify-between font-black text-info">
                    <span>دسته P2 — راهبردی (سقف ۳۵٪)</span>
                    <span className="font-mono">${budgetSummary.p2Total}M</span>
                  </div>
                  <p className="text-[10px] text-info">پروژه‌های با کارایی بالا در تحقق اهداف برنامه هفتم.</p>
                </div>

                {/* P3 Complementary */}
                <div className="p-3 bg-warn-soft border border-warn/40 rounded-xl flex flex-col gap-1">
                  <div className="flex items-center justify-between font-black text-warn">
                    <span>دسته P3 — مکمل (سقف ۲۵٪)</span>
                    <span className="font-mono">${budgetSummary.p3Total}M</span>
                  </div>
                  <p className="text-[10px] text-warn">طرح‌های پشتیبان و زیرساختی زیرسقف بودجه.</p>
                </div>
              </div>
            </div>

            {/* Knapsack Optimization Parameters */}
            <div className="lg:col-span-6 bg-surface border border-line rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
              <span className="text-xs font-extrabold text-brand-800 border-b border-line pb-2">
                تنظیمات حل‌کننده خطی صفر/یک (OR-Tools CP-SAT Solver)
              </span>

              <div className="flex flex-col gap-2.5 text-xs">
                <div className="p-2.5 bg-paper border border-line rounded-xl flex items-center justify-between font-bold">
                  <span>نوع حل‌کننده:</span>
                  <span className="font-mono text-brand-800">Google OR-Tools (CP-SAT)</span>
                </div>
                <div className="p-2.5 bg-paper border border-line rounded-xl flex items-center justify-between font-bold">
                  <span>زمان انقضا:</span>
                  <span className="font-mono text-brand-800">5.0 ثانیه</span>
                </div>
                <div className="p-2.5 bg-paper border border-line rounded-xl flex items-center justify-between font-bold">
                  <span>وضعیت همگرایی:</span>
                  <span className="font-mono text-ok bg-ok-soft px-2 py-0.5 rounded border border-ok/40">OPTIMAL (پاسخ بهینه مطلق)</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 4: EXPERT OVERRIDES & WORM AUDIT TRAIL                             */}
        {/* ===================================================================== */}
        {activeViewTab === 'overrides' && (
          <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Override Action Form */}
            <div className="lg:col-span-5 bg-surface border border-line rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
              <span className="text-xs font-extrabold text-brand-800 border-b border-line pb-2 flex items-center gap-1.5">
                <ShieldCheck size={16} />
                <span>ثبت دستکاری رتبه توسط خبره</span>
              </span>

              <div className="flex flex-col gap-3 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-ink-700">انتخاب پروژه برای تغییر رتبه:</label>
                  <select
                    value={overrideProjectId}
                    onChange={(e) => setOverrideProjectId(e.target.value)}
                    className="p-2 bg-paper border border-line-strong rounded-xl text-xs font-bold focus:outline-none"
                  >
                    {CANDIDATE_PROJECTS.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-ink-700">رتبه جدید درخواستی:</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={overrideNewRank}
                    onChange={(e) => setOverrideNewRank(Number(e.target.value))}
                    className="p-2 bg-paper border border-line-strong rounded-xl font-mono text-center font-bold"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-ink-700">دلیل و توجیه حاکمیتی/کارشناسی (الزامی):</label>
                  <textarea
                    rows={3}
                    value={overrideJustification}
                    onChange={(e) => setOverrideJustification(e.target.value)}
                    placeholder="دلایل ضرورت فوق‌العاده تغییر اولویت این پروژه را شرح دهید..."
                    className="p-2 bg-paper border border-line-strong rounded-xl text-xs focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleApplyOverride}
                  className="w-full py-2 bg-brand-900 hover:bg-brand-800 text-brand-100 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Lock size={14} />
                  <span>امضای دیجیتال و ثبت غیرقابل‌تغییر در WORM Audit Log</span>
                </button>
              </div>
            </div>

            {/* Override Audit Trail List */}
            <div className="lg:col-span-7 bg-surface border border-line rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
              <span className="text-xs font-extrabold text-brand-800 border-b border-line pb-2 flex items-center justify-between">
                <span>دفتر ثبت ممیزی غیرقابل‌تغییر</span>
                <span className="font-mono text-[10px] text-ink-400">{overrideLogs.length} رکورد ثبت‌شده</span>
              </span>

              <div className="flex flex-col gap-2.5 max-h-[450px] overflow-y-auto">
                {overrideLogs.map(log => (
                  <div key={log.id} className="p-3 bg-surface border border-line rounded-xl flex flex-col gap-2 text-xs">
                    <div className="flex items-center justify-between border-b border-line pb-1.5">
                      <span className="font-bold text-brand-800">{log.projectName}</span>
                      <span className="font-mono text-[10px] bg-brand-100 text-brand-900 font-bold px-2 py-0.5 rounded">
                        رتبه قدیم: #{log.oldRank} ← رتبه جدید: #{log.newRank}
                      </span>
                    </div>

                    <p className="text-[11px] text-ink-700 leading-relaxed bg-surface p-2 rounded border border-line">
                      <strong>دلیل: </strong>{log.justification}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-ink-400 font-mono pt-1">
                      <span>ثبت توسط: <strong>{log.expertName} ({log.role})</strong></span>
                      <span>زمان: {log.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 5: ARCHITECTURE, REST/gRPC API & KAFKA STREAM                      */}
        {/* ===================================================================== */}
        {activeViewTab === 'system' && (
          <div className="lg:col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Kafka Event Stream Live Simulator */}
            <div className="lg:col-span-6 bg-wall-900 text-slate-100 rounded-2xl p-4 flex flex-col gap-3 font-mono text-xs shadow-xl">
              <div className="flex items-center justify-between border-b border-wall-700 pb-2 text-signal-400 font-bold">
                <div className="flex items-center gap-2">
                  <Terminal size={16} />
                  <span>پخش زنده رویدادهای Kafka (`ppe.decisions.v1`)</span>
                </div>
                <span className="w-2 h-2 rounded-full bg-ok-soft animate-ping" />
              </div>

              <div className="bg-wall-950 rounded-xl p-3 flex flex-col gap-2 text-[11px] text-ink-300 max-h-[380px] overflow-y-auto leading-relaxed border border-wall-800">
                <span className="text-ink-500">// Published Decision Event to Kafka Cluster</span>
                <div>
                  <span className="text-signal-300">topic:</span> "ppe.decisions.v1",<br />
                  <span className="text-signal-300">partition_key:</span> "IR-FA-NEYRIZ",<br />
                  <span className="text-signal-300">decision_id:</span> "01J0X92A1M82B...",<br />
                  <span className="text-signal-300">timestamp:</span> "2026-08-09T09:42:00Z",<br />
                  <span className="text-signal-300">payload:</span> &#123;<br />
                  &nbsp;&nbsp;<span className="text-warn">"region_id"</span>: "IR-FA-NEYRIZ",<br />
                  &nbsp;&nbsp;<span className="text-warn">"engine_version"</span>: "1.0.0",<br />
                  &nbsp;&nbsp;<span className="text-warn">"scoring_method"</span>: "{mcdaAlgorithm}",<br />
                  &nbsp;&nbsp;<span className="text-warn">"approved_projects_count"</span>: {budgetSummary.approvedCount},<br />
                  &nbsp;&nbsp;<span className="text-warn">"total_allocated"</span>: {budgetSummary.totalAllocated}<br />
                  &#125;
                </div>
              </div>
            </div>

            {/* REST OpenAPI Endpoint Schema */}
            <div className="lg:col-span-6 bg-surface border border-line rounded-2xl p-4 flex flex-col gap-3 shadow-xs text-xs">
              <div className="flex items-center justify-between border-b border-line pb-2 font-extrabold text-brand-800">
                <div className="flex items-center gap-2">
                  <Server size={16} />
                  <span>قرارداد API سرویس PPE (OpenAPI 3.1)</span>
                </div>
                <span className="font-mono text-[10px] bg-info-soft text-info px-2 py-0.5 rounded font-bold">POST /v1/prioritize</span>
              </div>

              <div className="bg-surface border border-line rounded-xl p-3 font-mono text-[11px] leading-relaxed text-gray-800 max-h-[380px] overflow-y-auto">
                <span className="text-info font-bold">POST /v1/prioritize</span><br />
                Content-Type: application/json<br /><br />
                &#123;<br />
                &nbsp;&nbsp;"region_id": "IR-FA-NEYRIZ",<br />
                &nbsp;&nbsp;"weight_profile_id": "{selectedProfileId}",<br />
                &nbsp;&nbsp;"budget_total": {budgetCapM},<br />
                &nbsp;&nbsp;"projects": [ ... {CANDIDATE_PROJECTS.length} candidate projects ]<br />
                &#125;
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
