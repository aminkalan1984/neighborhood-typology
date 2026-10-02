/**
 * Data-driven, continuous neighborhood profile.
 *
 * This module deliberately does not decide the legal regeneration category of
 * a neighborhood.  It standardizes heterogeneous observations, propagates
 * quality/coverage, aggregates the three analytical domains and emits fuzzy
 * memberships that can be consumed by a separate official rule engine.
 */

export type AnalyticalDomain = 'physical' | 'behavioral' | 'normative';
export type AnalyticalDirection = 'benefit' | 'cost' | 'target';
export type AnalyticalStatus = 'measured' | 'validated' | 'computed' | 'approved' | 'missing' | 'suppressed' | 'failed_qa';

export interface ReferenceDistribution {
  values: number[];
  lowerQuantile?: number;
  upperQuantile?: number;
}

export interface AnalyticalIndicatorSpec {
  code: string;
  domain: AnalyticalDomain;
  driverId?: string;
  /** Base weight inside the domain. It is normalized at aggregation time. */
  weight?: number;
  direction: AnalyticalDirection | string;
  lower?: number;
  upper?: number;
  target?: number;
  tolerance?: number;
  /** Used when fixed bounds are unavailable. */
  reference?: ReferenceDistribution;
  /** Optional display metadata; not used for calculations. */
  label?: string;
}

export interface AnalyticalQuality {
  score?: number;
  spatialCoverage?: number;
  temporalCoverage?: number;
  flags?: string[];
  /** An explicit source reliability factor in [0,1]. */
  sourceReliability?: number;
}

export interface AnalyticalObservation {
  code: string;
  value: number | null;
  /** A value already standardized to [0,1] may be supplied explicitly. */
  normalized?: number | null;
  score1to5?: number | null;
  direction?: AnalyticalDirection | string;
  quality?: AnalyticalQuality | number | null;
  coverage?: number;
  status?: AnalyticalStatus | string;
  uncertaintyLow?: number;
  uncertaintyHigh?: number;
  source?: string;
  referenceDate?: string;
}

export interface NormalizationResult {
  normalized: number;
  score1to5: number;
  direction: AnalyticalDirection;
  lower: number;
  upper: number;
  target?: number;
  flags: string[];
}

export interface FuzzyMembership {
  low: number;
  medium: number;
  high: number;
  dominant: 'low' | 'medium' | 'high';
}

export interface AnalyticalIndicatorResult {
  code: string;
  domain: AnalyticalDomain;
  driverId?: string;
  normalized: number | null;
  score1to5: number | null;
  baseWeight: number;
  effectiveWeight: number;
  quality: number;
  coverage: number;
  confidence: number;
  valid: boolean;
  flags: string[];
  direction?: AnalyticalDirection;
  normalization?: NormalizationResult;
}

export interface AnalyticalDomainResult {
  domain: AnalyticalDomain;
  normalizedScore: number | null;
  score1to5: number | null;
  coverage: number;
  confidence: number;
  validIndicatorCount: number;
  totalIndicatorCount: number;
  fuzzy: FuzzyMembership | null;
  missingCodes: string[];
}

export interface AnalyticalDriverResult {
  driverId: string;
  normalizedScore: number | null;
  score1to5: number | null;
  coverage: number;
  confidence: number;
  fuzzy: FuzzyMembership | null;
  indicatorCodes: string[];
}

export interface AnalyticalLabel {
  code: string;
  label: string;
  membership: number;
  evidence: string[];
}

export interface AnalyticalResult {
  version: string;
  domains: Record<AnalyticalDomain, AnalyticalDomainResult>;
  drivers: Record<string, AnalyticalDriverResult>;
  indicators: AnalyticalIndicatorResult[];
  SI: number | null;
  SI1to5: number | null;
  /** Continuous multi-label profile; labels are not mutually exclusive. */
  multiLabels: AnalyticalLabel[];
  warnings: string[];
  status: 'complete' | 'partial' | 'insufficient';
}

export interface AnalyticalOptions {
  version?: string;
  minimumQuality?: number;
  minimumCoverage?: number;
  minimumDomainCoverage?: number;
  minimumDriverCoverage?: number;
  lowThreshold?: number;
  highThreshold?: number;
  /** If true, a failed-QA observation is excluded even if it has a score. */
  rejectFailedQa?: boolean;
}

const DOMAINS: readonly AnalyticalDomain[] = ['physical', 'behavioral', 'normative'];
const COMPUTABLE: ReadonlySet<string> = new Set(['measured', 'validated', 'computed', 'approved']);
const EPSILON = 1e-12;

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(result) ? result : null;
}

function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function quantile(values: number[], probability: number): number | null {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!sorted.length) return null;
  const p = clamp(probability);
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

/** Normalizes registry/free-text direction names without executing formulas. */
export function parseAnalyticalDirection(input: AnalyticalDirection | string | undefined): AnalyticalDirection {
  const value = String(input ?? '').trim().toLowerCase();
  if (value === 'cost' || value === 'inverse' || value.includes('cost') || value.includes('inverse') || value.includes('\u0645\u0639\u06a9\u0648\u0633')) return 'cost';
  if (value === 'target' || value === 'optimal' || value.includes('target') || value.includes('optimal') || value.includes('\u0622\u0633\u062a\u0627\u0646') || value.includes('\u0628\u0647\u06cc\u0646')) return 'target';
  return 'benefit';
}

function boundsFor(spec: AnalyticalIndicatorSpec): { lower: number; upper: number; flags: string[] } | null {
  const explicitLower = finite(spec.lower);
  const explicitUpper = finite(spec.upper);
  if (explicitLower !== null && explicitUpper !== null && explicitUpper > explicitLower) {
    return { lower: explicitLower, upper: explicitUpper, flags: [] };
  }
  const values = spec.reference?.values?.filter(Number.isFinite) ?? [];
  if (values.length < 2) return null;
  const lower = explicitLower ?? quantile(values, spec.reference?.lowerQuantile ?? 0.05);
  const upper = explicitUpper ?? quantile(values, spec.reference?.upperQuantile ?? 0.95);
  if (lower === null || upper === null || upper <= lower) return null;
  return { lower, upper, flags: ['ROBUST_REFERENCE_BOUNDS'] };
}

/**
 * Robust benefit/cost/target normalization to [0,1]. Values are winsorized
 * at the supplied bounds, so a single extreme observation cannot dominate a
 * city-wide comparison. Target variables use a triangular/plateau function.
 */
export function normalizeAnalyticalValue(
  valueInput: number,
  spec: AnalyticalIndicatorSpec,
): NormalizationResult | null {
  const value = finite(valueInput);
  if (value === null) return null;
  const direction = parseAnalyticalDirection(spec.direction);
  const boundResult = boundsFor(spec);
  if (!boundResult) return null;
  const { lower, upper, flags } = boundResult;
  const range = upper - lower;
  const clipped = Math.min(upper, Math.max(lower, value));
  let normalized: number;
  let target: number | undefined;
  if (direction === 'benefit') {
    normalized = (clipped - lower) / range;
  } else if (direction === 'cost') {
    normalized = (upper - clipped) / range;
  } else {
    target = finite(spec.target) ?? (lower + upper) / 2;
    const tolerance = Math.max(EPSILON, finite(spec.tolerance) ?? range * 0.1);
    const distance = Math.abs(value - target);
    normalized = distance <= tolerance ? 1 : Math.max(0, 1 - (distance - tolerance) / Math.max(EPSILON, Math.max(target - lower, upper - target) - tolerance));
  }
  normalized = clamp(normalized);
  return {
    normalized,
    score1to5: 1 + normalized * 4,
    direction,
    lower,
    upper,
    target,
    flags,
  };
}

function qualityParts(input: AnalyticalQuality | number | null | undefined): { quality: number; coverage: number; flags: string[] } {
  if (typeof input === 'number') return { quality: clamp(input), coverage: 1, flags: [] };
  const quality = input ?? {};
  const explicit = finite(quality.score);
  const source = finite(quality.sourceReliability);
  const qualityScore = clamp(explicit ?? source ?? 0.5);
  const spatial = finite(quality.spatialCoverage);
  const temporal = finite(quality.temporalCoverage);
  const coverage = clamp(Math.min(spatial ?? 1, temporal ?? 1));
  const flags = [...(quality.flags ?? [])];
  if (explicit === null && source === null) flags.push('QUALITY_UNSPECIFIED');
  return { quality: qualityScore, coverage, flags };
}

function normalizeObservation(observation: AnalyticalObservation, spec: AnalyticalIndicatorSpec, options: Required<Pick<AnalyticalOptions, 'minimumQuality' | 'minimumCoverage' | 'rejectFailedQa'>>): AnalyticalIndicatorResult {
  const baseWeight = Math.max(0, finite(spec.weight) ?? 1);
  const qualityPartsResult = qualityParts(observation.quality);
  const coverage = clamp(Math.min(qualityPartsResult.coverage, finite(observation.coverage) ?? 1));
  const quality = qualityPartsResult.quality;
  const flags = [...qualityPartsResult.flags];
  const status = String(observation.status ?? 'measured').trim().toLowerCase();
  const failedQa = status === 'failed_qa' || flags.some((flag) => flag.toUpperCase() === 'FAILED_QA');
  if (failedQa) flags.push('FAILED_QA');
  if (quality < options.minimumQuality) flags.push('QUALITY_BELOW_MINIMUM');
  if (coverage < options.minimumCoverage) flags.push('COVERAGE_BELOW_MINIMUM');

  let normalization: NormalizationResult | null = null;
  let normalized = finite(observation.normalized);
  let score1to5 = finite(observation.score1to5);
  if (normalized === null && score1to5 !== null && score1to5 >= 1 && score1to5 <= 5) normalized = (score1to5 - 1) / 4;
  if (normalized === null && observation.value !== null) normalization = normalizeAnalyticalValue(observation.value, { ...spec, direction: observation.direction ?? spec.direction });
  if (normalized === null && normalization) normalized = normalization.normalized;
  if (score1to5 === null && normalized !== null) score1to5 = 1 + clamp(normalized) * 4;
  if (normalization) flags.push(...normalization.flags);
  if (normalized === null || !Number.isFinite(normalized)) flags.push('MISSING_OR_UNNORMALIZABLE');
  normalized = normalized === null ? null : clamp(normalized);
  const valid = normalized !== null
    && COMPUTABLE.has(status)
    && quality >= options.minimumQuality
    && coverage >= options.minimumCoverage
    && (!options.rejectFailedQa || !failedQa);
  const confidence = quality * coverage;
  return {
    code: spec.code,
    domain: spec.domain,
    driverId: spec.driverId,
    normalized,
    score1to5: score1to5 === null ? null : clamp(score1to5, 1, 5),
    baseWeight,
    effectiveWeight: valid ? baseWeight * confidence : 0,
    quality,
    coverage,
    confidence,
    valid,
    flags: [...new Set(flags)],
    direction: parseAnalyticalDirection(observation.direction ?? spec.direction),
    normalization: normalization ?? undefined,
  };
}

function fuzzyMembership(value: number, lowThreshold: number, highThreshold: number): FuzzyMembership {
  const low = clamp(value <= lowThreshold ? 1 : (highThreshold - value) / Math.max(EPSILON, highThreshold - lowThreshold));
  const high = clamp(value >= highThreshold ? 1 : (value - lowThreshold) / Math.max(EPSILON, highThreshold - lowThreshold));
  const midpoint = (lowThreshold + highThreshold) / 2;
  const half = Math.max(EPSILON, (highThreshold - lowThreshold) / 2);
  const medium = clamp(1 - Math.abs(value - midpoint) / half);
  const memberships = { low, medium, high };
  const dominant = (Object.entries(memberships).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'medium') as FuzzyMembership['dominant'];
  return { low, medium, high, dominant };
}

export function analyticalFuzzyMembership(value: number, options: { lowThreshold?: number; highThreshold?: number } = {}): FuzzyMembership {
  return fuzzyMembership(clamp(value), options.lowThreshold ?? 0.4, options.highThreshold ?? 0.6);
}

function weightedScore(rows: AnalyticalIndicatorResult[]): { score: number | null; coverage: number; confidence: number; validCount: number } {
  const totalWeight = rows.reduce((sum, row) => sum + row.baseWeight, 0);
  const valid = rows.filter((row) => row.valid && row.normalized !== null);
  const usedWeight = valid.reduce((sum, row) => sum + row.baseWeight * row.confidence, 0);
  if (!valid.length || usedWeight <= 0) return { score: null, coverage: 0, confidence: 0, validCount: 0 };
  const score = valid.reduce((sum, row) => sum + row.normalized! * row.baseWeight * row.confidence, 0) / usedWeight;
  const coveredWeight = valid.reduce((sum, row) => sum + row.baseWeight * row.coverage, 0);
  const coverage = totalWeight > 0 ? coveredWeight / totalWeight : 0;
  const confidence = valid.reduce((sum, row) => sum + row.quality * row.baseWeight * row.coverage, 0) / Math.max(EPSILON, coveredWeight);
  return { score: clamp(score), coverage: clamp(coverage), confidence: clamp(confidence), validCount: valid.length };
}

function geometricMean(values: Array<number | null>): number | null {
  if (values.some((value) => value === null)) return null;
  const finiteValues = values as number[];
  if (!finiteValues.length) return null;
  if (finiteValues.some((value) => !Number.isFinite(value) || value < 0)) return null;
  if (finiteValues.some((value) => value === 0)) return 0;
  return Math.exp(finiteValues.reduce((sum, value) => sum + Math.log(Math.max(EPSILON, value)), 0) / finiteValues.length);
}

function labelsForDomains(domains: Record<AnalyticalDomain, AnalyticalDomainResult>): AnalyticalLabel[] {
  const labels: AnalyticalLabel[] = [];
  const add = (code: string, label: string, membership: number, evidence: string[]) => {
    if (membership >= 0.35) labels.push({ code, label, membership: clamp(membership), evidence });
  };
  const p = domains.physical.fuzzy;
  const b = domains.behavioral.fuzzy;
  const n = domains.normative.fuzzy;
  if (p) add('PHYSICAL_DEFICIT', 'physical/infrastructure deficit', p.low, ['physical']);
  if (b) add('BEHAVIORAL_DEFICIT', 'behavioral/social capacity deficit', b.low, ['behavioral']);
  if (n) add('NORMATIVE_DEFICIT', 'normative/institutional capacity deficit', n.low, ['normative']);
  if (p && b && n) {
    add('MULTIDIMENSIONAL_DEFICIT', 'multi-dimensional deficit', Math.min(p.low, b.low, n.low), ['physical', 'behavioral', 'normative']);
    add('BALANCED_HIGH_CAPACITY', 'balanced high-capacity neighborhood', Math.min(p.high, b.high, n.high), ['physical', 'behavioral', 'normative']);
    add('TRANSITIONAL_PROFILE', 'transitional/mixed profile', Math.max(p.medium, b.medium, n.medium), ['physical', 'behavioral', 'normative']);
    add('PHYSICAL_LEAP_CAPACITY', 'latent capacity for physical improvement', Math.min(p.low, b.high, n.high), ['physical', 'behavioral', 'normative']);
  }
  return labels.sort((a, b) => b.membership - a.membership || a.code.localeCompare(b.code));
}

export function scoreAnalyticalProfile(
  specs: AnalyticalIndicatorSpec[],
  observations: AnalyticalObservation[],
  options: AnalyticalOptions = {},
): AnalyticalResult {
  const effectiveOptions = {
    version: options.version ?? 'analytical-v1',
    minimumQuality: options.minimumQuality ?? 0,
    minimumCoverage: options.minimumCoverage ?? 0,
    minimumDomainCoverage: options.minimumDomainCoverage ?? 0.7,
    minimumDriverCoverage: options.minimumDriverCoverage ?? 0.5,
    lowThreshold: options.lowThreshold ?? 0.4,
    highThreshold: options.highThreshold ?? 0.6,
    rejectFailedQa: options.rejectFailedQa ?? true,
  };
  const specByCode = new Map(specs.map((spec) => [spec.code, spec]));
  const observationByCode = new Map<string, AnalyticalObservation>();
  const warnings: string[] = [];
  for (const observation of observations) {
    if (!specByCode.has(observation.code)) {
      warnings.push(`unknown_indicator:${observation.code}`);
      continue;
    }
    if (observationByCode.has(observation.code)) warnings.push(`duplicate_indicator:${observation.code}`);
    observationByCode.set(observation.code, observation);
  }
  const indicators = specs.map((spec) => normalizeObservation(observationByCode.get(spec.code) ?? { code: spec.code, value: null, status: 'missing' }, spec, effectiveOptions));
  const domains = {} as Record<AnalyticalDomain, AnalyticalDomainResult>;
  for (const domain of DOMAINS) {
    const rows = indicators.filter((row) => row.domain === domain);
    const aggregate = weightedScore(rows);
    const missingCodes = rows.filter((row) => !row.valid).map((row) => row.code);
    domains[domain] = {
      domain,
      normalizedScore: aggregate.score,
      score1to5: aggregate.score === null ? null : 1 + aggregate.score * 4,
      coverage: aggregate.coverage,
      confidence: aggregate.confidence,
      validIndicatorCount: aggregate.validCount,
      totalIndicatorCount: rows.length,
      fuzzy: aggregate.score === null ? null : fuzzyMembership(aggregate.score, effectiveOptions.lowThreshold, effectiveOptions.highThreshold),
      missingCodes,
    };
  }
  const driverIds = [...new Set(specs.map((spec) => spec.driverId).filter((value): value is string => Boolean(value)))].sort();
  const drivers: Record<string, AnalyticalDriverResult> = {};
  for (const driverId of driverIds) {
    const rows = indicators.filter((row) => row.driverId === driverId);
    const aggregate = weightedScore(rows);
    drivers[driverId] = {
      driverId,
      normalizedScore: aggregate.score,
      score1to5: aggregate.score === null ? null : 1 + aggregate.score * 4,
      coverage: aggregate.coverage,
      confidence: aggregate.confidence,
      fuzzy: aggregate.score === null ? null : fuzzyMembership(aggregate.score, effectiveOptions.lowThreshold, effectiveOptions.highThreshold),
      indicatorCodes: rows.map((row) => row.code),
    };
  }
  const SI = geometricMean(DOMAINS.map((domain) => domains[domain].normalizedScore));
  const coveragePass = DOMAINS.every((domain) => domains[domain].coverage >= effectiveOptions.minimumDomainCoverage);
  const anyData = indicators.some((row) => row.valid);
  const complete = DOMAINS.every((domain) => domains[domain].normalizedScore !== null) && coveragePass;
  if (!coveragePass) warnings.push('domain_coverage_below_minimum');
  for (const [driverId, result] of Object.entries(drivers)) {
    if (result.coverage < effectiveOptions.minimumDriverCoverage) warnings.push(`driver_coverage_below_minimum:${driverId}`);
  }
  return {
    version: effectiveOptions.version,
    domains,
    drivers,
    indicators,
    SI,
    SI1to5: SI === null ? null : 1 + SI * 4,
    multiLabels: labelsForDomains(domains),
    warnings: [...new Set(warnings)],
    status: complete ? 'complete' : anyData ? 'partial' : 'insufficient',
  };
}

export const aggregateAnalytical = scoreAnalyticalProfile;
