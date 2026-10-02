// ============================================================
// کاتالوگ ۴۰ شاخص اصلی الگوریتم (بخش ۴ سند)
// ۵ شاخص × ۸ سرمایه — هر شاخص: کد / نام / تعریف عملیاتی / منبع / جهت / نقش
// ============================================================
import type { AlgorithmIndicator, CapitalKey, ChainStage, IndicatorRole } from './types';

export const ALGORITHM_INDICATORS: AlgorithmIndicator[] = [
  // ═══════════════ سرمایه انسانی H ═══════════════
  {
    code: 'H1', capitalKey: 'H', name: 'سطح تحصیلات',
    operationalDefinition: 'درصد جمعیت ۲۵ سال و بیشتر با حداقل دیپلم',
    formula: 'جمعیت دیپلم به بالا ÷ کل جمعیت ۲۵+',
    source: 'سرشماری / پیمایش', direction: 'asc', chainStage: 'CAPACITY', role: 'capacity', reliability: 4,
  },
  {
    code: 'H2', capitalKey: 'H', name: 'مهارت قابل عرضه',
    operationalDefinition: 'درصد افراد دارای مهارت حرفه‌ای قابل استفاده',
    formula: 'افراد ماهر ÷ کل جمعیت فعال',
    source: 'پیمایش', direction: 'asc', chainStage: 'CAPACITY', role: 'capacity', reliability: 3,
  },
  {
    code: 'H3', capitalKey: 'H', name: 'اشتغال پایدار',
    operationalDefinition: 'شاغلان پایدار تقسیم بر جمعیت فعال',
    formula: 'شاغلان پایدار ÷ جمعیت فعال',
    source: 'پیمایش / تأمین اجتماعی', direction: 'asc', chainStage: 'OUTCOME', role: 'outcome', reliability: 4,
  },
  {
    code: 'H4', capitalKey: 'H', name: 'انطباق مهارت و شغل',
    operationalDefinition: 'شاغلان مرتبط با مهارت تقسیم بر شاغلان ماهر',
    formula: 'شاغلان مرتبط ÷ شاغلان ماهر',
    source: 'پیمایش', direction: 'asc', chainStage: 'CAPACITY', role: 'conversion', reliability: 3,
  },
  {
    code: 'H5', capitalKey: 'H', name: 'یادگیری مستمر',
    operationalDefinition: 'شرکت‌کنندگان در آموزش طی ۱۲ ماه تقسیم بر جمعیت ۱۵+',
    formula: 'شرکت‌کنندگان آموزش ÷ جمعیت ۱۵+',
    source: 'پیمایش / مراکز آموزشی', direction: 'asc', chainStage: 'OUTCOME', role: 'reproduction', reliability: 3,
  },

  // ═══════════════ سرمایه اجتماعی S ═══════════════
  {
    code: 'S1', capitalKey: 'S', name: 'اعتماد همسایگی',
    operationalDefinition: 'میانگین لیکرت اعتماد به ساکنان',
    formula: 'میانگین نمرات اعتماد (لیکرت ۱-۵)',
    source: 'پیمایش', direction: 'asc', chainStage: 'CAPACITY', role: 'capacity', reliability: 3,
  },
  {
    code: 'S2', capitalKey: 'S', name: 'تعلق محله‌ای',
    operationalDefinition: 'میانگین احساس تعلق',
    formula: 'میانگین نمرات تعلق (لیکرت ۱-۵)',
    source: 'پیمایش', direction: 'asc', chainStage: 'EXPERIENCE', role: 'experience', reliability: 3,
  },
  {
    code: 'S3', capitalKey: 'S', name: 'شبکه همکاری',
    operationalDefinition: 'درصد ساکنان دارای همکاری متقابل همسایگی',
    formula: 'ساکنان با همکاری متقابل ÷ کل ساکنان',
    source: 'پیمایش', direction: 'asc', chainStage: 'CAPACITY', role: 'capacity', reliability: 3,
  },
  {
    code: 'S4', capitalKey: 'S', name: 'اقدام جمعی',
    operationalDefinition: 'درصد مشارکت‌کنندگان در حل مسئله طی سال',
    formula: 'مشارکت‌کنندگان ÷ کل ساکنان',
    source: 'پیمایش', direction: 'asc', chainStage: 'USE', role: 'conversion', reliability: 3,
  },
  {
    code: 'S5', capitalKey: 'S', name: 'حل مسئله جمعی',
    operationalDefinition: 'مسائل حل‌شده مشارکتی تقسیم بر مسائل شناسایی‌شده',
    formula: 'مسائل حل‌شده ÷ مسائل شناسایی‌شده',
    source: 'پرونده پروژه / پیمایش', direction: 'asc', chainStage: 'OUTCOME', role: 'outcome', reliability: 3,
  },

  // ═══════════════ سرمایه اقتصادی E ═══════════════
  {
    code: 'E1', capitalKey: 'E', name: 'قدرت اقتصادی خانوار',
    operationalDefinition: 'درآمد معادل خانوار نسبت به میانه شهر',
    formula: 'درآمد معادل خانوار ÷ میانه درآمد شهر',
    source: 'پیمایش / داده رسمی', direction: 'asc', chainStage: 'CAPACITY', role: 'capacity', reliability: 4,
  },
  {
    code: 'E2', capitalKey: 'E', name: 'فرصت شغلی محلی',
    operationalDefinition: 'شغل به ازای ۱۰۰۰ نفر جمعیت فعال',
    formula: 'تعداد مشاغل ÷ (جمعیت فعال ÷ ۱۰۰۰)',
    source: 'GIS / اصناف', direction: 'asc', chainStage: 'CAPACITY', role: 'capacity', reliability: 3,
  },
  {
    code: 'E3', capitalKey: 'E', name: 'ماندگاری کسب‌وکار',
    operationalDefinition: 'کسب‌وکارهای فعال بیش از ۳ سال تقسیم بر کل',
    formula: 'کسب‌وکارهای ۳+ ساله ÷ کل کسب‌وکارها',
    source: 'اصناف', direction: 'asc', chainStage: 'OUTCOME', role: 'outcome', reliability: 3,
  },
  {
    code: 'E4', capitalKey: 'E', name: 'استطاعت مسکن',
    operationalDefinition: 'هزینه مسکن تقسیم بر درآمد خانوار',
    formula: 'هزینه مسکن ÷ درآمد خانوار',
    source: 'پیمایش / بازار', direction: 'desc', chainStage: 'ACCESS', role: 'equity', reliability: 4,
  },
  {
    code: 'E5', capitalKey: 'E', name: 'ماندگاری ارزش اقتصادی',
    operationalDefinition: 'سهم ارزش ایجادشده که در محله می‌ماند',
    formula: 'ارزش مانده در محله ÷ کل ارزش تولیدی',
    source: 'داده اقتصادی', direction: 'asc', chainStage: 'OUTCOME', role: 'reproduction', reliability: 3,
  },

  // ═══════════════ سرمایه کالبدی–زیرساختی P ═══════════════
  {
    code: 'P1', capitalKey: 'P', name: 'پایداری بنا',
    operationalDefinition: 'یک تقسیم بر سهم بناهای ناپایدار',
    formula: '۱ − (بناهای ناپایدار ÷ کل بناها)',
    source: 'GIS / پایگاه ساختمان', direction: 'asc', chainStage: 'CAPACITY', role: 'capacity', reliability: 4,
  },
  {
    code: 'P2', capitalKey: 'P', name: 'پیوستگی شبکه معابر',
    operationalDefinition: 'طول شبکه پیوسته تقسیم بر کل شبکه',
    formula: 'طول شبکه پیوسته ÷ کل شبکه',
    source: 'GIS', direction: 'asc', chainStage: 'CAPACITY', role: 'capacity', reliability: 4,
  },
  {
    code: 'P3', capitalKey: 'P', name: 'قابلیت استفاده فضای عمومی',
    operationalDefinition: 'امتیاز مشاهده‌ای کیفیت، نگهداری و حضورپذیری',
    formula: 'میانگین امتیازات مشاهده‌ای (۰-۱۰۰)',
    source: 'ممیزی میدانی', direction: 'asc', chainStage: 'USE', role: 'use', reliability: 3,
  },
  {
    code: 'P4', capitalKey: 'P', name: 'دسترسی خدمات پایه',
    operationalDefinition: 'جمعیت در شعاع استاندارد خدمت تقسیم بر کل',
    formula: 'جمعیت تحت پوشش ÷ کل جمعیت',
    source: 'GIS', direction: 'asc', chainStage: 'ACCESS', role: 'access', reliability: 4,
  },
  {
    code: 'P5', capitalKey: 'P', name: 'دسترسی حمل‌ونقل پایدار',
    operationalDefinition: 'سهم جمعیت برخوردار از حمل‌ونقل عمومی و پیاده‌پذیری',
    formula: 'جمعیت برخوردار ÷ کل جمعیت',
    source: 'GIS', direction: 'asc', chainStage: 'ACCESS', role: 'access', reliability: 4,
  },

  // ═══════════════ سرمایه طبیعی–محیطی N ═══════════════
  {
    code: 'N1', capitalKey: 'N', name: 'دسترسی به فضای سبز',
    operationalDefinition: 'جمعیت در فاصله پیاده مناسب تقسیم بر کل',
    formula: 'جمعیت در فاصله مناسب ÷ کل جمعیت',
    source: 'GIS', direction: 'asc', chainStage: 'ACCESS', role: 'access', reliability: 4,
  },
  {
    code: 'N2', capitalKey: 'N', name: 'پوشش سبز',
    operationalDefinition: 'درصد تاج درخت یا پوشش سبز قابل استفاده',
    formula: 'مساحت پوشش سبز ÷ کل مساحت',
    source: 'سنجش‌ازدور / GIS', direction: 'asc', chainStage: 'CAPACITY', role: 'capacity', reliability: 4,
  },
  {
    code: 'N3', capitalKey: 'N', name: 'کیفیت هوا',
    operationalDefinition: 'معکوس PM2.5 یا شاخص آلودگی',
    formula: '۱ − (PM2.5 مشاهده‌شده ÷ حداکثر استاندارد)',
    source: 'پایش محیطی', direction: 'asc', chainStage: 'OUTCOME', role: 'outcome', reliability: 4,
  },
  {
    code: 'N4', capitalKey: 'N', name: 'مواجهه با خطر',
    operationalDefinition: 'جمعیت واقع در پهنه خطر تقسیم بر کل',
    formula: 'جمعیت در پهنه خطر ÷ کل جمعیت',
    source: 'GIS', direction: 'desc', chainStage: 'CAPACITY', role: 'risk', reliability: 4,
  },
  {
    code: 'N5', capitalKey: 'N', name: 'تاب‌آوری اقلیمی',
    operationalDefinition: 'امتیاز ترکیبی گرما، آب‌گرفتگی، خشکسالی و ظرفیت پاسخ',
    formula: 'میانگین وزنی شاخص‌های تاب‌آوری',
    source: 'GIS / داده اقلیمی', direction: 'asc', chainStage: 'OUTCOME', role: 'reproduction', reliability: 3,
  },

  // ═══════════════ سرمایه فرهنگی–هویتی C ═══════════════
  {
    code: 'C1', capitalKey: 'C', name: 'دارایی فرهنگی',
    operationalDefinition: 'تعداد دارایی‌های فرهنگی به ازای ۱۰۰۰ نفر',
    formula: 'تعداد دارایی‌های فرهنگی ÷ (جمعیت ÷ ۱۰۰۰)',
    source: 'GIS / اسناد', direction: 'asc', chainStage: 'CAPACITY', role: 'capacity', reliability: 3,
  },
  {
    code: 'C2', capitalKey: 'C', name: 'فعال‌بودن دارایی فرهنگی',
    operationalDefinition: 'دارایی‌های دارای استفاده یا برنامه فعال تقسیم بر کل',
    formula: 'دارایی‌های فعال ÷ کل دارایی‌ها',
    source: 'مشاهده', direction: 'asc', chainStage: 'USE', role: 'conversion', reliability: 3,
  },
  {
    code: 'C3', capitalKey: 'C', name: 'هویت محله‌ای',
    operationalDefinition: 'میانگین احساس هویت و تمایز محله',
    formula: 'میانگین نمرات هویت (لیکرت ۱-۵)',
    source: 'پیمایش', direction: 'asc', chainStage: 'EXPERIENCE', role: 'experience', reliability: 3,
  },
  {
    code: 'C4', capitalKey: 'C', name: 'مشارکت فرهنگی',
    operationalDefinition: 'مشارکت‌کنندگان تقسیم بر جمعیت',
    formula: 'مشارکت‌کنندگان ÷ جمعیت',
    source: 'پیمایش', direction: 'asc', chainStage: 'USE', role: 'use', reliability: 3,
  },
  {
    code: 'C5', capitalKey: 'C', name: 'انتقال هویت',
    operationalDefinition: 'مشارکت نسل جوان در فعالیت‌ها و روایت‌های محلی',
    formula: 'مشارکت نسل جوان ÷ کل نسل جوان',
    source: 'پیمایش', direction: 'asc', chainStage: 'OUTCOME', role: 'reproduction', reliability: 3,
  },

  // ═══════════════ سرمایه نهادی–حکمرانی G ═══════════════
  {
    code: 'G1', capitalKey: 'G', name: 'مشارکت در تصمیم‌گیری',
    operationalDefinition: 'مشارکت واقعی گروه‌های محلی تقسیم بر فرایندهای تصمیم',
    formula: 'گروه‌های مشارکت‌کننده ÷ کل فرایندها',
    source: 'اسناد / پیمایش', direction: 'asc', chainStage: 'USE', role: 'conversion', reliability: 3,
  },
  {
    code: 'G2', capitalKey: 'G', name: 'پاسخگویی',
    operationalDefinition: 'درصد درخواست‌های حل‌شده در زمان استاندارد',
    formula: 'درخواست‌های حل‌شده به‌موقع ÷ کل درخواست‌ها',
    source: 'داده مدیریت شهری', direction: 'asc', chainStage: 'ACCESS', role: 'conversion', reliability: 4,
  },
  {
    code: 'G3', capitalKey: 'G', name: 'هماهنگی نهادی',
    operationalDefinition: 'امتیاز شبکه همکاری دستگاه‌ها',
    formula: 'امتیاز هماهنگی (ارزیابی خبرگان)',
    source: 'ارزیابی خبرگان', direction: 'asc', chainStage: 'USE', role: 'conversion', reliability: 3,
  },
  {
    code: 'G4', capitalKey: 'G', name: 'ظرفیت اجرا',
    operationalDefinition: 'پروژه‌های تکمیل‌شده تقسیم بر پروژه‌های مصوب',
    formula: 'پروژه‌های تکمیل‌شده ÷ پروژه‌های مصوب',
    source: 'داده پروژه', direction: 'asc', chainStage: 'CAPACITY', role: 'capacity', reliability: 4,
  },
  {
    code: 'G5', capitalKey: 'G', name: 'یادگیری نهادی',
    operationalDefinition: 'پروژه‌های استفاده‌کننده از ارزیابی قبلی تقسیم بر کل',
    formula: 'پروژه‌های مبتنی بر ارزیابی ÷ کل پروژه‌ها',
    source: 'اسناد', direction: 'asc', chainStage: 'OUTCOME', role: 'reproduction', reliability: 3,
  },

  // ═══════════════ سرمایه شبکه‌ای–ارتباطی R ═══════════════
  {
    code: 'R1', capitalKey: 'R', name: 'اتصال به شبکه شهری',
    operationalDefinition: 'زمان سفر به مراکز اصلی',
    formula: 'زمان متوسط سفر (دقیقه)',
    source: 'GIS', direction: 'desc', chainStage: 'ACCESS', role: 'access', reliability: 4,
  },
  {
    code: 'R2', capitalKey: 'R', name: 'دسترسی به فرصت شغلی',
    operationalDefinition: 'فرصت‌های شغلی قابل دسترس در زمان مشخص',
    formula: 'تعداد فرصت‌ها در شعاع دسترسی',
    source: 'GIS', direction: 'asc', chainStage: 'ACCESS', role: 'conversion', reliability: 3,
  },
  {
    code: 'R3', capitalKey: 'R', name: 'دسترسی به دانش',
    operationalDefinition: 'زمان دسترسی به مراکز آموزش و دانش',
    formula: 'زمان متوسط تا نزدیک‌ترین مرکز آموزشی',
    source: 'GIS', direction: 'desc', chainStage: 'ACCESS', role: 'conversion', reliability: 4,
  },
  {
    code: 'R4', capitalKey: 'R', name: 'اتصال اقتصادی',
    operationalDefinition: 'شدت ارتباط بنگاه‌های محله با بازارهای بیرونی',
    formula: 'امتیاز اتصال اقتصادی (پیمایش/داده)',
    source: 'پیمایش / داده اقتصادی', direction: 'asc', chainStage: 'USE', role: 'conversion', reliability: 3,
  },
  {
    code: 'R5', capitalKey: 'R', name: 'اتصال دیجیتال',
    operationalDefinition: 'پوشش و کیفیت اینترنت همراه با استفاده مؤثر',
    formula: 'پوشش × کیفیت × استفاده مؤثر',
    source: 'اپراتور / پیمایش', direction: 'asc', chainStage: 'OUTCOME', role: 'reproduction', reliability: 4,
  },
];

// ─── جستجوی شاخص ────────────────────────────────────────────
export function getIndicator(code: string): AlgorithmIndicator | undefined {
  return ALGORITHM_INDICATORS.find(i => i.code === code);
}

export function getIndicatorsByCapital(capital: CapitalKey): AlgorithmIndicator[] {
  return ALGORITHM_INDICATORS.filter(i => i.capitalKey === capital);
}

export function getIndicatorsByStage(stage: ChainStage): AlgorithmIndicator[] {
  return ALGORITHM_INDICATORS.filter(i => i.chainStage === stage);
}

export function getIndicatorsByRole(role: IndicatorRole): AlgorithmIndicator[] {
  return ALGORITHM_INDICATORS.filter(i => i.role === role);
}

// ─── گروه‌بندی بر اساس سرمایه ─────────────────────────────────
export const INDICATORS_BY_CAPITAL: Record<CapitalKey, AlgorithmIndicator[]> = {
  H: getIndicatorsByCapital('H'),
  S: getIndicatorsByCapital('S'),
  E: getIndicatorsByCapital('E'),
  P: getIndicatorsByCapital('P'),
  N: getIndicatorsByCapital('N'),
  C: getIndicatorsByCapital('C'),
  G: getIndicatorsByCapital('G'),
  R: getIndicatorsByCapital('R'),
};
