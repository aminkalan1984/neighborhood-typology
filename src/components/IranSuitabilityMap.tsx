import React, { useState, useMemo, useEffect } from 'react';
import { PortfolioProject } from '../data/portfolioData';
import { IRAN_PROVINCES, IRAN_WATERS, IRAN_VIEWBOX, getPathBBox, getPathLabelAnchor, IRAN_VIEWBOX_WIDTH, IRAN_VIEWBOX_HEIGHT } from '../data/iranProvincePaths';
import { 
  Layers, 
  MapPin, 
  Eye, 
  Filter, 
  AlertTriangle, 
  Sparkles, 
  Info, 
  CheckCircle2, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  Sliders,
  Maximize2,
  Minimize2
} from 'lucide-react';

// آستانه‌های مساحت bbox (بر حسب واحد viewBox): زیر آن، نام استان فشرده می‌شود و درصدمخفی
// می‌شود تا برچسب‌های استان‌های کوچک قلب نقشه (قم، البرز، تهران و…) روی هم نیفتند.
const PROVINCE_AREA_PCT_THRESHOLD = 15000;
const PROVINCE_AREA_NAME_THRESHOLD = 8500;

interface IranSuitabilityMapProps {
  projects: PortfolioProject[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  isEquityGapActive?: boolean;
}

export interface ProvinceSuitability {
  id: string;
  name: string;
  code: string;
  path: string;
  labelPoint: { x: number; y: number };
  suitabilityScore: number; // 0 - 100 (امتیاز انطباق / شایستگی)
  needScore: number; // 0 - 100
  isHighNeedWithoutProject: boolean; // پرنیاز بدون پروژه (هاشور قرمز)
  projectCount: number;
  totalBudgetM: number;
  topNeedCategory: string;
}

// دادهٔ سازگاری/نیاز ۳۱ استان — مسیرهای این آرایه دیگر برای رندر استفاده نمی‌شوند
// (مسیر واقعی هر استان از IRAN_PROVINCES در runtime به آن الحاق می‌شود)
export const PROVINCES_MAP_DATA: ProvinceSuitability[] = [
  {
    id: 'SIV',
    name: 'سیستان و بلوچستان',
    code: '31',
    path: 'M 700 370 L 820 390 L 870 510 L 820 630 L 730 620 L 680 520 L 660 440 Z',
    labelPoint: { x: 760, y: 500 },
    suitabilityScore: 32,
    needScore: 94,
    isHighNeedWithoutProject: true,
    projectCount: 1,
    totalBudgetM: 380,
    topNeedCategory: 'تنش شدید آبی و زیرساخت مرزی'
  },
  {
    id: 'HOR',
    name: 'هرمزگان',
    code: '22',
    path: 'M 540 520 L 680 520 L 730 620 L 610 650 L 520 590 Z',
    labelPoint: { x: 610, y: 580 },
    suitabilityScore: 78,
    needScore: 76,
    isHighNeedWithoutProject: false,
    projectCount: 2,
    totalBudgetM: 1100,
    topNeedCategory: 'ترانزیت و شیرین‌سازی آب'
  },
  {
    id: 'KER',
    name: 'کرمان',
    code: '15',
    path: 'M 570 380 L 700 370 L 680 520 L 540 520 Z',
    labelPoint: { x: 620, y: 440 },
    suitabilityScore: 48,
    needScore: 88,
    isHighNeedWithoutProject: true,
    projectCount: 1,
    totalBudgetM: 380,
    topNeedCategory: 'افت سفره زیرزمینی و معدن'
  },
  {
    id: 'SKH',
    name: 'خراسان جنوبی',
    code: '29',
    path: 'M 650 250 L 780 230 L 800 370 L 700 370 L 610 320 Z',
    labelPoint: { x: 710, y: 300 },
    suitabilityScore: 41,
    needScore: 89,
    isHighNeedWithoutProject: true,
    projectCount: 0,
    totalBudgetM: 0,
    topNeedCategory: 'خشکسالی و مهاجرت روستایی'
  },
  {
    id: 'KHR',
    name: 'خراسان رضوی',
    code: '09',
    path: 'M 620 125 L 750 110 L 820 190 L 780 230 L 650 250 L 590 190 Z',
    labelPoint: { x: 700, y: 170 },
    suitabilityScore: 72,
    needScore: 81,
    isHighNeedWithoutProject: false,
    projectCount: 2,
    totalBudgetM: 870,
    topNeedCategory: 'تنش آبی مشهد و سرمایه اجتماعی'
  },
  {
    id: 'NKH',
    name: 'خراسان شمالی',
    code: '28',
    path: 'M 550 90 L 660 80 L 620 125 L 590 190 L 530 140 Z',
    labelPoint: { x: 590, y: 125 },
    suitabilityScore: 58,
    needScore: 71,
    isHighNeedWithoutProject: true,
    projectCount: 0,
    totalBudgetM: 0,
    topNeedCategory: 'تکمیل شبکه آبرسانی و راه‌آهن'
  },
  {
    id: 'FAR',
    name: 'فارس',
    code: '07',
    path: 'M 430 430 L 570 380 L 540 520 L 520 590 L 400 520 Z',
    labelPoint: { x: 470, y: 480 },
    suitabilityScore: 82,
    needScore: 79,
    isHighNeedWithoutProject: false,
    projectCount: 1,
    totalBudgetM: 520,
    topNeedCategory: 'فرونشست دشت مرودشت و کشاورزی'
  },
  {
    id: 'BSH',
    name: 'بوشهر',
    code: '18',
    path: 'M 360 480 L 430 430 L 400 520 L 350 540 Z',
    labelPoint: { x: 380, y: 500 },
    suitabilityScore: 88,
    needScore: 77,
    isHighNeedWithoutProject: false,
    projectCount: 1,
    totalBudgetM: 950,
    topNeedCategory: 'توسعه انرژی و شیرین‌سازی آب'
  },
  {
    id: 'KHZ',
    name: 'خوزستان',
    code: '06',
    path: 'M 270 380 L 360 380 L 430 430 L 360 480 L 260 440 Z',
    labelPoint: { x: 330, y: 420 },
    suitabilityScore: 39,
    needScore: 92,
    isHighNeedWithoutProject: false,
    projectCount: 1,
    totalBudgetM: 850,
    topNeedCategory: 'کیفیت آب کارون و آلودگی هوا'
  },
  {
    id: 'KHB',
    name: 'کهگیلویه و بویراحمد',
    code: '25',
    path: 'M 360 380 L 430 380 L 430 430 L 360 430 Z',
    labelPoint: { x: 390, y: 400 },
    suitabilityScore: 52,
    needScore: 84,
    isHighNeedWithoutProject: true,
    projectCount: 0,
    totalBudgetM: 0,
    topNeedCategory: 'محرومیت روستایی و راه‌های کوهستانی'
  },
  {
    id: 'CHB',
    name: 'چهارمحال و بختیاری',
    code: '14',
    path: 'M 340 330 L 410 320 L 430 380 L 360 380 Z',
    labelPoint: { x: 380, y: 350 },
    suitabilityScore: 61,
    needScore: 78,
    isHighNeedWithoutProject: false,
    projectCount: 0,
    totalBudgetM: 0,
    topNeedCategory: 'مدیریت سرچشمه‌های آب'
  },
  {
    id: 'ISF',
    name: 'اصفهان',
    code: '04',
    path: 'M 380 250 L 510 240 L 570 380 L 430 430 L 340 330 L 380 250 Z',
    labelPoint: { x: 440, y: 310 },
    suitabilityScore: 74,
    needScore: 89,
    isHighNeedWithoutProject: false,
    projectCount: 2,
    totalBudgetM: 1250,
    topNeedCategory: 'فرونشست زاینده‌رود و آلودگی صنعت'
  },
  {
    id: 'YAZ',
    name: 'یزد',
    code: '21',
    path: 'M 510 240 L 610 320 L 570 380 L 430 380 L 510 240 Z',
    labelPoint: { x: 530, y: 310 },
    suitabilityScore: 85,
    needScore: 86,
    isHighNeedWithoutProject: false,
    projectCount: 1,
    totalBudgetM: 620,
    topNeedCategory: 'انتقال آب خلیج فارس و خورشیدی'
  },
  {
    id: 'SEM',
    name: 'سمنان',
    code: '20',
    path: 'M 450 140 L 590 190 L 650 250 L 510 240 L 420 180 Z',
    labelPoint: { x: 510, y: 190 },
    suitabilityScore: 68,
    needScore: 82,
    isHighNeedWithoutProject: false,
    projectCount: 0,
    totalBudgetM: 0,
    topNeedCategory: 'تأمین آب صنعتی و کویرزدایی'
  },
  {
    id: 'TEH',
    name: 'تهران',
    code: '00',
    path: 'M 370 145 L 420 140 L 420 180 L 360 185 Z',
    labelPoint: { x: 390, y: 160 },
    suitabilityScore: 91,
    needScore: 83,
    isHighNeedWithoutProject: false,
    projectCount: 3,
    totalBudgetM: 2400,
    topNeedCategory: 'حمل‌ونقل عمومی و فرونشست جنوب'
  },
  {
    id: 'ALB',
    name: 'البرز',
    code: '30',
    path: 'M 345 140 L 370 145 L 360 185 L 340 180 Z',
    labelPoint: { x: 355, y: 160 },
    suitabilityScore: 80,
    needScore: 81,
    isHighNeedWithoutProject: false,
    projectCount: 1,
    totalBudgetM: 320,
    topNeedCategory: 'ترافیک کرج و حاشیه‌نشینی'
  },
  {
    id: 'QOM',
    name: 'قم',
    code: '26',
    path: 'M 360 185 L 420 180 L 380 250 L 340 230 Z',
    labelPoint: { x: 370, y: 210 },
    suitabilityScore: 76,
    needScore: 84,
    isHighNeedWithoutProject: false,
    projectCount: 1,
    totalBudgetM: 410,
    topNeedCategory: 'افت آب دریاچه نمک'
  },
  {
    id: 'MRK',
    name: 'مرکزی',
    code: '05',
    path: 'M 300 200 L 360 185 L 340 230 L 380 250 L 340 330 L 280 280 Z',
    labelPoint: { x: 320, y: 250 },
    suitabilityScore: 79,
    needScore: 78,
    isHighNeedWithoutProject: false,
    projectCount: 1,
    totalBudgetM: 350,
    topNeedCategory: 'نوسازی آلودگی صنایع اراک'
  },
  {
    id: 'HAM',
    name: 'همدان',
    code: '13',
    path: 'M 240 190 L 300 200 L 280 280 L 230 260 Z',
    labelPoint: { x: 260, y: 230 },
    suitabilityScore: 84,
    needScore: 71,
    isHighNeedWithoutProject: false,
    projectCount: 1,
    totalBudgetM: 290,
    topNeedCategory: 'تأمین آب پایدار شهر همدان'
  },
  {
    id: 'KRM',
    name: 'کرمانشاه',
    code: '17',
    path: 'M 170 210 L 240 190 L 230 260 L 160 270 Z',
    labelPoint: { x: 200, y: 235 },
    suitabilityScore: 62,
    needScore: 86,
    isHighNeedWithoutProject: false,
    projectCount: 1,
    totalBudgetM: 450,
    topNeedCategory: 'اشتغال مرزی و بازسازی زیرساخت'
  },
  {
    id: 'ILM',
    name: 'ایلام',
    code: '16',
    path: 'M 160 270 L 230 260 L 270 380 L 190 340 Z',
    labelPoint: { x: 210, y: 310 },
    suitabilityScore: 59,
    needScore: 82,
    isHighNeedWithoutProject: true,
    projectCount: 0,
    totalBudgetM: 0,
    topNeedCategory: 'زیرساخت اربعین و گاز مهران'
  },
  {
    id: 'LUR',
    name: 'لرستان',
    code: '19',
    path: 'M 230 260 L 280 280 L 340 330 L 270 380 Z',
    labelPoint: { x: 270, y: 310 },
    suitabilityScore: 66,
    needScore: 80,
    isHighNeedWithoutProject: false,
    projectCount: 1,
    totalBudgetM: 220,
    topNeedCategory: 'کنترل سیلاب و راه‌آهن خرم‌آباد'
  },
  {
    id: 'KRD',
    name: 'کردستان',
    code: '12',
    path: 'M 150 140 L 220 130 L 240 190 L 170 210 Z',
    labelPoint: { x: 190, y: 170 },
    suitabilityScore: 69,
    needScore: 76,
    isHighNeedWithoutProject: false,
    projectCount: 1,
    totalBudgetM: 310,
    topNeedCategory: 'بازارچه‌های مرزی و آب سنندج'
  },
  {
    id: 'ZAN',
    name: 'زنجان',
    code: '11',
    path: 'M 220 100 L 290 100 L 300 150 L 220 130 Z',
    labelPoint: { x: 260, y: 120 },
    suitabilityScore: 83,
    needScore: 68,
    isHighNeedWithoutProject: false,
    projectCount: 1,
    totalBudgetM: 190,
    topNeedCategory: 'صنایع روی و فرآوری معدن'
  },
  {
    id: 'QAZ',
    name: 'قزوین',
    code: '27',
    path: 'M 290 100 L 345 140 L 340 180 L 300 150 Z',
    labelPoint: { x: 320, y: 140 },
    suitabilityScore: 86,
    needScore: 72,
    isHighNeedWithoutProject: false,
    projectCount: 1,
    totalBudgetM: 280,
    topNeedCategory: 'دشت قزوین و انرژی خورشیدی'
  },
  {
    id: 'GIL',
    name: 'گیلان',
    code: '01',
    path: 'M 260 60 L 350 70 L 345 140 L 290 100 Z',
    labelPoint: { x: 310, y: 90 },
    suitabilityScore: 92,
    needScore: 52,
    isHighNeedWithoutProject: false,
    projectCount: 1,
    totalBudgetM: 340,
    topNeedCategory: 'پسماند انزلی و راه‌آهن رشت-کاسپین'
  },
  {
    id: 'MAZ',
    name: 'مازندران',
    code: '02',
    path: 'M 350 70 L 460 80 L 450 140 L 345 140 Z',
    labelPoint: { x: 400, y: 105 },
    suitabilityScore: 89,
    needScore: 58,
    isHighNeedWithoutProject: false,
    projectCount: 1,
    totalBudgetM: 410,
    topNeedCategory: 'مدیریت پسماند سواحل و آزادراه'
  },
  {
    id: 'GOL',
    name: 'گلستان',
    code: '27',
    path: 'M 460 80 L 550 90 L 530 140 L 450 140 Z',
    labelPoint: { x: 495, y: 110 },
    suitabilityScore: 75,
    needScore: 69,
    isHighNeedWithoutProject: false,
    projectCount: 1,
    totalBudgetM: 230,
    topNeedCategory: 'علاج‌بخشی خلیج گرگان'
  },
  {
    id: 'ARD',
    name: 'اردبیل',
    code: '24',
    path: 'M 210 30 L 260 60 L 220 100 L 180 80 Z',
    labelPoint: { x: 215, y: 65 },
    suitabilityScore: 81,
    needScore: 62,
    isHighNeedWithoutProject: false,
    projectCount: 1,
    totalBudgetM: 260,
    topNeedCategory: 'پایانه مغان و راه پارس‌آباد'
  },
  {
    id: 'EAZ',
    name: 'آذربایجان شرقی',
    code: '03',
    path: 'M 140 40 L 210 30 L 180 80 L 220 100 L 150 140 Z',
    labelPoint: { x: 175, y: 80 },
    suitabilityScore: 87,
    needScore: 68,
    isHighNeedWithoutProject: false,
    projectCount: 1,
    totalBudgetM: 490,
    topNeedCategory: 'احیای دریاچه ارومیه و قطار تبریز'
  },
  {
    id: 'WAZ',
    name: 'آذربایجان غربی',
    code: '08',
    path: 'M 80 50 L 140 40 L 150 140 L 110 180 Z',
    labelPoint: { x: 120, y: 100 },
    suitabilityScore: 71,
    needScore: 77,
    isHighNeedWithoutProject: false,
    projectCount: 1,
    totalBudgetM: 360,
    topNeedCategory: 'حوزه آبریز ارومیه و مرز تمرچین'
  }
];

export default function IranSuitabilityMap({
  projects,
  selectedProjectId,
  onSelectProject,
  isEquityGapActive = true
}: IranSuitabilityMapProps) {
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [showHatching, setShowHatching] = useState<boolean>(isEquityGapActive);
  const [showProjectPins, setShowProjectPins] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [hoveredProvince, setHoveredProvince] = useState<ProvinceSuitability | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number } | null>(null);
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

  // الحاق مسیرها، مساحت و لنگرگاه واقعی برچسب هر استان (مرکز سطح داخل چندضلعی)
  const realProvinces = useMemo(() => {
    return PROVINCES_MAP_DATA
      .map((s) => {
        const rp = IRAN_PROVINCES.find((p) => p.fa === s.name);
        if (!rp) return null;
        const b = getPathBBox(rp.d);
        const area = (b.maxX - b.minX) * (b.maxY - b.minY);
        return { ...s, path: rp.d, labelPoint: getPathLabelAnchor(rp.d), bboxArea: area };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, []);

  // Helper function to return suitability gradient color based on score (0 - 100)
  const getSuitabilityColor = (score: number, isHatched: boolean) => {
    if (!showHeatmap) {
      return isHatched && showHatching ? 'url(#red-hatch)' : '#F1F5F9';
    }

    let baseColor = '#EF4444'; // Low suitability / High gap (Red)
    if (score >= 85) baseColor = '#10B981'; // Excellent suitability (Emerald)
    else if (score >= 72) baseColor = '#3B82F6'; // Good suitability (Blue)
    else if (score >= 60) baseColor = '#F59E0B'; // Moderate (Amber)
    else if (score >= 45) baseColor = '#F97316'; // High gap (Orange)

    return baseColor;
  };

  return (
    <div
      className={`flex flex-col gap-3 w-full font-sans select-none text-right transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 bg-paper px-4 py-3 overflow-y-auto' : ''
      }`}
    >
      
      {/* Map Interactive Toolbar */}
      <div className="p-3 bg-surface border border-line rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-brand-800" />
          <span className="font-extrabold text-ink-800">لایه‌های نقشه آمایش و انطباق سرزمینی (O/T/N HeatMap):</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
              showHeatmap 
                ? 'bg-brand-800 text-signal-400 border-brand-800' 
                : 'bg-surface text-ink-700 border-line-strong hover:bg-paper'
            }`}
          >
            <Eye size={13} />
            <span>لایه حرارتی انطباق ({showHeatmap ? 'فعال' : 'خاموش'})</span>
          </button>

          <button
            onClick={() => setShowHatching(!showHatching)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
              showHatching 
                ? 'bg-brand-900 text-brand-200 border-brand-900 shadow-xs' 
                : 'bg-surface text-ink-700 border-line-strong hover:bg-paper'
            }`}
          >
            <AlertTriangle size={13} className="text-brand-400" />
            <span>هاشور سرخ/بنفش محرومیت ({showHatching ? 'فعال' : 'خاموش'})</span>
          </button>

          <button
            onClick={() => setShowProjectPins(!showProjectPins)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
              showProjectPins 
                ? 'bg-brand-900 text-brand-100 border-brand-900' 
                : 'bg-surface text-ink-700 border-line-strong hover:bg-paper'
            }`}
          >
            <MapPin size={13} />
            <span>پین‌های پروژه‌ها ({showProjectPins ? 'فعال' : 'خاموش'})</span>
          </button>

          <button
            onClick={() => setShowLabels(!showLabels)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
              showLabels ? 'bg-line text-gray-800 border-line-strong' : 'bg-surface text-ink-400 border-line'
            }`}
          >
            برچسب استان‌ها
          </button>

          <span className="w-px h-5 bg-line" />

          <button
            onClick={() => setIsFullscreen((f) => !f)}
            aria-pressed={isFullscreen}
            aria-label={isFullscreen ? 'خروج از تمام‌صفحه' : 'نمایش تمام‌صفحه'}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
              isFullscreen
                ? 'bg-brand-800 text-signal-400 border-brand-800 shadow-md'
                : 'bg-surface text-ink-700 border-line-strong hover:bg-paper'
            }`}
            title={isFullscreen ? 'خروج از تمام‌صفحه (Esc)' : 'نمایش تمام‌صفحه'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span>{isFullscreen ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas Container — نقشهٔ کامل و دقیق ایران (همان پایهٔ داشبورد) */}
      <div
        className={`relative w-full rounded-2xl border border-line overflow-hidden shadow-inner transition-all duration-300 ${
          isFullscreen ? 'h-[calc(100vh-225px)] bg-paper' : 'bg-brand-100/30'
        }`}
      >
        <div
          className={`relative w-full mx-auto ${isFullscreen ? 'h-full' : 'max-w-4xl'}`}
          style={isFullscreen ? undefined : { aspectRatio: '1200 / 1070.6' }}
        >

        <svg viewBox={IRAN_VIEWBOX} className="absolute inset-0 w-full h-full drop-shadow-md select-none" preserveAspectRatio="xMidYMid meet">
          <defs>
            {/* Red Diagonal Hatch Pattern for Deprived Cells without projects */}
            <pattern 
              id="red-hatch" 
              patternUnits="userSpaceOnUse" 
              width="10" 
              height="10" 
              patternTransform="rotate(45)"
            >
              <rect width="10" height="10" fill="#EF4444" fillOpacity="0.15" />
              <line x1="0" y1="0" x2="0" y2="10" stroke="#DC2626" strokeWidth="3" opacity="0.85" />
            </pattern>

            {/* Combined Heatmap + Hatch Pattern */}
            <pattern 
              id="heat-red-hatch" 
              patternUnits="userSpaceOnUse" 
              width="10" 
              height="10" 
              patternTransform="rotate(45)"
            >
              <rect width="10" height="10" fill="#F87171" fillOpacity="0.4" />
              <line x1="0" y1="0" x2="0" y2="10" stroke="#991B1B" strokeWidth="3" opacity="0.9" />
            </pattern>
          </defs>

          {/* دریاها و جزایر واقعی نقشه */}
          {IRAN_WATERS.map((w) => (
            <path
              key={w.id}
              d={w.d}
              fill="#BFDFE8"
              stroke="#8FBCC9"
              strokeWidth={0.8}
              opacity={0.75}
            />
          ))}
          <text x="478" y="120" fill="#0284C7" fontSize="15" fontWeight="800" textAnchor="middle" opacity="0.7">دریای خزر</text>
          <text x="600" y="940" fill="#0284C7" fontSize="14" fontWeight="800" textAnchor="middle" opacity="0.7">خلیج فارس و دریای عمان</text>

          {/* Render 31 Provincial Polygons (مسیرهای واقعی) */}
          <g id="provinces-layer">
            {realProvinces.map((prov) => {
              const isHatched = prov.isHighNeedWithoutProject && showHatching;
              const isHovered = hoveredProvince?.id === prov.id;
              
              let fillValue = getSuitabilityColor(prov.suitabilityScore, prov.isHighNeedWithoutProject);
              if (isHatched && showHeatmap) {
                fillValue = 'url(#heat-red-hatch)';
              } else if (isHatched && !showHeatmap) {
                fillValue = 'url(#red-hatch)';
              }

              return (
                <path
                  key={prov.id}
                  d={prov.path}
                  fill={fillValue}
                  fillOpacity={showHeatmap ? 0.75 : 0.9}
                  stroke={isHovered ? '#1E4841' : '#FFFFFF'}
                  strokeWidth={isHovered ? '3.5' : '1.5'}
                  strokeLinejoin="round"
                  className="transition-all duration-150 cursor-pointer hover:opacity-100"
                  onMouseEnter={() => {
                    setHoveredProvince(prov);
                    // لنگرگاه تولتیپ: مرکز واقعی استان به درصد ابعاد کانتینر
                    setHoveredPoint({
                      x: (prov.labelPoint.x / IRAN_VIEWBOX_WIDTH) * 100,
                      y: (prov.labelPoint.y / IRAN_VIEWBOX_HEIGHT) * 100,
                    });
                  }}
                  onMouseLeave={() => {
                    setHoveredProvince(null);
                    setHoveredPoint(null);
                  }}
                />
              );
            })}
          </g>

          {/* Province Name & Score Labels — مختصات واقعی مرکز هر استان */}
          {showLabels && (
            <g id="labels-layer" pointerEvents="none">
              {realProvinces.map((prov) => {
                const showPct = showHeatmap && prov.bboxArea >= PROVINCE_AREA_PCT_THRESHOLD;
                return (
                  <g key={`lbl-${prov.id}`} transform={`translate(${prov.labelPoint.x}, ${prov.labelPoint.y})`}>
                    <text
                      textAnchor="middle"
                      fill="#0F172A"
                      fontSize={prov.bboxArea >= PROVINCE_AREA_NAME_THRESHOLD ? 14 : 9}
                      fontWeight="800"
                      className="drop-shadow-xs"
                      style={{ textShadow: '0px 0px 3px rgba(255,255,255,0.95)' }}
                    >
                      {prov.name}
                    </text>
                    {showPct && (
                      <text
                        y="15"
                        textAnchor="middle"
                        fill="#1E4841"
                        fontSize="10.5"
                        fontWeight="bold"
                      >
                        {prov.suitabilityScore}٪
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* Render Project Markers/Pins on top of Provinces */}
          {showProjectPins && (
            <g id="project-pins-layer">
              {projects.map((proj) => {
                // Map project location to province coordinates (لنگرگاه واقعی مرکز استان)
                const matchedProv = realProvinces.find(p => p.name.includes(proj.province) || proj.province.includes(p.name));
                const coords = matchedProv ? matchedProv.labelPoint : { x: 600, y: 535 };
                
                const isSelected = selectedProjectId === proj.id;

                return (
                  <g 
                    key={`pin-${proj.id}`} 
                    transform={`translate(${coords.x}, ${coords.y - (showHeatmap && showLabels ? 26 : 17)})`}
                    className="cursor-pointer transition-transform hover:scale-125"
                    onClick={() => onSelectProject(proj.id)}
                  >
                    {/* Pulsing ring if selected */}
                    {isSelected && (
                      <circle r="24" fill={proj.dimensionColor} opacity="0.35" className="animate-ping" />
                    )}

                    {/* Marker Background */}
                    <circle 
                      r="15" 
                      fill={proj.dimensionColor} 
                      stroke="#FFFFFF" 
                      strokeWidth="2.5" 
                      className="shadow-md"
                    />

                    {/* Dollar symbol or budget text */}
                    <text 
                      textAnchor="middle" 
                      dy="4.5" 
                      fill="#FFFFFF" 
                      fontSize="10.5" 
                      fontWeight="900"
                      fontFamily="monospace"
                    >
                      ${proj.budgetTotal}M
                    </text>
                  </g>
                );
              })}
            </g>
          )}
        </svg>

        {/* Hovered Province Detail Floating Card — لنگر شده روی مرکز استان تحت نشانگر */}
        {hoveredProvince && hoveredPoint && (
          <div
            className="absolute z-30 w-64 -translate-x-1/2 -translate-y-full bg-surface/95 backdrop-blur-md border border-line rounded-xl p-3 shadow-2xl flex flex-col gap-2 text-xs animate-fade-in pointer-events-none"
            style={{ left: `${hoveredPoint.x}%`, top: `${hoveredPoint.y}%`, marginTop: -16, pointerEvents: 'none' }}
          >
            <div className="flex items-center justify-between border-b border-line pb-1.5">
              <span className="font-extrabold text-brand-800 text-sm">{hoveredProvince.name}</span>
              <span className="font-mono text-[10px] text-ink-400 font-bold">کد: {hoveredProvince.code}</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 my-0.5">
              <div className="p-1.5 bg-brand-100 border border-signal-400 rounded-lg flex flex-col">
                <span className="text-[9.5px] text-ink-500">امتیاز انطباق و شایستگی:</span>
                <span className="text-sm font-black text-brand-800 font-mono">{hoveredProvince.suitabilityScore}٪</span>
              </div>
              <div className="p-1.5 bg-danger-soft border border-danger/40 rounded-lg flex flex-col">
                <span className="text-[9.5px] text-danger">شدت نیاز انباشته:</span>
                <span className="text-sm font-black text-danger font-mono">{hoveredProvince.needScore}٪</span>
              </div>
            </div>

            {hoveredProvince.isHighNeedWithoutProject && (
              <div className="p-1.5 bg-danger-soft/80 border border-danger/40 rounded-lg text-[10px] text-danger-700 font-bold flex items-center gap-1">
                <AlertTriangle size={12} className="text-danger shrink-0" />
                <span>منطقه پرنیاز فاقد پروژه (هاشور قرمز شکاف عدالت)</span>
              </div>
            )}

            <div className="text-[10.5px] text-ink-500 leading-tight">
              <span className="font-bold text-ink-800">نیاز اولویت‌دار: </span>
              <span>{hoveredProvince.topNeedCategory}</span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-ink-800 pt-1 border-t border-line">
              <span>پروژه‌های فعال سبد: <strong>{hoveredProvince.projectCount} مورد</strong></span>
              <span className="font-mono text-brand-800 font-bold">${hoveredProvince.totalBudgetM}M</span>
            </div>
          </div>
        )}

        {/* Legend Overlay at Bottom Right */}
        <div className="absolute bottom-4 right-4 z-20 bg-surface/95 backdrop-blur-md border border-line p-3 rounded-xl shadow-lg flex flex-col gap-2 text-[10.5px] text-ink-800">
          <span className="font-extrabold text-brand-800 border-b border-line pb-1">راهنمای نقشه و راهنمای لایه‌ها:</span>
          
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-16 h-3 rounded bg-gradient-to-l from-ok via-warn to-danger" />
              <span className="text-[9.5px] text-ink-500">طیف انطباق (از عالی تا بحرانی)</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border border-danger/60 bg-[url(#red-hatch)] bg-danger-soft" />
              <span className="text-[9.5px] text-danger font-bold">سلول پرنیازِ بدون پروژه (هاشور قرمز)</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-brand-800 border border-white" />
              <span className="text-[9.5px] text-ink-500">پروژه‌های مصوب سبد ملی</span>
            </div>
          </div>
        </div>
        </div>

      </div>
    </div>
  );
}
