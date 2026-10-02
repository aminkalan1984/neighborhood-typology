import { useState, useEffect, useRef } from 'react';
import IranSVGMap from './IranSVGMap';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Compass, 
  FileText, 
  Sliders, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  Eye, 
  Share2, 
  CheckCircle2, 
  Maximize2, 
  Play, 
  Pause, 
  HelpCircle, 
  Map, 
  Settings, 
  Volume2, 
  VolumeX,
  Briefcase, 
  Radio, 
  Tv, 
  Sparkles, 
  Filter, 
  Lock, 
  Plus, 
  ChevronDown, 
  ChevronUp, 
  BookOpen, 
  Users, 
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  X,
  Search,
  Fingerprint,
  History,
  Rewind,
  FastForward,
  ShieldCheck,
  PieChart
} from 'lucide-react';
import AnimatedCounter, { toPersianDigits } from './AnimatedCounter';
import KPIBreakdownExplorer, { KPIMember } from './KPIBreakdownExplorer';
import ProvinceIndicatorRace from './ProvinceIndicatorRace';

// Define structures matching the specs
interface KPIDefinition {
  id: string;
  name: string;
  category: 'economic' | 'social' | 'natural' | 'infrastructure';
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  change: string;
  status: 'excellent' | 'warning' | 'critical' | 'stable';
  target: number;
  source: string;
  confidence: number;
  sparkline: number[];
  factors: string[];
}

interface NationalSituationRoomProps {
  isWallMode?: boolean;
  setIsWallMode?: (wall: boolean) => void;
  /** کلیک روی «مشاهده در ژئوپرتال» در پنل جزئیات استان — با کد استان (مثل TEH) */
  onOpenGeoportal?: (provinceId: string) => void;
}

export default function NationalSituationRoom({ isWallMode = false, setIsWallMode, onOpenGeoportal }: NationalSituationRoomProps) {
  // 1. Dashboard Mode: 'operational' | 'wall' | 'briefing'
  const [dashboardMode, setDashboardMode] = useState<'operational' | 'wall' | 'briefing'>(isWallMode ? 'wall' : 'operational');

  useEffect(() => {
    if (isWallMode) {
      setDashboardMode('wall');
    } else if (dashboardMode === 'wall' && !isWallMode) {
      setDashboardMode('operational');
    }
  }, [isWallMode]);

  const handleModeSwitch = (mode: 'operational' | 'wall' | 'briefing') => {
    setDashboardMode(mode);
    if (setIsWallMode) {
      setIsWallMode(mode === 'wall');
    }
  };

  // 2. Active Tab in Deep Analysis (Section 3.6)
  const [activeAnalysisTab, setActiveAnalysisTab] = useState<'macro' | 'ten-dims' | 'provinces' | 'trends' | 'flows' | 'policies'>('macro');
  
  // 3. Selection States
  const [selectedKPI, setSelectedKPI] = useState<KPIDefinition | null>(null);
  const [mapKPI, setMapKPI] = useState<string>('water-stress');
  const [mapMode, setMapMode] = useState<'choropleth' | 'symbols' | 'hexbin'>('choropleth');
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [isAltPressed, setIsAltPressed] = useState<boolean>(false);

  // 3D Mini-WebGIS Engine States (چرخش سه بعدی و عوارض توپوگرافیک)
  const [mapPitch, setMapPitch] = useState<number>(45); // 0 to 65 deg tilt angle
  const [mapRotation, setMapRotation] = useState<number>(-12); // -60 to +60 deg azimuth rotation
  const [is3DMode, setIs3DMode] = useState<boolean>(true); // Toggle 3D perspective / 2D flat view
  const [showTopography, setShowTopography] = useState<boolean>(true); // Zagros, Alborz & Desert terrain reliefs
  const [show3DExtrusion, setShow3DExtrusion] = useState<boolean>(true); // 3D Extruded provincial height blocks
  const [showContourLines, setShowContourLines] = useState<boolean>(true); // Topographic contour lines mesh
  const [show3DPillars, setShow3DPillars] = useState<boolean>(true); // Vertical 3D spatial data posts
  const [extrusionHeightScale, setExtrusionHeightScale] = useState<number>(1.2); // Extrusion height scale multiplier
  const [activeXAI, setActiveXAI] = useState<string | null>(null);
  const [activeDataPassport, setActiveDataPassport] = useState<string | null>(null);

  // States for KPI Breakdown Explorer & Quick What-if Simulator
  const [breakdownKPI, setBreakdownKPI] = useState<KPIMember | null>(null);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState<boolean>(false);

  // KPI Strip Horizontal Scroll Controller
  const kpiScrollRef = useRef<HTMLDivElement>(null);
  const scrollKPIs = (direction: 'left' | 'right') => {
    if (kpiScrollRef.current) {
      const scrollAmount = direction === 'left' ? -320 : 320;
      kpiScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };
  
  // 4. Historical Time travel slider state (اسلایدر سفر در زمان / تاریخ‌های گذشته)
  const historicalMilestones = [
    { year: 1401, label: 'شهریور ۱۴۰۱', sublabel: 'آغاز سند آمایش', dateStr: '۱۴۰۱/۰۶/۱۵', kpis: { 'gdp-growth': 3.8, 'inflation': 42.1, 'employment': 87.5, 'water-stress': 68.2, 'social-capital': 59.0, 'resilience': 48.5, 'food-security': 72.0, 'public-satisfaction': 61.0 } },
    { year: 1402, label: 'مهر ۱۴۰۲', sublabel: 'اعتبارات استانی', dateStr: '۱۴۰۲/۰۷/۱۰', kpis: { 'gdp-growth': 4.3, 'inflation': 36.8, 'employment': 89.1, 'water-stress': 72.4, 'social-capital': 61.5, 'resilience': 52.0, 'food-security': 75.8, 'public-satisfaction': 64.2 } },
    { year: 1403, label: 'آبان ۱۴۰۳', sublabel: 'افت آبخوان بختگان', dateStr: '۱۴۰۳/۰۸/۲۲', kpis: { 'gdp-growth': 4.8, 'inflation': 31.5, 'employment': 90.2, 'water-stress': 75.8, 'social-capital': 63.2, 'resilience': 55.4, 'food-security': 79.1, 'public-satisfaction': 67.0 } },
    { year: 1404, label: 'اسفند ۱۴۰۴', sublabel: 'توسعه کاداستر', dateStr: '۱۴۰۴/۱۲/۰۵', kpis: { 'gdp-growth': 5.1, 'inflation': 29.2, 'employment': 90.8, 'water-stress': 77.5, 'social-capital': 63.8, 'resilience': 57.1, 'food-security': 81.0, 'public-satisfaction': 68.5 } },
    { year: 1405, label: 'مرداد ۱۴۰۵ (کنونی)', sublabel: 'پایش بلادرنگ زنده', dateStr: '۱۴۰۵/۰۵/۱۸', kpis: { 'gdp-growth': 5.4, 'inflation': 28.4, 'employment': 91.2, 'water-stress': 79.0, 'social-capital': 64.0, 'resilience': 58.0, 'food-security': 82.0, 'public-satisfaction': 69.0 } },
  ];

  const [timeTravelIndex, setTimeTravelIndex] = useState<number>(4); // Default to current (1405)
  const currentMilestone = historicalMilestones[timeTravelIndex];

  // 6. Auto cycle timer for Wall Mode
  const [wallTimerProgress, setWallTimerProgress] = useState<number>(0);

  // 8. Dynamic list of KPI items with overrides based on selected time-travel date
  const baseKpis: KPIDefinition[] = [
    {
      id: 'gdp-growth',
      name: 'رشد اقتصادی پایدار',
      category: 'economic',
      value: 5.4,
      unit: '٪',
      trend: 'up',
      change: '▲ ۰.۸٪',
      status: 'excellent',
      target: 8.0,
      source: 'بانک مرکزی - سازمان برنامه و بودجه',
      confidence: 96,
      sparkline: [4.2, 4.3, 4.5, 4.4, 4.6, 4.8, 5.0, 5.1, 5.3, 5.2, 5.5, 5.4],
      factors: ['افزایش ۲۲ درصدی تولیدات دانش‌بنیان صنعتی', 'ثبات نسبی نرخ تسویه زنجیره ارزش معدنی', 'رشد صادرات فرآورده‌های پیشرفته فولادی']
    },
    {
      id: 'inflation',
      name: 'تورم مصرف‌کننده سالانه',
      category: 'economic',
      value: 28.4,
      unit: '٪',
      trend: 'down',
      change: '▼ ۱.۲٪',
      status: 'warning',
      target: 15.0,
      source: 'مرکز آمار ایران - دیوان محاسبات عالی',
      confidence: 94,
      sparkline: [34.2, 33.1, 32.5, 31.8, 30.6, 29.8, 29.2, 29.4, 28.9, 28.5, 28.6, 28.4],
      factors: ['کاهش تدریجی نرخ رشد نقدینگی به زیر ۲۵٪', 'مهار نوسان نرخ‌های غیررسمی تسویه ارز حاکمیتی', 'طرح‌های سهمیه‌بندی زنجیره گندم و محصولات اساسی']
    },
    {
      id: 'employment',
      name: 'اشتغال خالص کل کشور',
      category: 'social',
      value: 91.2,
      unit: '٪',
      trend: 'up',
      change: '▲ ۰.۴٪',
      status: 'excellent',
      target: 95.0,
      source: 'وزارت تعاون، کار و رفاه اجتماعی',
      confidence: 92,
      sparkline: [89.1, 89.4, 89.8, 90.1, 90.0, 90.4, 90.7, 90.9, 91.0, 91.1, 91.3, 91.2],
      factors: ['توسعه کارگاه‌های خرد صنایع خلاق و خانگی عشایری', 'افزایش ظرفیت پیمانکاری ابرپروژه‌های ریلی', 'مشوق‌های جذب نخبگان غیرمقیم بنیاد ملی']
    },
    {
      id: 'water-stress',
      name: 'شاخص تنش آبی سرزمینی',
      category: 'natural',
      value: 79.0,
      unit: '٪',
      trend: 'up',
      change: '▲ ۳.۵٪',
      status: 'critical',
      target: 40.0,
      source: 'سازمان حفاظت محیط زیست - هیدرولوژی WEAP',
      confidence: 97,
      sparkline: [72.0, 72.5, 73.4, 74.2, 75.0, 76.1, 76.8, 77.4, 78.0, 78.5, 78.9, 79.0],
      factors: ['کاهش ۸۰ درصدی حق‌آبه تالاب‌های بختگان و پریشان', 'اضافه‌برداشت ۲۸۰ میلیون مترمکعبی چاه‌های کشاورزی', 'تغییر الگوهای بارندگی زاگرس به علت فرسایش خاکی']
    },
    {
      id: 'social-capital',
      name: 'شاخص مشارکت و سرمایه اجتماعی',
      category: 'social',
      value: 64.0,
      unit: 'از ۱۰۰',
      trend: 'down',
      change: '▼ ۰.۲٪',
      status: 'stable',
      target: 80.0,
      source: 'شورای عالی انقلاب فرهنگی - نظرسنجی جهاد',
      confidence: 89,
      sparkline: [66.0, 65.8, 65.5, 65.2, 64.8, 64.9, 64.5, 64.6, 64.1, 64.0, 64.2, 64.0],
      factors: ['نابرابری توسعه فضایی مرکز با حاشیه‌های عشایری', 'افزایش احساس تبعیض در صدور گواهی‌های مهارتی', 'بسترهای نوین پلتفرم‌های دولت الکترونیک و شفافیت']
    },
    {
      id: 'resilience',
      name: 'تاب‌آوری کالبدی و فضایی',
      category: 'infrastructure',
      value: 58.0,
      unit: '٪',
      trend: 'up',
      change: '▲ ۱.۱٪',
      status: 'stable',
      target: 75.0,
      source: 'وزارت راه و شهرسازی - مرکز تخمین ریسک ملی',
      confidence: 91,
      sparkline: [54.0, 54.2, 54.8, 55.1, 55.5, 56.0, 56.4, 56.9, 57.2, 57.5, 57.8, 58.0],
      factors: ['مقاوم‌سازی ۸۲ روستای هدف در کمربندهای رانش زمینی', 'افزایش ظرفیت مخازن استراتژیک نفت و انرژی', 'توسعه فیبر نوری پهن‌باند دوقلو در کانون‌های حادثه‌خیز']
    },
    {
      id: 'food-security',
      name: 'شاخص تاب‌آوری امنیت غذایی',
      category: 'natural',
      value: 82.0,
      unit: '٪',
      trend: 'up',
      change: '▲ ۰.۵٪',
      status: 'excellent',
      target: 90.0,
      source: 'سازمان جهاد کشاورزی - تراز کالاهای اساسی',
      confidence: 95,
      sparkline: [78.0, 78.5, 79.2, 79.9, 80.2, 80.9, 81.1, 81.5, 81.8, 81.9, 82.1, 82.0],
      factors: ['ترویج بذور اصلاح‌شده گندم دیم مقاوم به تنش گرمایی', 'افزایش ظرفیت سیلوهای ذخیره‌سازی مکانیزه غلات کشور', 'راه‌اندازی زنجیره هوشمند حمل کالای ترانزیت بنادر']
    },
    {
      id: 'public-satisfaction',
      name: 'رضایت عمومی کارگزاران و مردم',
      category: 'social',
      value: 69.0,
      unit: '٪',
      trend: 'down',
      change: '▼ ۱.۵٪',
      status: 'warning',
      target: 85.0,
      source: 'مرکز سنجش افکار حاکمیتی - سامانه آرا',
      confidence: 88,
      sparkline: [73.0, 72.5, 71.8, 71.2, 70.8, 70.4, 70.1, 69.8, 69.4, 69.2, 69.0, 69.0],
      factors: ['تاخیر در فرآیندهای سنتی ترخیص در مبادی صمت', 'عدم انطباق برخی مصوبات با الگوهای معیشت بوم‌گردی', 'سیستم‌های شفافیت اداری و پاسخگویی آنی دیوان محاسبات']
    }
  ];

  // Dynamic KPI list adjusting value according to selected historical milestone
  const kpis: KPIDefinition[] = baseKpis.map((k) => {
    const historicalVal = currentMilestone.kpis[k.id as keyof typeof currentMilestone.kpis];
    return {
      ...k,
      value: historicalVal ?? k.value
    };
  });

  // Simulated provinces for WebGIS Map
  const provinces = [
    { id: 'TEH', name: 'تهران', value: { 'water-stress': 72, 'gdp-growth': 6.2, 'inflation': 27.5, 'public-satisfaction': 68 }, color: '#E11D48', activeAlerts: 3, coords: 'M250,110 L270,115 L265,130 L245,120 Z' },
    { id: 'FAR', name: 'فارس (پایلوت)', value: { 'water-stress': 89, 'gdp-growth': 5.8, 'inflation': 28.4, 'public-satisfaction': 74 }, color: '#9F1239', activeAlerts: 8, coords: 'M230,280 L270,290 L260,340 L210,320 Z' },
    { id: 'ISF', name: 'اصفهان', value: { 'water-stress': 84, 'gdp-growth': 5.5, 'inflation': 29.1, 'public-satisfaction': 67 }, color: '#BE123C', activeAlerts: 5, coords: 'M210,180 L260,190 L250,250 L200,230 Z' },
    { id: 'KHO', name: 'خراسان رضوی', value: { 'water-stress': 78, 'gdp-growth': 5.1, 'inflation': 31.0, 'public-satisfaction': 70 }, color: '#FB7185', activeAlerts: 4, coords: 'M330,90 L390,120 L370,180 L320,150 Z' },
    { id: 'KHO-S', name: 'خراسان جنوبی', value: { 'water-stress': 82, 'gdp-growth': 4.3, 'inflation': 32.5, 'public-satisfaction': 63 }, color: '#FDA4AF', activeAlerts: 2, coords: 'M320,160 L380,190 L360,250 L310,220 Z' },
    { id: 'YAZ', name: 'یزد', value: { 'water-stress': 91, 'gdp-growth': 6.0, 'inflation': 28.0, 'public-satisfaction': 72 }, color: '#4C0519', activeAlerts: 1, coords: 'M265,220 L315,215 L310,270 L260,260 Z' },
    { id: 'KER', name: 'کرمان', value: { 'water-stress': 87, 'gdp-growth': 5.4, 'inflation': 29.5, 'public-satisfaction': 69 }, color: '#881337', activeAlerts: 6, coords: 'M280,270 L340,260 L350,330 L290,340 Z' },
    { id: 'SIV', name: 'سیستان و بلوچستان', value: { 'water-stress': 93, 'gdp-growth': 3.9, 'inflation': 34.2, 'public-satisfaction': 58 }, color: '#31101E', activeAlerts: 7, coords: 'M340,320 L400,310 L410,400 L350,390 Z' },
    { id: 'KHU', name: 'خوزستان', value: { 'water-stress': 81, 'gdp-growth': 5.9, 'inflation': 29.8, 'public-satisfaction': 61 }, color: '#E11D48', activeAlerts: 5, coords: 'M140,240 L190,235 L180,285 L130,275 Z' },
    { id: 'MAZ', name: 'مازندران', value: { 'water-stress': 45, 'gdp-growth': 4.8, 'inflation': 26.9, 'public-satisfaction': 71 }, color: '#FECDD3', activeAlerts: 0, coords: 'M230,80 L280,90 L270,105 L220,100 Z' },
    { id: 'GIL', name: 'گیلان', value: { 'water-stress': 38, 'gdp-growth': 4.2, 'inflation': 25.8, 'public-satisfaction': 73 }, color: '#FFE4E6', activeAlerts: 0, coords: 'M180,75 L225,82 L215,95 L175,90 Z' },
    { id: 'AZ-S', name: 'آذربایجان شرقی', value: { 'water-stress': 55, 'gdp-growth': 5.0, 'inflation': 27.2, 'public-satisfaction': 69 }, color: '#FDBA74', activeAlerts: 1, coords: 'M110,65 L150,70 L140,110 L100,100 Z' }
  ];

  // Simulated trend years for Play Mode
  const trendYearsData: Record<number, Record<string, number>> = {
    1401: { 'TEH': 64, 'FAR': 75, 'ISF': 72, 'YAZ': 82, 'SIV': 85 },
    1402: { 'TEH': 66, 'FAR': 78, 'ISF': 75, 'YAZ': 84, 'SIV': 87 },
    1403: { 'TEH': 69, 'FAR': 81, 'ISF': 78, 'YAZ': 87, 'SIV': 89 },
    1404: { 'TEH': 71, 'FAR': 85, 'ISF': 82, 'YAZ': 89, 'SIV': 91 },
    1405: { 'TEH': 72, 'FAR': 89, 'ISF': 84, 'YAZ': 91, 'SIV': 93 }
  };

  const [isPlayingTrend, setIsPlayingTrend] = useState(false);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        alert('سامانه پایش هوشمند آرا آماده دریافت فرامین زبان طبیعی شماست. کلید میانبر فعال شد.');
      }
      if (e.altKey) {
        setIsAltPressed(true);
      }
      // Shortcuts 1-8 for KPI selection
      if (!isNaN(Number(e.key)) && Number(e.key) >= 1 && Number(e.key) <= 8) {
        setSelectedKPI(kpis[Number(e.key) - 1]);
      }
      if (e.key === 'm' || e.key === 'M') {
        setActiveAnalysisTab('macro');
      }
      if (e.key === 'Escape') {
        setSelectedKPI(null);
        setActiveXAI(null);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setIsAltPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Wall mode auto-tab-cycle
  useEffect(() => {
    let timer: any;
    if (dashboardMode === 'wall') {
      timer = setInterval(() => {
        setWallTimerProgress((prev) => {
          if (prev >= 100) {
            // cycle tab
            setActiveAnalysisTab((current) => {
              const tabs: typeof activeAnalysisTab[] = ['macro', 'ten-dims', 'provinces', 'trends', 'flows', 'policies'];
              const nextIndex = (tabs.indexOf(current) + 1) % tabs.length;
              return tabs[nextIndex];
            });
            return 0;
          }
          return prev + 1; // 10 seconds total cycle
        });
      }, 100);
    } else {
      setWallTimerProgress(0);
    }
    return () => clearInterval(timer);
  }, [dashboardMode]);

  // Play trends over years
  useEffect(() => {
    let timer: any;
    if (isPlayingTrend) {
      timer = setInterval(() => {
        setTimeTravelIndex((prev) => {
          if (prev >= historicalMilestones.length - 1) {
            return 0;
          }
          return prev + 1;
        });
      }, 1200);
    }
    return () => clearInterval(timer);
  }, [isPlayingTrend]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'text-ok bg-ok-soft border-ok/30';
      case 'warning': return 'text-warn bg-warn-soft border-warn/30';
      case 'critical': return 'text-danger bg-danger-soft border-danger/30';
      default: return 'text-ink-500 bg-paper border-line';
    }
  };

  return (
    <div id="national-situation-room" className={`flex flex-col gap-6 text-right w-full select-none transition-colors duration-500 ${dashboardMode === 'wall' ? 'dark bg-wall-900 text-slate-100 p-6 rounded-3xl border border-wall-700 shadow-[var(--shadow-pop)]' : 'bg-transparent text-ink-800'}`}>
      
      {/* 6.4 Crisis National Mode Banner */}
      <div id="crisis-banner" className="relative w-full bg-gradient-to-l from-danger to-[#C63A3F] text-[#FBFBFC] px-5 py-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_10px_28px_-10px_rgba(229,72,77,0.55)] border border-white/15 overflow-hidden">
        {/* بافت مورب ظریف — عمق بدون نویز */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.08]" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, #FFFFFF, #FFFFFF 14px, transparent 14px, transparent 28px)' }} />
        <div className="flex items-center gap-3.5 relative">
          <div className="relative w-11 h-11 rounded-xl bg-white/15 backdrop-blur-sm border border-white/25 flex items-center justify-center animate-live-pulse-red">
            <ShieldAlert size={22} />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-black text-sm md:text-base tracking-tight">حالت پایش فوق‌العاده سطح ملی فعال است</span>
              <span className="text-[10px] bg-white text-danger px-2.5 py-0.5 rounded-full font-black flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-danger animate-pulse" />
                بحران هیدرولوژیک فارس
              </span>
            </div>
            <p className="text-xs text-red-50/90 font-medium">افت سالانه چاه‌های دشت‌های نی‌ریز و تالاب بختگان در وضعیت حاد محیطی قرار دارد.</p>
          </div>
        </div>
        <div className="flex items-center gap-3 self-end md:self-auto relative">
          <button 
            onClick={() => {
              setMapKPI('water-stress');
              setMapMode('choropleth');
              setActiveAnalysisTab('macro');
              const cell = kpis.find(k => k.id === 'water-stress');
              if (cell) setSelectedKPI(cell);
            }} 
            className="px-4 py-2.5 bg-white hover:bg-red-50 text-danger font-black rounded-xl text-xs transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            ورود به نمای ریشه‌یابی فازی تالاب
          </button>
        </div>
      </div>

      {/* Ticker Row (Row 0) — نبض برخط کشور */}
      <div className={`relative w-full overflow-hidden py-3.5 px-4 rounded-2xl border flex items-center gap-4 ${dashboardMode === 'wall' ? 'dark bg-wall-850 border-wall-700 text-slate-200' : 'bg-surface border-line shadow-[var(--shadow-card)]'}`}>
        <div className="flex items-center gap-2 text-xs font-black shrink-0 text-brand-800 dark:text-signal-400 border-l border-line dark:border-wall-700 pl-4 z-10">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-danger opacity-60 animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-danger" />
          </span>
          <span>نبض برخط کشور:</span>
        </div>
        <div className="w-full overflow-hidden relative" style={{ maskImage: 'linear-gradient(to left, transparent, black 8%, black 92%, transparent)', WebkitMaskImage: 'linear-gradient(to left, transparent, black 8%, black 92%, transparent)' }}>
          <div className="flex gap-10 w-max animate-marquee-rtl cursor-pointer">
            {[...kpis, ...kpis].map((k, i) => (
              <div 
                key={`${k.id}-${i}`} 
                onClick={() => setSelectedKPI(k)}
                className="inline-flex items-center gap-2.5 text-xs font-medium"
              >
                <span className="text-ink-500 dark:text-slate-400 font-bold">{k.name}</span>
                <span className="font-mono font-black tabular-nums">{k.value} {k.unit}</span>
                <span className={`flex items-center gap-0.5 font-mono text-[10px] font-bold ${k.trend === 'up' ? 'text-ok' : 'text-danger'}`}>
                  {k.trend === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {k.change}
                </span>
                <span className="text-line-strong dark:text-wall-600">|</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Header Panel with Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-5 border-line dark:border-wall-700">
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-800 to-brand-900 text-signal-400 flex items-center justify-center shadow-[var(--shadow-card)] shrink-0">
            <Radio size={24} />
            <span className="absolute -top-1 -right-1 size-3 rounded-full bg-danger border-2 border-paper animate-live-pulse-red" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className={`font-black transition-all leading-tight ${dashboardMode === 'wall' ? 'text-2xl text-signal-400' : 'text-lg md:text-[1.4rem] text-brand-800'}`}>
                اتاق وضعیت دیجیتال حاکمیتی ایران
              </h1>
              <span className={`text-[10px] px-2.5 py-1 rounded-full font-black flex items-center gap-1.5 ${dashboardMode === 'wall' ? 'bg-signal-400/15 text-signal-400 border border-signal-400/30' : 'bg-brand-800 text-signal-400'}`}>
                <span className="live-dot" />
                زنده / بلادرنگ
              </span>
            </div>
            <p className="text-xs text-ink-500 dark:text-slate-400">سامانه هوشمند پایش تراز، انحراف و همبستگی شاخص‌های ملی ایران بر مبنای هوش مصنوعی علّی</p>
          </div>
        </div>

        {/* 3 Mode Controllers — کنترلر سگمنتی */}
        <div className="flex items-center gap-1 p-1.5 rounded-2xl border bg-ink-900/[0.03] dark:bg-wall-850 border-line dark:border-wall-700 self-start lg:self-auto shadow-inner">
          <button
            onClick={() => handleModeSwitch('operational')}
            className={`px-3.5 py-2 text-xs font-extrabold rounded-xl flex items-center gap-2 transition-all cursor-pointer ${dashboardMode === 'operational' ? 'bg-surface text-brand-800 dark:text-signal-400 shadow-[var(--shadow-card)] dark:bg-wall-800' : 'text-ink-500 hover:text-ink-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            <Sliders size={13} />
            <span>عملیاتی</span>
          </button>
          <button
            onClick={() => handleModeSwitch('wall')}
            className={`px-3.5 py-2 text-xs font-extrabold rounded-xl flex items-center gap-2 transition-all cursor-pointer ${dashboardMode === 'wall' ? 'bg-signal-400 text-wall-900 shadow-[var(--shadow-card)] font-black' : 'text-ink-500 hover:text-ink-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            <Tv size={13} />
            <span>ویدئووال</span>
          </button>
          <button
            onClick={() => handleModeSwitch('briefing')}
            className={`px-3.5 py-2 text-xs font-extrabold rounded-xl flex items-center gap-2 transition-all cursor-pointer ${dashboardMode === 'briefing' ? 'bg-surface text-brand-800 dark:text-signal-400 shadow-[var(--shadow-card)] dark:bg-wall-800' : 'text-ink-500 hover:text-ink-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
            <BookOpen size={13} />
            <span>ارائه شورا</span>
          </button>
        </div>
      </div>

      {/* HISTORICAL TIME TRAVEL SLIDER (اسلایدر سفر در زمان / تحلیل تاریخی) */}
      <div id="time-travel-panel" className={`p-4 rounded-[var(--radius-panel)] border transition-all ${dashboardMode === 'wall' ? 'dark bg-wall-850 border-wall-700 text-slate-100' : 'bg-surface border-line shadow-[var(--shadow-card)]'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3 border-b pb-2.5 border-line dark:border-wall-700">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="icon-tile size-8"><History size={16} /></span>
            <span className="text-xs font-black text-brand-800 dark:text-signal-400">موتور سفر در زمان و تحلیل بازه تاریخی</span>
            <span className="chip bg-brand-100 text-brand-800 dark:bg-wall-800 dark:text-signal-400 font-mono">
              مقطع زمانی: {currentMilestone.label} ({currentMilestone.dateStr})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-ink-500 dark:text-slate-400">توصیف رویداد:</span>
            <span className="text-xs font-bold text-brand-800 dark:text-signal-400">{currentMilestone.sublabel}</span>
          </div>
        </div>

        {/* Interactive Slider Bar */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setTimeTravelIndex(prev => Math.max(0, prev - 1))}
            disabled={timeTravelIndex === 0}
            className="p-2 rounded-xl bg-brand-100 hover:bg-brand-200 dark:bg-wall-800 dark:hover:bg-wall-700 disabled:opacity-40 text-brand-800 dark:text-signal-400 transition-all cursor-pointer"
            title="گام قبلی"
          >
            <Rewind size={15} />
          </button>

          <div className="flex-grow flex flex-col gap-2 relative px-1 py-1">
            <input 
              type="range" 
              min={0} 
              max={historicalMilestones.length - 1} 
              step={1} 
              value={timeTravelIndex}
              onChange={(e) => setTimeTravelIndex(Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
            />
            {/* Milestone Markers */}
            <div className="flex justify-between items-center text-[10px] font-mono font-bold text-ink-400 dark:text-slate-400">
              {historicalMilestones.map((m, idx) => (
                <button 
                  key={m.year}
                  onClick={() => setTimeTravelIndex(idx)}
                  className={`transition-all cursor-pointer ${idx === timeTravelIndex ? 'text-brand-800 dark:text-signal-400 font-black scale-110' : 'hover:text-ink-700 dark:hover:text-slate-200'}`}
                >
                  {m.label.split(' ')[0]} {m.year}
                </button>
              ))}
            </div>
          </div>

          <button 
            onClick={() => setTimeTravelIndex(prev => Math.min(historicalMilestones.length - 1, prev + 1))}
            disabled={timeTravelIndex === historicalMilestones.length - 1}
            className="p-2 rounded-xl bg-brand-100 hover:bg-brand-200 dark:bg-wall-800 dark:hover:bg-wall-700 disabled:opacity-40 text-brand-800 dark:text-signal-400 transition-all cursor-pointer"
            title="گام بعدی"
          >
            <FastForward size={15} />
          </button>
        </div>
      </div>

      {/* KPI STRIP HEADER WITH SCROLL CONTROLS */}
      <div className="flex items-center justify-between px-1 -mb-1 gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="icon-tile size-8"><Activity size={16} /></span>
          <span className="text-xs font-black text-brand-800 dark:text-signal-400">
            شاخص‌های کلان پایش ملی
          </span>
          <span className="chip bg-brand-100 text-brand-800 dark:bg-wall-800 dark:text-signal-400">
            {toPersianDigits(kpis.length)} شاخص کلیدی
          </span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-ink-400 font-bold ml-1 hidden sm:inline">پیمایش افقی:</span>
          <button
            onClick={() => scrollKPIs('right')}
            className="p-2 rounded-xl bg-surface dark:bg-wall-800 border border-line dark:border-wall-700 hover:bg-brand-100 dark:hover:bg-wall-700 text-ink-700 dark:text-slate-200 transition-all cursor-pointer shadow-[var(--shadow-card)]"
            title="پیمایش به راست"
          >
            <ChevronRight size={15} />
          </button>
          <button
            onClick={() => scrollKPIs('left')}
            className="p-2 rounded-xl bg-surface dark:bg-wall-800 border border-line dark:border-wall-700 hover:bg-brand-100 dark:hover:bg-wall-700 text-ink-700 dark:text-slate-200 transition-all cursor-pointer shadow-[var(--shadow-card)]"
            title="پیمایش به چپ"
          >
            <ChevronLeft size={15} />
          </button>
        </div>
      </div>

      {/* KPI STRIP CONTAINER (Horizontal scroll with 5 visible cards on large screens) */}
      <div 
        ref={kpiScrollRef}
        className="flex gap-3.5 overflow-x-auto pb-3 pt-1 scroll-smooth snap-x snap-mandatory"
      >
        {kpis.map((k) => {
          const colors = getStatusColor(k.status);
          const isSelected = selectedKPI?.id === k.id;
          return (
            <div 
              key={k.id}
              onClick={() => setSelectedKPI(k)}
              className={`p-4 rounded-[var(--radius-panel)] border text-right transition-all flex flex-col justify-between cursor-pointer ${dashboardMode === 'wall' ? 'h-[250px]' : 'h-[240px]'} relative select-none hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)] shrink-0 w-[270px] sm:w-[290px] lg:w-[calc((100%-56px)/5)] snap-start overflow-hidden ${
                isSelected 
                  ? 'border-brand-800 dark:border-signal-400 bg-brand-50/70 dark:bg-wall-800 ring-2 ring-brand-800/15 dark:ring-signal-400/20' 
                  : dashboardMode === 'wall' 
                    ? 'border-wall-700 bg-wall-900/90 hover:bg-wall-850' 
                    : 'border-line bg-surface'
              }`}
            >
              {/* نوار وضعیت بالا — لهجهٔ رنگی بر اساس وضعیت */}
              <span className={`absolute top-0 right-0 left-0 h-[3px] ${k.status === 'critical' ? 'bg-danger' : k.status === 'warning' ? 'bg-warn' : k.status === 'excellent' ? 'bg-ok' : 'bg-brand-400'}`} />

              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-ink-400 dark:text-slate-400 font-bold tracking-wide">{k.category.toUpperCase()}</span>
                <span className={`chip border ${colors}`}>{k.status.toUpperCase()}</span>
              </div>

              {/* Action Toolbar Row: "شکست", "شناسنامه", "چرا؟" */}
              <div className="flex items-center justify-between gap-1 p-1 bg-paper/80 dark:bg-wall-950/60 rounded-xl border border-line/70 dark:border-wall-800 my-1 text-[9.5px] font-extrabold z-10">
                {/* KPI Breakdown Explorer Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setBreakdownKPI({
                      id: k.id,
                      name: k.name,
                      value: k.value,
                      unit: k.unit,
                      status: k.status,
                      target: k.target,
                      source: k.source,
                      confidence: k.confidence
                    });
                    setIsBreakdownOpen(true);
                  }}
                  className="flex-1 py-1.5 px-1 bg-surface hover:bg-brand-800 hover:text-signal-400 dark:bg-wall-900 dark:hover:bg-wall-700 text-brand-800 dark:text-signal-400 rounded-lg transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1"
                  title="کاوشگر شکست شاخص"
                >
                  <PieChart size={10} />
                  <span>شکست</span>
                </button>

                {/* Data Passport Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDataPassport(activeDataPassport === k.id ? null : k.id);
                    setActiveXAI(null);
                  }}
                  className="flex-1 py-1.5 px-1 bg-surface hover:bg-brand-800 hover:text-signal-400 dark:bg-wall-900 dark:hover:bg-wall-700 text-brand-800 dark:text-signal-400 rounded-lg transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1"
                  title="شناسنامه داده"
                >
                  <Fingerprint size={10} />
                  <span>شناسنامه</span>
                </button>

                {/* Causal AI "چرا؟" button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveXAI(activeXAI === k.id ? null : k.id);
                    setActiveDataPassport(null);
                  }}
                  className="px-2.5 py-1.5 bg-surface hover:bg-brand-800 hover:text-signal-400 dark:bg-wall-900 dark:hover:bg-wall-700 text-brand-800 dark:text-signal-400 rounded-lg transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1"
                  title="تبیین علّی"
                >
                  <HelpCircle size={10} />
                  <span>چرا؟</span>
                </button>
              </div>

              {/* Metric values with AnimatedCounter */}
              <div className="my-1">
                <p className="text-[11.5px] text-ink-500 dark:text-slate-400 font-bold truncate">{k.name}</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <AnimatedCounter 
                    value={k.value} 
                    unit={k.unit} 
                    decimals={1} 
                    className={dashboardMode === 'wall' ? 'text-2xl lg:text-[2rem] text-signal-400 font-black' : 'text-[1.7rem] font-black text-brand-800 dark:text-white leading-tight'}
                  />
                </div>
                <span className={`text-[10px] font-bold inline-flex items-center gap-0.5 font-mono mt-1 ${k.trend === 'up' ? 'text-ok' : 'text-danger'}`}>
                  {k.trend === 'up' ? '▲' : '▼'} {k.change}
                </span>
              </div>

              {/* Sparkline Simulation using inline SVG — با گرادیان زیر خط */}
              <div className="w-full h-7 mb-1 overflow-hidden">
                <svg viewBox="0 0 100 30" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id={`grad-${k.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={k.trend === 'up' ? '#10B981' : '#E5484D'} stopOpacity="0.25" />
                      <stop offset="100%" stopColor={k.trend === 'up' ? '#10B981' : '#E5484D'} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={`M ${k.sparkline.map((val, i) => `${(i * 100) / (k.sparkline.length - 1)} ${30 - ((val - Math.min(...k.sparkline)) / (Math.max(...k.sparkline) - Math.min(...k.sparkline) || 1)) * 25}`).join(' L ')}`}
                    fill="none"
                    stroke={k.trend === 'up' ? '#10B981' : '#E5484D'}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={`M ${k.sparkline.map((val, i) => `${(i * 100) / (k.sparkline.length - 1)} ${30 - ((val - Math.min(...k.sparkline)) / (Math.max(...k.sparkline) - Math.min(...k.sparkline) || 1)) * 25}`).join(' L ')} L 100 30 L 0 30 Z`}
                    fill={`url(#grad-${k.id})`}
                  />
                </svg>
              </div>

              {/* Bullet Bar: Target vs Current */}
              <div className="w-full flex flex-col gap-1 text-[9.5px] text-ink-400 dark:text-slate-400">
                <div className="flex justify-between font-mono font-bold">
                  <span>هدف: {k.target}</span>
                  <span>فعلی</span>
                </div>
                <div className="w-full bg-line dark:bg-wall-800 h-1.5 rounded-full overflow-hidden relative">
                  <div 
                    className="bg-brand-800 dark:bg-signal-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((k.value / k.target) * 100, 100)}%` }}
                  />
                </div>
              </div>

              {/* DATA PASSPORT POPOVER (شناسنامه داده) */}
              {activeDataPassport === k.id && (
                <div 
                  onClick={(e) => e.stopPropagation()} 
                  className="absolute bottom-full left-0 mb-2 w-72 p-4 bg-surface dark:bg-wall-900 border border-line dark:border-wall-700 rounded-2xl shadow-[var(--shadow-pop)] z-50 text-right leading-relaxed flex flex-col gap-2.5 animate-fade-in"
                >
                  <div className="flex items-center justify-between border-b pb-2 border-line dark:border-wall-700">
                    <span className="text-xs font-black text-brand-800 dark:text-signal-400 flex items-center gap-1.5">
                      <ShieldCheck size={14} className="text-ok" />
                      شناسنامه داده
                    </span>
                    <button onClick={() => setActiveDataPassport(null)} className="text-ink-300 hover:text-ink-700 dark:text-slate-500 transition-colors"><X size={14} /></button>
                  </div>
                  
                  <div className="flex flex-col gap-2 text-[10px] text-ink-700 dark:text-slate-300">
                    <div className="flex justify-between border-b border-line/60 dark:border-wall-800 pb-1">
                      <span className="text-ink-400">مرجع رسمی:</span>
                      <span className="font-bold text-brand-800 dark:text-signal-400">{k.source}</span>
                    </div>
                    <div className="flex justify-between border-b border-line/60 dark:border-wall-800 pb-1">
                      <span className="text-ink-400">تاریخ به‌روزرسانی:</span>
                      <span className="font-mono font-bold">{currentMilestone.dateStr} - ۰۸:۳۰:۰۰</span>
                    </div>
                    <div className="flex justify-between border-b border-line/60 dark:border-wall-800 pb-1">
                      <span className="text-ink-400">مدل محاسباتی:</span>
                      <span className="font-mono font-bold text-ink-800 dark:text-slate-200">Causal-Engine v4.8</span>
                    </div>
                    <div className="flex justify-between border-b border-line/60 dark:border-wall-800 pb-1">
                      <span className="text-ink-400">درجه اطمینان آماری:</span>
                      <span className="font-mono font-bold text-ok">{k.confidence}٪ (±۰.۱٪)</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-ink-400">امضای دیجیتال:</span>
                      <span className="font-mono text-[9px] text-ink-300 truncate max-w-[130px]">0x7B9E4C12A80F</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Causal Explanation Popover */}
              {activeXAI === k.id && (
                <div 
                  onClick={(e) => e.stopPropagation()} 
                  className="absolute bottom-full right-0 mb-2 w-72 p-4 bg-surface dark:bg-wall-900 border border-line dark:border-wall-700 rounded-2xl shadow-[var(--shadow-pop)] z-50 text-right leading-relaxed flex flex-col gap-2.5 animate-fade-in"
                >
                  <div className="flex items-center justify-between border-b pb-2 border-line dark:border-wall-700">
                    <span className="text-xs font-black text-brand-800 dark:text-signal-400">تبیین علّی مدل آرا</span>
                    <button onClick={() => setActiveXAI(null)} className="text-ink-300 hover:text-ink-700 dark:text-slate-500 transition-colors"><X size={14} /></button>
                  </div>
                  <p className="text-[10.5px] font-bold text-ink-800 dark:text-slate-200">۳ عامل اصلی در نوسان {k.name}:</p>
                  <ul className="list-decimal list-inside text-[10px] text-ink-500 dark:text-slate-400 space-y-1.5">
                    {k.factors.map((f, idx) => (
                      <li key={idx} className="list-none flex gap-1.5">
                        <span className="text-brand-800 dark:text-signal-400 font-bold">{idx + 1}.</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between text-[9px] text-ink-400 dark:text-slate-400 border-t pt-2 border-line dark:border-wall-700 font-mono">
                    <span>اطمینان مدل: {k.confidence}٪</span>
                    <span>شناسنامه: {k.source.split(' - ')[0]}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* CENTRAL CANVAS (Row 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Panel (50% - 6 Columns on large screens): Mapir WebGIS Iran Map */}
        <div className={`lg:col-span-6 rounded-[var(--radius-panel)] p-4 flex flex-col gap-3 relative overflow-hidden border transition-all ${dashboardMode === 'wall' ? 'dark bg-wall-900/80 border-wall-700' : 'bg-surface border-line shadow-[var(--shadow-card)]'}`}>
          
          {/* Header & Main Lens Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b pb-3 border-line dark:border-wall-700 z-10">
            <div className="flex items-center gap-2.5">
              <span className="icon-tile"><Map size={18} /></span>
              <div className="flex flex-col text-right">
                <h2 className="text-xs font-black text-ink-900 dark:text-slate-100 flex items-center gap-1.5">
                  ژئوپرتال هوشمند مپ‌ایر (Map.ir WebGIS)
                  <span className="text-[9px] bg-signal-400 text-brand-900 px-1.5 py-0.5 rounded font-extrabold">
                    موتور مپ‌ایر
                  </span>
                </h2>
                <span className="text-[10px] text-ink-400 dark:text-slate-400">
                  کاشی‌کاری مپ‌ایر، لایه‌های زیرساخت، زاگرس/البرز و جستجوی مکانی
                </span>
              </div>
            </div>

            {/* Metric KPI Selector */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <select 
                value={mapKPI} 
                onChange={(e) => setMapKPI(e.target.value)}
                className="bg-brand-50 dark:bg-wall-800 border border-line dark:border-wall-700 rounded-xl px-2.5 py-2 text-[11px] font-bold text-brand-800 dark:text-signal-400 cursor-pointer outline-none focus:ring-2 focus:ring-brand-800/20 transition-all"
              >
                <option value="water-stress">تنش آبی سرزمینی</option>
                <option value="gdp-growth">رشد ناخالص داخلی</option>
                <option value="inflation">نرخ تورم سالانه</option>
                <option value="public-satisfaction">شاخص رضایت عمومی</option>
              </select>

              <div className="flex bg-brand-50 dark:bg-wall-800 p-0.5 rounded-xl border border-line dark:border-wall-700 text-[10px]">
                <button 
                  onClick={() => setMapMode('choropleth')} 
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition-all ${mapMode === 'choropleth' ? 'bg-surface dark:bg-wall-700 text-brand-800 dark:text-signal-400 shadow-[var(--shadow-card)]' : 'text-ink-500 dark:text-slate-400'}`}
                >
                  حرارتی
                </button>
                <button 
                  onClick={() => setMapMode('symbols')} 
                  className={`px-2.5 py-1.5 rounded-lg font-bold transition-all ${mapMode === 'symbols' ? 'bg-surface dark:bg-wall-700 text-brand-800 dark:text-signal-400 shadow-[var(--shadow-card)]' : 'text-ink-500 dark:text-slate-400'}`}
                >
                  نمادی
                </button>
              </div>
            </div>
          </div>

          {/* Iran SVG Map Engine — نقشهٔ کامل ایران با مرز دقیق ۳۱ استان */}
          <IranSVGMap 
            mapKPI={mapKPI}
            setMapKPI={setMapKPI}
            mapMode={mapMode}
            setMapMode={setMapMode}
            hoveredProvince={hoveredProvince}
            setHoveredProvince={setHoveredProvince}
            isAltPressed={isAltPressed}
            onOpenGeoportal={onOpenGeoportal}
          />
        </div>

        <ProvinceIndicatorRace isWallMode={dashboardMode === 'wall'} />
      </div>

      {/* ANALYTICAL DEEP TABS (Row 4) */}
      <div className={`panel-card p-5 flex flex-col gap-6 ${dashboardMode === 'wall' ? 'dark' : ''}`}>
        
        {/* Tab Headers */}
        <div className="flex border-b border-line dark:border-wall-700 gap-1.5 overflow-x-auto min-w-0 pb-0">
          {([
            ['macro', 'نمای کلان'],
            ['ten-dims', 'ابعاد ده‌گانه پیشرفت'],
            ['provinces', 'رتبه‌بندی استان‌ها'],
            ['trends', 'روندهای زمانی'],
            ['flows', 'نقشه جریان‌های ملی'],
            ['policies', 'پایش اثر سیاست‌ها']
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveAnalysisTab(tab)}
              className={`relative px-4 py-2.5 text-xs font-black rounded-t-xl transition-all shrink-0 cursor-pointer whitespace-nowrap ${
                activeAnalysisTab === tab
                  ? 'text-brand-800 dark:text-signal-400 bg-brand-50/60 dark:bg-wall-850'
                  : 'text-ink-400 hover:text-ink-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {label}
              <span className={`absolute bottom-0 right-3 left-3 h-0.5 rounded-t-full bg-brand-800 dark:bg-signal-400 transition-opacity ${activeAnalysisTab === tab ? 'opacity-100' : 'opacity-0'}`} />
            </button>
          ))}
        </div>

        {/* Tab content bodies */}
        {activeAnalysisTab === 'macro' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-right animate-fade-in leading-relaxed">
            <div className="bg-paper dark:bg-wall-950/60 border border-line dark:border-wall-700 p-5 rounded-2xl flex flex-col gap-3">
              <h4 className="font-black text-brand-800 dark:text-signal-400 text-sm">چشم‌انداز تحلیلی اقتصاد مقاومتی و فضایی</h4>
              <p className="text-ink-500 dark:text-slate-300">
                بر اساس تلاقی ابعاد ده‌گانه پیشرفت حاکمیت آرا، استان فارس و به ویژه کانون نی‌ریز در اولویت یک مداخله ملی قرار دارد. تله خام‌فروشی کرومیت در کنار بحران شدید افت سفره‌های آبی، لزوم انتقال سرمایه عمرانی به زنجیره‌های بوم‌گردی، توسعه گلیم‌بافی (ثبت یونسکو) و ایجاد نیروگاه‌های ۱۰۰ مگاواتی اراضی شور آباده‌طشک را دیکته می‌کند.
              </p>
              <div className="flex items-center gap-2 text-[11px] font-bold text-ink-800 dark:text-slate-200 mt-2">
                <span className="size-1.5 rounded-full bg-ok animate-live-pulse"></span>
                <span>تراز بودجه عمرانی ملی: پایدار و سبز</span>
              </div>
            </div>

            <div className="bg-paper dark:bg-wall-950/60 border border-line dark:border-wall-700 p-5 rounded-2xl flex flex-col gap-3 justify-between">
              <h4 className="font-black text-brand-800 dark:text-signal-400 text-sm">پیشنهاد مداخلات هوشمند صبحگاهی</h4>
              <ul className="list-disc list-inside text-ink-500 dark:text-slate-300 flex flex-col gap-2 space-y-1 pr-1">
                <li className="list-none flex gap-2">
                  <span className="text-danger font-bold">•</span>
                  <span><strong>انسداد فوری چاه‌های غیرمجاز آب دشت نی‌ریز:</strong> پیش‌بینی افزایش تراز تالاب بختگان تا ۱۲٪ طی ۱۸۰ روز.</span>
                </li>
                <li className="list-none flex gap-2">
                  <span className="text-warn font-bold">•</span>
                  <span><strong>سرمایه‌گذاری روی پلتفرم گلیم C2B:</strong> ایجاد اشتغال مستقیم برای ۱,۸۰۰ زن روستایی بدون نیاز به ۱ قطره مصرف آب جدید.</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {activeAnalysisTab === 'ten-dims' && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-right text-xs animate-fade-in select-none">
            {[
              { code: 'D1', name: 'طبیعی و اقلیمی', score: 42, color: 'bg-danger', label: 'بحران آب بختگان' },
              { code: 'D2', name: 'انسانی و علمی', score: 61, color: 'bg-warn', label: 'نخبگان بالا، مهارتی کم' },
              { code: 'D3', name: 'فرهنگی و هویتی', score: 78, color: 'bg-green-500', label: 'گلیم ثبت یونسکو' },
              { code: 'D4', name: 'معنوی و اخلاقی', score: 72, color: 'bg-green-500', label: 'مشارکت موقوفات بالا' },
              { code: 'D5', name: 'اجتماعی و همبستگی', score: 64, color: 'bg-green-500', label: 'ایل بزرگ قشقایی' },
              { code: 'D6', name: 'اقتصادی و تولیدی', score: 55, color: 'bg-warn', label: 'خام‌فروشی شدید' },
              { code: 'D7', name: 'زیرساخت و کالبدی', score: 38, color: 'bg-danger', label: 'جاده ترانزیت بحرانی' },
              { code: 'D8', name: 'امنیتی و تاب‌آوری', score: 82, color: 'bg-green-500', label: 'پدافند عالی' },
              { code: 'D9', name: 'نهادی و حاکمیتی', score: 49, color: 'bg-warn', label: 'عدم هم‌افزایی قوا' },
              { code: 'D10', name: 'آینده‌پژوهی و استعداد', score: 46, color: 'bg-warn', label: 'بسیار مستعد، بی سرمایه' }
            ].map((dim) => (
              <div key={dim.code} className="p-3.5 bg-paper dark:bg-wall-950/60 border border-line dark:border-wall-700 rounded-xl flex flex-col justify-between gap-2 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] transition-all">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9.5px] font-bold text-ink-400">{dim.code}</span>
                  <span className="font-black font-mono text-brand-800 dark:text-signal-400">{dim.score} / ۱۰۰</span>
                </div>
                <div>
                  <span className="font-black text-ink-800 dark:text-slate-100 block truncate">{dim.name}</span>
                  <span className="text-[10px] text-ink-300 block mt-0.5 truncate">{dim.label}</span>
                </div>
                <div className="w-full bg-line dark:bg-wall-800 h-1.5 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${dim.color}`} style={{ width: `${dim.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {activeAnalysisTab === 'provinces' && (
          <div className="flex flex-col gap-4 animate-fade-in text-right text-xs">
            <div className="flex items-center justify-between shrink-0">
              <span className="font-bold text-brand-800 dark:text-signal-400">تراز انحراف آمایش استانی (بر پایه ۳۱ استان)</span>
              <span className="text-[10px] text-slate-500">منبع: دیوان محاسبات عالی کشور - مرداد ۱۴۰۵</span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-line dark:border-wall-700 shadow-[var(--shadow-card)]">
              <table className="w-full text-right border-collapse min-w-[560px]">
                <thead>
                  <tr className="bg-brand-50 dark:bg-wall-850 border-b border-line dark:border-wall-700">
                    <th className="p-3 font-black text-ink-700 dark:text-slate-300">رتبه ملی</th>
                    <th className="p-3 font-black text-ink-700 dark:text-slate-300">نام استان</th>
                    <th className="p-3 font-black text-ink-700 dark:text-slate-300">تنش آبی</th>
                    <th className="p-3 font-black text-ink-700 dark:text-slate-300">رشد اقتصادی</th>
                    <th className="p-3 font-black text-ink-700 dark:text-slate-300">رضایت عمومی</th>
                    <th className="p-3 font-black text-ink-700 dark:text-slate-300">وضعیت تعادل</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { rank: 1, name: 'تهران', water: '۷۲٪', gdp: '۶.۲٪', satisfaction: '۶۸٪', status: 'پایدار', color: 'text-ok bg-ok-soft' },
                    { rank: 2, name: 'یزد', water: '۹۱٪', gdp: '۶.۰٪', satisfaction: '۷۲٪', status: 'تنش شدید آبی', color: 'text-warn bg-warn-soft' },
                    { rank: 3, name: 'فارس (پایلوت)', water: '۸۹٪', gdp: '۵.۸٪', satisfaction: '۷۴٪', status: 'بحرانی اکولوژیک', color: 'text-danger bg-danger-soft' },
                    { rank: 4, name: 'خوزستان', water: '۸۱٪', gdp: '۵.۹٪', satisfaction: '۶۱٪', status: 'تنش موضعی', color: 'text-warn bg-warn-soft' },
                    { rank: 5, name: 'مازندران', water: '۴۵٪', gdp: '۴.۸٪', satisfaction: '۷۱٪', status: 'پایدار مطلوب', color: 'text-ok bg-ok-soft' }
                  ].map((row) => (
                    <tr key={row.rank} className="border-b border-line/60 dark:border-wall-800 hover:bg-brand-50/50 dark:hover:bg-wall-850/60 transition-colors">
                      <td className="p-3 font-mono font-bold text-ink-500 dark:text-slate-400">{row.rank}</td>
                      <td className="p-3 font-bold text-brand-800 dark:text-signal-400">{row.name}</td>
                      <td className="p-3 font-mono">{row.water}</td>
                      <td className="p-3 font-mono">{row.gdp}</td>
                      <td className="p-3 font-mono">{row.satisfaction}</td>
                      <td className="p-3">
                        <span className={`chip ${row.color}`}>{row.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeAnalysisTab === 'trends' && (
          <div className="flex flex-col gap-4 animate-fade-in text-right text-xs leading-relaxed text-ink-500 dark:text-slate-300">
            <h4 className="font-black text-brand-800 dark:text-signal-400 text-sm">پیوند رویدادهای سیاستی با روندهای زمانی شاخص</h4>
            <p>
              مدل زیر همبستگی تاریخی تلاقی قوانین ابلاغی بودجه ملی با مهار بحران‌های سرزمینی را نشان می‌دهد. هر پین حاکی از یک رویداد سیاستی کلان است.
            </p>

            {/* Visual Timeline representation */}
            <div className="relative border-r-2 border-line dark:border-wall-700 pr-5 py-2.5 flex flex-col gap-6 font-medium mr-2">
              <div className="relative">
                <span className="absolute right-[-25px] top-1 size-3 rounded-full bg-danger border-2 border-surface dark:border-wall-900 shadow-[0_0_0_3px_rgba(229,72,77,0.2)]"></span>
                <span className="font-mono text-[10px] font-black text-brand-800 dark:text-signal-400">خرداد ۱۴۰۵ - هشدار ناترازی</span>
                <p className="text-[11px] text-ink-800 dark:text-slate-200 mt-1">ابلاغ اعتبار و بازبینی اضطراری ردیف‌های پتروشیمی قطرویه به علت تله منابع طبیعی و نقض EPI.</p>
              </div>

              <div className="relative">
                <span className="absolute right-[-25px] top-1 size-3 rounded-full bg-brand-800 border-2 border-surface dark:border-wall-900 shadow-[0_0_0_3px_rgba(30,72,65,0.15)]"></span>
                <span className="font-mono text-[10px] font-black text-brand-800 dark:text-signal-400">بهمن ۱۴۰۴ - آغاز طرح کرشمه</span>
                <p className="text-[11px] text-ink-800 dark:text-slate-200 mt-1">تخصیص ۹۲۰ میلیارد تومان نقدینگی برای تجهیز مزارع پسته و انجیر به سناتورهای هوشمند رطوبت خاکی.</p>
              </div>

              <div className="relative">
                <span className="absolute right-[-25px] top-1 size-3 rounded-full bg-info border-2 border-surface dark:border-wall-900 shadow-[0_0_0_3px_rgba(59,130,246,0.2)]"></span>
                <span className="font-mono text-[10px] font-black text-brand-800 dark:text-signal-400">آبان ۱۴۰۴ - یونسکو گلیم نی‌ریز</span>
                <p className="text-[11px] text-ink-800 dark:text-slate-200 mt-1">ثبت جهانی برند گلیم‌بافی و راه‌اندازی آکادمی چندسویه مهارتی یونسکو در بخش پشتکوه.</p>
              </div>
            </div>
          </div>
        )}

        {activeAnalysisTab === 'flows' && (
          <div className="flex flex-col gap-4 animate-fade-in text-right text-xs leading-relaxed text-ink-500 dark:text-slate-300">
            <h4 className="font-black text-brand-800 dark:text-signal-400 text-sm">جریان‌های ترانزیتی و بودجه‌ای</h4>
            <p>
              دریافت‌ها، مصارف و رانش بودجه‌ای بین استان‌های فارس، تهران، اصفهان، هرمزگان و مرزهای صادراتی کرومیت قطرویه:
            </p>

            {/* Sankey Simulation inside custom styled divs */}
            <div className="p-4 bg-paper dark:bg-wall-950/60 rounded-xl border border-line dark:border-wall-700 flex flex-col gap-3 font-mono text-[10px]">
              <div className="flex justify-between text-slate-400 font-bold">
                <span>مبادی منابع</span>
                <span>مقاصد میانی</span>
                <span>مصرف نهایی</span>
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span>صادرات کرومیت (۱۴۵M$)</span>
                  <span className="text-[#10B981]">══ 82% ══▶</span>
                  <span>کارخانه‌های یزد (۱۱۹M$)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>بودجه ملی عمرانی (۴۲۰M$)</span>
                  <span className="text-brand-800 dark:text-signal-400">══ 15% ══▶</span>
                  <span>توسعه فیبر نوری پشتکوه (۶۳M$)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>حق‌آبه زیست‌محیطی بختگان (۶۰M$)</span>
                  <span className="text-danger">══ 58% ══▶</span>
                  <span>تبخیر دشت شور (۳۴.۸M$)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeAnalysisTab === 'policies' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-right animate-fade-in leading-relaxed text-ink-500 dark:text-slate-300">
            <div className="p-4 bg-paper dark:bg-wall-950/60 border border-line dark:border-wall-700 rounded-xl flex flex-col gap-2 transition-all hover:shadow-[var(--shadow-card-hover)]">
              <span className="font-black text-brand-800 dark:text-signal-400 block text-sm">شاخص تحقق سیاست مهار خام‌فروشی</span>
              <p>روند پیشرفت انتقال فرآوری مواد معدنی از کلوخه سنگ کرومیت خام به آلیاژهای پیشرفته فروکروم:</p>
              <div className="flex items-baseline gap-1 mt-1 font-mono text-xl font-extrabold text-brand-800 dark:text-signal-400">
                <span>۷۳٪</span>
                <span className="text-[10px] text-ink-400 font-bold">میزان تحقق</span>
              </div>
              <div className="w-full bg-line dark:bg-wall-800 h-2.5 rounded-full overflow-hidden">
                <div className="bg-brand-800 dark:bg-signal-400 h-full rounded-full transition-all duration-500" style={{ width: '73%' }} />
              </div>
            </div>

            <div className="p-4 bg-paper dark:bg-wall-950/60 border border-line dark:border-wall-700 rounded-xl flex flex-col gap-2 transition-all hover:shadow-[var(--shadow-card-hover)]">
              <span className="font-black text-brand-800 dark:text-signal-400 block text-sm">شاخص پایداری و تاب‌آوری خاک دشت</span>
              <p>طرح انسداد چاه‌های غیرمجاز آب جهاد کشاورزی و مهار رانش به ازای اهداف قانون ۵ ساله توسعه متوازن:</p>
              <div className="flex items-baseline gap-1 mt-1 font-mono text-xl font-extrabold text-danger">
                <span>۴۵٪</span>
                <span className="text-[10px] text-ink-400 font-bold">کاهش رانش دشت</span>
              </div>
              <div className="w-full bg-line dark:bg-wall-800 h-2.5 rounded-full overflow-hidden">
                <div className="bg-danger h-full rounded-full transition-all duration-500" style={{ width: '45%' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 11: KPI BREAKDOWN EXPLORER DRAWER (Sliding Panel from Right) */}
      {selectedKPI && (
        <div className="fixed inset-0 bg-wall-950/50 backdrop-blur-sm z-[999] flex justify-end animate-fade-in">
          <div className="w-full max-w-xl bg-surface dark:bg-wall-900 h-full overflow-y-auto shadow-[var(--shadow-pop)] p-6 text-right flex flex-col gap-6 text-xs relative border-r border-line dark:border-wall-700">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4 border-line dark:border-wall-700">
              <div className="flex items-center gap-3">
                <div className="icon-tile size-10">
                  <Maximize2 size={20} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-sm font-black text-ink-800 dark:text-slate-100">کاوشگر شکست شاخص: {selectedKPI.name}</h3>
                  <span className="text-[10px] text-ink-400">مجموعه ساختار شکست و سهم انحراف از هدف</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedKPI(null)}
                className="w-8 h-8 rounded-full hover:bg-brand-50 dark:hover:bg-wall-800 flex items-center justify-center text-ink-300 hover:text-ink-700 dark:text-slate-500 cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Passport Indicator (Data Passport) */}
            <div className="p-3.5 bg-paper dark:bg-wall-950/60 border border-line dark:border-wall-700 rounded-2xl flex flex-col gap-1.5 font-medium leading-relaxed text-ink-500 dark:text-slate-300">
              <span className="font-bold text-brand-800 dark:text-signal-400 text-[11px] block">شناسنامه پایش داده:</span>
              <p className="text-[11px]">منبع داده: {selectedKPI.source}</p>
              <div className="flex items-center justify-between text-[10px] font-mono mt-1 border-t pt-1.5 border-line dark:border-wall-700">
                <span>تأخیر پایش: کمتر از ۲۴ ساعت</span>
                <span>ضریب پایداری: {selectedKPI.confidence}٪</span>
              </div>
            </div>

            {/* 11.1 Sunburst interactive visual (multi-layered radial representation) */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-brand-800 dark:text-signal-400 text-[11px]">۱. ساختار خورشیدی سلسه‌مراتب وزندار</span>
                <span className="text-[9px] text-ink-300">انیمیشن فازی ۳ لایه</span>
              </div>

              {/* Sunburst Simulation Circle */}
              <div className="w-full flex items-center justify-center py-6 bg-paper dark:bg-wall-950/60 rounded-2xl border border-line/70 dark:border-wall-700 relative">
                <div className="w-48 h-48 rounded-full border-8 border-brand-800/15 dark:border-signal-400/15 flex items-center justify-center relative hover:scale-[1.02] transition-transform duration-300">
                  {/* Layer 2 ring simulation */}
                  <div className="absolute inset-4 rounded-full border-[10px] border-ok/25 dark:border-ok/20 flex items-center justify-center">
                    {/* Layer 3 ring simulation */}
                    <div className="absolute inset-4 rounded-full border-[12px] border-warn/30 dark:border-warn/25 flex items-center justify-center">
                      {/* Center Core */}
                      <div className="w-14 h-14 bg-gradient-to-br from-brand-800 to-brand-950 text-signal-400 rounded-full flex flex-col items-center justify-center font-mono text-center shadow-[var(--shadow-card)]">
                        <span className="text-[9px] font-bold">هدف</span>
                        <span className="text-xs font-black">{selectedKPI.target}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-3 right-3 flex flex-col gap-1 text-[9px] font-bold text-ink-400">
                  <span className="text-brand-800 dark:text-signal-400 flex items-center gap-1">● لایه ۱: حوزه کلان</span>
                  <span className="text-ok flex items-center gap-1">● لایه ۲: مولفه عملیاتی</span>
                  <span className="text-warn flex items-center gap-1">● لایه ۳: توزیع جغرافیایی</span>
                </div>
              </div>
            </div>

            {/* 11.2 Contribution Waterfall Chart (آبشار سهم) */}
            <div className="flex flex-col gap-3">
              <span className="font-extrabold text-brand-800 dark:text-signal-400 text-[11px]">۲. نمودار آبشاری سهم مؤلفه‌ها</span>
              
              <div className="p-4 bg-paper dark:bg-wall-950/60 rounded-2xl border border-line/70 dark:border-wall-700 flex flex-col gap-3 font-medium">
                <p className="text-[10px] text-ink-400 dark:text-slate-400">مثبت/منفی بودن سهم هر زیرمؤلفه در تغییر امتیاز {selectedKPI.name}:</p>
                
                <div className="flex flex-col gap-2.5">
                  {[
                    { name: 'اعتبارات مستقیم خزانه کل', change: '+۱۲.۵٪', type: 'positive', width: '75%' },
                    { name: 'تجهیزات و سنسورهای رطوبت مزارع', change: '+۸.۲٪', type: 'positive', width: '58%' },
                    { name: 'اضافه‌برداشت و افت تراز هیدرولوژیک', change: '-۱۵.۴٪', type: 'negative', width: '92%' },
                    { name: 'مهاجرت نخبگان و شکاف کارگزاران', change: '-۴.۲٪', type: 'negative', width: '35%' }
                  ].map((f, idx) => (
                    <div key={idx} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold">{f.name}</span>
                        <span className={`font-mono font-black ${f.type === 'positive' ? 'text-ok' : 'text-danger'}`}>{f.change}</span>
                      </div>
                      <div className="w-full bg-line dark:bg-wall-800 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${f.type === 'positive' ? 'bg-ok' : 'bg-danger'} transition-all duration-500`}
                          style={{ width: f.width }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Causal DAG or other representation explanation */}
            <div className="p-3 bg-warn-soft/50 dark:bg-warn-700/10 border border-warn/30 dark:border-warn-700/30 rounded-xl leading-relaxed text-warn-700 dark:text-warn-soft">
              <strong>توصیه مداخله علّی دیوان:</strong> در صورت تزریق اضطراری منابع به لایه سنسورهای رطوبتی، نرخ انحراف این شاخص از هدف ۴.۵ درصد تنزل می‌یابد.
            </div>

          </div>
        </div>
      )}

      {/* KPI Breakdown Explorer Sliding Drawer */}
      <KPIBreakdownExplorer 
        kpi={breakdownKPI} 
        isOpen={isBreakdownOpen} 
        onClose={() => setIsBreakdownOpen(false)} 
      />

    </div>
  );
}
