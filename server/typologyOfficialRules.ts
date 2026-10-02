/**
 * Operational rules for the four Iranian urban-regeneration categories in the
 * 1400 revision of the national identification guideline.
 *
 * The legal category is intentionally multi-label.  A neighborhood can be
 * historic and physically inefficient, or informal and hazard-exposed at the
 * same time.  This engine reports the evidence and confidence needed for a
 * planning decision; it does not silently turn a proxy into an approved legal
 * boundary.
 */

import { normalizeAnalyticalValue, type AnalyticalQuality } from './typologyAnalytical.js';

export type OfficialCriterion = 'hazard' | 'physical_quality' | 'quality_of_life' | 'informality' | 'historic_significance';
export type OfficialTypeCode = 'HAZARD_INEFFICIENT' | 'PHYSICAL_INEFFICIENT' | 'INFORMAL_SETTLEMENT' | 'HISTORIC_FABRIC';
export type OfficialClassificationStatus = 'authoritative' | 'provisional' | 'insufficient';

export interface OfficialIndicatorObservation {
  code: string;
  value?: number | null;
  normalized?: number | null;
  score1to5?: number | null;
  /** If supplied, this is the already interpreted 0..1 severity (higher=worse). */
  severity?: number | null;
  direction?: string;
  lower?: number;
  upper?: number;
  target?: number;
  tolerance?: number;
  quality?: AnalyticalQuality | number | null;
  coverage?: number;
  status?: string;
  source?: string;
  authoritative?: boolean;
  referenceDate?: string;
}

export interface OfficialIndicatorBinding {
  code: string;
  criterion: OfficialCriterion;
  /** How the supplied value maps to a bad-condition severity. */
  polarity: 'higher_worse' | 'lower_worse' | 'already_severity';
  weight?: number;
  /** A binding may be used only as a signal (e.g. tenure evidence). */
  signalOnly?: boolean;
  label?: string;
}

export interface OfficialCriterionResult {
  criterion: OfficialCriterion;
  severity: number | null;
  coverage: number;
  confidence: number;
  validIndicatorCount: number;
  totalIndicatorCount: number;
  evidenceCodes: string[];
  missingCodes: string[];
  active: boolean;
  requiresReview: boolean;
}

export interface OfficialTypeDecision {
  code: OfficialTypeCode;
  label: string;
  labelFa: string;
  /** Continuous membership in [0,1], useful for ranking overlapping labels. */
  membership: number;
  eligible: boolean;
  confidence: number;
  evidenceCodes: string[];
  basis: 'criterion_threshold' | 'authoritative_designation' | 'operational_proxy';
  requiresExpertConfirmation: boolean;
  intervention: string;
}

export interface OfficialTypologyContext {
  /** A designation from an approved hazard, heritage or regeneration layer. */
  hazardDesignation?: boolean;
  historicDesignation?: boolean;
  informalDesignation?: boolean;
  physicalInefficiencyDesignation?: boolean;
  /** Designation provenance is required for an authoritative result. */
  designationSources?: Partial<Record<'hazard' | 'historic' | 'informal' | 'physical', string[]>>;
}

export interface OfficialRuleOptions {
  version?: string;
  criterionThreshold?: number;
  minimumCriterionCoverage?: number;
  minimumConfidence?: number;
  minimumInformalitySignals?: number;
  /** Historic fabric is a legal/heritage designation, not a score-only claim. */
  allowIndicatorOnlyHistoric?: boolean;
  bindings?: OfficialIndicatorBinding[];
}

export interface OfficialTypologyResult {
  version: string;
  criteria: Record<OfficialCriterion, OfficialCriterionResult>;
  labels: OfficialTypeDecision[];
  primaryLabel: OfficialTypeDecision | null;
  status: OfficialClassificationStatus;
  warnings: string[];
  /** Explicitly retained so callers can audit the three national criteria. */
  sharedCriteria: {
    hazard: OfficialCriterionResult;
    physicalQuality: OfficialCriterionResult;
    qualityOfLife: OfficialCriterionResult;
  };
}

const OFFICIAL_LABELS: Record<OfficialTypeCode, { label: string; labelFa: string; intervention: string }> = {
  HAZARD_INEFFICIENT: {
    label: 'inefficient due to natural or human-made hazards',
    labelFa: '\u0646\u0627\u06a9\u0627\u0631\u0622\u0645\u062f \u0628\u0647 \u0644\u062d\u0627\u0638 \u0645\u062e\u0627\u0637\u0631 \u0637\u0628\u06cc\u0639\u06cc \u0648 \u0627\u0646\u0633\u0627\u0646\u200c\u0633\u0627\u062e\u062a',
    intervention: 'risk reduction, protection or managed relocation',
  },
  PHYSICAL_INEFFICIENT: {
    label: 'physically inefficient or deteriorated fabric',
    labelFa: '\u0646\u0627\u06a9\u0627\u0631\u0622\u0645\u062f \u06a9\u0627\u0644\u0628\u062f\u06cc \u06cc\u0627 \u0641\u0631\u0633\u0648\u062f\u0647',
    intervention: 'renewal, rehabilitation and structural retrofitting',
  },
  INFORMAL_SETTLEMENT: {
    label: 'informal settlement',
    labelFa: '\u0633\u06a9\u0648\u0646\u062a\u06af\u0627\u0647 \u063a\u06cc\u0631\u0631\u0633\u0645\u06cc',
    intervention: 'social/economic empowerment, functional upgrading and tenure-sensitive renewal',
  },
  HISTORIC_FABRIC: {
    label: 'historic fabric',
    labelFa: '\u0628\u0627\u0641\u062a \u062a\u0627\u0631\u06cc\u062e\u06cc',
    intervention: 'conservation, rehabilitation and adaptive reuse',
  },
};

/**
 * Codes are conservative, transparent proxies connected to the current
 * 419-indicator registry.  Municipal/heritage authorities can extend this
 * list through OfficialRuleOptions.bindings without changing the algorithm.
 */
export const DEFAULT_OFFICIAL_BINDINGS: readonly OfficialIndicatorBinding[] = Object.freeze([
  // Hazard exposure and environmental/technological hazards.
  { code: 'PHY-061', criterion: 'hazard', polarity: 'lower_worse', weight: 1 },
  ...['PHY-063', 'PHY-066', 'PHY-067', 'PHY-116', 'PHY-123', 'PHY-124', 'PHY-125', 'PHY-140', 'PHY-172', 'PHY-173', 'BEH-125', 'BEH-130', 'BEH-190', 'BEH-191', 'BEH-192', 'BEH-193'].map((code) => ({ code, criterion: 'hazard' as const, polarity: 'higher_worse' as const, weight: 1 })),
  // Structural/network/environmental inefficiency.
  ...['PHY-014', 'PHY-020', 'PHY-038', 'PHY-042', 'PHY-043', 'PHY-045', 'PHY-066', 'PHY-067', 'BEH-136'].map((code) => ({ code, criterion: 'physical_quality' as const, polarity: 'higher_worse' as const, weight: 1 })),
  ...['PHY-047', 'PHY-068', 'PHY-115', 'PHY-135', 'PHY-170'].map((code) => ({ code, criterion: 'physical_quality' as const, polarity: 'lower_worse' as const, weight: 1 })),
  // Quality-of-life deficits.  These are interpreted as bad-condition
  // severity, so benefit indicators use lower_worse polarity.
  ...['BEH-015', 'BEH-031', 'BEH-065', 'BEH-119', 'BEH-125', 'BEH-129', 'BEH-130', 'BEH-136', 'BEH-144', 'BEH-153', 'BEH-159', 'BEH-187', 'BEH-189', 'BEH-190', 'BEH-191', 'BEH-208'].map((code) => ({ code, criterion: 'quality_of_life' as const, polarity: 'higher_worse' as const, weight: 1 })),
  ...['BEH-113', 'BEH-117', 'BEH-120', 'BEH-122', 'BEH-123', 'BEH-124', 'BEH-126', 'BEH-127', 'BEH-128', 'BEH-131', 'BEH-133'].map((code) => ({ code, criterion: 'quality_of_life' as const, polarity: 'lower_worse' as const, weight: 1 })),
  // Operational informality signals.  They never establish legal status by
  // themselves; the output is explicitly marked as an operational proxy.
  ...['BEH-044', 'BEH-065', 'BEH-071', 'BEH-115', 'BEH-136', 'BEH-144', 'BEH-153', 'BEH-208'].map((code) => ({ code, criterion: 'informality' as const, polarity: 'higher_worse' as const, weight: 1, signalOnly: true })),
  // No score-only historic code is asserted by default.  A heritage layer or
  // city-specific binding must be supplied to avoid mislabeling old fabric.
]);

const COMPUTABLE = new Set(['measured', 'validated', 'computed', 'approved', '']);
const EPSILON = 1e-12;

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(result) ? result : null;
}

function qualityCoverage(observation: OfficialIndicatorObservation): { quality: number; coverage: number; flags: string[] } {
  const flags = [...(typeof observation.quality === 'object' && observation.quality ? observation.quality.flags ?? [] : [])];
  const explicitQuality = typeof observation.quality === 'number' ? observation.quality : typeof observation.quality === 'object' && observation.quality ? finite(observation.quality.score) : null;
  const spatial = typeof observation.quality === 'object' && observation.quality ? finite(observation.quality.spatialCoverage) : null;
  const temporal = typeof observation.quality === 'object' && observation.quality ? finite(observation.quality.temporalCoverage) : null;
  const quality = clamp(explicitQuality ?? 0.5);
  const coverage = clamp(Math.min(spatial ?? 1, temporal ?? 1, finite(observation.coverage) ?? 1));
  if (explicitQuality === null) flags.push('QUALITY_UNSPECIFIED');
  return { quality, coverage, flags };
}

function severityFor(observation: OfficialIndicatorObservation, binding: OfficialIndicatorBinding): { severity: number | null; flags: string[] } {
  const flags: string[] = [];
  const suppliedSeverity = finite(observation.severity);
  if (suppliedSeverity !== null) return { severity: clamp(suppliedSeverity), flags };
  const score = finite(observation.score1to5);
  // score1to5 is defined across the typology engine as desirability (5=best),
  // independent of the raw indicator direction.
  if (score !== null && score >= 1 && score <= 5) return { severity: 1 - (score - 1) / 4, flags };
  let normalized = finite(observation.normalized);
  if (normalized !== null) {
    // `normalized` follows the analytical layer convention: 1 means best.
    // Official criteria use bad-condition severity, so invert it once here.
    return { severity: 1 - clamp(normalized), flags };
  }
  if (finite(observation.value) !== null) {
    if (binding.polarity === 'already_severity') return { severity: clamp(observation.value!), flags };
    const rawDirection = binding.polarity === 'higher_worse' ? 'cost' : 'benefit';
    const result = normalizeAnalyticalValue(observation.value!, {
      code: observation.code,
      domain: 'physical',
      direction: observation.direction ?? rawDirection,
      lower: observation.lower,
      upper: observation.upper,
      target: observation.target,
      tolerance: observation.tolerance,
    });
    if (result) {
      // normalizeAnalyticalValue also returns desirability, so invert it here
      // rather than applying the raw-value polarity twice.
      flags.push(...result.flags);
      return { severity: 1 - result.normalized, flags };
    }
  }
  return { severity: null, flags: ['MISSING_OR_UNNORMALIZABLE'] };
}

function criterionResult(
  criterion: OfficialCriterion,
  bindings: OfficialIndicatorBinding[],
  observationMap: Map<string, OfficialIndicatorObservation>,
  options: Required<Pick<OfficialRuleOptions, 'criterionThreshold' | 'minimumCriterionCoverage' | 'minimumConfidence'>>,
): OfficialCriterionResult {
  const rows = bindings.filter((binding) => binding.criterion === criterion);
  const totalWeight = rows.reduce((sum, row) => sum + Math.max(EPSILON, row.weight ?? 1), 0);
  let usedWeight = 0;
  let weightedSeverity = 0;
  let weightedConfidence = 0;
  const evidenceCodes: string[] = [];
  const missingCodes: string[] = [];
  for (const binding of rows) {
    const observation = observationMap.get(binding.code);
    const weight = Math.max(EPSILON, binding.weight ?? 1);
    if (!observation) {
      missingCodes.push(binding.code);
      continue;
    }
    const status = String(observation.status ?? '').trim().toLowerCase();
    if (!COMPUTABLE.has(status) || status === 'failed_qa' || status === 'missing' || status === 'suppressed') {
      missingCodes.push(binding.code);
      continue;
    }
    const quality = qualityCoverage(observation);
    const severity = severityFor(observation, binding);
    if (severity.severity === null || quality.quality <= 0 || quality.coverage <= 0) {
      missingCodes.push(binding.code);
      continue;
    }
    const confidence = quality.quality * quality.coverage;
    const effectiveWeight = weight * confidence;
    usedWeight += effectiveWeight;
    weightedSeverity += severity.severity * effectiveWeight;
    weightedConfidence += confidence * weight;
    evidenceCodes.push(binding.code);
  }
  const coverage = totalWeight > 0 ? clamp(usedWeight / totalWeight) : 0;
  const confidence = totalWeight > 0 ? clamp(weightedConfidence / totalWeight) : 0;
  const severity = usedWeight > 0 ? clamp(weightedSeverity / usedWeight) : null;
  const active = severity !== null && severity >= options.criterionThreshold && coverage >= options.minimumCriterionCoverage;
  return {
    criterion,
    severity,
    coverage,
    confidence,
    validIndicatorCount: evidenceCodes.length,
    totalIndicatorCount: rows.length,
    evidenceCodes,
    missingCodes,
    active,
    requiresReview: !active || confidence < options.minimumConfidence,
  };
}

function designationDecision(
  code: OfficialTypeCode,
  context: OfficialTypologyContext,
  sourceKey: 'hazard' | 'historic' | 'informal' | 'physical',
): { designated: boolean; authoritative: boolean; evidenceCodes: string[] } {
  const designated = sourceKey === 'hazard' ? context.hazardDesignation : sourceKey === 'historic' ? context.historicDesignation : sourceKey === 'informal' ? context.informalDesignation : context.physicalInefficiencyDesignation;
  const sources = context.designationSources?.[sourceKey] ?? [];
  return { designated: Boolean(designated), authoritative: Boolean(designated && sources.length), evidenceCodes: sources.slice() };
}

function decision(
  code: OfficialTypeCode,
  criterion: OfficialCriterionResult,
  designation: { designated: boolean; authoritative: boolean; evidenceCodes: string[] },
  options: Required<Pick<OfficialRuleOptions, 'minimumConfidence' | 'allowIndicatorOnlyHistoric'>>,
  historic = false,
): OfficialTypeDecision {
  const info = OFFICIAL_LABELS[code];
  const designated = designation.designated;
  const authoritative = designation.authoritative;
  const criterionMembership = criterion.severity ?? 0;
  const eligible = historic
    ? authoritative || (options.allowIndicatorOnlyHistoric && criterion.active)
    : designated || criterion.active;
  const basis: OfficialTypeDecision['basis'] = authoritative
    ? 'authoritative_designation'
    : designated
      ? 'operational_proxy'
      : 'criterion_threshold';
  const membership = authoritative ? 1 : clamp(Math.max(criterionMembership, designated ? 0.75 : 0));
  return {
    code,
    label: info.label,
    labelFa: info.labelFa,
    membership,
    eligible,
    confidence: authoritative ? 1 : criterion.confidence,
    evidenceCodes: [...new Set([...criterion.evidenceCodes, ...designation.evidenceCodes])],
    basis,
    requiresExpertConfirmation: !authoritative,
    intervention: info.intervention,
  };
}

export function evaluateOfficialTypology(
  observations: OfficialIndicatorObservation[],
  context: OfficialTypologyContext = {},
  options: OfficialRuleOptions = {},
): OfficialTypologyResult {
  const effectiveOptions = {
    version: options.version ?? 'iran-official-1400.v1',
    criterionThreshold: options.criterionThreshold ?? 0.5,
    minimumCriterionCoverage: options.minimumCriterionCoverage ?? 0.5,
    minimumConfidence: options.minimumConfidence ?? 0.6,
    minimumInformalitySignals: options.minimumInformalitySignals ?? 2,
    allowIndicatorOnlyHistoric: options.allowIndicatorOnlyHistoric ?? false,
  };
  const bindings = options.bindings?.length ? options.bindings : [...DEFAULT_OFFICIAL_BINDINGS];
  const observationMap = new Map<string, OfficialIndicatorObservation>();
  const warnings: string[] = [];
  for (const observation of observations) {
    if (observationMap.has(observation.code)) warnings.push(`duplicate_indicator:${observation.code}`);
    observationMap.set(observation.code, observation);
  }
  const criteria = {} as Record<OfficialCriterion, OfficialCriterionResult>;
  for (const criterion of ['hazard', 'physical_quality', 'quality_of_life', 'informality', 'historic_significance'] as const) {
    criteria[criterion] = criterionResult(criterion, bindings, observationMap, effectiveOptions);
  }
  const hazardDesignation = designationDecision('HAZARD_INEFFICIENT', context, 'hazard');
  const physicalDesignation = designationDecision('PHYSICAL_INEFFICIENT', context, 'physical');
  const informalDesignation = designationDecision('INFORMAL_SETTLEMENT', context, 'informal');
  const historicDesignation = designationDecision('HISTORIC_FABRIC', context, 'historic');

  // Informality is a combined operational signal: one deprivation criterion
  // plus at least N independent tenure/livelihood/service signals. It remains
  // provisional until the competent authority confirms the settlement layer.
  const informalSignals = criteria.informality.validIndicatorCount;
  const informalCriterion = criteria.informality;
  const informalActive = informalSignals >= effectiveOptions.minimumInformalitySignals
    && criteria.quality_of_life.active
    && (informalCriterion.severity ?? 0) >= effectiveOptions.criterionThreshold;
  const informalForDecision = { ...informalCriterion, active: informalCriterion.active || informalActive, severity: Math.max(informalCriterion.severity ?? 0, informalActive ? effectiveOptions.criterionThreshold : 0) };

  const labels: OfficialTypeDecision[] = [
    decision('HAZARD_INEFFICIENT', criteria.hazard, hazardDesignation, effectiveOptions),
    decision('PHYSICAL_INEFFICIENT', criteria.physical_quality, physicalDesignation, effectiveOptions),
    decision('INFORMAL_SETTLEMENT', informalForDecision, informalDesignation, effectiveOptions),
    decision('HISTORIC_FABRIC', criteria.historic_significance, historicDesignation, effectiveOptions, true),
  ];
  const eligible = labels.filter((label) => label.eligible);
  const anyEvidence = Object.values(criteria).some((criterion) => criterion.validIndicatorCount > 0) || labels.some((label) => label.evidenceCodes.length > 0);
  const authoritative = eligible.length > 0 && eligible.every((label) => label.basis === 'authoritative_designation');
  const status: OfficialClassificationStatus = authoritative ? 'authoritative' : anyEvidence ? 'provisional' : 'insufficient';
  if (status !== 'authoritative') warnings.push('official_designation_or_expert_confirmation_required');
  if (criteria.historic_significance.validIndicatorCount === 0 && (context.historicDesignation ?? false) === false) warnings.push('historic_layer_not_supplied');
  if (informalActive && !informalDesignation.authoritative) warnings.push('informal_settlement_is_operational_proxy');
  const primaryLabel = eligible.slice().sort((left, right) => right.membership - left.membership || left.code.localeCompare(right.code))[0] ?? null;
  return {
    version: effectiveOptions.version,
    criteria,
    labels: labels.sort((left, right) => right.membership - left.membership || left.code.localeCompare(right.code)),
    primaryLabel,
    status,
    warnings: [...new Set(warnings)],
    sharedCriteria: {
      hazard: criteria.hazard,
      physicalQuality: criteria.physical_quality,
      qualityOfLife: criteria.quality_of_life,
    },
  };
}

export const classifyOfficialTypology = evaluateOfficialTypology;
