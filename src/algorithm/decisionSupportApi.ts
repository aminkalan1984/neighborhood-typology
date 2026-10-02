import type { DecisionCard, GroupSlice } from './types';
import type { SurveyResponse } from './perceptualSurvey';
import { apiUrl } from './realDataConnectors';

export interface DecisionSupportApiRequest {
  neighborhoodName: string;
  cityOrCounty?: string;
  province?: string;
  purpose?: 'baseline' | 'monitoring' | 'intervention_priority';
  indicatorValues: Record<string, number>;
  groupValues?: Record<string, Record<string, number>>;
  groupSlices?: GroupSlice[];
  subLocationScores?: Record<string, Record<string, number>>;
  previousPeriodIndicatorValues?: Record<string, number>;
  survey?: { responses: SurveyResponse[]; respondentGroup?: string };
  population?: number;
  aoi?: { bbox: [number, number, number, number]; geometry?: unknown };
}

export class DecisionSupportApiError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'DecisionSupportApiError';
    this.status = status;
  }
}

export interface DecisionSupportAnalyzeResult {
  runId?: string;
  card: DecisionCard;
}

export async function analyzeDecisionSupport(input: DecisionSupportApiRequest, signal?: AbortSignal): Promise<DecisionSupportAnalyzeResult> {
  let response: Response;
  try {
    response = await fetch(apiUrl('/api/decision-support/analyze'), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Correlation-ID': typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `ara-${Date.now()}`,
      },
      body: JSON.stringify(input),
      signal: signal ?? AbortSignal.timeout(20_000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new DecisionSupportApiError('سرویس تصمیم‌یار در دسترس نیست. اتصال API را بررسی کنید.');
  }

  const payload = await response.json().catch(() => null) as { success?: boolean; data?: DecisionCard | { runId?: string; card?: DecisionCard }; error?: { message?: string } } | null;
  if (!response.ok || payload?.success === false || !payload?.data) {
    throw new DecisionSupportApiError(payload?.error?.message || `تحلیل با کد ${response.status} ناموفق بود.`, response.status);
  }
  // پشتیبانی از قالب جدید { runId, card } و قالب قدیمی کارت مستقیم
  const data = payload.data as DecisionCard | { runId?: string; card?: DecisionCard };
  if ('card' in data && data.card) {
    return { runId: (data as { runId?: string }).runId, card: data.card };
  }
  return { card: data as DecisionCard };
}
