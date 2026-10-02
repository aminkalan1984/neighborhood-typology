export type Domain = 'physical' | 'behavioral' | 'normative';
export type Axis = Domain;
export type Direction = 'direct' | 'inverse' | 'optimal';
export type DriverId = 'P1' | 'P2' | 'P3' | 'B1' | 'B2' | 'B3' | 'B4' | 'N1' | 'N2' | 'N3' | (string & {});

export type RunStatus =
  | 'CREATED'
  | 'WAITING_FOR_LOCATION_RESOLUTION'
  | 'LOCATION_AMBIGUOUS'
  | 'BOUNDARY_CONFIRMED'
  | 'COLLECTING'
  | 'WAITING_FOR_RESTRICTED_DATA'
  | 'COMPUTING'
  | 'QA_REVIEW'
  | 'PROVISIONAL'
  | 'VERIFIED'
  | 'REJECTED';

export type SupplyTaskStatus =
  | 'PLANNED'
  | 'DOWNLOADING_PUBLIC_DATA'
  | 'WAITING_FOR_ORGANIZATIONAL_DATA'
  | 'WAITING_FOR_SURVEY'
  | 'WAITING_FOR_FIELD_AUDIT'
  | 'COMPUTABLE'
  | 'COMPUTED'
  | 'FAILED_QA'
  | 'NOT_AVAILABLE';

export type MeasurementStatus =
  | 'MEASURED'
  | 'VALIDATED'
  | 'COMPUTED'
  | 'APPROVED'
  | 'MISSING'
  | 'WAITING_FOR_ORGANIZATIONAL_DATA'
  | 'WAITING_FOR_SURVEY'
  | 'WAITING_FOR_FIELD_AUDIT'
  | 'NOT_AVAILABLE'
  | 'FAILED_QA';

export type PublicationLevel = 'EXPLORATORY' | 'PROVISIONAL' | 'VERIFIED' | 'REJECTED';

export interface IndicatorRegistry {
  code: string;
  domain: Domain;
  domainFa: string;
  axis: string;
  sourceOrder: number;
  indicator: string;
  coefficient: number;
  coefficientLabel: string;
  direction: Direction;
  directionRaw: string;
  categoryWeightPercent: number;
  domainWeightPercent: number;
  driverId: DriverId;
  mappingConfidence: string;
  template: string;
  calcFamily: string;
  accessMode: string;
  playbookCodes: string[];
  sourceRequirements: string;
  formulaText: string;
  formulaVersion: string;
  registryStatus: string;
}

export interface RegistryIndex {
  rows: IndicatorRegistry[];
  byCode: ReadonlyMap<string, IndicatorRegistry>;
  byDomain: ReadonlyMap<Domain, readonly IndicatorRegistry[]>;
  byDriver: ReadonlyMap<string, readonly IndicatorRegistry[]>;
  version: string;
  sourcePath?: string;
  expectedCount: number;
  counts: { total: number; physical: number; behavioral: number; normative: number };
  weightTotals: Record<Domain, number>;
  driverWeightTotals: Record<string, number>;
  directionCounts: Record<Direction, number>;
}

export interface TypologyConfig {
  version: string;
  scoring: {
    scaleMin: number;
    scaleMax: number;
    lowAnchorUpperExclusive: number;
    highAnchorLowerInclusive: number;
    minimumDomainWeightCoverage: number;
    minimumDriverWeightCoverage: number;
    minimumBootstrapLabelStability: number;
    maximumReferenceYearGap: number;
    allowImputationInCertifiedResult: boolean;
  };
  privacy: {
    minimumPublishableCellCount: number;
    removeDirectIdentifiers: boolean;
    storeSensitiveCoordinates: boolean;
  };
  referenceCohort: {
    required: boolean;
    matchFields: string[];
  };
  aggregation: {
    withinDomain: 'weighted_arithmetic_mean';
    acrossDomains: 'geometric_mean';
    equalDomainWeightForSI: boolean;
  };
  quality: {
    boundaryConfidenceMinimum: number;
    rasterValidPixelShareMinimum: number;
    surveyResponseRateMinimum: number;
    fieldDoubleRatingShare: number;
  };
}

export type TypologyConfigInput = {
  [Key in keyof TypologyConfig]?: TypologyConfig[Key] extends Record<string, unknown>
    ? Partial<TypologyConfig[Key]>
    : TypologyConfig[Key];
};

export interface NeighborhoodRequest {
  neighborhoodName: string;
  cityOrCounty: string;
  province: string;
  settlementType: 'urban' | 'rural';
  referenceYear: number;
  optionalBoundaryGeojson?: unknown | null;
  purpose?: 'baseline' | 'monitoring' | 'intervention_priority' | string;
  [key: string]: unknown;
}

export interface SupplyChannel {
  id: 'public' | 'organizational' | 'survey' | 'field';
  label: string;
  playbookCodes: string[];
  required: boolean;
}

export interface SupplyTask {
  code: string;
  sourceOrder: number;
  domain: Domain;
  driverId: DriverId;
  indicator: string;
  calcFamily: string;
  formulaVersion: string;
  formulaText: string;
  accessMode: string;
  playbookCodes: string[];
  sourceRequirements: string;
  channels: SupplyChannel[];
  status: SupplyTaskStatus;
  nextAction: string;
  missingReasons: string[];
}

export interface SupplyPlan {
  runId: string;
  request: NeighborhoodRequest;
  registryVersion: string;
  status: RunStatus;
  createdAt: string;
  expectedIndicatorCount: number;
  tasks: SupplyTask[];
  counts: Record<string, number>;
  statusCounts: Record<string, number>;
  channels: Record<string, number>;
  acceptance: {
    exactIndicatorCount: boolean;
    uniqueCodes: boolean;
    missingCodes: string[];
    duplicateCodes: string[];
  };
}

export interface EvidenceRecord {
  id: string;
  evidence_id?: string;
  indicatorCode?: string;
  indicator_code?: string;
  sourceUrl?: string;
  sourceOrganization?: string;
  datasetId?: string;
  version?: string;
  retrievedAt?: string;
  license?: string;
  checksum?: string;
  rawObjectUri?: string;
  spatialCoverage?: number;
  temporalCoverage?: number;
  qualityScore?: number;
  accessMode?: string;
  privacyClass?: string;
  reviewStatus?: string;
  source?: {
    organization?: string;
    url?: string;
    dataset_id?: string;
    version?: string;
    retrieved_at?: string;
    checksum?: string;
    license?: string;
  };
  [key: string]: unknown;
}

export interface MeasurementQuality {
  spatialCoverage?: number;
  temporalCoverage?: number;
  qualityScore?: number;
  validN?: number;
  uncertainty?: number;
  flags?: string[];
}

export interface IndicatorMeasurement {
  code?: string;
  indicatorCode?: string;
  indicator_code?: string;
  rawValue?: number | null;
  raw_value?: number | null;
  cleanedValue?: number | null;
  cleaned_value?: number | null;
  value?: number | null;
  unit?: string;
  numerator?: number | null;
  denominator?: number | null;
  period?: string;
  referenceDate?: string;
  geography?: string;
  score1to5?: number | null;
  score_1_5?: number | null;
  status?: MeasurementStatus | string;
  quality?: MeasurementQuality | number | string;
  qualityScore?: number;
  uncertaintyLow?: number;
  uncertaintyHigh?: number;
  evidenceIds?: string[];
  evidence_ids?: string[];
  evidence_id?: string;
  formulaVersion?: string;
  formula_version?: string;
  sourceVersion?: string;
  updatedAt?: string;
  imputed?: boolean;
  method?: { formula_version?: string; code_commit?: string };
  [key: string]: unknown;
}

export interface StandardizationRule {
  direction: Direction;
  lower: number;
  upper: number;
  optimalLower?: number;
  optimalUpper?: number;
  worstLower?: number;
  worstUpper?: number;
}

export interface StandardizedScore {
  normalized0to100: number;
  score1to5: number;
  direction: Direction;
  rule: StandardizationRule;
}

export interface IndicatorAuditRow {
  code: string;
  sourceOrder: number;
  domain: Domain;
  driverId: DriverId;
  indicator: string;
  weight: number;
  status: SupplyTaskStatus | MeasurementStatus | 'MISSING';
  rawValue: number | null;
  cleanedValue: number | null;
  unit: string | null;
  score1to5: number | null;
  qualityScore: number;
  coverage: number;
  evidenceIds: string[];
  evidence: EvidenceRecord[];
  formulaVersion: string;
  direction: Direction;
  flags: string[];
  nextAction: string;
  trace: {
    registryVersion: string;
    measurementIndex: number | null;
    evidenceIds: string[];
  };
}

export interface AggregateSummary {
  score: number | null;
  weightedCoverage: number;
  confidence: number;
  weightTotal: number;
  weightUsed: number;
  validIndicatorCount: number;
  totalIndicatorCount: number;
  missingCodes: string[];
}

export interface UncertaintySummary {
  low: number | null;
  high: number | null;
  labelStability: number;
  samples: number;
  method: string;
}

export interface ImbalanceResult {
  pattern: string;
  label: string;
  code: string;
  requiresReview: boolean;
  reason: string;
  domainBands: Record<Domain, 'L' | 'M' | 'H' | null>;
}

export interface TypologyResult {
  runId: string;
  registryVersion: string;
  generatedAt: string;
  domainScores: Record<Domain, number | null>;
  domainLabels: Record<Domain, string | null>;
  weightedCoverage: Record<Domain, number>;
  domainConfidence: Record<Domain, number>;
  driverScores: Record<string, number | null>;
  driverCoverage: Record<string, number>;
  driverConfidence: Record<string, number>;
  SI: number | null;
  sustainabilityIndex: number | null;
  P: number | null;
  B: number | null;
  N: number | null;
  physicalType: string | null;
  behavioralType: string | null;
  normativeType: string | null;
  scenario: ImbalanceResult | null;
  uncertainty: UncertaintySummary;
  publicationLevel: PublicationLevel;
  certificationStatus: PublicationLevel;
  status: 'provisional' | 'verified' | 'rejected' | 'exploratory';
  missingIndicators: Array<{ code: string; reason: string; nextAction: string }>;
  invalidMeasurements: Array<{ code: string; reason: string; index?: number }>;
  aggregates: Record<Domain, AggregateSummary>;
  driverAggregates: Record<string, AggregateSummary>;
  audit: {
    runId: string;
    registryVersion: string;
    generatedAt: string;
    registrySourcePath?: string;
    indicators: IndicatorAuditRow[];
    evidence: EvidenceRecord[];
    warnings: string[];
    inputs: { measurementCount: number; evidenceCount: number; boundaryConfidence: number | null; expertApproved: boolean };
    reproducibility: { formulaVersions: string[]; codeVersion: string; immutableInputIds: string[] };
  };
}

export interface AggregateOptions {
  config?: TypologyConfigInput;
  runId?: string;
  registryVersion?: string;
  boundaryConfidence?: number | null;
  labelStability?: number;
  expertApproved?: boolean;
  codeVersion?: string;
  criticalIndicatorCodes?: string[];
  referenceYear?: number;
  currentYear?: number;
  uncertaintySamples?: number;
  seed?: number;
  fundamentalQaFailure?: boolean;
}

export interface RunRecord {
  runId: string;
  request: NeighborhoodRequest;
  registryVersion: string;
  codeVersion: string;
  status: RunStatus;
  createdAt: string;
  folders: ['raw', 'staging', 'curated', 'features', 'reports'];
}

export interface LocationCandidate {
  id: string;
  canonicalName: string;
  aliases: string[];
  province?: string;
  cityOrCounty?: string;
  settlementType?: 'urban' | 'rural';
  centroid?: [number, number];
  confidence: number;
  sources: string[];
}
