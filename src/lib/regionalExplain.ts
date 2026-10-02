// ============================================================
// پرس‌وجوی هوشمند زبان طبیعی (NLQ) صفحهٔ برنامه‌ریزی منطقه‌ای — حکیم
// پرامپت بر پایهٔ «محرک‌های توسعهٔ منطقه‌ای» کاتالوگ مادر
// (بخش regional_development_drivers — ۲۷۲ محرک در ۱۲ خوشه) ساخته می‌شود
// تا تفسیر پرس‌وجو، تنظیم وزن‌ها و پیشنهاد کاندیدها مستند به همان
// چارچوب علّیِ توسعهٔ منطقه‌ای باشد.
// ============================================================
import type { MatchCriterion, MatchCandidate } from '../types';
import { ALGORITHM_SPEC, type HakimGrounding } from './hakimGrounding';

export const REGIONAL_PRESETS = ['preset-balanced', 'preset-economic', 'preset-equity', 'preset-water', 'preset-fast'] as const;
export type RegionalPresetId = (typeof REGIONAL_PRESETS)[number];

export interface RegionalNLQResult {
  interpretation: string;
  matchedDrivers: Array<{ code: string; name: string; cluster: string; relevance: string }>;
  suggestedPreset: RegionalPresetId | null;
  weightAdjustments: Array<{ criterionId: string; delta: number; reason: string }>;
  recommendedCandidateIds: string[];
  reasoning: string;
  risks: string[];
}

export function buildRegionalNLQMessages(
  query: string,
  criteria: MatchCriterion[],
  candidates: MatchCandidate[],
  grounding?: HakimGrounding,
): { system: string; user: string } {
  const system =
    'تو «حکیم» هستی، تحلیلگر ارشد توسعهٔ منطقه‌ای در سامانه آرا (ISGP) و کارشناس موتور تطبیق «پروژه←مکان». وظیفه‌ات تفسیر پرس‌وجوی زبان طبیعی کاربر، انطباق آن با «محرک‌های توسعهٔ منطقه‌ای» کاتالوگ مرجع، و ارائهٔ تنظیم وزن معیارها و کاندیدهای پیشنهادی — همه مستند به داده‌های واقعی صفحه. ' +
    'پاسخ را فقط و فقط به‌صورت یک JSON معتبر برگردان (بدون متن اضافه یا قاب کد) با این ساختار دقیق:\n' +
    '{\n' +
    '  "interpretation": "تفسیر پرس‌وجو در ۱ تا ۲ جمله",\n' +
    '  "matchedDrivers": [{"code": "کد محرک از کاتالوگ منطقه‌ای", "name": "نام محرک", "cluster": "خوشه", "relevance": "نقش آن در این پرس‌وجو"}],  // ۲ تا ۵ مورد\n' +
    '  "suggestedPreset": null | "preset-balanced" | "preset-economic" | "preset-equity" | "preset-water" | "preset-fast",\n' +
    '  "weightAdjustments": [{"criterionId": "شناسهٔ معیار", "delta": عدد بین ۱۰- تا ۱۰+ (تغییر وزن پیشنهادی)، "reason": "دلیل"}],\n' +
    '  "recommendedCandidateIds": ["شناسهٔ کاندید"],\n' +
    '  "reasoning": "استدلال مستند به اعداد در ۲ تا ۳ جمله",\n' +
    '  "risks": ["ریسک یا ملاحظه"]\n' +
    '}\n\n' +
    '[محرک‌های توسعهٔ منطقه‌ای — کاتالوگ مرجع برای ارجاع دقیق]\\n' +
    (grounding?.regionalDigest || 'کاتالوگ منطقه‌ای در دسترس نبود.') +
    '\n\n[الگوریتم مرجع گونه‌بندی محلات — برای انسجام روش‌شناختی]\n' +
    ALGORITHM_SPEC;

  const user =
    `پرس‌وجوی کاربر: «${query}»\n\n` +
    `— معیارهای فعلی موتور تطبیق (شناسه | نام | خانواده | وزن | جهت | قید سخت) —\n` +
    criteria
      .map(
        (c) =>
          `- ${c.id} | ${c.name} | ${c.familyName} | وزن ${c.weight} | ${c.direction === 'max' ? 'بیشتر بهتر' : 'کمتر بهتر'}${c.isHardConstraint ? ` | قید سخت${c.hardConstraintThreshold != null ? ` آستانه ${c.hardConstraintThreshold}` : ''}` : ''}`,
      )
      .join('\n') +
    `\n\n— کاندیدهای فعلی (شناسه | نام | استان | طرح | امتیاز کل | اعتماد) —\n` +
    candidates
      .map((c) => `- ${c.id} | ${c.cellName} | ${c.province} | ${c.planTitle} | امتیاز ${c.totalScore} | اعتماد ${c.confidence}٪`)
      .join('\n') +
    `\n\nپیشنهادها را فقط با شناسه‌های واقعی بالا بده؛ هیچ شناسه‌ای جعل نکن. برای ارجاع محرک‌ها فقط از شناسه‌های کاتالوگ منطقه‌ای (مثل ECON-01، INFRA-01، ENV-01) استفاده کن.`;

  return { system, user };
}

// ─── پاسخ محلی قطعی (وقتی سرویس برخط در دسترس نیست) ──────────
const TOPIC_PRESETS: Array<{ keys: RegExp; preset: RegionalPresetId; interpretation: string; drivers: Array<{ code: string; name: string; cluster: string; relevance: string }>; adjustments: Array<{ criterionId: string; delta: number; reason: string }> }> = [
  {
    keys: /کم‌آب|آب|اقلیم|خشک|فرونشست|پساب/i,
    preset: 'preset-water',
    interpretation: 'پرس‌وجو حول پایداری آب و مخاطرات اقلیمی می‌چرخد؛ وزن معیارهای آب و مخاطرات بالا می‌رود.',
    drivers: [
      { code: 'ENV-01', name: 'دسترسی‌پذیری و تناسب اگرواکولوژیک اراضی زراعی', cluster: 'سرمایه طبیعی و محیط‌زیست', relevance: 'سنجش تناسب زمین با محدودیت منابع آب' },
      { code: 'ENV-02', name: 'ظرفیت اگرو-اقلیمی رشد', cluster: 'سرمایه طبیعی و محیط‌زیست', relevance: 'رژیم دما و طول فصل رویش' },
      { code: 'INFRA-01', name: 'دسترسی به بندر و عملکرد لجستیک', cluster: 'زیرساخت و اتصال‌پذیری', relevance: 'مسیرهای جایگزین در شرایط تنش آبی' },
    ],
    adjustments: [
      { criterionId: 'crit-water', delta: 10, reason: 'اولویت سخت‌گیری بر منابع آب تجدیدپذیر' },
      { criterionId: 'crit-hazard', delta: 10, reason: 'کاهش ریسک فرونشست و مخاطرات اقلیمی' },
    ],
  },
  {
    keys: /محروم|عدالت|بومی|اشتغال منطقه|جوان/i,
    preset: 'preset-equity',
    interpretation: 'پرس‌وجو عدالت‌محور و متمرکز بر محرومیت‌زدایی و اشتغال بومی است.',
    drivers: [
      { code: 'DEM-01', name: 'نسبت وابستگی جوانان', cluster: 'جمعیت‌شناختی', relevance: 'فرصت جمعیتی جوان برای اشتغال' },
      { code: 'HC-01', name: 'میانگین سال‌های تحصیل جمعیت بزرگسال', cluster: 'سرمایه انسانی', relevance: 'ظرفیت نیروی کار بومی' },
      { code: 'INST-01', name: 'اثربخشی دولت زیرملی', cluster: 'نهادی و حکمرانی', relevance: 'ظرفیت اجرای طرح در منطقه محروم' },
    ],
    adjustments: [
      { criterionId: 'crit-deprivation', delta: 10, reason: 'تمرکز بر مناطق محروم' },
      { criterionId: 'crit-skill', delta: 8, reason: 'مهارت بومی به‌عنوان ظرفیت اشتغال' },
    ],
  },
  {
    keys: /اقتصاد|صرفه|بازار|سود|بهره‌وری|زنجیره|صادرات/i,
    preset: 'preset-economic',
    interpretation: 'پرس‌وجو حداکثر بازده اقتصادی و صرفه‌های مقیاس/بازار را هدف گرفته است.',
    drivers: [
      { code: 'ECON-01', name: 'بهره‌وری نیروی کار (ارزش افزوده به ازای هر شاغل)', cluster: 'اقتصادی و بهره‌وری', relevance: 'بازده سرمایه‌گذاری در نیروی کار' },
      { code: 'FIN-01', name: 'ضریب نفوذ اعتبارات/تسهیلات بخش خصوصی', cluster: 'مالی و سرمایه‌گذاری', relevance: 'دسترسی مالی برای سرمایه‌گذاری' },
      { code: 'INFRA-01', name: 'دسترسی به بندر و عملکرد لجستیک', cluster: 'زیرساخت و اتصال‌پذیری', relevance: 'دسترسی به بازار صادراتی' },
    ],
    adjustments: [
      { criterionId: 'crit-agglomeration', delta: 10, reason: 'صرفه مقیاس و همجواری با خوشه‌های موجود' },
      { criterionId: 'crit-market-dist', delta: 8, reason: 'فاصله به بازار مصرف و بنادر صادراتی' },
    ],
  },
];

export function localRegionalNLQFallback(
  query: string,
  criteria: MatchCriterion[],
  candidates: MatchCandidate[],
): RegionalNLQResult {
  const topic = TOPIC_PRESETS.find((t) => t.keys.test(query)) ?? {
    preset: 'preset-balanced' as RegionalPresetId,
    interpretation: 'پرس‌وجو ماهیت متوازن دارد؛ وزن‌های پیش‌فرض حفظ و کاندیدهای با بالاترین امتیاز پیشنهاد می‌شوند.',
    drivers: [
      { code: 'ECON-01', name: 'بهره‌وری نیروی کار', cluster: 'اقتصادی و بهره‌وری', relevance: 'پایهٔ عمومی توسعهٔ منطقه‌ای' },
      { code: 'INFRA-01', name: 'دسترسی به بندر و عملکرد لجستیک', cluster: 'زیرساخت و اتصال‌پذیری', relevance: 'اتصال‌پذیری پایه' },
    ],
    adjustments: [],
  };

  const validIds = new Set(criteria.map((c) => c.id));
  const adjustments = topic.adjustments
    .filter((a) => validIds.has(a.criterionId))
    .map((a) => ({ ...a }));

  const top = [...candidates]
    .filter((c) => !c.isEliminated)
    .sort((x, y) => y.totalScore - x.totalScore)
    .slice(0, 2)
    .map((c) => c.id);

  return {
    interpretation: topic.interpretation,
    matchedDrivers: topic.drivers,
    suggestedPreset: topic.preset,
    weightAdjustments: adjustments,
    recommendedCandidateIds: top,
    reasoning: `بر اساس کلیدواژه‌های پرس‌وجو و «محرک‌های توسعهٔ منطقه‌ای»، پروفایل «${topic.preset}» پیشنهاد می‌شود و کاندیدهای با بالاترین امتیاز کل (${candidates.filter((c) => top.includes(c.id)).map((c) => `${c.cellName} ${c.totalScore}`).join(' و ')}) در اولویت‌اند.`,
    risks: ['سرویس برخط در دسترس نبود؛ این تحلیل بر پایهٔ قواعد قطعی و به‌صورت محلی تولید شد.'],
  };
}
