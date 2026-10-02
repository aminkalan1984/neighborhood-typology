import { randomUUID } from 'node:crypto';
import { mergeTypologyConfig } from './config.js';
import { classifyBand, clamp, geometricMean } from './normalization.js';
import { nextActionForTask } from './planner.js';
import type {
  AggregateOptions,
  AggregateSummary,
  Domain,
  EvidenceRecord,
  ImbalanceResult,
  IndicatorAuditRow,
  IndicatorMeasurement,
  IndicatorRegistry,
  MeasurementStatus,
  PublicationLevel,
  RegistryIndex,
  SupplyTask,
  TypologyResult,
} from './types.js';

const DOMAINS: Domain[] = ['physical', 'behavioral', 'normative'];
const DOMAIN_LABELS: Record<Domain, [string, string, string]> = {
  physical: ['نهفته', 'پهنه‌بین', 'سراسربین'],
  behavioral: ['بی‌تفاوت', 'مستعد تعامل', 'عامل'],
  normative: ['پس‌رونده', 'در حال گذار', 'پیشرو'],
};

const SCENARIO_LABELS: Record<string, { code: string; label: string; requiresReview: boolean; reason: string }> = {
  HHL: { code: 'INSTITUTIONAL_GAP', label: 'گسست نهادی و خطر زوال', requiresReview: true, reason: 'کالبدی و رفتاری بالا هستند اما ساحت هنجاری پایین است.' },
  HLL: { code: 'INFRASTRUCTURE_LEADS', label: 'زیرساخت پیشرفته با ضعف رفتاری و نهادی', requiresReview: true, reason: 'زیرساخت از ظرفیت کنشگری و نهادهای محله جلوتر است.' },
  LHH: { code: 'LATENT_CAPACITY', label: 'ظرفیت نهفته و آماده جهش', requiresReview: false, reason: 'رفتار و نهادها ظرفیت جبران ضعف کالبدی را نشان می‌دهند.' },
  LLH: { code: 'UNLIKELY_PATTERN', label: 'الگوی نامحتمل؛ نیازمند بازبینی شواهد', requiresReview: true, reason: 'ساحت هنجاری بالا با دو ساحت پایین باید با شواهد مستقل ممیزی شود.' },
  LHL: { code: 'ACTOR_CAPACITY', label: 'ظرفیت کنشگری با ضعف کالبدی و نهادی', requiresReview: true, reason: 'رفتار کنشگر است اما زیرساخت و نهاد پشتیبان کافی نیست.' },
  LLL: { code: 'MULTIDIMENSIONAL_CRISIS', label: 'بحرانی چندبعدی؛ نیازمند راستی‌آزمایی', requiresReview: true, reason: 'هر سه ساحت پایین‌اند؛ هیچ داده‌ای نباید برای حذف این الگو دستکاری شود.' },
  HHH: { code: 'BALANCED_DRIVER', label: 'پیشران متوازن', requiresReview: false, reason: 'هر سه ساحت در سطح پیشران قرار دارند.' },
};

function getFinite(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const number = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function normalizeStatus(value: unknown): MeasurementStatus | null {
  const normalized = String(value ?? '').trim().toUpperCase();
  const aliases: Record<string, MeasurementStatus> = {
    MEASURED: 'MEASURED', VALIDATED: 'VALIDATED', COMPUTED: 'COMPUTED', APPROVED: 'APPROVED',
    MISSING: 'MISSING', NOT_AVAILABLE: 'NOT_AVAILABLE', FAILED_QA: 'FAILED_QA',
    WAITING_FOR_ORGANIZATIONAL_DATA: 'WAITING_FOR_ORGANIZATIONAL_DATA',
    WAITING_FOR_SURVEY: 'WAITING_FOR_SURVEY', WAITING_FOR_FIELD_AUDIT: 'WAITING_FOR_FIELD_AUDIT',
  };
  if (aliases[normalized]) return aliases[normalized];
  if (normalized === 'VALIDATED' || normalized === 'MEASURED') return normalized as MeasurementStatus;
  return null;
}

function statusIsComputable(status: MeasurementStatus | null): boolean {
  return status === 'MEASURED' || status === 'VALIDATED' || status === 'COMPUTED' || status === 'APPROVED';
}

function qualityFor(measurement: IndicatorMeasurement, evidence: EvidenceRecord[]): { score: number; coverage: number; flags: string[] } {
  const quality = typeof measurement.quality === 'object' && measurement.quality !== null ? measurement.quality : {};
  const evidenceScores = evidence.map((item) => getFinite(item.qualityScore)).filter((item): item is number => item !== null);
  const explicit = getFinite(measurement.qualityScore, quality.qualityScore, typeof measurement.quality === 'object' ? null : measurement.quality);
  let score = explicit ?? (evidenceScores.length ? evidenceScores.reduce((sum, value) => sum + value, 0) / evidenceScores.length : 0.5);
  score = clamp(score, 0, 1);
  const spatial = getFinite(quality.spatialCoverage, evidence[0]?.spatialCoverage);
  const temporal = getFinite(quality.temporalCoverage, evidence[0]?.temporalCoverage);
  const coverage = clamp(Math.min(spatial ?? 1, temporal ?? 1), 0, 1);
  const flags = [...(quality.flags ?? [])];
  if (explicit === null && !evidenceScores.length) flags.push('QUALITY_UNSPECIFIED');
  if (coverage < 1) flags.push('PARTIAL_COVERAGE');
  return { score, coverage, flags: [...new Set(flags)] };
}

function evidenceIdsFor(measurement: IndicatorMeasurement): string[] {
  const ids = [...(measurement.evidenceIds ?? []), ...(measurement.evidence_ids ?? [])];
  if (measurement.evidence_id) ids.push(measurement.evidence_id);
  return [...new Set(ids.filter(Boolean))];
}

function normalizeEvidence(input: EvidenceRecord[] | undefined): EvidenceRecord[] {
  return (input ?? []).map((item) => {
    const source = item.source ?? {};
    return {
      ...item,
      id: String(item.id ?? item.evidence_id ?? ''),
      indicatorCode: item.indicatorCode ?? item.indicator_code,
      sourceOrganization: item.sourceOrganization ?? source.organization,
      sourceUrl: item.sourceUrl ?? source.url,
      datasetId: item.datasetId ?? source.dataset_id,
      version: item.version ?? source.version,
      retrievedAt: item.retrievedAt ?? source.retrieved_at,
      checksum: item.checksum ?? source.checksum,
      license: item.license ?? source.license,
    };
  }).filter((item) => item.id.length > 0);
}

function measurementCode(measurement: IndicatorMeasurement): string {
  return String(measurement.code ?? measurement.indicatorCode ?? measurement.indicator_code ?? '').trim();
}

function taskFor(registry: IndicatorRegistry): SupplyTask {
  const channels = registry.accessMode.includes('سازمانی') || registry.accessMode.includes('غیرعمومی')
    ? [{ id: 'organizational' as const, label: 'درخواست داده سازمانی', playbookCodes: registry.playbookCodes, required: true }]
    : registry.accessMode.includes('میدانی')
      ? [{ id: (registry.template === 'survey' || registry.calcFamily === 'survey_or_assessment' ? 'survey' : 'field') as 'survey' | 'field', label: 'داده اولیه', playbookCodes: registry.playbookCodes, required: true }]
      : [{ id: 'public' as const, label: 'داده برخط/باز', playbookCodes: registry.playbookCodes, required: true }];
  return {
    code: registry.code,
    sourceOrder: registry.sourceOrder,
    domain: registry.domain,
    driverId: registry.driverId,
    indicator: registry.indicator,
    calcFamily: registry.calcFamily,
    formulaVersion: registry.formulaVersion,
    formulaText: registry.formulaText,
    accessMode: registry.accessMode,
    playbookCodes: registry.playbookCodes,
    sourceRequirements: registry.sourceRequirements,
    channels,
    status: 'PLANNED',
    nextAction: 'provide_required_data',
    missingReasons: [],
  };
}

function labelFor(domain: Domain, score: number): string {
  const band = classifyBand(score);
  return DOMAIN_LABELS[domain][band === 'L' ? 0 : band === 'M' ? 1 : 2];
}

function imbalanceFor(
  domainScores: Record<Domain, number | null>,
  driverScores: Record<string, number | null>,
): ImbalanceResult | null {
  if (DOMAINS.some((domain) => domainScores[domain] === null)) return null;
  const bands = {
    physical: classifyBand(domainScores.physical!),
    behavioral: classifyBand(domainScores.behavioral!),
    normative: classifyBand(domainScores.normative!),
  } as Record<Domain, 'L' | 'M' | 'H'>;
  const pattern = `${bands.physical}${bands.behavioral}${bands.normative}`;
  if (pattern.includes('M')) {
    return {
      pattern,
      code: 'TRANSITIONAL_IMBALANCE',
      label: 'گذار/ناترازی میانی',
      requiresReview: true,
      reason: 'حداقل یک ساحت در سطح متوسط قرار دارد؛ نزدیک‌ترین سناریو فقط توضیح ثانویه است.',
      domainBands: bands,
    };
  }
  let scenario = SCENARIO_LABELS[pattern] ?? {
    code: 'UNCLASSIFIED_PATTERN', label: 'الگوی نیازمند بازبینی', requiresReview: true,
    reason: 'الگوی سه‌ساحتی در جدول مصوب تعریف نشده است.',
  };
  if (pattern === 'HLH') {
    const economic = Math.min(driverScores.B1 ?? 5, driverScores.B2 ?? 5);
    const social = Math.min(driverScores.B3 ?? 5, driverScores.B4 ?? 5);
    scenario = economic <= social
      ? { code: 'LIVELIHOOD_LOCK_IN', label: 'قفل‌شدگی معیشتی و نیاز به تغییر مسیر توسعه', requiresReview: true, reason: 'B1/B2 از B3/B4 پایین‌ترند و گلوگاه معیشتی غالب است.' }
      : { code: 'SOCIAL_ABSORPTION_GAP', label: 'کمبود مشارکت/جذب اجتماعی', requiresReview: true, reason: 'B3/B4 از B1/B2 پایین‌ترند و گلوگاه جذب اجتماعی غالب است.' };
  }
  return { pattern, ...scenario, domainBands: bands };
}

function deterministicRandom(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function uncertaintyFor(
  domainScores: Record<Domain, number | null>,
  ranges: Record<Domain, [number, number] | null>,
  driverScores: Record<string, number | null>,
  options: AggregateOptions,
  baseScenario: ImbalanceResult | null,
  threshold: number,
): { low: number | null; high: number | null; labelStability: number; samples: number; method: string } {
  if (DOMAINS.some((domain) => domainScores[domain] === null)) {
    return { low: null, high: null, labelStability: 0, samples: 0, method: 'insufficient_domain_data' };
  }
  if (options.labelStability !== undefined) {
    const si = geometricMean(DOMAINS.map((domain) => domainScores[domain]!));
    return { low: si, high: si, labelStability: clamp(options.labelStability, 0, 1), samples: 0, method: 'provided_bootstrap_summary' };
  }
  const samples = Math.max(20, Math.min(2000, Math.trunc(options.uncertaintySamples ?? 250)));
  const random = deterministicRandom(options.seed ?? 419);
  let stable = 0;
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < samples; index += 1) {
    const sampled = {} as Record<Domain, number>;
    for (const domain of DOMAINS) {
      const range = ranges[domain];
      if (range) sampled[domain] = range[0] + random() * (range[1] - range[0]);
      else sampled[domain] = domainScores[domain]!;
    }
    const sampledSi = geometricMean(DOMAINS.map((domain) => sampled[domain]))!;
    low = Math.min(low, sampledSi);
    high = Math.max(high, sampledSi);
    const sampledScenario = imbalanceFor(sampled, driverScores);
    const samePattern = sampledScenario?.pattern === baseScenario?.pattern;
    if (samePattern) stable += 1;
  }
  const labelStability = samples ? stable / samples : 0;
  return {
    low: Number.isFinite(low) ? low : null,
    high: Number.isFinite(high) ? high : null,
    labelStability: labelStability || (threshold <= 0 ? 1 : 0),
    samples,
    method: 'deterministic_monte_carlo_domain_score_bounds',
  };
}

function publicationLevel(
  domainScores: Record<Domain, number | null>,
  weightedCoverage: Record<Domain, number>,
  driverCoverage: Record<string, number>,
  uncertainty: { labelStability: number },
  options: AggregateOptions,
  config: ReturnType<typeof mergeTypologyConfig>,
  missingCritical: boolean,
  invalidCount: number,
  verificationBlocked: boolean,
): PublicationLevel {
  if (options.fundamentalQaFailure) return 'REJECTED';
  const boundary = options.boundaryConfidence;
  if (boundary === null || boundary === undefined || boundary < config.quality.boundaryConfidenceMinimum) return 'EXPLORATORY';
  if (DOMAINS.some((domain) => domainScores[domain] === null)) return 'PROVISIONAL';
  if (Object.values(weightedCoverage).some((value) => value < config.scoring.minimumDomainWeightCoverage)) return 'PROVISIONAL';
  if (Object.values(driverCoverage).some((value) => value < config.scoring.minimumDriverWeightCoverage)) return 'PROVISIONAL';
  if (missingCritical || verificationBlocked || invalidCount > 0 || uncertainty.labelStability < config.scoring.minimumBootstrapLabelStability) return 'PROVISIONAL';
  if (!options.expertApproved) return 'PROVISIONAL';
  return 'VERIFIED';
}

function statusForAudit(measurement: IndicatorMeasurement | undefined, valid: boolean): IndicatorAuditRow['status'] {
  if (!measurement) return 'MISSING';
  const status = normalizeStatus(measurement.status);
  if (!valid && statusIsComputable(status)) return 'FAILED_QA';
  return status ?? 'MISSING';
}

function emptyAggregate(totalWeight: number, totalCount: number, missingCodes: string[]): AggregateSummary {
  return { score: null, weightedCoverage: 0, confidence: 0, weightTotal: totalWeight, weightUsed: 0, validIndicatorCount: 0, totalIndicatorCount: totalCount, missingCodes };
}

export function aggregateTypology(
  registry: RegistryIndex,
  measurements: IndicatorMeasurement[],
  evidenceInput: EvidenceRecord[] = [],
  options: AggregateOptions = {},
): TypologyResult {
  const config = mergeTypologyConfig(options.config);
  const runId = options.runId ?? randomUUID();
  const registryVersion = options.registryVersion ?? registry.version;
  const evidence = normalizeEvidence(evidenceInput);
  const evidenceMap = new Map(evidence.map((item) => [item.id, item]));
  const selected = new Map<string, { measurement: IndicatorMeasurement; index: number }>();
  const invalidMeasurements: Array<{ code: string; reason: string; index?: number }> = [];

  measurements.forEach((measurement, index) => {
    const code = measurementCode(measurement);
    if (!registry.byCode.has(code)) {
      invalidMeasurements.push({ code, reason: 'unknown_registry_code', index });
      return;
    }
    const previous = selected.get(code);
    if (!previous) {
      selected.set(code, { measurement: { ...measurement, code }, index });
      return;
    }
    const rank = (item: IndicatorMeasurement): number => {
      const status = normalizeStatus(item.status);
      const statusRank: Record<string, number> = { APPROVED: 4, COMPUTED: 3, VALIDATED: 2, MEASURED: 1 };
      return statusRank[status ?? ''] ?? 0;
    };
    const candidateRank = rank(measurement);
    const previousRank = rank(previous.measurement);
    if (candidateRank > previousRank || (candidateRank === previousRank && String(measurement.updatedAt ?? '').localeCompare(String(previous.measurement.updatedAt ?? '')) > 0)) {
      invalidMeasurements.push({ code, reason: 'duplicate_measurement_replaced', index: previous.index });
      selected.set(code, { measurement: { ...measurement, code }, index });
    } else {
      invalidMeasurements.push({ code, reason: 'duplicate_measurement_ignored', index });
    }
  });

  const validByCode = new Map<string, { measurement: IndicatorMeasurement; score: number; quality: number; coverage: number; evidence: EvidenceRecord[]; flags: string[]; index: number }>();
  const auditRows: IndicatorAuditRow[] = [];
  const missingIndicators: Array<{ code: string; reason: string; nextAction: string }> = [];
  const warningSet = new Set<string>();

  for (const indicator of registry.rows) {
    const selectedMeasurement = selected.get(indicator.code);
    const measurement = selectedMeasurement?.measurement;
    const evidenceIds = measurement ? evidenceIdsFor(measurement) : [];
    const linkedEvidence = evidenceIds.map((id) => evidenceMap.get(id)).filter((item): item is EvidenceRecord => Boolean(item));
    const unknownEvidence = evidenceIds.filter((id) => !evidenceMap.has(id));
    const status = normalizeStatus(measurement?.status);
    const score = getFinite(measurement?.score1to5, measurement?.score_1_5);
    const quality = measurement ? qualityFor(measurement, linkedEvidence) : { score: 0, coverage: 0, flags: [] as string[] };
    const flags = [...quality.flags];
    if (unknownEvidence.length) flags.push('EVIDENCE_REFERENCE_NOT_FOUND');
    if (measurement && !evidenceIds.length) flags.push('EVIDENCE_MISSING');
    if (linkedEvidence.some((item) => !item.datasetId || !item.version || !item.retrievedAt || !item.checksum || !item.license)) flags.push('EVIDENCE_METADATA_INCOMPLETE');
    if (measurement?.imputed) flags.push('IMPUTED_VALUE');
    if (score !== null && (score < config.scoring.scaleMin || score > config.scoring.scaleMax)) flags.push('SCORE_OUT_OF_RANGE');
    if (measurement && !measurement.formulaVersion && !measurement.formula_version) flags.push('FORMULA_VERSION_MISSING');
    const valid = Boolean(measurement && statusIsComputable(status) && score !== null && score >= 1 && score <= 5 && !flags.includes('SCORE_OUT_OF_RANGE'));
    if (measurement && status === 'FAILED_QA') flags.push('FAILED_QA');
    if (measurement && !statusIsComputable(status)) flags.push(`STATUS_${status ?? 'UNKNOWN'}`);
    if (!valid) {
      const reason = !measurement ? 'measurement_missing' : flags[0] ?? 'measurement_not_computable';
      missingIndicators.push({ code: indicator.code, reason, nextAction: nextActionForTask(taskFor(indicator)) });
    } else {
      validByCode.set(indicator.code, { measurement: measurement!, score: score!, quality: quality.score, coverage: quality.coverage, evidence: linkedEvidence, flags, index: selectedMeasurement!.index });
    }
    const rawValue = getFinite(measurement?.rawValue, measurement?.raw_value, measurement?.value);
    const cleanedValue = getFinite(measurement?.cleanedValue, measurement?.cleaned_value, measurement?.value, measurement?.rawValue, measurement?.raw_value);
    auditRows.push({
      code: indicator.code,
      sourceOrder: indicator.sourceOrder,
      domain: indicator.domain,
      driverId: indicator.driverId,
      indicator: indicator.indicator,
      weight: indicator.domainWeightPercent,
      status: statusForAudit(measurement, valid),
      rawValue,
      cleanedValue,
      unit: measurement?.unit ?? null,
      score1to5: score,
      qualityScore: quality.score,
      coverage: quality.coverage,
      evidenceIds,
      evidence: linkedEvidence,
      formulaVersion: measurement?.formulaVersion ?? measurement?.formula_version ?? measurement?.method?.formula_version ?? indicator.formulaVersion,
      direction: indicator.direction,
      flags: [...new Set(flags)],
      nextAction: valid ? 'submit_for_expert_review' : nextActionForTask(taskFor(indicator)),
      trace: { registryVersion, measurementIndex: selectedMeasurement?.index ?? null, evidenceIds },
    });
    for (const flag of flags) warningSet.add(`${indicator.code}:${flag}`);
  }

  const domainScores = {} as Record<Domain, number | null>;
  const weightedCoverage = {} as Record<Domain, number>;
  const domainConfidence = {} as Record<Domain, number>;
  const aggregates = {} as Record<Domain, AggregateSummary>;
  for (const domain of DOMAINS) {
    const rows = registry.rows.filter((row) => row.domain === domain);
    const totalWeight = rows.reduce((sum, row) => sum + row.domainWeightPercent, 0);
    const valid = rows.map((row) => ({ row, value: validByCode.get(row.code) })).filter((item): item is { row: IndicatorRegistry; value: NonNullable<typeof item.value> } => Boolean(item.value));
    const usedWeight = valid.reduce((sum, item) => sum + item.row.domainWeightPercent, 0);
    const score = usedWeight ? valid.reduce((sum, item) => sum + item.value.score * item.row.domainWeightPercent, 0) / usedWeight : null;
    const confidence = usedWeight ? valid.reduce((sum, item) => sum + item.value.quality * item.row.domainWeightPercent, 0) / usedWeight : 0;
    const coverage = totalWeight ? usedWeight / totalWeight : 0;
    const missingCodes = rows.filter((row) => !validByCode.has(row.code)).map((row) => row.code);
    domainScores[domain] = score;
    weightedCoverage[domain] = coverage;
    domainConfidence[domain] = confidence;
    aggregates[domain] = { score, weightedCoverage: coverage, confidence, weightTotal: totalWeight, weightUsed: usedWeight, validIndicatorCount: valid.length, totalIndicatorCount: rows.length, missingCodes };
  }

  const driverScores: Record<string, number | null> = {};
  const driverCoverage: Record<string, number> = {};
  const driverConfidence: Record<string, number> = {};
  const driverAggregates: Record<string, AggregateSummary> = {};
  for (const [driver, rows] of registry.byDriver.entries()) {
    const totalWeight = registry.driverWeightTotals[driver] ?? rows.reduce((sum, row) => sum + row.domainWeightPercent, 0);
    const valid = rows.map((row) => ({ row, value: validByCode.get(row.code) })).filter((item): item is { row: IndicatorRegistry; value: NonNullable<typeof item.value> } => Boolean(item.value));
    const usedWeight = valid.reduce((sum, item) => sum + item.row.domainWeightPercent, 0);
    const score = usedWeight ? valid.reduce((sum, item) => sum + item.value.score * item.row.domainWeightPercent, 0) / usedWeight : null;
    const confidence = usedWeight ? valid.reduce((sum, item) => sum + item.value.quality * item.row.domainWeightPercent, 0) / usedWeight : 0;
    const coverage = totalWeight ? usedWeight / totalWeight : 0;
    const missingCodes = rows.filter((row) => !validByCode.has(row.code)).map((row) => row.code);
    driverScores[driver] = score;
    driverCoverage[driver] = coverage;
    driverConfidence[driver] = confidence;
    driverAggregates[driver] = { score, weightedCoverage: coverage, confidence, weightTotal: totalWeight, weightUsed: usedWeight, validIndicatorCount: valid.length, totalIndicatorCount: rows.length, missingCodes };
  }

  const SI = DOMAINS.every((domain) => domainScores[domain] !== null) ? geometricMean(DOMAINS.map((domain) => domainScores[domain]!)) : null;
  const domainLabels = Object.fromEntries(DOMAINS.map((domain) => [domain, domainScores[domain] === null ? null : labelFor(domain, domainScores[domain]!) ])) as Record<Domain, string | null>;
  const scenario = imbalanceFor(domainScores, driverScores);
  const uncertaintyRanges = {} as Record<Domain, [number, number] | null>;
  for (const domain of DOMAINS) {
    const values = registry.rows.filter((row) => row.domain === domain).map((row) => ({ row, value: validByCode.get(row.code) })).filter((item): item is { row: IndicatorRegistry; value: NonNullable<typeof item.value> } => Boolean(item.value));
    const usedWeight = values.reduce((sum, item) => sum + item.row.domainWeightPercent, 0);
    uncertaintyRanges[domain] = domainScores[domain] === null || !usedWeight ? null : [
      values.reduce((sum, item) => sum + clamp(getFinite(item.value.measurement.uncertaintyLow) ?? item.value.score, 1, 5) * item.row.domainWeightPercent, 0) / usedWeight,
      values.reduce((sum, item) => sum + clamp(getFinite(item.value.measurement.uncertaintyHigh) ?? item.value.score, 1, 5) * item.row.domainWeightPercent, 0) / usedWeight,
    ];
  }
  const uncertainty = uncertaintyFor(domainScores, uncertaintyRanges, driverScores, options, scenario, config.scoring.minimumBootstrapLabelStability);
  const critical = new Set(options.criticalIndicatorCodes ?? []);
  const missingCritical = [...critical].some((code) => missingIndicators.some((item) => item.code === code));
  const verificationBlocked = auditRows.some((row) => row.score1to5 !== null && row.flags.some((flag) => ['EVIDENCE_MISSING', 'EVIDENCE_REFERENCE_NOT_FOUND', 'EVIDENCE_METADATA_INCOMPLETE', 'FORMULA_VERSION_MISSING', 'IMPUTED_VALUE'].includes(flag)));
  const publication = publicationLevel(domainScores, weightedCoverage, driverCoverage, uncertainty, options, config, missingCritical, invalidMeasurements.length, verificationBlocked);
  const status = publication === 'VERIFIED' ? 'verified' : publication === 'REJECTED' ? 'rejected' : publication === 'EXPLORATORY' ? 'exploratory' : 'provisional';
  const formulaVersions = [...new Set(auditRows.map((row) => row.formulaVersion))].sort();
  const immutableInputIds = [...new Set(auditRows.flatMap((row) => row.evidenceIds))].sort();
  return {
    runId,
    registryVersion,
    generatedAt: new Date().toISOString(),
    domainScores,
    domainLabels,
    weightedCoverage,
    domainConfidence,
    driverScores,
    driverCoverage,
    driverConfidence,
    SI,
    sustainabilityIndex: SI,
    P: domainScores.physical,
    B: domainScores.behavioral,
    N: domainScores.normative,
    physicalType: domainLabels.physical,
    behavioralType: domainLabels.behavioral,
    normativeType: domainLabels.normative,
    scenario,
    uncertainty,
    publicationLevel: publication,
    certificationStatus: publication,
    status,
    missingIndicators,
    invalidMeasurements,
    aggregates,
    driverAggregates,
    audit: {
      runId,
      registryVersion,
      generatedAt: new Date().toISOString(),
      registrySourcePath: registry.sourcePath,
      indicators: auditRows,
      evidence,
      warnings: [...warningSet],
      inputs: { measurementCount: measurements.length, evidenceCount: evidence.length, boundaryConfidence: options.boundaryConfidence ?? null, expertApproved: Boolean(options.expertApproved) },
      reproducibility: { formulaVersions, codeVersion: options.codeVersion ?? 'working-tree', immutableInputIds },
    },
  };
}

export const aggregate = aggregateTypology;
export const computeTypology = aggregateTypology;
export const scoreMeasurements = aggregateTypology;

export function scenarioForScores(P: number, B: number, N: number, driverScores: Record<string, number | null> = {}): ImbalanceResult {
  const result = imbalanceFor({ physical: P, behavioral: B, normative: N }, driverScores);
  if (!result) throw new Error('All three domain scores are required');
  return result;
}
