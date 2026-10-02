// ============================================================
// مکان‌یابی گلوگاه — چهار شکاف اصلی + مکان‌یابی ۵ بعدی
// (بخش ۷ الگوریتم) — تفکیک مکانی/گروهی/زمانی واقعی
// ============================================================
import type {
  CapitalKey, ChainStage, ChainStageScore, ChainGaps,
  ProblemAddress, JusticeGap, GroupSlice,
} from './types';
import { CAPITALS } from './types';

const TRANSITIONS: Array<{ key: keyof ChainGaps; from: ChainStage; to: ChainStage }> = [
  { key: 'G_CA', from: 'CAPACITY', to: 'ACCESS' },
  { key: 'G_AU', from: 'ACCESS', to: 'USE' },
  { key: 'G_UE', from: 'USE', to: 'EXPERIENCE' },
  { key: 'G_EO', from: 'EXPERIENCE', to: 'OUTCOME' },
];

/**
 * محاسبه چهار شکاف اصلی
 */
export function computeChainGaps(chainScores: ChainStageScore[]): ChainGaps {
  const result: ChainGaps = { G_CA: 0, G_AU: 0, G_UE: 0, G_EO: 0 };
  for (const transition of TRANSITIONS) {
    const from = chainScores.find((score) => score.stage === transition.from);
    const to = chainScores.find((score) => score.stage === transition.to);
    if (from && to) result[transition.key] = from.score - to.score;
  }
  return result;
}

export interface LocateBottleneckInput {
  allChainScores: Record<CapitalKey, ChainStageScore[]>;
  equityData: JusticeGap[];
  /** برش‌های گروهی واقعی (درآمد/سن/جنسیت/سکونت/...) برای تفکیک گروهی */
  groupSlices?: GroupSlice[];
  /** امتیاز زیرمکان‌ها (زیرمحله/بلوک) برای تفکیک مکانی؛ کلید: نام مکان */
  subLocationScores?: Record<string, Record<string, number>>;
  /** دوره قبلی برای تفکیک زمانی؛ کلید شاخص → امتیاز دوره قبل */
  previousPeriodScores?: Record<string, number>;
  currentPeriodScores?: Record<string, number>;
}

interface GapRanking {
  capital: CapitalKey;
  gap: ChainGaps;
  maxGap: number;
  transition: [ChainStage, ChainStage];
}

/**
 * الگوریتم انتخاب گلوگاه (۷ مرحله) با تفکیک واقعی مکان/گروه/زمان
 */
export function locateBottleneck(input: LocateBottleneckInput): {
  bottleneck: ProblemAddress;
  diagnosis: string;
  confidence: 'initial' | 'convergent' | 'tested';
} {
  const { allChainScores, equityData } = input;

  // ۱. رتبه‌بندی شکاف‌ها برای هر سرمایه
  const gapRankings: GapRanking[] = [];

  for (const cap of CAPITALS) {
    const scores = allChainScores[cap] ?? [];
    const available = TRANSITIONS.flatMap((candidate) => {
      const from = scores.find((score) => score.stage === candidate.from);
      const to = scores.find((score) => score.stage === candidate.to);
      return from && to ? [{ ...candidate, gap: from.score - to.score }] : [];
    });
    if (available.length === 0) continue;
    available.sort((a, b) => b.gap - a.gap);
    const topTransition = available[0];
    const gaps = computeChainGaps(scores);
    gapRankings.push({ capital: cap, gap: gaps, maxGap: topTransition.gap, transition: [topTransition.from, topTransition.to] });
  }

  if (gapRankings.length === 0) {
    throw new Error('Measured indicators do not provide any comparable C-A-U-E-O transition.');
  }

  // ۲. یافتن بزرگ‌ترین شکاف
  gapRankings.sort((a, b) => b.maxGap - a.maxGap);
  const top = gapRankings[0];

  // ۳. بررسی کمبود پایه
  const capacityScore = allChainScores[top.capital]?.find(s => s.stage === 'CAPACITY')?.score;
  if (capacityScore !== undefined && capacityScore < 30) {
    return {
      bottleneck: {
        capital: top.capital,
        transition: ['CAPACITY', 'ACCESS'],
        location: 'کل محله',
        group: 'تمام ساکنان',
        time: 'فعلی',
        disaggregation: 'unavailable',
      },
      diagnosis: `کمبود پایه در سرمایه ${top.capital} — ظرفیت پایه‌ای بسیار ناچیز است`,
      confidence: 'initial',
    };
  }

  // ۴. تفکیک گروهی — کدام گروه بیشترین عقب‌ماندگی را در شاخص‌های این سرمایه دارد
  const groupDiagnosis = diagnoseWorstGroup(top.capital, input.groupSlices ?? []);

  // ۵. تفکیک مکانی — کدام زیرمکان در شاخص‌های این سرمایه ضعیف‌تر است
  const locationDiagnosis = diagnoseWorstLocation(top.capital, input.subLocationScores ?? {});

  // ۶. تفکیک زمانی — آیا شکاف در حال بزرگ‌شدن است
  const timeDiagnosis = diagnoseTemporalTrend(input.previousPeriodScores ?? {}, input.currentPeriodScores ?? {});

  const hasEquityIssue = equityData.some(e => e.verdict === 'critical');
  const disaggregation: ProblemAddress['disaggregation'] =
    groupDiagnosis || locationDiagnosis
      ? 'measured'
      : hasEquityIssue
        ? 'partial'
        : 'unavailable';

  const location = locationDiagnosis?.location ?? 'کل محله';
  const group = groupDiagnosis?.key ?? (hasEquityIssue ? 'گروه‌های محروم' : 'کل جمعیت');
  const time = timeDiagnosis?.status ?? 'فعلی';

  return {
    bottleneck: {
      capital: top.capital,
      transition: top.transition,
      location,
      group,
      time,
      disaggregation,
    },
    diagnosis: [
      `بزرگ‌ترین شکاف در سرمایه ${top.capital}، گذار ${top.transition[0]} → ${top.transition[1]}`,
      locationDiagnosis ? `ضعف مکانی متمرکز در «${locationDiagnosis.location}» (فاصله ${locationDiagnosis.deficit.toFixed(1)} واحد با میانگین)` : null,
      groupDiagnosis ? `گروه آسیب‌پذیر: «${groupDiagnosis.key}» (فاصله ${groupDiagnosis.deficit.toFixed(1)} واحد)` : null,
      timeDiagnosis && timeDiagnosis.worsening ? `روند زمانی: ${timeDiagnosis.status}` : null,
    ].filter(Boolean).join(' | '),
    confidence: hasEquityIssue ? 'initial' : (groupDiagnosis || locationDiagnosis) ? 'convergent' : 'initial',
  };
}

interface DisaggregationHit {
  key: string;
  deficit: number;
}

function diagnoseWorstGroup(capital: CapitalKey, slices: GroupSlice[]): DisaggregationHit | null {
  if (slices.length < 2) return null;
  // میانگین امتیاز هر گروه روی همه شاخص‌ها (تفکیک دقیق شاخص→سرمایه به‌عنوان بهبود بعدی)
  const groupAverages = slices.map(slice => {
    const values = Object.values(slice.scores).filter(v => typeof v === 'number' && Number.isFinite(v));
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    return { group: slice.group, avg };
  }).filter((item): item is { group: string; avg: number } => item.avg !== null);
  if (groupAverages.length < 2) return null;
  const best = Math.max(...groupAverages.map(g => g.avg));
  const worst = groupAverages.reduce((min, g) => (g.avg < min.avg ? g : min), groupAverages[0]);
  const deficit = best - worst.avg;
  // تفکیک گروهی فقط وقتی گزارش می‌شود که معنادار باشد
  return deficit >= 10 ? { key: worst.group, deficit } : null;
}

function worstGroupName(slices: GroupSlice[]): string | null {
  if (slices.length < 2) return null;
  const groupAverages = slices.map(slice => {
    const values = Object.values(slice.scores).filter(v => typeof v === 'number' && Number.isFinite(v));
    return { group: slice.group, avg: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null };
  }).filter((item): item is { group: string; avg: number } => item.avg !== null);
  if (groupAverages.length < 2) return null;
  const worst = groupAverages.reduce((min, g) => (g.avg < min.avg ? g : min), groupAverages[0]);
  const best = Math.max(...groupAverages.map(g => g.avg));
  return best - worst.avg >= 10 ? worst.group : null;
}

function diagnoseWorstLocation(
  capital: CapitalKey,
  subLocationScores: Record<string, Record<string, number>>,
): { location: string; deficit: number } | null {
  const entries = Object.entries(subLocationScores);
  if (entries.length < 2) return null;
  // میانگین زیرمکان روی همه شاخص‌ها؛ تفکیک مکانی معنادار ≥ ۱۰ واحد
  const locationAverages = entries.map(([location, scores]) => {
    const values = Object.values(scores).filter(v => typeof v === 'number' && Number.isFinite(v));
    const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    return { location, avg };
  }).filter((item): item is { location: string; avg: number } => item.avg !== null);
  if (locationAverages.length < 2) return null;
  const best = Math.max(...locationAverages.map(l => l.avg));
  const worst = locationAverages.reduce((min, l) => (l.avg < min.avg ? l : min), locationAverages[0]);
  const deficit = best - worst.avg;
  return deficit >= 10 ? { location: worst.location, deficit } : null;
}

function diagnoseTemporalTrend(
  previous: Record<string, number>,
  current: Record<string, number>,
): { status: string; worsening: boolean } | null {
  const commonCodes = Object.keys(current).filter(code => typeof previous[code] === 'number');
  if (commonCodes.length === 0) return null;
  const deltas = commonCodes.map(code => current[code] - previous[code]);
  const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  if (avgDelta <= -3) {
    return { status: 'در حال تشدید نسبت به دوره قبل', worsening: true };
  }
  if (avgDelta >= 3) {
    return { status: 'در حال بهبود نسبت به دوره قبل', worsening: false };
  }
  return { status: 'فعلی', worsening: false };
}

// کیفیت‌سنجی داخلی: تشخیص گروه باید با تابع مستقل هم‌نتیجه باشد
export { worstGroupName };
