import { BudgetTransaction, NationalProject, GovernanceLog, CubeCell, FrameworkCell, RegionInfo } from './types';

export const initialBudgetTransactions: BudgetTransaction[] = [
  {
    id: 'tx-1',
    name: 'ابلاغ اعتبار طرح خوشه فروکروم آباده‌طشک',
    category: 'توسعه صنعتی و معدن',
    recipient: 'وزارت صنعت، معدن و تجارت',
    amount: 145, // میلیون دلار
    date: '۱۴۰۵/۰۵/۱۶',
    type: 'allocation',
    status: 'approved'
  },
  {
    id: 'tx-2',
    name: 'تأمین مالی نیروگاه خورشیدی ۱۰۰ مگاواتی اصفهان',
    category: 'انرژی‌های تجدیدپذیر',
    recipient: 'سازمان انرژی‌های تجدیدپذیر (ساتبا)',
    amount: 40,
    date: '۱۴۰۵/۰۵/۱۵',
    type: 'allocation',
    status: 'approved'
  },
  {
    id: 'tx-3',
    name: 'اعتبار طرح اضطراری احیای تالاب بختگان',
    category: 'منابع طبیعی و محیط زیست',
    recipient: 'سازمان حفاظت محیط زیست',
    amount: 60,
    date: '۱۴۰۵/۰۵/۱۴',
    type: 'withdrawal',
    status: 'approved'
  },
  {
    id: 'tx-4',
    name: 'تأمین مالی طرح بازگشت نخبگان «نی‌ریز من»',
    category: 'سرمایه انسانی و نخبگان',
    recipient: 'بنیاد ملی نخبگان فارس',
    amount: 6,
    date: '۱۴۰۵/۰۵/۱۲',
    type: 'allocation',
    status: 'review'
  },
  {
    id: 'tx-5',
    name: 'پروژه فیبر نوری ۸۲ روستای بخش پشتکوه',
    category: 'زیرساخت دیجیتال',
    recipient: 'وزارت ارتباطات و فناوری اطلاعات',
    amount: 14,
    date: '۱۴۰۵/۰۵/۱۰',
    type: 'withdrawal',
    status: 'approved'
  },
  {
    id: 'tx-6',
    name: 'احداث ابرکارخانه پتروشیمی قطرویه',
    category: 'پتروشیمی و صنایع پایین‌دست',
    recipient: 'وزارت نفت',
    amount: 240,
    date: '۱۴۰۵/۰۵/۰۸',
    type: 'allocation',
    status: 'rejected' // مردود دیوان به دلیل عدم انطباق با آمایش و تله منابع
  }
];

// Neyriz Pilot 15 Projects (from page 36 of document)
export const initialNationalProjects: NationalProject[] = [
  {
    id: 'P-01',
    code: 'P-01',
    title: 'خوشه صنعتی فرو-کروم قطب فرومتالورژی',
    category: 'mining',
    savedAmount: 110, // معادل میلیون دلار
    targetAmount: 150,
    percentage: 73,
    employment: 680,
    fitScore: 0.82,
    cellCode: 'C31'
  },
  {
    id: 'P-02',
    code: 'P-02',
    title: 'نیروگاه خورشیدی ۱۰۰ مگاواتی اراضی شور آباده‌طشک',
    category: 'energy',
    savedAmount: 18,
    targetAmount: 40,
    percentage: 45,
    employment: 120,
    fitScore: 0.72,
    cellCode: 'C31'
  },
  {
    id: 'P-03',
    code: 'P-03',
    title: 'برندسازی جهانی گلیم نی‌ریز و پلتفرم دو سویه C2B',
    category: 'cultural',
    savedAmount: 2.1,
    targetAmount: 3.0,
    percentage: 70,
    employment: 1800,
    fitScore: 0.80,
    cellCode: 'C31'
  },
  {
    id: 'P-04',
    code: 'P-04',
    title: 'مزرعه پسته شور-تحمل ارقام جدید مقاوم به شوری آب',
    category: 'infrastructure',
    savedAmount: 4.2,
    targetAmount: 9.3,
    percentage: 45,
    employment: 950,
    fitScore: 0.72,
    cellCode: 'C31'
  },
  {
    id: 'P-05',
    code: 'P-05',
    title: 'ژئوپارک ملی نی‌ریز و گردشگری پایدار تالاب بختگان',
    category: 'cultural',
    savedAmount: 5.2,
    targetAmount: 9.3,
    percentage: 55,
    employment: 420,
    fitScore: 0.55,
    cellCode: 'C31'
  },
  {
    id: 'T-01',
    code: 'T-01',
    title: 'تاسیس مدرسه عالی مهندسی معدن نی‌ریز',
    category: 'welfare',
    savedAmount: 6.2,
    targetAmount: 10.6,
    percentage: 58,
    employment: 45,
    fitScore: 0.77,
    cellCode: 'C32'
  },
  {
    id: 'T-02',
    code: 'T-02',
    title: 'آکادمی گلیم‌بافی با گواهی رسمی یونسکو (UNESCO-pathway)',
    category: 'cultural',
    savedAmount: 1.1,
    targetAmount: 1.5,
    percentage: 73,
    employment: 28,
    fitScore: 0.85,
    cellCode: 'C32'
  },
  {
    id: 'T-03',
    code: 'T-03',
    title: 'طرح ملی بازگشت نخبگان غیرمقیم «نی‌ریز من»',
    category: 'social',
    savedAmount: 3.2,
    targetAmount: 6.0,
    percentage: 53,
    employment: 150,
    fitScore: 0.62,
    cellCode: 'C32'
  },
  {
    id: 'T-04',
    code: 'T-04',
    title: 'مرکز نوآوری زنجیره ارزش پسته و فرآوری دارویی',
    category: 'mining',
    savedAmount: 1.8,
    targetAmount: 3.6,
    percentage: 50,
    employment: 90,
    fitScore: 0.78,
    cellCode: 'C32'
  },
  {
    id: 'T-05',
    code: 'T-05',
    title: 'شبکه راهنمایان محلی و بوم‌گردی عشایر قشقایی',
    category: 'cultural',
    savedAmount: 0.3,
    targetAmount: 0.4,
    percentage: 75,
    employment: 120,
    fitScore: 0.69,
    cellCode: 'C32'
  },
  {
    id: 'N-01',
    code: 'N-01',
    title: 'برنامه ملی احیا و رهاسازی حق‌آبه تالاب بختگان',
    category: 'energy',
    savedAmount: 35.0,
    targetAmount: 60.0,
    percentage: 58,
    employment: 220,
    fitScore: 0.70,
    cellCode: 'C33'
  },
  {
    id: 'N-02',
    code: 'N-02',
    title: 'کرشمه آبیاری هوشمند مزارع (سنسور رطوبت و هوش مصنوعی)',
    category: 'infrastructure',
    savedAmount: 18.0,
    targetAmount: 30.6,
    percentage: 59,
    employment: 350,
    fitScore: 0.81,
    cellCode: 'C33'
  },
  {
    id: 'N-03',
    code: 'N-03',
    title: 'شبکه فیبر نوری ۸۲ روستای بخش پشتکوه و اینترنت 5G',
    category: 'digital',
    savedAmount: 12.0,
    targetAmount: 14.0,
    percentage: 85,
    employment: 85,
    fitScore: 0.88,
    cellCode: 'C33'
  },
  {
    id: 'N-04',
    code: 'N-04',
    title: 'واحد پزشکی متحرک و تله‌مدیسین مناطق کویری قطرویه',
    category: 'welfare',
    savedAmount: 1.8,
    targetAmount: 3.2,
    percentage: 56,
    employment: 62,
    fitScore: 0.83,
    cellCode: 'C33'
  },
  {
    id: 'N-05',
    code: 'N-05',
    title: 'شهرک مسکونی جوانان عشایر و کارگاه‌های زنجیره‌ای',
    category: 'social',
    savedAmount: 22.0,
    targetAmount: 36.6,
    percentage: 60,
    employment: 600,
    fitScore: 0.68,
    cellCode: 'C33'
  }
];

export const initialGovernanceLogs: GovernanceLog[] = [
  {
    id: 'log-1',
    userId: 'user-1',
    userName: 'دکتر امین کلانتری',
    userAvatar: '/avatar.svg',
    role: 'رئیس دبیرخانه آمایش سرزمین',
    description: 'سامانه پایش هوشمند آرا با مدل مکعبی نی‌ریز (Z2) انطباق یافت. الگوی غالب: "نیاز اشباع‌شده با حساسیت اکولوژیک" تشخیص داده شد.',
    time: '۵ دقیقه پیش',
    statusColor: '#10B981' // سبز پایدار
  },
  {
    id: 'log-2',
    userId: 'user-2',
    userName: 'مهندس زهرا احمدی',
    userAvatar: '/avatar.svg',
    role: 'مدیر پایداری محیط‌زیست استان فارس',
    description: 'هشدار سطح بحرانی فرونشست زمین در مزارع آباده‌طشک نی‌ریز به میزان ۱۴ سانتی‌متر در سال صادر شد. پیشنهاد انسداد چاه‌های غیرمجاز.',
    time: '۱ ساعت پیش',
    statusColor: '#F59E0B' // زرد نیازمند پایش
  },
  {
    id: 'log-3',
    userId: 'user-3',
    userName: 'علی رضایی',
    userAvatar: '/avatar.svg',
    role: 'کارشناس دیوان عالی محاسبات',
    description: 'پروژه پتروشیمی قطرویه به دلیل عدم انطباق با توان اکولوژیک منطقه و نقض قید EPI (فشار محیطی) متوقف و حواله ارزی آن معلق شد.',
    time: '۳ ساعت پیش',
    statusColor: '#EF4444' // قرمز بحرانی
  }
];

export const monthlyBudgetFlow = [
  { month: 'فروردین', income: 4200, expense: 3800 },
  { month: 'اردیبهشت', income: 4800, expense: 4200 },
  { month: 'خرداد', income: 5100, expense: 4500 },
  { month: 'تیر', income: 5500, expense: 5100 },
  { month: 'مرداد', income: 6200, expense: 4800 },
  { month: 'شهریور', income: 5900, expense: 5400 },
  { month: 'مهر', income: 6400, expense: 5900 },
  { month: 'آبان', income: 6100, expense: 5800 },
  { month: 'آذر', income: 6300, expense: 5500 },
  { month: 'دی', income: 6700, expense: 6100 },
  { month: 'بهمن', income: 7100, expense: 6500 },
  { month: 'اسفند', income: 7800, expense: 7200 }
];

export const sectorExpenditures = [
  { name: 'پروژه‌های عمرانی و زیرساخت (INF)', value: 2450, color: '#1E4841', percentage: 38 },
  { name: 'سلامت، درمان و بیمه ملی (HUM)', value: 1600, color: '#10B981', percentage: 25 },
  { name: 'توسعه دانش‌بنیان و فناوری (TEC)', value: 1100, color: '#F59E0B', percentage: 17 },
  { name: 'محیط زیست و منابع طبیعی (NAT)', value: 900, color: '#2d5c53', percentage: 14 },
  { name: 'رفاه و توسعه اجتماعی (SOC)', value: 400, color: '#BCBEBD', percentage: 6 }
];

// === PILOT NYRIZ INFO (Page 25) ===
export const neyrizRegionInfo: RegionInfo = {
  code: 'IR-FAR-NEY',
  name: 'شهرستان نی‌ریز',
  province: 'استان فارس',
  level: 'Z2 - سطح شهرستان',
  population: 155200,
  area: '۱۰,۴۰۰ کیلومتر مربع',
  climate: 'کوهستان جنوبی زاگرس + دشت کشاورزی حاصلخیز + کویر نمک شرقی تالاب',
  features: ['تالاب بختگان رو به خشکیدگی', 'بزرگترین ذخیره کرومیت خاورمیانه', 'قطب تولید پسته شور-تحمل و انجیر دیم', 'تنوع جمعیتی شامل ایل قشقایی']
};

// === 9 CORE CELLS OF NEYRIZ PILOT (Pages 26-28) ===
export const neyrizCubeCells: CubeCell[] = [
  {
    code: 'C11',
    name: 'شناخت × فرصت',
    dimension: 'Sensing',
    side: 'Opportunity',
    score: 0.58,
    level: 'mid',
    indicators: [
      { name: 'ذخیره کرومیت قابل استخراج فاریاب', value: 12, unit: 'میلیون تن', source: 'ایمیدرو، ۱۴۰۲' },
      { name: 'پتانسیل تابش خورشیدی سالانه دشت', value: 5.8, unit: 'kWh/m²/day', source: 'رتبه ۶ کشور، ۱۴۰۲' },
      { name: 'تنوع گونه‌های تالابی تالاب بختگان', value: 148, unit: 'گونه پرنده و پستاندار', source: 'حفاظت محیط‌زیست فارس' },
      { name: 'محصولات با مزیت صادراتی جغرافیایی ثبت شده', value: 3, unit: 'مورد (انجیر، گلیم، گز قطرویه)', source: 'ثبت اسناد کشور' },
      { name: 'شاخص مزیت نسبی فاش‌شده (RCA) انجیر', value: 17.2, unit: 'ضریب تخصص', source: 'آمار گمرک جمهوری اسلامی' }
    ],
    conclusions: [
      'مزیت فوق‌العاده در انرژی‌های پاک (رتبه ۶ کشور در تابش تابشی خورشیدی).',
      'ذخیره کرومیت معدنی کم‌نظیر در دشت آباده‌طشک برای توسعه صنایع پیشرفته فرو-آلیاژ.'
    ]
  },
  {
    code: 'C12',
    name: 'شناخت × استعداد',
    dimension: 'Sensing',
    side: 'Talent',
    score: 0.62,
    level: 'high',
    indicators: [
      { name: 'درصد جمعیت دارای مهارت سنتی فعال', value: 8.7, unit: '٪ جمعیت (عمدتاً گلیم‌بافی و دیم‌کاری)', source: 'مرکز آمار ایران، ۱۴۰۲' },
      { name: 'نرخ باسوادی عمومی افراد بالای ۶ سال', value: 88.2, unit: '٪ باسوادی', source: 'سرشماری ۱۳۹۵ تعدیل شده' },
      { name: 'دانشجویان شاغل به تحصیل مقاطع مختلف', value: 4200, unit: 'نفر (آزاد، پیام‌نور، غیرانتفاعی)', source: 'وزارت علوم، پژوهش و فناوری' },
      { name: 'نیروی کار ماهر دیپلمه فنی-حرفه‌ای فعال', value: 18, unit: '٪ نیروی کار فعال', source: 'فنی‌حرفه‌ای استان فارس' },
      { name: 'نخبگان علمی و مهارتی متولد منطقه در دیاسپورا', value: 320, unit: 'نفر شناسایی‌شده', source: 'بنیاد نخبگان فارس' }
    ],
    conclusions: [
      'سرمایه انسانی غنی با نرخ باسوادی بالا (۸۸٪) و پیشینه هنر سنتی گلیم و گبه با ثبت جهانی.',
      'وجود ۴۲۰۰ دانشجو پتانسیل خوبی برای گذار به دانشگاه نسل سوم ایجاد می‌کند.'
    ]
  },
  {
    code: 'C13',
    name: 'شناخت × نیاز',
    dimension: 'Sensing',
    side: 'Need',
    score: 0.71,
    level: 'critical',
    indicators: [
      { name: 'نرخ بیکاری جوانان رده ۱۵ تا ۲۹ سال', value: 26.3, unit: '٪ نرخ بیکاری', source: 'مرکز آمار ایران، ۱۴۰۲' },
      { name: 'افت سطح آب زیرزمینی دشت‌های بحرانی', value: -0.92, unit: 'متر/سال (بحران فوق‌العاده شدید)', source: 'آب منطقه‌ای فارس، ۱۴۰۲' },
      { name: 'سرانه آب تجدیدپذیر سالانه شهرستان', value: 480, unit: 'مترمکعب/نفر (پایین‌تر از خط فقر آب)', source: 'تراز آب کشور' },
      { name: 'سرانه پزشک عمومی و متخصص فعال', value: 0.6, unit: 'پزشک به ازای ۱۰۰۰ نفر جمعیت', source: 'وزارت بهداشت، درمان و آموزش پزشکی' },
      { name: 'روستاهای بخش پشتکوه فاقد اینترنت پایدار', value: 37, unit: '٪ کل روستاها', source: 'مخابرات فارس، ۱۴۰۲' }
    ],
    conclusions: [
      'بحران فوق‌العاده جدی آب: سرانه ۴۸۰ مترمکعب نشان‌دهنده ناترازی و تنش شدید اکولوژیک است.',
      'بیکاری بالا بین جوانان (۲۶٪) نیازمند هدایت سرمایه‌ها به صنایع غیر آب‌بر است.'
    ]
  },
  {
    code: 'C21',
    name: 'تحلیل × فرصت',
    dimension: 'Reasoning',
    side: 'Opportunity',
    score: 0.52,
    level: 'mid',
    indicators: [
      { name: 'تطابق کرومیت با صنایع پایین‌دست فلزی یزد', value: 0.82, unit: 'ضریب انطباق', source: 'موتور تحلیل آرا' },
      { name: 'امتیاز انطباق اکوتوریسم با احیای تالاب بختگان', value: 0.41, unit: 'ضریب پایداری', source: 'مدل‌سازی اقلیمی' },
      { name: 'پتانسیل خوشه‌ای مزارع خورشیدی در اراضی شور', value: 250, unit: 'مگاوات (نقشه‌برداری GIS)', source: 'ساتبا، ۱۴۰۲' },
      { name: 'ارزش افزوده سالانه سناریو پایه معدن کرومیت', value: 820, unit: 'میلیارد تومان (پتانسیل مالی)', source: 'مدل ورودی-خروجی استانی' }
    ],
    conclusions: [
      'مزیت مطلق در راه‌اندازی خوشه صنعتی فروکروم و انتقال فرآوری مواد خام به پله نهایی ارزش افزوده.',
      'پتانسیل بالای اراضی بایر شور جهت نصب پنل‌های فتوولتائیک خورشیدی بدون رقابت با مزارع کشاورزی.'
    ]
  },
  {
    code: 'C22',
    name: 'تحلیل × استعداد',
    dimension: 'Reasoning',
    side: 'Talent',
    score: 0.41,
    level: 'low',
    indicators: [
      { name: 'ضریب هماهنگی سرمایه نخبگان با بازار کار محلی', value: 0.74, unit: 'شاخص انطباق', source: 'مدل ساختاری آرا' },
      { name: 'شکاف مهندسی نوین و هوشمندسازی معدن و GIS', value: 0.61, unit: '٪ کمبود مهارت تخصصی', source: 'سامانه مهارت ملی' },
      { name: 'ریسک از دست رفتن دانش بومی گلیم با فوت استادکاران', value: 0.68, unit: 'ضریب ریسک فرسایش دانش', source: 'میراث فرهنگی فارس' },
      { name: 'تولید شغل جدید در سناریو پیشرفته هاب صنعتی', value: 12000, unit: 'شغل طی ۱۰ سال (پتانسیل)', source: 'مدل اقتصادسنجی' }
    ],
    conclusions: [
      'شکاف شدید مهارتی در بخش هوشمندسازی معادن و نقشه‌برداری تخصصی (۶۱٪ کمبود نیروی ماهر).',
      'ریسک فرسایش بالای دانش گلیم‌بافی به دلیل فوت پیشکسوتان و عدم جذب نسل جوان.'
    ]
  },
  {
    code: 'C23',
    name: 'تحلیل × نیاز',
    dimension: 'Reasoning',
    side: 'Need',
    score: 0.63,
    level: 'high',
    indicators: [
      { name: 'شاخص انحراف کارکردی آمایش (FDI) شهرستان', value: 0.63, unit: 'ضریب انحراف (بالا)', source: 'برنامه آمایش استانی' },
      { name: 'شاخص فشار اکولوژیک (EPI) آبخوان‌های دشت', value: 0.79, unit: 'ضریب بحران اکولوژیک (بحرانی)', source: 'مدل‌سازی هیدرولوژیک WEAP' },
      { name: 'نابرابری توسعه فضایی بخش پشتکوه با بخش مرکزی (TJI)', value: 0.46, unit: 'ضریب جینی توزیع (پایین)', source: 'دیوان عالی محاسبات' },
      { name: 'جمعیت زیر خط فقر چندبعدی پشتکوه و قطرویه', value: 28.4, unit: '٪ سرشماری خانوارها', source: 'OPHI Ostan' }
    ],
    conclusions: [
      'ناترازی شدید هیدرولوژیک و کشاورزی دشت (شاخص بحران EPI برابر ۰.۷۹). کشت سنتی با غرقابی دیگر توجیه‌پذیر نیست.',
      'انحراف بالای ردیف‌های بودجه تخصیص‌یافته از اهداف سند چشم‌انداز توسعه متوازن فضایی کشور.'
    ]
  },
  {
    code: 'C31',
    name: 'کنش × فرصت',
    dimension: 'Acting',
    side: 'Opportunity',
    score: 0.58,
    level: 'mid',
    indicators: [
      { name: 'طرح توسعه خوشه صنعتی فرو-کروم قطرویه', value: 'P-01', unit: '۴۵۰۰ میلیارد تومان سرمایه', source: 'سازمان ایمیدرو، ۱۴۰۲' },
      { name: 'نیروگاه ۱۰۰ مگاواتی اراضی شور آباده‌طشک', value: 'P-02', unit: '۱۲۰۰ میلیارد تومان سرمایه', source: 'ساتبا، وزارت نیرو' },
      { name: 'طرح برندسازی جهانی گلیم و پایگاه C2B نی‌ریز', value: 'P-03', unit: '۹۰ میلیارد تومان بودجه', source: 'میراث فرهنگی و ارشاد' },
      { name: 'مزارع پسته مقاوم به شوری آب قطرویه', value: 'P-04', unit: '۲۸۰ میلیارد تومان', source: 'جهاد کشاورزی فارس' },
      { name: 'طرح ژئوپارک ملی و تفریحی بختگان', value: 'P-05', unit: '۲۸۰ میلیارد تومان', source: 'مشارکت مردمی و خصوصی' }
    ],
    conclusions: [
      'خوشه صنعتی فروکروم و مزارع پسته شور-تحمل اهرم‌های اصلی جهش تولیدی منطقه در بعد کنش فرصت‌محور هستند.'
    ]
  },
  {
    code: 'C32',
    name: 'کنش × استعداد',
    dimension: 'Acting',
    side: 'Talent',
    score: 0.41,
    level: 'low',
    indicators: [
      { name: 'مدرسه عالی مهندسی معدن و زمین‌شناسی', value: 'T-01', unit: '۳۲۰ میلیارد تومان', source: 'دانشگاه شیراز و ایمیدرو' },
      { name: 'آکادمی گلیم با گواهی رسمی یونسکو', value: 'T-02', unit: '۴۵ میلیارد تومان', source: 'یونسکو و میراث فرهنگی' },
      { name: 'طرح مشوق‌های بازگشت نخبگان «نی‌ریز من»', value: 'T-03', unit: '۱۸۰ میلیارد تومان', source: 'بنیاد نخبگان فارس' },
      { name: 'مرکز نوآوری زنجیره ارزش پسته و فناوری دارویی', value: 'T-04', unit: '۱۱۰ میلیارد تومان', source: 'معاونت علمی و فناوری' },
      { name: 'آموزش و شبکه‌سازی راهنمایان عشایر قشقایی', value: 'T-05', unit: '۱۲ میلیارد تومان', source: 'سازمان امور عشایر' }
    ],
    conclusions: [
      'تاسیس آکادمی گلیم یونسکو و مدرسه معدن برای رفع ناترازی شدید مهارتی کارگزاران بومی.'
    ]
  },
  {
    code: 'C33',
    name: 'کنش × نیاز',
    dimension: 'Acting',
    side: 'Need',
    score: 0.71,
    level: 'critical',
    indicators: [
      { name: 'برنامه احیای بیولوژیک و هیدرولوژیک تالاب بختگان', value: 'N-01', unit: '۱۸۰۰ میلیارد تومان', source: 'محیط زیست و جهاد کشاورزی' },
      { name: 'طرح کرشمه آبیاری هوشمند و تحت فشار با سنسور', value: 'N-02', unit: '۹۲۰ میلیارد تومان', source: 'جهاد کشاورزی فارس' },
      { name: 'طرح توسعه فیبر نوری ۸۲ روستای بخش پشتکوه', value: 'N-03', unit: '۴۲۰ میلیارد تومان', source: 'وزارت ارتباطات و فناوری اطلاعات' },
      { name: 'واحدهای تله‌مدیسین و پزشکی متحرک قطب‌های کویری', value: 'N-04', unit: '۹۸ میلیارد تومان', source: 'دانشگاه علوم پزشکی شیراز' },
      { name: 'مسکن نوین جوانان و کارگاه‌های معیشت‌محور عشایری', value: 'N-05', unit: '۱۱۰۰ میلیارد تومان', source: 'بنیاد مسکن و امور عشایر' }
    ],
    conclusions: [
      'طرح کرشمه آبیاری هوشمند و برنامه احیای تالاب بختگان جهت جلوگیری از فاجعه زیست‌محیطی کانون ریزگردهای نمکی.'
    ]
  }
];

// === 15 CELLS OF RGF-3D FRAMEWORK MATRIX (Pages 29-31) ===
export const neyrizFrameworkCells: FrameworkCell[] = [
  {
    code: 'X1S1',
    dimension: 'Sensing',
    domain: 'natural',
    name: 'شناخت × منابع طبیعی',
    indicators: ['بیلان آب حوضه تالاب بختگان دشت', 'NDVI پوشش گیاهی و فرونشست زمین', 'ذخایر کرومیت و کاربری اراضی'],
    source: 'سنجش از دور (Landsat/Sentinel)',
    value: '۹,۸۰۰ هکتار از تالاب بختگان فعال است (کاهش ۸۰٪ نسبت به پایداری)'
  },
  {
    code: 'X2S1',
    dimension: 'Reasoning',
    domain: 'natural',
    name: 'تحلیل × منابع طبیعی',
    indicators: ['شاخص ظرفیت برد اکولوژیک (CC)', 'ردپای آب، کربن و ریسک بلایا', 'شاخص فشار محیطی (EPI)'],
    source: 'مدل‌سازی اقلیمی WEAP & InVEST',
    value: 'EPI برابر ۰.۷۹ (وضعیت قرمز بحرانی ناترازی شدید آبخوان)'
  },
  {
    code: 'X3S1',
    dimension: 'Acting',
    domain: 'natural',
    name: 'کنش × منابع طبیعی',
    indicators: ['هکتار احیای پوشش گیاهی در سال', 'پروژه‌های آبخیزداری و طرح احیا', 'کاهش مصرف آب کشاورزی'],
    source: 'طرح آمایش و ممیزی زیست‌محیطی',
    value: 'احیای ۳۰,۰۰۰ هکتار مرتع با مشارکت عشایر و قرق مشارکتی پشتکوه'
  },
  {
    code: 'X1S2',
    dimension: 'Sensing',
    domain: 'economy',
    name: 'شناخت × اقتصاد و معیشت',
    indicators: ['GRDP سرانه شهرستان نی‌ریز', 'سهم بخش‌ها در اشتغال', 'تراکم کسب‌وکار و تراکنش بانکی'],
    source: 'مرکز آمار و گمرک ایران، ۱۴۰۲',
    value: 'سرانه GRDP برابر ۳۲ میلیون تومان (کمتر از متوسط استان فارس)'
  },
  {
    code: 'X2S2',
    dimension: 'Reasoning',
    domain: 'economy',
    name: 'تحلیل × اقتصاد و معیشت',
    indicators: ['ضریب مکانی (LQ) محصولات', 'پیچیدگی اقتصادی منطقه (ECI)', 'زنجیره ارزش و مدل ورودی-خروجی'],
    source: 'کتابخانه اطلس پیچیدگی اقتصادی',
    value: 'LQ کرومیت برابر ۲۴.۷ (بسیار بالا)؛ تله منابع به علت خام‌فروشی'
  },
  {
    code: 'X3S2',
    dimension: 'Acting',
    domain: 'economy',
    name: 'کنش × اقتصاد و معیشت',
    indicators: ['سبد طرح‌های سرمایه‌گذاری مصوب', 'نرخ رشد GRDP و ایجاد اشتغال', 'خوشه‌های صادراتی فعال شده'],
    source: 'سامانه سپ، وزارت صمت',
    value: 'تعریف سبد سرمایه‌گذاری خوشه فرو-کروم به ارزش ۴,۵۰۰ میلیارد تومان'
  },
  {
    code: 'X1S3',
    dimension: 'Sensing',
    domain: 'social',
    name: 'شناخت × انسان و جامعه',
    indicators: ['جمعیت و هرم سنی شهرستان', 'شاخص توسعه انسانی (HDI) محلی', 'درصد عشایر کوچرو ایل قشقایی'],
    source: 'سرشماری عمومی و اداره عشایری',
    value: 'جمعیت ۱۵۵,۲۰۰ نفر، میانگین سنی ۳۲.۸ سال، ۶.۳٪ عشایر کوچرو'
  },
  {
    code: 'X2S3',
    dimension: 'Reasoning',
    domain: 'social',
    name: 'تحلیل × انسان و جامعه',
    indicators: ['شاخص فقر چندبعدی (MPI) روستاها', 'شکاف جنسیتی مشارکت اقتصادی', 'پیش‌بینی مهاجرت نخبگان ۵ساله'],
    source: 'روش OPHI و مدل گرانش جمعیتی',
    value: 'MPI تالاب بختگان ۰.۲۸، تمرکز ۶۲٪ فقر چندبعدی در پشتکوه'
  },
  {
    code: 'X3S3',
    dimension: 'Acting',
    domain: 'social',
    name: 'کنش × انسان و جامعه',
    indicators: ['برنامه‌های توانمندسازی زنان گلیم‌باف', 'پوشش بیمه اجتماعی کارگری', 'طرح اسکان داوطلبانه عشایر'],
    source: 'وزارت تعاون، کار و رفاه اجتماعی',
    value: 'طرح توان‌افزایی ۲,۲۰۰ زن بافنده همراه با بازاریابی و ثبت یونسکو'
  },
  {
    code: 'X1S4',
    dimension: 'Sensing',
    domain: 'spatial',
    name: 'شناخت × زیرساخت و فضا',
    indicators: ['تراکم شبکه راه‌ها و دسترسی ریل', 'پوشش اینترنت پهن‌باند خانگی', 'تراکم انبار سرد سردخانه‌ای'],
    source: 'وزارت راه، نیرو و فناوری اطلاعات',
    value: 'تراکم راه آسفالته ۰.۱۸ (پایین)؛ صفر دسترسی به ایستگاه راه‌آهن'
  },
  {
    code: 'X2S4',
    dimension: 'Reasoning',
    domain: 'spatial',
    name: 'تحلیل × زیرساخت و فضا',
    indicators: ['تحلیل سازگاری مکانی (Suitability)', 'انزوای فضایی و بن‌بست ترانزیتی', 'گلوگاه‌های لجستیکی محور سیرجان'],
    source: 'تحلیل شبکه GIS و ترافیک کلان',
    value: 'انزوای شدید فضایی بخش پشتکوه با شاخص انزوای ۰.۳۸ (پایین)'
  },
  {
    code: 'X3S4',
    dimension: 'Acting',
    domain: 'spatial',
    name: 'کنش × زیرساخت و فضا',
    indicators: ['کیلومتر راه و ریل احداثی جدید', 'پوشش فیبر نوری سراسری روستاها', 'ظرفیت پست برق و نیروگاهی بادی'],
    source: 'طرح‌های آمایش استان، وزارت ارتباطات',
    value: 'طرح اضطراری فیبر نوری ۸۲ روستای پشتکوه با اعتبار ۴۲۰ میلیارد تومان'
  },
  {
    code: 'X1S5',
    dimension: 'Sensing',
    domain: 'governance',
    name: 'شناخت × حکمرانی و نهاد',
    indicators: ['تعداد دستگاه‌های دولتی فعال', 'تعداد سازمان‌های مردم‌نهاد فعال', 'درصد تحقق بودجه عمرانی استانی'],
    source: 'فرمانداری نی‌ریز و دیوان محاسبات',
    value: '۸۲ دستگاه با ۹۴۰ کارمند؛ درصد تحقق بودجه عمرانی ۶۷٪'
  },
  {
    code: 'X2S5',
    dimension: 'Reasoning',
    domain: 'governance',
    name: 'تحلیل × حکمرانی و نهاد',
    indicators: ['شاخص هم‌افزایی نهادی (ICI)', 'تحلیل ساختاری گلوگاه‌های مجوز', 'نقش ذی‌نفوذان و شوراها'],
    source: 'تحلیل شبکه ذی‌نفعان SNA و OECD',
    value: 'ICI برابر ۰.۴۲ (ناترازی شدید و تعامل ضعیف معدن-محیط زیست)'
  },
  {
    code: 'X3S5',
    dimension: 'Acting',
    domain: 'governance',
    name: 'کنش × حکمرانی و نهاد',
    indicators: ['طرح اصلاح فرایندهای صدور مجوز', 'سامانه شفافیت بودجه و دولت الکترونیک', 'تشکیل قرارگاه فرماندهی آمایش'],
    source: 'فرمانداری، پلتفرم آرا و وزارت کشور',
    value: 'تشکیل قرارگاه توسعه نی‌ریز با عضویت فرماندار، شهردار و دهیاران'
  }
];

// === 9 CAPITALS SCANNING VALUES (Page 31) ===
export const neyrizCapitals = [
  { code: 'K1', name: 'سرمایه طبیعی', score: 42, label: 'تنش شدید آبی بختگان، پتانسیل خورشیدی و کرومیت عالی', color: '#EF4444' },
  { code: 'K2', name: 'سرمایه انسانی', score: 61, label: 'نرخ باسوادی و نخبگان بالای دیاسپورا، کمبود مهارت معدن', color: '#F59E0B' },
  { code: 'K3', name: 'سرمایه فرهنگی', score: 78, label: 'آیین‌های قشقایی، میراث جهانی گلیم، انجیر تاریخی دیم', color: '#10B981' },
  { code: 'K4', name: 'سرمایه اقتصادی', score: 55, label: 'خام‌فروشی شدید کرومیت، ECI منفی، درآمد مطلوب انجیر', color: '#F59E0B' },
  { code: 'K5', name: 'سرمایه زیرساختی', score: 38, label: 'بن‌بست ریلی، پوشش اینترنت ضعیف روستاها، جاده‌های ترانزیت بحرانی', color: '#EF4444' },
  { code: 'K6', name: 'سرمایه اجتماعی', score: 64, label: 'پیوند عشایری و مذهبی مستحکم، نابرابری شهر-روستا', color: '#10B981' },
  { code: 'K7', name: 'سرمایه نهادی', score: 49, label: 'نبود مدیریت یکپارچه حوزه آبریز بختگان، همکاری ضعیف قوا', color: '#F59E0B' },
  { code: 'K8', name: 'سرمایه فناورانه', score: 31, label: 'فناوری بسیار سنتی کشاورزی و استخراج سنتی معادن کرومیت', color: '#EF4444' },
  { code: 'K9', name: 'استعدادی-آینده', score: 46, label: 'جمعیت جوان و مستعد، نیازمند هدایت و سرمایه عمرانی پایدار', color: '#F59E0B' }
];
