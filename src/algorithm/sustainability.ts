// ============================================================
// ضریب پایداری (بخش ۷ سند): تجمیع وزنی لایه با Safe-drop دادهٔ
// گمشده + میانگین هندسی SI = (P×B×N)^(1/3) با محافظ صفر
// ============================================================
import type { LayerKey, LayerScore } from './types';

/**
 * تجمیع وزنی زیرشاخص‌های یک لایه به نمرهٔ ۱..۵ با Safe-drop.
 * - زیرشاخص NaN از تجمیع کنار گذاشته و وزن‌ها بازنرمال می‌شوند.
 * - coverage = سهم وزن پوشش‌یافته از کل وزن لایه.
 * - اگر بیش از ۴۰٪ وزن لایه گمشده باشد → lowConfidence (بخش ۵.۴).
 */
export function layerScore(
  scaled: (number | null)[],
  weights: number[],
  gapThreshold = 0.4,
): LayerScore {
  let wSum = 0;
  let wCovered = 0;
  let acc = 0;
  for (let i = 0; i < scaled.length; i++) {
    const w = weights[i] ?? 0;
    wSum += w;
    const s = scaled[i];
    if (s == null || !Number.isFinite(s)) continue;
    wCovered += w;
    acc += w * s;
  }
  if (wCovered <= 0 || wSum <= 0) {
    return { score: NaN, coverage: 0, lowConfidence: true };
  }
  const coverage = wCovered / wSum;
  return {
    score: acc / wCovered,
    coverage,
    lowConfidence: 1 - coverage > gapThreshold,
  };
}

/**
 * SI = (P × B × N)^(1/3)
 * محافظ صفر: اگر لایه‌ای ۰ باشد، کف ε=۰٫۱ لحاظ و پرچم criticalLayer ست می‌شود.
 */
export function geometricMeanSi(
  P: number,
  B: number,
  N: number,
  eps = 0.1,
): { si: number; criticalLayer: LayerKey | null } {
  const vals: [LayerKey, number][] = [
    ['P', Number.isFinite(P) ? P : eps],
    ['B', Number.isFinite(B) ? B : eps],
    ['N', Number.isFinite(N) ? N : eps],
  ];
  let critical: LayerKey | null = null;
  const safe = vals.map(([k, v]) => {
    if (v <= eps) critical = k;
    return Math.max(v, eps);
  });
  const si = Math.cbrt(safe[0] * safe[1] * safe[2]);
  return { si, criticalLayer: critical };
}

/** نسخهٔ اختیاری چهارلایه SI₄ = (P×B×N×E)^(1/4) — بخش ۷.۳ */
export function geometricMeanSi4(P: number, B: number, N: number, E: number, eps = 0.1): number {
  const vals = [P, B, N, E].map((v) => Math.max(Number.isFinite(v) ? v : eps, eps));
  return Math.pow(vals[0] * vals[1] * vals[2] * vals[3], 1 / 4);
}
