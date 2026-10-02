import crypto from 'node:crypto';
import path from 'node:path';
import type {
  DecisionEvidenceAssessment,
  DecisionEvidenceAssessmentRequest,
  DecisionEvidenceObservation,
  DecisionIndicatorCoverage,
  DecisionMissingIndicator,
  DecisionPublicationLevel,
} from '../src/algorithm/decisionSupportEvidence';
import { CAPITAL_FA, CHAIN_STAGES, type CapitalKey } from '../src/algorithm/types';
import { ALGORITHM_INDICATORS } from '../src/algorithm/algorithmIndicators';
import type { SatelliteEvidenceBundle } from '../src/algorithm/types';
import { DecisionSupportService } from './decisionSupportService';
import { loadDecisionSupportRegistry164, type DecisionIndicator164, type DecisionSupportRegistry164 } from './decisionSupportRegistry164';

const VERIFIED_LEVELS = new Set<DecisionPublicationLevel>(['VERIFIED_OPEN_EO', 'VERIFIED_CONTRACT', 'VALIDATED']);
const MIN_CORE_COVERAGE = 0.8;
const MIN_CAPITAL_COVERAGE = 0.6;
const MIN_QUALITY_SCORE = 0.7;

function finiteNumber(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

function clamp01(value: unknown, fallback = 0): number {
  const numeric = finiteNumber(value);
  return numeric === null ? fallback : Math.max(0, Math.min(1, numeric));
}

function stableObservationId(observation: DecisionEvidenceObservation, index: number): string {
  if (typeof observation.id === 'string' && observation.id.trim()) return observation.id.trim().slice(0, 240);
  return `evidence:${crypto.createHash('sha256').update(JSON.stringify(observation)).update(String(index)).digest('hex').slice(0, 24)}`;
}

function normalizeObservation(
  observation: DecisionEvidenceObservation,
  index: number,
  registry: DecisionSupportRegistry164,
  boundaryVersion?: string,
): DecisionEvidenceObservation {
  const knownCodes = new Set(registry.rows.map((row) => row.code));
  const indicatorCode = observation.indicatorCode == null ? null : String(observation.indicatorCode).trim().toUpperCase();
  if (indicatorCode && !knownCodes.has(indicatorCode)) throw new Error(`Unknown decision-support indicator code: ${indicatorCode}`);
  const related = [...new Set((Array.isArray(observation.relatedIndicatorCodes) ? observation.relatedIndicatorCodes : [])
    .map((code) => String(code).trim().toUpperCase())
    .filter(Boolean))];
  const unknownRelated = related.find((code) => !knownCodes.has(code));
  if (unknownRelated) throw new Error(`Unknown related decision-support indicator code: ${unknownRelated}`);
  const rawValue = observation.rawValue == null || typeof observation.rawValue === 'string'
    ? observation.rawValue ?? null
    : finiteNumber(observation.rawValue);
  const normalizedScore = finiteNumber(observation.normalizedScore);
  const qualityScore = clamp01(observation.quality?.score);
  const geography = String(observation.source?.geographyLevel ?? 'unknown');
  const effectiveBoundaryVersion = observation.boundaryVersion || boundaryVersion;
  const scoreEligible = Boolean(
    indicatorCode
    && /^M-CORE-/.test(indicatorCode)
    && observation.status === 'validated'
    && VERIFIED_LEVELS.has(observation.publicationLevel)
    && normalizedScore !== null
    && normalizedScore >= 0
    && normalizedScore <= 100
    && qualityScore >= MIN_QUALITY_SCORE
    && effectiveBoundaryVersion
    && ['block', 'neighborhood'].includes(geography)
    && observation.source?.tier !== 'proxy'
    && observation.method?.registryVersion === registry.version
  );
  return {
    ...observation,
    id: stableObservationId(observation, index),
    indicatorCode,
    relatedIndicatorCodes: indicatorCode ? [...new Set([indicatorCode, ...related])] : related,
    rawValue,
    normalizedScore,
    boundaryVersion: effectiveBoundaryVersion,
    source: {
      ...observation.source,
      id: String(observation.source?.id ?? 'unknown').slice(0, 200),
      name: String(observation.source?.name ?? 'Unknown source').slice(0, 300),
      retrievedAt: observation.source?.retrievedAt || new Date().toISOString(),
      tier: observation.source?.tier ?? 'unknown',
      geographyLevel: geography,
    },
    method: {
      name: String(observation.method?.name ?? 'not documented').slice(0, 300),
      formulaVersion: String(observation.method?.formulaVersion ?? 'not_applied').slice(0, 300),
      registryVersion: observation.method?.registryVersion,
    },
    quality: {
      ...observation.quality,
      score: qualityScore,
      spatialCoverage: observation.quality?.spatialCoverage === undefined ? undefined : clamp01(observation.quality.spatialCoverage),
      temporalCoverage: observation.quality?.temporalCoverage === undefined ? undefined : clamp01(observation.quality.temporalCoverage),
      sourceReliability: observation.quality?.sourceReliability === undefined ? undefined : clamp01(observation.quality.sourceReliability),
      methodValidity: observation.quality?.methodValidity === undefined ? undefined : clamp01(observation.quality.methodValidity),
      validationScore: observation.quality?.validationScore === undefined ? undefined : clamp01(observation.quality.validationScore),
      flags: [...new Set([...(observation.quality?.flags ?? []), ...(scoreEligible ? [] : ['NOT_SCORE_ELIGIBLE'])])],
    },
    scoreEligible,
  };
}

function coverage(total: number, related: Set<string>, measured: Set<string>, eligible: Set<string>, codes: string[]): DecisionIndicatorCoverage {
  const codeSet = new Set(codes);
  const count = (values: Set<string>) => [...values].filter((code) => codeSet.has(code)).length;
  const evidenceRelated = count(related);
  const measuredCount = count(measured);
  const scoreEligible = count(eligible);
  return {
    total,
    evidenceRelated,
    measured: measuredCount,
    scoreEligible,
    evidenceCoverage: total ? evidenceRelated / total : 0,
    scoreCoverage: total ? scoreEligible / total : 0,
  };
}

function missingReason(row: DecisionIndicator164): { reason: string; nextAction: string } {
  if (row.allowedOutput === 'SURVEY_ONLY') return { reason: 'survey_required', nextAction: 'اجرای پیمایش استاندارد با نمونه‌گیری، وزن‌دهی و کنترل پایایی/روایی' };
  if (row.allowedOutput === 'FIELD_AUDIT_ONLY') return { reason: 'field_audit_required', nextAction: 'اجرای ممیزی میدانی نسخه‌دار و ثبت شواهد مشاهده‌ای' };
  if (row.allowedOutput === 'VERIFIED_AFTER_CONTRACT') return { reason: 'organizational_data_required', nextAction: 'انعقاد قرارداد داده، دریافت صورت و مخرج و تأیید کیفیت سازمان مالک' };
  if (row.allowedOutput === 'VERIFIED_OPEN_EO') return { reason: 'eo_validation_required', nextAction: 'پردازش EO روی polygon و اعتبارسنجی مستقل طبقات/آستانه‌ها' };
  if (row.allowedOutput === 'HUMAN_DECISION_REQUIRED') return { reason: 'human_decision_required', nextAction: 'ثبت تصمیم و دلیل توسط مرجع مجاز پس از مرور شواهد' };
  if (row.automationClass === 'C_DERIVED_DETERMINISTIC') return { reason: 'upstream_measurements_missing', nextAction: 'تکمیل measurementهای بالادست و اجرای فرمول نسخه‌دار' };
  return { reason: 'validated_measurement_missing', nextAction: row.implementationMethod || 'تأمین داده معتبر مطابق رجیستر' };
}

function satelliteObservations(bundle: SatelliteEvidenceBundle, registryVersion: string, boundaryVersion?: string): DecisionEvidenceObservation[] {
  const mapping: Array<{ pattern: RegExp; related: string[]; note: string }> = [
    { pattern: /^ndvi_mean$/, related: ['M-CORE-N2'], note: 'NDVI شاهد سبزینگی است و به تنهایی درصد پوشش سبز نیست.' },
    { pattern: /^(ndwi|mndwi)_mean$/, related: ['M-CORE-N5'], note: 'شاخص آب شاهد کمکی است و بدون کالیبراسیون/مرجع آب وارد امتیاز نمی‌شود.' },
    { pattern: /^ndbi_mean$/, related: ['M-CORE-P1'], note: 'NDBI شاهد سطح ساخته است و پایداری سازه را اندازه‌گیری نمی‌کند.' },
  ];
  return bundle.latestByFeature.map((feature) => {
    const rule = mapping.find((candidate) => candidate.pattern.test(feature.feature));
    return {
      id: `satellite:${feature.featureId}`,
      evidenceCode: `EO-${feature.feature.toUpperCase()}`,
      label: feature.feature,
      indicatorCode: null,
      relatedIndicatorCodes: rule?.related ?? [],
      rawValue: feature.value,
      unit: feature.unit,
      observedAt: feature.acquiredAt,
      boundaryVersion,
      source: {
        id: feature.sourceJobId ?? feature.sourceItem,
        name: feature.provider,
        url: `stac://${feature.provider}/${feature.sourceItem}`,
        datasetId: feature.sourceItem,
        retrievedAt: bundle.collectedAt,
        dataVintage: feature.acquiredAt,
        tier: 'open_verified',
        geographyLevel: 'neighborhood',
      },
      method: { name: feature.method, formulaVersion: 'eo-index-observation-v1', registryVersion },
      quality: {
        score: Math.max(0, Math.min(1, feature.confidence * (1 - feature.maskFraction) * (feature.stale ? 0.6 : 1))),
        spatialCoverage: 1 - feature.maskFraction,
        temporalCoverage: feature.stale ? 0.5 : 1,
        sourceReliability: 0.9,
        methodValidity: 0.8,
        validationScore: feature.confidence,
        flags: ['SATELLITE_EVIDENCE_ONLY', ...(feature.stale ? ['STALE_ACQUISITION'] : []), ...(rule ? [rule.note] : [])],
      },
      uncertainty: { cloudCover: feature.cloudCover, maskFraction: feature.maskFraction, resolutionM: feature.resolutionM },
      status: 'evidence_only',
      publicationLevel: 'EVIDENCE_ONLY',
      scoreEligible: false,
      nextAction: rule?.note ?? 'تعیین نگاشت علمی به یک شاخص رجیستر و اعتبارسنجی مستقل',
    };
  });
}

export class DecisionSupportEvidenceService {
  private readonly registry: DecisionSupportRegistry164;
  private readonly decisionService = new DecisionSupportService();

  constructor(options: { registry?: DecisionSupportRegistry164 } = {}) {
    this.registry = options.registry ?? loadDecisionSupportRegistry164();
  }

  registryMetadata(): Record<string, unknown> {
    return {
      version: this.registry.version,
      indicator_count: this.registry.rows.length,
      core_indicator_count: this.registry.rows.filter((row) => row.isCore).length,
      source_file: path.basename(this.registry.sourcePath),
      plan_file: this.registry.planPath ? path.basename(this.registry.planPath) : null,
    };
  }

  assess(request: DecisionEvidenceAssessmentRequest, satelliteBundle?: SatelliteEvidenceBundle): DecisionEvidenceAssessment {
    const neighborhoodName = String(request.neighborhoodName ?? '').trim();
    if (!neighborhoodName) throw new Error('neighborhoodName is required');
    if (!Array.isArray(request.observations)) throw new Error('observations must be an array');
    const boundaryVersion = request.boundary?.version;
    const normalized = request.observations.map((observation, index) => normalizeObservation(observation, index, this.registry, boundaryVersion));
    const satellite = satelliteBundle ? satelliteObservations(satelliteBundle, this.registry.version, boundaryVersion) : [];
    const evidenceLedger = [...normalized, ...satellite];
    const related = new Set(evidenceLedger.flatMap((observation) => observation.relatedIndicatorCodes));
    const measured = new Set(evidenceLedger.filter((observation) => ['measured', 'validated'].includes(observation.status) && observation.indicatorCode).map((observation) => observation.indicatorCode!));
    const eligible = new Set(evidenceLedger.filter((observation) => observation.scoreEligible && observation.indicatorCode).map((observation) => observation.indicatorCode!));
    const allCodes = this.registry.rows.map((row) => row.code);
    const coreRows = this.registry.rows.filter((row) => row.isCore);
    const coreCodes = coreRows.map((row) => row.code);
    const coreCoverage = coverage(coreRows.length, related, measured, eligible, coreCodes);
    const allCoverage = coverage(this.registry.rows.length, related, measured, eligible, allCodes);
    const byCapital = (Object.keys(CAPITAL_FA) as CapitalKey[]).map((capital) => ({
      capital,
      label: CAPITAL_FA[capital],
      ...coverage(5, related, measured, eligible, coreRows.filter((row) => row.capitalKey === capital).map((row) => row.code)),
    }));
    const eligibleObservations = evidenceLedger.filter((observation) => observation.scoreEligible && observation.indicatorCode && observation.normalizedScore !== null && observation.normalizedScore !== undefined);
    const eligibleLegacy = new Map<string, DecisionEvidenceObservation>();
    for (const observation of eligibleObservations) {
      const row = coreRows.find((candidate) => candidate.code === observation.indicatorCode);
      if (!row?.legacyCode) continue;
      const current = eligibleLegacy.get(row.legacyCode);
      if (!current || observation.quality.score > current.quality.score || (observation.quality.score === current.quality.score && String(observation.observedAt ?? '') > String(current.observedAt ?? ''))) eligibleLegacy.set(row.legacyCode, observation);
    }
    const suppliedStages = new Set(ALGORITHM_INDICATORS.filter((indicator) => eligibleLegacy.has(indicator.code)).map((indicator) => indicator.chainStage));
    const gateFailures: string[] = [];
    if (coreCoverage.scoreCoverage < MIN_CORE_COVERAGE) gateFailures.push(`core_score_coverage_below_${MIN_CORE_COVERAGE}`);
    for (const capital of byCapital) if (capital.scoreCoverage < MIN_CAPITAL_COVERAGE) gateFailures.push(`capital_${capital.capital}_coverage_below_${MIN_CAPITAL_COVERAGE}`);
    for (const stage of CHAIN_STAGES) if (!suppliedStages.has(stage)) gateFailures.push(`chain_stage_${stage.toLowerCase()}_missing`);
    if (!request.boundary?.geometry && !request.boundary?.bbox) gateFailures.push('confirmed_boundary_missing');
    const publishable = gateFailures.length === 0;
    let card = null;
    if (publishable) {
      const indicatorValues = Object.fromEntries([...eligibleLegacy].map(([legacyCode, observation]) => [legacyCode, observation.normalizedScore!])) as Record<string, number>;
      card = this.decisionService.analyze({
        neighborhoodName,
        cityOrCounty: request.cityOrCounty ?? '',
        province: request.province ?? '',
        purpose: request.purpose ?? 'baseline',
        indicatorValues,
        groupValues: request.groupValues,
        aoi: request.boundary?.bbox ? { bbox: request.boundary.bbox, geometry: request.boundary.geometry } : undefined,
        satelliteEvidence: satelliteBundle,
      });
    }
    const missingIndicators: DecisionMissingIndicator[] = this.registry.rows
      .filter((row) => !eligible.has(row.code))
      .map((row) => ({ code: row.code, name: row.name, engine: row.engine, family: row.family, phase: row.phase, allowedOutput: row.allowedOutput, ...missingReason(row) }));
    const warnings = [
      ...(!publishable ? ['امتیاز Q/T/R تا عبور از دروازه پوشش و کیفیت منتشر نمی‌شود.'] : []),
      ...(evidenceLedger.some((observation) => observation.source.geographyLevel === 'national') ? ['داده‌های ملی فقط benchmark هستند و در امتیاز محله وارد نشده‌اند.'] : []),
      ...(satellite.length ? ['NDVI/NDWI/NDBI به عنوان شاهد ثبت شده‌اند؛ تبدیل به درصد پوشش/آب/ساخت‌وساز نیازمند کالیبراسیون مستقل است.'] : []),
    ];
    return {
      analysisId: crypto.randomUUID(),
      neighborhoodName,
      assessedAt: new Date().toISOString(),
      status: card ? 'COMPLETED' : evidenceLedger.length ? 'EVIDENCE_ONLY' : 'INSUFFICIENT_COVERAGE',
      publicationLevel: card ? 'VALIDATED' : 'EVIDENCE_ONLY',
      registry: {
        version: this.registry.version,
        indicatorCount: this.registry.rows.length,
        coreIndicatorCount: coreRows.length,
        sourceFile: path.basename(this.registry.sourcePath),
      },
      coverage: { registryTotal: this.registry.rows.length, core: coreCoverage, all: allCoverage, byCapital, publishable, gateFailures },
      evidenceLedger,
      missingIndicators,
      warnings,
      card,
      honestyBoundary: {
        aiNumericGenerationAllowed: false,
        missingValuesAreZero: false,
        nationalProxyScoresNeighborhood: false,
        satelliteIndexEqualsLandCoverShare: false,
      },
    };
  }
}
