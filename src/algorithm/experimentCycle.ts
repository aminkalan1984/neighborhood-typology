// ============================================================
// چرخه مداخله به‌عنوان آزمایش (بخش ۱۰ الگوریتم)
// ============================================================
import type { CapitalKey, EvaluationPlan, LivingMemoryEntry } from './types';

export interface Experiment {
  id: string;
  hypothesis: string;
  capitalKey: CapitalKey;
  baseline: Record<string, number>;
  status: 'planned' | 'running' | 'completed' | 'stopped';
  outputs?: Record<string, number>;
  outcomes?: Record<string, number>;
  impacts?: Record<string, number>;
  decision?: 'scale' | 'revise' | 'stop';
  decisionReason?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ProtectiveIndicator {
  name: string;
  formula: string;
  value: number;
  threshold: number;
  status: 'pass' | 'warning' | 'fail';
}

/**
 * شاخص‌های حفاظتی
 */
export const PROTECTIVE_INDICATORS: ProtectiveIndicator[] = [
  {
    name: 'SI — ماندگاری اجتماعی',
    formula: 'خانوارهای هدف باقی‌مانده ÷ خانوارهای هدف قبل از مداخله',
    value: 1.0, threshold: 0.9, status: 'pass',
  },
  {
    name: 'GI — حضور برابر',
    formula: 'حضور زنان و دختران ÷ حضور مردان',
    value: 1.0, threshold: 0.7, status: 'pass',
  },
  {
    name: 'IRI — توان بازآفرینی درونی',
    formula: 'توان حل مسئله درونی ÷ وابستگی بیرونی',
    value: 1.0, threshold: 0.5, status: 'pass',
  },
];

export function createExperiment(
  hypothesis: string,
  capitalKey: CapitalKey,
  baseline: Record<string, number>,
): Experiment {
  return {
    id: `EXP-${Date.now()}`,
    hypothesis,
    capitalKey,
    baseline,
    status: 'planned',
    createdAt: new Date().toISOString(),
  };
}

export function decideOutcome(exp: Experiment): Experiment {
  if (exp.status !== 'completed' || !exp.outcomes) return exp;

  const hasPositiveEffect = Object.values(exp.outcomes).some(v => v > 0);
  const hasNegativeEffect = Object.values(exp.outcomes).some(v => v < -0.1);

  if (hasNegativeEffect) {
    return { ...exp, decision: 'stop', decisionReason: 'اثر ناخواسته منفی شناسایی شد' };
  }
  if (hasPositiveEffect) {
    return { ...exp, decision: 'scale', decisionReason: 'اثر مثبت تأیید شد — توسعه توصیه می‌شود' };
  }
  return { ...exp, decision: 'revise', decisionReason: 'اثر قابل‌توجهی مشاهده نشد — نیاز به اصلاح' };
}

export function experimentToMemory(exp: Experiment): Omit<LivingMemoryEntry, 'id' | 'dateRecorded' | 'applicationCount'> | null {
  if (!exp.decision) return null;
  return {
    capitalKey: exp.capitalKey,
    trigger: exp.hypothesis,
    outcome: exp.decision === 'scale' ? 'success' : exp.decision === 'stop' ? 'failure' : 'partial',
    rule: `آزمایش ${exp.decision === 'scale' ? 'موفق' : exp.decision === 'stop' ? 'ناموفق' : 'نیازمند اصلاح'}: ${exp.hypothesis}`,
    evidence: exp.decisionReason ?? '',
    dateLastApplied: undefined,
  };
}
