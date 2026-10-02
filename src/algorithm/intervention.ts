// ============================================================
// موتور تجویز مداخله و اولویت‌بندی بودجه (بخش ۹.۲)
// - پهنه‌های با N ↑ در اولویت اول (نرخ بازگشت سرمایه اجتماعی)
// - پروتکل حالت ۹ (تزریق هم‌زمان زیرساخت + مهارت)
// ============================================================
import type { LayerKey } from './types';

export interface BudgetRank {
  zoneId: string;
  priorityScore: number;
  rank: number;
  reason: string;
}

/**
 * امتیاز اولویت بودجه: هنجار قوی (سرمایهٔ اجتماعی آماده) در صدر،
 * سپس وضعیت بحرانی SI، سپس نیاز به مداخلهٔ همه‌جانبه.
 */
export function budgetPriorityScore(scores: Record<LayerKey, number>, si: number): number {
  const P = scores.P ?? 3;
  const B = scores.B ?? 3;
  const N = scores.N ?? 3;
  // اولویت هنجاری (بخش ۶.۳): N ↑ بیشترین نرخ بازگشت سرمایه اجتماعی
  const normative = N >= 3.0 ? 100 : 40 + N * 20;
  // نیاز به مداخله: SI پایین یعنی محرومیت مطلق
  const need = Math.max(0, 4 - si) * 18;
  // توازن سه‌لایه: گسست (BalanceGap بالا) نیازمند حضور فعال
  const gap = Math.max(P, B, N) - Math.min(P, B, N);
  const imbalance = gap * 8;
  return normative + need + imbalance;
}

export function rankByBudgetPriority(
  zones: Array<{ zoneId: string; scores: Record<LayerKey, number>; si: number }>,
): BudgetRank[] {
  return zones
    .map((z) => {
      const priorityScore = budgetPriorityScore(z.scores, z.si);
      const N = z.scores.N ?? 3;
      const reason =
        N >= 3.0
          ? 'هنجار قوی — نرخ بازگشت سرمایه اجتماعی تضمین‌شده'
          : z.si < 2.5
            ? 'محرومیت مطلق — نیاز به مداخلهٔ همه‌جانبه'
            : 'نیاز متوسط به ترمیم و بازسازی';
      return { zoneId: z.zoneId, priorityScore, rank: 0, reason };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map((z, i) => ({ ...z, rank: i + 1 }));
}
