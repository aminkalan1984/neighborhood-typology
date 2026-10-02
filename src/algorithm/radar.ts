// ============================================================
// تحلیل راداری (بخش ۹.۱): مساحت مثلث، شاخص تراز (BalanceGap) و
// جهت کشیدگی (Skew) برای هر پهنه
// ============================================================
import type { LayerKey, RadarMetrics } from './types';

export const RADAR_ANGLE = (120 * Math.PI) / 180; // sin(120°)

export function radarMetrics(P: number, B: number, N: number): RadarMetrics {
  const vals: [LayerKey, number][] = [
    ['P', P],
    ['B', B],
    ['N', N],
  ];
  const finite = vals.filter(([, v]) => Number.isFinite(v));
  const max = Math.max(...finite.map(([, v]) => v));
  const min = Math.min(...finite.map(([, v]) => v));

  // مساحت مثلث راداری: 0.5·sin(120°)·(P·B + B·N + N·P)
  const area = 0.5 * RADAR_ANGLE * Math.sin(RADAR_ANGLE) * (P * B + B * N + N * P);

  const skew: LayerKey | null = Number.isFinite(max) && Number.isFinite(min) && max - min > 0.35
    ? (finite.find(([k, v]) => v === max)?.[0] ?? null)
    : null;

  return {
    area: Number.isFinite(area) ? area : 0,
    balanceGap: Number.isFinite(max) && Number.isFinite(min) ? max - min : 0,
    skew,
  };
}

export const SKEW_FA: Record<LayerKey, string> = {
  P: 'کشیدگی به سمت کالبدی — نیاز به مداخلهٔ نرم (اقتصادی/فرهنگی)',
  B: 'کشیدگی به سمت رفتاری — نیاز به تقویت نهاد و زیرساخت',
  N: 'کشیدگی به سمت هنجاری — آمادگی حداکثری برای توسعه زیرساخت',
};
