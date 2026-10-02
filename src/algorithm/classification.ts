// ============================================================
// گونه‌بندی و ماتریس ۹ حالته (بخش ۸ سند)
// گونه درون‌لایه: score < 2.5 → ۱ | 2.5 ≤ s < 3.75 → ۲ | ≥ 3.75 → ۳
// ماتریس: کاهش هر لایه به ↑/↓ با آستانه ۳٫۰ → ۹ حالت تشخیص/تجویز
// ============================================================
import type { LayerKey, Prescription, Species } from './types';

export const SPECIES_THRESHOLDS = [2.5, 3.75] as const;
export const MATRIX_CUT = 3.0;

/** نگاشت نمره لایه به گونهٔ سه‌گانه */
export function classifyLayer(score: number, thresholds: readonly [number, number] = SPECIES_THRESHOLDS): Species {
  if (!Number.isFinite(score)) return 1;
  if (score < thresholds[0]) return 1;
  if (score < thresholds[1]) return 2;
  return 3;
}

export const SPECIES_FA: Record<LayerKey, Record<Species, string>> = {
  P: { 1: 'نهفته', 2: 'پهنه‌بین', 3: 'سراسربین' },
  B: { 1: 'بی‌تفاوت', 2: 'مستعد تعامل', 3: 'عامل' },
  N: { 1: 'پس‌رونده', 2: 'در حال گذار', 3: 'پیشرو' },
};

// ─── ماتریس ۹ حالته (بخش ۸.۲) ────────────────────────────────
export interface StatePrescription {
  stateId: number;
  key: string;
  diagnosis: string;
  intervention: string;
  twinTrack: boolean;
  targetScores: Partial<Record<LayerKey, number>>;
  exitKpi: string;
}

const STATE_MAP: Record<string, number> = {
  HHL: 1, HLL: 2, LHH: 3, LHL: 4, HLH: 0, // 0 = تفکیک با b_components (۵/۶)
  LLL: 7, HHH: 8, LLH: 9,
};

const PRESCRIPTIONS: Record<number, Omit<StatePrescription, 'stateId' | 'key'>> = {
  1: {
    diagnosis: 'گسست نهادی و خطر زوال (کالبد و رفتار خوب، هنجار ضعیف)',
    intervention: 'بازسازی تنظیمات نهادی؛ تقویت همیاری معتمدین (امام محله) و بازپیوند مردم–نهاد',
    twinTrack: false,
    targetScores: { N: 3.5 },
    exitKpi: 'افزایش شاخص اعتماد نهادی به ≥ ۳٫۵ و تثبیت مشارکت مدنی',
  },
  2: {
    diagnosis: 'زیرساخت پیشرفته، فقر سرمایه اجتماعی و نهادی',
    intervention: 'بازسازی سرمایه اجتماعی و تنظیمات نهادی؛ میانجی‌گری بین گروه‌ها و نهادهای محلی',
    twinTrack: false,
    targetScores: { B: 3.2, N: 3.5 },
    exitKpi: 'رشد تراکم تشکل/مشارکت به سطح «در حال گذار» در هر دو لایه',
  },
  3: {
    diagnosis: 'ظرفیت نهفته و آماده جهش (انزوای فیزیکی)',
    intervention: 'توسعه زیرساخت و تجهیز فناوری؛ تبدیل به پلتفرم تولید و اتصال به شبکه ملی',
    twinTrack: false,
    targetScores: { P: 3.5 },
    exitKpi: 'رفع انزوای فیزیکی؛ ضریب نفوذ زیرساخت ≥ ۸۰٪ و اتصال پهن‌باند پایدار',
  },
  4: {
    diagnosis: 'ظرفیت کنشگری بدون پشتیبان نهادی',
    intervention: 'توسعه زیرساخت + میانجی‌گری کنشگران↔نهاد برای تثبیت سرمایه اجتماعی',
    twinTrack: false,
    targetScores: { P: 3.2, N: 3.2 },
    exitKpi: 'هم‌زمانی بهره‌برداری زیرساخت با رسمی‌شدن نهادهای محلی',
  },
  5: {
    diagnosis: 'کمبود مشارکت/سرمایه اجتماعی (کالبد و نهاد خوب)',
    intervention: 'افزایش انسجام اجتماعی؛ تقاطع‌گری بین گروه‌ها و نهادهای مشارکتی',
    twinTrack: false,
    targetScores: { B: 3.2 },
    exitKpi: 'افزایش نرخ مشارکت و پویایی اقتصادی به سطح «مستعد تعامل»',
  },
  6: {
    diagnosis: 'رکود معیشتی و قفل‌شدگی (Lock-in)',
    intervention: 'تغییر مسیر توسعه (Path Renewal)؛ ایجاد زنجیره ارزش و «تنوع مرتبط»',
    twinTrack: false,
    targetScores: { B: 3.5 },
    exitKpi: 'ظهور حداقل ۲ زنجیرهٔ ارزش جدید و رشد تراکم کسب‌وکار',
  },
  7: {
    diagnosis: 'محرومیت مطلق/نیازمند توسعه همه‌جانبه',
    intervention: 'مداخله همه‌جانبه با اولویت زیرساخت + میانجی‌گری و تقویت هم‌زمان هر سه لایه',
    twinTrack: false,
    targetScores: { P: 3.0, B: 3.0, N: 3.0 },
    exitKpi: 'خروج از محرومیت مطلق: SI ≥ ۳٫۰ و عبور از آستانهٔ هر سه لایه',
  },
  8: {
    diagnosis: 'پیشران (قطب پیشرفته)',
    intervention: 'شتاب‌دهی و الگوبرداری؛ آماده خروج تسهیلگر و انتقال تجربه به پهنه‌های مجاور',
    twinTrack: false,
    targetScores: { P: 4.2, B: 4.2, N: 4.2 },
    exitKpi: 'تثبیت سراسربین/عامل/پیشرو و آمادگی خروج کامل تسهیلگر',
  },
  9: {
    diagnosis: 'سرمایه معنوی نهفته (هنجار قوی، کالبد و رفتار ضعیف)',
    intervention: 'اهرم‌سازی سرمایه اجتماعی: تزریق هم‌زمان زیرساخت + حرفه‌آموزی با محوریت امام محله',
    twinTrack: true,
    targetScores: { P: 3.5, B: 3.5 },
    exitKpi: 'هم‌زمانی بهره‌برداری زیرساخت با آماده‌شدن مهارت‌آموزان (نقطه همگرایی حیاتی)',
  },
};

export interface MatrixResult {
  prescription: Prescription;
  levels: Record<LayerKey, 'H' | 'L'>;
  ambiguous: boolean; // امضای مشترک (↑,↓,↑) که با مؤلفه‌های B تفکیک شد
}

/**
 * تعیین حالت ۱..۹ ماتریس تصمیم.
 * برای امضای مشترک (H,L,H) با b_components تفکیک می‌کند:
 *   ضعف در «مسیر معیشت/زنجیره ارزش» → حالت ۶
 *   ضعف در «مشارکت/انسجام» → حالت ۵
 */
export function matrix9State(
  P: number,
  B: number,
  N: number,
  bComponents: { valueChain: number; cohesion: number },
  cut = MATRIX_CUT,
): MatrixResult {
  const lv = (s: number): 'H' | 'L' => (s >= cut ? 'H' : 'L');
  const levels = { P: lv(P), B: lv(B), N: lv(N) };
  const key = `${levels.P}${levels.B}${levels.N}`;

  let stateId = STATE_MAP[key] ?? 7;
  let ambiguous = false;

  if (key === 'HLH') {
    ambiguous = true;
    // ضعف در زنجیره ارزش (نسبت به انسجام) → رکود معیشتی (۶)؛ در غیر این صورت کمبود مشارکت (۵)
    stateId = bComponents.valueChain < bComponents.cohesion ? 6 : 5;
  }

  const base = PRESCRIPTIONS[stateId] ?? PRESCRIPTIONS[7];
  const prescription: Prescription = {
    stateId,
    key,
    diagnosis: base.diagnosis,
    intervention: base.intervention,
    budgetPriority: stateId === 9 || levels.N === 'H' ? 1 : levels.P === 'H' ? 2 : 3,
    twinTrack: base.twinTrack,
    targetScores: base.targetScores,
    exitKpi: base.exitKpi,
  };

  return { prescription, levels, ambiguous };
}

/** رنگ بندی چهارطبقه بر مبنای SI (بخش ۱۰.۱) */
export function siColor(si: number): { hex: string; label: string; cls: string } {
  if (!Number.isFinite(si) || si < 2.0) return { hex: '#E5484D', label: 'نیازمند مداخله فوری', cls: 'bg-red-500' };
  if (si < 3.0) return { hex: '#F5A524', label: 'نیازمند مداخله', cls: 'bg-orange-500' };
  if (si < 4.0) return { hex: '#E3C028', label: 'وضعیت نسبتاً مناسب', cls: 'bg-yellow-500' };
  return { hex: '#2E9E6B', label: 'وضعیت مناسب', cls: 'bg-green-500' };
}
