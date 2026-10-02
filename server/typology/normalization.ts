import type { Direction, StandardizationRule, StandardizedScore } from './types.js';

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function safeRate(numerator: number, denominator: number, multiplier = 100): number | null {
  if (![numerator, denominator, multiplier].every(Number.isFinite) || denominator <= 0) return null;
  return multiplier * numerator / denominator;
}

export function perCapita(numerator: number, denominator: number, factor = 1): number | null {
  return safeRate(numerator, denominator, factor);
}

export function likertMeanTo100(weightedMean: number): number {
  if (!Number.isFinite(weightedMean) || weightedMean < 1 || weightedMean > 5) {
    throw new Error('Likert mean must be in the 1..5 range');
  }
  return 100 * (weightedMean - 1) / 4;
}

export function normalizedShannon(proportions: number[]): number | null {
  if (!proportions.length || proportions.some((value) => !Number.isFinite(value) || value < 0)) return null;
  const total = proportions.reduce((sum, value) => sum + value, 0);
  const positive = proportions.filter((value) => value > 0);
  if (total <= 0 || positive.length < 2) return 0;
  const entropy = -positive.reduce((sum, value) => {
    const probability = value / total;
    return sum + probability * Math.log(probability);
  }, 0);
  return entropy / Math.log(positive.length);
}

export function geometricMean(values: number[]): number | null {
  if (!values.length || values.some((value) => !Number.isFinite(value) || value <= 0)) return null;
  return Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length);
}

function validateLinearRule(rule: StandardizationRule): void {
  if (![rule.lower, rule.upper].every(Number.isFinite) || rule.upper <= rule.lower) {
    throw new Error('Standardization lower/upper bounds must be finite and upper must exceed lower');
  }
}

function optimalScore(value: number, rule: StandardizationRule): number {
  const { optimalLower, optimalUpper, worstLower, worstUpper } = rule;
  if (![optimalLower, optimalUpper, worstLower, worstUpper].every((item) => Number.isFinite(item))) {
    throw new Error('Optimal standardization requires optimalLower, optimalUpper, worstLower and worstUpper');
  }
  if (worstLower! >= optimalLower! || optimalLower! > optimalUpper! || optimalUpper! >= worstUpper!) {
    throw new Error('Optimal standardization bounds must satisfy worstLower < optimalLower <= optimalUpper < worstUpper');
  }
  if (value >= optimalLower! && value <= optimalUpper!) return 100;
  if (value <= worstLower! || value >= worstUpper!) return 0;
  if (value < optimalLower!) return 100 * (value - worstLower!) / (optimalLower! - worstLower!);
  return 100 * (worstUpper! - value) / (worstUpper! - optimalUpper!);
}

export function standardizeToScore(value: number, rule: StandardizationRule): StandardizedScore {
  if (!Number.isFinite(value)) throw new Error('Cannot standardize a non-finite value');
  let normalized0to100: number;
  if (rule.direction === 'optimal') {
    normalized0to100 = optimalScore(value, rule);
  } else {
    validateLinearRule(rule);
    normalized0to100 = 100 * (value - rule.lower) / (rule.upper - rule.lower);
    normalized0to100 = clamp(normalized0to100, 0, 100);
    if (rule.direction === 'inverse') normalized0to100 = 100 - normalized0to100;
  }
  const score1to5 = 1 + 4 * normalized0to100 / 100;
  return { normalized0to100, score1to5, direction: rule.direction, rule };
}

export function classifyBand(value: number, lowUpper = 2, highLower = 4): 'L' | 'M' | 'H' {
  if (!Number.isFinite(value)) throw new Error('Cannot classify a non-finite score');
  if (value < lowUpper) return 'L';
  if (value < highLower) return 'M';
  return 'H';
}

export function directionFromInput(value: Direction | string): Direction {
  if (value === 'direct' || value === 'inverse' || value === 'optimal') return value;
  if (value.includes('معکوس')) return 'inverse';
  if (value.includes('آستانه') || value.includes('بهینه')) return 'optimal';
  return 'direct';
}

