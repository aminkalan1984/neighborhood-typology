// ============================================================
// امتیاز زنجیره C-A-U-E-O برای هر سرمایه (بخش ۵.۲ الگوریتم)
// ماتریس ۸ سرمایه × ۵ مرحله
// ============================================================
import type { CapitalKey, ChainStage, ChainStageScore } from './types';
import { CHAIN_STAGES, CAPITALS } from './types';
import { scoreToBand } from './capitalScoring';

export interface ChainIndicatorValue {
  code: string;
  capitalKey: CapitalKey;
  chainStage: ChainStage;
  normalized: number;
}

/**
 * محاسبه امتیاز زنجیره C-A-U-E-O برای هر سرمایه
 */
export function computeChainScores(
  values: ChainIndicatorValue[],
  capitalKey: CapitalKey,
): ChainStageScore[] {
  return CHAIN_STAGES.flatMap(stage => {
    const relevant = values.filter(v => v.capitalKey === capitalKey && v.chainStage === stage);
    if (relevant.length === 0) return [];
    const score = relevant.reduce((sum, v) => sum + v.normalized, 0) / relevant.length;
    return [{ stage, score: Math.round(score * 10) / 10, band: scoreToBand(score) }];
  });
}

/**
 * محاسبه ماتریس کامل زنجیره برای تمام سرمایه‌ها
 */
export function computeAllChainScores(
  values: ChainIndicatorValue[],
): Record<CapitalKey, ChainStageScore[]> {
  const result: Partial<Record<CapitalKey, ChainStageScore[]>> = {};
  for (const cap of CAPITALS) {
    result[cap] = computeChainScores(values, cap);
  }
  return result as Record<CapitalKey, ChainStageScore[]>;
}

/**
 * میانگین زنجیره برای یک مرحله خاص (در تمام سرمایه‌ها)
 */
export function averageChainStage(
  chainScores: Record<CapitalKey, ChainStageScore[]>,
  stage: ChainStage,
): number {
  const allScores = CAPITALS.map(cap => {
    const found = chainScores[cap]?.find(s => s.stage === stage);
    return found?.score;
  }).filter((score): score is number => typeof score === 'number');
  if (allScores.length === 0) return 0;
  return allScores.reduce((a, b) => a + b, 0) / allScores.length;
}
