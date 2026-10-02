import {
  scoreAnalyticalProfile,
  type AnalyticalDomain,
  type AnalyticalIndicatorSpec,
  type AnalyticalObservation,
  type AnalyticalResult,
} from './typologyAnalytical';
import {
  evaluateOfficialTypology,
  type OfficialTypologyContext,
  type OfficialTypologyResult,
} from './typologyOfficialRules';
import { getIndicatorSemantic, SEMANTIC_SCHEMA_VERSION } from './typologyIndicatorSemantics';
import type { IndicatorTask, MeasurementQuality, MeasurementRecord } from './typologyTypes';

export const DUAL_LAYER_VERSION = 'iran-neighborhood-dual-layer.v1';

export interface DualLayerOfficialLabel {
  code: string;
  label_fa: string;
  membership: number;
  eligible: boolean;
  confidence: number;
  reason: string;
  intervention: string;
  evidence_codes: string[];
  requires_expert_confirmation: boolean;
}

export interface DualLayerFuzzyMembership {
  code: string;
  label_fa: string;
  membership: number;
  description: string;
}

export interface DualLayerUncertainty {
  low?: number;
  high?: number;
  method?: string;
  contributing_indicators?: number;
}

export interface DualLayerTypologyResult {
  version: string;
  semantic_schema_version: string;
  official: OfficialTypologyResult;
  analytical: AnalyticalResult;
  official_labels: DualLayerOfficialLabel[];
  analytical_profile: {
    physical: number | null;
    behavioral: number | null;
    normative: number | null;
    SI: number | null;
    dominant_domain: AnalyticalDomain | null;
  };
  fuzzy_memberships: DualLayerFuzzyMembership[];
  coverage: Record<AnalyticalDomain, number>;
  quality: number | null;
  uncertainty: DualLayerUncertainty | null;
  provisional: boolean;
  warnings: string[];
  computed_at: string;
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function latestMeasurements(measurements: MeasurementRecord[]): Map<string, MeasurementRecord> {
  const rows = measurements
    .filter((measurement) => !measurement.superseded_by)
    .slice()
    .sort((left, right) => left.created_at.localeCompare(right.created_at));
  return new Map(rows.map((measurement) => [measurement.indicator_code, measurement]));
}

function qualityFactor(quality: MeasurementQuality): number {
  const parts = [
    quality.source_reliability,
    quality.spatial_coverage,
    quality.temporal_coverage,
    quality.method_validity,
    quality.validation_score,
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (parts.length === 0) return clamp(quality.score ?? 0);
  if (parts.some((value) => value <= 0)) return 0;
  return clamp(Math.exp(parts.reduce((sum, value) => sum + Math.log(clamp(value, 1e-9, 1)), 0) / parts.length));
}

function analyticalDirection(task: IndicatorTask): 'benefit' | 'cost' | 'target' {
  const semantic = getIndicatorSemantic(task.code);
  if (semantic?.polarity === 'cost') return 'cost';
  if (semantic?.polarity === 'target' || semantic?.polarity === 'contextual') return 'target';
  return 'benefit';
}

function scoreNormalized(measurement: MeasurementRecord): number | null {
  const relative = finite(measurement.score_relative_0_1);
  if (relative !== null) return clamp(relative);
  const absolute = finite(measurement.score_absolute_0_1);
  if (absolute !== null) return clamp(absolute);
  const score = finite(measurement.score_1_5);
  return score === null ? null : clamp((score - 1) / 4);
}

function buildAnalyticalSpecs(tasks: IndicatorTask[]): AnalyticalIndicatorSpec[] {
  return tasks.map((task) => ({
    code: task.code,
    domain: task.domain as AnalyticalDomain,
    driverId: task.driver_id,
    weight: Math.max(0, task.domain_weight_percent),
    direction: analyticalDirection(task),
    lower: 0,
    upper: 1,
    target: analyticalDirection(task) === 'target' ? 0.5 : undefined,
    tolerance: analyticalDirection(task) === 'target' ? 0.15 : undefined,
    label: task.indicator,
  }));
}

function buildAnalyticalObservations(tasks: IndicatorTask[], measurements: MeasurementRecord[]): AnalyticalObservation[] {
  const current = latestMeasurements(measurements);
  return tasks.map((task) => {
    const measurement = current.get(task.code);
    if (!measurement) return { code: task.code, value: null, status: 'missing' };
    const normalized = scoreNormalized(measurement);
    const quality = qualityFactor(measurement.quality);
    return {
      code: task.code,
      value: normalized,
      normalized,
      score1to5: measurement.score_1_5,
      direction: analyticalDirection(task),
      quality: {
        score: quality,
        sourceReliability: measurement.quality.source_reliability,
        spatialCoverage: measurement.quality.spatial_coverage,
        temporalCoverage: measurement.quality.temporal_coverage,
        flags: measurement.quality.flags,
      },
      coverage: Math.min(
        measurement.quality.spatial_coverage ?? 1,
        measurement.quality.temporal_coverage ?? 1,
        measurement.source.coverage ?? 1,
      ),
      status: measurement.status,
      source: measurement.source.dataset_id,
      referenceDate: measurement.reference_date,
    };
  });
}

function officialObservations(tasks: IndicatorTask[], measurements: MeasurementRecord[]) {
  const current = latestMeasurements(measurements);
  return tasks.flatMap((task) => {
    const measurement = current.get(task.code);
    if (!measurement) return [];
    const normalized = scoreNormalized(measurement);
    return [{
      code: task.code,
      value: typeof measurement.cleaned_value === 'number' ? measurement.cleaned_value : null,
      normalized,
      score1to5: measurement.score_1_5,
      // Every score accepted by the legacy engine is oriented so that higher
      // means better. Official criteria describe adverse conditions, hence
      // their severity is the complement of that standardized score.
      severity: normalized === null ? null : 1 - normalized,
      direction: analyticalDirection(task),
      quality: {
        score: qualityFactor(measurement.quality),
        sourceReliability: measurement.quality.source_reliability,
        spatialCoverage: measurement.quality.spatial_coverage,
        temporalCoverage: measurement.quality.temporal_coverage,
        flags: measurement.quality.flags,
      },
      coverage: Math.min(
        measurement.quality.spatial_coverage ?? 1,
        measurement.quality.temporal_coverage ?? 1,
        measurement.source.coverage ?? 1,
      ),
      status: measurement.status,
      source: measurement.source.dataset_id,
      authoritative: measurement.source.source_tier === 'official_authoritative',
      referenceDate: measurement.reference_date,
    }];
  });
}

function dominantDomain(result: AnalyticalResult): AnalyticalDomain | null {
  const rows = (['physical', 'behavioral', 'normative'] as const)
    .map((domain) => ({ domain, score: result.domains[domain].normalizedScore }))
    .filter((row): row is { domain: AnalyticalDomain; score: number } => row.score !== null);
  return rows.sort((left, right) => right.score - left.score)[0]?.domain ?? null;
}

function averageQuality(tasks: IndicatorTask[], measurements: MeasurementRecord[]): number | null {
  const taskByCode = new Map(tasks.map((task) => [task.code, task]));
  let numerator = 0;
  let denominator = 0;
  for (const measurement of latestMeasurements(measurements).values()) {
    if (!['measured', 'validated'].includes(measurement.status)) continue;
    const task = taskByCode.get(measurement.indicator_code);
    if (!task) continue;
    const weight = Math.max(0, task.domain_weight_percent);
    numerator += qualityFactor(measurement.quality) * weight;
    denominator += weight;
  }
  return denominator > 0 ? numerator / denominator : null;
}

function summarizeUncertainty(tasks: IndicatorTask[], measurements: MeasurementRecord[]): DualLayerUncertainty | null {
  const taskByCode = new Map(tasks.map((task) => [task.code, task]));
  let low = 0;
  let high = 0;
  let weightSum = 0;
  let count = 0;
  for (const measurement of latestMeasurements(measurements).values()) {
    const uncertainty = measurement.uncertainty ?? {};
    const lower = finite(uncertainty.score_low_1_5 ?? uncertainty.low_1_5 ?? uncertainty.lower_1_5);
    const upper = finite(uncertainty.score_high_1_5 ?? uncertainty.high_1_5 ?? uncertainty.upper_1_5);
    const task = taskByCode.get(measurement.indicator_code);
    if (lower === null || upper === null || upper < lower || !task) continue;
    const weight = Math.max(0, task.domain_weight_percent) * qualityFactor(measurement.quality);
    if (weight <= 0) continue;
    low += lower * weight;
    high += upper * weight;
    weightSum += weight;
    count += 1;
  }
  return weightSum > 0
    ? { low: low / weightSum, high: high / weightSum, method: 'quality-weighted indicator intervals', contributing_indicators: count }
    : null;
}

const FUZZY_LABELS_FA: Record<string, string> = {
  PHYSICAL_DEFICIT: 'کمبود کالبدی و زیرساختی',
  BEHAVIORAL_DEFICIT: 'کمبود ظرفیت رفتاری و اجتماعی',
  NORMATIVE_DEFICIT: 'کمبود ظرفیت هنجاری و نهادی',
  MULTIDIMENSIONAL_DEFICIT: 'کمبود چندبعدی',
  BALANCED_HIGH_CAPACITY: 'محله متوازن با ظرفیت بالا',
  TRANSITIONAL_PROFILE: 'پروفایل گذار یا ترکیبی',
  PHYSICAL_LEAP_CAPACITY: 'ظرفیت نهفته برای جهش کالبدی',
};

export function computeDualLayerTypology(
  tasks: IndicatorTask[],
  measurements: MeasurementRecord[],
  officialContext: OfficialTypologyContext = {},
): DualLayerTypologyResult {
  const analytical = scoreAnalyticalProfile(
    buildAnalyticalSpecs(tasks),
    buildAnalyticalObservations(tasks, measurements),
    {
      version: `${DUAL_LAYER_VERSION}:analytical`,
      minimumDomainCoverage: 0.7,
      minimumDriverCoverage: 0.5,
      rejectFailedQa: true,
    },
  );
  const official = evaluateOfficialTypology(
    officialObservations(tasks, measurements),
    officialContext,
    { version: `${DUAL_LAYER_VERSION}:official-1400` },
  );
  const quality = averageQuality(tasks, measurements);
  const uncertainty = summarizeUncertainty(tasks, measurements);
  const warnings = [...new Set([
    ...analytical.warnings,
    ...official.warnings,
    ...(uncertainty ? [] : ['uncertainty_not_computed']),
    ...(quality === null ? ['quality_not_computed'] : []),
  ])];
  const provisional = analytical.status !== 'complete' || official.status !== 'authoritative' || uncertainty === null;
  return {
    version: DUAL_LAYER_VERSION,
    semantic_schema_version: SEMANTIC_SCHEMA_VERSION,
    official,
    analytical,
    official_labels: official.labels.map((label) => ({
      code: label.code,
      label_fa: label.labelFa,
      membership: label.membership,
      eligible: label.eligible,
      confidence: label.confidence,
      reason: `${label.basis}; ${label.evidenceCodes.length} evidence item(s)`,
      intervention: label.intervention,
      evidence_codes: label.evidenceCodes,
      requires_expert_confirmation: label.requiresExpertConfirmation,
    })),
    analytical_profile: {
      physical: analytical.domains.physical.score1to5,
      behavioral: analytical.domains.behavioral.score1to5,
      normative: analytical.domains.normative.score1to5,
      SI: analytical.SI1to5,
      dominant_domain: dominantDomain(analytical),
    },
    fuzzy_memberships: analytical.multiLabels.map((label) => ({
      code: label.code,
      label_fa: FUZZY_LABELS_FA[label.code] ?? label.label,
      membership: label.membership,
      description: label.evidence.join(', '),
    })),
    coverage: {
      physical: analytical.domains.physical.coverage,
      behavioral: analytical.domains.behavioral.coverage,
      normative: analytical.domains.normative.coverage,
    },
    quality,
    uncertainty,
    provisional,
    warnings,
    computed_at: new Date().toISOString(),
  };
}

