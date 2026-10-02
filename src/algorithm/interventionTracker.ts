// ============================================================
// سیستم ردیابی مداخله — پایش و ارزیابی اقدامات
// ============================================================
import type { CapitalKey, InterventionCandidate, EvaluationPlan } from './types';
import { CAPITAL_FA } from './types';

// ─── انواع ──────────────────────────────────────────────────
export interface InterventionRecord {
  id: string;
  name: string;
  capitalKey: CapitalKey;
  status: 'planned' | 'active' | 'completed' | 'suspended' | 'cancelled';
  startDate: string;
  endDate?: string;
  budget: number;
  responsible: string;
  metrics: InterventionMetrics;
  history: InterventionEvent[];
}

export interface InterventionMetrics {
  outputIndicators: Record<string, number>;
  outcomeIndicators: Record<string, number>;
  impactIndicators: Record<string, number>;
  sideEffects: string[];
  progress: number;
  quality: number;
}

export interface InterventionEvent {
  timestamp: string;
  type: 'created' | 'started' | 'milestone' | 'completed' | 'issue' | 'evaluation';
  description: string;
  data?: Record<string, unknown>;
}

// ─── ردیاب مداخله ────────────────────────────────────────────
export class InterventionTracker {
  private records: Map<string, InterventionRecord> = new Map();

  /**
   * ایجاد رکورد جدید
   */
  createRecord(
    intervention: InterventionCandidate,
    evaluationPlan: EvaluationPlan,
  ): InterventionRecord {
    const record: InterventionRecord = {
      id: intervention.id,
      name: intervention.name,
      capitalKey: intervention.targetCapital,
      status: 'planned',
      startDate: new Date().toISOString(),
      budget: intervention.severity * intervention.population * 1000,
      responsible: intervention.family,
      metrics: {
        outputIndicators: {},
        outcomeIndicators: {},
        impactIndicators: {},
        sideEffects: [],
        progress: 0,
        quality: 0,
      },
      history: [{
        timestamp: new Date().toISOString(),
        type: 'created',
        description: `اقدام «${intervention.name}» ثبت شد`,
      }],
    };

    this.records.set(record.id, record);
    return record;
  }

  /**
   * به‌روزرسانی وضعیت
   */
  updateStatus(
    id: string,
    status: InterventionRecord['status'],
    description: string,
  ): void {
    const record = this.records.get(id);
    if (!record) return;

    record.status = status;
    record.history.push({
      timestamp: new Date().toISOString(),
      type: status === 'active' ? 'started' : status === 'completed' ? 'completed' : 'milestone',
      description,
    });

    if (status === 'completed') {
      record.endDate = new Date().toISOString();
    }
  }

  /**
   * ثبت شاخص‌های خروجی
   */
  updateMetrics(
    id: string,
    metrics: Partial<InterventionMetrics>,
  ): void {
    const record = this.records.get(id);
    if (!record) return;

    if (metrics.outputIndicators) {
      Object.assign(record.metrics.outputIndicators, metrics.outputIndicators);
    }
    if (metrics.outcomeIndicators) {
      Object.assign(record.metrics.outcomeIndicators, metrics.outcomeIndicators);
    }
    if (metrics.impactIndicators) {
      Object.assign(record.metrics.impactIndicators, metrics.impactIndicators);
    }
    if (metrics.sideEffects) {
      record.metrics.sideEffects.push(...metrics.sideEffects);
    }
    if (metrics.progress !== undefined) {
      record.metrics.progress = Math.min(100, Math.max(0, metrics.progress));
    }

    record.history.push({
      timestamp: new Date().toISOString(),
      type: 'evaluation',
      description: 'شاخص‌ها به‌روزرسانی شد',
      data: metrics,
    });
  }

  /**
   * محاسبه امتیاز کلی اثربخشی
   */
  calculateEffectiveness(id: string): number {
    const record = this.records.get(id);
    if (!record) return 0;

    const { outputIndicators, outcomeIndicators, impactIndicators } = record.metrics;
    const outputAvg = Object.values(outputIndicators).reduce((a, b) => a + b, 0) / Math.max(Object.values(outputIndicators).length, 1);
    const outcomeAvg = Object.values(outcomeIndicators).reduce((a, b) => a + b, 0) / Math.max(Object.values(outcomeIndicators).length, 1);
    const impactAvg = Object.values(impactIndicators).reduce((a, b) => a + b, 0) / Math.max(Object.values(impactIndicators).length, 1);

    return (outputAvg * 0.3 + outcomeAvg * 0.4 + impactAvg * 0.3);
  }

  /**
   * توصیه تصمیم
   */
  recommendDecision(id: string): { decision: 'scale' | 'revise' | 'stop'; reason: string } {
    const record = this.records.get(id);
    if (!record) return { decision: 'stop', reason: 'رکورد یافت نشد' };

    const effectiveness = this.calculateEffectiveness(id);
    const progress = record.metrics.progress;
    const hasSideEffects = record.metrics.sideEffects.length > 0;

    if (effectiveness >= 70 && !hasSideEffects) {
      return { decision: 'scale', reason: `اثربخشی ${effectiveness.toFixed(1)}% — توسعه توصیه می‌شود` };
    }
    if (effectiveness >= 40 || progress < 50) {
      return { decision: 'revise', reason: `اثربخشی ${effectiveness.toFixed(1)}% — نیاز به اصلاح` };
    }
    return { decision: 'stop', reason: `اثربخشی ${effectiveness.toFixed(1)}% — توقف توصیه می‌شود` };
  }

  /**
   * دریافت گزارش کامل
   */
  getReport(id: string): {
    record: InterventionRecord;
    effectiveness: number;
    recommendation: { decision: string; reason: string };
    timeline: string[];
  } | null {
    const record = this.records.get(id);
    if (!record) return null;

    return {
      record,
      effectiveness: this.calculateEffectiveness(id),
      recommendation: this.recommendDecision(id),
      timeline: record.history.map(e => `${e.timestamp}: ${e.description}`),
    };
  }

  /**
   * لیست تمام رکوردها
   */
  getAllRecords(): InterventionRecord[] {
    return Array.from(this.records.values());
  }

  /**
   * آمار کلی
   */
  getStats(): {
    total: number;
    active: number;
    completed: number;
    avgEffectiveness: number;
  } {
    const records = this.getAllRecords();
    const completed = records.filter(r => r.status === 'completed');
    const avgEffectiveness = completed.length > 0
      ? completed.reduce((sum, r) => sum + this.calculateEffectiveness(r.id), 0) / completed.length
      : 0;

    return {
      total: records.length,
      active: records.filter(r => r.status === 'active').length,
      completed: completed.length,
      avgEffectiveness,
    };
  }
}

export const interventionTracker = new InterventionTracker();
