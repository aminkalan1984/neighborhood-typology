export interface PortfolioProject {
  id: string;
  code: string;
  title: string;
  dimension: 'water' | 'energy' | 'agriculture' | 'infra' | 'mining' | 'environment' | 'social' | 'digital' | 'education' | 'governance';
  dimensionName: string;
  dimensionColor: string;
  cellCode: string;
  cellName: string;
  province: string;
  county: string;
  executingAgency: string;
  manager: {
    name: string;
    role: string;
    avatar: string;
  };
  lifecycleStage: 'proposal' | 'ppe_eval' | 'approved' | 'execution' | 'monitoring' | 'ex_post' | 'closed';
  stageName: string;
  budgetTotal: number; // Million USD
  budgetAbsorbed: number; // Million USD
  physicalProgress: number; // 0-100%
  financialProgress: number; // 0-100%
  startDate: string; // Persian date
  expectedEndDate: string; // Persian date
  isOnTrack: boolean;
  isStalled: boolean;
  stallReason?: string;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  ppeScore: number; // 0-100
  predictedImpact: number; // 0-100
  realizedImpact: number; // 0-100
  baselineImpact: number; // 0-100
  originSource: 'isgp_prescription' | 'government_act' | 'field_proposal';
  originSourceName: string;
  scenarioOriginId?: string;
  scenarioOriginName?: string;
  targetIndicator: string;
  equityGapTargetCell?: string;
  milestones: {
    id: string;
    title: string;
    dueDate: string;
    completed: boolean;
  }[];
  decisionLog: {
    id: string;
    action: string;
    userName: string;
    userRole: string;
    date: string;
    signature: string;
  }[];
  exPostEvaluation?: {
    actualVsPredictedGap: number;
    finalCostDelta: number;
    lessonsLearned: string[];
    matchMakingFeedback: string;
  };
}

export interface PortfolioDimensionBalance {
  id: string;
  name: string;
  color: string;
  budgetAllocated: number; // Million USD
  budgetPercent: number;
  needPercent: number; // From O/T/N engine
  projectCount: number;
  gapStatus: 'balanced' | 'underfunded' | 'overfunded';
}

export const INITIAL_PORTFOLIO_PROJECTS: PortfolioProject[] = [
  {
    id: 'proj-01',
    code: 'ISGP-PRJ-2026-01',
    title: 'تکمیل شبکه آبرسانی نوین و بازچرخانی پساب صنعتی نی‌ریز',
    dimension: 'water',
    dimensionName: 'آب و هیدرولوژی',
    dimensionColor: '#0284C7',
    cellCode: 'C31',
    cellName: 'شناخت × نیاز (آبخوان نی‌ریز)',
    province: 'فارس',
    county: 'نی‌ریز',
    executingAgency: 'وزارت نیرو',
    manager: {
      name: 'مهندس رضا عباسی',
      role: 'مدیر پروژه آب منطقه‌ای فارس',
      avatar: '/avatar.svg',
    },
    lifecycleStage: 'execution',
    stageName: 'در حال اجرا',
    budgetTotal: 450,
    budgetAbsorbed: 310,
    physicalProgress: 68,
    financialProgress: 69,
    startDate: '۱۴۰۴/۰۲/۱۵',
    expectedEndDate: '۱۴۰۵/۰۹/۳۰',
    isOnTrack: true,
    isStalled: false,
    riskScore: 28,
    riskLevel: 'low',
    ppeScore: 92,
    predictedImpact: 88,
    realizedImpact: 82,
    baselineImpact: 42,
    originSource: 'isgp_prescription',
    originSourceName: 'تجویز سامانه ISGP',
    scenarioOriginId: 'SCN-FAR-01',
    scenarioOriginName: 'سناریوی بهینه‌سازی آبخوان بختگان',
    targetIndicator: 'کاهش افت سالانه آبخوان دشت نی‌ریز به میزان ۱.۲ متر',
    milestones: [
      { id: 'm1', title: 'حفر ۴ حلقه چاه پایش هیدرولوژیک', dueDate: '۱۴۰۴/۰۵/۱۰', completed: true },
      { id: 'm2', title: 'احداث تصفیه‌خانه مرکزی صنعتی نی‌ریز', dueDate: '۱۴۰۴/۱۱/۲۰', completed: true },
      { id: 'm3', title: 'اتصال خط لوله ۲۰ کیلومتری به فولاد نی‌ریز', dueDate: '۱۴۰۵/۰۶/۱۵', completed: false },
    ],
    decisionLog: [
      { id: 'd1', action: 'تصویب نهایی در موتور اولویت‌بندی PPE', userName: 'دکتر امین کلانتری', userRole: 'وزیر امور اقتصادی و دارایی', date: '۱۴۰۴/۰۱/۲۰', signature: 'SIG-7832-PPE' },
      { id: 'd2', action: 'ابلاغ تخصیص فاز دوم بودجه عمرانی', userName: 'مهندس سمیه حسینی', userRole: 'نماینده سازمان برنامه و بودجه', date: '۱۴۰۴/۰۸/۱۲', signature: 'SIG-9012-PBO' },
    ],
  },
  {
    id: 'proj-02',
    code: 'ISGP-PRJ-2026-02',
    title: 'احداث نیروگاه خورشیدی ۵۰۰ مگاواتی اصفهان - شاهین‌شهر',
    dimension: 'energy',
    dimensionName: 'انرژی و توان',
    dimensionColor: '#F59E0B',
    cellCode: 'C12',
    cellName: 'شناخت × استعداد (تابش خورشیدی اصفهان)',
    province: 'اصفهان',
    county: 'شاهین‌شهر',
    executingAgency: 'وزارت نیرو (ساتبا)',
    manager: {
      name: 'دکتر مریم شریفی',
      role: 'سرپرست مجری انرژی‌های تجدیدپذیر',
      avatar: '/avatar.svg',
    },
    lifecycleStage: 'execution',
    stageName: 'در حال اجرا',
    budgetTotal: 620,
    budgetAbsorbed: 480,
    physicalProgress: 76,
    financialProgress: 77,
    startDate: '۱۴۰۳/۱۱/۰۱',
    expectedEndDate: '۱۴۰۵/۰۷/۱۵',
    isOnTrack: true,
    isStalled: false,
    riskScore: 35,
    riskLevel: 'medium',
    ppeScore: 88,
    predictedImpact: 85,
    realizedImpact: 80,
    baselineImpact: 35,
    originSource: 'isgp_prescription',
    originSourceName: 'تجویز سامانه ISGP',
    scenarioOriginId: 'SCN-ISF-02',
    scenarioOriginName: 'سناریوی رفع ناترازی برق صنایع اصفهان',
    targetIndicator: 'تزریق ۷۵۰ گیگاوات‌ساعت برق پاک به شبکه سراسری',
    milestones: [
      { id: 'm1', title: 'تملک زمین ۳۰۰ هکتاری پست پهنه‌بندی', dueDate: '۱۴۰۴/۰۲/۰۱', completed: true },
      { id: 'm2', title: 'نصب ۲۰۰ هزار پنل خورشیدی فتوولتائیک', dueDate: '۱۴۰۴/۱۰/۱۵', completed: true },
      { id: 'm3', title: 'اتصال ترانسفورماتور پست ۴۰۰ کیلوولت', dueDate: '۱۴۰۵/۰۵/۳۰', completed: false },
    ],
    decisionLog: [
      { id: 'd1', action: 'تأیید صورت‌جلسه شبیه‌ساز ناترازی انرژی', userName: 'دکتر امین کلانتری', userRole: 'وزیر امور اقتصادی و دارایی', date: '۱۴۰۳/۱۰/۱۵', signature: 'SIG-1102-ENG' },
    ],
  },
  {
    id: 'proj-03',
    code: 'ISGP-PRJ-2026-03',
    title: 'توسعه مجتمع کشت گلخانه‌ای هوشمند و آبیاری قطره‌ای خوزستان',
    dimension: 'agriculture',
    dimensionName: 'کشاورزی و غذا',
    dimensionColor: '#10B981',
    cellCode: 'C21',
    cellName: 'تحلیل × فرصت (کشت هوشمند خوزستان)',
    province: 'خوزستان',
    county: 'دشت آزادگان',
    executingAgency: 'وزارت جهاد کشاورزی',
    manager: {
      name: 'مهندس علی کریمی',
      role: 'مدیر توسعه گلخانه‌های جنوب غرب',
      avatar: '/avatar.svg',
    },
    lifecycleStage: 'monitoring',
    stageName: 'پایش اثر',
    budgetTotal: 380,
    budgetAbsorbed: 360,
    physicalProgress: 92,
    financialProgress: 94,
    startDate: '۱۴۰۳/۰۶/۱۰',
    expectedEndDate: '۱۴۰۵/۰۴/۰۱',
    isOnTrack: true,
    isStalled: false,
    riskScore: 22,
    riskLevel: 'low',
    ppeScore: 94,
    predictedImpact: 90,
    realizedImpact: 88,
    baselineImpact: 50,
    originSource: 'government_act',
    originSourceName: 'مصوبه هیئت دولت',
    scenarioOriginId: 'SCN-KHZ-03',
    scenarioOriginName: 'سناریوی امنیت غذایی حوضه کارون',
    targetIndicator: 'کاهش ۴۵ درصدی مصرف آب کشاورزی و افزایش ۳ برابری تنوع محصول',
    milestones: [
      { id: 'm1', title: 'تحویل ۱۲۰ هکتار گلخانه مدرن صادراتی', dueDate: '۱۴۰۴/۰۴/۱۵', completed: true },
      { id: 'm2', title: 'راه اندازی سیستم IoT کنترل اقلیم', dueDate: '۱۴۰۴/۱۲/۰۱', completed: true },
    ],
    decisionLog: [
      { id: 'd1', action: 'ورود به مرحله پایش اثرات واقعی بر بستر O/T/N', userName: 'دکتر امین کلانتری', userRole: 'وزیر امور اقتصادی و دارایی', date: '۱۴۰۵/۰۲/۰۱', signature: 'SIG-4490-MON' },
    ],
  },
  {
    id: 'proj-04',
    code: 'ISGP-PRJ-2026-04',
    title: 'احداث مزرعه توربین بادی ۱۰۰ مگاواتی میل نادر سیستان',
    dimension: 'energy',
    dimensionName: 'انرژی و توان',
    dimensionColor: '#F59E0B',
    cellCode: 'C33',
    cellName: 'کنش × نیاز (محرومیت‌زدایی سیستان)',
    province: 'سیستان و بلوچستان',
    county: 'نیمروز',
    executingAgency: 'وزارت نیرو',
    manager: {
      name: 'مهندس احمد زارعی',
      role: 'سرپرست خط انتقال نیروگاه سیستان',
      avatar: '/avatar.svg',
    },
    lifecycleStage: 'execution',
    stageName: 'در حال اجرا (تأخیر)',
    budgetTotal: 290,
    budgetAbsorbed: 180,
    physicalProgress: 42,
    financialProgress: 62,
    startDate: '۱۴۰۳/۰۹/۰۱',
    expectedEndDate: '۱۴۰۵/۰۵/۱۵',
    isOnTrack: false,
    isStalled: true,
    stallReason: 'تأخیر ۶ ماهه گمرکی در ترخیص توربین‌های بادی و عدم تخصیص به موقع ارز',
    riskScore: 78,
    riskLevel: 'high',
    ppeScore: 86,
    predictedImpact: 82,
    realizedImpact: 45,
    baselineImpact: 20,
    originSource: 'field_proposal',
    originSourceName: 'پیشنهاد میدانی و محرومیت‌زدایی',
    targetIndicator: 'تأمین برق ۳۰ هزار خانوار روستایی مرزی سیستان',
    equityGapTargetCell: 'سلول محروم سیستان شمال',
    milestones: [
      { id: 'm1', title: 'تسطیح و فونداسیون ۵۰ توربین بادی', dueDate: '۱۴۰۴/۰۳/۱۵', completed: true },
      { id: 'm2', title: 'ترخیص و انتقال ژنراتورهای توربین', dueDate: '۱۴۰۴/۱۰/۰۱', completed: false },
      { id: 'm3', title: 'تست اولیه و سنکرون با شبکه', dueDate: '۱۴۰۵/۰۲/۱۵', completed: false },
    ],
    decisionLog: [
      { id: 'd1', action: 'صدور اخطار هشدار توقف و درخواست گزارش دیوان', userName: 'دکتر امین کلانتری', userRole: 'وزیر امور اقتصادی و دارایی', date: '۱۴۰۵/۰۱/۱۰', signature: 'SIG-9011-ALT' },
    ],
  },
  {
    id: 'proj-05',
    code: 'ISGP-PRJ-2026-05',
    title: 'ایجاد مجتمع پتروشیمی و زنجیره ارزش متانول مرودشت (تعلیق)',
    dimension: 'mining',
    dimensionName: 'معدن و صنایع',
    dimensionColor: '#8B5CF6',
    cellCode: 'C31',
    cellName: 'شناخت × نیاز (تنش هیدرولوژیک مرودشت)',
    province: 'فارس',
    county: 'مرودشت',
    executingAgency: 'وزارت صمت',
    manager: {
      name: 'مهندس مرتضی کاظمی',
      role: 'مجری پروژه هلدینگ پتروشیمی',
      avatar: '/avatar.svg',
    },
    lifecycleStage: 'proposal',
    stageName: 'حذف‌شده (قید سخت هیدرولوژیک)',
    budgetTotal: 850,
    budgetAbsorbed: 0,
    physicalProgress: 0,
    financialProgress: 0,
    startDate: '۱۴۰۴/۰۱/۰۱',
    expectedEndDate: '۱۴۰۷/۱۲/۲۹',
    isOnTrack: false,
    isStalled: true,
    stallReason: 'رد کامل در موتور اولویت‌بندی PPE به دلیل تخطی از قید سخت افت آبخوان و خط قرمز میراث تخت جمشید',
    riskScore: 95,
    riskLevel: 'critical',
    ppeScore: 18,
    predictedImpact: 25,
    realizedImpact: 0,
    baselineImpact: 10,
    originSource: 'field_proposal',
    originSourceName: 'پیشنهاد میدانی',
    targetIndicator: 'ارزیابی صفر - پروژه حذف شده در خط قرمز هیدرولوژیک',
    milestones: [
      { id: 'm1', title: 'امکان‌سنجی اولیه محیط زیستی', dueDate: '۱۴۰۴/۰۲/۰۱', completed: true },
      { id: 'm2', title: 'صدور مجوز تخصیص آب سفره زیرزمینی', dueDate: '۱۴۰۴/۰۵/۰۱', completed: false },
    ],
    decisionLog: [
      { id: 'd1', action: 'رد قطعی و صدور گزارش شفافیت حذف کاندیدها (Knock-out)', userName: 'دکتر امین کلانتری', userRole: 'وزیر امور اقتصادی و دارایی', date: '۱۴۰۴/۰۳/۱۵', signature: 'SIG-0012-REJ' },
    ],
  },
  {
    id: 'proj-06',
    code: 'ISGP-PRJ-2026-06',
    title: 'توسعه فیبر نوری و زیرساخت ارتباطی هوشمند روستاهای استان کردستان',
    dimension: 'digital',
    dimensionName: 'فناوری و دیجیتال',
    dimensionColor: '#6366F1',
    cellCode: 'C22',
    cellName: 'تحلیل × استعداد (دیجیتال کردستان)',
    province: 'کردستان',
    county: 'سنندج',
    executingAgency: 'وزارت ارتباطات و فناوری اطلاعات',
    manager: {
      name: 'مهندس سارا رحمانی',
      role: 'مدیر توسعه ارتباطات روستایی استان',
      avatar: '/avatar.svg',
    },
    lifecycleStage: 'execution',
    stageName: 'در حال اجرا',
    budgetTotal: 120,
    budgetAbsorbed: 95,
    physicalProgress: 80,
    financialProgress: 79,
    startDate: '۱۴۰۴/۰۱/۱۵',
    expectedEndDate: '۱۴۰۵/۰۸/۳۰',
    isOnTrack: true,
    isStalled: false,
    riskScore: 18,
    riskLevel: 'low',
    ppeScore: 90,
    predictedImpact: 86,
    realizedImpact: 84,
    baselineImpact: 30,
    originSource: 'isgp_prescription',
    originSourceName: 'تجویز سامانه ISGP',
    targetIndicator: 'اتصال ۲۵۰ روستای بالای ۲۰ خانوار به اینترنت پرسرعت FTTH',
    milestones: [
      { id: 'm1', title: 'حفر خندق و فیبرگذاری ۵۰۰ کیلومتر شبکه', dueDate: '۱۴۰۴/۰۸/۱۰', completed: true },
      { id: 'm2', title: 'نصب FAT و تجهیز سوئیچ‌های منطقه', dueDate: '۱۴۰۴/۱۲/۱۵', completed: true },
      { id: 'm3', title: 'پذیرش و تست نهایی رگولاتوری', dueDate: '۱۴۰۵/۰۶/۰۱', completed: false },
    ],
    decisionLog: [
      { id: 'd1', action: 'تأیید اعتبارنامه توسعه دیجیتال مناطق مرزی', userName: 'دکتر امین کلانتری', userRole: 'وزیر امور اقتصادی و دارایی', date: '۱۴۰۴/۰۱/۰۵', signature: 'SIG-5510-DIG' },
    ],
  },
  {
    id: 'proj-07',
    code: 'ISGP-PRJ-2026-07',
    title: 'تأسیس بیمارستان تخصصی و مرکز پایش درمان هرمزگان - بندرعباس',
    dimension: 'environment',
    dimensionName: 'محیط‌زیست و سلامت',
    dimensionColor: '#EC4899',
    cellCode: 'C32',
    cellName: 'کنش × استعداد (سلامت ساحلی هرمزگان)',
    province: 'هرمزگان',
    county: 'بندرعباس',
    executingAgency: 'وزارت بهداشت، درمان و آموزش پزشکی',
    manager: {
      name: 'دکتر فرهاد احمدی',
      role: 'رئیس دانشگاه علوم پزشکی هرمزگان',
      avatar: '/avatar.svg',
    },
    lifecycleStage: 'ex_post',
    stageName: 'ارزیابی پسینی',
    budgetTotal: 310,
    budgetAbsorbed: 310,
    physicalProgress: 100,
    financialProgress: 100,
    startDate: '۱۴۰۲/۰۵/۰۱',
    expectedEndDate: '۱۴۰۴/۱۲/۲۹',
    isOnTrack: true,
    isStalled: false,
    riskScore: 12,
    riskLevel: 'low',
    ppeScore: 95,
    predictedImpact: 92,
    realizedImpact: 94,
    baselineImpact: 40,
    originSource: 'government_act',
    originSourceName: 'مصوبه هیئت دولت',
    targetIndicator: 'کاهش ۳۵ درصدی زمان دسترسی بیماران بدحال سواحل خلیج فارس',
    milestones: [
      { id: 'm1', title: 'تکمیل سازه ۶ طبقه و تجهیز بخش ICU', dueDate: '۱۴۰۴/۰۲/۱۵', completed: true },
      { id: 'm2', title: 'افتتاح رسمی و پذیرش ۵۰۰ بیمار در روز', dueDate: '۱۴۰۴/۱۱/۰۱', completed: true },
    ],
    decisionLog: [
      { id: 'd1', action: 'خاتمه پروژه و ارجاع به کتابخانه اثربخشی حاکمیتی', userName: 'دکتر امین کلانتری', userRole: 'وزیر امور اقتصادی و دارایی', date: '۱۴۰۴/۱۲/۲۰', signature: 'SIG-8822-EXP' },
    ],
    exPostEvaluation: {
      actualVsPredictedGap: +2.2,
      finalCostDelta: -12, // 12 M$ saved
      lessonsLearned: [
        'بهره‌گیری از معماری بومی ساحلی مصرف انرژی سرمایشی را ۲۰٪ کاهش داد.',
        'تأمین کادر متخصص درمانگاهی در مناطق گرمسیری نیازمند بسته مکمل مسکن حمایتی است.',
      ],
      matchMakingFeedback: 'الگوی موفق جهت تکثیر در سواحل مکران و چابهار ثبت گردید.',
    },
  },
  {
    id: 'proj-08',
    code: 'ISGP-PRJ-2026-08',
    title: 'ارتقای مهارت‌آموزی حرفه‌ای و توانمندسازی جوامع محلی بلوچستان',
    dimension: 'education',
    dimensionName: 'آموزش و مهارت',
    dimensionColor: '#14B8A6',
    cellCode: 'C33',
    cellName: 'کنش × نیاز (مهارت بلوچستان)',
    province: 'سیستان و بلوچستان',
    county: 'چابهار',
    executingAgency: 'سازمان آموزش فنی و حرفه‌ای کشور',
    manager: {
      name: 'استاد حمید بلوچ',
      role: 'سرپرست مراکز فنی چابهار',
      avatar: '/avatar.svg',
    },
    lifecycleStage: 'ppe_eval',
    stageName: 'در ارزیابی PPE',
    budgetTotal: 85,
    budgetAbsorbed: 0,
    physicalProgress: 0,
    financialProgress: 0,
    startDate: '۱۴۰۵/۰۴/۰۱',
    expectedEndDate: '۱۴۰۶/۰۴/۰۱',
    isOnTrack: true,
    isStalled: false,
    riskScore: 25,
    riskLevel: 'low',
    ppeScore: 89,
    predictedImpact: 87,
    realizedImpact: 0,
    baselineImpact: 25,
    originSource: 'isgp_prescription',
    originSourceName: 'تجویز سامانه ISGP',
    targetIndicator: 'آموزش تخصصی ۳۰۰۰ تکنسین جوشکاری صنعتی و مکانیک دریایی',
    milestones: [
      { id: 'm1', title: 'تجهیز ۴ مرکز سیار آموزش جوش زیرآب', dueDate: '۱۴۰۵/۰۶/۰۱', completed: false },
    ],
    decisionLog: [
      { id: 'd1', action: 'ثبت پیشنهاد اولیه در موتور اولویت‌بندی PPE', userName: 'دکتر امین کلانتری', userRole: 'وزیر امور اقتصادی و دارایی', date: '۱۴۰۵/۰۲/۲۵', signature: 'SIG-3321-QUE' },
    ],
  },
];

export const PORTFOLIO_DIMENSION_BALANCES: PortfolioDimensionBalance[] = [
  { id: 'water', name: 'آب و هیدرولوژی', color: '#0284C7', budgetAllocated: 890, budgetPercent: 21.2, needPercent: 28.5, projectCount: 8, gapStatus: 'underfunded' },
  { id: 'energy', name: 'انرژی و توان', color: '#F59E0B', budgetAllocated: 1150, budgetPercent: 27.4, needPercent: 22.0, projectCount: 10, gapStatus: 'overfunded' },
  { id: 'agriculture', name: 'کشاورزی و غذا', color: '#10B981', budgetAllocated: 620, budgetPercent: 14.8, needPercent: 16.2, projectCount: 7, gapStatus: 'balanced' },
  { id: 'mining', name: 'معدن و صنایع', color: '#8B5CF6', budgetAllocated: 540, budgetPercent: 12.8, needPercent: 10.5, projectCount: 6, gapStatus: 'balanced' },
  { id: 'infra', name: 'زیرساخت و حمل‌ونقل', color: '#3B82F6', budgetAllocated: 480, budgetPercent: 11.4, needPercent: 12.0, projectCount: 5, gapStatus: 'balanced' },
  { id: 'environment', name: 'محیط‌زیست و سلامت', color: '#EC4899', budgetAllocated: 310, budgetPercent: 7.4, needPercent: 5.8, projectCount: 4, gapStatus: 'balanced' },
  { id: 'digital', name: 'فناوری و دیجیتال', color: '#6366F1', budgetAllocated: 120, budgetPercent: 2.8, needPercent: 3.2, projectCount: 3, gapStatus: 'balanced' },
  { id: 'education', name: 'آموزش و مهارت', color: '#14B8A6', budgetAllocated: 85, budgetPercent: 2.0, needPercent: 1.8, projectCount: 2, gapStatus: 'balanced' },
];
