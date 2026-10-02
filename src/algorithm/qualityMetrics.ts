// ============================================================
// محاسبه سه خروجی بالادستی Q, T, R (بخش ۵.۳ الگوریتم)
// ============================================================
import type { CapitalKey, ChainStage, QualityTriad } from './types';
import { CAPITALS } from './types';

export interface ChainAverageScores {
  CAPACITY: number;
  ACCESS: number;
  USE: number;
  EXPERIENCE: number;
  OUTCOME: number;
}

/**
 * Q — کیفیت محقق‌شده
 * ترکیب وزنی دسترسی، استفاده، تجربه و پیامد
 */
export function computeQ(chainAvg: ChainAverageScores): number {
  const stages = [chainAvg.ACCESS, chainAvg.USE, chainAvg.EXPERIENCE, chainAvg.OUTCOME];
  return stages.reduce((a, b) => a + b, 0) / stages.length;
}

/**
 * T — توان تبدیل
 * توان بالفعل‌کردن سرمایه + تولید فرصت + عبور از اصطکاک
 * نقش مهم حکمرانی (G)
 */
export function computeT(
  capitalScores: Record<CapitalKey, number>,
  chainAvg: ChainAverageScores,
): number {
  const conversionBase = chainAvg.CAPACITY * 0.5 + chainAvg.ACCESS * 0.3;
  const governanceBoost = (capitalScores.G ?? 0) * 0.3;
  const frictionPenalty = Math.max(0, chainAvg.CAPACITY - chainAvg.USE) * 0.1;
  return Math.min(100, Math.max(0, conversionBase + governanceBoost - frictionPenalty));
}

/**
 * R — توان بازتولید
 * یادگیری + پایداری + ایجاد ظرفیت آینده
 */
export function computeR(
  capitalScores: Record<CapitalKey, number>,
): number {
  // نماینده‌های بازتولید: G (نهادی/یادگیری) + H (انسانی/یادگیری مستمر)
  const gScore = capitalScores.G ?? 0;
  const hScore = capitalScores.H ?? 0;
  const nScore = capitalScores.N ?? 0; // طبیعی/تاب‌آوری
  const eScore = capitalScores.E ?? 0; // اقتصادی/ماندگاری ارزش
  return (gScore * 0.3 + hScore * 0.25 + nScore * 0.2 + eScore * 0.25);
}

/**
 * محاسبه کامل Q, T, R
 */
export function computeQualityTriad(
  capitalScores: Record<CapitalKey, number>,
  chainAvg: ChainAverageScores,
): QualityTriad {
  return {
    Q: Math.round(computeQ(chainAvg) * 10) / 10,
    T: Math.round(computeT(capitalScores, chainAvg) * 10) / 10,
    R: Math.round(computeR(capitalScores) * 10) / 10,
  };
}
