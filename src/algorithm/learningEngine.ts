// ============================================================
// مدل یادگیری S-I-F-A-M برای هر سرمایه (بخش ۱۰ الگوریتم)
// L_k = H(S, I, F, A, M) × G
// ============================================================
import type { CapitalKey, LearningCapabilities, LearningResult } from './types';

/**
 * محاسبه امتیاز یادگیری برای یک سرمایه
 */
export function computeLearningScore(
  capitalKey: CapitalKey,
  capabilities: LearningCapabilities,
): LearningResult {
  const { sensing, interpretation, feedback, adaptation, memory } = capabilities;

  // میانگین هندسی پنج مؤلفه
  const vals = [sensing, interpretation, feedback, adaptation, memory].filter(v => v > 0);
  const geoMean = vals.length === 5
    ? Math.pow(vals.reduce((a, b) => a * b, 1), 1 / 5)
    : vals.length > 0
      ? vals.reduce((a, b) => a * b, 1) / vals.length
      : 0;

  // دروازه گلوگاه
  const minVal = Math.min(...vals);
  const criticalCount = vals.filter(v => v < 0.2).length;

  let gate: LearningResult['gate'] = 'normal';
  if (criticalCount >= 2) gate = 'disrupted';
  else if (criticalCount === 1) gate = 'locked';
  else if (minVal < 0.4) gate = 'warning';

  const weakestIdx = vals.indexOf(Math.min(...vals));
  const capNames = ['حسگری', 'تفسیر', 'بازخورد', 'انطباق', 'حافظه'];

  return {
    capitalKey,
    L: Math.round(geoMean * 100) / 100,
    gate,
    weakestCapability: capNames[weakestIdx] ?? 'نامشخص',
  };
}

/**
 * سه سطح یادگیری
 */
export type LearningLevel = 'corrective' | 'adaptive' | 'generative';

export function classifyLearningLevel(
  adaptiveDecisions: number,
  totalDecisions: number,
  ruleChanges: number,
): LearningLevel {
  if (totalDecisions === 0) return 'corrective';
  const adaptationRate = adaptiveDecisions / totalDecisions;
  if (ruleChanges > 0 && adaptationRate > 0.5) return 'generative';
  if (adaptationRate > 0.3) return 'adaptive';
  return 'corrective';
}

/**
 * هشدار دینامیک: سرعت یادگیری < سرعت تغییر محیط
 */
export function dynamicResilience(
  learningVelocity: number,
  environmentChangeVelocity: number,
): { ratio: number; healthy: boolean; message: string } {
  const ratio = environmentChangeVelocity > 0 ? learningVelocity / environmentChangeVelocity : Infinity;
  return {
    ratio: Math.round(ratio * 100) / 100,
    healthy: ratio >= 1,
    message: ratio >= 1
      ? 'سرعت یادگیری هم‌پای تغییر محیط است'
      : '⚠️ سرعت یادگیری از سرعت تغییر محیط کمتر است — محله عقب می‌ماند',
  };
}

/**
 * ناترازی حل مسئله: D(t) = P(t) - S(t)
 */
export function problemSolvingImbalance(
  problemsGenerated: number,
  problemsSolved: number,
): { imbalance: number; status: string } {
  const d = problemsGenerated - problemsSolved;
  let status: string;
  if (d <= 0) status = 'ظرفیت حل مسئله کافی است';
  else if (d > 0) status = 'مسائل انباشته می‌شوند';
  else status = 'روش حل مسئله باید تغییر کند';
  return { imbalance: d, status };
}
