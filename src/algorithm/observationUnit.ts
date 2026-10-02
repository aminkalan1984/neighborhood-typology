// ============================================================
// واحد مشاهده استاندارد — هر رکورد باید ۶ پرسش را پاسخ دهد
// با ادغام پیمایش ادراکی و ردیابی شواهد
// ============================================================
import type { ObservationUnit, AlgorithmIndicator, FourSourceEvidence, CapitalKey } from './types';

// ─── انواع ──────────────────────────────────────────────────
export interface SurveyResponse {
  questionId: string;
  value: number;
  followUpAnswer?: string;
}

export interface SurveyResult {
  responses: SurveyResponse[];
  stageScores: Record<string, number>;
  rawScores: Record<string, number>;
  completionRate: number;
  averageScore: number;
}

export interface EvidenceTracker {
  indicatorCode: string;
  sources: Array<{
    type: 'objective' | 'spatial' | 'behavioral' | 'perceptual';
    value: number | null;
    reliability: number;
    timestamp: string;
  }>;
  consistency: number;
  confidence: 'low' | 'medium' | 'high';
}

// ─── ایجاد واحد مشاهده ──────────────────────────────────────
export function createObservationUnit(
  indicator: AlgorithmIndicator,
  location: string,
  timePeriod: string,
  targetGroup: string,
  method: ObservationUnit['method'],
  reliability: ObservationUnit['reliability'],
): ObservationUnit {
  return {
    what: `${indicator.name} — ${indicator.operationalDefinition}`,
    where: location,
    when: timePeriod,
    forWhom: targetGroup,
    method,
    reliability,
  };
}

// ─── تبدیل به متن ───────────────────────────────────────────
export function observationToText(unit: ObservationUnit): string {
  const methodMap: Record<string, string> = {
    census: 'ثبتی/سرشماری', gis: 'مکانی/GIS', behavioral: 'رفتاری', survey: 'پیمایش',
  };
  const relMap: Record<string, string> = {
    initial: 'فرضیه اولیه', convergent: 'شواهد همگرا', tested: 'آزمون‌شده',
  };
  return `شاخص: ${unit.what}\nمکان: ${unit.where}\nزمان: ${unit.when}\nگروه: ${unit.forWhom}\nروش: ${methodMap[unit.method]}\nاتکا: ${relMap[unit.reliability]}`;
}

// ─── پردازش نتایج پیمایش ────────────────────────────────────
const STAGE_QUESTIONS: Record<string, string[]> = {
  CAPACITY: ['C1', 'C2', 'C3'],
  ACCESS: ['A1', 'A2', 'A3'],
  USE: ['U1', 'U2', 'U3'],
  EXPERIENCE: ['E1', 'E2', 'E3'],
  OUTCOME: ['O1', 'O2', 'O3'],
};

export function processSurveyResponses(
  responses: SurveyResponse[],
): SurveyResult {
  const stageScores: Record<string, number[]> = {
    CAPACITY: [], ACCESS: [], USE: [], EXPERIENCE: [], OUTCOME: [],
  };

  for (const resp of responses) {
    // تعیین مرحله بر اساس کد سؤال
    const stage = Object.entries(STAGE_QUESTIONS).find(([, ids]) =>
      ids.some(id => resp.questionId.startsWith(id))
    )?.[0] ?? 'OUTCOME';

    // تبدیل مقیاس ۱-۵ به ۰-۱۰۰
    const normalized = ((resp.value - 1) / 4) * 100;
    stageScores[stage].push(normalized);
  }

  const stageAverages: Record<string, number> = {};
  for (const [stage, scores] of Object.entries(stageScores)) {
    stageAverages[stage] = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 50;
  }

  const allScores = Object.values(stageAverages);
  const averageScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;

  return {
    responses,
    stageScores: stageAverages,
    rawScores: Object.fromEntries(
      responses.map(r => [r.questionId, ((r.value - 1) / 4) * 100])
    ),
    completionRate: responses.length / 15,
    averageScore,
  };
}

// ─── ردیابی شواهد ───────────────────────────────────────────
export function trackEvidence(
  indicatorCode: string,
  evidence: FourSourceEvidence,
): EvidenceTracker {
  const sources: EvidenceTracker['sources'] = [];

  if (evidence.objective[indicatorCode] != null) {
    sources.push({
      type: 'objective',
      value: evidence.objective[indicatorCode],
      reliability: 4,
      timestamp: new Date().toISOString(),
    });
  }
  if (evidence.spatial[indicatorCode] != null) {
    sources.push({
      type: 'spatial',
      value: evidence.spatial[indicatorCode],
      reliability: 4,
      timestamp: new Date().toISOString(),
    });
  }
  if (evidence.behavioral[indicatorCode] != null) {
    sources.push({
      type: 'behavioral',
      value: evidence.behavioral[indicatorCode],
      reliability: 3,
      timestamp: new Date().toISOString(),
    });
  }
  if (evidence.perceptual[indicatorCode] != null) {
    sources.push({
      type: 'perceptual',
      value: evidence.perceptual[indicatorCode],
      reliability: 3,
      timestamp: new Date().toISOString(),
    });
  }

  // محاسبه سازگاری شواهد
  const values = sources.map(s => s.value ?? 0).filter(v => v > 0);
  const consistency = values.length >= 2
    ? 1 - (Math.max(...values) - Math.min(...values)) / 100
    : 0.5;

  let confidence: EvidenceTracker['confidence'] = 'low';
  if (sources.length >= 3 && consistency > 0.7) confidence = 'high';
  else if (sources.length >= 2) confidence = 'medium';

  return { indicatorCode, sources, consistency, confidence };
}

// ─── تعیین سطح اتکا ────────────────────────────────────────
export function determineReliabilityLevel(
  trackers: EvidenceTracker[],
): ObservationUnit['reliability'] {
  const highConfidence = trackers.filter(t => t.confidence === 'high').length;
  const mediumConfidence = trackers.filter(t => t.confidence === 'medium').length;

  if (highConfidence >= 3) return 'tested';
  if (mediumConfidence >= 2) return 'convergent';
  return 'initial';
}

// ─── تولید خلاصه شواهد ──────────────────────────────────────
export function generateEvidenceSummary(
  trackers: EvidenceTracker[],
): string {
  const summary = trackers.map(t => {
    const confMap = { high: '强', medium: '!', low: '?' };
    return `${t.indicatorCode}: ${t.sources.length} منبع ${confMap[t.confidence]}`;
  });
  return summary.join(' | ');
}
