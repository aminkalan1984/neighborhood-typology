// ============================================================
// موتور تشخیص علّی — از شکاف به فرضیه (بخش ۸ الگوریتم)
// 8 نوع فرضیه رقیب + پروتکل ۹ مرحله‌ای
// ============================================================
import type {
  CausalHypothesis, FrictionType, ChainGaps, ProblemAddress,
  FourSourceEvidence, EvidenceStatus,
} from './types';

// ─── هشت نوع فرضیه رقیب ──────────────────────────────────────
export const HYPOTHESIS_CATALOG: Record<FrictionType, {
  name: string;
  description: string;
  diagnosticTests: string[];
  evidenceIndicators: string[];
}> = {
  cost: {
    name: 'هزینه',
    description: 'هزینه مالی مانع استفاده یا دسترسی است',
    diagnosticTests: ['داده درآمد خانوار', 'استطاعت مسکن', 'هزینه خدمات'],
    evidenceIndicators: ['E1', 'E4'],
  },
  insecurity: {
    name: 'ناامنی',
    description: 'احساس یا واقعیت ناامنی مانع حضور/استفاده است',
    diagnosticTests: ['پیمایش امنیت', 'داده جرم', 'روشنایی معابر'],
    evidenceIndicators: ['P1', 'S1'],
  },
  quality: {
    name: 'کیفیت/نگهداری',
    description: 'کیفیت پایین خدمات یا فضاها مانع استفاده است',
    diagnosticTests: ['ممیزی میدانی', 'رضایت کاربران', 'وضعیت تجهیزات'],
    evidenceIndicators: ['P3', 'C2'],
  },
  time: {
    name: 'زمان و ساعات فعالیت',
    description: 'ساعات فعالیت یا تأخیر خدمات نامناسب است',
    diagnosticTests: ['ساعات کاری', 'الگوی تردد', 'نیاز گروه‌ها'],
    evidenceIndicators: ['R1', 'R3'],
  },
  physical_barrier: {
    name: 'مانع فیزیکی',
    description: 'مانع ساختاری در مسیر دسترسی وجود دارد',
    diagnosticTests: ['نقشه موانع', 'پیمایش پیاده', 'مناسب‌سازی'],
    evidenceIndicators: ['P2', 'P5'],
  },
  information: {
    name: 'اطلاعات/اتصال',
    description: 'کمبود اطلاعات یا آگاهی مانع استفاده است',
    diagnosticTests: ['آگاهی مردم', 'کانال‌های اطلاع‌رسانی', 'دسترسی دیجیتال'],
    evidenceIndicators: ['R5', 'G2'],
  },
  norm: {
    name: 'هنجار/تبعیض',
    description: 'هنجار اجتماعی یا تبعیض مانع مشارکت است',
    diagnosticTests: ['پیمایش تجربه', 'حضور گروه‌ها', 'قوانین نانوشته'],
    evidenceIndicators: ['S2', 'C3'],
  },
  governance: {
    name: 'حکمرانی',
    description: 'ضعف هماهنگی و اجرای نهادی مانع تبدیل ظرفیت است',
    diagnosticTests: ['داده پروژه', 'عملکرد نهادها', 'مشارکت مردم'],
    evidenceIndicators: ['G1', 'G3', 'G4'],
  },
};

/**
 * پروتکل تشخیص علت ۹ مرحله‌ای
 */
export function diagnoseCauses(
  gap: ChainGaps,
  bottleneck: ProblemAddress,
  fourSourceEvidence: FourSourceEvidence,
): CausalHypothesis[] {
  const hypotheses: CausalHypothesis[] = [];

  // تعیین شکاف غالب
  const maxGap = Math.max(gap.G_CA, gap.G_AU, gap.G_UE, gap.G_EO);
  if (maxGap <= 5) return []; // شکاف معنادار وجود ندارد

  // تولید فرضیه‌ها بر اساس نوع شکاف
  const relevantFrictions: FrictionType[] = [];
  if (gap.G_CA > maxGap * 0.6) relevantFrictions.push('physical_barrier', 'information', 'governance');
  if (gap.G_AU > maxGap * 0.6) relevantFrictions.push('cost', 'insecurity', 'quality', 'time', 'norm');
  if (gap.G_UE > maxGap * 0.6) relevantFrictions.push('insecurity', 'quality', 'norm');
  if (gap.G_EO > maxGap * 0.6) relevantFrictions.push('cost', 'governance');

  for (const friction of relevantFrictions) {
    const catalog = HYPOTHESIS_CATALOG[friction];
    const sources: string[] = [];

    // سه‌سوسازی: بررسی چهار جریان داده
    for (const sourceType of ['objective', 'spatial', 'behavioral', 'perceptual'] as const) {
      const evidence = fourSourceEvidence[sourceType];
      for (const indicator of catalog.evidenceIndicators) {
        if (evidence[indicator] != null) {
          sources.push(`${sourceType}:${indicator}`);
        }
      }
    }

    hypotheses.push({
      hypothesis: catalog.description,
      frictionType: friction,
      evidenceStatus: sources.length >= 3 ? 'convergent' : sources.length >= 1 ? 'initial' : 'initial',
      sources,
      causalChain: buildCausalChain(friction, bottleneck),
    });
  }

  return hypotheses;
}

function buildCausalChain(friction: FrictionType, bottleneck: ProblemAddress): string[] {
  const base = `سرمایه ${bottleneck.capital} → `;
  switch (friction) {
    case 'cost':
      return [base + 'هزینه بالا → دسترسی صوری → استفاده ناچیز'];
    case 'insecurity':
      return [base + 'ناامنی → اجتناب از حضور → استفاده ناچیز'];
    case 'quality':
      return [base + 'کیفیت پایین → نارضایتی → قطع استفاده'];
    case 'time':
      return [base + 'نامناسبی زمانی → عدم همپوشانی نیاز و خدمت'];
    case 'physical_barrier':
      return [base + 'مانع فیزیکی → عدم دسترسی واقعی'];
    case 'information':
      return [base + 'کمبود اطلاعات → بی‌اطلاعی از فرصت'];
    case 'norm':
      return [base + 'هنجار اجتماعی → عدم مشارکت/حضور'];
    case 'governance':
      return [base + 'ضعف حکمرانی → عدم تبدیل ظرفیت'];
  }
}
