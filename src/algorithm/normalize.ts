// ============================================================
// نرمال‌سازی (بخش ۵ سند): winsorize صدک ۱/۹۹ → Min–Max 0..1 با
// احترام به جهت (+/−/خنثی) در گروه هم‌مقیاس → نگاشت ۱..۵ (Rubric)
// ============================================================
import type { Direction } from './types';

/** قیچی‌کردن صدک‌ها (winsorize) برای کنترل مقادیر پرت */
export function winsorize(values: number[], loPct = 0.01, hiPct = 0.99): { lo: number; hi: number } {
  if (values.length === 0) return { lo: 0, hi: 1 };
  const sorted = [...values].sort((a, b) => a - b);
  const loIdx = Math.min(sorted.length - 1, Math.max(0, Math.floor((values.length - 1) * loPct)));
  const hiIdx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((values.length - 1) * hiPct)));
  return { lo: sorted[loIdx], hi: sorted[hiIdx] };
}

/**
 * نرمال‌سازی Min–Max به بازهٔ ۰..۱
 * asc : (x − min)/(max − min)     — مطلوب صعودی
 * desc: (max − x)/(max − min)     — مطلوب نزولی
 * neutral: همان asc (برای شاخص‌های زمینه‌ای بدون قطب)
 */
export function minmaxNormalize(
  value: number,
  min: number,
  max: number,
  direction: Direction,
): number {
  const span = max - min;
  if (span <= 0) return 1;
  const x = (value - min) / span;
  const clamped = Math.min(1, Math.max(0, x));
  if (direction === 'desc') return 1 - clamped;
  return clamped;
}

/** نگاشت ۰..۱ به مقیاس ۱..۵ با آستانه‌های ۰٫۲/۰٫۴/۰٫۶/۰٫۸ (Rubric SOP) */
export function toScale1to5(xNorm: number): number {
  const t = Math.min(1, Math.max(0, xNorm));
  if (t < 0.2) return 1;
  if (t < 0.4) return 2;
  if (t < 0.6) return 3;
  if (t < 0.8) return 4;
  return 5;
}

export interface NormalizedSeries {
  min: number;
  max: number;
  values: number[];       // نرمال‌شده ۰..۱
  scaled: number[];       // مقیاس ۱..۵
}

/**
 * نرمال‌سازی یک مجموعه در گروه هم‌مقیاس (شهری/روستایی).
 * winsorize روی مقادیر گروه اعمال سپس Min–Max با جهت.
 */
export function normalizeSeries(rawValues: (number | null)[], direction: Direction): NormalizedSeries {
  const present = rawValues.filter((v): v is number => v != null);
  const { lo, hi } = winsorize(present);
  const wl = lo + (hi - lo) * 0.0; // حداقل واقعی پس از winsorize
  const wh = hi;
  const values: number[] = [];
  const scaled: number[] = [];
  for (const v of rawValues) {
    if (v == null) {
      values.push(NaN);
      scaled.push(NaN);
      continue;
    }
    const clipped = Math.min(wh, Math.max(wl, v));
    const norm = minmaxNormalize(clipped, wl, wh, direction);
    values.push(norm);
    scaled.push(toScale1to5(norm));
  }
  return { min: wl, max: wh, values, scaled };
}

/** گروه هم‌مقیاس (بخش ۵.۱): شهری و روستایی جدا نرمال می‌شوند */
export function groupKey(scale: string): 'urban' | 'rural' {
  return scale === 'rural' ? 'rural' : 'urban';
}
