// ============================================================
// امتیاز هشت سرمایه (بخش ۵.۲ الگوریتم)
// Kj = (Σ wi × Zi) / (Σ wi)
// ============================================================
import type { CapitalKey, AlgorithmIndicator, CapitalScore, StatusBand } from './types';

export function scoreToBand(score: number): StatusBand {
  if (score >= 90) return 'EXCELLENT';
  if (score >= 75) return 'GOOD';
  if (score >= 60) return 'MODERATE';
  if (score >= 40) return 'WEAK';
  return 'CRITICAL';
}

/**
 * محاسبه امتیاز یک سرمایه
 * در نسخه اول وزن‌ها برابرند
 */
export function computeCapitalScore(
  normalizedValues: Array<{ code: string; capitalKey: CapitalKey; normalized: number; reliability: number }>,
  capitalKey: CapitalKey,
): CapitalScore {
  const relevant = normalizedValues.filter(i => i.capitalKey === capitalKey);
  if (relevant.length === 0) {
    return { capitalKey, score: 0, band: 'CRITICAL', evidenceReliability: 0, indicatorCount: 0 };
  }
  const score = relevant.reduce((sum, i) => sum + i.normalized, 0) / relevant.length;
  const evidenceReliability = relevant.reduce((sum, i) => sum + i.reliability, 0) / relevant.length;
  return {
    capitalKey,
    score: Math.round(score * 10) / 10,
    band: scoreToBand(score),
    evidenceReliability: Math.round(evidenceReliability * 10) / 10,
    indicatorCount: relevant.length,
  };
}

/**
 * محاسبه امتیاز تمام هشت سرمایه
 */
export function computeAllCapitalScores(
  normalizedValues: Array<{ code: string; capitalKey: CapitalKey; normalized: number; reliability: number }>,
): CapitalScore[] {
  const capitals: CapitalKey[] = ['H', 'S', 'E', 'P', 'N', 'C', 'G', 'R'];
  return capitals.map(cap => computeCapitalScore(normalizedValues, cap));
}
