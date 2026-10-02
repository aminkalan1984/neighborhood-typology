import type { IndicatorTask, MeasurementRecord, ScoreResult } from './typologyTypes';

const DOMAINS = ['physical', 'behavioral', 'normative'] as const;

type Domain = (typeof DOMAINS)[number];

const LABELS: Record<Domain, Array<{ min: number; max: number; en: string; fa: string }>> = {
  physical: [
    { min: 1, max: 2, en: 'latent', fa: 'نهفته' },
    { min: 2, max: 4, en: 'transitional', fa: 'پهنه‌بین' },
    { min: 4, max: 5.000001, en: 'driver', fa: 'سراسربین' },
  ],
  behavioral: [
    { min: 1, max: 2, en: 'indifferent', fa: 'بی‌تفاوت' },
    { min: 2, max: 4, en: 'interaction_ready', fa: 'مستعد تعامل' },
    { min: 4, max: 5.000001, en: 'agentic', fa: 'عامل' },
  ],
  normative: [
    { min: 1, max: 2, en: 'regressive', fa: 'پس‌رونده' },
    { min: 2, max: 4, en: 'transitioning', fa: 'در حال گذار' },
    { min: 4, max: 5.000001, en: 'leading', fa: 'پیشرو' },
  ],
};

function scoreBand(value: number): 'L' | 'M' | 'H' {
  if (value < 2) return 'L';
  if (value < 4) return 'M';
  return 'H';
}

function labelFor(domain: Domain, score: number | null, field: 'en' | 'fa'): string | null {
  if (score === null) return null;
  return LABELS[domain].find((label) => score >= label.min && score < label.max)?.[field] ?? null;
}

function imbalanceScenario(
  physical: number | null,
  behavioral: number | null,
  normative: number | null,
  drivers: Record<string, number | null>,
): ScoreResult['scenario'] {
  if (physical === null || behavioral === null || normative === null) return null;
  const pattern = `${scoreBand(physical)}${scoreBand(behavioral)}${scoreBand(normative)}`;
  if (pattern.includes('M')) {
    return {
      pattern,
      code: 'INTERMEDIATE_IMBALANCE',
      label: 'transitional or intermediate imbalance',
      label_fa: 'گذار یا ناترازی میانی',
      requires_review: true,
      rationale: 'At least one domain is in the middle band; no extreme scenario is asserted.',
    };
  }

  const scenarios: Record<string, Omit<NonNullable<ScoreResult['scenario']>, 'pattern'>> = {
    HHL: {
      code: 'INSTITUTIONAL_DISCONNECT',
      label: 'institutional disconnect and deterioration risk',
      label_fa: 'گسست نهادی و خطر زوال',
      requires_review: true,
      rationale: 'Physical and behavioral domains are high while the normative domain is low.',
    },
    HLL: {
      code: 'ADVANCED_INFRASTRUCTURE_LOW_CAPACITY',
      label: 'advanced infrastructure with behavioral and institutional weakness',
      label_fa: 'زیرساخت پیشرفته با ضعف رفتاری و نهادی',
      requires_review: true,
      rationale: 'Only the physical domain is high.',
    },
    LHH: {
      code: 'LATENT_LEAP_CAPACITY',
      label: 'latent capacity ready for a physical leap',
      label_fa: 'ظرفیت نهفته و آماده جهش',
      requires_review: false,
      rationale: 'Behavioral and normative domains are high while the physical domain is low.',
    },
    LLH: {
      code: 'EVIDENCE_REVIEW_REQUIRED',
      label: 'unusual normative-led pattern requiring evidence review',
      label_fa: 'الگوی نامحتمل؛ نیازمند بازبینی شواهد',
      requires_review: true,
      rationale: 'The normative domain is high while both other domains are low.',
    },
    LHL: {
      code: 'AGENCY_WITH_STRUCTURAL_WEAKNESS',
      label: 'agency capacity with physical and institutional weakness',
      label_fa: 'ظرفیت کنشگری با ضعف کالبدی و نهادی',
      requires_review: true,
      rationale: 'Only the behavioral domain is high.',
    },
    LLL: {
      code: 'MULTIDIMENSIONAL_CRITICAL',
      label: 'multidimensional critical condition requiring verification',
      label_fa: 'بحرانی چندبعدی؛ نیازمند راستی‌آزمایی',
      requires_review: true,
      rationale: 'All three domains are low; the result is retained and flagged rather than suppressed.',
    },
    HHH: {
      code: 'BALANCED_DRIVER',
      label: 'balanced driver',
      label_fa: 'پیشران متوازن',
      requires_review: false,
      rationale: 'All three domains are high.',
    },
  };

  if (pattern === 'HLH') {
    const economic = Math.min(drivers.B1 ?? 5, drivers.B2 ?? 5);
    const social = Math.min(drivers.B3 ?? 5, drivers.B4 ?? 5);
    const livelihoodLocked = economic <= social;
    return {
      pattern,
      code: livelihoodLocked ? 'LIVELIHOOD_LOCK_IN' : 'PARTICIPATION_DEFICIT',
      label: livelihoodLocked ? 'livelihood lock-in' : 'participation or social-attraction deficit',
      label_fa: livelihoodLocked ? 'قفل‌شدگی معیشتی' : 'کمبود مشارکت یا جذب اجتماعی',
      requires_review: true,
      rationale: livelihoodLocked
        ? 'B1/B2 are no stronger than B3/B4, so the behavioral weakness is primarily economic.'
        : 'B3/B4 are weaker than B1/B2, so the behavioral weakness is primarily social.',
    };
  }

  const scenario = scenarios[pattern];
  return scenario ? { pattern, ...scenario } : {
    pattern,
    code: 'UNMAPPED_PATTERN',
    label: 'pattern requires expert review',
    label_fa: 'الگوی نیازمند بازبینی کارشناس',
    requires_review: true,
    rationale: 'No approved extreme-pattern rule matched.',
  };
}

function latestActiveMeasurements(measurements: MeasurementRecord[]): Map<string, MeasurementRecord> {
  const sorted = measurements
    .filter((measurement) => !measurement.superseded_by)
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return new Map(sorted.map((measurement) => [measurement.indicator_code, measurement]));
}

function weightedConfidence(
  rows: Array<{ task: IndicatorTask; measurement: MeasurementRecord }>,
): number | null {
  let numerator = 0;
  let denominator = 0;
  for (const { task, measurement } of rows) {
    if (measurement.quality.score === undefined) continue;
    numerator += measurement.quality.score * task.domain_weight_percent;
    denominator += task.domain_weight_percent;
  }
  return denominator > 0 ? numerator / denominator : null;
}

export function aggregateTypology(
  tasks: IndicatorTask[],
  measurements: MeasurementRecord[],
  options: { minimumDomainCoverage?: number } = {},
): ScoreResult {
  const minimumDomainCoverage = options.minimumDomainCoverage ?? 0.7;
  const taskByCode = new Map(tasks.map((task) => [task.code, task]));
  const current = latestActiveMeasurements(measurements);
  const validRows: Array<{ task: IndicatorTask; measurement: MeasurementRecord; score: number }> = [];
  const invalid: Array<{ code: string; reason: string }> = [];

  for (const [code, measurement] of current) {
    const task = taskByCode.get(code);
    if (!task) {
      invalid.push({ code, reason: 'unknown_indicator_code' });
      continue;
    }
    if (!['measured', 'validated'].includes(measurement.status)) continue;
    if (measurement.score_1_5 === null || !Number.isFinite(measurement.score_1_5)) {
      invalid.push({ code, reason: 'missing_standardized_score' });
      continue;
    }
    if (measurement.score_1_5 < 1 || measurement.score_1_5 > 5) {
      invalid.push({ code, reason: 'score_out_of_range' });
      continue;
    }
    if (measurement.quality.flags.includes('FAILED_QA')) {
      invalid.push({ code, reason: 'failed_qa' });
      continue;
    }
    validRows.push({ task, measurement, score: measurement.score_1_5 });
  }

  const domainScores: Record<string, number | null> = {};
  const domainCoverage: Record<string, number> = {};
  const domainConfidence: Record<string, number | null> = {};
  for (const domain of DOMAINS) {
    const allWeight = tasks.filter((task) => task.domain === domain).reduce((sum, task) => sum + task.domain_weight_percent, 0);
    const rows = validRows.filter(({ task }) => task.domain === domain);
    const usedWeight = rows.reduce((sum, { task }) => sum + task.domain_weight_percent, 0);
    domainCoverage[domain] = allWeight > 0 ? usedWeight / allWeight : 0;
    domainScores[domain] = usedWeight > 0
      ? rows.reduce((sum, row) => sum + row.score * row.task.domain_weight_percent, 0) / usedWeight
      : null;
    domainConfidence[domain] = weightedConfidence(rows);
  }

  const driverIds = [...new Set(tasks.map((task) => task.driver_id))].sort();
  const driverScores: Record<string, number | null> = {};
  const driverCoverage: Record<string, number> = {};
  for (const driverId of driverIds) {
    const allWeight = tasks.filter((task) => task.driver_id === driverId).reduce((sum, task) => sum + task.domain_weight_percent, 0);
    const rows = validRows.filter(({ task }) => task.driver_id === driverId);
    const usedWeight = rows.reduce((sum, { task }) => sum + task.domain_weight_percent, 0);
    driverCoverage[driverId] = allWeight > 0 ? usedWeight / allWeight : 0;
    driverScores[driverId] = usedWeight > 0
      ? rows.reduce((sum, row) => sum + row.score * row.task.domain_weight_percent, 0) / usedWeight
      : null;
  }

  const P = domainScores.physical;
  const B = domainScores.behavioral;
  const N = domainScores.normative;
  const complete = P !== null && B !== null && N !== null;
  const si = complete ? Math.cbrt(P * B * N) : null;
  const coveragePass = DOMAINS.every((domain) => domainCoverage[domain] >= minimumDomainCoverage);

  return {
    domain_scores: domainScores,
    domain_labels: Object.fromEntries(DOMAINS.map((domain) => [domain, labelFor(domain, domainScores[domain], 'en')])),
    domain_labels_fa: Object.fromEntries(DOMAINS.map((domain) => [domain, labelFor(domain, domainScores[domain], 'fa')])),
    weighted_coverage: domainCoverage,
    driver_scores: driverScores,
    driver_coverage: driverCoverage,
    SI: si,
    scenario: imbalanceScenario(P, B, N, driverScores),
    invalid_measurements: invalid,
    confidence: domainConfidence,
    label_stability: null,
    status: complete && coveragePass ? 'certified' : 'provisional',
    computed_at: new Date().toISOString(),
  };
}

export function verificationGates(
  boundaryConfidence: number | undefined,
  score: ScoreResult | undefined,
): { eligible: boolean; failures: string[] } {
  const failures: string[] = [];
  if ((boundaryConfidence ?? 0) < 0.9) failures.push('boundary_confidence_below_0_90');
  if (!score) return { eligible: false, failures: [...failures, 'score_not_computed'] };
  for (const domain of DOMAINS) {
    if ((score.weighted_coverage[domain] ?? 0) < 0.7) failures.push(`${domain}_coverage_below_0_70`);
  }
  for (const [driver, coverage] of Object.entries(score.driver_coverage)) {
    if (coverage < 0.5) failures.push(`${driver}_coverage_below_0_50`);
  }
  if (score.label_stability === null) failures.push('label_stability_not_computed');
  else if (score.label_stability < 0.8) failures.push('label_stability_below_0_80');
  if (score.invalid_measurements.length > 0) failures.push('invalid_measurements_present');
  return { eligible: failures.length === 0, failures };
}

