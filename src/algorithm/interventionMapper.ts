// ============================================================
// نگاشت تشخیص → خانواده مداخله (بخش ۹.۱ الگوریتم)
// + امتیاز اولویت واقعی: شدت × جمعیت × اهرم × امکان (× عدالت)
// + فیلترهای عدم‌مداخله (بخش ۹.۲)
// ============================================================
import type { ChainStage, CapitalKey, ChainGaps, DiagnosticType, InterventionCandidate, JusticeGap, LeverPoint } from './types';
import { CAPITAL_FA, CHAIN_FA } from './types';

export interface InterventionFamily {
  pattern: string;
  diagnosis: string;
  interventionFamily: string;
}

export const INTERVENTION_MAPPING: InterventionFamily[] = [
  { pattern: 'capacity_low', diagnosis: 'کمبود سرمایه پایه', interventionFamily: 'سرمایه‌گذاری زیرساختی، خدماتی، انسانی یا اقتصادی متناسب' },
  { pattern: 'capacity_high_access_low', diagnosis: 'ضعف توزیع یا اتصال', interventionFamily: 'عدالت فضایی، حمل‌ونقل، اطلاعات، استطاعت و دسترسی گروهی' },
  { pattern: 'access_high_use_low', diagnosis: 'اصطکاک استفاده', interventionFamily: 'طراحی، امنیت، نگهداری، هزینه، ساعات فعالیت و تناسب خدمت' },
  { pattern: 'use_high_experience_low', diagnosis: 'کیفیت تجربه', interventionFamily: 'آسایش، امنیت، معنا، هویت، اعتماد و مدیریت فضا' },
  { pattern: 'experience_high_outcome_low', diagnosis: 'شکست تبدیل تجربه به رفاه', interventionFamily: 'خدمات اجتماعی/اقتصادی و بررسی عوامل بیرونی از محله' },
  { pattern: 'capital_high_conversion_low', diagnosis: 'سرمایه محبوس', interventionFamily: 'شبکه‌سازی، هماهنگی، حکمرانی و اتصال سرمایه‌ها' },
  { pattern: 'all_high_reproduction_low', diagnosis: 'مصرف سرمایه', interventionFamily: 'پایدارسازی، یادگیری و جلوگیری از فرسایش/طرد' },
  { pattern: 'average_high_equity_low', diagnosis: 'حذف گروه یا مکان', interventionFamily: 'اقدام هدفمند برای گروه محروم و رفع مانع اختصاصی' },
  { pattern: 'problem_gap_increasing', diagnosis: 'قواعد فعلی ناکافی', interventionFamily: 'بازطراحی ساختار یا تحول قواعد، نه صرفاً افزایش بودجه' },
];

// ─── اهرم‌های هشت سرمایه ──────────────────────────────────────
export const CAPITAL_LEVERS: Record<CapitalKey, string> = {
  H: 'پیوند مهارت با بازار، کارآفرینی و اشتغال پایدار',
  S: 'تسهیلگری، پروژه کوچک مشترک، شبکه همکاری و نهاد توسعه محله',
  E: 'فرصت شغلی، حمایت از کسب‌وکار محلی، اعتبار خرد، استطاعت مسکن',
  P: 'ایمن‌سازی بنا، پیوستگی مسیر، بهسازی هدفمند، فضای عمومی قابل استفاده',
  N: 'دسترسی و فعال‌سازی فضای سبز، کاهش آلودگی و خطر، افزایش تاب‌آوری',
  C: 'فعال‌سازی میراث، روایت محله، هنر، بازار و انتقال هویت به نسل بعد',
  G: 'مشارکت واقعی، پاسخگویی، اتاق هماهنگی، ظرفیت اجرا، پایش و یادگیری',
  R: 'اتصال به شغل، بازار، دانش، حمل‌ونقل، نهاد تخصصی و شبکه دیجیتال',
};

/** اهرم چندگانه: هر سرمایه بر کدام سرمایه‌های دیگر اثر چندگانه دارد (بخش ۱۲ جزء ۸) */
const CAPITAL_SPILLOVER: Record<CapitalKey, CapitalKey[]> = {
  H: ['E', 'S', 'R'],
  S: ['G', 'C', 'N'],
  E: ['H', 'P', 'R'],
  P: ['N', 'E', 'S'],
  N: ['P', 'H'],
  C: ['S', 'G'],
  G: ['S', 'E', 'H', 'N', 'C', 'R'],
  R: ['E', 'H', 'G'],
};

// ─── محاسبه فاکتورهای اولویت از داده واقعی ──────────────────

/** شدت: فاصله امتیاز سرمایه از آستانه مداخله (۷۵) */
function computeSeverity(capitalScore: number): number {
  return Math.max(0, Math.min(1, (75 - capitalScore) / 75));
}

/** جمعیت: طبق داده ساکنان؛ در نبود آن، وزن برابر نسبی (برچسب‌خورده، نه جعل) */
function computePopulation(population?: number): number {
  if (typeof population === 'number' && Number.isFinite(population) && population > 0) {
    // نرمال‌سازی لجستیک: ۵۰۰ نفر≈۰.۳ ، ۵۰۰۰≈۰.۶ ، ۲۰۰۰۰+≈۰.۹۵
    return Math.max(0.05, Math.min(0.95, population / (population + 4000)));
  }
  return 0.5; // مقدار خنثی ثبت‌شده به‌عنوان «بدون داده جمعیت»
}

/** اهرم: ظرفیت اثر چندگانه سرمایه بر سایر سرمایه‌ها + عمق شکاف گذار هدف */
function computeLeverage(capitalKey: CapitalKey, gapMagnitude: number): number {
  const spillover = CAPITAL_SPILLOVER[capitalKey].length / 6; // G بیشترین اثر منتشرشده
  const gapDepth = Math.max(0, Math.min(1, gapMagnitude / 25));
  return Math.max(0.1, Math.min(1, 0.4 + 0.4 * spillover + 0.2 * gapDepth));
}

/** امکان اجرا: سرمایه G قوی‌تر اجرا را ممکن می‌کند؛ شکاف خیلی بزرگ امکان را کم می‌کند */
function computeFeasibility(governanceScore: number, gapMagnitude: number): number {
  const governance = Math.max(0, Math.min(1, governanceScore / 100));
  const scalePenalty = Math.max(0, Math.min(0.4, (gapMagnitude - 10) / 50));
  return Math.max(0.1, Math.min(1, 0.3 + 0.5 * governance - scalePenalty + 0.1));
}

/** عدالت: اگر شکاف عدالتی بحرانی روی همین سرمایه باشد، اقدام هدفمند اولویت می‌گیرد */
function computeEquityFactor(
  capitalKey: CapitalKey,
  equityGaps: JusticeGap[],
  capitalIndicatorCodes: Map<CapitalKey, string[]>,
): number {
  const codes = capitalIndicatorCodes.get(capitalKey) ?? [];
  const criticalOnCapital = equityGaps.filter(g => g.verdict === 'critical' && codes.includes(g.indicatorCode)).length;
  const anyCritical = equityGaps.some(g => g.verdict === 'critical');
  if (criticalOnCapital > 0) return 1.0;
  if (anyCritical) return 0.8;
  return 0.6;
}

export interface GenerateInterventionsInput {
  gaps: ChainGaps;
  diagnosticType: DiagnosticType;
  capitalScores: Record<CapitalKey, number>;
  chainScores?: Partial<Record<CapitalKey, Array<{ stage: ChainStage; score: number }>>>;
  equityGaps?: JusticeGap[];
  capitalIndicatorCodes?: Map<CapitalKey, string[]>;
  population?: number;
}

const GAP_THRESHOLD = 8; // آستانه شکاف معنادار (هماهنگ با GapAnalysisChart)

/**
 * تولید سبد مداخله با امتیاز اولویت واقعی و فیلترهای عدم‌مداخله
 */
export function generateInterventionCandidates(
  input: GenerateInterventionsInput,
): InterventionCandidate[] {
  const { gaps, diagnosticType, capitalScores } = input;
  const equityGaps = input.equityGaps ?? [];
  const capitalIndicatorCodes = input.capitalIndicatorCodes ?? new Map();

  const candidates: InterventionCandidate[] = [];
  let id = 1;

  for (const [cap, lever] of Object.entries(CAPITAL_LEVERS) as [CapitalKey, string][]) {
    const score = capitalScores[cap] ?? 50;
    const severity = computeSeverity(score);

    // بزرگ‌ترین شکاف گذار این سرمایه (برای اهرم و گذار هدف)
    const capChain = input.chainScores?.[cap] ?? [];
    let targetTransition: [ChainStage, ChainStage] = ['CAPACITY', 'ACCESS'];
    let gapMagnitude = 0;
    const transitions: Array<[keyof ChainGaps, ChainStage, ChainStage]> = [
      ['G_CA', 'CAPACITY', 'ACCESS'],
      ['G_AU', 'ACCESS', 'USE'],
      ['G_UE', 'USE', 'EXPERIENCE'],
      ['G_EO', 'EXPERIENCE', 'OUTCOME'],
    ];
    for (const [key, from, to] of transitions) {
      const stageScore = capChain.find(s => s.stage === from);
      const nextScore = capChain.find(s => s.stage === to);
      if (stageScore && nextScore) {
        const g = stageScore.score - nextScore.score;
        if (g > gapMagnitude) {
          gapMagnitude = g;
          targetTransition = [from, to];
        }
      }
    }
    // اگر داده زنجیره این سرمایه موجود نباشد، شکاف خاصی ثبت نشده —
    // شکاف‌های تجمیعی به این سرمایه نسبت داده نمی‌شوند (بدون عددسازی)

    const population = computePopulation(input.population);
    const leverage = computeLeverage(cap, gapMagnitude);
    const feasibility = computeFeasibility(capitalScores.G ?? 50, gapMagnitude);
    const equity = computeEquityFactor(cap, equityGaps, capitalIndicatorCodes);

    const priorityScore = severity * population * leverage * feasibility;
    const priorityEquityAdjusted = priorityScore * equity;

    // ─── فیلترهای عدم‌مداخله ────────────────────────────────
    // ۱. پروژه بدون سنجش اثر: سرمایه‌ای که شکاف معناداری ندارد مداخله مستقل نمی‌گیرد
    const hasMeaningfulGap = severity > 0.05 || gapMagnitude > GAP_THRESHOLD / 2;
    // ۲. جابه‌جایی مسئله: تقویت یک سرمایه نباید سرمایه دیگر را نابود کند —
    //    اگر سرمایه هدف سالم (≥۷۵) ولی سرمایه هدفِ اهرم بحرانی است، اجرا منوط به بررسی
    const weakest = (Object.entries(capitalScores) as [CapitalKey, number][])
      .sort((a, b) => a[1] - b[1])[0];
    const shiftsProblem = score >= 75 && (weakest?.[1] ?? 100) < 25;

    // آیا در زنجیره، شکاف اندازه‌گیری‌شده‌ای وجود دارد؟ تعیین‌کننده تفکیک دو فیلتر است:
    // با شکاف سنجیده، سرمایه بی‌شکاف صرفاً «شکاف معناداری ندارد»؛ بدون هیچ شکاف سنجیده،
    // سرمایه سالمی که در کنار یک سرمایه بحرانی تقویت شود «ریسک جابه‌جایی مسئله» دارد.
    const hasMeasuredGap = gaps.G_CA > 0 || gaps.G_AU > 0 || gaps.G_UE > 0 || gaps.G_EO > 0;

    let excluded: InterventionCandidate['excluded'] = null;
    if (!hasMeaningfulGap) {
      excluded = shiftsProblem && !hasMeasuredGap
        ? {
            code: 'EQUITY_HARM_RISK',
            reason: `شکافی در زنجیره اندازه‌گیری نشده اما این سرمایه سالم است و سرمایه ${CAPITAL_FA[weakest[0]]} در وضعیت بحرانی قرار دارد — هدایت منابع به این سرمایه مسئله را جابه‌جا می‌کند`,
          }
        : {
            code: 'NO_MEANINGFUL_GAP',
            reason: 'شکاف معناداری برای این سرمایه اندازه‌گیری نشده است — مداخله مستقل توجیه ندارد (قاعده: پروژه بدون سنجش اثر ممنوع)',
          };
    } else if (shiftsProblem) {
      excluded = {
        code: 'EQUITY_HARM_RISK',
        reason: `این سرمایه سالم است اما سرمایه ${CAPITAL_FA[weakest[0]]} در وضعیت بحرانی قرار دارد — تقویت موازی لازم است تا مسئله جابه‌جا نشود`,
      };
    }

    candidates.push({
      id: `INT-${String(id++).padStart(3, '0')}`,
      name: `${CAPITAL_FA[cap]}: ${lever}`,
      targetCapital: cap,
      targetTransition,
      severity: Math.round(severity * 100) / 100,
      population: Math.round(population * 100) / 100,
      leverage: Math.round(leverage * 100) / 100,
      feasibility: Math.round(feasibility * 100) / 100,
      equity: Math.round(equity * 100) / 100,
      family: lever,
      description: lever,
      excluded,
      priorityScore: Math.round(priorityScore * 1000) / 1000,
      priorityEquityAdjusted: Math.round(priorityEquityAdjusted * 1000) / 1000,
    });
  }

  // خانواده مداخله بر اساس الگوی شکاف و تیپ تشخیصی به توصیف اقدام اول اضافه می‌شود
  const families = mapDiagnosisToIntervention(gaps, diagnosticType, capitalScores);
  if (candidates.length > 0 && families.length > 0) {
    candidates[0].description = `${families[0]} — ${candidates[0].description}`;
  }

  return candidates;
}

/**
 * نگاشت تشخیص به خانواده مداخله (۹ الگوی جدول الگوریتم)
 */
export function mapDiagnosisToIntervention(
  gaps: ChainGaps,
  diagnosticType: DiagnosticType,
  capitalScores: Record<CapitalKey, number>,
): string[] {
  const families: string[] = [];

  if (gaps.G_CA > 15) families.push(INTERVENTION_MAPPING[1].interventionFamily);
  if (gaps.G_AU > 15) families.push(INTERVENTION_MAPPING[2].interventionFamily);
  if (gaps.G_UE > 15) families.push(INTERVENTION_MAPPING[3].interventionFamily);
  if (gaps.G_EO > 15) families.push(INTERVENTION_MAPPING[4].interventionFamily);

  if (diagnosticType === 'A') families.push(INTERVENTION_MAPPING[0].interventionFamily);
  if (diagnosticType === 'B') families.push(INTERVENTION_MAPPING[5].interventionFamily);
  if (diagnosticType === 'C') families.push(INTERVENTION_MAPPING[6].interventionFamily);
  if (diagnosticType === 'E') families.push(INTERVENTION_MAPPING[7].interventionFamily);

  return [...new Set(families)];
}

/**
 * نقشه اهرم — متغیرهایی که اثر چندگانه دارند (جزء ۸ کارت تصمیم)
 */
export function buildLeverMap(
  capitalScores: Record<CapitalKey, number>,
  chainScores: Partial<Record<CapitalKey, Array<{ stage: ChainStage; score: number }>>>,
): LeverPoint[] {
  const levers: LeverPoint[] = [];
  for (const cap of Object.keys(CAPITAL_LEVERS) as CapitalKey[]) {
    const capChain = chainScores[cap] ?? [];
    // اهرم = گذاری که تقویت آن بیشترین انتشار را در زنجیره‌های دیگر دارد
    const transitions: Array<[ChainStage, ChainStage]> = [
      ['CAPACITY', 'ACCESS'], ['ACCESS', 'USE'], ['USE', 'EXPERIENCE'], ['EXPERIENCE', 'OUTCOME'],
    ];
    let bestStage: ChainStage = 'CAPACITY';
    let bestScore = -Infinity;
    for (const [from] of transitions) {
      const s = capChain.find(item => item.stage === from)?.score ?? capitalScores[cap] ?? 0;
      if (s > bestScore) { bestScore = s; bestStage = from; }
    }
    // اهرم واقعی: جایی که سرمایه نسبتاً قوی است (قابل آزادسازی) و اثر منتشرشده دارد
    const spillover = CAPITAL_SPILLOVER[cap];
    const strength = (capitalScores[cap] ?? 0) / 100;
    levers.push({
      id: `LEVER-${cap}`,
      capitalKey: cap,
      stage: bestStage,
      description: CAPITAL_LEVERS[cap],
      affectedCapitals: spillover,
      effectScore: Math.round((0.6 * strength + 0.4 * (spillover.length / 6)) * 100) / 100,
    });
  }
  return levers.sort((a, b) => b.effectScore - a.effectScore);
}
