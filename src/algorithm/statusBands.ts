// ============================================================
// باندهای وضعیت و تیپ تشخیصی K-T-R (بخش ۵.۴ و ۶ الگوریتم)
// ============================================================
import type { DiagnosticType, StatusBand } from './types';
import { BAND_CONFIG, DIAGNOSTIC_TYPES } from './types';

export function scoreToBand(score: number): StatusBand {
  if (score >= 90) return 'EXCELLENT';
  if (score >= 75) return 'GOOD';
  if (score >= 60) return 'MODERATE';
  if (score >= 40) return 'WEAK';
  return 'CRITICAL';
}

/** برچسب فارسی باند وضعیت */
export function bandLabel(band: StatusBand): string {
  return BAND_CONFIG[band].label;
}

/**
 * الگوریتم تصمیم درختی تیپ تشخیصی K-T-R
 * Q → K → T → R → عدالت → روند
 */
export function diagnoseType(
  q: number,
  t: number,
  r: number,
  k: number,
): DiagnosticType {
  const high = (v: number) => v >= 60;
  const low = (v: number) => v < 40;
  const medium = (v: number) => v >= 40 && v < 60;

  if (low(k) && low(t) && low(r)) return 'A';
  if (high(k) && low(t) && low(r)) return 'B';
  if (high(k) && high(t) && low(r)) return 'C';
  if (high(k) && high(t) && high(r)) return 'D';
  if (high(k) && medium(t) && high(r)) return 'E';

  // fallback
  if (low(q)) return 'A';
  return 'B';
}

export function getDiagnosticInterpretation(type: DiagnosticType): string {
  return DIAGNOSTIC_TYPES[type].interpretation;
}

export function getDiagnosticStrategy(type: DiagnosticType): string {
  return DIAGNOSTIC_TYPES[type].strategy;
}
