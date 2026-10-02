export interface BudgetTransaction {
  id: string;
  name: string; // عنوان تخصیص بودجه
  category: string; // حوزه (بهداشت، امنیت، آموزش، زیرساخت)
  recipient: string; // وزارت‌خانه یا استانداری دریافت‌کننده
  amount: number; // مبلغ تخصیص (میلیون دلار)
  date: string; // تاریخ ثبت سند در دیوان محاسبات
  type: 'allocation' | 'withdrawal'; // تخصیص / برداشت
  status: 'approved' | 'rejected' | 'review'; // وضعیت سند (تأیید نهایی، رد شده، در حال بررسی)
}

export interface NationalProject {
  id: string;
  code?: string; // P-01 to N-05
  title: string; // عنوان پروژه راهبردی ملی
  category: 'energy' | 'digital' | 'infrastructure' | 'welfare' | 'cultural' | 'mining' | 'social'; // حوزه پروژه
  savedAmount: number; // بودجه جذب‌شده (میلیون دلار / میلیارد تومان)
  targetAmount: number; // کل بودجه مورد نیاز
  percentage: number; // درصد پیشرفت فیزیکی پروژه
  employment?: number; // تعداد اشتغال مستقیم
  fitScore?: number; // میانگین امتیاز انطباق (Fit Score)
  cellCode?: string; // سلول مادر (C31, C32, C33, etc.)
}

export interface GovernanceLog {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  role: string; // سمت سازمانی (استاندار، وزیر، اپراتور پایش)
  description: string; // شرح گزارش یا هشدار پایش هوشمند
  time: string; // زمان ثبت گزارش
  statusColor: string; // کد رنگی اولویت (سبز: پایدار، زرد: نیازمند پایش، قرمز: بحرانی)
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

// === NEW TYPES FOR THE 3D REGIONAL CUBE PLATFORM (ARA) ===

export interface CubeCell {
  code: string; // e.g. C11, C12, C13, C21, C22, C23, C31, C32, C33
  name: string; // e.g. شناخت × فرصت (شناخت فرصت)
  dimension: 'Sensing' | 'Reasoning' | 'Acting'; // بعد: شناخت، تحلیل، کنش
  side: 'Opportunity' | 'Talent' | 'Need'; // ضلع: فرصت، استعداد، نیاز
  score: number; // امتیاز بین 0.00 تا 1.00
  level: 'critical' | 'low' | 'mid' | 'high' | 'excellent'; // سطح بر اساس آستانه‌های فازی
  indicators: {
    name: string;
    value: string | number;
    unit: string;
    source: string;
  }[];
  conclusions?: string[]; // تحلیل یا خروجی‌های کاربست آزمایشی
}

export interface FrameworkCell {
  code: string; // e.g. X1S1 (شناخت × منابع طبیعی)
  dimension: 'Sensing' | 'Reasoning' | 'Acting'; // بعد: شناخت (X1)، تحلیل (X2)، کنش (X3)
  domain: 'natural' | 'economy' | 'social' | 'spatial' | 'governance'; // حوزه: S1 تا S5
  name: string; // نام سلول
  indicators: string[]; // شاخص‌های کلیدی
  source: string; // منبع یا روش
  value: string; // مقدار ثبت‌شده در نی‌ریز
}

export interface RegionInfo {
  code: string; // IR-FAR-NEY
  name: string; // شهرستان نی‌ریز
  province: string; // استان فارس
  level: string; // Z2 - شهرستان
  population: number; // ~155,000 نفر
  area: string; // 10,400 کیلومتر مربع
  climate: string; // کوهستان + دشت کشاورزی + کویر نمک
  features: string[]; // ویژگی‌های بارز (بختگان، کرومیت، انجیر، قشقایی)
}

// === REGIONAL PLANNING (ISGP MATCHING ENGINE) TYPES ===

export interface MatchCriterion {
  id: string;
  familyId: 'natural' | 'infra' | 'human' | 'economy' | 'legal' | 'equity';
  familyName: string;
  name: string;
  weight: number; // 0 - 100
  direction: 'max' | 'min'; // 'max': higher is better, 'min': lower is better
  isHardConstraint: boolean;
  hardConstraintThreshold?: number; // threshold value
  dataSource: string;
}

export interface MatchCandidate {
  id: string;
  cellCode: string;
  cellName: string;
  province: string;
  lat: number;
  lng: number;
  planId: string;
  planTitle: string;
  category: string;
  totalScore: number; // 0 - 100
  confidence: number; // 0 - 100
  scores: Record<string, number>; // criterionId -> score (0-100)
  isEliminated: boolean;
  eliminationReason?: string;
  blockers: {
    id: string;
    title: string;
    severity: 'high' | 'medium' | 'low';
    solution: string;
    complementaryProject?: string;
  }[];
  enablerScore: number;
  enablers: {
    id: string;
    title: string;
    cost: number; // million USD or Billion Tomans
    scoreBoost: number;
  }[];
  capitalNeeded: number; // million USD
  jobsCreated: number;
  waterImpact: string;
  timeToROI: string;
  evidence: {
    location: string;
    successRate: number;
    note: string;
  }[];
  spillovers: {
    targetCell: string;
    effect: string;
    strength: 'high' | 'med';
  }[];
}

export interface SupplyItem {
  id: string;
  title: string;
  owner: string; // e.g. "صندوق توسعه ملی", "هلدینگ مپنا", "بخش خصوصی"
  type: 'capital' | 'tech' | 'capacity' | 'expert' | 'incentive';
  value: string;
  capacityLimit: number;
  matchedDemandIds: string[];
}

export interface DemandItem {
  id: string;
  cellName: string;
  province: string;
  title: string;
  category: string;
  urgency: 'high' | 'medium' | 'critical';
  deprivationLevel: number; // 0 - 100
  requiredCapital: number;
  matchedSupplyIds: string[];
}

// === IRAN SVG MAP (استخراج‌شده از nastoohir/iran-map-svg) ===

export interface IranSVGProvince {
  id: string; // شناسهٔ لاتین (alborz, tehran, ...)
  fa: string; // نام فارسی استان
  kpi: string; // کد KPI موجود در داشبورد (ALB, TEH, ...)
  d: string; // مسیر SVG استان
}

export interface IranSVGWaters {
  id: string; // شناسه (caspian-sea, persian-gulf_3_, ...)
  d: string; // مسیر SVG دریا یا جزیره
}

