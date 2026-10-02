// ============================================================
// نقشه عدالت — شکاف بین گروه‌های اجتماعی (بخش ۷.۴ الگوریتم)
// JusticeGap_i = P_best - P_worst
// ============================================================
import type { JusticeGap } from './types';

export function computeEquityGaps(
  indicators: Array<{
    code: string;
    groupScores: Record<string, number>;
  }>,
): JusticeGap[] {
  return indicators.map(ind => {
    const groups = Object.entries(ind.groupScores);
    if (groups.length < 2) {
      return {
        indicatorCode: ind.code,
        bestGroup: 'N/A',
        worstGroup: 'N/A',
        gap: 0,
        verdict: 'equal' as const,
      };
    }
    groups.sort((a, b) => b[1] - a[1]);
    const gap = Math.round((groups[0][1] - groups[groups.length - 1][1]) * 10) / 10;

    let verdict: JusticeGap['verdict'] = 'equal';
    if (gap > 20) verdict = 'critical';
    else if (gap > 10) verdict = 'unequal_but_good';

    return {
      indicatorCode: ind.code,
      bestGroup: groups[0][0],
      worstGroup: groups[groups.length - 1][0],
      gap,
      verdict,
    };
  });
}

/**
 * قاعده: میانگین خوب + شکاف زیاد = «خوب اما نابرابر»
 */
export function hasHiddenInequality(
  averageScore: number,
  equityGaps: JusticeGap[],
): boolean {
  return averageScore >= 60 && equityGaps.some(g => g.gap > 15);
}
